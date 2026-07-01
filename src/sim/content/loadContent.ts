// Parse + schema-validate content JSON into typed sim structures. Throws on malformed data so
// bad content fails fast (in CI) rather than at runtime. [tasks T5.2, design §2; ROC-ENM-7,8]

import type { EnemyDef, WaveDef } from '../systems/waves.js';
import type { LevelDef } from '../systems/levelstate.js';
import type { AsteroidFieldDef } from '../systems/asteroids.js';
import { PATTERNS } from '../systems/paths.js';

export interface Content {
  enemies: Record<string, EnemyDef>;
  level?: LevelDef;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, where: string): number => {
  if (typeof v !== 'number' || Number.isNaN(v)) throw new Error(`content: expected number at ${where}`);
  return v;
};

function parseEnemies(raw: unknown): Record<string, EnemyDef> {
  if (!isObj(raw)) throw new Error('content: "enemies" must be an object');
  const out: Record<string, EnemyDef> = {};
  for (const [name, v] of Object.entries(raw)) {
    if (!isObj(v)) throw new Error(`content: enemy '${name}' must be an object`);
    out[name] = {
      hull: num(v.hull, `enemy ${name}.hull`),
      bounty: num(v.bounty, `enemy ${name}.bounty`),
      shield: v.shield === undefined ? undefined : num(v.shield, `enemy ${name}.shield`),
      meshId: typeof v.meshId === 'string' ? v.meshId : undefined,
      colliderRx: v.colliderRx === undefined ? undefined : num(v.colliderRx, `enemy ${name}.colliderRx`),
      colliderRz: v.colliderRz === undefined ? undefined : num(v.colliderRz, `enemy ${name}.colliderRz`),
    };
  }
  return out;
}

function parseWave(raw: unknown, enemies: Record<string, EnemyDef>, where: string): WaveDef {
  if (!isObj(raw)) throw new Error(`content: ${where} must be an object`);
  const pattern = raw.pattern;
  if (typeof pattern !== 'string' || !(pattern in PATTERNS)) {
    throw new Error(`content: ${where} has unknown pattern '${String(pattern)}'`);
  }
  const enemy = raw.enemy;
  if (typeof enemy !== 'string' || !(enemy in enemies)) {
    throw new Error(`content: ${where} references unknown enemy '${String(enemy)}'`);
  }
  const fire = isObj(raw.fire)
    ? { rate: num(raw.fire.rate, `${where}.fire.rate`), aimed: !!raw.fire.aimed }
    : undefined;
  return {
    id: typeof raw.id === 'string' ? raw.id : where,
    pattern,
    enemy,
    count: num(raw.count, `${where}.count`),
    spacingMs: num(raw.spacingMs, `${where}.spacingMs`),
    delayMs: raw.delayMs === undefined ? undefined : num(raw.delayMs, `${where}.delayMs`),
    durationMs: raw.durationMs === undefined ? undefined : num(raw.durationMs, `${where}.durationMs`),
    speed: raw.speed === undefined ? undefined : num(raw.speed, `${where}.speed`),
    params: isObj(raw.params) ? (raw.params as Record<string, number>) : undefined,
    fire,
  };
}

function parseAsteroidWave(raw: unknown, where: string): AsteroidFieldDef {
  if (!isObj(raw)) throw new Error(`content: ${where} must be an object`);
  return {
    count: num(raw.count, `${where}.count`),
    spacingMs: num(raw.spacingMs, `${where}.spacingMs`),
    delayMs: raw.delayMs === undefined ? undefined : num(raw.delayMs, `${where}.delayMs`),
    speed: raw.speed === undefined ? undefined : num(raw.speed, `${where}.speed`),
    xSpread: raw.xSpread === undefined ? undefined : num(raw.xSpread, `${where}.xSpread`),
  };
}

function parseLevel(raw: unknown, enemies: Record<string, EnemyDef>): LevelDef {
  if (!isObj(raw)) throw new Error('content: "level" must be an object');
  const boss = (key: string): string => {
    const name = raw[key];
    if (typeof name !== 'string' || !(name in enemies)) {
      throw new Error(`content: level.${key} references unknown enemy '${String(name)}'`);
    }
    return name;
  };
  const group = (key: string): WaveDef[] => {
    const arr = raw[key];
    if (!Array.isArray(arr)) throw new Error(`content: level.${key} must be an array`);
    return arr.map((w, i) => parseWave(w, enemies, `level.${key}[${i}]`));
  };
  const asteroidWaves = raw.asteroidWaves;
  if (asteroidWaves !== undefined && !Array.isArray(asteroidWaves)) {
    throw new Error('content: "level.asteroidWaves" must be an array');
  }
  return {
    id: typeof raw.id === 'string' ? raw.id : 'level',
    launchMs: raw.launchMs === undefined ? undefined : num(raw.launchMs, 'level.launchMs'),
    asteroidWaves: asteroidWaves?.map((w, i) => parseAsteroidWave(w, `level.asteroidWaves[${i}]`)),
    wavesA: group('wavesA'),
    midBoss: boss('midBoss'),
    wavesB: group('wavesB'),
    endBoss: boss('endBoss'),
    viper: raw.viper === undefined ? undefined : parseWave(raw.viper, enemies, 'level.viper'),
  };
}

export function loadContent(raw: unknown): Content {
  if (!isObj(raw)) return { enemies: {} };
  const enemies = parseEnemies(raw.enemies ?? {});
  const level = raw.level === undefined ? undefined : parseLevel(raw.level, enemies);
  return { enemies, level };
}
