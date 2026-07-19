// Pickups: collect fuel/gems to restore shields (surplus banked as sellable cargo), alloys to
// repair hull, and weapon/utility power-ups (laser/missile/ECM/bomb) fitted in flight. Shooting
// a pickup destroys it (fuel explodes with no splash; gems/alloys shatter). [tasks T5.3,
// design §6 step 10, ROC-PWR-1..6, ROC-ECO-3]

import { type Vec3 } from '../math/vec3.js';
import type { Entity } from '../components.js';
import { PLAYER_ID, type World } from '../world.js';
import { collectMissile } from './missiles.js';
import { CLOAK_PICKUP_SEC } from './cloak.js';
import { energyBombCap, bestPickupSlot, type LaserType } from './ships.js';

export interface PickupsConfig {
  scoopMargin: number; // reach beyond the ship's own hull edge — a slight magnet, not a free-floating radius
  fallbackHullRadius: number; // world-scale hull radius used when no mesh lookup is available
  getHullRadius?: (meshId: string) => number | undefined; // precomputed hullRadius() per mesh
  // (already scaled — same values collisionSystem/gamestateSystem use for shield-ring/ram sizing)
  shieldPerPickup: number; // shield rings restored by fuel/gems
  hullPerAlloy: number; // hull repaired by alloys
  driftSpeed: number; // pickups drift down-screen toward the player
}

export const DEFAULT_PICKUPS: PickupsConfig = {
  scoopMargin: 0.12,
  fallbackHullRadius: 0.1, // roughly a Sidewinder's own hull radius
  shieldPerPickup: 1,
  hullPerAlloy: 4,
  driftSpeed: 0.5,
};

// The scoop's actual reach: the player's own hull radius (so a bigger ship scoops a bit wider,
// matching its sprite) plus a small fixed margin — not the old flat 0.35, which was 2-4x any
// ship's actual hull radius and made pickups feel like they were being sucked in from off the
// hull entirely. [DEFECTS: pickup collision too generous]
function scoopRadius(player: Entity, cfg: PickupsConfig): number {
  const precomputed = player.meshId ? cfg.getHullRadius?.(player.meshId) : undefined;
  const hull = (precomputed ?? cfg.fallbackHullRadius) * (player.scale ?? 1);
  return hull + cfg.scoopMargin;
}

const dist2 = (a: Vec3, b: Vec3): number => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function removePickup(world: World, e: Entity): void {
  world.entities.delete(e.id);
}

// A giant (indestructible) asteroid crushes any collectable — cargo included — that drifts into
// it, just like it wrecks a ship. A cheap circle test against the entity's own approximate
// radius is enough here (unlike ship/bullet collision, this doesn't need the precise silhouette).
// [ROC-GIANT-1]
function crushedByGiantAsteroid(world: World, e: Entity): boolean {
  for (const g of world.entities.values()) {
    if (g.kind !== 'asteroid' || !g.indestructible) continue;
    const r = Math.max(g.colliderRx ?? 0.5, g.colliderRz ?? 0.5);
    if (dist2(e.pos, g.pos) <= r * r) return true;
  }
  return false;
}

function bankCargo(world: World, name: string, tons: number, pos: Vec3): void {
  world.cargo[name] = (world.cargo[name] ?? 0) + tons;
  world.events.push({ type: 'floatingText', category: 'cargo', text: `${cap(name)} ${tons}T`, pos: { ...pos } }); // [ROC-ECO-3]
}

// Levels 2/3 (a beam laser is the level-appropriate power-up) drop a beam; Level 1 drops a pulse.
// [ROC-PWR-6 tuning]
const pickupLaserType = (world: World): LaserType => (world.levelIndex >= 1 ? 'beam' : 'pulse');

function fitLaser(world: World, pos: Vec3): void {
  const type = pickupLaserType(world);
  const slot = bestPickupSlot(world, type);
  if (!slot) {
    bankCargo(world, 'laser', 1, pos); // nothing left to improve -> sellable
    return;
  }
  if (slot.index === undefined) world.player.lasers[slot.dir].push(type);
  else world.player.lasers[slot.dir][slot.index] = type; // upgrades a weaker laser in place
  const label = type === 'pulse' ? 'Laser' : `${cap(type)} Laser`;
  world.events.push({ type: 'floatingText', category: 'fit', text: label, pos: { ...pos } });
}

function collect(world: World, pickup: Entity, player: Entity, cfg: PickupsConfig): void {
  const type = pickup.pickup!.type;
  const pos = pickup.pos;
  switch (type) {
    case 'fuel':
    case 'gems': {
      if ((player.shield ?? 0) < (player.shieldMax ?? 0)) {
        player.shield = Math.min(player.shieldMax ?? 0, (player.shield ?? 0) + cfg.shieldPerPickup); // [ROC-PWR-1,3]
        world.events.push({ type: 'sfx', id: 'pickup' });
      } else {
        bankCargo(world, type, 1, pos); // shield full -> bank as cargo
      }
      break;
    }
    case 'alloys':
      player.hull = Math.min(player.hullMax ?? 0, (player.hull ?? 0) + cfg.hullPerAlloy); // [ROC-PWR-4]
      world.events.push({ type: 'sfx', id: 'pickup' });
      break;
    case 'laser':
      fitLaser(world, pos); // [ROC-PWR-5,6]
      break;
    case 'missile':
      collectMissile(world);
      break;
    case 'ecm':
      world.player.ecm += 1;
      break;
    case 'bomb':
      world.player.energyBombs = Math.min(energyBombCap(world.player.shipClass), world.player.energyBombs + 1);
      break;
    case 'life':
      world.player.lives = Math.min(5, world.player.lives + 1);
      break;
    case 'cloak':
      world.player.cloakTtl = CLOAK_PICKUP_SEC; // [ROC-CLK-4]
      world.events.push({ type: 'sfx', id: 'pickup' });
      break;
    case 'cargo':
      bankCargo(world, pickup.pickup!.commodity ?? 'Cargo', 1, pos); // display the type [ROC-CARGO-3]
      break;
  }
  removePickup(world, pickup);
}

export function pickupsSystem(world: World, dt: number, cfg: PickupsConfig = DEFAULT_PICKUPS): void {
  const player = world.entities.get(PLAYER_ID);

  for (const e of [...world.entities.values()]) {
    if (e.kind !== 'pickup' || !e.pickup) continue;

    e.pos.z -= cfg.driftSpeed * dt; // drift toward the player
    e.ttl = (e.ttl ?? 0) - dt;
    if (e.ttl <= 0) {
      removePickup(world, e);
      continue;
    }

    if (crushedByGiantAsteroid(world, e)) {
      removePickup(world, e);
      continue;
    }

    // Collectables are inert to weapons fire — bullets and missiles pass straight through. Only
    // the player scoop collects them. [ROC-PWR-2a, ROC-CARGO-2]
    if (player) {
      const r = scoopRadius(player, cfg);
      if (dist2(player.pos, e.pos) <= r * r) collect(world, e, player, cfg);
    }
  }
}
