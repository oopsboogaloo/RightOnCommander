// Player survival FSM: contact (ramming) damage, post-hit/respawn invulnerability, and what
// happens when the player's hull is gone — an escape pod respawns at the death point (consuming
// the pod and the cargo), otherwise a life is spent and the level restarts; at zero lives the
// game is over. Bullet damage to the player is applied in damageSystem; this resolves the
// consequences. [tasks T6.4, ROC-LIFE-1..5]

import type { Entity } from '../components.js';
import { PLAYER_ID, type World } from '../world.js';
import { applyDamage } from './damage.js';
import { convexPolygonsDistanceSq, type Pt } from '../math/geom2.js';
import { transformSilhouette, hullRadius, shieldGap } from './collision.js';

export const MAX_LIVES = 5; // [ROC-LIFE-5]

export interface GamestateConfig {
  contactDamage: number; // hull/shield the player loses when rammed
  ramDamage: number; // hull/shield the rammed ship loses — enough to wreck a fighter, chip a boss
  contactInvuln: number; // brief i-frames after a contact so a touch costs one ring, not the lot
  respawnInvuln: number; // i-frames granted on respawn / level restart
  colliderScale: number; // matches the rendered hull size (SHIP_SCALE)
  getSilhouette?: (meshId: string) => Pt[] | undefined; // local-space hull silhouettes
  getHullRadius?: (meshId: string) => number | undefined; // precomputed hullRadius() per mesh
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

// A ship's world-space silhouette plus its current shield gap, for the ram test. Null when no
// hull mesh is available (falls back to the old bounding-circle test for that side).
function ramGeom(e: Entity, cfg: GamestateConfig): { poly: Pt[]; gap: number } | null {
  const local = e.meshId ? cfg.getSilhouette?.(e.meshId) : undefined;
  if (!local || local.length < 3) return null;
  const scale = cfg.colliderScale;
  const scaled = scale === 1 ? local : local.map((p) => ({ x: p.x * scale, y: p.y * scale }));
  const poly = transformSilhouette(scaled, e.pos.x, e.pos.z, e.yaw);
  const r = cfg.getHullRadius?.(e.meshId!) ?? hullRadius(local, scale);
  return { poly, gap: shieldGap(r, e.shield ?? 0) };
}

// True once the player and a would-be rammer are within contact distance: hull silhouette vs
// hull silhouette (each dilated by its own shield gap) when meshes are available, so a ram lands
// exactly where the drawn hulls (and shield rings) touch — not a fat bounding circle. [ROC-DMG-6a]
function rams(player: Entity, e: Entity, cfg: GamestateConfig): boolean {
  const pg = ramGeom(player, cfg);
  const eg = ramGeom(e, cfg);
  if (pg && eg) {
    const threshold = pg.gap + eg.gap;
    return convexPolygonsDistanceSq(pg.poly, eg.poly) <= threshold * threshold;
  }
  const pr = radius(player.colliderRx, player.colliderRz, cfg.colliderScale);
  const er = radius(e.colliderRx, e.colliderRz, cfg.colliderScale);
  const dx = e.pos.x - player.pos.x;
  const dz = e.pos.z - player.pos.z;
  return dx * dx + dz * dz <= (pr + er) * (pr + er);
}

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

  // Ramming: an enemy/boss/asteroid overlapping the player costs a hit, then a short i-frame
  // window so a sustained overlap drains one ring per window rather than every step. Asteroids
  // are solid obstacles too — flying into one costs a hit just like ramming a ship. [ROC-DMG-6a,
  // ROC-L1-1]
  if (world.player.invulnTtl <= 0 && (player.hull ?? 0) > 0) {
    for (const e of world.entities.values()) {
      if (e.kind !== 'enemy' && e.kind !== 'boss' && e.kind !== 'asteroid') continue;
      if (rams(player, e, cfg)) {
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
