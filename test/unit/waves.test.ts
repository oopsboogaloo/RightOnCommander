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

describe('clearField: a solo encounter clears the field around its own appearance', () => {
  const soloCtx: WaveContext = {
    enemies: {
      grunt: { hull: 2, bounty: 10 },
      solo: { hull: 5, bounty: 50 },
    },
  };
  const run = (w: ReturnType<typeof makeWorld>, seconds: number) => {
    const steps = Math.round(seconds / DT);
    for (let i = 0; i < steps; i++) waveSystem(w, rng, DT, soloCtx);
  };
  // Regular wave: one grunt/sec, 10 total. Solo wave: appears at t=3s, clearField opens the
  // window 1.2s before it spawns and holds it 1.5s after (so window = [1.8s, 4.5s]).
  const startBoth = (w: ReturnType<typeof makeWorld>) => {
    startWave(w, { id: 'a', pattern: 'vform', enemy: 'grunt', count: 10, spacingMs: 1000, durationMs: 1e7 }, soloCtx);
    startWave(
      w,
      {
        id: 'b',
        pattern: 'vform',
        enemy: 'solo',
        count: 1,
        spacingMs: 0,
        delayMs: 3000,
        durationMs: 1e7,
        clearField: { beforeMs: 1200, afterMs: 1500 },
      },
      soloCtx,
    );
  };
  const grunts = (w: ReturnType<typeof makeWorld>) => enemies(w).filter((e) => e.hull === 2);
  const solos = (w: ReturnType<typeof makeWorld>) => enemies(w).filter((e) => e.hull === 5);
  const regularRec = (w: ReturnType<typeof makeWorld>) => [...w.waves.active.values()].find((r) => r.defId === 'a')!;

  it('sweeps the other wave\'s existing members the moment the window opens, forfeiting its bonus', () => {
    const w = makeWorld(1);
    startBoth(w);
    run(w, 1.8 - 2 * DT); // just before the window opens
    expect(grunts(w).length).toBe(2); // spawned at t=0 and t=1
    expect(regularRec(w).escaped).toBe(false);

    run(w, 4 * DT); // cross into the window
    expect(grunts(w).length).toBe(0); // cleared
    expect(regularRec(w).escaped).toBe(true); // forfeits wave A's own bonus
  });

  it('pauses (not cancels) the other wave\'s remaining spawns for the whole window', () => {
    const w = makeWorld(1);
    startBoth(w);
    run(w, 3 + 2 * DT); // through the solo's own appearance, with headroom against fp rounding
    expect(solos(w).length).toBe(1); // it appeared on schedule
    expect(grunts(w).length).toBe(0); // still suppressed — none of the t=2..4s grunts fired

    run(w, 1); // still inside the after-window (closes at 4.5s)
    expect(grunts(w).length).toBe(0);
  });

  it('resumes the paused wave exactly where it left off once the window closes', () => {
    const w = makeWorld(1);
    startBoth(w);
    run(w, 4.5); // window closes
    run(w, 1); // the grunt that was 0.2s from spawning when suppressed fires shortly after
    expect(grunts(w).length).toBeGreaterThan(0);
  });
});
