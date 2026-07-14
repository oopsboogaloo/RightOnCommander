// T3.1: spatial-hash broadphase matches brute force, and the collision system tests player
// projectiles against a target's hull silhouette — dilated by a small shield-ring gap while
// shielded, exact once the shield is down — with an ellipse only as the meshless fallback.
// [design §8, ROC-DMG-1,5]

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeWorld } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import type { Entity } from '../../src/sim/components.js';
import type { Pt } from '../../src/sim/math/geom2.js';
import {
  broadphasePairs,
  bruteForcePairs,
  collisionSystem,
  meshSilhouette,
  hullRadius,
  SHIELD_GAP_FRAC,
  type CircleItem,
} from '../../src/sim/systems/collision.js';
import type { Mesh } from '../../src/interfaces.js';
import { SHIP_SCALE } from '../../src/sim/index.js';

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

  it('shrinks the collider by colliderScale so the hitbox matches the rendered hull', () => {
    // A pulse grazing the rim of a full-size collider should miss once the hull is drawn (and
    // collided) at 1/3 scale. [DEFECTS: collisions felt generous after the 1/3 shrink]
    const grazing = (scale: number): number => {
      const w = makeWorld(1);
      addEnemy(w, { pos: vec3(0, 0, 0), shield: 0, colliderRx: 0.3, colliderRz: 0.3 });
      addPulse(w, vec3(0.25, 0, 0), vec3(0, 0, 6)); // passes 0.25 to the side of centre
      return collisionSystem(w, { ...cfg(), colliderScale: scale }).length;
    };
    expect(grazing(1)).toBe(1); // within the full 0.3 radius
    expect(grazing(1 / 3)).toBe(0); // outside the shrunk 0.1 radius
  });

  it('ignores enemy/own projectiles and returns nothing without targets', () => {
    const w = makeWorld(1);
    addPulse(w, vec3(0, 0, 0), vec3(0, 0, 6)); // no targets present
    expect(collisionSystem(w, cfg())).toEqual([]);
  });

  it('a giant (indestructible) asteroid blocks enemy fire too, not just the player fire it already stops', () => {
    const w = makeWorld(1);
    const giant = addEnemy(w, { kind: 'asteroid', pos: vec3(0, 0, 0.5), colliderRx: 0.5, colliderRz: 0.5, indestructible: true });
    const id = w.nextId++;
    const shot: Entity = { id, kind: 'projectile', team: 'enemy', pos: vec3(0, 0, 0.5), vel: vec3(0, 0, -6), yaw: 0, bank: 0, ttl: 1 };
    w.entities.set(id, shot);

    const hits = collisionSystem(w, cfg());
    expect(hits).toEqual([{ projectile: shot.id, target: giant.id }]); // absorbed by the rock, never reaches the player
  });
});

