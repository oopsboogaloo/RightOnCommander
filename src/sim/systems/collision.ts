// Collision: a uniform spatial-hash broadphase, then a narrow test of player projectiles
// (as swept segments) against targets — a shield ellipse while shielded, or the hull's convex
// silhouette once shields are down. Pure; damage application is handled in T3.2. [design §8,
// ROC-DMG-1,5]

import type { Mesh } from '../../interfaces.js';
import type { Entity } from '../components.js';
import { PLAYER_ID, type World } from '../world.js';
import {
  type Pt,
  segmentIntersectsEllipse,
  segmentIntersectsConvexPolygon,
  segmentDistToConvexPolygonSq,
  convexHull,
} from '../math/geom2.js';

export interface CircleItem {
  id: number;
  x: number;
  y: number;
  r: number;
}

// Uniform grid keyed by integer cell coordinates. Correct for neighbour queries as long as the
// cell size is at least the largest interaction radius.
export class SpatialHash {
  private readonly cell: number;
  private readonly buckets = new Map<string, number[]>();
  private readonly items = new Map<number, CircleItem>();

  constructor(cellSize: number) {
    this.cell = cellSize;
  }

  private static key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  insert(it: CircleItem): void {
    this.items.set(it.id, it);
    const k = SpatialHash.key(Math.floor(it.x / this.cell), Math.floor(it.y / this.cell));
    const arr = this.buckets.get(k);
    if (arr) arr.push(it.id);
    else this.buckets.set(k, [it.id]);
  }

  get(id: number): CircleItem | undefined {
    return this.items.get(id);
  }

  // Ids in the cell containing (x, y) and its eight neighbours.
  near(x: number, y: number): number[] {
    return this.nearAABB(x, y, x, y);
  }

  // Ids in all cells overlapping the AABB, expanded by one cell on every side.
  nearAABB(minX: number, minY: number, maxX: number, maxY: number): number[] {
    const cx0 = Math.floor(minX / this.cell) - 1;
    const cy0 = Math.floor(minY / this.cell) - 1;
    const cx1 = Math.floor(maxX / this.cell) + 1;
    const cy1 = Math.floor(maxY / this.cell) + 1;
    const out: number[] = [];
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const arr = this.buckets.get(SpatialHash.key(cx, cy));
        if (arr) out.push(...arr);
      }
    }
    return out;
  }
}

const pairKey = (a: number, b: number): string => (a < b ? `${a}_${b}` : `${b}_${a}`);
const overlaps = (a: CircleItem, b: CircleItem): boolean =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= (a.r + b.r) ** 2;

// Broadphase: candidate-narrowed colliding pairs. Sized so it returns exactly the overlapping
// pairs — matching brute force — while only testing nearby cells. [design §8]
export function broadphasePairs(items: CircleItem[]): [number, number][] {
  const maxR = items.reduce((m, it) => Math.max(m, it.r), 0);
  const hash = new SpatialHash(Math.max(2 * maxR, 1e-6));
  for (const it of items) hash.insert(it);

  const seen = new Set<string>();
  const pairs: [number, number][] = [];
  for (const it of items) {
    for (const oid of hash.near(it.x, it.y)) {
      if (oid === it.id) continue;
      const key = pairKey(it.id, oid);
      if (seen.has(key)) continue;
      seen.add(key);
      if (overlaps(it, hash.get(oid)!)) {
        pairs.push(it.id < oid ? [it.id, oid] : [oid, it.id]);
      }
    }
  }
  return pairs;
}

// Reference O(n^2) broadphase, for tests.
export function bruteForcePairs(items: CircleItem[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i], items[j])) pairs.push([items[i].id, items[j].id]);
    }
  }
  return pairs;
}

// Precompute a hull's 2D silhouette: the convex hull of its vertices projected to the play
// plane (x, z). [design §8]
export function meshSilhouette(mesh: Mesh): Pt[] {
  return convexHull(mesh.vertices.map((v) => ({ x: v.x, y: v.z })));
}

// Place a local silhouette into the world: rotate by yaw (about the height axis) and translate.
export function transformSilhouette(local: Pt[], cx: number, cz: number, yaw: number): Pt[] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return local.map((p) => ({ x: cx + p.x * c + p.y * s, y: cz - p.x * s + p.y * c }));
}

// Shield rings hug the hull silhouette with a small outward gap, proportional to the hull's own
// size so small and large ships both read as "just outside the hull" rather than one fixed
// offset. Ramming and the shielded-hit test both use this, so a shot lands exactly where the
// outermost ring is drawn. [ROC-DMG-1, ROC-DMG-3 shield-hug rework]
export const SHIELD_GAP_FRAC = 0.08;

// Farthest silhouette point from the hull's centre, in world units (after colliderScale) — the
// base unit the shield gap scales from.
export function hullRadius(localSilhouette: Pt[], scale: number): number {
  let max = 0;
  for (const p of localSilhouette) max = Math.max(max, Math.hypot(p.x, p.y));
  return max * scale;
}

// Outward distance from the hull to the outermost active shield ring.
export const shieldGap = (radius: number, rings: number): number =>
  radius * SHIELD_GAP_FRAC * Math.max(0, rings);

export interface CollisionHit {
  projectile: number;
  target: number;
}

