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
import { makeWorld, type World } from './world.js';
import { movementSystem } from './systems/movement.js';
import { weaponsSystem } from './systems/weapons.js';
import { collisionSystem } from './systems/collision.js';
import { damageSystem } from './systems/damage.js';
import { economySystem } from './systems/economy.js';
import { particlesSystem } from './systems/particles.js';

// Fixed sim tick, in seconds. Must match the shell loop's DT (platform/loop.ts). [design §3]
export const SIM_DT = 1 / 120;

// Collision broadphase cell size (world units). Hull silhouettes are wired in once content
// loading + enemies land (Phase 4); until then unshielded targets fall back to a circle.
const COLLISION_CELL = 0.6;

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
}

export function createSim({ seed }: CreateSimArgs): Sim {
  const world = makeWorld(seed);
  const rng: Rng = createRng(world.rngState);

  function step(input: InputFrame): SimEvent[] {
    rng.setState(world.rngState);
    world.events = [];

    movementSystem(world, input, SIM_DT);
    weaponsSystem(world, input, SIM_DT);
    const hits = collisionSystem(world, {
      dt: SIM_DT,
      cellSize: COLLISION_CELL,
      getSilhouette: () => undefined,
    });
    damageSystem(world, hits, SIM_DT);
    economySystem(world);
    particlesSystem(world, rng, SIM_DT);

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
  };
}
