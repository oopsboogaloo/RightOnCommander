// Enemy AI: fire comparatively slow, dodgeable projectiles (aimed at the player, or straight
// down) on a per-enemy cadence. Slow speed is what makes them persist and enable bullet-hell
// dodging, distinct from the player's fast lasers. [tasks T4.3, design §9, ROC-ENM-11]

import { type Vec3, vec3, normalize, scale } from '../math/vec3.js';
import { PLAYER_ID, type World } from '../world.js';
import { acquireProjectile } from './weapons.js';

export interface AiConfig {
  shotSpeed: number; // world units / second (slow, < player pulse speed)
  shotTtl: number; // seconds
  shotDamage: number;
}

export const DEFAULT_AI: AiConfig = {
  shotSpeed: 2,
  shotTtl: 3,
  shotDamage: 1,
};

interface AiState {
  rate: number; // shots per second
  aimed: boolean;
  cooldown: number; // seconds until next shot
}

function fireShot(world: World, ex: number, ez: number, aimed: boolean, cfg: AiConfig): void {
  let dir: Vec3 = vec3(0, 0, -1); // straight down-screen by default
  if (aimed) {
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
  p.vel = scale(dir, cfg.shotSpeed);
  p.yaw = 0;
  p.bank = 0;
  p.ttl = cfg.shotTtl;
  p.damage = cfg.shotDamage;
}

export function aiSystem(world: World, dt: number, cfg: AiConfig = DEFAULT_AI): void {
  for (const e of [...world.entities.values()]) {
    if ((e.kind !== 'enemy' && e.kind !== 'boss') || !e.ai) continue;
    const ai = e.ai as AiState;
    if (ai.rate <= 0) continue;

    ai.cooldown -= dt;
    if (ai.cooldown <= 0) {
      fireShot(world, e.pos.x, e.pos.z, ai.aimed, cfg);
      ai.cooldown = 1 / ai.rate;
    }
  }
}
