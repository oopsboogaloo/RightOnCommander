// T3.2 property tests: shields deplete before hull, shielded hits flash the shield (not the
// hull), destruction fires exactly at hull <= 0, and the flash rule covers every damageable
// kind. [ROC-DMG-2,6,6a,7]

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { makeWorld } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import { applyDamage } from '../../src/sim/systems/damage.js';
import type { Entity, EntityKind } from '../../src/sim/components.js';

function target(over: Partial<Entity> = {}): Entity {
  return { id: 99, kind: 'enemy', pos: vec3(), vel: vec3(), yaw: 0, bank: 0, ...over };
}

describe('damage & shields', () => {
  it('shields always deplete before the hull takes any damage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 30 }),
        (shieldMax, hullMax, hits) => {
          const w = makeWorld(1);
          const e = target({ shield: shieldMax, shieldMax, hull: hullMax, hullMax });
          w.entities.set(e.id, e);

          for (let i = 0; i < hits; i++) {
            if (!w.entities.has(e.id)) break; // destroyed
            const shieldBefore = e.shield ?? 0;
            applyDamage(w, e, 1);
            // While any shield remained, the hull must be untouched.
            if (shieldBefore > 0) expect(e.hull).toBe(hullMax);
          }
        },
      ),
    );
  });

  it('a shielded hit flashes the shield, not the hull; an unshielded hit flashes white', () => {
    const w = makeWorld(1);
    const shielded = target({ shield: 2, shieldMax: 2, hull: 5, hullMax: 5 });
    applyDamage(w, shielded, 1);
    expect(shielded.shieldFlashTtl).toBeGreaterThan(0);
    expect(shielded.flashTtl ?? 0).toBe(0);
    expect(shielded.hull).toBe(5);

    const bare = target({ shield: 0, hull: 5, hullMax: 5 });
    applyDamage(w, bare, 1);
    expect(bare.flashTtl).toBeGreaterThan(0);
    expect(bare.hull).toBe(4);
  });

  it('destruction fires exactly once, when hull first reaches <= 0', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 25 }), (hullMax) => {
        const w = makeWorld(1);
        const e = target({ shield: 0, hull: hullMax, hullMax });
        w.entities.set(e.id, e);

        let destroyedEvents = 0;
        let hitsUntilGone = 0;
        for (let i = 0; i < hullMax + 5; i++) {
          if (!w.entities.has(e.id)) break;
          w.events = [];
          applyDamage(w, e, 1);
          hitsUntilGone++;
          destroyedEvents += w.events.filter((ev) => ev.type === 'destroyed').length;
        }
        expect(hitsUntilGone).toBe(hullMax); // destroyed on the hull-th hit
        expect(destroyedEvents).toBe(1);
        expect(w.entities.has(e.id)).toBe(false);
      }),
    );
  });

  it('the flash rule applies to every damageable kind', () => {
    const kinds: EntityKind[] = ['player', 'enemy', 'boss', 'station'];
    for (const kind of kinds) {
      const w = makeWorld(1);
      const hull = target({ kind, shield: 0, hull: 5, hullMax: 5 });
      applyDamage(w, hull, 1);
      expect(hull.flashTtl).toBeGreaterThan(0);

      const shielded = target({ kind, shield: 1, shieldMax: 1, hull: 5, hullMax: 5 });
      applyDamage(w, shielded, 1);
      expect(shielded.shieldFlashTtl).toBeGreaterThan(0);
      // The player also flashes white on a shield-absorbed hit (every other kind doesn't). [ROC-DMG-2a]
      if (kind === 'player') expect(shielded.flashTtl ?? 0).toBeGreaterThan(0);
      else expect(shielded.flashTtl ?? 0).toBe(0);
    }
  });

  it('the player has no hull buffer: any hit while unshielded is instantly lethal (unlike every other kind)', () => {
    const w = makeWorld(1);
    const player = target({ kind: 'player', shield: 0, hull: 5, hullMax: 5 });
    applyDamage(w, player, 1);
    expect(player.hull).toBe(0);
    expect(w.events.some((e) => e.type === 'destroyed' && e.id === player.id)).toBe(true);

    const enemy = target({ id: 100, kind: 'enemy', shield: 0, hull: 5, hullMax: 5 });
    applyDamage(w, enemy, 1);
    expect(enemy.hull).toBe(4); // graduated damage, unaffected
  });
});
