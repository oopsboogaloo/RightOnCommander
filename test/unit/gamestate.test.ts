// T6.4: the player can be shot/rammed, and losing all hull spends a life; the energy bomb
// auto-triggers to save the ship if one is carried; otherwise the ship's dramatic explosion
// plays out and a beat later a new one appears in place — nothing about the level ever resets.
// Game over at zero lives, and lives stay within 0..5. [ROC-LIFE-1..5, ROC-DMG-6a, ROC-BOMB-1..4]

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import type { Entity } from '../../src/sim/components.js';
import { gamestateSystem, DEFAULT_GAMESTATE, MAX_LIVES, PLAYER_EXPLOSION_SEC } from '../../src/sim/systems/gamestate.js';
import { collisionSystem, meshSilhouette } from '../../src/sim/systems/collision.js';
import { damageSystem } from '../../src/sim/systems/damage.js';
import { SHIP_SCALE } from '../../src/sim/index.js';
import type { Mesh } from '../../src/interfaces.js';
import type { Pt } from '../../src/sim/math/geom2.js';

const DT = 1 / 120;
const collCfg = { dt: DT, cellSize: 1, getSilhouette: () => undefined, colliderScale: 1 };
const CFG = { ...DEFAULT_GAMESTATE, colliderScale: 1 };

// Steps enough to carry the wreck through its full explosion + respawn delay. [ROC-LIFE-3]
const RESPAWN_STEPS = Math.ceil((PLAYER_EXPLOSION_SEC + DEFAULT_GAMESTATE.respawnDelaySec + 0.1) / DT);
const runOutPending = (w: ReturnType<typeof makeWorld>): void => {
  for (let i = 0; i < RESPAWN_STEPS; i++) gamestateSystem(w, DT, CFG);
};

function addEnemyShot(w: ReturnType<typeof makeWorld>, pos = vec3(0, 0, 0)): Entity {
  const id = w.nextId++;
  const e: Entity = { id, kind: 'projectile', team: 'enemy', pos, vel: vec3(0, 0, -2), yaw: 0, bank: 0, ttl: 3, damage: 1 };
  w.entities.set(id, e);
  return e;
}
function addEnemyShip(w: ReturnType<typeof makeWorld>, pos = vec3(0, 0, 0)): Entity {
  const id = w.nextId++;
  const e: Entity = { id, kind: 'enemy', pos, vel: vec3(), yaw: 0, bank: 0, hull: 3, hullMax: 3, colliderRx: 0.2, colliderRz: 0.2 };
  w.entities.set(id, e);
  return e;
}
function addGiantAsteroid(w: ReturnType<typeof makeWorld>, pos = vec3(0, 0, 0)): Entity {
  const id = w.nextId++;
  const e: Entity = {
    id, kind: 'asteroid', pos, vel: vec3(), yaw: 0, bank: 0,
    hull: 999, hullMax: 999, colliderRx: 0.5, colliderRz: 0.5, indestructible: true,
  };
  w.entities.set(id, e);
  return e;
}

describe('player takes damage', () => {
  // Give the player a few shield rings independent of the starting hull's defaults.
  const shielded = (w: ReturnType<typeof makeWorld>, rings = 4): void => {
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = rings;
    p.shieldMax = rings;
  };

  it('an enemy shot depletes a shield ring and is consumed', () => {
    const w = makeWorld(1);
    shielded(w);
    const shot = addEnemyShot(w);
    damageSystem(w, collisionSystem(w, collCfg), DT);
    expect(w.entities.get(PLAYER_ID)!.shield).toBe(3); // one ring gone
    expect(w.entities.has(shot.id)).toBe(false); // shot spent
  });

  it('invulnerability soaks enemy fire with no damage', () => {
    const w = makeWorld(1);
    shielded(w);
    w.player.invulnTtl = 1;
    addEnemyShot(w);
    damageSystem(w, collisionSystem(w, collCfg), DT);
    expect(w.entities.get(PLAYER_ID)!.shield).toBe(4); // untouched
  });

  it('ramming costs a hit, then i-frames stop an immediate second drain', () => {
    const w = makeWorld(1);
    shielded(w);
    const e = addEnemyShip(w, vec3(0, 0, 0)); // overlapping the player at origin
    e.hull = 99; // durable, so it survives the ram and we can test the player i-frames
    e.hullMax = 99;
    gamestateSystem(w, DT, CFG);
    expect(w.entities.get(PLAYER_ID)!.shield).toBe(3);
    expect(w.player.invulnTtl).toBeGreaterThan(0);
    const before = w.entities.get(PLAYER_ID)!.shield;
    gamestateSystem(w, DT, CFG);
    expect(w.entities.get(PLAYER_ID)!.shield).toBe(before); // i-frames held
  });

  it('a ramming contact grants i-frames but never blink — blink is reserved for a fresh respawn', () => {
    const w = makeWorld(1);
    shielded(w);
    const e = addEnemyShip(w, vec3(0, 0, 0)); // overlapping the player at origin
    e.hull = 99;
    e.hullMax = 99;
    gamestateSystem(w, DT, CFG);
    expect(w.player.invulnTtl).toBeGreaterThan(0); // i-frames granted
    expect(w.player.respawnBlinkTtl).toBe(0); // but no blink [ROC-LIFE-2b]
  });

  it('ramming wrecks a fighter and only dents a boss', () => {
    const w = makeWorld(1);
    const fighter = addEnemyShip(w, vec3(0, 0, 0)); // hull 3 < ramDamage 4
    gamestateSystem(w, DT, CFG);
    expect(w.entities.has(fighter.id)).toBe(false); // destroyed by the ram

    const w2 = makeWorld(1);
    const boss = addEnemyShip(w2, vec3(0, 0, 0));
    boss.kind = 'boss';
    boss.hull = 30;
    boss.hullMax = 30;
    gamestateSystem(w2, DT, CFG);
    expect(w2.entities.has(boss.id)).toBe(true); // survives
    expect(boss.hull).toBe(26); // chipped by ramDamage
  });
});

