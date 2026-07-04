// Player weapons: three laser types, all fired on the same trigger. [ROC-LAS-3,4,5,6; design §9]
//
// - pulse:    short moving segment-projectiles at a steady cadence (the default). [ROC-LAS-3]
// - military: like the pulse but twice as fast, twice the damage and twice the fire rate; its
//             bolts render shorter and thicker. [ROC-LAS-5]
// - beam:     an instant, continuous hitscan beam from the muzzle to the first thing it meets,
//             dealing 1 damage per 300 ms of contact. Rendered from world.beams. [ROC-LAS-6]
//
// Every installed laser fires along its mount; multiple lasers in one direction fan out slightly.
// A ship can mix types (e.g. a beam and a pulse both firing). Projectiles come from an object pool.

import type { InputFrame } from '../../interfaces.js';
import type { Entity } from '../components.js';
import { type Vec3, vec3, add, scale } from '../math/vec3.js';
import { PLAYER_ID, type World } from '../world.js';
import { applyDamage } from './damage.js';

export interface WeaponsConfig {
  pulseRate: number; // shots per second per trigger
  pulseSpeed: number; // world units / second
  pulseTtl: number; // projectile lifetime, seconds
  pulseDamage: number; // damage per pulse hit
  militaryRate: number; // shots per second (twice the pulse) [ROC-LAS-5]
  militarySpeed: number; // twice the pulse speed
  militaryTtl: number;
  militaryDamage: number; // twice the pulse damage
  beamRange: number; // how far a beam reaches when it hits nothing, world units [ROC-LAS-6]
  beamPeriod: number; // seconds of contact per 1 damage (300 ms)
  beamDamage: number; // damage applied each time `beamPeriod` of contact accrues
  muzzleOffset: number; // fallback spawn distance from the ship centre, when no hull extent is known
  muzzleGap: number; // small clearance beyond the hull surface, when a hull extent is known
  muzzleSpread: number; // lateral gap between multiple lasers in one direction
  colliderScale: number; // matches the rendered hull size (SHIP_SCALE); scales beam hit radii
  getHullExtent?: (meshId: string) => HullExtent | undefined; // per-mount reach to the hull edge
}

// How far a ship's silhouette reaches from its centre along each firing axis — the nose, tail and
// each wingtip are all different distances, so a single "hull radius" would overshoot the shorter
// ones (e.g. a wide, short-nosed fighter). The player never yaws (only banks), so these map
// straight onto the mesh's own local axes. [ROC-LAS-*]
export interface HullExtent {
  front: number;
  rear: number;
  left: number;
  right: number;
}

export const DEFAULT_WEAPONS: WeaponsConfig = {
  pulseRate: 6,
  pulseSpeed: 4.2, // -30% [tuning]
  pulseTtl: 1.2,
  pulseDamage: 1,
  militaryRate: 12,
  militarySpeed: 12,
  militaryTtl: 1.0,
  militaryDamage: 2,
  beamRange: 3,
  beamPeriod: 0.3,
  beamDamage: 1.4, // +40% [tuning]
  muzzleOffset: 0.25,
  muzzleGap: 0.03, // just clear of the hull silhouette, not floating off the nose
  muzzleSpread: 0.04, // half the previous gap: multi-laser mounts read as one fatter weapon, not two separate guns
  colliderScale: 1,
};

// Mount -> firing direction in the play plane (x right, z up-screen/forward).
const MOUNT_DIRS: { mount: 'front' | 'rear' | 'left' | 'right'; dir: Vec3 }[] = [
  { mount: 'front', dir: vec3(0, 0, 1) },
  { mount: 'rear', dir: vec3(0, 0, -1) },
  { mount: 'left', dir: vec3(-1, 0, 0) },
  { mount: 'right', dir: vec3(1, 0, 0) },
];

// Take a projectile entity from the pool (or make one) — shared by player and enemy weapons.
export function acquireProjectile(world: World): Entity {
  const reused = world.pool.projectiles.pop();
  const id = world.nextId++;
  if (reused) {
    reused.id = id;
    reused.mil = false; // start clean; a spawner sets it if this is a military bolt
    world.entities.set(id, reused);
    return reused;
  }
  const fresh: Entity = { id, kind: 'projectile', pos: vec3(), vel: vec3(), yaw: 0, bank: 0, mil: false };
  world.entities.set(id, fresh);
  return fresh;
}

function recycleProjectile(world: World, e: Entity): void {
  world.entities.delete(e.id);
  world.pool.projectiles.push(e); // keep the object for reuse — no leak
}

// Distance from the ship centre to the muzzle, along this mount's own axis: the hull's actual
// reach in that direction (matching the drawn/collided size) plus a small clearance, so shots
// start right at the hull rather than floating in open space; or the fallback offset when no hull
// extent is known for this mesh (e.g. in tests without content). [ROC-LAS-*]
function muzzleDist(ship: Entity, mount: 'front' | 'rear' | 'left' | 'right', cfg: WeaponsConfig): number {
  const ext = ship.meshId ? cfg.getHullExtent?.(ship.meshId) : undefined;
  const reach = ext?.[mount];
  return reach != null ? reach * (ship.scale ?? 1) + cfg.muzzleGap : cfg.muzzleOffset;
}

function spawnBolt(world: World, origin: Vec3, dir: Vec3, speed: number, ttl: number, damage: number, mil: boolean): void {
  const e = acquireProjectile(world);
  e.kind = 'projectile';
  e.team = 'player';
  e.pos = { x: origin.x, y: origin.y, z: origin.z };
  e.vel = scale(dir, speed);
  e.yaw = 0;
  e.bank = 0;
  e.ttl = ttl;
  e.damage = damage;
  e.mil = mil;
}

