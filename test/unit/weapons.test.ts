// T2.3: pulse-laser cadence (held vs tap), and the projectile object pool (reuse, no leak).
// [ROC-CTL-1, ROC-LAS-3,4]

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
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
