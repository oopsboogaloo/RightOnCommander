// Explosions & particles. Destruction scatters white particles; hull hits shed a small burst.
// All randomness flows through world.rng (passed in), so particle storms are fully deterministic
// for a seed. Particles are pooled to avoid per-frame allocation. [tasks T3.4, design §7, ROC-VIS-6]

import type { Entity } from '../components.js';
import type { Rng } from '../rng.js';
import type { World } from '../world.js';

export interface ParticlesConfig {
  explosionCount: [number, number]; // particles per destruction
  fragmentCount: [number, number]; // particles per hull-hit fragment burst
  speed: [number, number]; // world units / second
  ttl: [number, number]; // seconds
  fragSpeed: [number, number]; // wireframe-shard drift speed
  fragSpin: [number, number]; // wireframe-shard tumble, radians/sec (signed via rng)
  fragTtl: [number, number]; // wireframe-shard lifetime
  exhaustTtl: [number, number]; // missile thrust-puff lifetime
  sparkCount: [number, number]; // particles per beam-impact tick [ROC-LAS-6]
  sparkSpeed: [number, number]; // short-ranged: barely leaves the impact point
  sparkTtl: [number, number]; // very brief — a fizz, not a firework
}

interface Vel {
  x: number;
  y: number;
  z: number;
}
const ZERO: Vel = { x: 0, y: 0, z: 0 };

// Tuned to sit on the (1/3-scale) hull rather than spray across the field: low drift speeds keep
// the blast in place, longer lifetimes make it read as a slow, deliberate break-up. [ROC-VIS-6]
export const DEFAULT_PARTICLES: ParticlesConfig = {
  explosionCount: [8, 13],
  fragmentCount: [2, 4],
  speed: [0.1, 0.35],
  ttl: [0.55, 1.2],
  fragSpeed: [0.1, 0.4],
  fragSpin: [0.8, 2.6],
  fragTtl: [0.7, 1.3],
  exhaustTtl: [0.18, 0.34],
  sparkCount: [1, 2],
  sparkSpeed: [0.05, 0.2],
  sparkTtl: [0.05, 0.12],
};

// One edge of a ship mesh, projected to the play plane and pre-scaled to the rendered hull size.
export interface FragSeg {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}
export type FragGeom = Record<string, FragSeg[]>;

interface XYZ {
  x: number;
  y: number;
  z: number;
}

const randInt = (rng: Rng, [lo, hi]: [number, number]): number => lo + rng.int(hi - lo + 1);
const randRange = (rng: Rng, [lo, hi]: [number, number]): number => rng.range(lo, hi);

function acquireParticle(world: World): Entity {
  const reused = world.pool.particles.pop();
  const id = world.nextId++;
  if (reused) {
    reused.id = id;
    world.entities.set(id, reused);
    return reused;
  }
  const fresh: Entity = { id, kind: 'particle', pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, bank: 0 };
  world.entities.set(id, fresh);
  return fresh;
}

function recycleParticle(world: World, e: Entity): void {
  world.entities.delete(e.id);
  world.pool.particles.push(e);
}

function burstRanged(
  world: World,
  rng: Rng,
  at: XYZ,
  count: number,
  speedRange: [number, number],
  ttlRange: [number, number],
  base: Vel = ZERO,
): void {
  for (let i = 0; i < count; i++) {
    const e = acquireParticle(world);
    e.kind = 'particle';
    const angle = rng.range(0, Math.PI * 2);
    const speed = randRange(rng, speedRange);
    e.pos = { x: at.x, y: at.y, z: at.z };
    e.vel = { x: Math.cos(angle) * speed + base.x, y: 0, z: Math.sin(angle) * speed + base.z }; // drift with the wreck
    e.yaw = 0;
    e.bank = 0;
    e.ttl = randRange(rng, ttlRange);
  }
}

function burst(world: World, rng: Rng, at: XYZ, count: number, cfg: ParticlesConfig, base: Vel = ZERO): void {
  burstRanged(world, rng, at, count, cfg.speed, cfg.ttl, base);
}

// Short-ranged sparks where a beam laser is currently touching its target: barely leave the
// impact point and fade almost immediately, so continuous beam contact reads as a steady fizz
// rather than a firework. [ROC-LAS-6]
export function spawnBeamSparks(world: World, rng: Rng, at: XYZ, cfg: ParticlesConfig = DEFAULT_PARTICLES): void {
  burstRanged(world, rng, at, randInt(rng, cfg.sparkCount), cfg.sparkSpeed, cfg.sparkTtl);
}

// A single thrust puff left behind a missile: drifts opposite its heading and fades fast.
function exhaust(world: World, rng: Rng, at: XYZ, vel: Vel, cfg: ParticlesConfig): void {
  const e = acquireParticle(world);
  e.kind = 'particle';
  const sp = Math.hypot(vel.x, vel.z) || 1;
  const back = 0.15;
  e.pos = { x: at.x, y: 0, z: at.z };
  e.vel = { x: (-vel.x / sp) * back + rng.range(-0.1, 0.1), y: 0, z: (-vel.z / sp) * back + rng.range(-0.1, 0.1) };
  e.yaw = 0;
  e.bank = 0;
  e.ttl = randRange(rng, cfg.exhaustTtl);
}

