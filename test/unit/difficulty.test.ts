// T4.3: difficulty scaling — the enemy-count scaler changes spawn totals and the hp/shield
// multipliers are applied at spawn. [ROC-ENM-12,14, ROC-DIF-1,2]

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import { difficultyScale, scaledCount } from '../../src/sim/systems/difficulty.js';
import { startWave, waveSystem, type WaveContext } from '../../src/sim/systems/waves.js';

const DT = 1 / 120;
const enemies = (w: ReturnType<typeof makeWorld>) => [...w.entities.values()].filter((e) => e.kind === 'enemy');

describe('difficultyScale', () => {
  it('is identity at d = 1 and grows above it', () => {
    expect(difficultyScale(1)).toEqual({ count: 1, hull: 1, shield: 1, fireRate: 1 });
    const two = difficultyScale(2);
    expect(two.count).toBe(2);
    expect(two.hull).toBeGreaterThan(1);
    expect(two.shield).toBeGreaterThan(1);
    expect(two.fireRate).toBeGreaterThan(1);
  });

  it('scaledCount rounds and never drops below one', () => {
    expect(scaledCount(5, 1)).toBe(5);
    expect(scaledCount(5, 2)).toBe(10);
    expect(scaledCount(5, 1.5)).toBe(8); // round(7.5)
    expect(scaledCount(3, 0)).toBe(1); // floor of one enemy
  });
});

describe('difficulty applied to waves', () => {
  const ctx: WaveContext = { enemies: { grunt: { hull: 10, shield: 2, bounty: 5 } } };

  it('count scaler changes the spawn total', () => {
    const w = makeWorld(1);
    w.difficulty = 2;
    startWave(w, { id: 'w', pattern: 'sine_column', enemy: 'grunt', count: 3, spacingMs: 0, durationMs: 1e7 }, ctx);
    const rec = [...w.waves.active.values()][0];
    expect(rec.total).toBe(6); // 3 x 2
    expect(rec.bountySum).toBe(30); // 6 members x 5

    waveSystem(w, createRng(1), DT, ctx);
    expect(enemies(w).length).toBe(6);
  });

  it('applies hull/shield multipliers at spawn', () => {
    const w = makeWorld(1);
    w.difficulty = 2;
    startWave(w, { id: 'w', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 1e7 }, ctx);
    waveSystem(w, createRng(1), DT, ctx);
    const e = enemies(w)[0];
    expect(e.hull).toBeCloseTo(10 * difficultyScale(2).hull, 6); // 16
    expect(e.shield).toBe(Math.round(2 * difficultyScale(2).shield)); // round(3) = 3
  });
});
