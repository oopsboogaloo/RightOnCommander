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

const SPAWN_Z = 1.8; // matches enemy path entry [paths.ts]
const CULL_Z = -1.9; // past the bottom edge — drifted off-field, quietly removed
// A splinter's outward kick can point any direction (including one that cancels its inherited
// drift), so — unlike a large asteroid, whose velocity.z is always negative and so is guaranteed
// to eventually cross CULL_Z — it isn't guaranteed to ever drift off the bottom edge. Without its
// own lifetime it could linger forever, permanently blocking the ASTEROIDS phase from clearing.
const SPLINTER_TTL = 8;

const LARGE = { hull: 4, bounty: 0, meshId: 'asteroid', colliderRx: 0.24, colliderRz: 0.24 };
const SPLINTER = { hull: 1, bounty: 4, meshId: 'splinter', colliderRx: 0.11, colliderRz: 0.11 };

const randSign = (rng: Rng): number => (rng.int(2) === 0 ? -1 : 1);
const randTumble = (rng: Rng, [lo, hi]: [number, number]): { yawRate: number; bankRate: number } => ({
  yawRate: rng.range(lo, hi) * randSign(rng),
  bankRate: rng.range(lo, hi) * randSign(rng),
});

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