// Shield-hug rework: a shielded target's hitbox is the hull silhouette dilated by a small gap
// (proportional to the hull's own size, one step per remaining ring) instead of an unrelated
// ellipse — the shot lands exactly where the outermost ring is drawn. [ROC-DMG-1, DEFECTS:
// collision-detection review]
describe('shielded hit hugs the hull silhouette (not a separate ellipse)', () => {
  const sq: Pt[] = [
    { x: -0.3, y: -0.3 },
    { x: 0.3, y: -0.3 },
    { x: 0.3, y: 0.3 },
    { x: -0.3, y: 0.3 },
  ];
  const cfg = () => ({
    dt: 1 / 120,
    cellSize: 1,
    getSilhouette: () => sq,
    getHullRadius: () => hullRadius(sq, 1),
  });

  function addShielded(shield: number): { w: ReturnType<typeof makeWorld>; enemy: Entity } {
    const w = makeWorld(1);
    const enemy: Entity = { id: w.nextId++, kind: 'enemy', pos: vec3(0, 0, 0), vel: vec3(), yaw: 0, bank: 0, meshId: 'sq', shield };
    w.entities.set(enemy.id, enemy);
    return { w, enemy };
  }

  // Zero velocity collapses the swept segment to a single stationary point, so each case tests
  // exactly "is this point within the shield gap of the hull" with no travel-distance slop.
  function shootAt(shield: number, x: number, z: number): number {
    const { w } = addShielded(shield);
    const hit: Entity = { id: w.nextId++, kind: 'projectile', team: 'player', pos: vec3(x, 0, z), vel: vec3(), yaw: 0, bank: 0, ttl: 1 };
    w.entities.set(hit.id, hit);
    return collisionSystem(w, cfg()).length;
  }

  it('hits within the ring gap, misses just beyond it', () => {
    const gap = hullRadius(sq, 1) * SHIELD_GAP_FRAC * 2; // shield: 2
    expect(shootAt(2, 0.3 + gap * 0.5, 0)).toBe(1); // inside the gap: hits
    expect(shootAt(2, 0.3 + gap * 1.5, 0)).toBe(0); // outside the gap: misses
  });

  it('the hitbox shrinks as rings are lost — same point, fewer rings, now a miss', () => {
    const gapAt2 = hullRadius(sq, 1) * SHIELD_GAP_FRAC * 2;
    const gapAt1 = hullRadius(sq, 1) * SHIELD_GAP_FRAC * 1;
    const x = 0.3 + (gapAt2 + gapAt1) / 2; // between the 1-ring and 2-ring gap
    expect(shootAt(2, x, 0)).toBe(1); // 2 rings: gap reaches this far
    expect(shootAt(1, x, 0)).toBe(0); // 1 ring: gap no longer reaches
  });

  it('a shot through the hull centre always hits, regardless of shield count', () => {
    expect(shootAt(3, 0, 0)).toBe(1);
  });

  it('matches the sim pipeline on real content: the fer-de-lance boss (regression for the collision review)', () => {
    // Loaded exactly as the shell loads it: raw mesh JSON -> meshSilhouette -> hullRadius, at the
    // real SHIP_SCALE. Reproduces the two review findings, now corrected: a shot that used to
    // land ~2 drawn hull-widths clear of the ship now misses, and a shot through the drawn nose
    // (which used to sail through the old ellipse untouched) now hits.
    const meshPath = fileURLToPath(new URL('../../src/content/meshes/fer_de_lance.json', import.meta.url));
    const mesh: Mesh = JSON.parse(readFileSync(meshPath, 'utf8'));
    const silhouette = meshSilhouette(mesh);
    const radius = hullRadius(silhouette, SHIP_SCALE);
    const realCfg = {
      dt: 1 / 120,
      cellSize: 1,
      colliderScale: SHIP_SCALE,
      getSilhouette: () => silhouette,
      getHullRadius: () => radius,
    };

    function shootRealAt(x: number, z: number): number {
      const w = makeWorld(1);
      const enemy: Entity = { id: w.nextId++, kind: 'enemy', pos: vec3(0, 0, 0), vel: vec3(), yaw: 0, bank: 0, meshId: 'fer_de_lance', shield: 2 };
      w.entities.set(enemy.id, enemy);
      const hit: Entity = { id: w.nextId++, kind: 'projectile', team: 'player', pos: vec3(x, 0, z), vel: vec3(), yaw: 0, bank: 0, ttl: 1 };
      w.entities.set(hit.id, hit);
      return collisionSystem(w, realCfg).length;
    }

    expect(shootRealAt(0.1, 0)).toBe(0); // 0.1 to the side: now a clean miss
    expect(shootRealAt(0, 0.13)).toBe(1); // through the drawn nose: now a hit
    expect(shootRealAt(0, 0)).toBe(1); // dead centre: still a hit
  });

  it('same fix applies to enemy fire vs the (shielded) player — the other collisionSystem branch', () => {
    const meshPath = fileURLToPath(new URL('../../src/content/meshes/cobra_mk3.json', import.meta.url));
    const mesh: Mesh = JSON.parse(readFileSync(meshPath, 'utf8'));
    const silhouette = meshSilhouette(mesh);
    const radius = hullRadius(silhouette, SHIP_SCALE);
    const realCfg = {
      dt: 1 / 120,
      cellSize: 1,
      colliderScale: SHIP_SCALE,
      getSilhouette: () => silhouette,
      getHullRadius: () => radius,
    };

    function shootPlayerAt(x: number, z: number): number {
      const w = makeWorld(1);
      const p = w.entities.get(1)!; // PLAYER_ID
      p.meshId = 'cobra_mk3';
      p.shield = 2;
      const hit: Entity = { id: w.nextId++, kind: 'projectile', team: 'enemy', pos: vec3(x, 0, z), vel: vec3(), yaw: 0, bank: 0, ttl: 1 };
      w.entities.set(hit.id, hit);
      return collisionSystem(w, realCfg).length;
    }

    expect(shootPlayerAt(0.25, 0)).toBe(0); // clear of the hull + gap: miss
    expect(shootPlayerAt(0, 0.11)).toBe(1); // inside the drawn nose (old ellipse rz was 0.10): hit
    expect(shootPlayerAt(0, 0)).toBe(1); // dead centre: hit
  });
});

