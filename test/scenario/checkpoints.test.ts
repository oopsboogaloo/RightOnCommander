// T5a.6 scenario: death checkpoints — every death just respawns the player in place once its
// explosion has played out; whatever else was happening (a boss fight, part-2 waves, part-1
// waves) continues completely unaffected. Nothing about the level ever resets. [ROC-LIFE-2,3]

import { describe, it, expect } from 'vitest';
import { makeSim, emptyInput } from '../harness.js';
import { PLAYER_ID } from '../../src/sim/world.js';
import type { Sim } from '../../src/sim/index.js';
import type { InputFrame } from '../../src/interfaces.js';
import { DEFAULT_GAMESTATE, PLAYER_EXPLOSION_SEC } from '../../src/sim/systems/gamestate.js';

const firing = (): InputFrame => ({ ...emptyInput(), firing: true });
const DT = 1 / 120;

// Steps enough for the wreck's explosion + respawn delay to fully resolve. [ROC-LIFE-3]
const RESPAWN_STEPS = Math.ceil((PLAYER_EXPLOSION_SEC + DEFAULT_GAMESTATE.respawnDelaySec + 0.1) / DT);

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

function runOutRespawn(sim: Sim): void {
  for (let i = 0; i < RESPAWN_STEPS; i++) sim.step(emptyInput());
}

const boss = (sim: Sim) => [...sim.state.entities.values()].find((e) => e.kind === 'boss');

describe('death checkpoints', () => {
  it('at a boss: respawns in place once the explosion plays out, and the boss keeps its damage', () => {
    const sim = makeSim(1, content);
    runUntil(sim, () => sim.state.levelState === 'MID_BOSS');

    const b = boss(sim)!;
    b.hull = 42; // the fight is well underway
    const player = sim.state.entities.get(PLAYER_ID)!;
    player.pos = { x: 0.4, y: 0, z: -0.6 };
    player.hull = 0; // and then the player dies

    sim.step(emptyInput());
    expect(sim.state.player.lives).toBe(3); // a life is still spent [§3.16]
    expect(sim.state.levelState).toBe('MID_BOSS'); // the fight continues, nothing resets [ROC-LIFE-2]

    runOutRespawn(sim);
    const after = boss(sim)!;
    expect(after.id).toBe(b.id); // same boss, not respawned
    expect(after.hull).toBe(42); // damage retained
    const respawned = sim.state.entities.get(PLAYER_ID)!;
    expect(respawned.pos.x).toBeCloseTo(0.4, 5); // in place
    expect(respawned.pos.z).toBeCloseTo(-0.6, 5);
    expect(respawned.hull).toBe(respawned.hullMax);
  });

  it('in part 2: respawns in place, the same combat continues untouched', () => {
    const sim = makeSim(1, content);
    runUntil(sim, () => sim.state.levelState === 'MID_BOSS');
    runUntil(sim, () => sim.state.levelState === 'WAVES_B', 60000, true); // kill the mid-boss

    runUntil(sim, () => [...sim.state.entities.values()].some((e) => e.kind === 'enemy')); // wave b spawns
    const enemy = [...sim.state.entities.values()].find((e) => e.kind === 'enemy')!;
    const player = sim.state.entities.get(PLAYER_ID)!;
    player.hull = 0;
    sim.step(emptyInput());

    expect(sim.state.player.lives).toBe(3);
    expect(sim.state.levelState).toBe('WAVES_B'); // no checkpoint reset [ROC-LIFE-2]
    expect(sim.state.entities.has(enemy.id)).toBe(true); // the same enemy, untouched

    runOutRespawn(sim);
    // The enemy's own path may naturally finish/exit in the ~3s the respawn takes regardless of
    // the player's death — that's ordinary wave lifecycle, not a reset, so it isn't asserted here.
    expect(sim.state.entities.get(PLAYER_ID)!.hull).toBe(sim.state.entities.get(PLAYER_ID)!.hullMax);
  });

  it('in part 1: respawns in place, the level never restarts', () => {
    const sim = makeSim(1, content);
    runUntil(sim, () => sim.state.levelState === 'WAVES_A');
    const player = sim.state.entities.get(PLAYER_ID)!;
    const deathPos = { x: 0.3, y: 0, z: 0.4 };
    player.pos = { ...deathPos };
    player.hull = 0;
    sim.step(emptyInput());

    expect(sim.state.player.lives).toBe(3);
    expect(sim.state.levelState).toBe('WAVES_A'); // never restarts to LAUNCH [ROC-LIFE-2]

    runOutRespawn(sim);
    const respawned = sim.state.entities.get(PLAYER_ID)!;
    expect(respawned.pos.x).toBeCloseTo(deathPos.x, 5); // in place, not recentred
    expect(respawned.pos.z).toBeCloseTo(deathPos.z, 5);
    expect(respawned.hull).toBe(respawned.hullMax);
  });
});
