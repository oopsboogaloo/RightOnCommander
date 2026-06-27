// T1.3 scenario: the shell loop, driven by an injected clock and rAF, advances the sim by
// the same fixed steps the headless harness would — so display timing never changes sim
// behaviour, and the harness can replay the same sim.step with no rAF. [ROC-TEST-5, AS-2]

import { describe, it, expect } from 'vitest';
import { startGameLoop } from '../../src/platform/loop.js';
import { makeSim, emptyInput } from '../harness.js';

describe('startGameLoop drives the sim deterministically', () => {
  it('matches a no-rAF harness run of the same step count', () => {
    const sim = makeSim(1);

    let captured: ((t: number) => void) | null = null;
    const raf = (cb: (t: number) => void): number => {
      captured = cb;
      return 1;
    };

    let t = 0;
    const now = (): number => t;
    let stepCount = 0;
    const alphas: number[] = [];

    const loop = startGameLoop({
      now,
      raf,
      cancel: () => {},
      step: () => {
        sim.step(emptyInput());
        stepCount++;
      },
      render: (alpha) => alphas.push(alpha),
    });

    // Simulate 12 display frames at 60 fps.
    for (let i = 0; i < 12; i++) {
      t += 1000 / 60;
      captured!(t);
    }
    loop.stop();

    expect(stepCount).toBeGreaterThan(0);
    expect(alphas.every((a) => a >= 0 && a < 1)).toBe(true);

    // A fresh sim stepped the same number of times (no loop, no clock) must agree exactly.
    const reference = makeSim(1);
    for (let i = 0; i < stepCount; i++) reference.step(emptyInput());

    expect(sim.snapshot()).toEqual(reference.snapshot());
  });
});