describe('death, lives & respawn', () => {
  it('losing all hull spends a life immediately, then respawns in place once the explosion plays out', () => {
    const w = makeWorld(1);
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    p.pos = vec3(0.5, 0, 0.7);
    gamestateSystem(w, DT, CFG);

    expect(w.player.lives).toBe(3); // spent right away
    expect(w.player.respawnPending).toBeTruthy(); // wreck waits, nothing has respawned yet
    expect(p.hull).toBe(0); // still a wreck
    expect(w.mode).not.toBe('GAME_OVER');

    runOutPending(w);
    expect(w.player.respawnPending).toBeNull();
    expect(p.hull).toBe(p.hullMax);
    expect(p.shield).toBe(p.shieldMax);
    expect(p.pos).toEqual(vec3(0.5, 0, 0.7)); // respawns in place, not recentred [ROC-LIFE-2]
    expect(w.player.invulnTtl).toBeGreaterThan(0);
    expect(w.player.respawnBlinkTtl).toBeGreaterThan(0); // blinks only for this fresh-ship window [ROC-LIFE-2b]
  });

  it('freezes the wreck through the pending window: further hits and ram checks do nothing', () => {
    const w = makeWorld(1);
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    gamestateSystem(w, DT, CFG);
    expect(w.player.lives).toBe(3);

    const e = addEnemyShip(w, { ...p.pos });
    e.hull = 99;
    e.hullMax = 99;
    gamestateSystem(w, DT, CFG); // a ram-worthy overlap sits right on the wreck
    expect(w.player.lives).toBe(3); // no second life lost
    expect(p.hull).toBe(0); // still just the wreck, untouched
  });

  it('the energy bomb auto-triggers instead of the ship dying', () => {
    const w = makeWorld(1);
    w.player.energyBombs = 1;
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    const enemy = addEnemyShip(w, vec3(0.9, 0, 0.9)); // away from the player, just present on the field
    const boss: Entity = { id: w.nextId++, kind: 'boss', pos: vec3(-0.5, 0, 0.5), vel: vec3(), yaw: 0, bank: 0, hull: 40, hullMax: 40 };
    w.entities.set(boss.id, boss);
    const shot = addEnemyShot(w, vec3(0.2, 0, 0.2));

    gamestateSystem(w, DT, CFG);

    expect(w.player.energyBombs).toBe(0); // consumed
    expect(p.hull).toBe(1); // bare survival, not a full heal
    expect(w.player.lives).toBe(4); // no life spent — the ship never died
    expect(w.player.respawnPending).toBeNull(); // no explosion/respawn sequence at all
    expect(w.entities.has(enemy.id)).toBe(false); // wiped
    expect(w.entities.has(shot.id)).toBe(false); // enemy bullets wiped too
    expect(boss.hull).toBe(20); // bosses just take 50% of their current hull
    expect(w.events.some((ev) => ev.type === 'energyBombDeployed')).toBe(true);
  });

  it('rounds the boss blast damage up to at least 1', () => {
    const w = makeWorld(1);
    w.player.energyBombs = 1;
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    const boss: Entity = { id: w.nextId++, kind: 'boss', pos: vec3(0, 0, 0.5), vel: vec3(), yaw: 0, bank: 0, hull: 1, hullMax: 40 };
    w.entities.set(boss.id, boss);
    gamestateSystem(w, DT, CFG);
    expect(w.entities.has(boss.id)).toBe(false); // 1 hull, 50% rounds to at least 1 -> destroyed
  });

  const cargoWreck = (w: ReturnType<typeof makeWorld>): Entity[] =>
    [...w.entities.values()].filter((e) => e.kind === 'cargo');

  it('jettisons the hold as canister wreckage on death — one per tonne, and the cargo is lost', () => {
    const w = makeWorld(1);
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    p.pos = vec3(0.2, 0, 0.5);
    w.cargo = { gold: 2, furs: 3 }; // 5 tonnes
    gamestateSystem(w, DT, CFG);

    const wreck = cargoWreck(w);
    expect(wreck).toHaveLength(5); // one canister per tonne [ROC-CARGO-6]
    expect(w.cargo).toEqual({}); // and the hold is gone
    expect(wreck.every((e) => e.meshId === 'canister' && (e.ttl ?? 0) > 0)).toBe(true);
  });

  it('caps the jettisoned canisters at 10 for a big hold', () => {
    const w = makeWorld(1);
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    w.cargo = { gold: 25 };
    gamestateSystem(w, DT, CFG);
    expect(cargoWreck(w)).toHaveLength(10); // never more than 10 [ROC-CARGO-6]
  });

  it('scatters nothing when the hold was empty', () => {
    const w = makeWorld(1);
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    gamestateSystem(w, DT, CFG);
    expect(cargoWreck(w)).toHaveLength(0);
  });

  it('runs out of lives into GAME_OVER only once the explosion has played out', () => {
    const w = makeWorld(1);
    w.player.lives = 1;
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    gamestateSystem(w, DT, CFG);
    expect(w.player.lives).toBe(0);
    expect(w.mode).not.toBe('GAME_OVER'); // not yet — the wreck is still exploding

    runOutPending(w);
    expect(w.mode).toBe('GAME_OVER');
    expect(w.events.some((e) => e.type === 'gameOver')).toBe(true);

    // No respawn loop: a further tick is a no-op once over.
    w.events = [];
    gamestateSystem(w, DT, CFG);
    expect(w.events).toEqual([]);
  });

  it('lives never drop below 0 or exceed the cap', () => {
    const w = makeWorld(1);
    expect(w.player.lives).toBeLessThanOrEqual(MAX_LIVES);
    w.player.lives = 0;
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    gamestateSystem(w, DT, CFG);
    expect(w.player.lives).toBe(0);
    runOutPending(w);
    expect(w.mode).toBe('GAME_OVER');
  });
});

