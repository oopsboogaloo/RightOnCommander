// Ships & laser fitting. The player flies one of a fixed ladder of hulls, each with a shield
// count, hull strength and a hardpoint count that caps how many lasers it can mount — at most
// one per firing direction. Buying up the ladder carries the equipped lasers forward (every
// step adds a hardpoint, so nothing is lost). Pure: no DOM/content imports. [tasks T6.1,
// ROC-SHIP-1..5, ROC-LAS-1,2]

import { PLAYER_ID, type World } from '../world.js';

export const DIRECTIONS = ['front', 'rear', 'left', 'right'] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type LaserType = 'pulse' | 'beam' | 'military';

export interface ShipDef {
  name: string;
  meshId: string;
  shield: number;
  hull: number;
  hardpoints: number;
  colliderRx: number;
  colliderRz: number;
  price: number;
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
    if (s.hardpoints < 1 || s.hardpoints > DIRECTIONS.length) {
      throw new Error(`ship '${id}': hardpoints ${s.hardpoints} out of range 1..${DIRECTIONS.length}`);
    }
  }
  return data;
}

export const equippedCount = (lasers: World['player']['lasers']): number =>
  DIRECTIONS.reduce((n, d) => n + (lasers[d] ? 1 : 0), 0);

// May a laser be fitted to `dir` on the current ship? Capped by hardpoints, one per direction.
export function canFitLaser(world: World, dir: Direction): { ok: boolean; reason?: string } {
  const lasers = world.player.lasers;
  if (lasers[dir]) return { ok: false, reason: 'direction already armed' }; // [ROC-SHIP-4, ROC-LAS-2]
  if (equippedCount(lasers) >= world.player.hardpoints) return { ok: false, reason: 'no free hardpoint' };
  return { ok: true };
}

// Fit a laser to a direction if the rules allow (no pricing here — the station charges). [ROC-LAS-1,2]
export function fitLaser(world: World, dir: Direction, type: LaserType): boolean {
  if (!canFitLaser(world, dir).ok) return false;
  world.player.lasers[dir] = type;
  return true;
}

// Apply a hull's stats to the player. Lasers are carried forward (clamped to the new hardpoint
// count, though stepping up the ladder never needs to drop one). `fresh` refills shield+hull,
// as when buying a new ship. [ROC-SHIP-2,3,5]
export function applyShip(world: World, ships: ShipsContent, shipId: string, fresh = true): void {
  const def = ships.ships[shipId];
  if (!def) throw new Error(`unknown ship '${shipId}'`);

  world.player.shipClass = shipId;
  world.player.hardpoints = def.hardpoints;

  // Drop any lasers beyond the new hardpoint budget, keeping earlier directions first.
  let kept = 0;
  for (const d of DIRECTIONS) {
    if (!world.player.lasers[d]) continue;
    if (kept < def.hardpoints) kept++;
    else world.player.lasers[d] = null;
  }

  const p = world.entities.get(PLAYER_ID);
  if (p) {
    p.meshId = def.meshId;
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
