// Per-level finite state machine. Every level launches from a Coriolis station, plays wave
// combat around a mid-boss and an end-boss, optionally fights a Viper interception if the
// player is carrying contraband, then docks. [tasks T5.1, design §12, ROC-LVL-1,2]
//
//   LAUNCH -> WAVES_A -> MID_BOSS -> WAVES_B -> END_BOSS -> [VIPER_INTERCEPT] -> DOCK

import { vec3 } from '../math/vec3.js';
import type { Entity } from '../components.js';
import type { World } from '../world.js';
import { startWave, type WaveDef, type WaveContext } from './waves.js';

export type LevelState =
  | 'LAUNCH'
  | 'WAVES_A'
  | 'MID_BOSS'
  | 'WAVES_B'
  | 'END_BOSS'
  | 'VIPER_INTERCEPT'
  | 'DOCK';

export interface LevelDef {
  id: string;
  launchMs?: number;
  wavesA: WaveDef[];
  midBoss: string; // enemy name (spawned as a boss)
  wavesB: WaveDef[];
  endBoss: string;
  viper?: WaveDef; // contraband interception wave
}

const hasKind = (world: World, kind: Entity['kind']): boolean => {
  for (const e of world.entities.values()) if (e.kind === kind) return true;
  return false;
};

// A wave group is clear when no waves remain active and no members are alive. [ROC-ENM-1]
const groupCleared = (world: World): boolean => world.waves.active.size === 0 && !hasKind(world, 'enemy');
const bossCleared = (world: World): boolean => !hasKind(world, 'boss');
const hasContraband = (world: World): boolean => (world.cargo.contraband ?? 0) > 0; // [ROC-ECO-4, ROC-LVL-4]

function startGroup(world: World, waves: WaveDef[], ctx: WaveContext): void {
  for (const w of waves) startWave(world, w, ctx);
}

function spawnBoss(world: World, name: string, ctx: WaveContext, drops?: string): void {
  const def = ctx.enemies[name];
  if (!def) throw new Error(`unknown boss '${name}'`);
  const id = world.nextId++;
  world.entities.set(id, {
    id,
    kind: 'boss',
    pos: vec3(0, 0, 1.2),
    vel: vec3(),
    yaw: 0,
    bank: 0,
    hull: def.hull,
    hullMax: def.hull,
    shield: def.shield ?? 0,
    shieldMax: def.shield ?? 0,
    bounty: def.bounty,
    meshId: def.meshId,
    colliderRx: def.colliderRx,
    colliderRz: def.colliderRz,
    drops,
  });
}

// Transition into a state, running its entry effects once.
function enter(world: World, state: LevelState, level: LevelDef, ctx: WaveContext): void {
  world.levelState = state;
  world.events.push({ type: 'levelState', state });
  switch (state) {
    case 'LAUNCH':
      world.levelTimer = (level.launchMs ?? 1000) / 1000;
      break;
    case 'WAVES_A':
      startGroup(world, level.wavesA, ctx);
      break;
    case 'MID_BOSS':
      spawnBoss(world, level.midBoss, ctx, 'laser'); // mid-boss always drops a laser [ROC-PWR-6]
      break;
    case 'WAVES_B':
      startGroup(world, level.wavesB, ctx);
      break;
    case 'END_BOSS':
      spawnBoss(world, level.endBoss, ctx);
      break;
    case 'VIPER_INTERCEPT':
      if (level.viper) startWave(world, level.viper, ctx);
      break;
    case 'DOCK':
      world.events.push({ type: 'dock' }); // [ROC-LVL-1]
      break;
  }
}

export function startLevel(world: World, level: LevelDef, ctx: WaveContext): void {
  enter(world, 'LAUNCH', level, ctx);
}

export function levelStateSystem(world: World, dt: number, level: LevelDef, ctx: WaveContext): void {
  switch (world.levelState as LevelState) {
    case 'LAUNCH':
      world.levelTimer -= dt;
      if (world.levelTimer <= 0) enter(world, 'WAVES_A', level, ctx);
      break;
    case 'WAVES_A':
      if (groupCleared(world)) enter(world, 'MID_BOSS', level, ctx);
      break;
    case 'MID_BOSS':
      if (bossCleared(world)) enter(world, 'WAVES_B', level, ctx);
      break;
    case 'WAVES_B':
      if (groupCleared(world)) enter(world, 'END_BOSS', level, ctx);
      break;
    case 'END_BOSS':
      if (bossCleared(world)) enter(world, hasContraband(world) ? 'VIPER_INTERCEPT' : 'DOCK', level, ctx);
      break;
    case 'VIPER_INTERCEPT':
      if (groupCleared(world)) enter(world, 'DOCK', level, ctx);
      break;
    case 'DOCK':
      break; // terminal — gamestate takes over at the station
  }
}
