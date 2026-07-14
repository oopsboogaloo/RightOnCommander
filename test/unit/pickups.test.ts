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

  it('a laser pickup fills the first free hardpoint (Front preferred)', () => {
    const w = makeWorld(1);
    player(w).pos = vec3(0, 0, 0);
    expect(w.player.lasers.front).toEqual(['pulse']); // Sidewinder front has 2 slots, one used
    addPickup(w, 'laser');
    pickupsSystem(w, DT);
    expect(w.player.lasers.front).toEqual(['pulse', 'pulse']); // fills front's spare slot first [ROC-HP-4]
  });

  it('a missile pickup raises the missile grade', () => {
    const w = makeWorld(1);
    player(w).pos = vec3(0, 0, 0);
    addPickup(w, 'missile');
    pickupsSystem(w, DT);
    expect(w.player.missileGrade).toBe(1);
  });

  it('scooped cargo banks by commodity and shows its type', () => {
    const w = makeWorld(1);
    player(w).pos = vec3(0, 0, 0);
    const pk = addPickup(w, 'cargo');
    pk.pickup!.commodity = 'Gem-Stones';
    pickupsSystem(w, DT);
    expect(w.cargo['Gem-Stones']).toBe(1); // [ROC-CARGO-3]
    expect(w.events.some((e) => e.type === 'floatingText' && String(e.text).startsWith('Gem-Stones'))).toBe(true);
  });
});

describe('laser pickups: level-dependent type, upgrade-only fitting', () => {
  it('Level 1 drops a pulse; Levels 2/3 drop a beam', () => {
    const w1 = makeWorld(1);
    player(w1).pos = vec3(0, 0, 0);
    w1.levelIndex = 0;
    addPickup(w1, 'laser');
    pickupsSystem(w1, DT);
    expect(w1.player.lasers.front).toEqual(['pulse', 'pulse']); // front's spare slot, still a pulse

    const w2 = makeWorld(1);
    player(w2).pos = vec3(0, 0, 0);
    w2.levelIndex = 1; // Level 2
    addPickup(w2, 'laser');
    pickupsSystem(w2, DT);
    expect(w2.player.lasers.front).toEqual(['pulse', 'beam']); // front's spare slot, now a beam

    const w3 = makeWorld(1);
    player(w3).pos = vec3(0, 0, 0);
    w3.levelIndex = 2; // Level 3
    addPickup(w3, 'laser');
    pickupsSystem(w3, DT);
    expect(w3.player.lasers.front).toEqual(['pulse', 'beam']);
  });

  it('upgrades a pulse in place once front has no free hardpoint left', () => {
    const w = makeWorld(1);
    player(w).pos = vec3(0, 0, 0);
    w.levelIndex = 1;
    w.player.hardpoints = { front: 1, rear: 1, left: 0, right: 0 };
    w.player.lasers = { front: ['pulse'], rear: [], left: [], right: [] };
    addPickup(w, 'laser');
    pickupsSystem(w, DT);
    expect(w.player.lasers.front).toEqual(['beam']); // upgraded in place, not appended elsewhere
    expect(w.player.lasers.rear).toEqual([]); // the free rear slot wasn't touched — front took priority
  });

  it('never downgrades a military laser — falls through to the next direction instead', () => {
    const w = makeWorld(1);
    player(w).pos = vec3(0, 0, 0);
    w.levelIndex = 1;
    w.player.hardpoints = { front: 1, rear: 1, left: 0, right: 0 };
    w.player.lasers = { front: ['military'], rear: [], left: [], right: [] };
    addPickup(w, 'laser');
    pickupsSystem(w, DT);
    expect(w.player.lasers.front).toEqual(['military']); // untouched
    expect(w.player.lasers.rear).toEqual(['beam']); // fell through to the free rear slot
  });

  it('skips a same-tier laser (no improvement) and moves on to the next direction', () => {
    const w = makeWorld(1);
    player(w).pos = vec3(0, 0, 0);
    w.levelIndex = 1;
    w.player.hardpoints = { front: 1, rear: 1, left: 0, right: 0 };
    w.player.lasers = { front: ['beam'], rear: [], left: [], right: [] };
    addPickup(w, 'laser');
    pickupsSystem(w, DT);
    expect(w.player.lasers.front).toEqual(['beam']); // a beam replacing a beam is not an improvement
    expect(w.player.lasers.rear).toEqual(['beam']);
  });

  it('banks as sellable cargo once every hardpoint is already at or above the pickup tier', () => {
    const w = makeWorld(1);
    player(w).pos = vec3(0, 0, 0);
    w.levelIndex = 1;
    w.player.hardpoints = { front: 1, rear: 1, left: 0, right: 0 };
    w.player.lasers = { front: ['beam'], rear: ['military'], left: [], right: [] };
    addPickup(w, 'laser');
    pickupsSystem(w, DT);
    expect(w.player.lasers.front).toEqual(['beam']);
    expect(w.player.lasers.rear).toEqual(['military']);
    expect(w.cargo.laser).toBe(1); // nothing to improve -> sellable, same as a fully-full pulse pickup
  });
});

describe('collectables are inert to weapons fire', () => {
  it('a projectile passing through a pickup neither destroys it nor is consumed', () => {
    const w = makeWorld(1);
    player(w).pos = vec3(5, 0, 5); // far away so it is not scooped
    const pk = addPickup(w, 'gems', vec3(0, 0, 1));
    const id = w.nextId++;
    const shot: Entity = { id, kind: 'projectile', team: 'player', pos: vec3(0, 0, 1), vel: vec3(0, 0, 6), yaw: 0, bank: 0, ttl: 1, damage: 1 };
    w.entities.set(id, shot);
    pickupsSystem(w, DT);
    expect(w.entities.has(pk.id)).toBe(true); // untouched [ROC-CARGO-2]
    expect(w.entities.has(shot.id)).toBe(true); // passes through
  });
});
