// Homing missiles power-up. While missileGrade > 0 the player continuously auto-fires a volley
// of `grade` homing missiles at the nearest targets. Each grade lasts a timer; on expiry the
// grade drops by one (timer restarts) until it reaches 0. Missiles are destructible entities.
// [tasks T4.4, design §9, ROC-MIS-1..5]

import { type Vec3, vec3 } from '../math/vec3.js';
import type { Entity } from '../components.js';
import { PLAYER_ID, type World } from '../world.js';

export interface MissilesConfig {
  durationSec: number; // timer per grade [ROC-MIS-4]
  maxGrade: number; // [ROC-MIS-2]
  volleyRate: number; // volleys per second (continuous autofire) [ROC-MIS-1]
  speed: number; // top speed, world units / second
  initialSpeed: number; // launch speed before the motor builds up [ROC-MIS-3]
  accel: number; // acceleration toward `speed`, world units / s^2
  ttl: number; // missile lifetime, seconds
  turnRate: number; // homing turn rate, rad/s [ROC-MIS-3]
  damage: number;
  spread: number; // fan angle between missiles in a volley
  muzzleOffset: number;
}

export const DEFAULT_MISSILES: MissilesConfig = {
  durationSec: 60,
  maxGrade: 4,
  volleyRate: 1,
  speed: 4.5,
  initialSpeed: 1,
  accel: 7,
  ttl: 4,
  turnRate: 6,
  damage: 2,
  spread: 0.25,
  muzzleOffset: 0.25,
};

// Collect a missile power-up: raise the grade (capped) and restart the timer. [ROC-MIS-1,2]
export function collectMissile(world: World, cfg: MissilesConfig = DEFAULT_MISSILES): void {
  const p = world.player;
  p.missileGrade = Math.min(cfg.maxGrade, p.missileGrade + 1);
  p.missileTimer = cfg.durationSec;
}

const angleOf = (x: number, z: number): number => Math.atan2(x, z); // matches yaw convention

function nearestEnemy(world: World, from: Vec3): Entity | undefined {
  let best: Entity | undefined;
  let bestD = Infinity;
  for (const e of world.entities.values()) {
    if (e.kind !== 'enemy' && e.kind !== 'boss') continue;
    const d = (e.pos.x - from.x) ** 2 + (e.pos.z - from.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function acquireMissile(world: World): Entity {
  const reused = world.pool.missiles.pop();
  const id = world.nextId++;
  if (reused) {
    reused.id = id;
    world.entities.set(id, reused);
    return reused;
  }
  const fresh: Entity = { id, kind: 'missile', pos: vec3(), vel: vec3(), yaw: 0, bank: 0 };
  world.entities.set(id, fresh);
  return fresh;
}

function fireVolley(world: World, grade: number, cfg: MissilesConfig): void {
  const player = world.entities.get(PLAYER_ID);
  if (!player) return;
  const target = nearestEnemy(world, player.pos);
  const baseAngle = target ? angleOf(target.pos.x - player.pos.x, target.pos.z - player.pos.z) : 0; // 0 = +z

  for (let i = 0; i < grade; i++) {
    const a = baseAngle + (i - (grade - 1) / 2) * cfg.spread;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    const m = acquireMissile(world);
    m.kind = 'missile';
    m.team = 'player';
    m.pos = vec3(player.pos.x + dx * cfg.muzzleOffset, 0, player.pos.z + dz * cfg.muzzleOffset);
    m.speed = cfg.initialSpeed; // launches slow, then the motor builds up [ROC-MIS-3]
    m.vel = vec3(dx * cfg.initialSpeed, 0, dz * cfg.initialSpeed);
    m.yaw = a;
    m.bank = 0;
    m.ttl = cfg.ttl;
    m.hull = 1; // destructible [ROC-MIS-5]
    m.hullMax = 1;
    m.shield = 0;
    m.damage = cfg.damage;
  }
}

function steerHoming(world: World, m: Entity, dt: number, cfg: MissilesConfig): void {
  // Build up to top speed over the first moments of flight. [ROC-MIS-3]
  const speed = Math.min(cfg.speed, (m.speed ?? cfg.speed) + cfg.accel * dt);
  m.speed = speed;

  const current = angleOf(m.vel.x, m.vel.z);
  let a = current;
  const target = nearestEnemy(world, m.pos);
  if (target) {
    const desired = angleOf(target.pos.x - m.pos.x, target.pos.z - m.pos.z);
    let delta = desired - current;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta)); // wrap to [-pi, pi]
    const maxTurn = cfg.turnRate * dt;
    a = current + Math.max(-maxTurn, Math.min(maxTurn, delta));
  }
  m.vel = vec3(Math.sin(a) * speed, 0, Math.cos(a) * speed);
  m.yaw = a;
}

export function missilesSystem(world: World, dt: number, cfg: MissilesConfig = DEFAULT_MISSILES): void {
  const p = world.player;

  // Grade timer: on expiry drop one grade and restart, removing the power-up at 0. [ROC-MIS-4]
  if (p.missileGrade > 0) {
    p.missileTimer -= dt;
    if (p.missileTimer <= 0) {
      p.missileGrade -= 1;
      p.missileTimer = p.missileGrade > 0 ? cfg.durationSec : 0;
    }
  }

  // Continuous autofire while active; volley size == grade. [ROC-MIS-1]
  if (p.missileGrade > 0) {
    p.missileCooldown -= dt;
    if (p.missileCooldown <= 0) {
      fireVolley(world, p.missileGrade, cfg);
      p.missileCooldown = 1 / cfg.volleyRate;
    }
  }

  // Home, move and expire existing missiles.
  for (const m of [...world.entities.values()]) {
    if (m.kind !== 'missile') continue;
    steerHoming(world, m, dt, cfg);
    m.pos.x += m.vel.x * dt;
    m.pos.y += m.vel.y * dt;
    m.pos.z += m.vel.z * dt;
    if (world.frame % 2 === 0) world.events.push({ type: 'exhaust', pos: { ...m.pos }, vel: { ...m.vel } }); // thrust trail [ROC-MIS-3]
    m.ttl = (m.ttl ?? 0) - dt;
    if (m.ttl <= 0) {
      world.entities.delete(m.id);
      world.pool.missiles.push(m);
    }
  }
}
