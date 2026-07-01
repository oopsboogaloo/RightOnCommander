// T?/ROC-DMG-6: a destroyed ship shatters into tumbling wireframe shards (one per mesh edge),
// alongside the dot burst, all seeded through world.rng so the storm is deterministic.

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import {
  particlesSystem,
  spawnFragments,
  DEFAULT_PARTICLES,
  type FragGeom,
} from '../../src/sim/systems/particles.js';

const DT = 1 / 120;
const geom: FragGeom = {
  sq: [
    { ax: -0.2, az: -0.2, bx: 0.2, bz: -0.2 },
    { ax: 0.2, az: -0.2, bx: 0.2, bz: 0.2 },
    { ax: 0.2, az: 0.2, bx: -0.2, bz: 0.2 },
    { ax: -0.2, az: 0.2, bx: -0.2, bz: -0.2 },
  ],
};

const fragments = (w: ReturnType<typeof makeWorld>) =>
  [...w.entities.values()].filter((e) => e.kind === 'fragment');

describe('wireframe fragments', () => {
  it('spawns one shard per mesh edge, centred on the wreck', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    spawnFragments(w, rng, geom.sq, { x: 1, y: 0, z: 2 }, 0, DEFAULT_PARTICLES);
    const frags = fragments(w);
    expect(frags.length).toBe(4);
    for (const f of frags) {
      expect(f.seg).toBeDefined();
      expect((f.ttl ?? 0) > 0 && f.ttl === f.ttlMax).toBe(true);
      // each shard starts at the wreck centre + its edge midpoint (within the hull span)
      expect(Math.abs(f.pos.x - 1)).toBeLessThanOrEqual(0.2 + 1e-9);
      expect(Math.abs(f.pos.z - 2)).toBeLessThanOrEqual(0.2 + 1e-9);
    }
  });

  it('a destroyed event with geometry makes both lines and dots', () => {
    const w = makeWorld(1);
    const rng = createRng(7);
    w.events = [{ type: 'destroyed', kind: 'enemy', pos: { x: 0, y: 0, z: 0 }, yaw: 0, meshId: 'sq' }];
    particlesSystem(w, rng, DT, DEFAULT_PARTICLES, geom);
    expect(fragments(w).length).toBe(4); // lines
    expect([...w.entities.values()].some((e) => e.kind === 'particle')).toBe(true); // dots
  });

  it('shards tumble and expire', () => {
    const w = makeWorld(1);
    const rng = createRng(3);
    spawnFragments(w, rng, geom.sq, { x: 0, y: 0, z: 0 }, 0, DEFAULT_PARTICLES);
    const f = fragments(w)[0];
    const seg0 = { ...f.seg! };
    particlesSystem(w, rng, DT, DEFAULT_PARTICLES, geom); // one integration step
    expect(f.seg).not.toEqual(seg0); // tumbled
    expect(f.ttl).toBeLessThan(f.ttlMax!);

    // Run past the longest possible lifetime; all shards gone.
    for (let i = 0; i < 200; i++) particlesSystem(w, rng, DT, DEFAULT_PARTICLES, geom);
    expect(fragments(w).length).toBe(0);
  });

  it('debris inherits the wreck velocity', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    spawnFragments(w, rng, geom.sq, { x: 0, y: 0, z: 0 }, 0, DEFAULT_PARTICLES, { x: 0, y: 0, z: -2 });
    const frags = fragments(w);
    const avgVz = frags.reduce((s, f) => s + f.vel.z, 0) / frags.length;
    expect(avgVz).toBeLessThan(-1); // dragged along by the wreck's downward motion
  });

  it('explosion dots inherit the wreck velocity', () => {
    const w = makeWorld(1);
    const rng = createRng(2);
    w.events = [{ type: 'destroyed', kind: 'enemy', pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: -3 }, meshId: 'none' }];
    particlesSystem(w, rng, 1 / 120, DEFAULT_PARTICLES, {});
    const dots = [...w.entities.values()].filter((e) => e.kind === 'particle');
    const avgVz = dots.reduce((s, p) => s + p.vel.z, 0) / dots.length;
    expect(avgVz).toBeLessThan(0);
  });

  it('a destroyed asteroid sheds tumbling rock-mesh debris, not wireframe shards', () => {
    const w = makeWorld(1);
    const rng = createRng(5);
    w.events = [{ type: 'destroyed', kind: 'asteroid', pos: { x: 0, y: 0, z: 0 }, meshId: 'asteroid' }];
    particlesSystem(w, rng, DT, DEFAULT_PARTICLES, geom);

    const frags = fragments(w);
    expect(frags.length).toBeGreaterThan(0);
    for (const f of frags) {
      expect(f.meshId).toBe('asteroid');
      expect(f.tumble).toBeDefined();
      expect(f.seg).toBeUndefined(); // rock debris tumbles as a mesh, not a rotating line segment
      expect(f.ttlMax).toBeGreaterThan(0);
      expect(f.ttl).toBeLessThanOrEqual(f.ttlMax!); // this call both spawned and integrated one dt
    }

    const f = frags[0];
    const yaw0 = f.yaw;
    particlesSystem(w, rng, DT, DEFAULT_PARTICLES, geom);
    expect(f.yaw).not.toBe(yaw0); // tumbles via yaw/bank, like a free-floating asteroid
  });

  it('is deterministic for a seed', () => {
    const run = (): number[] => {
      const w = makeWorld(1);
      const rng = createRng(42);
      spawnFragments(w, rng, geom.sq, { x: 0, y: 0, z: 0 }, 0.7, DEFAULT_PARTICLES);
      return fragments(w).flatMap((f) => [f.pos.x, f.pos.z, f.seg!.x, f.seg!.z, f.spin ?? 0, f.ttl ?? 0]);
    };
    expect(run()).toEqual(run());
  });
});
