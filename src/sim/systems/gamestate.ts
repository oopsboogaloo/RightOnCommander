// Player survival FSM: contact (ramming) damage, post-hit/respawn invulnerability, and what
// happens when the player's hull would reach zero — an energy bomb auto-triggers to save the
// ship if one is carried, otherwise a life is spent and the ship respawns in place once its
// dramatic, in-place explosion has fully played out (nothing about the level/waves/boss ever
// resets); at zero lives the game is over. Either way the hold is lost: the cargo is jettisoned
// as tumbling canister wreckage. Bullet damage to the player is applied in damageSystem; this
// resolves the consequences. [tasks T6.4, ROC-LIFE-1..5, ROC-CARGO-6, ROC-BOMB-1..4]

import type { Entity } from '../components.js';
import { PLAYER_ID, type World } from '../world.js';
import { applyDamage } from './damage.js';
import { convexPolygonsDistanceSq, type Pt } from '../math/geom2.js';
import { transformSilhouette, hullRadius, shieldGap } from './collision.js';
import { PLAYER_EXPLOSION_PARTICLES } from './particles.js';

export const MAX_LIVES = 5; // [ROC-LIFE-5]

export interface GamestateConfig {
  contactDamage: number; // hull/shield the player loses when rammed
  ramDamage: number; // hull/shield the rammed ship loses — enough to wreck a fighter, chip a boss
  contactInvuln: number; // brief i-frames after a contact so a touch costs one ring, not the lot
  respawnInvuln: number; // i-frames granted on respawn
  respawnDelaySec: number; // extra beat after the explosion fully plays out, before the new ship appears [ROC-LIFE-3]
  bombBossDamageFrac: number; // fraction of a boss's current hull the energy-bomb blast deals [ROC-BOMB-3]
  colliderScale: number; // matches the rendered hull size (SHIP_SCALE)
  getSilhouette?: (meshId: string) => Pt[] | undefined; // local-space hull silhouettes
  getHullRadius?: (meshId: string) => number | undefined; // precomputed hullRadius() per mesh
}

export const DEFAULT_GAMESTATE: GamestateConfig = {
  contactDamage: 1,
  ramDamage: 4,
  contactInvuln: 0.6,
  respawnInvuln: 1.5,
  respawnDelaySec: 0.5,
  bombBossDamageFrac: 0.5,
  colliderScale: 1,
};

// How long the player's dramatic explosion takes to fully play out (the longest-lived particles/
// fragments it spawns), so the respawn timer never cuts it short. [ROC-LIFE-3]
export const PLAYER_EXPLOSION_SEC = Math.max(
  PLAYER_EXPLOSION_PARTICLES.ttl[1],
  PLAYER_EXPLOSION_PARTICLES.fragTtl[1],
);

const radius = (rx: number | undefined, rz: number | undefined, scale: number): number =>
  Math.max(rx ?? 0.3, rz ?? 0.3) * scale;

// Losing the ship jettisons the hold: up to this many cargo canisters burst from the wreck, but
// never more than the ship was carrying. [ROC-CARGO-6]
export const CARGO_WRECK_MAX = 10;
const CARGO_WRECK_SPEED = 0.3;
const CARGO_WRECK_TTL = 1.8;

// Scatter `count` cargo canisters around (x,z) as cosmetic wreckage, inheriting the wreck's drift.
// They are a distinct 'cargo' kind: not collectible and not a collision target (nothing else looks
// at that kind), and — like the hull fragments — they survive a level restart, so the loss always
// reads on screen. Deterministic (even scatter, no rng needed here). [ROC-CARGO-6]
function spawnCargoWreck(world: World, x: number, z: number, count: number, baseVx: number, baseVz: number): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / Math.max(1, count)) * Math.PI * 2 + i * 0.6;
    const id = world.nextId++;
    world.entities.set(id, {
      id,
      kind: 'cargo',
      pos: { x, y: 0, z },
      vel: { x: Math.cos(angle) * CARGO_WRECK_SPEED + baseVx, y: 0, z: Math.sin(angle) * CARGO_WRECK_SPEED + baseVz },
      yaw: 0,
      bank: 0,
      meshId: 'canister',
      ttl: CARGO_WRECK_TTL,
      ttlMax: CARGO_WRECK_TTL,
    });
  }
}

