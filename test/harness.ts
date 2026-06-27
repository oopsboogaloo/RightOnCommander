// Headless test harness: build a sim with null backends and drive it without rAF or a
// wall clock, so a full run completes in milliseconds. [ROC-TEST-5]

import { createSim, type Sim, type SimContent } from '../src/sim/index.js';
import type { InputFrame } from '../src/interfaces.js';
import type { SimEvent } from '../src/sim/components.js';

export const emptyInput = (): InputFrame => ({
  moveTarget: null,
  firing: false,
  fireTapped: false,
  ecm: false,
  energyBomb: false,
  confirm: false,
  pause: false,
});

export function makeSim(seed = 1, content: SimContent = {}): Sim {
  return createSim({ seed, content });
}

// Step the sim n times, sourcing each frame's input from inputFn (defaults to empty).
// Returns the concatenated event stream.
export function runFrames(sim: Sim, n: number, inputFn?: (i: number) => InputFrame): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    events.push(...sim.step(inputFn ? inputFn(i) : emptyInput()));
  }
  return events;
}

// Replay a recorded input log against a fresh sim with the given seed.
export function replay(seed: number, inputLog: InputFrame[]): Sim {
  const sim = makeSim(seed);
  for (const frame of inputLog) sim.step(frame);
  return sim;
}
