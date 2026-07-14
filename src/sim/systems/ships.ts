// Ships & laser fitting. The player flies one of a fixed ladder of hulls, each with a shield
// count, hull strength and a per-direction hardpoint layout (front/rear/left/right can each hold
// several lasers). Buying up the ladder carries equipped lasers forward. Pure: no DOM/content
// imports. [tasks T6.1, ROC-SHIP-1..3,5, ROC-HP-1..5, ROC-LAS-1]

import { PLAYER_ID, type World } from '../world.js';

export const DIRECTIONS = ['front', 'rear', 'left', 'right'] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type LaserType = 'pulse' | 'beam' | 'military';

export type Hardpoints = Record<Direction, number>; // capacity per direction [ROC-HP-1,2]
export type Loadout = Record<Direction, LaserType[]>; // installed lasers per direction

export interface ShipDef {
  name: string;
  meshId: string;
  shield: number;
  hull: number;
  hardpoints: Hardpoints;
  colliderRx: number;
  colliderRz: number;
  price: number;
  scale?: number; // render + collision size multiplier (the FdL flies at 1.5x) [ROC-FDL-1]
}

export interface ShipsContent {
  ladder: string[];
  ships: Record<string, ShipDef>;
}

// Validate the raw ships JSON into a typed table. [tasks T6.1]
export function loadShips(raw: unknown): ShipsContent {
  const data = raw as ShipsContent;
  if (!data || !Array.isArray(data.ladder) || typeof data.ships !== 'object') {
    throw new Error('ships content: expected { ladder: string[], ships: {} }');
  }
  for (const id of data.ladder) {
    const s = data.ships[id];
    if (!s) throw new Error(`ships content: ladder entry '${id}' has no ship def`);
    for (const d of DIRECTIONS) {
      const n = s.hardpoints?.[d];
      if (typeof n !== 'number' || n < 0 || n > 4) throw new Error(`ship '${id}': ${d} hardpoints ${n} out of range 0..4`);
    }
  }
  return data;
}

export const equippedCount = (lasers: Record<Direction, readonly unknown[]>): number =>
  DIRECTIONS.reduce((n, d) => n + lasers[d].length, 0);

const freeInDirection = (world: World, dir: Direction): number =>
  (world.player.hardpoints[dir] ?? 0) - world.player.lasers[dir].length;

// May a laser be fitted to `dir`? Only if that direction has a spare hardpoint. [ROC-HP-1,3]
export function canFitLaser(world: World, dir: Direction): { ok: boolean; reason?: string } {
  if (freeInDirection(world, dir) <= 0) return { ok: false, reason: 'no free hardpoint in that direction' };
  return { ok: true };
}

// Fit a laser to a direction if a hardpoint is free (no pricing here — the station charges). [ROC-HP-3]
export function fitLaser(world: World, dir: Direction, type: LaserType): boolean {
  if (!canFitLaser(world, dir).ok) return false;
  world.player.lasers[dir].push(type);
  return true;
}

// Strength order for deciding whether a picked-up laser is an upgrade. [ROC-LAS-*]
const LASER_RANK: Record<LaserType, number> = { pulse: 1, beam: 2, military: 3 };

// The best hardpoint slot for a laser pickup of `type`: an empty hardpoint, or one currently
// holding a strictly weaker laser — a field pickup only ever upgrades, never downgrades (a beam
// pickup won't touch a military laser). Checked direction by direction, Front → Rear → Left →
// Right, preferring a genuinely free hardpoint over an upgrade within each direction. [ROC-HP-4]
export function bestPickupSlot(world: World, type: LaserType): { dir: Direction; index?: number } | undefined {
  for (const dir of DIRECTIONS) {
    if (freeInDirection(world, dir) > 0) return { dir };
    const idx = world.player.lasers[dir].findIndex((l) => LASER_RANK[l as LaserType] < LASER_RANK[type]);
    if (idx >= 0) return { dir, index: idx };
  }
  return undefined;
}

// Apply a hull's stats to the player. Lasers carry forward, clamped to each direction's new
// capacity (stepping up the ladder never needs to drop one). `fresh` refills shield+hull. [ROC-SHIP-2,3,5]
export function applyShip(world: World, ships: ShipsContent, shipId: string, fresh = true): void {
  const def = ships.ships[shipId];
  if (!def) throw new Error(`unknown ship '${shipId}'`);

  world.player.shipClass = shipId;
  world.player.hardpoints = { ...def.hardpoints };
  for (const d of DIRECTIONS) {
    world.player.lasers[d] = world.player.lasers[d].slice(0, def.hardpoints[d]); // drop overflow on a smaller hull
  }

  const p = world.entities.get(PLAYER_ID);
  if (p) {
    p.meshId = def.meshId;
    p.scale = def.scale; // the player-flown FdL is 1.5x too [ROC-FDL-1]
    p.shieldMax = def.shield;
    p.hullMax = def.hull;
    p.colliderRx = def.colliderRx;
    p.colliderRz = def.colliderRz;
    if (fresh) {
      p.shield = def.shield;
      p.hull = def.hull;
    } else {
      p.shield = Math.min(p.shield ?? def.shield, def.shield);
      p.hull = Math.min(p.hull ?? def.hull, def.hull);
    }
  }
}

// The next hull up the ladder, or null if already at the top. [ROC-SHIP-1]
export function nextShipId(ships: ShipsContent, current: string): string | null {
  const i = ships.ladder.indexOf(current);
  return i >= 0 && i + 1 < ships.ladder.length ? ships.ladder[i + 1] : null;
}

// How many energy bombs a ship can carry: the Fer-de-Lance's extra bay takes a second. [ROC-BOMB-2]
export const energyBombCap = (shipClass: string): number => (shipClass === 'fer_de_lance' ? 2 : 1);