// The nearest enemy/boss/asteroid the beam ray meets ahead of the muzzle, by ray-vs-collider-circle.
function beamHit(world: World, origin: Vec3, dir: Vec3, range: number, colliderScale: number): { e: Entity; t: number } | null {
  let best: Entity | null = null;
  let bestT = range;
  for (const e of world.entities.values()) {
    if (e.kind !== 'enemy' && e.kind !== 'boss' && e.kind !== 'asteroid') continue;
    const r = Math.max(e.colliderRx ?? 0.2, e.colliderRz ?? 0.2) * colliderScale * (e.scale ?? 1);
    const lx = e.pos.x - origin.x;
    const lz = e.pos.z - origin.z;
    const tca = lx * dir.x + lz * dir.z; // projection onto the ray
    if (tca < -r) continue; // fully behind the muzzle
    const d2 = lx * lx + lz * lz - tca * tca; // squared distance from centre to the ray
    if (d2 > r * r) continue; // ray misses the circle
    const t = Math.max(0, tca - Math.sqrt(r * r - d2)); // entry distance (0 if muzzle is inside)
    if (t < bestT) {
      bestT = t;
      best = e;
    }
  }
  return best ? { e: best, t: bestT } : null;
}

// One continuous beam this step: trace it, record the segment to draw, and accrue contact damage
// (1 per beamPeriod of fire). [ROC-LAS-6]
function fireBeam(world: World, origin: Vec3, dir: Vec3, dt: number, cfg: WeaponsConfig): void {
  const hit = beamHit(world, origin, dir, cfg.beamRange, cfg.colliderScale);
  const reach = hit ? hit.t : cfg.beamRange;
  const bx = origin.x + dir.x * reach;
  const bz = origin.z + dir.z * reach;
  world.beams.push({ ax: origin.x, az: origin.z, bx, bz });
  if (!hit) return;

  // Sparks at the impact point every step the beam holds contact — particlesSystem spawns them
  // (it owns the rng); the beam itself is otherwise instantaneous, non-physical. [ROC-LAS-6]
  world.events.push({ type: 'beamHit', pos: { x: bx, y: 0, z: bz } });

  const target = hit.e;
  target.beamExposure = (target.beamExposure ?? 0) + dt;
  while ((target.beamExposure ?? 0) >= cfg.beamPeriod) {
    target.beamExposure = (target.beamExposure ?? 0) - cfg.beamPeriod;
    applyDamage(world, target, cfg.beamDamage);
    if ((target.hull ?? 0) <= 0) break; // destroyed (and possibly removed) — stop burning it
  }
}

export function weaponsSystem(
  world: World,
  input: InputFrame,
  dt: number,
  cfg: WeaponsConfig = DEFAULT_WEAPONS,
): void {
  world.beams = []; // beams are instantaneous: recomputed fresh every step

  const player = world.entities.get(PLAYER_ID);
  if (player && !world.player.respawnPending) {
    world.player.fireCooldown = Math.max(0, world.player.fireCooldown - dt);
    world.player.militaryCooldown = Math.max(0, world.player.militaryCooldown - dt);

    // Guns are disabled through the docking approach. [ROC-DCKG-2]
    const firing = world.levelState !== 'DOCKING' && (input.firing || input.fireTapped);
    const firePulse = firing && world.player.fireCooldown <= 0; // pulse cadence
    const fireMil = firing && world.player.militaryCooldown <= 0; // military cadence (2x)
    let firedPulse = false;
    let firedMil = false;

    for (const { mount, dir } of MOUNT_DIRS) {
      const lasers = world.player.lasers[mount];
      const n = lasers.length;
      const dist = muzzleDist(player, mount, cfg);
      const perp = vec3(dir.z, 0, -dir.x); // in-plane perpendicular, for side-by-side muzzles
      for (let i = 0; i < n; i++) {
        const offset = (i - (n - 1) / 2) * cfg.muzzleSpread;
        const origin = add(add(player.pos, scale(dir, dist)), scale(perp, offset));
        const type = lasers[i];
        if (type === 'beam') {
          if (firing) fireBeam(world, origin, dir, dt, cfg);
        } else if (type === 'military') {
          if (fireMil) {
            spawnBolt(world, origin, dir, cfg.militarySpeed, cfg.militaryTtl, cfg.militaryDamage, true);
            firedMil = true;
          }
        } else if (firePulse) {
          spawnBolt(world, origin, dir, cfg.pulseSpeed, cfg.pulseTtl, cfg.pulseDamage, false);
          firedPulse = true;
        }
      }
    }
    if (firedPulse) {
      world.player.fireCooldown = 1 / cfg.pulseRate;
      world.events.push({ type: 'sfx', id: 'laser_pulse' });
    }
    if (firedMil) {
      world.player.militaryCooldown = 1 / cfg.militaryRate;
      world.events.push({ type: 'sfx', id: 'laser_military' });
    }
  }

  // Advance projectiles and recycle the expired ones.
  for (const e of [...world.entities.values()]) {
    if (e.kind !== 'projectile') continue;
    e.pos.x += e.vel.x * dt;
    e.pos.y += e.vel.y * dt;
    e.pos.z += e.vel.z * dt;
    e.ttl = (e.ttl ?? 0) - dt;
    if (e.ttl <= 0) recycleProjectile(world, e);
  }
}