// hitMeshId/hitScale let an entity collide against a different mesh/scale than the one it
// spawns with — fixes the splinter defect: it's drawn as a small asteroid chunk (MINI_ASTEROID_
// SCALE), so it should collide as one too, not as its own (larger) splinter mesh at SHIP_SCALE.
// [DEFECTS: render/collide mismatch]
describe('hitMeshId/hitScale override the collision shape', () => {
  const wide: Pt[] = [{ x: -1, y: -0.1 }, { x: 1, y: -0.1 }, { x: 1, y: 0.1 }, { x: -1, y: 0.1 }]; // meshId 'own'
  const narrow: Pt[] = [{ x: -0.1, y: -1 }, { x: 0.1, y: -1 }, { x: 0.1, y: 1 }, { x: -0.1, y: 1 }]; // meshId 'other'
  const cfg = { dt: 1 / 120, cellSize: 2, getSilhouette: (id: string) => ({ own: wide, other: narrow })[id], colliderScale: 1 };

  function addTarget(over: Partial<Entity>): { w: ReturnType<typeof makeWorld>; e: Entity } {
    const w = makeWorld(1);
    const e: Entity = { id: w.nextId++, kind: 'asteroid', pos: vec3(0, 0, 0), vel: vec3(), yaw: 0, bank: 0, hull: 1, meshId: 'own', ...over };
    w.entities.set(e.id, e);
    return { w, e };
  }
  function shootAt(x: number, over: Partial<Entity>): number {
    const { w } = addTarget(over);
    const hit: Entity = { id: w.nextId++, kind: 'projectile', team: 'player', pos: vec3(x, 0, 0), vel: vec3(), yaw: 0, bank: 0, ttl: 1 };
    w.entities.set(hit.id, hit);
    return collisionSystem(w, cfg).length;
  }

  it('without an override, collides against its own (wide) mesh', () => {
    expect(shootAt(0.5, {})).toBe(1); // inside 'own': x spans [-1,1]
    expect(shootAt(0.5, { hitMeshId: 'other' })).toBe(0); // 'other' (hitScale defaults to colliderScale=1): x spans only [-0.1,0.1]
  });

  it('hitScale replaces colliderScale for the substituted mesh, not multiplies it', () => {
    // 'other' x-half-width is 0.1; at hitScale 5 that's 0.5, so x=0.4 is inside.
    expect(shootAt(0.4, { hitMeshId: 'other', hitScale: 5 })).toBe(1);
    expect(shootAt(0.4, { hitMeshId: 'other' })).toBe(0); // default scale 1: 0.4 is outside 0.1
  });

  it('the splinter fix, end to end: real asteroid/splinter meshes at the real render scale', () => {
    const asteroidMesh: Mesh = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../src/content/meshes/asteroid.json', import.meta.url)), 'utf8'),
    );
    const splinterMesh: Mesh = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../src/content/meshes/splinter.json', import.meta.url)), 'utf8'),
    );
    const silhouettes: Record<string, Pt[]> = { asteroid: meshSilhouette(asteroidMesh), splinter: meshSilhouette(splinterMesh) };
    const realCfg = { dt: 1 / 120, cellSize: 1, colliderScale: SHIP_SCALE, getSilhouette: (id: string) => silhouettes[id] };

    function shootSplinterAt(x: number, hit: boolean): void {
      const w = makeWorld(1);
      const e: Entity = {
        id: w.nextId++,
        kind: 'asteroid',
        pos: vec3(0, 0, 0),
        vel: vec3(),
        yaw: 0,
        bank: 0,
        hull: 1,
        meshId: 'splinter',
        hitMeshId: 'asteroid', // matches SPLINTER_HIT_SCALE wiring in asteroids.ts
        hitScale: 0.15,
      };
      w.entities.set(e.id, e);
      const b: Entity = { id: w.nextId++, kind: 'projectile', team: 'player', pos: vec3(x, 0, 0), vel: vec3(), yaw: 0, bank: 0, ttl: 1 };
      w.entities.set(b.id, b);
      expect(collisionSystem(w, realCfg).length).toBe(hit ? 1 : 0);
    }

    // Drawn (asteroid @ 0.15) half-width is wider than the splinter's own hitbox would have been
    // at colliderScale (SHIP_SCALE): a shot between the two edges must hit the drawn shape, not
    // miss it the way colliding against the splinter's own mesh used to.
    shootSplinterAt(0.04, true); // within the drawn asteroid-chunk silhouette
    shootSplinterAt(0.2, false); // clear of it
  });
});
