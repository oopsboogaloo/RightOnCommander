// Enemy AI: fire comparatively slow, dodgeable projectiles (aimed at the player, or straight
// down) on a per-enemy cadence. Slow speed is what makes them persist and enable bullet-hell
// dodging, distinct from the player's fast lasers. [tasks T4.3, design §9, ROC-ENM-11]

import { type Vec3, vec3, normalize, scale } from '../math/vec3.js';
import type { Rng } from '../rng.js';
import { PLAYER_ID, type World } from '../world.js';
import { acquireProjectile } from './weapons.js';

export interface AiConfig {
  shotSpeed: number; // world units / second (slow, < player pulse speed)
  shotTtl: number; // seconds
  shotDamage: number;
}

export const DEFAULT_AI: AiConfig = {
  shotSpeed: 1.2, // 60% of previous [tuning]
  shotTtl: 3,
  shotDamage: 1,
};

interface AiState {
  rate: number; // shots per second
  aimed: boolean;
  cooldown: number; // seconds until next shot
  speedMul?: number; // per-enemy shot-speed multiplier (e.g. the Cougar's faster bolts) [ROC-CLK-7]
  spread?: number; // shots per volley, fanned evenly across `arc` (default 1) [ROC-ENM-11]
  arc?: number; // total fan width, radians
}

// Spawn one enemy bolt from (ex, ez) along a heading (radians: 0 = up-screen +z, PI = straight
// down). Shared by ordinary enemy fire and the boss bullet patterns. [ROC-ENM-11]
export function fireEnemyBolt(world: World, ex: number, ez: number, heading: number, cfg: AiConfig = DEFAULT_AI, speedMul = 1): void {
  const p = acquireProjectile(world);
  p.kind = 'projectile';
  p.team = 'enemy';
  p.pos = vec3(ex, 0, ez);
  p.vel = scale(vec3(Math.sin(heading), 0, Math.cos(heading)), cfg.shotSpeed * speedMul);
  p.yaw = 0;
  p.bank = 0;
  p.ttl = cfg.shotTtl;
  p.damage = cfg.shotDamage;
}

// Heading (see fireEnemyBolt) from (ex, ez) toward the player, or straight down if there is none.
export function headingToPlayer(world: World, ex: number, ez: number): number {
  const player = world.entities.get(PLAYER_ID);
  if (!player) return Math.PI;
  const dx = player.pos.x - ex;
  const dz = player.pos.z - ez;
  return dx === 0 && dz === 0 ? Math.PI : Math.atan2(dx, dz);
}

// A volley: `spread` bolts fanned evenly across `arc`, centred on the aim. [ROC-ENM-11]
function fireVolley(world: World, rng: Rng, ex: number, ez: number, ai: AiState, cfg: AiConfig): void {
  const n = Math.max(1, Math.round(ai.spread ?? 1));
  if (n === 1) {
    fireShot(world, rng, ex, ez, ai.aimed, cfg, ai.speedMul);
    return;
  }
  // Cloaked player: no lock, so the whole fan sprays from a random centre. [ROC-CLK-4,8]
  const centre = world.player.cloakTtl > 0 ? rng.range(0, Math.PI * 2) : ai.aimed ? headingToPlayer(world, ex, ez) : Math.PI;
  const arc = ai.arc ?? 0.6;
  for (let i = 0; i < n; i++) {
    fireEnemyBolt(world, ex, ez, centre - arc / 2 + (arc * i) / (n - 1), cfg, ai.speedMul ?? 1);
  }
}

function fireShot(world: World, rng: Rng, ex: number, ez: number, aimed: boolean, cfg: AiConfig, speedMul = 1): void {
  let dir: Vec3 = vec3(0, 0, -1); // straight down-screen by default
  if (world.player.cloakTtl > 0) {
    // Can't be targeted while the player is cloaked — every enemy (aimed or not) sprays a random
    // heading instead. [ROC-CLK-4,8]
    const a = rng.range(0, Math.PI * 2);
    dir = vec3(Math.sin(a), 0, Math.cos(a));
  } else if (aimed) {
    const player = world.entities.get(PLAYER_ID);
    if (player) {
      const aim = normalize(vec3(player.pos.x - ex, 0, player.pos.z - ez));
      if (aim.x !== 0 || aim.z !== 0) dir = aim;
    }
  }
  const p = acquireProjectile(world);
  p.kind = 'projectile';
  p.team = 'enemy';
  p.pos = vec3(ex, 0, ez);
  p.vel = scale(dir, cfg.shotSpeed * speedMul);
  p.yaw = 0;
  p.bank = 0;
  p.ttl = cfg.shotTtl;
  p.damage = cfg.shotDamage;
}

export function aiSystem(world: World, rng: Rng, dt: number, cfg: AiConfig = DEFAULT_AI): void {
  for (const e of [...world.entities.values()]) {
    if ((e.kind !== 'enemy' && e.kind !== 'boss') || !e.ai || e.dying) continue;
    const ai = e.ai as AiState;
    if (ai.rate <= 0) continue;

    ai.cooldown -= dt;
    if (ai.cooldown <= 0) {
      fireVolley(world, rng, e.pos.x, e.pos.z, ai, cfg);
      ai.cooldown = 1 / ai.rate;
    }
  }
}
