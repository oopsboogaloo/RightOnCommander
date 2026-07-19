// T4.2: spawning cadence + membership tracking, and that a mix of kill + escape forfeits the
// bonus. [ROC-ENM-1,7,8, ROC-ECO-1a]

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import { startWave, waveSystem, type WaveContext } from '../../src/sim/systems/waves.js';

const DT = 1 / 120;
const rng = createRng(1);
const ctx: WaveContext = { enemies: { grunt: { hull: 2, bounty: 10, shield: 0 } } };
const enemies = (w: ReturnType<typeof makeWorld>) => [...w.entities.values()].filter((e) => e.kind === 'enemy');

describe('wave spawning', () => {
  it('spawns members spaced over time up to count', () => {
    const w = makeWorld(1);
    startWave(w, { id: 'w', pattern: 'vform', enemy: 'grunt', count: 3, spacingMs: 100, durationMs: 1e7 }, ctx);

    waveSystem(w, rng, DT, ctx);
    expect(enemies(w).length).toBe(1); // first spawns immediately

    // After ~0.3s all three are out.
    for (let i = 0; i < 40; i++) waveSystem(w, rng, DT, ctx);
    expect(enemies(w).length).toBe(3);

    const rec = [...w.waves.active.values()][0];
    expect(rec.members.size).toBe(3);
    expect(rec.spawn?.pending).toBe(0);
  });

  it('delays a wave so it starts spawning only after its delayMs', () => {
    const w = makeWorld(1);
    startWave(w, { id: 'w', pattern: 'vform', enemy: 'grunt', count: 2, spacingMs: 100, delayMs: 500, durationMs: 1e7 }, ctx);

    waveSystem(w, rng, DT, ctx);
    expect(enemies(w).length).toBe(0); // nothing yet — still within the delay

    for (let i = 0; i < 60; i++) waveSystem(w, rng, DT, ctx); // ~0.5s elapses
    expect(enemies(w).length).toBeGreaterThan(0); // now spawning
  });

  it('forfeits the bonus when one member escapes even if others are killed', () => {
    const w = makeWorld(1);
    startWave(w, { id: 'w', pattern: 'sine_column', enemy: 'grunt', count: 2, spacingMs: 0, durationMs: 200 }, ctx);

    waveSystem(w, rng, DT, ctx); // both spawn
    expect(enemies(w).length).toBe(2);

    w.entities.delete(enemies(w)[0].id); // kill one

    let guard = 0;
    while (w.waves.active.size > 0 && guard++ < 5000) waveSystem(w, rng, DT, ctx); // let the other escape

    expect(w.events.filter((e) => e.type === 'waveBonus').length).toBe(0);
    expect(w.econ.wallet).toBe(0);
  });

  it('carries a cloak-capable enemy\'s cloakCycle and guaranteed drop onto the spawned entity', () => {
    const w = makeWorld(1);
    const cloakCtx: WaveContext = {
      enemies: {
        cougar: {
          hull: 10,
          bounty: 100,
          drops: 'cloak',
          missileImmune: true,
          cloakCycle: { visibleSec: 4, transitionSec: 1, cloakedSec: 5 },
        },
      },
    };
    startWave(w, { id: 'w', pattern: 'wander', enemy: 'cougar', count: 1, spacingMs: 0, durationMs: 1e7 }, cloakCtx);
    waveSystem(w, rng, DT, cloakCtx);

    const [e] = enemies(w);
    expect(e.missileImmune).toBe(true);
    expect(e.drops).toBe('cloak');
    expect(e.cloak).toEqual({ phase: 'visible', timer: 4, visibleSec: 4, transitionSec: 1, cloakedSec: 5 });
  });
});
