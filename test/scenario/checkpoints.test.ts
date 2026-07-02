// T5a.6 scenario: death checkpoints — dying at a boss respawns the player in place with the
// boss keeping its damage; dying in part 2 resumes at the start of part 2; dying in part 1
// still restarts the level. [ROC-BOSS-5,6,7]

import { describe, it, expect } from 'vitest';
import { makeSim, emptyInput } from '../harness.js';
import { PLAYER_ID } from '../../src/sim/world.js';
import type { Sim } from '../../src/sim/index.js';
import type { InputFrame } from '../../src/interfaces.js';

const firing = (): InputFrame => ({ ...emptyInput(), firing: true });

const content = {
  enemies: {
    grunt: { hull: 1, bounty: 5, colliderRx: 0.2, colliderRz: 0.2 },
    midboss: { hull: 60, bounty: 100, colliderRx: 0.3, colliderRz: 0.3 }, // tanky: survives the test
    endboss: { hull: 60, bounty: 100, colliderRx: 0.3, colliderRz: 0.3 },
  },
  level: {
    id: 'tiny',
    launchMs: 20,
    wavesA: [{ id: 'a', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 200 }],
    midBoss: 'midboss',
    wavesB: [{ id: 'b', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 60000 }],
    endBoss: 'endboss',
  },
};

function runUntil(sim: Sim, pred: () => boolean, maxFrames = 30000, fire = false): void {
  for (let i = 0; i < maxFrames && !pred(); i++) sim.step(fire ? firing() : emptyInput());
}

const boss = (sim: Sim) => [...sim.state.entities.values()].find((e) => e.kind === 'boss');

describe('death checkpoints', () => {
  it('at a boss: respawns in place and the boss keeps its damage', () => {
    const sim = makeSim(1, content);
    runUntil(sim, () => sim.state.levelState === 'MID_BOSS');

    const b = boss(sim)!;
    b.hull = 42; // the fight is well underway
    const player = sim.state.entities.get(PLAYER_ID)!;
    player.pos = { x: 0.4, y: 0, z: -0.6 };
    player.hull = 0; // and then the player dies

    sim.step(emptyInput());
    expect(sim.state.player.lives).toBe(2); // a life is still spent [§3.16]
    expect(sim.state.levelState).toBe('MID_BOSS'); // the fight continues [ROC-BOSS-5]
    const after = boss(sim)!;
    expect(after.id).toBe(b.id); // same boss, not respawned
    expect(after.hull).toBe(42); // damage retained [ROC-BOSS-5]
    const respawned = sim.state.entities.get(PLAYER_ID)!;
    expect(respawned.pos.x).toBeCloseTo(0.4, 5); // in place [ROC-BOSS-5]
    expect(respawned.pos.z).toBeCloseTo(-0.6, 5);
    expect(respawned.hull).toBe(respawned.hullMax);
  });

  it('in part 2: resumes at the start of part 2, not the level', () => {
    const sim = makeSim(1, content);
    runUntil(sim, () => sim.state.levelState === 'MID_BOSS');
    runUntil(sim, () => sim.state.levelState === 'WAVES_B', 60000, true); // kill the mid-boss

    runUntil(sim, () => [...sim.state.entities.values()].some((e) => e.kind === 'enemy')); // wave b spawns
    const player = sim.state.entities.get(PLAYER_ID)!;
    player.hull = 0;
    sim.step(emptyInput());

    expect(sim.state.player.lives).toBe(2);
    expect(sim.state.levelState).toBe('WAVES_B'); // part-2 checkpoint [ROC-BOSS-6]
    expect(sim.state.waves.active.size).toBeGreaterThan(0); // part 2 restarted fresh
    expect([...sim.state.entities.values()].some((e) => e.kind === 'enemy')).toBe(false); // old combat cleared
  });

  it('in part 1: still restarts the level from its beginning', () => {
    const sim = makeSim(1, content);
    runUntil(sim, () => sim.state.levelState === 'WAVES_A');
    const player = sim.state.entities.get(PLAYER_ID)!;
    player.hull = 0;
    sim.step(emptyInput());

    expect(sim.state.player.lives).toBe(2);
    expect(sim.state.levelState).toBe('LAUNCH'); // the ROC-LIFE-2 default [ROC-BOSS-7]
  });
});
