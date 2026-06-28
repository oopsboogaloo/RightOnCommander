// Player weapons: pulse lasers. Autofire while held and single-shot on tap, gated by a
// per-trigger cooldown so the cadence is identical either way. All non-null laser mounts fire
// on the same trigger; pulses are short moving segment-projectiles drawn from an object pool to
// avoid per-frame allocation. [tasks T2.3, ROC-CTL-1, ROC-LAS-3,4; design §9]

import type { InputFrame } from '../../interfaces.js';
import type { Entity } from '../components.js';
import { type Vec3, vec3, add, scale } from '../math/vec3.js';
import { PLAYER_ID, type World } from '../world.js';

export interface WeaponsConfig {
  pulseRate: number; // shots per second per trigger
  pulseSpeed: number; // world units / second
  pulseTtl: number; // projectile lifetime, seconds
  muzzleOffset: number; // spawn distance from the ship centre
  pulseDamage: number; // damage per pulse hit
}

export const DEFAULT_WEAPONS: WeaponsConfig = {
  pulseRate: 6,
  pulseSpeed: 6,
  pulseTtl: 1.2,
  muzzleOffset: 0.25,
  pulseDamage: 1,
};

// Mount -> firing direction in the play plane (x right, z up-screen/forward).
const MOUNT_DIRS: { mount: 'front' | 'rear' | 'left' | 'right'; dir: Vec3 }[] = [
  { mount: 'front', dir: vec3(0, 0, 1) },
  { mount: 'rear', dir: vec3(0, 0, -1) },
  { mount: 'left', dir: vec3(-1, 0, 0) },
  { mount: 'right', dir: vec3(1, 0, 0) },
];

function acquireProjectile(world: World): Entity {
  const reused = world.pool.projectiles.pop();
  const id = world.nextId++;
  if (reused) {
    reused.id = id;
    world.entities.set(id, reused);
    return reused;
  }
  const fresh: Entity = { id, kind: 'projectile', pos: vec3(), vel: vec3(), yaw: 0, bank: 0 };
  world.entities.set(id, fresh);
  return fresh;
}

function recycleProjectile(world: World, e: Entity): void {
  world.entities.delete(e.id);
  world.pool.projectiles.push(e); // keep the object for reuse — no leak
}

function spawnPulse(world: World, origin: Vec3, dir: Vec3, cfg: WeaponsConfig): void {
  const e = acquireProjectile(world);
  e.kind = 'projectile';
  e.team = 'player';
  e.pos = { x: origin.x, y: origin.y, z: origin.z };
  e.vel = scale(dir, cfg.pulseSpeed);
  e.yaw = 0;
  e.bank = 0;
  e.ttl = cfg.pulseTtl;
  e.damage = cfg.pulseDamage;
}

export function weaponsSystem(
  world: World,
  input: InputFrame,
  dt: number,
  cfg: WeaponsConfig = DEFAULT_WEAPONS,
): void {
  const player = world.entities.get(PLAYER_ID);
  if (player) {
    world.player.fireCooldown = Math.max(0, world.player.fireCooldown - dt);

    // Held autofires; a tap fires one shot. Both honour the cooldown. [ROC-CTL-1, ROC-LAS-3]
    if ((input.firing || input.fireTapped) && world.player.fireCooldown <= 0) {
      const lasers = world.player.lasers;
      for (const { mount, dir } of MOUNT_DIRS) {
        if (lasers[mount] === null) continue;
        spawnPulse(world, add(player.pos, scale(dir, cfg.muzzleOffset)), dir, cfg);
      }
      world.player.fireCooldown = 1 / cfg.pulseRate;
      world.events.push({ type: 'sfx', id: 'laser_pulse' });
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
