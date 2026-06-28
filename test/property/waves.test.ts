// T4.2 property tests: the wave-clear bonus is exactly 0.5 x summed bounty, paid once and
// only on a full kill-clear; any escape forfeits it; and no member stalls off-field forever.
// [ROC-ENM-1, ROC-ECO-1a,1b]

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { makeWorld } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import { startWave, waveSystem, type WaveContext } from '../../src/sim/systems/waves.js';

const DT = 1 / 120;
const ctx = (bounty: number): WaveContext => ({ enemies: { grunt: { hull: 1, bounty } } });
const enemies = (w: ReturnType<typeof makeWorld>) => [...w.entities.values()].filter((e) => e.kind === 'enemy');
const bonuses = (w: ReturnType<typeof makeWorld>) => w.events.filter((e) => e.type === 'waveBonus');

describe('wave bonus', () => {
  it('pays exactly 0.5 x summed bounty, once, on a full kill-clear', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), fc.integer({ min: 1, max: 50 }), (count, bounty) => {
        const w = makeWorld(1);
        const c = ctx(bounty);
        // Huge duration so nothing escapes; zero spacing so all spawn at once.
        startWave(w, { id: 'w', pattern: 'sine_column', enemy: 'grunt', count, spacingMs: 0, durationMs: 1e7 }, c);

        let guard = 0;
        while (w.waves.active.size > 0 && guard++ < 5000) {
          waveSystem(w, createRng(1), DT, c);
          for (const e of enemies(w)) w.entities.delete(e.id); // player kills everything alive
        }

        const b = bonuses(w);
        expect(b.length).toBe(1);
        expect(b[0].amount).toBe(0.5 * count * bounty);
        expect(w.econ.wallet).toBe(0.5 * count * bounty);
        expect(w.econ.score).toBe(0.5 * count * bounty);
      }),
    );
  });

  it('pays no bonus if any member escapes off-field', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), (count) => {
        const w = makeWorld(1);
        const c = ctx(10);
        startWave(w, { id: 'w', pattern: 'sine_column', enemy: 'grunt', count, spacingMs: 0, durationMs: 200 }, c);

        let guard = 0;
        while (w.waves.active.size > 0 && guard++ < 5000) waveSystem(w, createRng(1), DT, c); // never shoot

        expect(bonuses(w).length).toBe(0);
        expect(w.econ.wallet).toBe(0);
      }),
    );
  });
});

describe('no off-field stall', () => {
  it('every member resolves (killed or escaped) within a frame bound', () => {
    const count = 6;
    const spacingMs = 100;
    const durationMs = 1000;
    const w = makeWorld(1);
    const c = ctx(10);
    startWave(w, { id: 'w', pattern: 'side_stream', enemy: 'grunt', count, spacingMs, durationMs }, c);

    const bound = Math.ceil((count * (spacingMs / 1000) + durationMs / 1000) / DT) + 10;
    for (let i = 0; i < bound; i++) waveSystem(w, createRng(1), DT, c);

    expect(w.waves.active.size).toBe(0); // wave resolved
    expect(enemies(w).length).toBe(0); // nothing stuck on-field
  });
});