export interface CollisionConfig {
  dt: number; // step duration, for the projectile's swept segment
  cellSize: number; // >= largest target collider radius
  getSilhouette: (meshId: string) => Pt[] | undefined; // local-space hull silhouettes
  getHullRadius?: (meshId: string) => number | undefined; // precomputed hullRadius() per mesh
  defaultRadius?: number; // fallback collider size
  colliderScale?: number; // scales every collider/silhouette to match the rendered hull size
}

const colliderRadius = (e: Entity, fallback: number, scale: number): number =>
  Math.max(e.colliderRx ?? fallback, e.colliderRz ?? fallback) * scale * (e.scale ?? 1);

function projectileHitsTarget(a: Pt, b: Pt, t: Entity, cfg: CollisionConfig): boolean {
  const center: Pt = { x: t.pos.x, y: t.pos.z };
  const fallback = cfg.defaultRadius ?? 0.3;
  const entScale = t.scale ?? 1; // per-entity multiplier: hitbox matches the sprite [ROC-FDL-1]
  const scale = cfg.colliderScale ?? 1;
  const rx = (t.colliderRx ?? fallback) * scale * entScale;
  const rz = (t.colliderRz ?? fallback) * scale * entScale;

  // hitMeshId/hitScale let an entity collide against a different mesh (and scale) than the one it
  // spawned with — a splinter is drawn as a small asteroid chunk, so it collides as one too,
  // instead of its own (larger, differently-shaped) mesh. [DEFECTS: render/collide mismatch]
  const meshId = t.hitMeshId ?? t.meshId;
  const meshScale = t.hitScale ?? scale * entScale;

  // No hull silhouette to hug (meshless entity, or content missing the mesh) — fall back to the
  // collider ellipse for both shielded and unshielded hits, as before. [ROC-DMG-1,5]
  const local = meshId ? cfg.getSilhouette(meshId) : undefined;
  if (!local || local.length < 3) {
    return segmentIntersectsEllipse(a, b, center, rx, rz);
  }

  const scaled = meshScale === 1 ? local : local.map((p) => ({ x: p.x * meshScale, y: p.y * meshScale }));
  const world = transformSilhouette(scaled, t.pos.x, t.pos.z, t.yaw);

  if ((t.shield ?? 0) > 0) {
    // Shielded: the shot lands once it's within the outermost ring's gap of the hull, matching
    // the ring drawn on screen — not a separate ellipse shape. [ROC-DMG-1]
    const radius =
      t.hitScale === undefined
        ? (cfg.getHullRadius?.(meshId!) ?? hullRadius(local, scale)) * entScale
        : hullRadius(local, meshScale);
    const gap = shieldGap(radius, t.shield ?? 0);
    return segmentDistToConvexPolygonSq(a, b, world) <= gap * gap;
  }

  // Unshielded: hull silhouette. [ROC-DMG-5]
  return segmentIntersectsConvexPolygon(a, b, world);
}

// Swept segment of a projectile in the play plane (previous -> current position).
function sweptSegment(e: Entity, dt: number): { a: Pt; b: Pt } {
  const b: Pt = { x: e.pos.x, y: e.pos.z };
  const a: Pt = { x: e.pos.x - e.vel.x * dt, y: e.pos.z - e.vel.z * dt };
  return { a, b };
}

// Find this step's projectile hits for the damage system: player fire vs enemy/boss targets, and
// enemy fire vs the player (the player can now be shot — death/lives handled in gamestate). [T6.4]
export function collisionSystem(world: World, cfg: CollisionConfig): CollisionHit[] {
  const hits: CollisionHit[] = [];

  const targets: Entity[] = [];
  for (const e of world.entities.values()) {
    if (e.kind === 'enemy' || e.kind === 'boss' || e.kind === 'asteroid') targets.push(e);
  }

  // Player fire -> enemy targets, via the spatial-hash broadphase.
  if (targets.length > 0) {
    const hash = new SpatialHash(cfg.cellSize);
    const scale = cfg.colliderScale ?? 1;
    for (const t of targets) {
      hash.insert({ id: t.id, x: t.pos.x, y: t.pos.z, r: colliderRadius(t, cfg.defaultRadius ?? 0.3, scale) });
    }
    for (const e of world.entities.values()) {
      if (e.team !== 'player' || (e.kind !== 'projectile' && e.kind !== 'missile')) continue;
      const { a, b } = sweptSegment(e, cfg.dt);
      for (const tid of hash.nearAABB(
        Math.min(a.x, b.x),
        Math.min(a.y, b.y),
        Math.max(a.x, b.x),
        Math.max(a.y, b.y),
      )) {
        const t = world.entities.get(tid);
        if (t && projectileHitsTarget(a, b, t, cfg)) hits.push({ projectile: e.id, target: tid });
      }
    }
  }

  // Enemy fire -> the player. One target, so a direct test is cheaper than a hash. [ROC-DMG-6a]
  const player = world.entities.get(PLAYER_ID);
  if (player) {
    for (const e of world.entities.values()) {
      if (e.team !== 'enemy' || (e.kind !== 'projectile' && e.kind !== 'missile')) continue;
      const { a, b } = sweptSegment(e, cfg.dt);
      if (projectileHitsTarget(a, b, player, cfg)) hits.push({ projectile: e.id, target: PLAYER_ID });
    }
  }

  return hits;
}
