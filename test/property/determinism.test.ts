// T0.3 property tests: the sim is deterministic, and snapshot/restore round-trips exactly.
// [ROC-TEST-2,4,5]

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { makeSim } from '../harness.js';
import type { InputFrame } from '../../src/interfaces.js';

const inputArb: fc.Arbitrary<InputFrame> = fc.record({
  moveTarget: fc.option(
    fc.record({
      x: fc.double({ min: -500, max: 500, noNaN: true }),
      y: fc.double({ min: -500, max: 500, noNaN: true }),
    }),
    { nil: null },
  ),
  firing: fc.boolean(),
  fireTapped: fc.boolean(),
  ecm: fc.boolean(),
  energyBomb: fc.boolean(),
  confirm: fc.boolean(),
  pause: fc.boolean(),
});

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const logArb = fc.array(inputArb, { maxLength: 60 });

describe('sim determinism', () => {
  it('same seed + same input log ⇒ identical state', () => {
    fc.assert(
      fc.property(seedArb, logArb, (seed, log) => {
        const a = makeSim(seed);
        const b = makeSim(seed);
        for (const frame of log) {
          a.step(frame);
          b.step(frame);
        }
        expect(b.snapshot()).toEqual(a.snapshot());
      }),
    );
  });

  it('restore(snapshot()) then N steps == N steps then snapshot', () => {
    fc.assert(
      fc.property(seedArb, logArb, (seed, log) => {
        const split = Math.floor(log.length / 2);

        // Reference run: step the whole log on one sim.
        const ref = makeSim(seed);
        for (let i = 0; i < split; i++) ref.step(log[i]);
        const mid = ref.snapshot();
        for (let i = split; i < log.length; i++) ref.step(log[i]);
        const refEnd = ref.snapshot();

        // Restored run: rebuild from the mid-point snapshot, then finish the log.
        const restored = makeSim(seed === 0 ? 1 : seed - 1); // start from a different seed
        restored.restore(mid);
        for (let i = split; i < log.length; i++) restored.step(log[i]);

        expect(restored.snapshot()).toEqual(refEnd);
      }),
    );
  });
});
