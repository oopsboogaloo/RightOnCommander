// T6.4: the player can be shot/rammed, and losing all hull spends a life and restarts the
// level — or, with an escape pod, respawns at the death point. Game over at zero lives, and
// lives stay within 0..5. [ROC-LIFE-1..5, ROC-DMG-6a]

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import type { Entity } from '../../src/sim/components.js';
import { gamestateSystem, DEFAULT_GAMESTATE, MAX_LIVES } from '../../src/sim/systems/gamestate.js';
import { collisionSystem, meshSilhouette } from '../../src/sim/systems/collision.js';
import { damageSystem } from '../../src/sim/systems/damage.js';
import { SHIP_SCALE } from '../../src/sim/index.js';
import type { Mesh } from '../../src/interfaces.js';
import type { Pt } from '../../src/sim/math/geom2.js';

const DT = 1 / 120;
const collCfg = { dt: DT, cellSize: 1, getSilhouette: () => undefined, colliderScale: 1 };

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
    gamestateSystem(w, DT, undefined, { ...DEFAULT_GAMESTATE, colliderScale: 1 });
    expect(w.entities.get(PLAYER_ID)!.shield).toBe(3);
    expect(w.player.invulnTtl).toBeGreaterThan(0);
    const before = w.entities.get(PLAYER_ID)!.shield;
    gamestateSystem(w, DT, undefined, { ...DEFAULT_GAMESTATE, colliderScale: 1 });
    expect(w.entities.get(PLAYER_ID)!.shield).toBe(before); // i-frames held
  });

  it('ramming wrecks a fighter and only dents a boss', () => {
    const w = makeWorld(1);
    const fighter = addEnemyShip(w, vec3(0, 0, 0)); // hull 3 < ramDamage 4
    gamestateSystem(w, DT, undefined, { ...DEFAULT_GAMESTATE, colliderScale: 1 });
    expect(w.entities.has(fighter.id)).toBe(false); // destroyed by the ram

    const w2 = makeWorld(1);
    const boss = addEnemyShip(w2, vec3(0, 0, 0));
    boss.kind = 'boss';
    boss.hull = 30;
    boss.hullMax = 30;
    gamestateSystem(w2, DT, undefined, { ...DEFAULT_GAMESTATE, colliderScale: 1 });
    expect(w2.entities.has(boss.id)).toBe(true); // survives
    expect(boss.hull).toBe(26); // chipped by ramDamage
  });
});

describe('death, lives & respawn', () => {
  it('losing all hull spends a life and restarts the level at full health', () => {
    const w = makeWorld(1);
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    p.pos = vec3(0.5, 0, 0.7);
    const restart = vi.fn();
    gamestateSystem(w, DT, restart, { ...DEFAULT_GAMESTATE, colliderScale: 1 });

    expect(w.player.lives).toBe(2);
    expect(restart).toHaveBeenCalledOnce();
    expect(p.hull).toBe(p.hullMax);
    expect(p.shield).toBe(p.shieldMax);
    expect(p.pos).toEqual(vec3(0, 0, 0)); // restart recentres the player
    expect(w.player.invulnTtl).toBeGreaterThan(0);
  });

  it('an escape pod respawns at the death point, consumes the pod and the cargo, no life lost', () => {
    const w = makeWorld(1);
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    p.pos = vec3(0.5, 0, 0.7);
    w.player.escapePod = true;
    w.cargo = { gold: 3 };
    const restart = vi.fn();
    gamestateSystem(w, DT, restart, { ...DEFAULT_GAMESTATE, colliderScale: 1 });

    expect(w.player.lives).toBe(3); // pod saved the life
    expect(w.player.escapePod).toBe(false);
    expect(w.cargo).toEqual({});
    expect(restart).not.toHaveBeenCalled();
    expect(p.pos).toEqual(vec3(0.5, 0, 0.7)); // respawn at the death point
    expect(p.hull).toBe(p.hullMax);
  });

  it('runs out of lives into GAME_OVER and then stops resolving', () => {
    const w = makeWorld(1);
    w.player.lives = 1;
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    gamestateSystem(w, DT, undefined, { ...DEFAULT_GAMESTATE, colliderScale: 1 });
    expect(w.player.lives).toBe(0);
    expect(w.mode).toBe('GAME_OVER');
    expect(w.events.some((e) => e.type === 'gameOver')).toBe(true);

    // No respawn loop: a further tick is a no-op once over.
    w.events = [];
    gamestateSystem(w, DT, undefined, { ...DEFAULT_GAMESTATE, colliderScale: 1 });
    expect(w.events).toEqual([]);
  });

  it('lives never drop below 0 or exceed the cap', () => {
    const w = makeWorld(1);
    expect(w.player.lives).toBeLessThanOrEqual(MAX_LIVES);
    w.player.lives = 0;
    const p = w.entities.get(PLAYER_ID)!;
    p.shield = 0;
    p.hull = 0;
    gamestateSystem(w, DT, undefined, { ...DEFAULT_GAMESTATE, colliderScale: 1 });
    expect(w.player.lives).toBe(0);
    expect(w.mode).toBe('GAME_OVER');
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
    gamestateSystem(w, DT, undefined, realCfg);
    expect(player.hull).toBe(3); // no contact damage: hulls are still clear of each other
  });

  it('DOES ram head-on once the hulls actually touch', () => {
    const { w, player } = ramWorld(vec3(0, 0, 0.14));
    gamestateSystem(w, DT, undefined, realCfg);
    expect(player.hull).toBe(2); // contact damage applied
  });

  it('DOES ram a wingtip overlap that the old bounding-circle test used to miss', () => {
    // x=0.24: the old circle-vs-circle test (radius sum 0.21) missed this despite the drawn
    // wingtips visibly overlapping. [DEFECTS review]
    const { w, player } = ramWorld(vec3(0.24, 0, 0));
    gamestateSystem(w, DT, undefined, realCfg);
    expect(player.hull).toBe(2);
  });

  it('a shield extends the ram range by its own gap, but still not out to the old false-positive distance', () => {
    const { w, player } = ramWorld(vec3(0, 0, 0.18), 2); // within a 2-ring shield's gap of the hull
    gamestateSystem(w, DT, undefined, realCfg);
    expect(player.shield).toBe(1); // rammed (shield ring absorbs it)

    const { w: w2, player: player2 } = ramWorld(vec3(0, 0, 0.2), 2); // still the old defect's distance
    gamestateSystem(w2, DT, undefined, realCfg);
    expect(player2.shield).toBe(2); // untouched: even shielded, this is still outside the gap
  });
});
