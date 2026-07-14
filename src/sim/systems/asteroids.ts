// Drifting asteroid field: the Level 1 opener. Large rocks drift down-screen tumbling freely
// (yaw and bank spin independently of heading/motion, unlike ships), and shooting one apart
// fragments it into a handful of slower, smaller splinters — the terminal fragment, which the
// drops/economy systems reward with a small bounty and a chance of mined loot. Several waves of
// rocks can be sequenced (like wavesA sequences fighter waves). [ROC-L1-1]

import { vec3 } from '../math/vec3.js';
import type { Entity } from '../components.js';
import type { Rng } from '../rng.js';
import type { AsteroidFieldState, World } from '../world.js';
import { scaledCount } from './difficulty.js';

export interface AsteroidFieldDef {
  count: number;
  spacingMs: number;
  delayMs?: number; // wait before this wave starts spawning (sequences waves, as in wavesA)
  speed?: number; // downward drift speed, world units/sec
  xSpread?: number; // half-width of the spawn x range
}

// Which level phase a giant asteroid appears in — the same four phases that already schedule the
// other (randomised) asteroid fields, so an authored obstacle can be placed anywhere across the
// level. [ROC-GIANT-1]
export type GiantAsteroidPhase = 'asteroids' | 'wavesA' | 'asteroidsB' | 'wavesB';

// One authored giant asteroid: a fixed x position and a delay (from its phase's start) rather
// than the randomised count/spacing/xSpread of a normal field — level geography, not a hazard
// field. [ROC-GIANT-1]
export interface GiantAsteroidDef {
  phase: GiantAsteroidPhase;
  x: number;
  delayMs?: number;
}

const SPAWN_Z = 1.8; // matches enemy path entry [paths.ts]
const CULL_Z = -1.9; // past the bottom edge — drifted off-field, quietly removed
// A splinter's outward kick can point any direction (including one that cancels its inherited
// drift), so — unlike a large asteroid, whose velocity.z is always negative and so is guaranteed
// to eventually cross CULL_Z — it isn't guaranteed to ever drift off the bottom edge. Without its
// own lifetime it could linger forever, permanently blocking the ASTEROIDS phase from clearing.
const SPLINTER_TTL = 8;

const LARGE = { hull: 3, bounty: 0, meshId: 'asteroid', colliderRx: 0.24, colliderRz: 0.24 };
const SPLINTER = { hull: 1, bounty: 4, meshId: 'splinter', colliderRx: 0.11, colliderRz: 0.11 };
// A giant asteroid reuses the same rock mesh, just drawn (and collided — the mesh silhouette
// scales with it) 5x bigger, with thick white edges applied at render time by meshId. Slow,
// flat, single-axis spin (yaw only — see boss.ts §4 rotation notes) rather than the small rocks'
// chaotic yaw+bank tumble; indestructible, so it never fragments. [ROC-GIANT-1]
const GIANT = { meshId: 'giant_asteroid', scale: 5, speed: 0.28 };
const GIANT_YAW_RATE: [number, number] = [0.15, 0.25]; // rad/s — much slower than a normal tumble

// A splinter reads better on screen as a small asteroid chunk than the authentic-but-oddly-
// angular bbcelite splinter shape, so it's drawn (and collided) as the asteroid mesh at this
// fraction of its normal size. Single source of truth for both the renderer and collision, so
// the hitbox can never drift from the sprite. [DEFECTS: render/collide mismatch]
export const SPLINTER_HIT_SCALE = 0.15;

const randSign = (rng: Rng): number => (rng.int(2) === 0 ? -1 : 1);
const randTumble = (rng: Rng, [lo, hi]: [number, number]): { yawRate: number; bankRate: number } => ({
  yawRate: rng.range(lo, hi) * randSign(rng),
  bankRate: rng.range(lo, hi) * randSign(rng),
});

// Register the pending authored giant asteroids for one level phase (see GiantAsteroidPhase);
// each is one-shot — no count/spacing loop, just a single spawn at its delay. [ROC-GIANT-1]
export function startGiantAsteroids(world: World, defs: GiantAsteroidDef[]): void {
  for (const def of defs) {
    world.giantAsteroids.push({ x: def.x, timer: (def.delayMs ?? 0) / 1000 });
  }
}

function spawnGiant(world: World, rng: Rng, x: number): void {
  const id = world.nextId++;
  const e: Entity = {
    id,
    kind: 'asteroid',
    pos: vec3(x, 0, SPAWN_Z),
    vel: vec3(0, 0, -GIANT.speed),
    yaw: rng.range(0, Math.PI * 2),
    bank: 0,
    hull: 999,
    hullMax: 999,
    bounty: 0,
    meshId: GIANT.meshId,
    scale: GIANT.scale,
    indestructible: true,
    tumble: { yawRate: rng.range(GIANT_YAW_RATE[0], GIANT_YAW_RATE[1]) * randSign(rng), bankRate: 0 },
  };
  world.entities.set(id, e);
}