// A ship's world-space silhouette plus its current shield gap, for the ram test. Null when no
// hull mesh is available (falls back to the old bounding-circle test for that side).
function ramGeom(e: Entity, cfg: GamestateConfig): { poly: Pt[]; gap: number } | null {
  const local = e.meshId ? cfg.getSilhouette?.(e.meshId) : undefined;
  if (!local || local.length < 3) return null;
  const scale = cfg.colliderScale * (e.scale ?? 1); // per-entity size multiplier [ROC-FDL-1]
  const scaled = scale === 1 ? local : local.map((p) => ({ x: p.x * scale, y: p.y * scale }));
  const poly = transformSilhouette(scaled, e.pos.x, e.pos.z, e.yaw);
  const r = (cfg.getHullRadius?.(e.meshId!) ?? hullRadius(local, cfg.colliderScale)) * (e.scale ?? 1);
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
  const pr = radius(player.colliderRx, player.colliderRz, cfg.colliderScale) * (player.scale ?? 1);
  const er = radius(e.colliderRx, e.colliderRz, cfg.colliderScale) * (e.scale ?? 1);
  const dx = e.pos.x - player.pos.x;
  const dz = e.pos.z - player.pos.z;
  return dx * dx + dz * dz <= (pr + er) * (pr + er);
}

// Restore the player to full and grant a window of invulnerability at `x,z`. Blinking is reserved
// for this window alone — a ramming contact's i-frames set `invulnTtl` but never `respawnBlinkTtl`
// — so a ship on screen blinking always means "just respawned", never "just took a hit". [ROC-LIFE-2b]
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
  world.player.respawnBlinkTtl = invuln;
}

// Emergency energy bomb: instead of the ship dying, one bomb is spent to clear the board — every
// enemy, asteroid and enemy shot/missile is destroyed outright; a boss merely takes a chunk of
// damage. The shell flashes "Emergency energy bomb deployed" on the energyBombDeployed event.
// [ROC-BOMB-1,3,4]
function detonateEnergyBomb(world: World, cfg: GamestateConfig): void {
  for (const e of [...world.entities.values()]) {
    if (e.kind === 'enemy' || e.kind === 'asteroid') {
      world.entities.delete(e.id);
    } else if ((e.kind === 'projectile' || e.kind === 'missile') && e.team === 'enemy') {
      world.entities.delete(e.id);
    } else if (e.kind === 'boss' && (e.hull ?? 0) > 0) {
      applyDamage(world, e, Math.max(1, Math.round((e.hull ?? 0) * cfg.bombBossDamageFrac)));
    }
  }
  world.events.push({ type: 'energyBombDeployed' });
  world.events.push({ type: 'sfx', id: 'energy_bomb' });
}

export function gamestateSystem(
  world: World,
  dt: number,
  cfg: GamestateConfig = DEFAULT_GAMESTATE,
): void {
  if (world.mode === 'GAME_OVER') return;

  if (world.player.invulnTtl > 0) world.player.invulnTtl = Math.max(0, world.player.invulnTtl - dt);
  if (world.player.respawnBlinkTtl > 0) world.player.respawnBlinkTtl = Math.max(0, world.player.respawnBlinkTtl - dt);

  // The ship is mid-explosion, waiting to respawn: frozen in place (movement/weapons/missiles are
  // gated on this same flag), immune to further hits, no ram checks, nothing re-triggers. [ROC-LIFE-3]
  if (world.player.respawnPending) {
    const pending = world.player.respawnPending;
    pending.timer -= dt;
    if (pending.timer <= 0) {
      world.player.respawnPending = null;
      if (world.player.lives <= 0) {
        world.mode = 'GAME_OVER';
        world.events.push({ type: 'gameOver' });
      } else {
        respawnPlayer(world, pending.x, pending.z, cfg.respawnInvuln);
      }
    }
    return;
  }

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

    // The energy bomb auto-triggers instead of letting the ship die. [ROC-BOMB-1]
    if (world.player.energyBombs > 0) {
      world.player.energyBombs -= 1;
      player.hull = 1; // bare survival — the next hit can still kill
      detonateEnergyBomb(world, cfg);
      return;
    }

    // Jettison the hold as canister wreckage (up to 10, never more than it carried), then the
    // cargo is gone — however the ship dies. [ROC-CARGO-6]
    const tons = Object.values(world.cargo).reduce((n, t) => n + t, 0);
    spawnCargoWreck(world, dx, dz, Math.min(CARGO_WRECK_MAX, tons), player.vel.x, player.vel.z);
    world.cargo = {};

    world.player.lives = Math.max(0, world.player.lives - 1); // buyLife enforces MAX_LIVES; a cheat grant may run higher
    world.events.push({ type: 'lifeLost', lives: world.player.lives });

    // The dramatic, in-place explosion (already triggered by damageSystem's 'destroyed' event)
    // needs to fully play out, then a beat, before the new ship appears — nothing about the
    // level/waves/boss resets; it all just continues while the wreck sits inert. [ROC-LIFE-2,3]
    world.player.respawnPending = { x: dx, z: dz, timer: PLAYER_EXPLOSION_SEC + cfg.respawnDelaySec };
  }
}
