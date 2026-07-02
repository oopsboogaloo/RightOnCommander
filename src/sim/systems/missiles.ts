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
  launchDelay: number; // seconds between one-at-a-time launches [ROC-MIS-8]
  aliveCap: number; // hard ceiling on live missiles; a new launch evicts the oldest [ROC-MIS-9]
  speed: number; // top speed, world units / second [ROC-MIS-6]
  initialSpeed: number; // launch speed before the motor builds up [ROC-MIS-3]
  accel: number; // acceleration toward `speed`, world units / s^2
  ttl: number; // hard lifetime, seconds [ROC-MIS-10]
  turnRate: number; // homing turn rate, rad/s [ROC-MIS-3]
  damage: number;
  wingOffset: number; // lateral launch offset (alternating wings) [ROC-MIS-8]
  muzzleOffset: number; // forward launch offset
  deathCooldown: number; // pause before the next launch once a missile dies (hits or expires) — a
  // freed cap slot doesn't refill instantly, so missiles read as a volley, not a conveyor belt
}

export const DEFAULT_MISSILES: MissilesConfig = {
  durationSec: 60,
  maxGrade: 4,
  launchDelay: 0.35,
  aliveCap: 4,
  speed: 3,
  initialSpeed: 0.3,
  accel: 2.5,
  ttl: 30,
  turnRate: 6,
  damage: 2,
  wingOffset: 0.16,
  muzzleOffset: 0.1,
  deathCooldown: 0.3,
};

// Per-ship missile capacity — how many of the player's missiles may be airborne at once. [ROC-MIS-12]
export const SHIP_MISSILE_CAP: Record<string, number> = {
  sidewinder: 1,
  cobra_mk3: 2,
  asp_mk2: 3,
  fer_de_lance: 4,
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

// Is any enemy/boss on screen (within the visible play field)? Missiles only fire if so. [ROC-MIS-7]
function enemyOnScreen(world: World): boolean {
  for (const e of world.entities.values()) {
    if (e.kind !== 'enemy' && e.kind !== 'boss') continue;
    if (e.pos.z >= -1.7 && e.pos.z <= 1.9 && Math.abs(e.pos.x) <= 1.3) return true;
  }
  return false;
}

const liveMissiles = (world: World): Entity[] => [...world.entities.values()].filter((e) => e.kind === 'missile');

// Launch a single missile from the given wing, aimed at the nearest enemy. [ROC-MIS-8]
function fireOne(world: World, wing: 1 | -1, cfg: MissilesConfig): void {
  const player = world.entities.get(PLAYER_ID);
  if (!player) return;
  const target = nearestEnemy(world, player.pos);
  const a = target ? angleOf(target.pos.x - player.pos.x, target.pos.z - player.pos.z) : 0; // 0 = +z
  const m = acquireMissile(world);
  m.kind = 'missile';
  m.team = 'player';
  m.pos = vec3(player.pos.x + wing * cfg.wingOffset, 0, player.pos.z + cfg.muzzleOffset);
  m.speed = cfg.initialSpeed; // launches slow, then the motor builds up [ROC-MIS-3,6]
  m.vel = vec3(Math.sin(a) * cfg.initialSpeed, 0, Math.cos(a) * cfg.initialSpeed);
  m.yaw = a;
  m.bank = 0;
  m.ttl = cfg.ttl;
  m.hull = 1; // destructible [ROC-MIS-5]
  m.hullMax = 1;
  m.shield = 0;
  m.damage = cfg.damage;
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

  // Continuous autofire, one missile at a time, alternating wings, only while a target is on
  // screen. Keep up to `cap` (min of the timed grade and the ship's capacity) airborne; the hard
  // ceiling evicts the oldest so nothing lives forever. [ROC-MIS-1,7,8,9,12]
  if (p.missileGrade > 0 && enemyOnScreen(world)) {
    p.missileCooldown -= dt;
    if (p.missileCooldown <= 0) {
      const cap = Math.min(p.missileGrade, SHIP_MISSILE_CAP[p.shipClass] ?? 1);
      let live = liveMissiles(world);
      if (live.length < cap) {
        const wing: 1 | -1 = p.missileWing === 0 ? -1 : 1;
        // Global ceiling safety (e.g. after a ship downgrade): evict oldest (lowest id) first.
        while (live.length >= cfg.aliveCap) {
          const oldest = live.reduce((a, b) => (a.id < b.id ? a : b));
          world.entities.delete(oldest.id);
          world.pool.missiles.push(oldest);
          live = liveMissiles(world);
        }
        fireOne(world, wing, cfg);
        p.missileWing = p.missileWing === 0 ? 1 : 0; // alternate next time [ROC-MIS-8]
      }
      p.missileCooldown = cfg.launchDelay;
    }
  }

  // Home, move and expire existing missiles.
  for (const m of [...world.entities.values()]) {
    if (m.kind !== 'missile') continue;
    steerHoming(world, m, dt, cfg);
    m.pos.x += m.vel.x * dt;
    m.pos.y += m.vel.y * dt;
    m.pos.z += m.vel.z * dt;
    world.events.push({ type: 'exhaust', pos: { ...m.pos }, vel: { ...m.vel } }); // thick thrust trail [ROC-MIS-11]
    m.ttl = (m.ttl ?? 0) - dt;
    if (m.ttl <= 0) {
      world.entities.delete(m.id);
      world.pool.missiles.push(m);
      p.missileCooldown = Math.max(p.missileCooldown, cfg.deathCooldown); // [ROC-MIS-8 tuning]
    }
  }
}
