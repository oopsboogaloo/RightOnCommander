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
}

export const DEFAULT_PARTICLES: ParticlesConfig = {
  explosionCount: [10, 16],
  fragmentCount: [2, 4],
  speed: [0.4, 1.6],
  ttl: [0.4, 1.0],
};

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

function burst(world: World, rng: Rng, at: XYZ, count: number, cfg: ParticlesConfig): void {
  for (let i = 0; i < count; i++) {
    const e = acquireParticle(world);
    e.kind = 'particle';
    const angle = rng.range(0, Math.PI * 2);
    const speed = randRange(rng, cfg.speed);
    e.pos = { x: at.x, y: at.y, z: at.z };
    e.vel = { x: Math.cos(angle) * speed, y: 0, z: Math.sin(angle) * speed };
    e.yaw = 0;
    e.bank = 0;
    e.ttl = randRange(rng, cfg.ttl);
  }
}

export function spawnExplosion(world: World, rng: Rng, at: XYZ, cfg: ParticlesConfig = DEFAULT_PARTICLES): void {
  burst(world, rng, at, randInt(rng, cfg.explosionCount), cfg);
}

export function particlesSystem(world: World, rng: Rng, dt: number, cfg: ParticlesConfig = DEFAULT_PARTICLES): void {
  // Spawn from this step's damage events.
  for (const ev of world.events) {
    if (ev.type === 'destroyed') burst(world, rng, ev.pos as XYZ, randInt(rng, cfg.explosionCount), cfg);
    else if (ev.type === 'fragments') burst(world, rng, ev.pos as XYZ, randInt(rng, cfg.fragmentCount), cfg);
  }

  // Integrate and recycle expired particles.
  for (const e of [...world.entities.values()]) {
    if (e.kind !== 'particle') continue;
    e.pos.x += e.vel.x * dt;
    e.pos.y += e.vel.y * dt;
    e.pos.z += e.vel.z * dt;
    e.ttl = (e.ttl ?? 0) - dt;
    if (e.ttl <= 0) recycleParticle(world, e);
  }
}
