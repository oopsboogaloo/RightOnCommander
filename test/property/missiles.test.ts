// T4.4 property tests for the homing-missiles power-up. [ROC-MIS-1..5]

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { makeWorld } from '../../src/sim/world.js';
import { collectMissile, missilesSystem, DEFAULT_MISSILES } from '../../src/sim/systems/missiles.js';
import { applyDamage } from '../../src/sim/systems/damage.js';

const missiles = (w: ReturnType<typeof makeWorld>) => [...w.entities.values()].filter((e) => e.kind === 'missile');

describe('missiles power-up', () => {
  it('re-collecting raises the grade (capped) and restarts the timer', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (n) => {
        const w = makeWorld(1);
        for (let i = 0; i < n; i++) collectMissile(w);
        expect(w.player.missileGrade).toBe(Math.min(DEFAULT_MISSILES.maxGrade, n));
        expect(w.player.missileTimer).toBe(DEFAULT_MISSILES.durationSec);
      }),
    );
  });

  it('on expiry drops one grade and restarts, removing the power-up at 0', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (g) => {
        const w = makeWorld(1);
        for (let i = 0; i < g; i++) collectMissile(w);
        for (let k = g; k > 0; k--) {
          missilesSystem(w, DEFAULT_MISSILES.durationSec); // elapse exactly one timer
          expect(w.player.missileGrade).toBe(k - 1);
          expect(w.player.missileTimer).toBe(k - 1 > 0 ? DEFAULT_MISSILES.durationSec : 0);
        }
      }),
    );
  });

  it('fires a volley whose size equals the grade', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (g) => {
        const w = makeWorld(1);
        for (let i = 0; i < g; i++) collectMissile(w);
        w.player.missileCooldown = 0;
        missilesSystem(w, 1 / 120);
        expect(missiles(w).length).toBe(g);
      }),
    );
  });

  it('missiles are destructible (can be shot down)', () => {
    const w = makeWorld(1);
    collectMissile(w);
    w.player.missileCooldown = 0;
    missilesSystem(w, 1 / 120); // spawn one missile
    const m = missiles(w)[0];
    expect(m.hull).toBe(1);

    applyDamage(w, m, 1);
    expect(w.entities.has(m.id)).toBe(false);
    expect(w.events.some((e) => e.type === 'destroyed')).toBe(true);
  });
});
