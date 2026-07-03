// The sim surface. createSim wires a World + RNG together and exposes the deterministic
// step/snapshot/restore contract the shell and tests both use. [design §4]
//
// step() runs the ordered systems (design §6); more land per task. The whole advance is a
// deterministic function of world state + input, which the determinism and snapshot
// round-trip properties rely on. [ROC-TEST-2,4,5]

import type { InputFrame } from '../interfaces.js';
import type { SimEvent } from './components.js';
import { createRng, type Rng } from './rng.js';
import { snapshot, restore, type WorldSnapshot } from './snapshot.js';
import { makeWorld, PLAYER_ID, type World } from './world.js';
import { vec3 } from './math/vec3.js';
import { movementSystem } from './systems/movement.js';
import { weaponsSystem, DEFAULT_WEAPONS } from './systems/weapons.js';
import { collisionSystem, meshSilhouette, hullRadius } from './systems/collision.js';
import type { Pt } from './math/geom2.js';
import { damageSystem } from './systems/damage.js';
import { economySystem } from './systems/economy.js';
import { particlesSystem, DEFAULT_PARTICLES, type FragGeom } from './systems/particles.js';
import type { Mesh } from '../interfaces.js';
import { waveSystem, type WaveContext } from './systems/waves.js';
import { asteroidFieldSystem, asteroidSplitSystem } from './systems/asteroids.js';
import { aiSystem } from './systems/ai.js';
import { missilesSystem } from './systems/missiles.js';
import { dropsSystem } from './systems/drops.js';
import { pickupsSystem } from './systems/pickups.js';
import { startLevel, enterLevelState, levelStateSystem, type LevelDef } from './systems/levelstate.js';
import { gamestateSystem, DEFAULT_GAMESTATE } from './systems/gamestate.js';
import { bossSystem } from './systems/boss.js';
import { ecmSystem } from './systems/ecm.js';
import { loadContent } from './content/loadContent.js';

// Fixed sim tick, in seconds. Must match the shell loop's DT (platform/loop.ts). [design §3]
export const SIM_DT = 1 / 120;

// Collision broadphase cell size (world units). Must stay >= the largest target collider
// radius — the 2x-scale hermit/boss hulls reach ~0.67. [design §8]
const COLLISION_CELL = 0.8;

// The single source of truth for on-screen ship size: hull meshes (~1 world unit wide) are
// drawn — and collided — at this fraction so the hitbox matches the sprite. The renderer
// imports this for its model matrix; collision scales every collider by it. [DEFECTS D2/D4]
export const SHIP_SCALE = 1 / 3;

// Beam-laser hit radii must match the rendered/collided hull size. [ROC-LAS-6]
const WEAPONS = { ...DEFAULT_WEAPONS, colliderScale: SHIP_SCALE };

export interface SimConfig {
  [key: string]: unknown;
}

export interface SimContent {
  [key: string]: unknown;
}

export interface CreateSimArgs {
  seed: number;
  content?: SimContent;
  config?: SimConfig;
}

export interface Sim {
  step(input: InputFrame): SimEvent[];
  readonly state: World;
  snapshot(): WorldSnapshot;
  restore(snap: WorldSnapshot): void;
  relaunch(): void; // leave the station for a fresh level run, keeping ship/wallet/lives [ROC-STN-6]
}

