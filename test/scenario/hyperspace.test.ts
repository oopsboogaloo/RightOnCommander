// T5a.8 scenario: launch & hyperspace — the departure Coriolis scrolls away behind the player,
// the countdown emits "Hyperspace <system> 5 ... 1", the scroll factor ramps to the peak
// (full-height starfield lines) and settles back, and the system info card precedes the level
// proper. Runs on every launch, including the first. [ROC-HYP-1..5]

import { describe, it, expect } from 'vitest';
import { makeSim, emptyInput, runFrames } from '../harness.js';
import { HYPER, INFO_SEC, hyperCountdown } from '../../src/sim/systems/levelstate.js';

const DT = 1 / 120;

const content = {
  enemies: {
    grunt: { hull: 1, bounty: 5, colliderRx: 0.2, colliderRz: 0.2 },
    midboss: { hull: 2, bounty: 100, colliderRx: 0.3, colliderRz: 0.3 },
    endboss: { hull: 2, bounty: 100, colliderRx: 0.3, colliderRz: 0.3 },
  },
  level: {
    id: 'tiny',
    name: 'Lave',
    facts: ['Lave is most famous for its vast rain forests', 'and the Laveian tree grub.'],
    launchMs: 500,
    wavesA: [{ id: 'a', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 200 }],
    midBoss: 'midboss',
    wavesB: [{ id: 'b', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 200 }],
    endBoss: 'endboss',
  },
};

describe('launch & hyperspace', () => {
  it('shows the departure station, counts down, stretches the starfield, then plays the info card', () => {
    const sim = makeSim(1, content);

    // The very first launch shows the ship leaving a Coriolis pointing up-screen. [ROC-HYP-1]
    expect(sim.state.levelState).toBe('LAUNCH');
    const depart = [...sim.state.entities.values()].find((e) => e.kind === 'station');
    expect(depart).toBeDefined();
    expect(depart!.vel.z).toBeLessThan(0); // scrolling out of view behind the player

    // Collect everything through HYPERSPACE and INFO.
    const states = new Set<string>([sim.state.levelState]);
    const countdown: { n: number; system: string }[] = [];
    let maxScroll = 1;
    const frames = Math.round((0.5 + HYPER.countdownSec + HYPER.rampSec + HYPER.holdSec + HYPER.settleSec + INFO_SEC + 1) / DT);
    for (let i = 0; i < frames && sim.state.levelState !== 'WAVES_A'; i++) {
      const events = sim.step(emptyInput());
      states.add(sim.state.levelState);
      maxScroll = Math.max(maxScroll, sim.state.scroll);
      for (const ev of events) {
        if (ev.type === 'hyperCountdown') countdown.push({ n: ev.n as number, system: ev.system as string });
      }
    }

    expect(states.has('HYPERSPACE')).toBe(true);
    expect(states.has('INFO')).toBe(true); // the facts card before play [ROC-HYP-5]
    expect(countdown.map((c) => c.n)).toEqual([5, 4, 3, 2, 1]); // "Hyperspace Lave 5 ... 1" [ROC-HYP-2]
    expect(countdown.every((c) => c.system === 'Lave')).toBe(true); // destination = system name
    expect(maxScroll).toBe(HYPER.peak); // full stretch reached [ROC-HYP-3]
    expect(sim.state.scroll).toBe(1); // settled back to the normal scroll [ROC-HYP-4]
    expect(sim.state.levelState).toBe('WAVES_A'); // the level then resumes
    // The departure station has long since scrolled away and been culled.
    expect([...sim.state.entities.values()].some((e) => e.kind === 'station')).toBe(false);
  });

  it('derives the on-screen countdown text from levelTimer alone', () => {
    const total = HYPER.countdownSec + HYPER.rampSec + HYPER.holdSec + HYPER.settleSec;
    expect(hyperCountdown(total)).toBe(5); // just entered
    expect(hyperCountdown(total - 1.5)).toBe(4);
    expect(hyperCountdown(total - 4.99)).toBe(1);
    expect(hyperCountdown(total - HYPER.countdownSec - 0.5)).toBeNull(); // jump underway
  });

  it('replays the sequence on relaunch (every launch, including from the shop)', () => {
    const sim = makeSim(1, content);
    runFrames(sim, 200); // past LAUNCH, into HYPERSPACE
    sim.relaunch();
    expect(sim.state.levelState).toBe('LAUNCH'); // [ROC-HYP-1]
    expect([...sim.state.entities.values()].some((e) => e.kind === 'station')).toBe(true);
  });
});
