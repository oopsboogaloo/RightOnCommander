// Per-level finite state machine. Every level launches from a Coriolis station (which scrolls
// away behind the player), jumps through hyperspace with a countdown and starfield stretch,
// shows a system info card, drifts through an opening asteroid field, plays wave combat around
// a mid-boss and an end-boss (starfield scroll stops for each fight; "RIGHT ON COMMANDER" fades
// after each kill), optionally fights a Viper interception if the player is carrying contraband,
// then docks at a rotating Coriolis by flying into its port. A level whose jump lingers in
// witchspace (only Level 3's, for the L2->3 transition) skips the settle-back at the end of
// HYPERSPACE and instead holds the stretched starfield for a Thargoid wave, only settling and
// proceeding to INFO once it's cleared. [tasks T5.1/T5a.*/T7.1a, design §12/§12a, ROC-LVL-1,2,
// ROC-L1-1, ROC-BOSS-1..4, ROC-HYP-1..5, ROC-DCKG-1..4, ROC-WITCH-1..4]
//
//   LAUNCH -> HYPERSPACE -> [WITCHSPACE_COMBAT] -> INFO -> [ASTEROIDS] -> WAVES_A -> MID_BOSS
//     -> WAVES_B -> END_BOSS -> [VIPER_INTERCEPT] -> DOCKING -> DOCK

import { vec3 } from '../math/vec3.js';
import type { Entity } from '../components.js';
import { type World } from '../world.js';
import { startWave, type WaveDef, type WaveContext } from './waves.js';
import { startAsteroidWaves, startGiantAsteroids, type AsteroidFieldDef, type GiantAsteroidDef, type GiantAsteroidPhase } from './asteroids.js';
import { bossPlacement } from './boss.js';

export type LevelState =
  | 'LAUNCH'
  | 'HYPERSPACE'
  | 'WITCHSPACE_COMBAT'
  | 'INFO'
  | 'ASTEROIDS'
  | 'WAVES_A'
  | 'ASTEROIDS_B'
  | 'MID_BOSS'
  | 'WAVES_B'
  | 'END_BOSS'
  | 'VIPER_INTERCEPT'
  | 'DOCKING'
  | 'DOCK';

export interface LevelDef {
  id: string;
  name?: string; // the target system, shown in the hyperspace countdown [ROC-HYP-2]
  facts?: string[]; // a few classic-Elite facts for the post-jump info card [ROC-HYP-5]
  launchMs?: number;
  asteroidWaves?: AsteroidFieldDef[]; // opening asteroid waves, if the level has any [ROC-L1-1]
  midAsteroids?: AsteroidFieldDef[]; // a second dense field just before the mid-boss [ROC-L1-1]
  combatAsteroids?: AsteroidFieldDef[]; // a light trickle that drifts through the ship-wave groups
  giantAsteroids?: GiantAsteroidDef[]; // fixed, indestructible obstacles placed across the level [ROC-GIANT-1]
  wavesA: WaveDef[];
  midBoss: string | string[]; // enemy name(s) spawned as a boss; multiple names fight together (e.g. a pair) [ROC-L3-3]
  wavesB: WaveDef[];
  endBoss: string;
  viper?: WaveDef; // contraband interception wave
  witchspace?: WaveDef; // a Thargoid wave that must be cleared before the jump resolves; set only
  // on the level entered via the witchspace interlude (Level 3, L2->3) [ROC-WITCH-1..4]
}

// ---- timings & tuning ------------------------------------------------------

export const BOSS_FADE_SEC = 2.5; // "RIGHT ON COMMANDER" display + fade [ROC-BOSS-3]
export const INFO_SEC = 4; // post-jump system info card [ROC-HYP-5]
const DEFAULT_LAUNCH_MS = 2500; // long enough for the departure Coriolis to scroll away [ROC-HYP-1]

// Hyperspace: a 5-second countdown, then the starfield accelerates and the dots stretch into
// full-height lines, hold, and settle back to the normal scroll. [ROC-HYP-2,3,4]
export const HYPER = {
  countdownSec: 5,
  rampSec: 1.0,
  holdSec: 2.5,
  settleSec: 1.0,
  peak: 30, // scroll factor at full stretch; the renderer maps this to full-height lines
};
export const HYPER_TOTAL_SEC = HYPER.countdownSec + HYPER.rampSec + HYPER.holdSec + HYPER.settleSec;