export function createSim({ seed, content }: CreateSimArgs): Sim {
  const world = makeWorld(seed);
  const rng: Rng = createRng(world.rngState);

  // Parse + validate injected content; start the level if one is provided.
  const loaded = loadContent(content ?? {});
  const waveCtx: WaveContext = { enemies: loaded.enemies };
  const level: LevelDef | undefined = loaded.level;
  if (level) startLevel(world, level, waveCtx);

  // Pre-project each mesh's edges to the play plane at the rendered hull size, so a destroyed
  // ship can shatter into its own wireframe deterministically. [ROC-DMG-6]
  const meshes = (content?.meshes ?? {}) as Record<string, Mesh>;
  const fragGeom: FragGeom = {};
  const silhouettes: Record<string, Pt[]> = {}; // per-mesh convex hull outline, for tight collisions
  const hullRadii: Record<string, number> = {}; // per-mesh hullRadius(), for shield-ring gap sizing
  for (const [id, m] of Object.entries(meshes)) {
    if (!m?.edges || !m?.vertices) continue;
    fragGeom[id] = m.edges.map(([i, j]) => ({
      ax: m.vertices[i].x * SHIP_SCALE,
      az: m.vertices[i].z * SHIP_SCALE,
      bx: m.vertices[j].x * SHIP_SCALE,
      bz: m.vertices[j].z * SHIP_SCALE,
    }));
    silhouettes[id] = meshSilhouette(m);
    hullRadii[id] = hullRadius(silhouettes[id], SHIP_SCALE);
  }

  // Wipe the current combat (used before any level/phase restart).
  function clearCombat(): void {
    for (const e of [...world.entities.values()]) {
      if (
        e.kind === 'enemy' ||
        e.kind === 'boss' ||
        e.kind === 'asteroid' ||
        e.kind === 'projectile' ||
        e.kind === 'missile' ||
        e.kind === 'pickup' ||
        e.kind === 'station'
      ) {
        world.entities.delete(e.id);
      }
    }
    world.waves.active.clear();
    world.hermitWaveId = null;
    world.ecm = { fuse: -1, cooldown: 0 };
  }

  // Re-run the level's opening after a death that costs a life.
  function restartLevel(): void {
    if (!level) return;
    clearCombat();
    startLevel(world, level, waveCtx);
  }

  // Death checkpoint policy: where a spent life resumes. Boss fights respawn the player in
  // place and continue (the boss keeps its damage); a part-2 death resumes at the start of
  // part 2; a docking crash proceeds straight to the shop; anything earlier restarts the
  // level. Returns the respawn point. [ROC-BOSS-5,6,7, ROC-DCKG-4]
  function resumeAfterDeath(deathX: number, deathZ: number): { x: number; z: number } {
    if (!level) return { x: 0, z: 0 };
    switch (world.levelState) {
      case 'MID_BOSS':
      case 'END_BOSS':
      case 'VIPER_INTERCEPT':
        return { x: deathX, z: deathZ }; // fight on — nothing is reset [ROC-BOSS-5]
      case 'WAVES_B':
        clearCombat();
        world.scroll = 1;
        world.bossFadeTtl = 0;
        enterLevelState(world, 'WAVES_B', level, waveCtx); // part-2 checkpoint [ROC-BOSS-6]
        return { x: 0, z: 0 };
      case 'DOCKING':
        clearCombat();
        enterLevelState(world, 'DOCK', level, waveCtx); // crash still reaches the shop [ROC-DCKG-4]
        return { x: 0, z: 0 };
      default:
        restartLevel();
        return { x: 0, z: 0 };
    }
  }

  function step(input: InputFrame): SimEvent[] {
    rng.setState(world.rngState);
    world.events = [];

    movementSystem(world, input, SIM_DT);
    weaponsSystem(world, input, SIM_DT, WEAPONS);
    missilesSystem(world, SIM_DT);
    ecmSystem(world, SIM_DT); // boss ECM pops player missiles after its fuse [ROC-BECM-*]
    waveSystem(world, rng, SIM_DT, waveCtx);
    asteroidFieldSystem(world, rng, SIM_DT);
    aiSystem(world, SIM_DT);
    bossSystem(world, rng, SIM_DT, waveCtx); // hermit spin/escorts + FdL strafe track [ROC-HERM-*, ROC-FDL-*]
    if (level) levelStateSystem(world, SIM_DT, level, waveCtx);
    const hits = collisionSystem(world, {
      dt: SIM_DT,
      cellSize: COLLISION_CELL,
      getSilhouette: (id) => silhouettes[id], // hull outline, not a circle — shielded hits stop at its ring gap
      getHullRadius: (id) => hullRadii[id],
      colliderScale: SHIP_SCALE,
    });
    damageSystem(world, hits, SIM_DT);
    gamestateSystem(world, SIM_DT, resumeAfterDeath, {
      ...DEFAULT_GAMESTATE,
      colliderScale: SHIP_SCALE,
      getSilhouette: (id) => silhouettes[id],
      getHullRadius: (id) => hullRadii[id],
    });
    asteroidSplitSystem(world, rng);
    dropsSystem(world, rng);
    pickupsSystem(world, SIM_DT);
    economySystem(world);
    particlesSystem(world, rng, SIM_DT, DEFAULT_PARTICLES, fragGeom);

    world.rngState = rng.getState();
    world.frame++;
    return world.events;
  }

  return {
    step,
    get state(): World {
      return world;
    },
    snapshot: (): WorldSnapshot => snapshot(world),
    restore: (snap: WorldSnapshot): void => {
      restore(world, snap);
      rng.setState(world.rngState);
    },
    relaunch: (): void => {
      // Undock: wipe the old run, repair the hull and re-fly the level with progress intact.
      restartLevel();
      const p = world.entities.get(PLAYER_ID);
      if (p) {
        p.pos = vec3(0, 0, 0);
        p.vel = vec3(0, 0, 0);
        p.hull = p.hullMax ?? p.hull;
        p.shield = p.shieldMax ?? 0;
      }
      world.player.invulnTtl = 0;
      world.mode = '';
    },
  };
}
