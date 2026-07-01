// Pickups: collect fuel/gems to restore shields (surplus banked as sellable cargo), alloys to
// repair hull, and weapon/utility power-ups (laser/missile/ECM/bomb) fitted in flight. Shooting
// a pickup destroys it (fuel explodes with no splash; gems/alloys shatter). [tasks T5.3,
// design §6 step 10, ROC-PWR-1..6, ROC-ECO-3]

import { type Vec3 } from '../math/vec3.js';
import type { Entity } from '../components.js';
import { PLAYER_ID, type World } from '../world.js';
import { collectMissile } from './missiles.js';

export interface PickupsConfig {
  scoopRadius: number; // player collection radius
  shieldPerPickup: number; // shield rings restored by fuel/gems
  hullPerAlloy: number; // hull repaired by alloys
  driftSpeed: number; // pickups drift down-screen toward the player
}

export const DEFAULT_PICKUPS: PickupsConfig = {
  scoopRadius: 0.35,
  shieldPerPickup: 1,
  hullPerAlloy: 4,
  driftSpeed: 0.5,
};

const dist2 = (a: Vec3, b: Vec3): number => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function removePickup(world: World, e: Entity): void {
  world.entities.delete(e.id);
}

function bankCargo(world: World, name: string, tons: number, pos: Vec3): void {
  world.cargo[name] = (world.cargo[name] ?? 0) + tons;
  world.events.push({ type: 'floatingText', category: 'cargo', text: `${cap(name)} ${tons}T`, pos: { ...pos } }); // [ROC-ECO-3]
}

function fitLaser(world: World, pos: Vec3): void {
  const lasers = world.player.lasers;
  for (const mount of ['front', 'rear', 'left', 'right'] as const) {
    if (lasers[mount] === null) {
      lasers[mount] = 'pulse';
      world.events.push({ type: 'floatingText', category: 'fit', text: 'Laser', pos: { ...pos } });
      return;
    }
  }
  bankCargo(world, 'laser', 1, pos); // all mounts full -> sellable
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
      world.player.energyBombs += 1;
      break;
    case 'pod':
      world.player.escapePod = true;
      break;
    case 'life':
      world.player.lives = Math.min(5, world.player.lives + 1);
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

    // Collectables are inert to weapons fire — bullets and missiles pass straight through. Only
    // the player scoop collects them. [ROC-PWR-2a, ROC-CARGO-2]
    if (player && dist2(player.pos, e.pos) <= cfg.scoopRadius ** 2) {
      collect(world, e, player, cfg);
    }
  }
}
