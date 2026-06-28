// Damage & shields. Applies collision hits: a shield ring absorbs the hit and flashes the
// shield (no hull damage), otherwise the hull takes damage, flashes white, sheds fragments, and
// is destroyed at hull <= 0. The flash rule is centralised here so every damageable entity —
// player, enemy, boss, hazard — behaves identically. [tasks T3.2, design §8, ROC-DMG-2,3,6,6a,7]

import type { Entity } from '../components.js';
import type { World } from '../world.js';
import type { CollisionHit } from './collision.js';

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
  if ((e.shield ?? 0) > 0) {
    e.shield = (e.shield ?? 0) - 1; // remove one ring [ROC-DMG-2, ROC-DMG-5]
    e.shieldFlashTtl = cfg.shieldFlashDuration; // flash shield, not hull
    world.events.push({ type: 'sfx', id: 'shield_hit' });
    return;
  }

  e.hull = (e.hull ?? 0) - damage; // unshielded: hull damage [ROC-DMG-6]
  e.flashTtl = cfg.flashDuration; // white flash applies to ANY hull hit [ROC-DMG-6a]
  world.events.push({ type: 'fragments', pos: { ...e.pos }, meshId: e.meshId });

  if ((e.hull ?? 0) <= 0) {
    world.events.push({ type: 'destroyed', id: e.id, kind: e.kind, pos: { ...e.pos }, bounty: e.bounty ?? 0, drops: e.drops });
    world.events.push({ type: 'sfx', id: 'explode_small' });
    world.entities.delete(e.id);
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

    applyDamage(world, target, proj.damage ?? 1, cfg);

    world.entities.delete(proj.id);
    if (proj.kind === 'projectile') world.pool.projectiles.push(proj); // recycle pulses (no leak)
    else if (proj.kind === 'missile') world.pool.missiles.push(proj);
    spent.add(proj.id);
  }
}
