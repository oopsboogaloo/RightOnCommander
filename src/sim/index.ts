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
import { weaponsSystem, DEFAULT_WEAPONS, type HullExtent } from './systems/weapons.js';
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
import { pickupsSystem, DEFAULT_PICKUPS } from './systems/pickups.js';
import { startLevel, enterLevelState, levelStateSystem, type LevelDef } from './systems/levelstate.js';
import { gamestateSystem, DEFAULT_GAMESTATE } from './systems/gamestate.js';
import { bossSystem } from './systems/boss.js';
import { ecmSystem } from './systems/ecm.js';
import { cloakSystem } from './systems/cloak.js';
import { energyBankSystem } from './systems/energyBank.js';
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
  midDockLaunch(): void; // leave the mid-level trader: resume WAVES_B in place, no restart [ROC-MDCK-2]
  cheatSkipLevel(): void; // dev cheat: wipe the current combat and jump straight to docking
}

export function createSim({ seed, content }: CreateSimArgs): Sim {
  const world = makeWorld(seed);
  const rng: Rng = createRng(world.rngState);

  // Parse + validate injected content; start the campaign's first level, if any is provided.
  const loaded = loadContent(content ?? {});
  const waveCtx: WaveContext = { enemies: loaded.enemies };
  const levels: LevelDef[] = loaded.levels;
  const currentLevel = (): LevelDef | undefined => levels[world.levelIndex];
  if (currentLevel()) startLevel(world, currentLevel()!, waveCtx);

  // Pre-project each mesh's edges to the play plane at the rendered hull size, so a destroyed
  // ship can shatter into its own wireframe deterministically. [ROC-DMG-6]
  const meshes = (content?.meshes ?? {}) as Record<string, Mesh>;
  const fragGeom: FragGeom = {};
  const silhouettes: Record<string, Pt[]> = {}; // per-mesh convex hull outline, for tight collisions
  const hullRadii: Record<string, number> = {}; // per-mesh hullRadius(), for shield-ring gap sizing
  const hullExtents: Record<string, HullExtent> = {}; // per-mesh reach along each firing axis, for muzzle placement
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
    // The silhouette is (x, z) in local mesh space; the player never yaws, so front/rear/left/
    // right map straight onto it — each mount reaches exactly as far as the hull does along its
    // own axis (nose, tail and wingtips are rarely the same distance). [ROC-LAS-*]
    let maxX = 0, minX = 0, maxZ = 0, minZ = 0;
    for (const p of silhouettes[id]) {
      maxX = Math.max(maxX, p.x);
      minX = Math.min(minX, p.x);
      maxZ = Math.max(maxZ, p.y);
      minZ = Math.min(minZ, p.y);
    }
    hullExtents[id] = {
      front: maxZ * SHIP_SCALE,
      rear: -minZ * SHIP_SCALE,
      right: maxX * SHIP_SCALE,
      left: -minX * SHIP_SCALE,
    };
  }

  // Muzzles start at the hull surface (+ a small gap), matching the rendered/collided size, and
  // beam hits use the same hull silhouette (and shield-ring gap) as pulse/military bolts, not a
  // plain circle. [ROC-LAS-6]
  const weaponsCfg = {
    ...DEFAULT_WEAPONS,
    colliderScale: SHIP_SCALE,
    getHullExtent: (id: string) => hullExtents[id],
    getSilhouette: (id: string) => silhouettes[id],
    getHullRadius: (id: string) => hullRadii[id],
  };

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

  // Re-run the current level's opening. Deaths never call this any more (they respawn in place,
  // preserving whatever waves/asteroids/boss fight was underway); only relaunch() (leaving the
  // station after docking, to fly the next level fresh) uses it. [ROC-LIFE-2]
  function restartLevel(): void {
    const lvl = currentLevel();
    if (!lvl) return;
    clearCombat();
    startLevel(world, lvl, waveCtx);
  }

  function step(input: InputFrame): SimEvent[] {
    rng.setState(world.rngState);
    world.events = [];

    movementSystem(world, input, SIM_DT);
    weaponsSystem(world, input, SIM_DT, weaponsCfg);
    missilesSystem(world, SIM_DT);
    ecmSystem(world, SIM_DT); // boss ECM pops player missiles after its fuse [ROC-BECM-*]
    cloakSystem(world, SIM_DT); // Cougar cloak cycle + player cloak-device countdown [ROC-CLK-*]
    waveSystem(world, rng, SIM_DT, waveCtx);
    asteroidFieldSystem(world, rng, SIM_DT);
    aiSystem(world, SIM_DT);
    bossSystem(world, rng, SIM_DT, waveCtx); // hermit spin/escorts + FdL strafe track [ROC-HERM-*, ROC-FDL-*]
    const activeLevel = currentLevel();
    if (activeLevel) levelStateSystem(world, SIM_DT, activeLevel, waveCtx);
    const hits = collisionSystem(world, {
      dt: SIM_DT,
      cellSize: COLLISION_CELL,
      getSilhouette: (id) => silhouettes[id], // hull outline, not a circle — shielded hits stop at its ring gap
      getHullRadius: (id) => hullRadii[id],
      colliderScale: SHIP_SCALE,
    });
    damageSystem(world, hits, SIM_DT);
    gamestateSystem(world, SIM_DT, {
      ...DEFAULT_GAMESTATE,
      colliderScale: SHIP_SCALE,
      getSilhouette: (id) => silhouettes[id],
      getHullRadius: (id) => hullRadii[id],
    });
    energyBankSystem(world, SIM_DT); // very slow passive shield regen, if fitted [ROC-BANK-1,2]
    asteroidSplitSystem(world, rng);
    dropsSystem(world, rng);
    pickupsSystem(world, SIM_DT, { ...DEFAULT_PICKUPS, getHullRadius: (id) => hullRadii[id] });
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
      // Undock: advance to the next level in the campaign (holding at the last one once the
      // campaign is out of levels — full campaign-complete handling lands with Elite mode,
      // T9.1), wipe the old run, repair the hull and re-fly it with progress intact. [ROC-LVL-1,2]
      if (world.levelIndex + 1 < levels.length) world.levelIndex += 1;
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
    midDockLaunch: (): void => {
      // Leave the mid-level trader: resume WAVES_B in the same level, same run — no restart, no
      // campaign advance — just the same repair-and-reset the real station gives on relaunch.
      // [ROC-MDCK-2]
      const lvl = currentLevel();
      if (!lvl) return;
      enterLevelState(world, 'WAVES_B', lvl, waveCtx);
      const p = world.entities.get(PLAYER_ID);
      if (p) {
        p.pos = vec3(0, 0, 0);
        p.vel = vec3(0, 0, 0);
        p.hull = p.hullMax ?? p.hull;
        p.shield = p.shieldMax ?? 0;
      }
      world.player.invulnTtl = 0;
    },
    cheatSkipLevel: (): void => {
      // Skip past whatever combat is underway straight to the docking approach — the level ends
      // exactly as an ordinary clear would, just without playing it out.
      const lvl = currentLevel();
      if (!lvl) return;
      clearCombat();
      enterLevelState(world, 'DOCKING', lvl, waveCtx);
    },
  };
}
