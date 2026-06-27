// The serialisable World state container. The whole world is a plain object (incl. RNG
// state), so tests and the balance-sim assert on numbers, never pixels. [design §5]

import { vec3 } from './math/vec3.js';
import type { Entity, SimEvent } from './components.js';

export const PLAYER_ID = 1;

export interface PlayerState {
  shipClass: string;
  hardpoints: number;
  lasers: { front: string | null; rear: string | null; left: string | null; right: string | null };
  missileGrade: number;
  missileTimer: number;
  ecm: number;
  energyBombs: number;
  escapePod: boolean;
  lives: number;
}

export interface WaveRecord {
  members: Set<number>;
  total: number;
  bountySum: number;
}

export interface World {
  frame: number;
  rngState: number;
  mode: string; // gamestate FSM tag
  levelIndex: number;
  levelState: string; // levelstate FSM tag
  entities: Map<number, Entity>;
  nextId: number;
  player: PlayerState;
  econ: { wallet: number; score: number }; // credits vs lifetime score [ROC-ECO-2]
  cargo: Record<string, number>; // type -> tonnage, sellable at dock
  rating: { kills: number; weightedTally: number; rank: string }; // [ROC-RTG-1]
  waves: { active: Map<number, WaveRecord> }; // [ROC-ECO-1a]
  unlocks: { eliteMode: boolean; thargoidShip: boolean }; // [ROC-PROG-1,2]
  events: SimEvent[]; // drained by shell each step
}

export function makeWorld(seed: number): World {
  const player: Entity = {
    id: PLAYER_ID,
    kind: 'player',
    pos: vec3(0, 0, 0),
    vel: vec3(0, 0, 0),
    yaw: 0,
    bank: 0,
    meshId: 'cobra_mk3',
    shield: 4,
    shieldMax: 4,
    hull: 16,
    hullMax: 16,
  };

  const entities = new Map<number, Entity>();
  entities.set(PLAYER_ID, player);

  return {
    frame: 0,
    rngState: seed >>> 0,
    mode: 'TITLE',
    levelIndex: 0,
    levelState: 'LAUNCH',
    entities,
    nextId: PLAYER_ID + 1,
    player: {
      shipClass: 'cobra_mk3',
      hardpoints: 4,
      lasers: { front: 'pulse', rear: null, left: null, right: null },
      missileGrade: 0,
      missileTimer: 0,
      ecm: 0,
      energyBombs: 0,
      escapePod: false,
      lives: 3,
    },
    econ: { wallet: 0, score: 0 },
    cargo: {},
    rating: { kills: 0, weightedTally: 0, rank: 'Harmless' },
    waves: { active: new Map<number, WaveRecord>() },
    unlocks: { eliteMode: false, thargoidShip: false },
    events: [],
  };
}
