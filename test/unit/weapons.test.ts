// T2.3: pulse-laser cadence (held vs tap), and the projectile object pool (reuse, no leak).
// [ROC-CTL-1, ROC-LAS-3,4]

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import { weaponsSystem, DEFAULT_WEAPONS } from '../../src/sim/systems/weapons.js';
import type { InputFrame } from '../../src/interfaces.js';
import type { Entity } from '../../src/sim/components.js';

const DT = 1 / 120;

const frame = (over: Partial<InputFrame> = {}): InputFrame => ({
  moveTarget: null,
  firing: false,
  fireTapped: false,
  ecm: false,
  energyBomb: false,
  confirm: false,
  pause: false,
  ...over,
});

const projectiles = (w: ReturnType<typeof makeWorld>): Entity[] =>
  [...w.entities.values()].filter((e) => e.kind === 'projectile');

describe('weaponsSystem', () => {
  it('autofires at the configured rate while held', () => {
    const w = makeWorld(1);
    // Hold for one second; projectiles outlive it (ttl > 1s), so the count is the shots fired.
    for (let i = 0; i < 120; i++) weaponsSystem(w, frame({ firing: true }), DT);
    expect(projectiles(w).length).toBe(DEFAULT_WEAPONS.pulseRate); // 6 shots in 1s at 6/s
  });

  it('fires one pulse per installed laser across all directions', () => {
    const w = makeWorld(1); // Sidewinder starts with one front laser
    w.player.lasers.front = ['pulse', 'pulse']; // both front hardpoints
    w.player.lasers.rear = ['pulse']; // and the rear
    weaponsSystem(w, frame({ fireTapped: true }), DT);
    expect(projectiles(w).length).toBe(3); // [ROC-HP-3]
  });

  it('fans a double mount out by exactly muzzleSpread, side by side', () => {
    const w = makeWorld(1);
    w.player.lasers.front = ['pulse', 'pulse'];
    w.player.lasers.rear = [];
    weaponsSystem(w, frame({ fireTapped: true }), DT);
    const xs = projectiles(w).map((p) => p.pos.x).sort((a, b) => a - b);
    expect(xs.length).toBe(2);
    expect(xs[1] - xs[0]).toBeCloseTo(DEFAULT_WEAPONS.muzzleSpread, 9); // gap between the pair
  });

  it('fires exactly one shot on a tap', () => {
    const w = makeWorld(1);
    weaponsSystem(w, frame({ fireTapped: true }), DT);
    expect(projectiles(w).length).toBe(1);
    // Holding nothing afterwards fires no more.
    for (let i = 0; i < 30; i++) weaponsSystem(w, frame(), DT);
    expect(projectiles(w).length).toBe(1);
  });

  it('spawns the pulse moving forward (+z) from the muzzle', () => {
    const w = makeWorld(1);
    weaponsSystem(w, frame({ fireTapped: true }), DT);
    const p = projectiles(w)[0];
    expect(p.team).toBe('player');
    expect(p.vel.z).toBeCloseTo(DEFAULT_WEAPONS.pulseSpeed, 6);
    expect(p.pos.z).toBeGreaterThan(0);
  });

  it('military lasers fire twice as fast as pulses', () => {
    const w = makeWorld(1);
    w.player.lasers.front = ['military'];
    for (let i = 0; i < 60; i++) weaponsSystem(w, frame({ firing: true }), DT); // 0.5s
    expect(projectiles(w).length).toBe(DEFAULT_WEAPONS.militaryRate / 2); // 6 in 0.5s at 12/s [ROC-LAS-5]
  });

  it('military bolts travel twice as fast, hit twice as hard, and flag the thicker render', () => {
    const w = makeWorld(1);
    w.player.lasers.front = ['military'];
    weaponsSystem(w, frame({ fireTapped: true }), DT);
    const p = projectiles(w)[0];
    expect(p.mil).toBe(true);
    expect(p.vel.z).toBeCloseTo(DEFAULT_WEAPONS.militarySpeed, 6); // 2x pulse speed
    expect(p.damage).toBe(DEFAULT_WEAPONS.militaryDamage); // 2x pulse damage [ROC-LAS-5]
  });

  it('a beam is an instant hitscan that burns 1 damage per 300ms into the first target', () => {
    const w = makeWorld(1);
    w.player.lasers.front = ['beam'];
    const enemy: Entity = { id: w.nextId++, kind: 'enemy', pos: vec3(0, 0, 1), vel: vec3(), yaw: 0, bank: 0, hull: 3, hullMax: 3, shield: 0, colliderRx: 0.2, colliderRz: 0.2 };
    w.entities.set(enemy.id, enemy);

    for (let i = 0; i < Math.round(0.35 / DT); i++) weaponsSystem(w, frame({ firing: true }), DT);
    expect(enemy.hull).toBe(2); // one 300ms window of contact = 1 damage [ROC-LAS-6]
    expect(w.beams).toHaveLength(1); // a live beam segment while firing
    expect(projectiles(w).length).toBe(0); // instant — no travelling bolt

    for (let i = 0; i < Math.round(0.3 / DT); i++) weaponsSystem(w, frame({ firing: true }), DT);
    expect(enemy.hull).toBe(1); // a second window = a second point of damage
  });

  it('stops firing (and clears the beam) when the trigger is released', () => {
    const w = makeWorld(1);
    w.player.lasers.front = ['beam'];
    const enemy: Entity = { id: w.nextId++, kind: 'enemy', pos: vec3(0, 0, 1), vel: vec3(), yaw: 0, bank: 0, hull: 3, hullMax: 3, shield: 0, colliderRx: 0.2, colliderRz: 0.2 };
    w.entities.set(enemy.id, enemy);
    weaponsSystem(w, frame({ firing: true }), DT);
    expect(w.beams).toHaveLength(1);
    weaponsSystem(w, frame(), DT); // released
    expect(w.beams).toHaveLength(0);
  });

  it('a beam and a pulse in the same mount both operate', () => {
    const w = makeWorld(1);
    w.player.lasers.front = ['beam', 'pulse'];
    const enemy: Entity = { id: w.nextId++, kind: 'enemy', pos: vec3(0, 0, 1), vel: vec3(), yaw: 0, bank: 0, hull: 5, hullMax: 5, shield: 0, colliderRx: 0.2, colliderRz: 0.2 };
    w.entities.set(enemy.id, enemy);
    weaponsSystem(w, frame({ firing: true }), DT);
    expect(w.beams).toHaveLength(1); // the beam traced
    expect(projectiles(w).length).toBe(1); // and the pulse fired [ROC-LAS-6]
  });

  it('recycles projectiles into the pool (reuse, no leak)', () => {
    const w = makeWorld(1);
    weaponsSystem(w, frame({ fireTapped: true }), DT);
    const first = projectiles(w)[0];

    // Run past the projectile lifetime so it expires and is recycled.
    const steps = Math.ceil(DEFAULT_WEAPONS.pulseTtl / DT) + 2;
    for (let i = 0; i < steps; i++) weaponsSystem(w, frame(), DT);

    expect(projectiles(w).length).toBe(0); // removed from the world (no leak)
    expect(w.pool.projectiles.length).toBe(1); // parked for reuse

    // Cooldown has long since cleared; the next shot reuses the same object.
    weaponsSystem(w, frame({ fireTapped: true }), DT);
    const second = projectiles(w)[0];
    expect(Object.is(first, second)).toBe(true);
    expect(w.pool.projectiles.length).toBe(0);
  });
});
