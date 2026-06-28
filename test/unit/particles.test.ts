// T3.4: explosions are deterministic for a seed, particle count/lifetime stay within bounds,
// and particles integrate then recycle (pooled, no leak). [ROC-VIS-6]

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import {
  spawnExplosion,
  particlesSystem,
  DEFAULT_PARTICLES,
} from '../../src/sim/systems/particles.js';
import type { Entity } from '../../src/sim/components.js';

const particles = (w: ReturnType<typeof makeWorld>): Entity[] =>
  [...w.entities.values()].filter((e) => e.kind === 'particle');

describe('particles', () => {
  it('is deterministic for a given seed', () => {
    const a = makeWorld(1);
    const b = makeWorld(1);
    spawnExplosion(a, createRng(123), vec3(0, 0, 0));
    spawnExplosion(b, createRng(123), vec3(0, 0, 0));

    const pa = particles(a);
    const pb = particles(b);
    expect(pa.length).toBe(pb.length);
    for (let i = 0; i < pa.length; i++) {
      expect(pa[i].pos).toEqual(pb[i].pos);
      expect(pa[i].vel).toEqual(pb[i].vel);
      expect(pa[i].ttl).toBe(pb[i].ttl);
    }
  });

  it('keeps particle count and lifetime/speed within configured bounds', () => {
    const w = makeWorld(1);
    const rng = createRng(7);
    spawnExplosion(w, rng, vec3(0, 0, 0));

    const ps = particles(w);
    const [lo, hi] = DEFAULT_PARTICLES.explosionCount;
    expect(ps.length).toBeGreaterThanOrEqual(lo);
    expect(ps.length).toBeLessThanOrEqual(hi);

    for (const p of ps) {
      expect(p.ttl!).toBeGreaterThanOrEqual(DEFAULT_PARTICLES.ttl[0]);
      expect(p.ttl!).toBeLessThanOrEqual(DEFAULT_PARTICLES.ttl[1]);
      const speed = Math.hypot(p.vel.x, p.vel.z);
      expect(speed).toBeGreaterThanOrEqual(DEFAULT_PARTICLES.speed[0] - 1e-9);
      expect(speed).toBeLessThanOrEqual(DEFAULT_PARTICLES.speed[1] + 1e-9);
    }
  });

  it('integrates and recycles expired particles (pooled, no leak)', () => {
    const w = makeWorld(1);
    const rng = createRng(7);
    spawnExplosion(w, rng, vec3(0, 0, 0));
    const spawned = particles(w).length;

    const steps = Math.ceil(DEFAULT_PARTICLES.ttl[1] / (1 / 120)) + 2;
    for (let i = 0; i < steps; i++) particlesSystem(w, rng, 1 / 120);

    expect(particles(w).length).toBe(0);
    expect(w.pool.particles.length).toBe(spawned);
  });

  it('particlesSystem spawns an explosion from a destroyed event', () => {
    const w = makeWorld(1);
    w.events.push({ type: 'destroyed', id: 5, kind: 'enemy', pos: vec3(0, 0, 1), bounty: 10 });
    particlesSystem(w, createRng(3), 1 / 120);
    expect(particles(w).length).toBeGreaterThan(0);
  });
});