const smoothstep = (u: number): number => u * u * (3 - 2 * u);

// The scroll factor at a point through the hyperspace sequence. [ROC-HYP-3,4]
export function hyperScrollAt(elapsed: number): number {
  const t = elapsed - HYPER.countdownSec;
  if (t <= 0) return 1;
  if (t < HYPER.rampSec) return 1 + (HYPER.peak - 1) * smoothstep(t / HYPER.rampSec);
  if (t < HYPER.rampSec + HYPER.holdSec) return HYPER.peak;
  const settle = (t - HYPER.rampSec - HYPER.holdSec) / HYPER.settleSec;
  if (settle < 1) return 1 + (HYPER.peak - 1) * (1 - smoothstep(settle));
  return 1;
}

// Remaining whole seconds of the countdown for display ("Hyperspace Lave 5"), or null once the
// jump itself has begun. Derived from levelTimer so the shell needs no extra state. [ROC-HYP-2]
export function hyperCountdown(levelTimer: number): number | null {
  const elapsed = HYPER_TOTAL_SEC - levelTimer;
  const remaining = HYPER.countdownSec - elapsed;
  return remaining > 0 ? Math.ceil(remaining - 1e-9) : null;
}

// The end-of-level Coriolis: scrolls in from the top, holds while it slowly rotates, then the
// game moves to the shop automatically. It is purely a backdrop now — no collision, no fly-in
// docking (that minigame wasn't fun). [ROC-DCKG-1]
export const DOCK_STATION = {
  scale: 2,
  spawnZ: 2.4,
  holdZ: 0.55,
  approachSpeed: 0.4,
  spin: 0.25, // rad/s roll about the docking axis — matches the hermit's slow spin
};
export const DOCK_SETTLE_SEC = 1.2; // beat after the station is fully in view before the shop opens [ROC-DCKG-1]

// The departure Coriolis the player launches from, pointing up-screen. [ROC-HYP-1]
const DEPART_STATION = { scale: 2, spawnZ: -0.35, speed: 0.55, cullZ: -2.4 };

// ---- helpers ----------------------------------------------------------------

const hasKind = (world: World, kind: Entity['kind']): boolean => {
  for (const e of world.entities.values()) if (e.kind === kind) return true;
  return false;
};

// A wave group is clear when no waves remain active and no members are alive. [ROC-ENM-1]
const groupCleared = (world: World): boolean => world.waves.active.size === 0 && !hasKind(world, 'enemy');
const bossCleared = (world: World): boolean => !hasKind(world, 'boss');
const hasContraband = (world: World): boolean => (world.cargo.contraband ?? 0) > 0; // [ROC-ECO-4, ROC-LVL-4]

// Clear once every wave has finished spawning and no asteroid remains (large or splinter). [ROC-L1-1]
const asteroidFieldCleared = (world: World): boolean =>
  world.asteroidWaves.every((w) => w.pending <= 0) && !hasKind(world, 'asteroid');

function startGroup(world: World, waves: WaveDef[], ctx: WaveContext): void {
  for (const w of waves) startWave(world, w, ctx);
}

// Register whichever authored giant asteroids belong to this phase, if any. [ROC-GIANT-1]
function startPhaseGiants(world: World, level: LevelDef, phase: GiantAsteroidPhase): void {
  const defs = level.giantAsteroids?.filter((g) => g.phase === phase);
  if (defs?.length) startGiantAsteroids(world, defs);
}

interface StationAi {
  kind: 'dock' | 'depart';
  spin: number;
  holdZ?: number;
}

function spawnStation(world: World, ai: StationAi, pos: { x: number; z: number }, vz: number, yaw: number): Entity {
  const id = world.nextId++;
  const e: Entity = {
    id,
    kind: 'station',
    pos: vec3(pos.x, 0, pos.z),
    vel: vec3(0, 0, vz),
    yaw,
    bank: 0,
    meshId: 'coriolis',
    scale: DOCK_STATION.scale,
    port: true,
    ai,
  };
  world.entities.set(id, e);
  return e;
}

function deleteStations(world: World): void {
  for (const e of [...world.entities.values()]) if (e.kind === 'station') world.entities.delete(e.id);
}