// Giant asteroids (ROC-GIANT-1): fixed, indestructible obstacles — contact is instantly lethal to
// whatever hits them, player or enemy, bypassing the normal graduated ram (which only costs one
// shield ring/hull point and dents the rammer). The obstacle itself is untouched either way.
describe('giant asteroids are lethal solid obstacles', () => {
  it('destroys the player outright on contact, punching through shields instead of costing one ring', () => {
    const w = makeWorld(1);
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 4;
    p.shieldMax = 4;
    p.hull = 2;
    addGiantAsteroid(w, vec3(0, 0, 0)); // overlaps the player at the origin
    gamestateSystem(w, DT, CFG);
    expect(p.shield).toBe(0);
    expect(p.hull).toBe(0); // instantly lethal, not a graduated hit
  });

  it('destroys an enemy or boss on contact, independent of the player and of its own shields', () => {
    const w = makeWorld(1);
    const enemy = addEnemyShip(w, vec3(0, 0, 0));
    enemy.shield = 2;
    enemy.shieldMax = 2;
    enemy.hull = 50;
    enemy.hullMax = 50;
    addGiantAsteroid(w, vec3(0, 0, 0));
    gamestateSystem(w, DT, CFG);
    expect(w.entities.has(enemy.id)).toBe(false); // wrecked outright, shields didn't save it
  });

  it('is itself unaffected by any of these impacts', () => {
    const w = makeWorld(1);
    addEnemyShip(w, vec3(0, 0, 0));
    const giant = addGiantAsteroid(w, vec3(0, 0, 0));
    gamestateSystem(w, DT, CFG);
    expect(w.entities.has(giant.id)).toBe(true);
    expect(giant.hull).toBe(999);
  });

  it('smashes an ordinary drifting asteroid that touches it, same as any other obstacle contact', () => {
    const w = makeWorld(1);
    const id = w.nextId++;
    const rock: Entity = {
      id, kind: 'asteroid', pos: vec3(0, 0, 0), vel: vec3(0, 0, -0.28), yaw: 0, bank: 0,
      hull: 3, hullMax: 3, colliderRx: 0.24, colliderRz: 0.24,
    };
    w.entities.set(id, rock);
    addGiantAsteroid(w, vec3(0, 0, 0));
    gamestateSystem(w, DT, CFG);
    expect(w.entities.has(rock.id)).toBe(false); // smashed apart on contact
  });

  it('never smashes another giant asteroid — only ordinary ones are destructible', () => {
    const w = makeWorld(1);
    const giantA = addGiantAsteroid(w, vec3(0, 0, 0));
    const giantB = addGiantAsteroid(w, vec3(0, 0, 0));
    gamestateSystem(w, DT, CFG);
    expect(w.entities.has(giantA.id)).toBe(true);
    expect(w.entities.has(giantB.id)).toBe(true);
  });
});

