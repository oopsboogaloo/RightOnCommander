// Damage & shields. Applies collision hits: a shield ring absorbs the hit and flashes the
// shield (no hull damage), otherwise the hull takes damage, flashes white, sheds fragments, and
// is destroyed at hull <= 0. The flash rule is centralised here so every damageable entity —
// player, enemy, boss, hazard — behaves identically. [tasks T3.2, design §8, ROC-DMG-2,3,6,6a,7]

import type { Entity } from '../components.js';
import type { World } from '../world.js';
import type { CollisionHit } from './collision.js';
import { DEFAULT_MISSILES } from './missiles.js';
import { portDamageMultiplier } from './dock.js';

export interface DamageConfig {
  flashDuration: number; // white hull-damage flash [ROC-DMG-6]
  shieldFlashDuration: number; // shield-absorb flash [ROC-DMG-2]
  heavyDamageFraction: number; // hull fraction below which smoke/fire shows [ROC-DMG-7]
}

export const DEFAULT_DAMAGE: DamageConfig = {
  flashDuration: 0.12,
  shieldFlashDuration: 0.12,
  heavyDamageFraction: 0.34,
};

// Decay the flash timers each step.
export function tickFlashes(world: World, dt: number): void {
  for (const e of world.entities.values()) {
    if (e.flashTtl) e.flashTtl = Math.max(0, e.flashTtl - dt);
    if (e.shieldFlashTtl) e.shieldFlashTtl = Math.max(0, e.shieldFlashTtl - dt);
  }
}

// Apply one hit's worth of damage to an entity. Shield rings deplete fully before any hull
// damage, so a shielded hit never touches the hull (and flashes the shield, not the hull).
export function applyDamage(
  world: World,
  e: Entity,
  damage: number,
  cfg: DamageConfig = DEFAULT_DAMAGE,
): void {
  if (e.indestructible) return; // a giant asteroid: the hit is absorbed, nothing happens [ROC-GIANT-1]

  if ((e.shield ?? 0) > 0) {
    e.shield = (e.shield ?? 0) - 1; // remove one ring [ROC-DMG-2, ROC-DMG-5]
    e.shieldFlashTtl = cfg.shieldFlashDuration; // flash shield, not hull
    // The player also flashes white on a shield-absorbed hit, same as any other hit — hull damage
    // isn't the only thing that reads on screen. [ROC-DMG-2a]
    if (e.kind === 'player') e.flashTtl = cfg.flashDuration;
    world.events.push({ type: 'sfx', id: 'shield_hit' });
    return;
  }

  // The player has no hull hit-point buffer: once shields are down, any further hit is instantly
  // lethal. Every other entity keeps graduated hull damage. [ROC-DMG-2a, ROC-LIFE-1]
  e.hull = e.kind === 'player' ? 0 : (e.hull ?? 0) - damage;
  e.flashTtl = cfg.flashDuration; // white flash applies to ANY hull hit [ROC-DMG-6a]
  world.events.push({ type: 'fragments', pos: { ...e.pos }, vel: { ...e.vel }, meshId: e.meshId });

  if ((e.hull ?? 0) <= 0) {
    // No bounty/drops for the player; gamestate resolves the life/respawn and keeps the entity
    // (we reuse it on respawn), so only non-player wrecks are deleted here. [T6.4, ROC-LIFE-*]
    const isPlayer = e.kind === 'player';
    world.events.push({
      type: 'destroyed',
      id: e.id,
      kind: e.kind,
      pos: { ...e.pos },
      vel: { ...e.vel }, // wrecks inherit the ship's motion [ROC-VIS-6]
      yaw: e.yaw,
      meshId: e.meshId, // lets the renderer/particles break the ship into its wireframe [ROC-DMG-6]
      scale: e.scale, // so a big boss shatters at its drawn size [ROC-FDL-1]
      bounty: isPlayer ? 0 : e.bounty ?? 0,
      drops: isPlayer ? undefined : e.drops,
      cargoDrops: isPlayer ? undefined : e.cargoDrops, // boss cargo haul [ROC-HERM-10, ROC-FDL-5]
    });
    world.events.push({ type: 'sfx', id: isPlayer ? 'explode_player' : 'explode_small' });
    if (!isPlayer) world.entities.delete(e.id);
    return;
  }

  if (e.hullMax && e.hull / e.hullMax <= cfg.heavyDamageFraction) {
    e.heavyDamage = true; // persistent smoke/fire [ROC-DMG-7]
  }
}

// Resolve this step's collision hits, then recycle the spent projectiles.
export function damageSystem(
  world: World,
  hits: CollisionHit[],
  dt: number,
  cfg: DamageConfig = DEFAULT_DAMAGE,
): void {
  tickFlashes(world, dt);

  const spent = new Set<number>();
  for (const hit of hits) {
    const target = world.entities.get(hit.target);
    if (!target) continue; // already destroyed earlier this step
    const proj = world.entities.get(hit.projectile);
    if (!proj || spent.has(hit.projectile)) continue; // projectile already consumed

    // An invulnerable (just-spawned), already-dead, or mid-explosion player soaks the shot
    // harmlessly — a wreck waiting to respawn can't take further hits or re-trigger death. [T6.4]
    const playerImmune =
      target.kind === 'player' &&
      (world.mode === 'GAME_OVER' || world.player.invulnTtl > 0 || !!world.player.respawnPending);
    // A direct hit on a docking port (the hermit's weak spot) deals triple damage; the shot's
    // path from its impact point decides "direct". [ROC-HERM-8]
    const mult = portDamageMultiplier(target, proj.pos.x, proj.pos.z, proj.vel.x, proj.vel.z);
    if (!playerImmune) applyDamage(world, target, (proj.damage ?? 1) * mult, cfg);

    world.entities.delete(proj.id);
    if (proj.kind === 'projectile') world.pool.projectiles.push(proj); // recycle pulses (no leak)
    else if (proj.kind === 'missile') {
      world.pool.missiles.push(proj);
      // A missile that lands is a dead missile too — same brief pause before the next launch as
      // one that times out, so a freed cap slot doesn't refill instantly. [ROC-MIS-8 tuning]
      world.player.missileCooldown = Math.max(world.player.missileCooldown, DEFAULT_MISSILES.deathCooldown);
    }
    spent.add(proj.id);
  }
}
