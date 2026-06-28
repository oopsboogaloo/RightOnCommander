// T5.3: pickup collect + shot behaviour, and surplus banking as cargo. [ROC-PWR-1..6, ROC-ECO-3]

import { describe, it, expect } from 'vitest';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import { pickupsSystem } from '../../src/sim/systems/pickups.js';
import type { Entity, PickupType } from '../../src/sim/components.js';

const DT = 1 / 120;

function addPickup(w: ReturnType<typeof makeWorld>, type: PickupType, pos = vec3(0, 0, 0)): Entity {
  const id = w.nextId++;
  const e: Entity = { id, kind: 'pickup', pos, vel: vec3(), yaw: 0, bank: 0, pickup: { type }, ttl: 10 };
  w.entities.set(id, e);
  return e;
}
function addPlayerPulse(w: ReturnType<typeof makeWorld>, pos = vec3(0, 0, 0)): Entity {
  const id = w.nextId++;
  const e: Entity = { id, kind: 'projectile', team: 'player', pos, vel: vec3(0, 0, 6), yaw: 0, bank: 0, ttl: 1, damage: 1 };
  w.entities.set(id, e);
  return e;
}
function player(w: ReturnType<typeof makeWorld>): Entity {
  return w.entities.get(PLAYER_ID)!;
}

describe('pickup collection', () => {
  it('fuel restores a shield ring when not full', () => {
    const w = makeWorld(1);
    const p = player(w);
    p.pos = vec3(0, 0, 0);
    p.shield = 2;
    p.shieldMax = 4;
    addPickup(w, 'fuel');
    pickupsSystem(w, DT);
    expect(p.shield).toBe(3);
    expect([...w.entities.values()].some((e) => e.kind === 'pickup')).toBe(false);
  });

  it('banks fuel as cargo when the shield is full (with floating text)', () => {
    const w = makeWorld(1);
    const p = player(w);
    p.pos = vec3(0, 0, 0);
    p.shield = 4;
    p.shieldMax = 4;
    addPickup(w, 'fuel');
    pickupsSystem(w, DT);
    expect(p.shield).toBe(4); // unchanged
    expect(w.cargo.fuel).toBe(1); // surplus banked [ROC-PWR-1]
    expect(w.events.find((e) => e.type === 'floatingText')?.text).toBe('Fuel 1T'); // [ROC-ECO-3]
  });

  it('alloys repair the hull', () => {
    const w = makeWorld(1);
    const p = player(w);
    p.pos = vec3(0, 0, 0);
    p.hull = 10;
    p.hullMax = 16;
    addPickup(w, 'alloys');
    pickupsSystem(w, DT);
    expect(p.hull).toBe(14);
  });

  it('a laser pickup fits to an empty mount', () => {
    const w = makeWorld(1);
    player(w).pos = vec3(0, 0, 0);
    expect(w.player.lasers.rear).toBeNull();
    addPickup(w, 'laser');
    pickupsSystem(w, DT);
    expect(w.player.lasers.rear).toBe('pulse'); // front already fitted, fills rear next
  });

  it('a missile pickup raises the missile grade', () => {
    const w = makeWorld(1);
    player(w).pos = vec3(0, 0, 0);
    addPickup(w, 'missile');
    pickupsSystem(w, DT);
    expect(w.player.missileGrade).toBe(1);
  });
});

describe('pickup shot effects', () => {
  it('shooting a fuel pickup destroys it (no splash) and consumes the shot', () => {
    const w = makeWorld(1);
    player(w).pos = vec3(5, 0, 5); // far away so it is not scooped
    const pk = addPickup(w, 'fuel', vec3(0, 0, 1));
    const shot = addPlayerPulse(w, vec3(0, 0, 1));
    pickupsSystem(w, DT);
    expect(w.entities.has(pk.id)).toBe(false);
    expect(w.entities.has(shot.id)).toBe(false); // consumed
    expect(w.events.some((e) => e.type === 'fragments')).toBe(true);
  });

  it('shooting gems shatters them', () => {
    const w = makeWorld(1);
    player(w).pos = vec3(5, 0, 5);
    const pk = addPickup(w, 'gems', vec3(0, 0, 1));
    addPlayerPulse(w, vec3(0, 0, 1));
    pickupsSystem(w, DT);
    expect(w.entities.has(pk.id)).toBe(false);
    expect(w.events.some((e) => e.type === 'fragments')).toBe(true);
  });
});