// Shield-hug rework: ramming uses hull silhouette vs hull silhouette (each dilated by its own
// shield gap) instead of bounding circles, so a ram lands exactly where the drawn hulls (and
// shield rings) touch. [ROC-DMG-6a, DEFECTS: collision-detection review]
describe('ramming hugs the hull silhouette (not a bounding circle)', () => {
  function loadMesh(id: string): Mesh {
    const p = fileURLToPath(new URL(`../../src/content/meshes/${id}.json`, import.meta.url));
    return JSON.parse(readFileSync(p, 'utf8'));
  }
  const cobra = loadMesh('cobra_mk3');
  const sidewinder = loadMesh('sidewinder');
  const silhouettes: Record<string, Pt[]> = { cobra_mk3: meshSilhouette(cobra), sidewinder: meshSilhouette(sidewinder) };
  const realCfg = {
    ...DEFAULT_GAMESTATE,
    colliderScale: SHIP_SCALE,
    getSilhouette: (id: string) => silhouettes[id],
  };

  function ramWorld(enemyPos: ReturnType<typeof vec3>, playerShield = 0): { w: ReturnType<typeof makeWorld>; player: Entity } {
    const w = makeWorld(1);
    const player = w.entities.get(PLAYER_ID)!;
    player.meshId = 'cobra_mk3';
    player.shield = playerShield;
    player.shieldMax = playerShield;
    player.hull = 3;
    const enemy: Entity = { id: w.nextId++, kind: 'enemy', pos: enemyPos, vel: vec3(), yaw: 0, bank: 0, meshId: 'sidewinder', hull: 99, hullMax: 99 };
    w.entities.set(enemy.id, enemy);
    return { w, player };
  }

  it('does NOT ram head-on at the old (too-early) trigger distance — hulls must actually touch', () => {
    // z=0.2 is the exact separation that the old bounding-circle ram test falsely triggered at,
    // ~14px before the drawn hulls actually met (both unshielded here). [DEFECTS review]
    const { w, player } = ramWorld(vec3(0, 0, 0.2));
    gamestateSystem(w, DT, realCfg);
    expect(player.hull).toBe(3); // no contact damage: hulls are still clear of each other
  });

  it('DOES ram head-on once the hulls actually touch', () => {
    // Shielded here (unlike the unshielded no-touch case above): the player has no hull buffer,
    // so a shield ring is what proves contact landed without also ending the run. [ROC-DMG-2a]
    const { w, player } = ramWorld(vec3(0, 0, 0.14), 1);
    gamestateSystem(w, DT, realCfg);
    expect(player.shield).toBe(0); // contact damage applied
  });

  it('DOES ram a wingtip overlap that the old bounding-circle test used to miss', () => {
    // x=0.24: the old circle-vs-circle test (radius sum 0.21) missed this despite the drawn
    // wingtips visibly overlapping. [DEFECTS review]
    const { w, player } = ramWorld(vec3(0.24, 0, 0), 1);
    gamestateSystem(w, DT, realCfg);
    expect(player.shield).toBe(0);
  });

  it('a shield extends the ram range by its own gap, but still not out to the old false-positive distance', () => {
    const { w, player } = ramWorld(vec3(0, 0, 0.18), 2); // within a 2-ring shield's gap of the hull
    gamestateSystem(w, DT, realCfg);
    expect(player.shield).toBe(1); // rammed (shield ring absorbs it)

    const { w: w2, player: player2 } = ramWorld(vec3(0, 0, 0.2), 2); // still the old defect's distance
    gamestateSystem(w2, DT, realCfg);
    expect(player2.shield).toBe(2); // untouched: even shielded, this is still outside the gap
  });
});