function spawnBoss(world: World, name: string, ctx: WaveContext, drops?: string, slot = 0): void {
  const def = ctx.enemies[name];
  if (!def) throw new Error(`unknown boss '${name}'`);
  const place = bossPlacement(def.behavior, slot);
  const id = world.nextId++;
  world.entities.set(id, {
    id,
    kind: 'boss',
    pos: vec3(place.pos.x, place.pos.y, place.pos.z),
    vel: vec3(),
    yaw: place.yaw,
    bank: 0,
    hull: def.hull,
    hullMax: def.hull,
    shield: def.shield ?? 0,
    shieldMax: def.shield ?? 0,
    bounty: def.bounty,
    meshId: def.meshId,
    scale: def.scale,
    colliderRx: def.colliderRx,
    colliderRz: def.colliderRz,
    drops,
    cargoDrops: def.cargoDrops,
    ecm: def.ecm, // boss ECM: player missiles detonate harmlessly [ROC-BECM-*]
    port: place.port,
    ai: place.ai,
  });

  // The hermit's escorts across the whole fight form one open wave for the 50% bonus; it stays
  // open (never resolving) until the hermit dies. [ROC-HERM-12]
  if (def.behavior === 'hermit') {
    const recId = world.nextId++;
    world.waves.active.set(recId, {
      members: new Set(),
      total: 0,
      bountySum: 0,
      killed: 0,
      escaped: false,
      spawn: null,
      open: true,
    });
    world.hermitWaveId = recId;
  }
}

// Transition into a state, running its entry effects once. Exported so death checkpoints can
// re-enter WAVES_B / DOCK directly. [ROC-BOSS-6, ROC-DCKG-4]
export function enterLevelState(world: World, state: LevelState, level: LevelDef, ctx: WaveContext): void {
  world.levelState = state;
  world.events.push({ type: 'levelState', state });
  switch (state) {
    case 'LAUNCH':
      // The departure Coriolis sits just behind the player, pointing up-screen, and scrolls
      // out of view below. [ROC-HYP-1]
      world.levelTimer = (level.launchMs ?? DEFAULT_LAUNCH_MS) / 1000;
      spawnStation(world, { kind: 'depart', spin: 0 }, { x: 0, z: DEPART_STATION.spawnZ }, -DEPART_STATION.speed, Math.PI / 2);
      break;
    case 'HYPERSPACE':
      world.levelTimer = HYPER_TOTAL_SEC;
      world.events.push({ type: 'hyperCountdown', n: HYPER.countdownSec, system: level.name ?? level.id });
      break;
    case 'WITCHSPACE_COMBAT':
      // The jump lingers: the starfield holds at full stretch instead of settling, for a Thargoid
      // wave the player must clear before it resolves. `levelTimer` doubles as a sentinel here:
      // negative while the wave is still up, then the settle countdown once it's cleared. [ROC-WITCH-1,2]
      world.scroll = HYPER.peak;
      world.levelTimer = -1;
      if (level.witchspace) startWave(world, level.witchspace, ctx);
      world.events.push({ type: 'sfx', id: 'witchspace' });
      break;
    case 'INFO':
      world.levelTimer = INFO_SEC;
      break;
    case 'ASTEROIDS':
      if (level.asteroidWaves) startAsteroidWaves(world, level.asteroidWaves);
      startPhaseGiants(world, level, 'asteroids');
      break;
    case 'WAVES_A':
      startGroup(world, level.wavesA, ctx);
      if (level.combatAsteroids) startAsteroidWaves(world, level.combatAsteroids); // rocks amongst the ships
      startPhaseGiants(world, level, 'wavesA');
      break;
    case 'ASTEROIDS_B':
      // A second dense field drifts through just before the mid-boss. [ROC-L1-1]
      if (level.midAsteroids) startAsteroidWaves(world, level.midAsteroids);
      startPhaseGiants(world, level, 'asteroidsB');
      break;
    case 'MID_BOSS': {
      world.scroll = 0; // the fight is signalled by the scrolling stopping [ROC-BOSS-1]
      // A pair (or more) of mid-bosses fight together, side by side; the fight only clears once
      // every one of them is dead — `bossCleared` already checks for *any* `boss`-kind entity, so
      // no change is needed there. [ROC-L3-3]
      const midBosses = Array.isArray(level.midBoss) ? level.midBoss : [level.midBoss];
      // The guaranteed laser drop is one-per-fight, not one-per-boss, so only the first carries it. [ROC-PWR-6]
      midBosses.forEach((name, i) => spawnBoss(world, name, ctx, i === 0 ? 'laser' : undefined, i));
      break;
    }
    case 'WAVES_B':
      startGroup(world, level.wavesB, ctx);
      if (level.combatAsteroids) startAsteroidWaves(world, level.combatAsteroids);
      startPhaseGiants(world, level, 'wavesB');
      break;
    case 'END_BOSS':
      // A strafe boss (the FdL) flies in from off-screen while the field keeps scrolling and halts
      // it itself once it reaches its track; other bosses halt the field immediately. [ROC-FDL-*, ROC-BOSS-1]
      if (ctx.enemies[level.endBoss]?.behavior !== 'strafe') world.scroll = 0;
      spawnBoss(world, level.endBoss, ctx);
      break;
    case 'VIPER_INTERCEPT':
      if (level.viper) startWave(world, level.viper, ctx);
      break;
    case 'DOCKING':
      // Scrolling has resumed; the station scrolls into view and holds, rolling (it just looks
      // good). Spawned facing away (yaw π) so the Coriolis's own modelled slot faces the player.
      // Once it is fully in view we wait DOCK_SETTLE_SEC, then open the shop automatically — no
      // collision, no fly-in. [ROC-DCKG-1]
      world.levelTimer = DOCK_SETTLE_SEC;
      spawnStation(
        world,
        { kind: 'dock', spin: DOCK_STATION.spin, holdZ: DOCK_STATION.holdZ },
        { x: 0, z: DOCK_STATION.spawnZ },
        -DOCK_STATION.approachSpeed,
        Math.PI,
      );
      break;
    case 'DOCK':
      deleteStations(world);
      world.events.push({ type: 'dock' }); // [ROC-LVL-1]
      break;
  }
}

