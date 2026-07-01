// Drops: spawn pickups when a ship is destroyed. Two paths — an explicit `drops` power-up (e.g.
// the mid-boss's guaranteed laser), and a random cargo commodity that enemies sometimes shed.
// Cargo is inert to fire (ROC-PWR-2a); it is only scooped. [tasks T5.2, ROC-PWR-6, ROC-CARGO-1,4,5]

import { vec3, type Vec3 } from '../math/vec3.js';
import type { PickupType } from '../components.js';
import type { Rng } from '../rng.js';
import type { World } from '../world.js';

const DROP_TTL = 10; // seconds a dropped pickup lingers
const CARGO_CHANCE = 0.4; // chance an ordinary kill sheds cargo [ROC-CARGO-1]

// The Elite commodity market. Alien Items only ever come from Thargoids. [ROC-CARGO-4,5]
export const COMMODITIES = [
  'Food', 'Textiles', 'Radioactives', 'Slaves', 'Liquor/Wines', 'Firearms', 'Narcotics',
  'Computers', 'Machinery', 'Alloys', 'Furs', 'Minerals', 'Gold', 'Platinum', 'Gem-Stones',
];
export const ALIEN_ITEMS = 'Alien Items';
const TRANSPORTER_LOOT = ['Platinum', 'Gold', 'Gem-Stones', 'Computers']; // significant haul [ROC-TR-4]

// A cracked-open splinter sometimes yields raw mined loot: the two functional pickups (hull/
// shield) or straight sellable cargo. [ROC-L1-3]
const ASTEROID_LOOT_CHANCE = 0.6;
const ASTEROID_LOOT: { type: PickupType; commodity?: string }[] = [
  { type: 'alloys' },
  { type: 'gems' },
  { type: 'cargo', commodity: 'Metals' },
  { type: 'cargo', commodity: 'Crystals' },
];

function spawnPickup(world: World, at: Vec3, type: PickupType, commodity?: string): void {
  const id = world.nextId++;
  world.entities.set(id, {
    id,
    kind: 'pickup',
    pos: vec3(at.x, at.y, at.z),
    vel: vec3(),
    yaw: 0,
    bank: 0,
    pickup: { type, commodity },
    ttl: DROP_TTL,
  });
}

export function dropsSystem(world: World, rng?: Rng): void {
  for (const ev of world.events) {
    if (ev.type !== 'destroyed') continue;
    const at = (ev.pos as Vec3) ?? vec3();

    // Explicit power-up drop (guaranteed, e.g. the mid-boss laser).
    if (typeof ev.drops === 'string') {
      spawnPickup(world, at, ev.drops as PickupType);
      continue;
    }

    // A destroyed transporter always yields a significant haul, plus a missile-grade
    // upgrade — it's running weapon supplies, not just cargo. [ROC-TR-4]
    if (ev.meshId === 'transporter') {
      spawnPickup(world, at, 'cargo', TRANSPORTER_LOOT[rng ? rng.int(TRANSPORTER_LOOT.length) : 0]);
      spawnPickup(world, { x: at.x + 0.15, y: at.y, z: at.z }, 'missile');
      continue;
    }

    // A cracked splinter — the terminal asteroid fragment — sometimes yields loot. [ROC-L1-3]
    if (ev.meshId === 'splinter') {
      if (rng && rng.range(0, 1) < ASTEROID_LOOT_CHANCE) {
        const pick = ASTEROID_LOOT[rng.int(ASTEROID_LOOT.length)];
        spawnPickup(world, at, pick.type, pick.commodity);
      }
      continue;
    }

    // Random cargo from a destroyed ship. Deterministic via world.rng. [ROC-CARGO-1]
    if (!rng || (ev.kind !== 'enemy' && ev.kind !== 'boss')) continue;
    if (rng.range(0, 1) >= CARGO_CHANCE) continue;
    const thargoid = ev.meshId === 'thargoid';
    const pool = thargoid ? [...COMMODITIES, ALIEN_ITEMS] : COMMODITIES; // Alien Items: Thargoids only [ROC-CARGO-5]
    spawnPickup(world, at, 'cargo', pool[rng.int(pool.length)]);
  }
}
