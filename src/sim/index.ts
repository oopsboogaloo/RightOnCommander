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
import { weaponsSystem } from './systems/weapons.js';
import { collisionSystem } from './systems/collision.js';
import { damageSystem } from './systems/damage.js';
import { economySystem } from './systems/economy.js';
import { particlesSystem, DEFAULT_PARTICLES, type FragGeom } from './systems/particles.js';
import type { Mesh } from '../interfaces.js';
import { waveSystem, type WaveContext } from './systems/waves.js';
import { aiSystem } from './systems/ai.js';
import { missilesSystem } from './systems/missiles.js';
import { dropsSystem } from './systems/drops.js';
import { pickupsSystem } from './systems/pickups.js';
import { startLevel, levelStateSystem, type LevelDef } from './systems/levelstate.js';
import { gamestateSystem, DEFAULT_GAMESTATE } from './systems/gamestate.js';
import { loadContent } from './content/loadContent.js';

// Fixed sim tick, in seconds. Must match the shell loop's DT (platform/loop.ts). [design §3]
export const SIM_DT = 1 / 120;

// Collision broadphase cell size (world units). Hull silhouettes are wired in once content
// loading + enemies land (Phase 4); until then unshielded targets fall back to a circle.
const COLLISION_CELL = 0.6;

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
  for (const [id, m] of Object.entries(meshes)) {
    if (!m?.edges || !m?.vertices) continue;
    fragGeom[id] = m.edges.map(([i, j]) => ({
      ax: m.vertices[i].x * SHIP_SCALE,
      az: m.vertices[i].z * SHIP_SCALE,
      bx: m.vertices[j].x * SHIP_SCALE,
      bz: m.vertices[j].z * SHIP_SCALE,
    }));
  }

  // Wipe the current combat and re-run the level's opening after a death that costs a life.
  function restartLevel(): void {
    if (!level) return;
    for (const e of [...world.entities.values()]) {
      if (e.kind === 'enemy' || e.kind === 'boss' || e.kind === 'projectile' || e.kind === 'missile' || e.kind === 'pickup') {
        world.entities.delete(e.id);
      }
    }
    world.waves.active.clear();
    startLevel(world, level, waveCtx);
  }

  function step(input: InputFrame): SimEvent[] {
    rng.setState(world.rngState);
    world.events = [];

    movementSystem(world, input, SIM_DT);
    weaponsSystem(world, input, SIM_DT);
    missilesSystem(world, SIM_DT);
    waveSystem(world, rng, SIM_DT, waveCtx);
    aiSystem(world, SIM_DT);
    if (level) levelStateSystem(world, SIM_DT, level, waveCtx);
    const hits = collisionSystem(world, {
      dt: SIM_DT,
      cellSize: COLLISION_CELL,
      getSilhouette: () => undefined,
      colliderScale: SHIP_SCALE,
    });
    damageSystem(world, hits, SIM_DT);
    gamestateSystem(world, SIM_DT, restartLevel, { ...DEFAULT_GAMESTATE, colliderScale: SHIP_SCALE });
    dropsSystem(world);
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