// Register one or more asteroid waves; each spawns its members over the following steps,
// sequenced by its own delayMs so the field can ramp up in bursts. [ROC-L1-1]
export function startAsteroidWaves(world: World, defs: AsteroidFieldDef[]): void {
  world.asteroidWaves = defs.map((def) => ({
    pending: scaledCount(def.count, world.difficulty),
    timer: (def.delayMs ?? 0) / 1000,
    spacingSec: def.spacingMs / 1000,
    speed: def.speed ?? 0.28,
    xSpread: def.xSpread ?? 0.85,
  }));
}

function spawnLarge(world: World, rng: Rng, field: AsteroidFieldState): void {
  const id = world.nextId++;
  const x = rng.range(-field.xSpread, field.xSpread);
  const e: Entity = {
    id,
    kind: 'asteroid',
    pos: vec3(x, 0, SPAWN_Z),
    vel: vec3(rng.range(-0.06, 0.06), 0, -field.speed),
    yaw: rng.range(0, Math.PI * 2),
    bank: rng.range(0, Math.PI * 2),
    hull: LARGE.hull,
    hullMax: LARGE.hull,
    bounty: LARGE.bounty,
    meshId: LARGE.meshId,
    colliderRx: LARGE.colliderRx,
    colliderRz: LARGE.colliderRz,
    tumble: randTumble(rng, [0.5, 1.3]),
  };
  world.entities.set(id, e);
}

// Shatter a destroyed large asteroid into a handful of smaller splinters that scatter outward
// from the break point, inheriting its drift. [ROC-L1-1]
function spawnSplinters(world: World, rng: Rng, at: Entity['pos'], baseVel: Entity['vel']): void {
  const count = 4 + rng.int(2); // 4-5 pieces
  const speed = (Math.hypot(baseVel.x, baseVel.z) || 0.28) * rng.range(0.6, 1.0);
  const spread = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const angle = i * spread + rng.range(-0.4, 0.4);
    const id = world.nextId++;
    world.entities.set(id, {
      id,
      kind: 'asteroid',
      pos: vec3(at.x, at.y, at.z),
      vel: vec3(baseVel.x + Math.cos(angle) * speed, 0, baseVel.z + Math.sin(angle) * speed),
      yaw: rng.range(0, Math.PI * 2),
      bank: rng.range(0, Math.PI * 2),
      hull: SPLINTER.hull,
      hullMax: SPLINTER.hull,
      bounty: SPLINTER.bounty,
      meshId: SPLINTER.meshId,
      colliderRx: SPLINTER.colliderRx,
      colliderRz: SPLINTER.colliderRz,
      hitMeshId: LARGE.meshId, // collides as the drawn asteroid-chunk mesh, not its own
      hitScale: SPLINTER_HIT_SCALE,
      tumble: randTumble(rng, [1.2, 2.6]), // smaller pieces tumble faster
      ttl: SPLINTER_TTL,
    });
  }
}

// Spawn pending members of every active wave, drift + tumble every asteroid, and cull whatever
// drifts off-field. Runs before collision so freshly spawned/moved rocks are hit-tested the same
// step as ships.
export function asteroidFieldSystem(world: World, rng: Rng, dt: number): void {
  for (const field of world.asteroidWaves) {
    field.timer -= dt;
    while (field.pending > 0 && field.timer <= 0) {
      spawnLarge(world, rng, field);
      field.pending--;
      field.timer += field.spacingSec;
    }
  }

  if (world.giantAsteroids.length > 0) {
    const ready: number[] = [];
    for (let i = 0; i < world.giantAsteroids.length; i++) {
      const g = world.giantAsteroids[i];
      g.timer -= dt;
      if (g.timer <= 0) ready.push(i);
    }
    for (let i = ready.length - 1; i >= 0; i--) {
      const idx = ready[i];
      spawnGiant(world, rng, world.giantAsteroids[idx].x);
      world.giantAsteroids.splice(idx, 1);
    }
  }

  for (const e of world.entities.values()) {
    if (e.kind !== 'asteroid') continue;
    e.pos.x += e.vel.x * dt;
    e.pos.z += e.vel.z * dt;
    if (e.tumble) {
      e.yaw += e.tumble.yawRate * dt;
      e.bank += e.tumble.bankRate * dt;
    }
  }

  for (const e of [...world.entities.values()]) {
    if (e.kind !== 'asteroid') continue;
    if (e.ttl !== undefined) e.ttl -= dt;
    if (e.pos.z < CULL_Z || (e.ttl !== undefined && e.ttl <= 0)) world.entities.delete(e.id);
  }
}

// Fragment large asteroids destroyed this step. Runs after damage/collision, alongside drops
// and economy, which reward the terminal splinter via its own bounty/meshId. [ROC-L1-1]
export function asteroidSplitSystem(world: World, rng: Rng): void {
  for (const ev of world.events) {
    if (ev.type !== 'destroyed' || ev.kind !== 'asteroid' || ev.meshId !== LARGE.meshId) continue;
    spawnSplinters(world, rng, ev.pos as Entity['pos'], (ev.vel as Entity['vel']) ?? vec3());
  }
}
