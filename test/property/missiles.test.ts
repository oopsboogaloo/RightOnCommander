// T4.4 property tests for the homing-missiles power-up. [ROC-MIS-1..5]

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { makeWorld } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import { collectMissile, missilesSystem, DEFAULT_MISSILES } from '../../src/sim/systems/missiles.js';
import { applyDamage } from '../../src/sim/systems/damage.js';

const missiles = (w: ReturnType<typeof makeWorld>) => [...w.entities.values()].filter((e) => e.kind === 'missile');
const addEnemy = (w: ReturnType<typeof makeWorld>) => {
  const id = w.nextId++;
  w.entities.set(id, { id, kind: 'enemy' as const, pos: vec3(0, 0, 1), vel: vec3(), yaw: 0, bank: 0, hull: 9, hullMax: 9, shield: 0 });
};

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

  it('keeps up to min(grade, ship capacity) missiles airborne, only with a target on screen', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (g) => {
        // Fer-de-Lance capacity 4, so the grade is the binding limit here.
        const w = makeWorld(1);
        w.player.shipClass = 'fer_de_lance';
        addEnemy(w);
        for (let i = 0; i < g; i++) collectMissile(w);
        for (let i = 0; i < 400; i++) missilesSystem(w, 1 / 120); // let launches accrue
        expect(missiles(w).length).toBe(g);
      }),
    );
  });

  it('respects the ship missile capacity (Sidewinder holds one)', () => {
    const w = makeWorld(1); // Sidewinder, capacity 1
    addEnemy(w);
    for (let i = 0; i < 4; i++) collectMissile(w); // grade 4
    for (let i = 0; i < 400; i++) missilesSystem(w, 1 / 120);
    expect(missiles(w).length).toBe(1);
  });

  it('does not fire with no enemy on screen', () => {
    const w = makeWorld(1);
    collectMissile(w);
    for (let i = 0; i < 200; i++) missilesSystem(w, 1 / 120);
    expect(missiles(w).length).toBe(0); // [ROC-MIS-7]
  });

  it('missiles are destructible (can be shot down)', () => {
    const w = makeWorld(1);
    addEnemy(w);
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
