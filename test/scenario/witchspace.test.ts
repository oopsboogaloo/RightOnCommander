// T7.1a scenario: the witchspace interlude (Level 2 -> 3 only). The hyperspace jump lingers at
// full stretch for a Thargoid wave instead of settling on a timer; the starfield only settles and
// the level proceeds to INFO once every Thargoid is cleared. A level without `witchspace` set
// (Level 1, Level 2) is unaffected — it settles and proceeds exactly as before.
// [ROC-WITCH-1..4]

import { describe, it, expect } from 'vitest';
import { makeSim, emptyInput, runFrames } from '../harness.js';
import { HYPER } from '../../src/sim/systems/levelstate.js';

const DT = 1 / 120;

const content = {
  enemies: {
    grunt: { hull: 1, bounty: 5, colliderRx: 0.2, colliderRz: 0.2 },
    thargoid: { hull: 1, bounty: 300, colliderRx: 0.25, colliderRz: 0.25 },
    midboss: { hull: 1, bounty: 50, colliderRx: 0.3, colliderRz: 0.3 },
    endboss: { hull: 1, bounty: 50, colliderRx: 0.3, colliderRz: 0.3 },
  },
  levels: [
    {
      id: 'plain',
      name: 'Diso',
      launchMs: 0,
      wavesA: [],
      midBoss: 'midboss',
      wavesB: [],
      endBoss: 'endboss',
    },
    {
      id: 'witch',
      name: 'Leesti',
      launchMs: 0,
      witchspace: {
        id: 'w',
        pattern: 'sine_column',
        enemy: 'thargoid',
        count: 2,
        spacingMs: 0,
        durationMs: 60000,
      },
      wavesA: [],
      midBoss: 'midboss',
      wavesB: [],
      endBoss: 'endboss',
    },
  ],
};

const HOLD_FRAMES = Math.round((HYPER.countdownSec + HYPER.rampSec + HYPER.holdSec) / DT) + 2;

describe('witchspace interlude', () => {
  it('holds the starfield at peak stretch through the Thargoid wave, then settles into INFO', () => {
    const sim = makeSim(1, content);
    sim.relaunch(); // jump straight into the witchspace level (index 1)
    expect(sim.state.levelIndex).toBe(1);

    // Run to the end of the hold phase, just before an ordinary jump would start settling.
    for (let i = 0; i < HOLD_FRAMES; i++) sim.step(emptyInput());
    expect(sim.state.levelState).toBe('WITCHSPACE_COMBAT');
    expect(sim.state.scroll).toBe(HYPER.peak);

    // It stays there — no settling — for as long as the wave holds, however long that takes.
    for (let i = 0; i < 300; i++) sim.step(emptyInput());
    expect(sim.state.levelState).toBe('WITCHSPACE_COMBAT');
    expect(sim.state.scroll).toBe(HYPER.peak);
    expect([...sim.state.entities.values()].some((e) => e.kind === 'enemy')).toBe(true);

    // Clear every Thargoid: the jump resolves, the stretched lines settle, and the level proceeds.
    for (const e of [...sim.state.entities.values()]) if (e.kind === 'enemy') sim.state.entities.delete(e.id);
    for (let i = 0; i < Math.round((HYPER.settleSec + 0.5) / DT); i++) sim.step(emptyInput());

    expect(sim.state.levelState).toBe('INFO');
    expect(sim.state.scroll).toBe(1); // settled back to the normal scroll [ROC-WITCH-3]
  });

  it('does not affect a level with no witchspace field (Level 1/2 behave as before)', () => {
    const sim = makeSim(1, content); // starts on levels[0], which has no `witchspace`
    const frames = Math.round((HYPER.countdownSec + HYPER.rampSec + HYPER.holdSec + HYPER.settleSec + 1) / DT);
    runFrames(sim, frames);
    expect(sim.state.levelState).not.toBe('WITCHSPACE_COMBAT');
    expect(sim.state.scroll).toBe(1);
  });
});
