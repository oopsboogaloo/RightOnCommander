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

  it('never homes toward a missile-immune enemy (Thargoids jam the lock)', () => {
    const w = makeWorld(1);
    add(w, { kind: 'enemy', pos: vec3(1, 0, 2), vel: vec3(), yaw: 0, bank: 0, hull: 12, hullMax: 12, shield: 0, missileImmune: true });
    const m = add(w, {
      kind: 'missile',
      team: 'player',
      pos: vec3(0, 0, 0),
      vel: vec3(0, 0, DEFAULT_MISSILES.speed), // straight up
      yaw: 0,
      bank: 0,
      ttl: 4,
      hull: 1,
      hullMax: 1,
    });

    for (let i = 0; i < 10; i++) missilesSystem(w, 1 / 60);
    expect(m.vel.x).toBe(0); // no target acquired — flies straight instead of steering toward it
  });

  it('does not autofire on a missile-immune-only field (no valid target on screen)', () => {
    const w = makeWorld(1);
    add(w, { kind: 'enemy', pos: vec3(0, 0, 1), vel: vec3(), yaw: 0, bank: 0, hull: 12, hullMax: 12, shield: 0, missileImmune: true });
    collectMissile(w);
    w.player.missileCooldown = 0;
    missilesSystem(w, 1 / 120);
    expect([...w.entities.values()].some((e) => e.kind === 'missile')).toBe(false);
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

  it('pauses the next launch once a missile dies of old age (isolated from the launch-gate cycle)', () => {
    const w = makeWorld(1);
    const m = add(w, { kind: 'missile', team: 'player', pos: vec3(0, 0, 0), vel: vec3(0, 0, DEFAULT_MISSILES.speed), yaw: 0, bank: 0, ttl: 1 / 240, hull: 1, hullMax: 1 });
    w.player.missileGrade = 0; // launch-gating inactive: isolates the death-cooldown effect
    w.player.missileCooldown = 0;

    missilesSystem(w, 1 / 120); // this step: the missile's ttl runs out
    expect(w.entities.has(m.id)).toBe(false);
    expect(w.player.missileCooldown).toBeCloseTo(DEFAULT_MISSILES.deathCooldown, 5);
  });

  it('a freed cap slot does not refill until the death cooldown elapses', () => {
    const w = makeWorld(1);
    add(w, { kind: 'enemy', pos: vec3(0, 0, 1), vel: vec3(), yaw: 0, bank: 0, hull: 3, hullMax: 3, shield: 0 }); // on screen
    collectMissile(w); // grade 1; Sidewinder's cap is 1
    w.player.missileCooldown = 0;
    missilesSystem(w, 1 / 120); // launches the one missile this ship can carry
    const m = [...w.entities.values()].find((e) => e.kind === 'missile')!;
    expect(m).toBeDefined();

    // A hair above 0 so the launch-gate's own reset-to-launchDelay doesn't also fire this step —
    // isolates the death-cooldown's effect from the pre-existing per-launch cadence.
    w.player.missileCooldown = 0.01;
    m.ttl = 1 / 240;
    missilesSystem(w, 1 / 120); // ttl expires this step
    expect([...w.entities.values()].some((e) => e.kind === 'missile')).toBe(false);
    expect(w.player.missileCooldown).toBeGreaterThan(0.25); // bumped up near deathCooldown (0.3)

    // Well inside the cooldown window: the free cap slot stays empty.
    for (let i = 0; i < 12; i++) missilesSystem(w, 1 / 120); // ~0.1s elapsed
    expect([...w.entities.values()].some((e) => e.kind === 'missile')).toBe(false);

    // Past the cooldown: relaunches.
    for (let i = 0; i < 30; i++) missilesSystem(w, 1 / 120); // ~0.35s elapsed since expiry
    expect([...w.entities.values()].some((e) => e.kind === 'missile')).toBe(true);
  });
});
