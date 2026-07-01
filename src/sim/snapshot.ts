// Serialise / restore the full World (incl. rng state and frame) as a plain JSON-safe
// object. Maps and Sets are flattened to arrays so snapshots deep-equal cleanly and can
// be stored or replayed. [ROC-TEST-4,5]

import type { Entity } from './components.js';
import type { AsteroidFieldState, PlayerState, WaveSpawnState, World } from './world.js';

export interface WorldSnapshot {
  frame: number;
  rngState: number;
  mode: string;
  levelIndex: number;
  levelState: string;
  levelTimer: number;
  difficulty: number;
  entities: Entity[];
  nextId: number;
  player: PlayerState;
  econ: { wallet: number; score: number };
  cargo: Record<string, number>;
  rating: { kills: number; weightedTally: number; rank: string };
  waves: {
    active: {
      id: number;
      members: number[];
      total: number;
      bountySum: number;
      killed: number;
      escaped: boolean;
      spawn: WaveSpawnState | null;
    }[];
  };
  unlocks: { eliteMode: boolean; thargoidShip: boolean };
  asteroidField: AsteroidFieldState | null;
}

export function snapshot(world: World): WorldSnapshot {
  return {
    frame: world.frame,
    rngState: world.rngState,
    mode: world.mode,
    levelIndex: world.levelIndex,
    levelState: world.levelState,
    levelTimer: world.levelTimer,
    difficulty: world.difficulty,
    entities: Array.from(world.entities.values()).map((e) => structuredClone(e)),
    nextId: world.nextId,
    player: structuredClone(world.player),
    econ: { ...world.econ },
    cargo: { ...world.cargo },
    rating: { ...world.rating },
    waves: {
      active: Array.from(world.waves.active.entries()).map(([id, rec]) => ({
        id,
        members: Array.from(rec.members),
        total: rec.total,
        bountySum: rec.bountySum,
        killed: rec.killed,
        escaped: rec.escaped,
        spawn: rec.spawn ? { ...rec.spawn, params: { ...rec.spawn.params } } : null,
      })),
    },
    unlocks: { ...world.unlocks },
    asteroidField: world.asteroidField ? { ...world.asteroidField } : null,
  };
}

// Restore in place so existing references to `world` stay valid.
export function restore(world: World, snap: WorldSnapshot): void {
  world.frame = snap.frame;
  world.rngState = snap.rngState;
  world.mode = snap.mode;
  world.levelIndex = snap.levelIndex;
  world.levelState = snap.levelState;
  world.levelTimer = snap.levelTimer;
  world.difficulty = snap.difficulty;

  world.entities = new Map(structuredClone(snap.entities).map((e) => [e.id, e]));
  world.nextId = snap.nextId;
  world.player = structuredClone(snap.player);
  world.econ = { ...snap.econ };
  world.cargo = { ...snap.cargo };
  world.rating = { ...snap.rating };

  world.waves = {
    active: new Map(
      snap.waves.active.map((rec) => [
        rec.id,
        {
          members: new Set(rec.members),
          total: rec.total,
          bountySum: rec.bountySum,
          killed: rec.killed,
          escaped: rec.escaped,
          spawn: rec.spawn ? { ...rec.spawn, params: { ...rec.spawn.params } } : null,
        },
      ]),
    ),
  };
  world.unlocks = { ...snap.unlocks };
  world.asteroidField = snap.asteroidField ? { ...snap.asteroidField } : null;
  world.events = [];
  world.pool = { projectiles: [], particles: [], missiles: [] }; // allocation cache; safe to drop on restore
}
