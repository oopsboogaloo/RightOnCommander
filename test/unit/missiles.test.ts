// T4.4: missiles home toward the nearest enemy and collide with enemies. [ROC-MIS-3,5]

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import { collectMissile, missilesSystem, DEFAULT_MISSILES } from '../../src/sim/systems/missiles.js';
import { collisionSystem } from '../../src/sim/systems/collision.js';
import type { Entity } from '../../src/sim/components.js';

const mag = (v: { x: number; z: number }): number => Math.hypot(v.x, v.z);

const add = (w: ReturnType<typeof makeWorld>, e: Omit<Entity, 'id'>): Entity => {
  const id = w.nextId++;
  const full = { ...e, id } as Entity;
  w.entities.set(id, full);
  return full;
};

describe('missile homing', () => {
  it('turns toward the nearest enemy', () => {
    const w = makeWorld(1);
    add(w, { kind: 'enemy', pos: vec3(1, 0, 2), vel: vec3(), yaw: 0, bank: 0, hull: 3, hullMax: 3, shield: 0 });
    const m = add(w, {
      kind: 'missile',
      team: 'player',
      pos: vec3(0, 0, 0),
      vel: vec3(0, 0, DEFAULT_MISSILES.speed), // initially straight up
      yaw: 0,
      bank: 0,
      ttl: 4,
      hull: 1,
      hullMax: 1,
    });

    for (let i = 0; i < 10; i++) missilesSystem(w, 1 / 60); // grade 0: only homes existing
    expect(m.vel.x).toBeGreaterThan(0); // steered toward the enemy on the +x side
  });

  it('collides with an enemy as a player attacker', () => {
    const w = makeWorld(1);
    const enemy = add(w, { kind: 'enemy', pos: vec3(0, 0, 1), vel: vec3(), yaw: 0, bank: 0, hull: 3, hullMax: 3, shield: 0 });
    const m = add(w, { kind: 'missile', team: 'player', pos: vec3(0, 0, 1), vel: vec3(0, 0, DEFAULT_MISSILES.speed), yaw: 0, bank: 0, ttl: 4, hull: 1, hullMax: 1 });

    const hits = collisionSystem(w, { dt: 1 / 120, cellSize: 1, getSilhouette: () => undefined });
    expect(hits).toContainEqual({ projectile: m.id, target: enemy.id });
  });

  it('launches slow, accelerates toward top speed, and trails exhaust', () => {
    const w = makeWorld(1);
    add(w, { kind: 'enemy', pos: vec3(0, 0, 1), vel: vec3(), yaw: 0, bank: 0, hull: 3, hullMax: 3, shield: 0 }); // on screen [ROC-MIS-7]
    collectMissile(w);
    w.player.missileCooldown = 0;
    missilesSystem(w, 1 / 120); // spawn one missile
    const m = w.entities.get([...w.entities.values()].find((e) => e.kind === 'missile')!.id)!;
    const s0 = mag(m.vel);
    expect(s0).toBeLessThan(DEFAULT_MISSILES.speed); // not at top speed yet
    expect(w.events.some((e) => e.type === 'exhaust')).toBe(true); // thrust trail

    for (let i = 0; i < 40; i++) missilesSystem(w, 1 / 120);
    expect(mag(m.vel)).toBeGreaterThan(s0); // sped up
  });
});
