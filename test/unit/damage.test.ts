// T3.2: damageSystem resolves collision hits, recycles spent projectiles, ticks flash timers,
// and raises the heavy-damage flag. [design §8, ROC-DMG-7]

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import { damageSystem, tickFlashes, DEFAULT_DAMAGE } from '../../src/sim/systems/damage.js';
import type { Entity } from '../../src/sim/components.js';

const DT = 1 / 120;

function addEnemy(w: ReturnType<typeof makeWorld>, over: Partial<Entity>): Entity {
  const id = w.nextId++;
  const e: Entity = { id, kind: 'enemy', pos: vec3(), vel: vec3(), yaw: 0, bank: 0, ...over };
  w.entities.set(id, e);
  return e;
}
function addPulse(w: ReturnType<typeof makeWorld>, damage = 1): Entity {
  const id = w.nextId++;
  const e: Entity = { id, kind: 'projectile', team: 'player', pos: vec3(), vel: vec3(), yaw: 0, bank: 0, damage };
  w.entities.set(id, e);
  return e;
}

describe('damageSystem', () => {
  it('applies a hit and recycles the spent projectile', () => {
    const w = makeWorld(1);
    const enemy = addEnemy(w, { shield: 0, hull: 3, hullMax: 3 });
    const proj = addPulse(w, 1);

    damageSystem(w, [{ projectile: proj.id, target: enemy.id }], DT);

    expect(enemy.hull).toBe(2);
    expect(w.entities.has(proj.id)).toBe(false); // consumed
    expect(w.pool.projectiles).toContain(proj); // recycled, no leak
  });

  it('raises heavyDamage when the hull drops below the threshold', () => {
    const w = makeWorld(1);
    const enemy = addEnemy(w, { shield: 0, hull: 10, hullMax: 10 });
    // Knock the hull down to 3/10 (<= 0.34) with seven 1-damage hits.
    for (let i = 0; i < 7; i++) damageSystem(w, [{ projectile: addPulse(w).id, target: enemy.id }], DT);
    expect(enemy.hull).toBe(3);
    expect(enemy.heavyDamage).toBe(true);
  });

  it('tickFlashes decays timers toward zero', () => {
    const w = makeWorld(1);
    const e = addEnemy(w, { flashTtl: DEFAULT_DAMAGE.flashDuration, shieldFlashTtl: DEFAULT_DAMAGE.shieldFlashDuration });
    tickFlashes(w, DT);
    expect(e.flashTtl!).toBeLessThan(DEFAULT_DAMAGE.flashDuration);
    expect(e.flashTtl!).toBeGreaterThan(0);
  });
});
