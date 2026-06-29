// T6.1: ship ladder, hardpoint/one-per-direction laser fitting, and weapons carried forward
// when buying up the ladder. [ROC-SHIP-1..5, ROC-LAS-1,2]

import { describe, it, expect } from 'vitest';
import shipsJson from '../../src/content/ships.json';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import {
  loadShips,
  applyShip,
  fitLaser,
  canFitLaser,
  nextShipId,
  equippedCount,
} from '../../src/sim/systems/ships.js';

const ships = loadShips(shipsJson);

describe('ships content', () => {
  it('is a four-hull ladder with in-range hardpoints', () => {
    expect(ships.ladder).toEqual(['sidewinder', 'cobra_mk3', 'asp_mk2', 'fer_de_lance']);
    expect(ships.ships.sidewinder.hardpoints).toBe(1);
    expect(ships.ships.fer_de_lance.hardpoints).toBe(4);
  });
});

describe('laser fitting rules', () => {
  it('caps at the hardpoint count and one laser per direction', () => {
    const w = makeWorld(1); // Sidewinder: 1 hardpoint, front pulse already fitted
    expect(equippedCount(w.player.lasers)).toBe(1);
    expect(canFitLaser(w, 'front').ok).toBe(false); // direction already armed
    expect(canFitLaser(w, 'rear').ok).toBe(false); // no free hardpoint
    expect(fitLaser(w, 'rear', 'pulse')).toBe(false);

    applyShip(w, ships, 'cobra_mk3'); // 2 hardpoints
    expect(canFitLaser(w, 'rear').ok).toBe(true);
    expect(fitLaser(w, 'rear', 'beam')).toBe(true);
    expect(w.player.lasers.rear).toBe('beam');
    expect(canFitLaser(w, 'left').ok).toBe(false); // both hardpoints now used
  });
});

describe('buying up the ladder', () => {
  it('carries lasers forward and applies the new hull stats', () => {
    const w = makeWorld(1);
    expect(w.player.lasers.front).toBe('pulse');
    applyShip(w, ships, 'cobra_mk3');
    expect(w.player.shipClass).toBe('cobra_mk3');
    expect(w.player.hardpoints).toBe(2);
    expect(w.player.lasers.front).toBe('pulse'); // carried forward, no loss [ROC-SHIP-5]
    const p = w.entities.get(PLAYER_ID)!;
    expect(p.meshId).toBe('cobra_mk3');
    expect(p.shieldMax).toBe(2);
    expect(p.hullMax).toBe(3);
    expect(p.shield).toBe(2); // fresh ship refilled
  });

  it('nextShipId walks the ladder and stops at the top', () => {
    expect(nextShipId(ships, 'sidewinder')).toBe('cobra_mk3');
    expect(nextShipId(ships, 'fer_de_lance')).toBeNull();
  });

  it('clamps lasers if applied to a hull with fewer hardpoints', () => {
    const w = makeWorld(1);
    applyShip(w, ships, 'cobra_mk3');
    fitLaser(w, 'rear', 'pulse');
    applyShip(w, ships, 'sidewinder'); // back down to 1 hardpoint
    expect(equippedCount(w.player.lasers)).toBe(1);
    expect(w.player.lasers.front).toBe('pulse');
    expect(w.player.lasers.rear).toBeNull();
  });
});