export function startLevel(world: World, level: LevelDef, ctx: WaveContext): void {
  world.scroll = 1;
  world.bossFadeTtl = 0;
  world.ecm = { fuse: -1, cooldown: 0 };
  world.hermitWaveId = null;
  enterLevelState(world, 'LAUNCH', level, ctx);
}

// Move/spin the station entities (departure scroll-away, docking approach + hold). Runs every
// step regardless of state so a station never freezes mid-transition.
function stationTick(world: World, dt: number): void {
  for (const e of [...world.entities.values()]) {
    if (e.kind !== 'station') continue;
    const ai = e.ai as StationAi;
    e.pos.z += e.vel.z * dt;
    e.bank += ai.spin * dt; // roll about the docking axis; the centred port rides it [ROC-DCKG-3]
    if (ai.kind === 'dock' && ai.holdZ !== undefined && e.pos.z <= ai.holdZ) {
      e.pos.z = ai.holdZ;
      e.vel = vec3();
    }
    if (ai.kind === 'depart' && e.pos.z < DEPART_STATION.cullZ) world.entities.delete(e.id);
  }
}

// The station is a backdrop now: once it has scrolled in and is holding, wait a beat and open the
// shop. No collision, no fly-in. [ROC-DCKG-1]
function dockingCheck(world: World, dt: number, level: LevelDef, ctx: WaveContext): void {
  let station: Entity | undefined;
  for (const e of world.entities.values()) {
    if (e.kind === 'station' && (e.ai as StationAi).kind === 'dock') station = e;
  }
  // Only start the settle countdown once the station has reached its hold (stationTick zeroes vel).
  if (!station || station.vel.z !== 0) return;
  world.levelTimer -= dt;
  if (world.levelTimer <= 0) {
    world.events.push({ type: 'docked' });
    enterLevelState(world, 'DOCK', level, ctx);
  }
}

