// T7.0/T7.0a scenario: multi-level campaign progression and multi-boss mid-fights. Docking at the
// end of one level and confirming launch advances to the *next* level's own content (not a restart
// of the level just finished); past the last level, relaunching holds in place. A `midBoss` array
// spawns every named boss together, and the fight only clears once all of them are dead.
// [ROC-LVL-1,2, ROC-L3-3]

import { describe, it, expect } from 'vitest';
import { makeSim, emptyInput } from '../harness.js';
import type { Sim } from '../../src/sim/index.js';
import type { InputFrame } from '../../src/interfaces.js';
import { applyDamage } from '../../src/sim/systems/damage.js';

const firing = (): InputFrame => ({ ...emptyInput(), firing: true });

function runUntil(sim: Sim, pred: () => boolean, maxFrames = 30000, fire = true): void {
  for (let i = 0; i < maxFrames && !pred(); i++) {
    // Shop for nothing and leave straight away, so a bare "run to DOCK" doesn't get stuck at the
    // mid-level trader. [ROC-MDCK-2]
    if (sim.state.levelState === 'MID_DOCK') sim.midDockLaunch();
    sim.step(fire ? firing() : emptyInput());
  }
}

const content = {
  enemies: {
    boss1: { hull: 1, bounty: 50, colliderRx: 0.3, colliderRz: 0.3 },
    boss2a: { hull: 1, bounty: 20, colliderRx: 0.3, colliderRz: 0.3 },
    boss2b: { hull: 1, bounty: 20, colliderRx: 0.3, colliderRz: 0.3 },
  },
  levels: [
    {
      id: 'one',
      name: 'Lave',
      launchMs: 20,
      wavesA: [],
      midBoss: 'boss1',
      wavesB: [],
      endBoss: 'boss1',
    },
    {
      id: 'two',
      name: 'Diso',
      launchMs: 20,
      wavesA: [],
      midBoss: ['boss2a', 'boss2b'], // a pair, fought together [ROC-L3-3]
      wavesB: [],
      endBoss: 'boss1',
    },
  ],
};

describe('campaign progression', () => {
  it('advances to the next level on relaunch, not a restart of the one just finished', () => {
    const sim = makeSim(1, content);
    expect(sim.state.levelIndex).toBe(0);

    runUntil(sim, () => sim.state.levelState === 'DOCK');
    expect(sim.state.levelIndex).toBe(0); // still level 1 until launch is confirmed

    sim.relaunch();
    expect(sim.state.levelIndex).toBe(1); // advanced into level 2
    expect(sim.state.levelState).toBe('LAUNCH'); // level 2's own opening, not level 1's restart

    // Level 2's content (not level 1's) is what actually plays: its hyperspace countdown names
    // its own destination system.
    const countdown: string[] = [];
    for (let i = 0; i < 3000 && sim.state.levelState !== 'WAVES_A'; i++) {
      const events = sim.step(emptyInput());
      for (const ev of events) if (ev.type === 'hyperCountdown') countdown.push(ev.system as string);
    }
    expect(countdown.every((s) => s === 'Diso')).toBe(true);
    expect(countdown.length).toBeGreaterThan(0);
  });

  it('holds at the last level once the campaign runs out — relaunching just replays it', () => {
    const sim = makeSim(1, content);
    runUntil(sim, () => sim.state.levelState === 'DOCK');
    sim.relaunch(); // -> level 2 (the last one in this tiny campaign)
    expect(sim.state.levelIndex).toBe(1);

    runUntil(sim, () => sim.state.levelState === 'DOCK');
    sim.relaunch(); // no level 3 to advance into
    expect(sim.state.levelIndex).toBe(1); // clamped, not out of bounds
    expect(sim.state.levelState).toBe('LAUNCH');
  });

  it('spawns every named mid-boss together and only clears once all are dead', () => {
    const sim = makeSim(1, content);
    sim.relaunch(); // jump straight to level 2 (index 1), which has the boss pair
    runUntil(sim, () => sim.state.levelState === 'MID_BOSS', 30000, false);

    const bosses = () => [...sim.state.entities.values()].filter((e) => e.kind === 'boss');
    expect(bosses()).toHaveLength(2);
    expect(new Set(bosses().map((b) => b.pos.x)).size).toBe(2); // spawned apart, not stacked

    // Kill just one (directly, so the test doesn't depend on the player's aim reaching an
    // off-centre boss): the fight must not clear yet.
    const [first, second] = bosses();
    applyDamage(sim.state, first, 999);
    for (let i = 0; i < 30; i++) sim.step(emptyInput());
    expect(sim.state.levelState).toBe('MID_BOSS');
    expect(bosses()).toHaveLength(1);

    // Kill the second: now the fight clears (through the RIGHT ON COMMANDER fade) into the
    // mid-level trader; leaving it (as if the player shopped and launched) reaches WAVES_B.
    // [ROC-MDCK-1,2]
    applyDamage(sim.state, second, 999);
    runUntil(sim, () => sim.state.bossFadeTtl > 0, 30000, false);
    runUntil(sim, () => sim.state.levelState === 'MID_DOCK', 30000, false);
    sim.midDockLaunch();
    expect(sim.state.levelState).toBe('WAVES_B');
  });
});
