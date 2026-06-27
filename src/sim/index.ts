// The sim surface. createSim wires a World + RNG together and exposes the deterministic
// step/snapshot/restore contract the shell and tests both use. [design §4]
//
// Systems land in later tasks; for now step() runs a tiny deterministic skeleton (player
// follows moveTarget, RNG-driven bank jitter, fire events) so the determinism and
// snapshot round-trip properties have real state to exercise. [ROC-TEST-2,4,5]

import type { InputFrame } from '../interfaces.js';
import type { SimEvent } from './components.js';
import { createRng, type Rng } from './rng.js';
import { snapshot, restore, type WorldSnapshot } from './snapshot.js';
import { makeWorld, PLAYER_ID, type World } from './world.js';

// Placeholder spin rate (radians per fixed step) for the T1.3 demo; ~0.7 rad/s at 120 Hz.
const DEMO_SPIN_PER_STEP = 0.006;

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

    const player = world.entities.get(PLAYER_ID);
    if (player) {
      if (input.moveTarget) {
        // Critically-damped-ish follow toward the move target.
        player.pos.x += (input.moveTarget.x - player.pos.x) * 0.1;
        player.pos.y += (input.moveTarget.y - player.pos.y) * 0.1;
      }
      // Bank jitter sourced from the RNG so determinism has something to bite on.
      player.bank = player.bank * 0.9 + (rng.next() - 0.5) * 0.01;

      // PLACEHOLDER (T1.3): spin the player at the fixed tick so the loop's interpolation is
      // visible. The movement system (T2.2) replaces this with real heading/banking.
      player.yaw += DEMO_SPIN_PER_STEP;

      if (input.fireTapped || input.firing) {
        world.events.push({ type: 'sfx', id: 'laser_pulse' });
      }
    }

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
