// T6.2: station shop intents — sell cargo, buy the next ship (carrying lasers), fit lasers,
// buy ECM/bomb/pod/lives, upgrade the missile level, and launch only after confirmation.
// Insufficient credits disable a purchase and report the shortfall. [ROC-STN-1..7, ROC-ECO-6,7,8,9]

import { describe, it, expect } from 'vitest';
import shipsJson from '../../src/content/ships.json';
import economyJson from '../../src/content/economy.json';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import { loadShips, applyShip } from '../../src/sim/systems/ships.js';
import {
  sellCargo,
  buyShip,
  fitLaserAt,
  buyEcm,
  buyEnergyBomb,
  buyEscapePod,
  buyLife,
  upgradeMissile,
  launch,
  type PricesContent,
  type StationContext,
} from '../../src/sim/systems/station.js';

const ctx: StationContext = { ships: loadShips(shipsJson), prices: economyJson as PricesContent };

describe('sell cargo', () => {
  it('converts all cargo to credits at unit prices and clears the hold', () => {
    const w = makeWorld(1);
    w.cargo = { gems: 2, fuel: 3 }; // 2*120 + 3*5
    const r = sellCargo(w, ctx);
    expect(r.amount).toBe(255);
    expect(w.econ.wallet).toBe(255);
    expect(w.econ.score).toBe(255);
    expect(w.cargo).toEqual({});
  });
});

describe('buy ship', () => {
  it('upgrades, carries lasers forward and spends the price when affordable', () => {
    const w = makeWorld(1);
    w.econ.wallet = 5000;
    const r = buyShip(w, ctx);
    expect(r.ok).toBe(true);
    expect(w.player.shipClass).toBe('cobra_mk3');
    expect(w.player.lasers.front).toEqual(['pulse']); // carried [ROC-SHIP-5]
    expect(w.econ.wallet).toBe(3000); // 5000 - 2000
    expect(w.entities.get(PLAYER_ID)!.shieldMax).toBe(2);
  });

  it('is disabled with the shortfall when unaffordable', () => {
    const w = makeWorld(1); // wallet 0
    const r = buyShip(w, ctx);
    expect(r.ok).toBe(false);
    expect(r.shortfall).toBe(2000); // [ROC-ECO-8]
    expect(w.player.shipClass).toBe('sidewinder'); // unchanged
  });
});

describe('fit lasers', () => {
  it('charges the per-type price and respects the fitting rules', () => {
    const w = makeWorld(1);
    w.econ.wallet = 5000;
    buyShip(w, ctx); // Cobra, wallet 3000
    expect(fitLaserAt(w, ctx, 'rear', 'beam').ok).toBe(true);
    expect(w.player.lasers.rear).toEqual(['beam']);
    expect(w.econ.wallet).toBe(2000); // 3000 - 1000
    expect(fitLaserAt(w, ctx, 'rear', 'pulse').ok).toBe(false); // rear now full (1/1)
  });

  it('reports the shortfall when too poor', () => {
    const w = makeWorld(1);
    applyShip(w, ctx.ships, 'cobra_mk3'); // a free hardpoint exists, so price is what blocks it
    w.econ.wallet = 50;
    const r = fitLaserAt(w, ctx, 'rear', 'beam');
    expect(r.ok).toBe(false);
    expect(r.shortfall).toBe(950);
  });
});

describe('equipment', () => {
  it('buys ECM / bomb / pod with credits', () => {
    const w = makeWorld(1);
    w.econ.wallet = 10000;
    expect(buyEcm(w, ctx).ok).toBe(true);
    expect(buyEnergyBomb(w, ctx).ok).toBe(true);
    expect(buyEscapePod(w, ctx).ok).toBe(true);
    expect(w.player.ecm).toBe(1);
    expect(w.player.energyBombs).toBe(1);
    expect(w.player.escapePod).toBe(true);
    expect(buyEscapePod(w, ctx).ok).toBe(false); // already fitted
  });

  it('caps lives at five', () => {
    const w = makeWorld(1);
    w.econ.wallet = 100000;
    w.player.lives = 5;
    expect(buyLife(w, ctx).ok).toBe(false);
    w.player.lives = 3;
    expect(buyLife(w, ctx).ok).toBe(true);
    expect(w.player.lives).toBe(4);
  });

  it('upgrades the missile level (timed) up to the cap', () => {
    const w = makeWorld(1);
    w.econ.wallet = 100000;
    const r = upgradeMissile(w, ctx);
    expect(r.ok).toBe(true);
    expect(w.player.missileGrade).toBe(1);
    expect(w.player.missileTimer).toBeGreaterThan(0); // still timed [ROC-ECO-9]
    w.player.missileGrade = 4;
    expect(upgradeMissile(w, ctx).ok).toBe(false);
  });
});

describe('launch', () => {
  it('requires confirmation', () => {
    const w = makeWorld(1);
    expect(launch(w, false).ok).toBe(false);
    expect(launch(w, true).ok).toBe(true);
    expect(w.events.some((e) => e.type === 'launch')).toBe(true);
  });
});
