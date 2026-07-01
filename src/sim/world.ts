// The serialisable World state container. The whole world is a plain object (incl. RNG
// state), so tests and the balance-sim assert on numbers, never pixels. [design §5]

import { vec3 } from './math/vec3.js';
import type { Entity, SimEvent } from './components.js';
import type { PathParams } from './systems/paths.js';

export const PLAYER_ID = 1;

export interface PlayerState {
  shipClass: string;
  hardpoints: { front: number; rear: number; left: number; right: number }; // capacity per direction [ROC-HP-1,2]
  lasers: { front: string[]; rear: string[]; left: string[]; right: string[] }; // installed lasers per direction
  missileGrade: number;
  missileTimer: number; // seconds left at the current grade [ROC-MIS-4]
  missileCooldown: number; // seconds until the next missile launch
  missileWing: number; // 0/1: which wing launches next (alternates) [ROC-MIS-8]
  ecm: number;
  energyBombs: number;
  escapePod: boolean;
  lives: number;
  fireCooldown: number; // seconds until the next pulse may fire [ROC-LAS-3]
  invulnTtl: number; // post-spawn / post-hit invulnerability, seconds [ROC-LIFE-2]
}

// Pending-spawn schedule for an active wave (kept in the World so replays are deterministic).
export interface WaveSpawnState {
  pattern: string;
  enemy: string;
  params: PathParams;
  count: number;
  spacingSec: number; // delay between member spawns
  durationSec: number; // each member's path lifetime (t: 0 -> 1)
  pending: number; // members not yet spawned
  timer: number; // seconds until the next spawn
  spawnedIndex: number; // how many have spawned (for per-member variation)
  fireRate: number; // enemy shots/sec (0 = doesn't fire) [ROC-ENM-11]
  fireAimed: boolean; // aim at the player vs fire straight down
}

export interface WaveRecord {
  members: Set<number>; // currently-alive member ids
  total: number; // member count
  bountySum: number; // summed member bounty
  killed: number; // members destroyed by the player
  escaped: boolean; // any member flew off-field (forfeits the bonus) [ROC-ECO-1a]
  spawn: WaveSpawnState | null;
}

// Pending-spawn schedule for the level-opening asteroid field (drifting rocks that tumble in
// place, fragment into faster splinters when shot). [ROC-L1-1]
export interface AsteroidFieldState {
  pending: number; // large asteroids not yet spawned
  timer: number; // seconds until the next spawn
  spacingSec: number;
  speed: number; // downward drift speed, world units/sec
  xSpread: number; // half-width of the spawn x range
}

export interface World {
  frame: number;
  rngState: number;
  mode: string; // gamestate FSM tag
  levelIndex: number;
  levelState: string; // levelstate FSM tag
  levelTimer: number; // seconds remaining for timed level phases (launch/dock)
  difficulty: number; // global difficulty (1 = normal); scales count + enemy stats [ROC-DIF-1,2]
  entities: Map<number, Entity>;
  nextId: number;
  player: PlayerState;
  econ: { wallet: number; score: number }; // credits vs lifetime score [ROC-ECO-2]
  cargo: Record<string, number>; // type -> tonnage, sellable at dock
  rating: { kills: number; weightedTally: number; rank: string }; // [ROC-RTG-1]
  waves: { active: Map<number, WaveRecord> }; // [ROC-ECO-1a]
  asteroidField: AsteroidFieldState | null; // active level-opening asteroid field, if any [ROC-L1-1]
  unlocks: { eliteMode: boolean; thargoidShip: boolean }; // [ROC-PROG-1,2]
  events: SimEvent[]; // drained by shell each step
  pool: { projectiles: Entity[]; particles: Entity[]; missiles: Entity[] }; // recycled; not serialised
}

export function makeWorld(seed: number): World {
  const player: Entity = {
    id: PLAYER_ID,
    kind: 'player',
    pos: vec3(0, 0, 0),
    vel: vec3(0, 0, 0),
    yaw: 0,
    bank: 0,
    // Start in a Sidewinder (matches content/ships.json). [ROC-SHIP-1,2,3]
    meshId: 'sidewinder',
    shield: 1,
    shieldMax: 1,
    hull: 2,
    hullMax: 2,
    colliderRx: 0.3, // play-plane hit ellipse (full-mesh; collision scales by SHIP_SCALE)
    colliderRz: 0.3,
  };

  const entities = new Map<number, Entity>();
  entities.set(PLAYER_ID, player);

  return {
    frame: 0,
    rngState: seed >>> 0,
    mode: 'TITLE',
    levelIndex: 0,
    levelState: 'LAUNCH',
    levelTimer: 0,
    difficulty: 1,
    entities,
    nextId: PLAYER_ID + 1,
    player: {
      shipClass: 'sidewinder',
      hardpoints: { front: 2, rear: 1, left: 0, right: 0 }, // matches ships.json Sidewinder
      lasers: { front: ['pulse'], rear: [], left: [], right: [] },
      missileGrade: 0,
      missileTimer: 0,
      missileCooldown: 0,
      missileWing: 0,
      ecm: 0,
      energyBombs: 0,
      escapePod: false,
      lives: 3,
      fireCooldown: 0,
      invulnTtl: 0,
    },
    econ: { wallet: 0, score: 0 },
    cargo: {},
    rating: { kills: 0, weightedTally: 0, rank: 'Harmless' },
    waves: { active: new Map<number, WaveRecord>() },
    asteroidField: null,
    unlocks: { eliteMode: false, thargoidShip: false },
    events: [],
    pool: { projectiles: [], particles: [], missiles: [] },
  };
}
