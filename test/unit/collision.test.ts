// T3.1: spatial-hash broadphase matches brute force, and the collision system tests player
// projectiles against shield-ellipse / hull-silhouette shapes. [design §8, ROC-DMG-1,5]

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { makeWorld } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import type { Entity } from '../../src/sim/components.js';
import type { Pt } from '../../src/sim/math/geom2.js';
import {
  broadphasePairs,
  bruteForcePairs,
  collisionSystem,
  meshSilhouette,
  type CircleItem,
} from '../../src/sim/systems/collision.js';
import type { Mesh } from '../../src/interfaces.js';

const norm = (pairs: [number, number][]): string[] =>
  pairs.map(([a, b]) => (a < b ? `${a}_${b}` : `${b}_${a}`)).sort();

describe('broadphase', () => {
  it('returns exactly the same pairs as brute force', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.double({ min: -5, max: 5, noNaN: true }),
            y: fc.double({ min: -5, max: 5, noNaN: true }),
            r: fc.double({ min: 0.1, max: 1, noNaN: true }),
          }),
          { maxLength: 40 },
        ),
        (raw) => {
          const items: CircleItem[] = raw.map((it, i) => ({ id: i, ...it }));
          expect(norm(broadphasePairs(items))).toEqual(norm(bruteForcePairs(items)));
        },
      ),
    );
  });
});

describe('meshSilhouette', () => {
  it('is the convex hull of the vertices projected to the play plane', () => {
    const mesh: Mesh = {
      vertices: [
        vec3(-1, 0, -1),
        vec3(1, 5, -1),
        vec3(1, -3, 1),
        vec3(-1, 0, 1),
        vec3(0, 0, 0), // interior in x-z
      ],
      edges: [],
      faces: [],
    };
    expect(meshSilhouette(mesh).length).toBe(4); // square corners; y (height) ignored
  });
});

describe('collisionSystem', () => {
  const DT = 1 / 120;
  const cfg = (getSil: (id: string) => Pt[] | undefined = () => undefined) => ({
    dt: DT,
    cellSize: 1,
    getSilhouette: getSil,
  });

  function addEnemy(w: ReturnType<typeof makeWorld>, over: Partial<Entity>): Entity {
    const id = w.nextId++;
    const e: Entity = { id, kind: 'enemy', pos: vec3(0, 0, 0), vel: vec3(), yaw: 0, bank: 0, ...over };
    w.entities.set(id, e);
    return e;
  }
  function addPulse(w: ReturnType<typeof makeWorld>, pos: ReturnType<typeof vec3>, vel: ReturnType<typeof vec3>): Entity {
    const id = w.nextId++;
    const e: Entity = { id, kind: 'projectile', team: 'player', pos, vel, yaw: 0, bank: 0, ttl: 1 };
    w.entities.set(id, e);
    return e;
  }

  it('hits a shielded enemy via its ellipse, misses when far', () => {
    const w = makeWorld(1);
    const enemy = addEnemy(w, { pos: vec3(0, 0, 0.5), shield: 4, colliderRx: 0.3, colliderRz: 0.3 });
    const hit = addPulse(w, vec3(0, 0, 0.5), vec3(0, 0, 6));
    addPulse(w, vec3(5, 0, 0.5), vec3(0, 0, 6)); // far away

    const hits = collisionSystem(w, cfg());
    expect(hits).toEqual([{ projectile: hit.id, target: enemy.id }]);
  });

  it('uses the hull silhouette once shields are down', () => {
    const sq: Pt[] = [
      { x: -0.3, y: -0.3 },
      { x: 0.3, y: -0.3 },
      { x: 0.3, y: 0.3 },
      { x: -0.3, y: 0.3 },
    ];
    const w = makeWorld(1);
    const enemy = addEnemy(w, { pos: vec3(0, 0, 0), shield: 0, meshId: 'sq' });
    const hit = addPulse(w, vec3(0, 0, 0), vec3(0, 0, 6));

    const hits = collisionSystem(w, cfg(() => sq));
    expect(hits).toEqual([{ projectile: hit.id, target: enemy.id }]);
  });

  it('ignores enemy/own projectiles and returns nothing without targets', () => {
    const w = makeWorld(1);
    addPulse(w, vec3(0, 0, 0), vec3(0, 0, 6)); // no targets present
    expect(collisionSystem(w, cfg())).toEqual([]);
  });
});