export function spawnExplosion(world: World, rng: Rng, at: XYZ, cfg: ParticlesConfig = DEFAULT_PARTICLES, base: Vel = ZERO): void {
  burst(world, rng, at, randInt(rng, cfg.explosionCount), cfg, base);
}

// Break a destroyed ship into its own wireframe: each edge becomes a tumbling shard that drifts
// out from the centre and fades. Lines, alongside the dot burst. [ROC-DMG-6, ROC-VIS-6]
export function spawnFragments(
  world: World,
  rng: Rng,
  segs: FragSeg[],
  at: XYZ,
  yaw: number,
  cfg: ParticlesConfig = DEFAULT_PARTICLES,
  base: Vel = ZERO,
): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // Rotate a local play-plane point by the ship's heading (yaw about the height axis).
  const rot = (x: number, z: number): { x: number; z: number } => ({ x: x * c + z * s, z: -x * s + z * c });

  for (const seg of segs) {
    const a = rot(seg.ax, seg.az);
    const b = rot(seg.bx, seg.bz);
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const half = { x: (b.x - a.x) / 2, z: (b.z - a.z) / 2 };

    // Drift outward from the hull centre (fallback to a random direction for a centred edge).
    let dirx = mid.x;
    let dirz = mid.z;
    const len = Math.hypot(dirx, dirz);
    if (len < 1e-4) {
      const ang = rng.range(0, Math.PI * 2);
      dirx = Math.cos(ang);
      dirz = Math.sin(ang);
    } else {
      dirx /= len;
      dirz /= len;
    }
    const speed = randRange(rng, cfg.fragSpeed);
    const spin = randRange(rng, cfg.fragSpin) * (rng.int(2) === 0 ? -1 : 1);
    const ttl = randRange(rng, cfg.fragTtl);

    const id = world.nextId++;
    world.entities.set(id, {
      id,
      kind: 'fragment',
      pos: { x: at.x + mid.x, y: 0, z: at.z + mid.z },
      vel: { x: dirx * speed + base.x, y: 0, z: dirz * speed + base.z },
      yaw: 0,
      bank: 0,
      seg: { x: half.x, z: half.z },
      spin,
      ttl,
      ttlMax: ttl,
    });
  }
}

export function particlesSystem(
  world: World,
  rng: Rng,
  dt: number,
  cfg: ParticlesConfig = DEFAULT_PARTICLES,
  fragGeom?: FragGeom,
): void {
  // Spawn from this step's damage events.
  for (const ev of world.events) {
    if (ev.type === 'destroyed') {
      const base = (ev.vel as Vel) ?? ZERO;
      burst(world, rng, ev.pos as XYZ, randInt(rng, cfg.explosionCount), cfg, base);
      let segs = fragGeom && typeof ev.meshId === 'string' ? fragGeom[ev.meshId] : undefined;
      // Scale the wireframe shards to the entity's drawn size (bosses shatter big). [ROC-FDL-1]
      const s = typeof ev.scale === 'number' ? ev.scale : 1;
      if (segs && s !== 1) segs = segs.map((g) => ({ ax: g.ax * s, az: g.az * s, bx: g.bx * s, bz: g.bz * s }));
      if (segs && segs.length) spawnFragments(world, rng, segs, ev.pos as XYZ, (ev.yaw as number) ?? 0, cfg, base);
    } else if (ev.type === 'fragments') {
      burst(world, rng, ev.pos as XYZ, randInt(rng, cfg.fragmentCount), cfg, (ev.vel as Vel) ?? ZERO);
    } else if (ev.type === 'exhaust') {
      exhaust(world, rng, ev.pos as XYZ, (ev.vel as Vel) ?? ZERO, cfg);
    } else if (ev.type === 'ecmDetonate') {
      // A missile popped harmlessly by the boss ECM: a small puff, no damage. [ROC-BECM-1]
      burst(world, rng, ev.pos as XYZ, randInt(rng, cfg.fragmentCount), cfg);
    } else if (ev.type === 'beamHit') {
      spawnBeamSparks(world, rng, ev.pos as XYZ, cfg);
    }
  }

  // Integrate and recycle expired particles.
  for (const e of [...world.entities.values()]) {
    if (e.kind === 'particle') {
      e.pos.x += e.vel.x * dt;
      e.pos.y += e.vel.y * dt;
      e.pos.z += e.vel.z * dt;
      e.ttl = (e.ttl ?? 0) - dt;
      if (e.ttl <= 0) recycleParticle(world, e);
    } else if (e.kind === 'fragment') {
      e.pos.x += e.vel.x * dt;
      e.pos.z += e.vel.z * dt;
      if (e.seg && e.spin) {
        const c = Math.cos(e.spin * dt);
        const s = Math.sin(e.spin * dt);
        const { x, z } = e.seg;
        e.seg = { x: x * c - z * s, z: x * s + z * c }; // tumble the shard
      }
      e.ttl = (e.ttl ?? 0) - dt;
      if (e.ttl <= 0) world.entities.delete(e.id);
    } else if (e.kind === 'cargo') {
      // Jettisoned cargo canisters drift out of the wreck and fade over their lifetime. [ROC-CARGO-6]
      e.pos.x += e.vel.x * dt;
      e.pos.z += e.vel.z * dt;
      e.ttl = (e.ttl ?? 0) - dt;
      if (e.ttl <= 0) world.entities.delete(e.id);
    }
  }
}
