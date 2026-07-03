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
  it('charges the per-type price, and a full direction still swaps to any different type', () => {
    const w = makeWorld(1);
    w.econ.wallet = 5000;
    buyShip(w, ctx); // Cobra, wallet 3000
    expect(fitLaserAt(w, ctx, 'rear', 'beam').ok).toBe(true);
    expect(w.player.lasers.rear).toEqual(['beam']);
    expect(w.econ.wallet).toBe(2000); // 3000 - 1000
    // Rear is full (1/1) with a beam, but fitting a pulse still succeeds — it swaps out the beam
    // and refunds it, never a dead end regardless of which direction the swap goes. [ROC-LAS-6]
    const r = fitLaserAt(w, ctx, 'rear', 'pulse');
    expect(r.ok).toBe(true);
    expect(r.replaced).toBe('beam');
    expect(w.player.lasers.rear).toEqual(['pulse']);
    expect(w.econ.wallet).toBe(2900); // 2000 + (1000 beam refund - 100 pulse price)
  });

  it('adds a second laser alongside the first when a hardpoint is free (both operate)', () => {
    const w = makeWorld(1); // Sidewinder front cap 2, starts with one pulse
    w.econ.wallet = 5000;
    expect(fitLaserAt(w, ctx, 'front', 'beam').ok).toBe(true);
    expect(w.player.lasers.front).toEqual(['pulse', 'beam']); // added, not replaced [ROC-LAS-6]
    expect(w.econ.wallet).toBe(4000); // full beam price
  });

  it('replaces a pulse and refunds it when fitting an upgrade to a full direction', () => {
    const w = makeWorld(1); // Sidewinder rear cap 1
    w.econ.wallet = 5000;
    expect(fitLaserAt(w, ctx, 'rear', 'pulse').ok).toBe(true); // rear ['pulse'], -100
    expect(w.econ.wallet).toBe(4900);
    const r = fitLaserAt(w, ctx, 'rear', 'beam'); // rear full -> beam replaces the pulse
    expect(r.ok).toBe(true);
    expect(r.replaced).toBe('pulse');
    expect(w.player.lasers.rear).toEqual(['beam']); // swapped, not stacked
    expect(w.econ.wallet).toBe(4000); // 4900 - (1000 beam - 100 pulse refund) [ROC-LAS-6]
  });

  it('fits a military laser over a slot occupied by a beam, refunding the beam', () => {
    const w = makeWorld(1); // Sidewinder rear cap 1
    w.econ.wallet = 20000;
    expect(fitLaserAt(w, ctx, 'rear', 'beam').ok).toBe(true); // rear ['beam'], -1000
    expect(w.econ.wallet).toBe(19000);
    const r = fitLaserAt(w, ctx, 'rear', 'military'); // rear full -> military replaces the beam
    expect(r.ok).toBe(true);
    expect(r.replaced).toBe('beam');
    expect(w.player.lasers.rear).toEqual(['military']);
    expect(w.econ.wallet).toBe(10000); // 19000 - (10000 military - 1000 beam refund)
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
