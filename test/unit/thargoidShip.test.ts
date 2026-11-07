// The playable Thargoid ship, unlocked by completing the game: sold outside the ladder only once
// unlocked, Asp-like with 50% more shield, and launching friendly Thargons that hunt and shoot
// enemies. [ROC-SHIP-6, ROC-PROG-2]

import { describe, it, expect } from 'vitest';
import shipsJson from '../../src/content/ships.json';
import economyJson from '../../src/content/economy.json';
import { makeWorld, PLAYER_ID, type World } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import { createRng } from '../../src/sim/rng.js';
import { loadShips, applyShip } from '../../src/sim/systems/ships.js';
import { buyUnlockedShip, type PricesContent, type StationContext } from '../../src/sim/systems/station.js';
import { thargonSystem, DRONE_CFG } from '../../src/sim/systems/thargons.js';
import { stationButtons } from '../../src/render/screens/station.js';

const ships = loadShips(shipsJson);
const locked: StationContext = { ships, prices: economyJson as PricesContent };
const unlocked: StationContext = { ...locked, unlocks: { thargoidShip: true } };
const DT = 1 / 120;
const drones = (w: World) => [...w.entities.values()].filter((e) => e.kind === 'drone');
const playerBolts = (w: World) => [...w.entities.values()].filter((e) => e.kind === 'projectile' && e.team === 'player');

describe('Thargoid ship', () => {
  it('is like the Asp with 50% more shield (4.5 rounded up to 5) and the same hardpoints', () => {
    const asp = ships.ships.asp_mk2;
    const t = ships.ships.thargoid;
    expect(t.shield).toBe(Math.ceil(asp.shield * 1.5));
    expect(t.hardpoints).toEqual(asp.hardpoints);
    expect(ships.ladder).not.toContain('thargoid'); // never reached by the ordinary upgrade
  });

  it('cannot be bought until unlocked, then can', () => {
    const w = makeWorld(1);
    w.econ.wallet = 100000;
    expect(buyUnlockedShip(w, locked, 'thargoid').ok).toBe(false);
    expect(stationButtons(w, locked, 800, 600, false, 'pulse').some((b) => b.action === 'buyThargoid')).toBe(false);
    expect(stationButtons(w, unlocked, 800, 600, false, 'pulse').some((b) => b.action === 'buyThargoid')).toBe(true);
    w.player.lasers.front = ['beam'];
    const r = buyUnlockedShip(w, unlocked, 'thargoid');
    expect(r.ok).toBe(true);
    expect(w.player.shipClass).toBe('thargoid');
    expect(w.entities.get(PLAYER_ID)!.shieldMax).toBe(5);
    expect(w.player.lasers.front).toEqual(['beam']); // lasers carry over
    expect(w.econ.wallet).toBe(100000 - ships.ships.thargoid.price);
    expect(buyUnlockedShip(w, unlocked, 'thargoid').ok).toBe(false); // already flying it
  });
});

describe('friendly Thargons', () => {
  function thargoidWorld(): World {
    const w = makeWorld(1);
    applyShip(w, ships, 'thargoid', true);
    return w;
  }
  const run = (w: World, secs: number) => {
    const rng = createRng(1);
    for (let i = 0; i < Math.round(secs / DT); i++) thargonSystem(w, rng, DT, { enemies: {} });
  };

  it('launches up to its cap of drones', () => {
    const w = thargoidWorld();
    run(w, 10);
    expect(drones(w).length).toBe(ships.ships.thargoid.drones!.max);
  });

  it('flies to an enemy and shoots it with player bolts', () => {
    const w = thargoidWorld();
    const id = w.nextId++;
    w.entities.set(id, { id, kind: 'enemy', pos: vec3(0.6, 0, 0.8), vel: vec3(), yaw: 0, bank: 0, hull: 50 });
    run(w, 3);
    const d = drones(w)[0];
    expect(Math.hypot(d.pos.x - 0.6, d.pos.z - (0.8 - DRONE_CFG.hoverBelow))).toBeLessThan(0.15);
    expect(playerBolts(w).length).toBeGreaterThan(0);
  });

  it('expires after its lifetime, and none launch while the ship is out of play', () => {
    const w = thargoidWorld();
    run(w, 2);
    expect(drones(w).length).toBeGreaterThan(0);
    w.mode = 'GAME_OVER';
    run(w, DRONE_CFG.lifeSec + 0.1);
    expect(drones(w).length).toBe(0);
  });
});