export function levelStateSystem(world: World, dt: number, level: LevelDef, ctx: WaveContext): void {
  stationTick(world, dt);

  // Boss-kill framing: hold the boss state while "RIGHT ON COMMANDER" fades, then resume
  // scrolling and advance. [ROC-BOSS-3,4]
  const tickBossFade = (next: () => void): boolean => {
    if (world.bossFadeTtl > 0) {
      world.bossFadeTtl -= dt;
      if (world.bossFadeTtl <= 0) {
        world.bossFadeTtl = 0;
        world.scroll = 1;
        next();
      }
      return true;
    }
    if (bossCleared(world)) {
      world.bossFadeTtl = BOSS_FADE_SEC;
      world.events.push({ type: 'bossKilled' });
      return true;
    }
    return false;
  };

  switch (world.levelState as LevelState) {
    case 'LAUNCH':
      world.levelTimer -= dt;
      if (world.levelTimer <= 0) enterLevelState(world, 'HYPERSPACE', level, ctx);
      break;
    case 'HYPERSPACE': {
      const prevElapsed = HYPER_TOTAL_SEC - world.levelTimer;
      world.levelTimer -= dt;
      const elapsed = HYPER_TOTAL_SEC - world.levelTimer;
      // A witchspace-interlude level (Level 3) never settles here — it lingers at full stretch
      // instead, so cap the scroll ramp at the end of the hold phase and hand off to
      // WITCHSPACE_COMBAT rather than running the settle-back. [ROC-WITCH-1]
      const holdEnd = HYPER.countdownSec + HYPER.rampSec + HYPER.holdSec;
      const scrollElapsed = level.witchspace ? Math.min(elapsed, holdEnd) : elapsed;
      world.scroll = hyperScrollAt(scrollElapsed);
      // Emit each countdown second once as it is crossed ("Hyperspace Lave 4 ... 1"). [ROC-HYP-2]
      const nPrev = Math.ceil(HYPER.countdownSec - prevElapsed - 1e-9);
      const n = Math.ceil(HYPER.countdownSec - elapsed - 1e-9);
      if (n !== nPrev && n >= 1) world.events.push({ type: 'hyperCountdown', n, system: level.name ?? level.id });
      if (level.witchspace) {
        if (elapsed >= holdEnd) enterLevelState(world, 'WITCHSPACE_COMBAT', level, ctx);
      } else if (world.levelTimer <= 0) {
        world.scroll = 1;
        enterLevelState(world, 'INFO', level, ctx);
      }
      break;
    }
    case 'WITCHSPACE_COMBAT': {
      if (world.levelTimer < 0) {
        // Still fighting: the stretched starfield holds exactly at peak. [ROC-WITCH-1,2]
        world.scroll = HYPER.peak;
        if (groupCleared(world)) world.levelTimer = HYPER.settleSec; // cleared — begin the settle ramp [ROC-WITCH-3]
        break;
      }
      // Settling: the stretched lines shrink back into the normal scrolling starfield, exactly as
      // an ordinary hyperspace arrival, then the level proceeds as any other jump would. [ROC-WITCH-3]
      world.levelTimer -= dt;
      const u = smoothstep(Math.min(1, 1 - Math.max(0, world.levelTimer) / HYPER.settleSec));
      world.scroll = HYPER.peak - (HYPER.peak - 1) * u;
      if (world.levelTimer <= 0) {
        world.scroll = 1;
        enterLevelState(world, 'INFO', level, ctx);
      }
      break;
    }
    case 'INFO':
      world.levelTimer -= dt;
      if (world.levelTimer <= 0) enterLevelState(world, level.asteroidWaves?.length ? 'ASTEROIDS' : 'WAVES_A', level, ctx);
      break;
    case 'ASTEROIDS':
      if (asteroidFieldCleared(world)) enterLevelState(world, 'WAVES_A', level, ctx);
      break;
    case 'WAVES_A':
      if (groupCleared(world))
        enterLevelState(world, level.midAsteroids?.length ? 'ASTEROIDS_B' : 'MID_BOSS', level, ctx);
      break;
    case 'ASTEROIDS_B':
      if (asteroidFieldCleared(world)) enterLevelState(world, 'MID_BOSS', level, ctx);
      break;
    case 'MID_BOSS':
      tickBossFade(() => enterLevelState(world, 'WAVES_B', level, ctx));
      break;
    case 'WAVES_B':
      if (groupCleared(world)) enterLevelState(world, 'END_BOSS', level, ctx);
      break;
    case 'END_BOSS':
      tickBossFade(() =>
        enterLevelState(world, hasContraband(world) ? 'VIPER_INTERCEPT' : 'DOCKING', level, ctx),
      );
      break;
    case 'VIPER_INTERCEPT':
      if (groupCleared(world)) enterLevelState(world, 'DOCKING', level, ctx);
      break;
    case 'DOCKING':
      dockingCheck(world, dt, level, ctx);
      break;
    case 'DOCK':
      break; // terminal — gamestate takes over at the station
  }
}
