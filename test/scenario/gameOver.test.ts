// Game over: once the last life is gone the ship is out of play for good. Holding fire must not
// spawn lasers, missiles must stop launching, and the hidden ship must not move or scoop pickups.
// Regression: these were gated only on the respawn wait, which clears when GAME_OVER is entered.
// [ROC-LIFE-2,3]

import { describe, it, expect } from 'vitest';
import { makeSim, emptyInput } from '../harness.js';
import { PLAYER_ID } from '../../src/sim/world.js';
import type { Sim } from '../../src/sim/index.js';
import type { InputFrame } from '../../src/interfaces.js';
import { DEFAULT_GAMESTATE, PLAYER_EXPLOSION_SEC } from '../../src/sim/systems/gamestate.js';

const DT = 1 / 120;
const RESPAWN_STEPS = Math.ceil((PLAYER_EXPLOSION_SEC + DEFAULT_GAMESTATE.respawnDelaySec + 0.1) / DT);

const content = {
  enemies: {
    grunt: { hull: 1, bounty: 5, colliderRx: 0.2, colliderRz: 0.2 },
    midboss: { hull: 60, bounty: 100, colliderRx: 0.3, colliderRz: 0.3 },
    endboss: { hull: 60, bounty: 100, colliderRx: 0.3, colliderRz: 0.3 },
  },
  levels: [{
    id: 'tiny',
    launchMs: 20,
    wavesA: [{ id: 'a', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 200 }],
    midBoss: 'midboss',
    wavesB: [{ id: 'b', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 60000 }],
    endBoss: 'endboss',
  }],
};

// Firing and steering hard to one corner, every frame.
const fireAndSteer = (): InputFrame => ({ ...emptyInput(), firing: true, fireTapped: true, moveTarget: { x: 1, y: 1 } });

const playerShots = (sim: Sim) =>
  [...sim.state.entities.values()].filter(
    (e) => (e.kind === 'projectile' || e.kind === 'missile') && e.team === 'player',
  ).length;

function toGameOver(): Sim {
  const sim = makeSim(1, content);
  // The mid-boss keeps an enemy on screen, so missiles would otherwise keep launching.
  for (let i = 0; i < 30000 && sim.state.levelState !== 'MID_BOSS'; i++) sim.step(emptyInput());
  expect(sim.state.levelState).toBe('MID_BOSS');

  sim.state.player.lives = 1;
  sim.state.player.energyBombs = 0;
  sim.state.player.missileGrade = 4;
  sim.state.entities.get(PLAYER_ID)!.hull = 0;
  for (let i = 0; i < RESPAWN_STEPS; i++) sim.step(emptyInput());
  expect(sim.state.mode).toBe('GAME_OVER');

  // Let anything already in flight leave the field before measuring.
  for (let i = 0; i < 600; i++) sim.step(emptyInput());
  return sim;
}

describe('game over', () => {
  it('holding fire spawns no lasers and no missiles launch', () => {
    const sim = toGameOver();
    let worst = 0;
    for (let i = 0; i < 600; i++) {
      sim.step(fireAndSteer());
      worst = Math.max(worst, playerShots(sim));
    }
    expect(worst).toBe(0);
    expect(sim.state.beams.length).toBe(0);
  });

  it('the hidden ship does not move', () => {
    const sim = toGameOver();
    const p = sim.state.entities.get(PLAYER_ID)!;
    const before = { x: p.pos.x, z: p.pos.z };
    for (let i = 0; i < 240; i++) sim.step(fireAndSteer());
    expect(p.pos.x).toBe(before.x);
    expect(p.pos.z).toBe(before.z);
  });
});
