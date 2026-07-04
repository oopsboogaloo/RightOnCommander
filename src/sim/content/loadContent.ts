// Parse + schema-validate content JSON into typed sim structures. Throws on malformed data so
// bad content fails fast (in CI) rather than at runtime. [tasks T5.2, design §2; ROC-ENM-7,8]

import type { EnemyDef, WaveDef } from '../systems/waves.js';
import type { LevelDef } from '../systems/levelstate.js';
import type { AsteroidFieldDef } from '../systems/asteroids.js';
import type { StarFlareDef } from '../systems/hazards.js';
import { PATTERNS } from '../systems/paths.js';

export interface Content {
  enemies: Record<string, EnemyDef>;
  levels: LevelDef[]; // the campaign, in play order; `world.levelIndex` selects the active one [ROC-LVL-1,2]
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, where: string): number => {
  if (typeof v !== 'number' || Number.isNaN(v)) throw new Error(`content: expected number at ${where}`);
  return v;
};

const BOSS_BEHAVIORS = ['hermit', 'strafe'] as const;

function parseEnemies(raw: unknown): Record<string, EnemyDef> {
  if (!isObj(raw)) throw new Error('content: "enemies" must be an object');
  const out: Record<string, EnemyDef> = {};
  for (const [name, v] of Object.entries(raw)) {
    if (!isObj(v)) throw new Error(`content: enemy '${name}' must be an object`);
    if (v.behavior !== undefined && !BOSS_BEHAVIORS.includes(v.behavior as (typeof BOSS_BEHAVIORS)[number])) {
      throw new Error(`content: enemy '${name}' has unknown behavior '${String(v.behavior)}'`);
    }
    out[name] = {
      hull: num(v.hull, `enemy ${name}.hull`),
      bounty: num(v.bounty, `enemy ${name}.bounty`),
      shield: v.shield === undefined ? undefined : num(v.shield, `enemy ${name}.shield`),
      meshId: typeof v.meshId === 'string' ? v.meshId : undefined,
      colliderRx: v.colliderRx === undefined ? undefined : num(v.colliderRx, `enemy ${name}.colliderRx`),
      colliderRz: v.colliderRz === undefined ? undefined : num(v.colliderRz, `enemy ${name}.colliderRz`),
      scale: v.scale === undefined ? undefined : num(v.scale, `enemy ${name}.scale`),
      ecm: v.ecm === undefined ? undefined : !!v.ecm,
      behavior: v.behavior as EnemyDef['behavior'],
      cargoDrops: v.cargoDrops === undefined ? undefined : num(v.cargoDrops, `enemy ${name}.cargoDrops`),
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
  const oneBoss = (key: string, name: unknown): string => {
    if (typeof name !== 'string' || !(name in enemies)) {
      throw new Error(`content: level.${key} references unknown enemy '${String(name)}'`);
    }
    return name;
  };
  const boss = (key: string): string => oneBoss(key, raw[key]);
  // midBoss alone may be a pack fought together (e.g. a pair). [ROC-L3-3]
  const bossOrPack = (key: string): string | string[] => {
    const v = raw[key];
    return Array.isArray(v) ? v.map((n, i) => oneBoss(`${key}[${i}]`, n)) : oneBoss(key, v);
  };
  const group = (key: string): WaveDef[] => {
    const arr = raw[key];
    if (!Array.isArray(arr)) throw new Error(`content: level.${key} must be an array`);
    return arr.map((w, i) => parseWave(w, enemies, `level.${key}[${i}]`));
  };
  const asteroidGroup = (key: string): AsteroidFieldDef[] | undefined => {
    const arr = raw[key];
    if (arr === undefined) return undefined;
    if (!Array.isArray(arr)) throw new Error(`content: "level.${key}" must be an array`);
    return arr.map((w, i) => parseAsteroidWave(w, `level.${key}[${i}]`));
  };
  const facts = raw.facts;
  if (facts !== undefined && (!Array.isArray(facts) || facts.some((f) => typeof f !== 'string'))) {
    throw new Error('content: "level.facts" must be an array of strings');
  }
  const starFlareRaw = raw.starFlare;
  const starFlare: StarFlareDef | undefined = starFlareRaw === undefined
    ? undefined
    : (() => {
        if (!isObj(starFlareRaw)) throw new Error('content: "level.starFlare" must be an object');
        return {
          intervalSec: num(starFlareRaw.intervalSec, 'level.starFlare.intervalSec'),
          warnSec: num(starFlareRaw.warnSec, 'level.starFlare.warnSec'),
          zoneX: num(starFlareRaw.zoneX, 'level.starFlare.zoneX'),
          damage: num(starFlareRaw.damage, 'level.starFlare.damage'),
        };
      })();
  return {
    id: typeof raw.id === 'string' ? raw.id : 'level',
    name: typeof raw.name === 'string' ? raw.name : undefined,
    facts: facts as string[] | undefined,
    launchMs: raw.launchMs === undefined ? undefined : num(raw.launchMs, 'level.launchMs'),
    asteroidWaves: asteroidGroup('asteroidWaves'),
    midAsteroids: asteroidGroup('midAsteroids'),
    combatAsteroids: asteroidGroup('combatAsteroids'),
    wavesA: group('wavesA'),
    midBoss: bossOrPack('midBoss'),
    wavesB: group('wavesB'),
    endBoss: boss('endBoss'),
    viper: raw.viper === undefined ? undefined : parseWave(raw.viper, enemies, 'level.viper'),
    starFlare,
    witchspace: raw.witchspace === undefined ? undefined : parseWave(raw.witchspace, enemies, 'level.witchspace'),
  };
}

export function loadContent(raw: unknown): Content {
  if (!isObj(raw)) return { enemies: {}, levels: [] };
  const enemies = parseEnemies(raw.enemies ?? {});
  const levelsRaw = raw.levels;
  if (levelsRaw !== undefined && !Array.isArray(levelsRaw)) throw new Error('content: "levels" must be an array');
  const levels = Array.isArray(levelsRaw) ? levelsRaw.map((l) => parseLevel(l, enemies)) : [];
  return { enemies, levels };
}
