// Player survival FSM: contact (ramming) damage, post-hit/respawn invulnerability, and what
// happens when the player's hull is gone — an escape pod respawns at the death point (consuming
// the pod and the cargo), otherwise a life is spent and the level restarts; at zero lives the
// game is over. Bullet damage to the player is applied in damageSystem; this resolves the
// consequences. [tasks T6.4, ROC-LIFE-1..5]

import { PLAYER_ID, type World } from '../world.js';
import { applyDamage } from './damage.js';

export const MAX_LIVES = 5; // [ROC-LIFE-5]

export interface GamestateConfig {
  contactDamage: number; // hull/shield the player loses when rammed
  ramDamage: number; // hull/shield the rammed ship loses — enough to wreck a fighter, chip a boss
  contactInvuln: number; // brief i-frames after a contact so a touch costs one ring, not the lot
  respawnInvuln: number; // i-frames granted on respawn / level restart
  colliderScale: number; // matches the rendered hull size (SHIP_SCALE)
}

export const DEFAULT_GAMESTATE: GamestateConfig = {
  contactDamage: 1,
  ramDamage: 4,
  contactInvuln: 0.6,
  respawnInvuln: 1.5,
  colliderScale: 1,
};

const radius = (rx: number | undefined, rz: number | undefined, scale: number): number =>
  Math.max(rx ?? 0.3, rz ?? 0.3) * scale;

// Restore the player to full and grant a window of invulnerability at `x,z`.
function respawnPlayer(world: World, x: number, z: number, invuln: number): void {
  const p = world.entities.get(PLAYER_ID);
  if (!p) return;
  p.hull = p.hullMax ?? p.hull ?? 1;
  p.shield = p.shieldMax ?? 0;
  p.flashTtl = 0;
  p.shieldFlashTtl = 0;
  p.pos = { x, y: 0, z };
  p.vel = { x: 0, y: 0, z: 0 };
  p.bank = 0;
  world.player.invulnTtl = invuln;
}

// restartLevel clears the current combat and re-runs the level's opening (waves/bosses). It is
// supplied by the sim, which holds the level definition + wave context.
export function gamestateSystem(
  world: World,
  dt: number,
  restartLevel?: () => void,
  cfg: GamestateConfig = DEFAULT_GAMESTATE,
): void {
  if (world.mode === 'GAME_OVER') return;

  if (world.player.invulnTtl > 0) world.player.invulnTtl = Math.max(0, world.player.invulnTtl - dt);

  const player = world.entities.get(PLAYER_ID);
  if (!player) return;

  // Ramming: an enemy/boss overlapping the player costs a hit, then a short i-frame window so a
  // sustained overlap drains one ring per window rather than every step. [ROC-DMG-6a]
  if (world.player.invulnTtl <= 0 && (player.hull ?? 0) > 0) {
    const pr = radius(player.colliderRx, player.colliderRz, cfg.colliderScale);
    for (const e of world.entities.values()) {
      if (e.kind !== 'enemy' && e.kind !== 'boss') continue;
      const er = radius(e.colliderRx, e.colliderRz, cfg.colliderScale);
      const dx = e.pos.x - player.pos.x;
      const dz = e.pos.z - player.pos.z;
      if (dx * dx + dz * dz <= (pr + er) * (pr + er)) {
        applyDamage(world, e, cfg.ramDamage); // the ram wrecks a fighter, dents a boss
        applyDamage(world, player, cfg.contactDamage);
        world.player.invulnTtl = cfg.contactInvuln;
        break;
      }
    }
  }

  // Death resolution: applyDamage left the dead player in place (no bounty, no delete). [T6.4]
  if ((player.hull ?? 0) <= 0) {
    const dx = player.pos.x;
    const dz = player.pos.z;

    if (world.player.escapePod) {
      world.player.escapePod = false; // consumed
      world.cargo = {}; // pod jettisons the hold [ROC-LIFE-2]
      respawnPlayer(world, dx, dz, cfg.respawnInvuln);
      world.events.push({ type: 'escapePod' });
      return;
    }

    world.player.lives = Math.max(0, Math.min(MAX_LIVES, world.player.lives) - 1);
    if (world.player.lives <= 0) {
      world.mode = 'GAME_OVER';
      world.events.push({ type: 'gameOver' });
      return;
    }

    world.events.push({ type: 'lifeLost', lives: world.player.lives });
    respawnPlayer(world, 0, 0, cfg.respawnInvuln);
    restartLevel?.();
  }
}
