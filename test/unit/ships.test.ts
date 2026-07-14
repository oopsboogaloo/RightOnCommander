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
  bestPickupSlot,
} from '../../src/sim/systems/ships.js';

const ships = loadShips(shipsJson);

describe('ships content', () => {
  it('is a four-hull ladder with per-direction hardpoints', () => {
    expect(ships.ladder).toEqual(['sidewinder', 'cobra_mk3', 'asp_mk2', 'fer_de_lance']);
    expect(ships.ships.sidewinder.hardpoints).toEqual({ front: 2, rear: 1, left: 0, right: 0 });
    expect(ships.ships.fer_de_lance.hardpoints).toEqual({ front: 4, rear: 3, left: 3, right: 3 });
  });
});

describe('laser fitting rules', () => {
  it('fills each direction up to its hardpoint capacity', () => {
    const w = makeWorld(1); // Sidewinder: front 2 (one pulse fitted), rear 1, no sides
    expect(equippedCount(w.player.lasers)).toBe(1);
    expect(canFitLaser(w, 'front').ok).toBe(true); // 1 of 2 front used
    expect(fitLaser(w, 'front', 'beam')).toBe(true); // second front hardpoint
    expect(w.player.lasers.front).toEqual(['pulse', 'beam']);
    expect(canFitLaser(w, 'front').ok).toBe(false); // front now full (2/2)
    expect(canFitLaser(w, 'left').ok).toBe(false); // Sidewinder has no left hardpoint
    expect(fitLaser(w, 'rear', 'pulse')).toBe(true);
    expect(canFitLaser(w, 'rear').ok).toBe(false); // rear full (1/1)
  });
});

describe('bestPickupSlot: where a field pickup upgrades the loadout', () => {
  it('prefers a genuinely free hardpoint over upgrading an occupied one, Front first', () => {
    const w = makeWorld(1); // Sidewinder: front ['pulse'] with a spare slot, rear empty
    expect(bestPickupSlot(w, 'beam')).toEqual({ dir: 'front' }); // the free front slot, no index to replace
  });

  it('upgrades a strictly weaker laser once its direction has no free capacity', () => {
    const w = makeWorld(1);
    w.player.hardpoints = { front: 1, rear: 0, left: 0, right: 0 };
    w.player.lasers = { front: ['pulse'], rear: [], left: [], right: [] };
    expect(bestPickupSlot(w, 'beam')).toEqual({ dir: 'front', index: 0 });
  });

  it('never targets a laser of equal or greater rank — falls through to the next direction', () => {
    const w = makeWorld(1);
    w.player.hardpoints = { front: 1, rear: 1, left: 0, right: 0 };
    w.player.lasers = { front: ['military'], rear: [], left: [], right: [] };
    expect(bestPickupSlot(w, 'beam')).toEqual({ dir: 'rear' }); // military left alone, rear is free
  });

  it('returns undefined once nothing anywhere is an improvement', () => {
    const w = makeWorld(1);
    w.player.hardpoints = { front: 1, rear: 1, left: 0, right: 0 };
    w.player.lasers = { front: ['beam'], rear: ['military'], left: [], right: [] };
    expect(bestPickupSlot(w, 'beam')).toBeUndefined();
  });
});

describe('buying up the ladder', () => {
  it('carries lasers forward and applies the new hull stats', () => {
    const w = makeWorld(1);
    expect(w.player.lasers.front).toEqual(['pulse']);
    applyShip(w, ships, 'cobra_mk3');
    expect(w.player.shipClass).toBe('cobra_mk3');
    expect(w.player.hardpoints).toEqual({ front: 2, rear: 1, left: 1, right: 1 });
    expect(w.player.lasers.front).toEqual(['pulse']); // carried forward, no loss [ROC-SHIP-5]
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

  it('clamps lasers when a hull has fewer hardpoints in a direction', () => {
    const w = makeWorld(1);
    applyShip(w, ships, 'cobra_mk3'); // left capacity 1
    fitLaser(w, 'left', 'pulse');
    expect(w.player.lasers.left).toEqual(['pulse']);
    applyShip(w, ships, 'sidewinder'); // Sidewinder has no left hardpoint
    expect(w.player.lasers.left).toEqual([]); // dropped
    expect(w.player.lasers.front).toEqual(['pulse']); // kept (both hulls have front)
  });
});
