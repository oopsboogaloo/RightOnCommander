// The station menu: the mid-level trader carries the same full menu as the end-of-level
// Coriolis, ship purchases included — the earlier "no new hulls at the trader" restriction
// proved too harsh and was dropped. [ROC-MDCK-3]

import { describe, it, expect } from 'vitest';
import shipsJson from '../../src/content/ships.json';
import economyJson from '../../src/content/economy.json';
import { makeWorld } from '../../src/sim/world.js';
import { loadShips } from '../../src/sim/systems/ships.js';
import { stationButtons } from '../../src/render/screens/station.js';
import type { StationContext, PricesContent } from '../../src/sim/systems/station.js';

const ctx: StationContext = { ships: loadShips(shipsJson), prices: economyJson as PricesContent };

describe('station menu', () => {
  it('offers a ship purchase at the end-of-level station', () => {
    const w = makeWorld(1);
    w.levelState = 'DOCK';
    const buttons = stationButtons(w, ctx, 800, 600, false, 'pulse');
    expect(buttons.some((b) => b.action === 'buyShip')).toBe(true);
  });

  it('also offers a ship purchase at the mid-level trader', () => {
    const w = makeWorld(1);
    w.levelState = 'MID_DOCK';
    const buttons = stationButtons(w, ctx, 800, 600, false, 'pulse');
    expect(buttons.some((b) => b.action === 'buyShip')).toBe(true);
  });

  it('offers the same full menu at both', () => {
    const w = makeWorld(1);
    w.levelState = 'MID_DOCK';
    const buttons = stationButtons(w, ctx, 800, 600, false, 'pulse');
    const actions = buttons.map((b) => b.action);
    expect(actions).toEqual(
      expect.arrayContaining(['sell', 'buyShip', 'laserType', 'fitFront', 'fitRear', 'fitLeft', 'fitRight', 'ecm', 'bomb', 'bank', 'life', 'missile', 'launch']),
    );
  });
});
