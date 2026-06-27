// T1.3 unit tests for the fixed-timestep accumulator. [design §3]

import { describe, it, expect } from 'vitest';
import { drainSteps, DT, MAX_FRAME_SECONDS } from '../../src/platform/loop.js';

describe('drainSteps', () => {
  it('runs two sim steps for a 1/60 s display frame at a 1/120 s tick', () => {
    let n = 0;
    const r = drainSteps(0, 1 / 60, () => n++);
    expect(n).toBe(2);
    expect(r.steps).toBe(2);
    expect(r.acc).toBeCloseTo(0, 12);
  });

  it('clamps a huge frame gap to avoid the spiral of death', () => {
    let n = 0;
    const r = drainSteps(0, 5, () => n++);
    expect(r.steps).toBe(Math.floor(MAX_FRAME_SECONDS / DT)); // 30
    expect(r.acc).toBeLessThan(DT);
  });

  it('accumulates leftover time across sub-tick frames', () => {
    let n = 0;
    let acc = 0;
    ({ acc } = drainSteps(acc, 1 / 180, () => n++)); // < DT: no step yet
    expect(n).toBe(0);
    ({ acc } = drainSteps(acc, 1 / 180, () => n++)); // now crosses DT
    expect(n).toBe(1);
    expect(acc).toBeLessThan(DT);
  });

  it('always leaves an accumulator smaller than one tick', () => {
    for (const frame of [0, 0.001, 1 / 120, 1 / 60, 0.05, 0.3]) {
      const r = drainSteps(0, frame, () => {});
      expect(r.acc).toBeGreaterThanOrEqual(0);
      expect(r.acc).toBeLessThan(DT);
    }
  });
});
