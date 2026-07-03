// Station shop intents. While docked the player sells cargo, buys the next hull, fits lasers,
// buys ECM / energy bomb / escape pod / extra lives, upgrades the (still-timed) missile level,
// and launches after a confirmation. Each action is a pure function over the World returning a
// result, so the station screen is just render + intents and is fully testable headlessly.
// [tasks T6.2, ROC-STN-1..7, ROC-ECO-6,7,8,9]

import type { World } from '../world.js';
import { canAfford, spend } from './economy.js';
import { collectMissile, DEFAULT_MISSILES } from './missiles.js';
import {
  applyShip,
  canFitLaser,
  nextShipId,
  type Direction,
  type LaserType,
  type ShipsContent,
} from './ships.js';

export interface PricesContent {
  lasers: Record<LaserType, number>;
  equipment: { ecm: number; bomb: number; pod: number; life: number; missile: number };
  cargo: Record<string, number>;
}

export interface StationContext {
  ships: ShipsContent;
  prices: PricesContent;
}

export const MAX_LIVES = 5; // [ROC-LIFE-5]

export interface StationResult {
  ok: boolean;
  reason?: string;
  shortfall?: number; // credits short, when unaffordable [ROC-ECO-8]
  [key: string]: unknown;
}

const fail = (reason: string, extra: Record<string, unknown> = {}): StationResult => ({ ok: false, reason, ...extra });

// Charge the wallet, or report the shortfall so the UI can disable + explain. [ROC-ECO-8]
function charge(world: World, cost: number): StationResult | null {
  if (!canAfford(world, cost)) return fail('insufficient credits', { shortfall: cost - world.econ.wallet });
  spend(world, cost);
  return null;
}

const cargoUnitPrice = (prices: PricesContent, name: string): number => prices.cargo[name] ?? prices.cargo.default ?? 0;

// Sell every tonne of cargo (and banked surplus pickups) at its unit price. [ROC-STN-2, ROC-ECO-6]
export function sellCargo(world: World, ctx: StationContext): StationResult {
  let total = 0;
  for (const [name, tons] of Object.entries(world.cargo)) total += cargoUnitPrice(ctx.prices, name) * tons;
  world.cargo = {};
  world.econ.wallet += total;
  world.econ.score += total; // selling is gross credits earned [ROC-ECO-2]
  world.events.push({ type: 'sold', amount: total });
  return { ok: true, amount: total };
}

// Buy the next hull up the ladder, carrying lasers forward and refilling shields/hull. [ROC-STN-3, ROC-SHIP-5]
export function buyShip(world: World, ctx: StationContext): StationResult {
  const next = nextShipId(ctx.ships, world.player.shipClass);
  if (!next) return fail('already the top ship');
  const price = ctx.ships.ships[next].price;
  const err = charge(world, price);
  if (err) return err;
  applyShip(world, ctx.ships, next, true);
  world.events.push({ type: 'shipBought', shipId: next });
  return { ok: true, shipId: next };
}

// Fit a laser of `type` to `dir`. A free hardpoint takes another laser (they all fire together);
// when the direction is full, `type` replaces whichever different-type laser is already there,
// refunding its price — any type can bump any other (e.g. military can replace a beam, refunding
// it), so upgrading (or downgrading) is always possible, never just a dead end. [ROC-STN-4, ROC-LAS-5,6]
export function fitLaserAt(world: World, ctx: StationContext, dir: Direction, type: LaserType): StationResult {
  const price = ctx.prices.lasers[type];

  if (canFitLaser(world, dir).ok) {
    const err = charge(world, price);
    if (err) return err;
    world.player.lasers[dir].push(type);
    world.events.push({ type: 'laserFitted', dir, laser: type });
    return { ok: true };
  }

  const lasers = world.player.lasers[dir];
  const idx = lasers.findIndex((t) => t !== type);
  if (idx >= 0) {
    const replaced = lasers[idx] as LaserType;
    const refund = ctx.prices.lasers[replaced];
    const err = charge(world, price - refund); // net cost: pay the new laser, credited the old one
    if (err) return err;
    lasers[idx] = type;
    world.events.push({ type: 'laserFitted', dir, laser: type, replaced, refund });
    return { ok: true, replaced, refund };
  }

  return fail('no free hardpoint in that direction');
}

export function buyEcm(world: World, ctx: StationContext): StationResult {
  const err = charge(world, ctx.prices.equipment.ecm);
  if (err) return err;
  world.player.ecm += 1;
  return { ok: true };
}

export function buyEnergyBomb(world: World, ctx: StationContext): StationResult {
  const err = charge(world, ctx.prices.equipment.bomb);
  if (err) return err;
  world.player.energyBombs += 1;
  return { ok: true };
}

export function buyEscapePod(world: World, ctx: StationContext): StationResult {
  if (world.player.escapePod) return fail('pod already fitted');
  const err = charge(world, ctx.prices.equipment.pod);
  if (err) return err;
  world.player.escapePod = true;
  return { ok: true };
}

export function buyLife(world: World, ctx: StationContext): StationResult {
  if (world.player.lives >= MAX_LIVES) return fail('lives at maximum'); // [ROC-LIFE-5]
  const err = charge(world, ctx.prices.equipment.life);
  if (err) return err;
  world.player.lives += 1;
  return { ok: true };
}

// Raise the missile grade; it still runs on the §3.5 timer (restarted by collectMissile). [ROC-ECO-9, ROC-STN-5b]
export function upgradeMissile(world: World, ctx: StationContext): StationResult {
  if (world.player.missileGrade >= DEFAULT_MISSILES.maxGrade) return fail('missile level at maximum');
  const err = charge(world, ctx.prices.equipment.missile);
  if (err) return err;
  collectMissile(world);
  return { ok: true, grade: world.player.missileGrade };
}

// Launch only after an explicit confirmation. [ROC-STN-6]
export function launch(world: World, confirm: boolean): StationResult {
  if (!confirm) return fail('confirmation required');
  world.events.push({ type: 'launch' });
  return { ok: true };
}
