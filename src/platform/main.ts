// Browser entry point (the shell). Wires the deterministic sim to the real renderer through
// the fixed-timestep loop, loads Level 1 content, and renders ships, lasers, missiles,
// particles and pickups. [tasks T1.3/T5.2, design §3]

import { createSim, SHIP_SCALE } from '../sim/index.js';
import { PLAYER_ID } from '../sim/world.js';
import type { WorldSnapshot } from '../sim/snapshot.js';
import { vec3, sub, scale, normalize, type Vec3 } from '../sim/math/vec3.js';
import { Renderer2D } from '../render/renderer2d.js';
import { modelMatrix } from '../render/project.js';
import type { Mat4 } from '../sim/math/mat4.js';
import { startGameLoop, DT } from './loop.js';
import { DomInput } from '../input/domInput.js';
import { physicalToLogical } from '../render/viewport.js';
import { createLocalStorage } from './storage.js';
import type { Mesh } from '../interfaces.js';
import type { Entity } from '../sim/components.js';
import { meshSilhouette, hullRadius } from '../sim/systems/collision.js';

import {
  sellCargo,
  buyShip,
  fitLaserAt,
  buyEcm,
  buyEnergyBomb,
  buyEnergyBank,
  buyLife,
  upgradeMissile,
  launch,
  type PricesContent,
  type StationContext,
} from '../sim/systems/station.js';
import { loadShips, energyBombCap, type LaserType } from '../sim/systems/ships.js';
import { SPLINTER_HIT_SCALE, type AsteroidFieldDef } from '../sim/systems/asteroids.js';
import { hyperCountdown, BOSS_FADE_SEC } from '../sim/systems/levelstate.js';
import { stationButtons, buttonAt, drawStation, type StationAction } from '../render/screens/station.js';
import { PATTERNS } from '../sim/systems/paths.js';
import { isDesignPhase, anchorParams } from '../sim/systems/designMode.js';
import type { WaveDef } from '../sim/systems/waves.js';
import {
  actionButtons,
  transportButtons,
  scrubBarRect,
  scrubFractionAt,
  contentListRows,
  pickListRows,
  drawDesigner,
  hitTest,
  type DesignerAction,
  type TransportAction,
  type ContentRow,
} from '../render/screens/designer.js';

import enemies from '../content/enemies.json';
import level1 from '../content/level1.json';
import level2 from '../content/level2.json';
import level3 from '../content/level3.json';
import shipsJson from '../content/ships.json';
import economyJson from '../content/economy.json';
import cobra_mk3 from '../content/meshes/cobra_mk3.json';
import sidewinder from '../content/meshes/sidewinder.json';
import asp_mk2 from '../content/meshes/asp_mk2.json';
import krait from '../content/meshes/krait.json';
import gecko from '../content/meshes/gecko.json';
import adder from '../content/meshes/adder.json';
import viper from '../content/meshes/viper.json';
import mamba from '../content/meshes/mamba.json';
import fer_de_lance from '../content/meshes/fer_de_lance.json';
import python from '../content/meshes/python.json';
import constrictor from '../content/meshes/constrictor.json';
import anaconda from '../content/meshes/anaconda.json';
import thargoid from '../content/meshes/thargoid.json';
import boa from '../content/meshes/boa.json';
import cobra_mk1 from '../content/meshes/cobra_mk1.json';
import moray from '../content/meshes/moray.json';
import shuttle from '../content/meshes/shuttle.json';
import worm from '../content/meshes/worm.json';
import chameleon from '../content/meshes/chameleon.json';
import iguana from '../content/meshes/iguana.json';
import coriolis from '../content/meshes/coriolis.json';
import transporter from '../content/meshes/transporter.json';
import asteroid from '../content/meshes/asteroid.json';
import rock_hermit from '../content/meshes/rock_hermit.json';
import splinter from '../content/meshes/splinter.json';
import canister from '../content/meshes/canister.json';
import gem from '../content/meshes/gem.json';
import missile_pickup from '../content/meshes/missile_pickup.json';
import laser_pickup from '../content/meshes/laser_pickup.json';
import cougar from '../content/meshes/cougar.json';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
if (!canvas) throw new Error('gameCanvas element not found');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas context unavailable');

// Build-version badge (top-right corner) so a deployed build is always identifiable at a glance.
declare const __BUILD_VERSION__: string;
const versionEl = document.getElementById('version');
if (versionEl) versionEl.textContent = __BUILD_VERSION__;

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap dPR per design §17
  canvas!.width = Math.floor(canvas!.clientWidth * dpr);
  canvas!.height = Math.floor(canvas!.clientHeight * dpr);
  ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);
// Mobile browsers resize the address bar in/out without always firing a window 'resize' —
// visualViewport catches those so the canvas doesn't stay sized for a since-changed viewport.
window.visualViewport?.addEventListener('resize', resize);

const MESHES: Record<string, Mesh> = {
  cobra_mk3,
  sidewinder,
  asp_mk2,
  krait,
  gecko,
  adder,
  viper,
  mamba,
  fer_de_lance,
  python,
  constrictor,
  anaconda,
  thargoid,
  boa,
  cobra_mk1,
  moray,
  shuttle,
  worm,
  chameleon,
  iguana,
  coriolis,
  transporter,
  asteroid,
  giant_asteroid: asteroid, // same rock geometry, drawn/collided bigger via entity.scale [ROC-GIANT-1]
  rock_hermit,
  splinter,
  canister,
  gem,
  missile_pickup,
  laser_pickup,
  cougar,
} as unknown as Record<string, Mesh>;

// Per-mesh hullRadius(), matching what the sim precomputes internally from this same content —
// the base unit shield-ring gaps scale from, so a ring never disagrees with what the sim collides
// against. [ROC-DMG-1 shield-hug rework]
const HULL_RADII: Record<string, number> = {};
for (const [id, m] of Object.entries(MESHES)) {
  HULL_RADII[id] = hullRadius(meshSilhouette(m), SHIP_SCALE);
}

// The campaign, in play order. Level 4 joins this array once its content lands (task T7.3).
const LEVELS = [level1, level2, level3];
const currentLevel = (): (typeof LEVELS)[number] => LEVELS[sim.state.levelIndex] ?? level1;
const sim = createSim({ seed: 1, content: { enemies, levels: LEVELS, meshes: MESHES } });
const renderer = new Renderer2D(ctx);
const input = new DomInput({ canvas, storage: createLocalStorage() });

// Station shop wiring: the dock screen shows when the level reaches DOCK; taps route to intents.
const stationCtx: StationContext = { ships: loadShips(shipsJson), prices: economyJson as PricesContent };
let launchArmed = false;
let selectedLaser: LaserType = 'pulse';
const LASER_CYCLE: LaserType[] = ['pulse', 'beam', 'military'];
// The station shop overlay covers both the end-of-level Coriolis and the mid-level trader.
// [ROC-MDCK-1]
const dockActive = (): boolean => sim.state.levelState === 'DOCK' || sim.state.levelState === 'MID_DOCK';
const midDockActive = (): boolean => sim.state.levelState === 'MID_DOCK';

function runStationAction(action: StationAction): void {
  const w = sim.state;
  switch (action) {
    case 'sell': sellCargo(w, stationCtx); break;
    case 'buyShip': buyShip(w, stationCtx); break;
    case 'laserType': selectedLaser = LASER_CYCLE[(LASER_CYCLE.indexOf(selectedLaser) + 1) % LASER_CYCLE.length]; break;
    case 'fitFront': fitLaserAt(w, stationCtx, 'front', selectedLaser); break;
    case 'fitRear': fitLaserAt(w, stationCtx, 'rear', selectedLaser); break;
    case 'fitLeft': fitLaserAt(w, stationCtx, 'left', selectedLaser); break;
    case 'fitRight': fitLaserAt(w, stationCtx, 'right', selectedLaser); break;
    case 'ecm': buyEcm(w, stationCtx); break;
    case 'bomb': buyEnergyBomb(w, stationCtx); break;
    case 'bank': buyEnergyBank(w, stationCtx); break;
    case 'life': buyLife(w, stationCtx); break;
    case 'missile': upgradeMissile(w, stationCtx); break;
    case 'launch':
      if (!launchArmed) { launchArmed = true; break; } // first tap arms the confirm [ROC-STN-6]
      if (launch(w, true).ok) {
        if (midDockActive()) sim.midDockLaunch(); // resume WAVES_B in place, no restart [ROC-MDCK-2]
        else sim.relaunch();
        launchArmed = false;
      }
      break;
  }
}

// Hidden cheat unlock: tap all four screen corners in clockwise order, starting top-left, each
// within CORNER_TIMEOUT_MS of the last. Unlocking grants a one-off pile of lives/credits and
// reveals the Skip Level button for the rest of the session.
const CORNER_ORDER = ['TL', 'TR', 'BR', 'BL'] as const;
type Corner = (typeof CORNER_ORDER)[number];
const CORNER_FRAC = 0.16; // corner hit zone, as a fraction of min(w,h)
const CORNER_TIMEOUT_MS = 4000;
const CHEAT_LIVES = 100;
const CHEAT_CREDITS = 1_000_000;
const CHEAT_FLASH_SEC = 3;

let cheatUnlocked = false;
let cheatSeq = 0;
let cheatLastTapMs = 0;
let cheatFlashTtl = 0;

// Debug readout of the last corner-zone tap seen, so a failed unlock attempt is diagnosable from
// the screen alone (no devtools needed) — e.g. on a phone where taps aren't landing where expected.
let cheatDebugText = '';
let cheatDebugTtl = 0;
const CHEAT_DEBUG_SEC = 1.5;

// Wave-authoring clock: milliseconds elapsed since the current level state began, so a delayMs
// worth adding to a level's content JSON (wavesA/wavesB/asteroidWaves/giantAsteroids all measure
// delayMs from their own phase's start, not the level as a whole) can just be read straight off
// the screen while playtesting. Resets on every level-state transition. [dev cheat]
let cheatClockMs = 0;
let cheatClockState = '';

function cornerAt(px: number, py: number, w: number, h: number): Corner | null {
  const z = Math.min(w, h) * CORNER_FRAC;
  const top = py < z;
  const bottom = py > h - z;
  const left = px < z;
  const right = px > w - z;
  if (top && left) return 'TL';
  if (top && right) return 'TR';
  if (bottom && right) return 'BR';
  if (bottom && left) return 'BL';
  return null;
}

function activateCheat(): void {
  cheatUnlocked = true;
  cheatFlashTtl = CHEAT_FLASH_SEC;
  sim.state.player.lives = CHEAT_LIVES;
  sim.state.econ.wallet += CHEAT_CREDITS;
}

function tryCheatTap(px: number, py: number, w: number, h: number): void {
  if (cheatUnlocked) return;
  const corner = cornerAt(px, py, w, h);
  if (!corner) return;
  const now = performance.now();
  if (cheatSeq > 0 && now - cheatLastTapMs > CORNER_TIMEOUT_MS) cheatSeq = 0; // took too long — restart
  if (corner === CORNER_ORDER[cheatSeq]) {
    cheatSeq += 1;
    cheatLastTapMs = now;
    cheatDebugText = `${corner} ok (${cheatSeq}/${CORNER_ORDER.length})`;
    if (cheatSeq === CORNER_ORDER.length) activateCheat();
  } else {
    cheatDebugText = `${corner} — expected ${CORNER_ORDER[cheatSeq]}, reset`;
    cheatSeq = corner === CORNER_ORDER[0] ? 1 : 0; // a fresh top-left tap restarts the sequence
    cheatLastTapMs = now;
  }
  cheatDebugTtl = CHEAT_DEBUG_SEC;
}

// Skip Level: wipes whatever combat is underway and jumps straight to the docking approach — the
// level ends exactly as a normal clear would, just without playing it out.
const SKIP_BUTTON = { w: 84, h: 28, marginX: 10, marginY: 100 };
function skipButtonRect(w: number): { x: number; y: number; w: number; h: number } {
  return { x: w - SKIP_BUTTON.marginX - SKIP_BUTTON.w, y: SKIP_BUTTON.marginY, w: SKIP_BUTTON.w, h: SKIP_BUTTON.h };
}

// Pause: freezes the sim (no more steps) while the render loop keeps redrawing the frozen frame,
// so the paused screen stays visible and responsive to a second tap. [dev cheat]
let paused = false;
const PAUSE_BUTTON_GAP = 8;
const PAUSE_BUTTON = { w: SKIP_BUTTON.w, h: SKIP_BUTTON.h, marginX: SKIP_BUTTON.marginX, marginY: SKIP_BUTTON.marginY + SKIP_BUTTON.h + PAUSE_BUTTON_GAP };
function pauseButtonRect(w: number): { x: number; y: number; w: number; h: number } {
  return { x: w - PAUSE_BUTTON.marginX - PAUSE_BUTTON.w, y: PAUSE_BUTTON.marginY, w: PAUSE_BUTTON.w, h: PAUSE_BUTTON.h };
}

// Rewind ~30s per press, chainable: each press jumps back REWIND_SEC from wherever you are now,
// so repeated presses walk back through REWIND_HISTORY_SEC of real history rather than exhausting
// the buffer after one jump. Replays ship/enemy positions, wave/hazard timers and RNG state, so an
// attack wave can be re-watched exactly as it played out (the sim is deterministic, so spawns/drops
// after the rewind point repeat identically) — but leaves progression (score, credits, lives,
// cargo hold) alone, so rewinding never costs anything. Built on a rolling buffer of periodic
// snapshots rather than the full sim.restore(), since only the "encounter" should roll back, not
// the ledger. [dev cheat]
const REWIND_BUTTON = { w: SKIP_BUTTON.w, h: SKIP_BUTTON.h, marginX: SKIP_BUTTON.marginX, marginY: PAUSE_BUTTON.marginY + PAUSE_BUTTON.h + PAUSE_BUTTON_GAP };
function rewindButtonRect(w: number): { x: number; y: number; w: number; h: number } {
  return { x: w - REWIND_BUTTON.marginX - REWIND_BUTTON.w, y: REWIND_BUTTON.marginY, w: REWIND_BUTTON.w, h: REWIND_BUTTON.h };
}

// Non-tappable readout, stacked below the buttons above. [dev cheat]
const CLOCK_READOUT = { w: SKIP_BUTTON.w, h: SKIP_BUTTON.h, marginX: SKIP_BUTTON.marginX, marginY: REWIND_BUTTON.marginY + REWIND_BUTTON.h + PAUSE_BUTTON_GAP };
function clockReadoutRect(w: number): { x: number; y: number; w: number; h: number } {
  return { x: w - CLOCK_READOUT.marginX - CLOCK_READOUT.w, y: CLOCK_READOUT.marginY, w: CLOCK_READOUT.w, h: CLOCK_READOUT.h };
}

// Interactive attack-wave designer: scrub/play a level phase's timeline and add/remove
// waves/asteroid-fields/giant-asteroids against it, live. Only meaningful in the four phases with
// authored content (ASTEROIDS/WAVES_A/ASTEROIDS_B/WAVES_B) — tapping it elsewhere is a no-op.
// [wave-designer-spec.md]
const DESIGN_BUTTON = { w: SKIP_BUTTON.w, h: SKIP_BUTTON.h, marginX: SKIP_BUTTON.marginX, marginY: CLOCK_READOUT.marginY + CLOCK_READOUT.h + PAUSE_BUTTON_GAP };
function designButtonRect(w: number): { x: number; y: number; w: number; h: number } {
  return { x: w - DESIGN_BUTTON.marginX - DESIGN_BUTTON.w, y: DESIGN_BUTTON.marginY, w: DESIGN_BUTTON.w, h: DESIGN_BUTTON.h };
}

// ---- Wave designer state ------------------------------------------------------------------
// [wave-designer-spec.md]

let designMode = false;
let designUiMode: 'idle' | 'placing' | 'removing' = 'idle';
let designScrubFrame = 0; // sim frames since the design phase's own start
let designSpanFrames = 1; // scrub-range estimate, refreshed on enter/edit
let designPlaying: 0 | 1 | -1 = 0; // 0 idle, 1 auto-play forward, -1 auto-rewind
let designRewindAccum = 0;
// Continuous rewind needs a full reset-and-replay every tick (only *forward* motion gets the
// cheap incremental path — see sim/index.ts's design.replayTo). Throttling to ~12 replays/sec
// bounds the worst case instead of doing a full-span replay 120x/sec. [wave-designer-spec.md]
const DESIGN_REWIND_THROTTLE_TICKS = 10;
const DESIGN_STEP_MS = 500; // STEP BACK/FWD chunk size

type PendingWaveAdd = { kind: 'wave'; step: 'location' | 'pattern' | 'enemy'; x?: number; z?: number; pattern?: string };
type PendingGiantAdd = { kind: 'giant' };
let designAdd: PendingWaveAdd | PendingGiantAdd | null = null;
let designWaveSeq = 0;
let designGiantSeq = 0;

const DESIGN_WAVE_DEFAULT_COUNT = 6;
const DESIGN_WAVE_DEFAULT_SPEED = 1.0;
const DESIGN_WAVE_DEFAULT_SPACING_MS = 400;
const DESIGN_FIELD_DEFAULT_COUNT = 8;
const DESIGN_FIELD_DEFAULT_SPEED = 0.3;
const DESIGN_FIELD_DEFAULT_SPREAD = 0.9;
const DESIGN_FIELD_DEFAULT_SPACING_MS = 400;

const PATTERN_NAMES = Object.keys(PATTERNS);
const ENEMY_IDS = Object.keys(enemies);

function designSetSpan(): void {
  designSpanFrames = Math.max(1, Math.round(sim.design.spanMs() / 1000 / DT));
  designScrubFrame = Math.min(designScrubFrame, designSpanFrames);
}

function designSeek(frame: number): void {
  designScrubFrame = Math.max(0, Math.min(designSpanFrames, Math.round(frame)));
  sim.design.replayTo(designScrubFrame);
}

function enterDesignMode(): void {
  if (!sim.design.enter()) return; // no-op outside a designable phase
  designMode = true;
  designUiMode = 'idle';
  designPlaying = 0;
  designRewindAccum = 0;
  designAdd = null;
  designScrubFrame = 0;
  designSetSpan();
  sim.design.replayTo(0);
}

function exitDesignMode(): void {
  designMode = false;
  designPlaying = 0;
  designUiMode = 'idle';
  designAdd = null;
  // The player-facing rewind cheat's snapshot buffer is keyed on ever-increasing frame numbers;
  // a design session can leave sim.state.frame lower than it was, so start that buffer fresh
  // rather than risk it misbehaving against frame numbers that just went backward.
  rewindBuffer = [];
  lastSnapshotFrame = -Infinity;
  curr = readPlayerPose();
  prev = curr; // resync interpolation so returning to live play doesn't lerp from a stale pose
}

function designStepMsToFrames(): number {
  return Math.round(DESIGN_STEP_MS / 1000 / DT);
}

// Prompts (count/speed/spacing) use window.prompt — a dev-only tool doesn't need a custom
// on-canvas numeric keypad, and prompt() pre-filled with a sensible default means accepting it
// is just hitting OK/Enter. [wave-designer-spec.md]
function promptNumber(message: string, def: number): number | null {
  const raw = window.prompt(message, String(def));
  if (raw === null) return null; // cancelled
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
}

function commitWaveAdd(x: number, z: number, pattern: string, enemy: string): void {
  const count = Math.max(1, Math.round(promptNumber('Ship count?', DESIGN_WAVE_DEFAULT_COUNT) ?? DESIGN_WAVE_DEFAULT_COUNT));
  const speedRaw = promptNumber('Speed (path-rate multiplier)?', DESIGN_WAVE_DEFAULT_SPEED);
  const speed = speedRaw && speedRaw > 0 ? speedRaw : DESIGN_WAVE_DEFAULT_SPEED;
  const spacingRaw = promptNumber('Spacing between members, ms?', DESIGN_WAVE_DEFAULT_SPACING_MS);
  const spacingMs = spacingRaw !== null && spacingRaw >= 0 ? spacingRaw : DESIGN_WAVE_DEFAULT_SPACING_MS;

  const phase = sim.design.content()?.phase ?? 'phase';
  const wave: WaveDef = {
    id: `${currentLevel()?.id ?? 'level'}-${phase}-${++designWaveSeq}`,
    pattern,
    enemy,
    count,
    spacingMs,
    speed,
    delayMs: Math.round(designScrubFrame * DT * 1000),
    params: anchorParams(pattern, x, z),
  };
  sim.design.addWave(wave);
  designAdd = null;
  designUiMode = 'idle';
  designSetSpan();
  designSeek(designScrubFrame);
}

function commitGiantAdd(x: number): void {
  const id = `${currentLevel()?.id ?? 'level'}-g${++designGiantSeq}`;
  sim.design.addGiantAsteroid(x, Math.round(designScrubFrame * DT * 1000), id);
  designAdd = null;
  designUiMode = 'idle';
  designSetSpan();
  designSeek(designScrubFrame);
}

function promptAddField(): void {
  const count = Math.max(1, Math.round(promptNumber('Asteroid count?', DESIGN_FIELD_DEFAULT_COUNT) ?? DESIGN_FIELD_DEFAULT_COUNT));
  const speedRaw = promptNumber('Drift speed (world units/sec)?', DESIGN_FIELD_DEFAULT_SPEED);
  const speed = speedRaw && speedRaw > 0 ? speedRaw : DESIGN_FIELD_DEFAULT_SPEED;
  const spreadRaw = promptNumber('Spawn x-spread (half-width)?', DESIGN_FIELD_DEFAULT_SPREAD);
  const xSpread = spreadRaw && spreadRaw > 0 ? spreadRaw : DESIGN_FIELD_DEFAULT_SPREAD;
  const spacingRaw = promptNumber('Spacing between spawns, ms?', DESIGN_FIELD_DEFAULT_SPACING_MS);
  const spacingMs = spacingRaw !== null && spacingRaw >= 0 ? spacingRaw : DESIGN_FIELD_DEFAULT_SPACING_MS;

  const field: AsteroidFieldDef = { count, speed, xSpread, spacingMs, delayMs: Math.round(designScrubFrame * DT * 1000) };
  sim.design.addAsteroidField(field);
  designSetSpan();
  designSeek(designScrubFrame);
}

function commitRemove(row: ContentRow): void {
  if (row.kind === 'wave') sim.design.removeWave(row.refId);
  else if (row.kind === 'giant') sim.design.removeGiantAsteroid(row.refId);
  else sim.design.removeAsteroidFieldAt(row.index);
  designSetSpan();
  designSeek(designScrubFrame);
}

function exportDesignContent(): void {
  const content = sim.design.content();
  if (!content) return;
  const payload: Record<string, unknown> = {};
  if (content.waveField) payload[content.waveField] = content.waves;
  payload[content.asteroidFieldKey] = content.asteroidField;
  payload.giantAsteroids = content.giantAsteroids;
  const json = JSON.stringify(payload, null, 2);
  navigator.clipboard?.writeText(json).catch(() => {}); // best-effort — the prompt below is the reliable path
  window.prompt('Copy this JSON — paste into the level content file:', json);
}

function handleTransport(action: TransportAction): void {
  switch (action) {
    case 'rewind':
      designPlaying = designPlaying === -1 ? 0 : -1;
      designRewindAccum = 0;
      break;
    case 'stepBack':
      designPlaying = 0;
      designSeek(designScrubFrame - designStepMsToFrames());
      break;
    case 'playPause':
      designPlaying = designPlaying === 1 ? 0 : 1;
      break;
    case 'stepFwd':
      designPlaying = 0;
      designSeek(designScrubFrame + designStepMsToFrames());
      break;
  }
}

function handleDesignAction(action: DesignerAction): void {
  switch (action) {
    case 'addWave':
      designAdd = { kind: 'wave', step: 'location' };
      designUiMode = 'placing';
      break;
    case 'addGiant':
      designAdd = { kind: 'giant' };
      designUiMode = 'placing';
      break;
    case 'addField':
      designUiMode = 'idle';
      designAdd = null;
      promptAddField();
      break;
    case 'remove':
      designUiMode = designUiMode === 'removing' ? 'idle' : 'removing';
      designAdd = null;
      break;
    case 'export':
      exportDesignContent();
      break;
    case 'exit':
      exitDesignMode();
      break;
  }
}

// px/py/w here are already box-local (matching every other design-mode rect) — see
// handleTapAt's conversion. [viewport-spec.md, wave-designer-spec.md]
function handleDesignTap(px: number, py: number, w: number): void {
  const bar = scrubBarRect(w);
  if (px >= bar.x && px <= bar.x + bar.w && py >= bar.y && py <= bar.y + bar.h) {
    designPlaying = 0;
    designSeek(scrubFractionAt(bar, px) * designSpanFrames);
    return;
  }

  const transportHit = hitTest(transportButtons(designPlaying), px, py);
  if (transportHit) {
    handleTransport(transportHit.action);
    return;
  }

  // A pattern/enemy pick list, while one is showing, takes priority over everything below it.
  if (designAdd?.kind === 'wave' && designAdd.step === 'pattern') {
    const hit = hitTest(pickListRows(PATTERN_NAMES, w), px, py);
    if (hit) designAdd = { ...designAdd, pattern: hit.item, step: 'enemy' };
    return;
  }
  if (designAdd?.kind === 'wave' && designAdd.step === 'enemy') {
    const hit = hitTest(pickListRows(ENEMY_IDS, w), px, py);
    if (hit) commitWaveAdd(designAdd.x!, designAdd.z!, designAdd.pattern!, hit.item);
    return;
  }

  const content = sim.design.content();
  const actionHit = hitTest(actionButtons(content?.waveField != null), px, py);
  if (actionHit && actionHit.enabled) {
    handleDesignAction(actionHit.action);
    return;
  }

  if (designUiMode === 'removing' && content) {
    const hit = hitTest(contentListRows(content, w), px, py);
    if (hit) {
      commitRemove(hit);
      designUiMode = 'idle';
    }
    return;
  }

  // Otherwise: a tap on the field itself, only meaningful while placing a wave/obstacle's
  // location — full (x, z) point, per wave-designer-spec.md. Uses the same renderer-transform
  // inversion as DomInput.toField (uniform box.h/2 scale), so a placed wave/obstacle lands
  // exactly where the tap was and matches where its ghost trail then draws.
  if (designUiMode === 'placing' && designAdd) {
    const { box } = renderer.getViewport();
    const scale = box.h / 2;
    const x = (px - box.w / 2) / scale;
    const z = (box.h / 2 - py) / scale;
    if (designAdd.kind === 'wave' && designAdd.step === 'location') {
      designAdd = { ...designAdd, x, z, step: 'pattern' };
    } else if (designAdd.kind === 'giant') {
      commitGiantAdd(x);
    }
  }
}

const REWIND_SEC = 30; // seconds jumped back per press
// Total history retained — was == REWIND_SEC, so a press consumed almost the whole buffer and a
// second press right after had nothing left to jump to. 10x deeper lets ten 30s presses chain
// back to back. [dev cheat]
const REWIND_HISTORY_SEC = REWIND_SEC * 10;
const SNAPSHOT_INTERVAL_SEC = 0.5;
const SNAPSHOT_INTERVAL_FRAMES = Math.round(SNAPSHOT_INTERVAL_SEC / DT);
const REWIND_FRAMES = Math.round(REWIND_SEC / DT);
const REWIND_HISTORY_FRAMES = Math.round(REWIND_HISTORY_SEC / DT);
let rewindBuffer: { frame: number; snap: WorldSnapshot }[] = [];
let lastSnapshotFrame = -Infinity;
let lastSnapshotLevelIndex = -1;

// Called once per unpaused sim step; only actually snapshots every SNAPSHOT_INTERVAL_SEC, and only
// once the cheat is unlocked (no cost for the overwhelming majority of players who never trigger it).
function captureRewindSnapshot(): void {
  if (sim.state.levelIndex !== lastSnapshotLevelIndex) {
    // A relaunch into a new level invalidates any buffered snapshots from the old one.
    rewindBuffer = [];
    lastSnapshotFrame = -Infinity;
    lastSnapshotLevelIndex = sim.state.levelIndex;
  }
  if (!cheatUnlocked) return;
  if (sim.state.frame - lastSnapshotFrame < SNAPSHOT_INTERVAL_FRAMES) return;
  lastSnapshotFrame = sim.state.frame;
  rewindBuffer.push({ frame: sim.state.frame, snap: sim.snapshot() });
  const cutoff = sim.state.frame - REWIND_HISTORY_FRAMES - SNAPSHOT_INTERVAL_FRAMES;
  while (rewindBuffer.length && rewindBuffer[0].frame < cutoff) rewindBuffer.shift();
}

// Seconds of history currently held, oldest snapshot to now — how far back the next press can
// actually reach (may be less than REWIND_SEC just after unlocking, or right after a previous
// rewind pruned everything past its landing point). [dev cheat]
function rewindAvailableSec(): number {
  if (rewindBuffer.length === 0) return 0;
  return (sim.state.frame - rewindBuffer[0].frame) * DT;
}

// Restores everything about the encounter (entities, waves, hazard/level timers, RNG, and the
// player's own combat state — position/hull/shield/loadout/missiles) but not progression: lives,
// wallet/score and the cargo hold are left exactly as they are now.
function partialRestore(snap: WorldSnapshot): void {
  const w = sim.state;
  w.frame = snap.frame;
  w.difficulty = snap.difficulty;
  w.entities = new Map(structuredClone(snap.entities).map((e) => [e.id, e]));
  w.nextId = snap.nextId;
  w.rngState = snap.rngState;
  w.mode = snap.mode;
  w.levelState = snap.levelState;
  w.levelTimer = snap.levelTimer;
  w.scroll = snap.scroll;
  w.bossFadeTtl = snap.bossFadeTtl;
  w.ecm = { ...snap.ecm };
  w.hermitWaveId = snap.hermitWaveId;
  w.waves = {
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
          open: rec.open,
          defId: rec.defId,
        },
      ]),
    ),
  };
  w.asteroidWaves = snap.asteroidWaves.map((a) => ({ ...a }));
  w.giantAsteroids = snap.giantAsteroids.map((g) => ({ ...g }));

  const lives = w.player.lives; // progression — not part of the encounter being replayed
  w.player = structuredClone(snap.player);
  w.player.lives = lives;

  w.events = [];
  w.pool = { projectiles: [], particles: [], missiles: [] }; // allocation cache; safe to drop
}

function cheatRewind(): void {
  if (rewindBuffer.length === 0) return;
  const targetFrame = sim.state.frame - REWIND_FRAMES;
  let chosen = rewindBuffer[0];
  for (const entry of rewindBuffer) {
    if (entry.frame > targetFrame) break; // buffer is oldest-first; stop at the first entry beyond target
    chosen = entry;
  }
  partialRestore(chosen.snap);
  rewindBuffer = rewindBuffer.filter((e) => e.frame <= chosen.frame); // drop now-invalid "future" entries
  curr = readPlayerPose();
  prev = curr; // resync interpolation so the jump doesn't lerp from the old position
}

function inRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// Station taps and the cheat's corner detection both need a tap's local (canvas-space) x/y. Mouse
// events carry that in offsetX/offsetY; touch events don't, so it's derived from the bounding
// rect instead — same technique DomInput's own toField() uses for its flight-control targeting.
// Listening on 'mousedown' + 'touchstart' directly (rather than the unified 'pointerdown') matches
// DomInput's existing input handling, since pointer events aren't uniformly reliable for touch
// across every mobile browser/WebView. [dev cheat]
//
// physX/physY are raw canvas-relative pixels (unaffected by the renderer's internal rotation/box
// transform); they're converted to the same box-local space every button/HUD rect below is
// defined in, so hit-testing always matches what's drawn. [viewport-spec.md]
function handleTapAt(physX: number, physY: number): void {
  const viewport = renderer.getViewport();
  const { box } = viewport;
  const logical = physicalToLogical(viewport, physX, physY);
  const px = logical.x - box.x;
  const py = logical.y - box.y;
  const w = box.w;
  const h = box.h;

  if (designMode) {
    handleDesignTap(px, py, w);
    return;
  }

  tryCheatTap(px, py, w, h);

  if (dockActive()) {
    const btn = buttonAt(stationButtons(sim.state, stationCtx, w, h, launchArmed, selectedLaser), px, py);
    if (btn && btn.enabled) runStationAction(btn.action);
    return;
  }

  if (cheatUnlocked && inRect(px, py, skipButtonRect(w))) sim.cheatSkipLevel();
  if (cheatUnlocked && inRect(px, py, pauseButtonRect(w))) paused = !paused;
  if (cheatUnlocked && inRect(px, py, rewindButtonRect(w))) cheatRewind();
  if (cheatUnlocked && inRect(px, py, designButtonRect(w))) enterDesignMode();
}

canvas.addEventListener('mousedown', (e) => handleTapAt(e.offsetX, e.offsetY));
canvas.addEventListener(
  'touchstart',
  (e) => {
    const t = e.changedTouches[0];
    const rect = canvas!.getBoundingClientRect();
    handleTapAt(t.clientX - rect.left, t.clientY - rect.top);
  },
  { passive: true },
);

interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  bank: number;
}
function readPlayerPose(): Pose {
  const p = sim.state.entities.get(PLAYER_ID)!;
  return { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, bank: p.bank };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const PULSE_LEN = 0.18;
const BOLT_FLASH_HZ = 10; // enemy-fire strobe rate (flips/sec), for visibility [dev tuning]
const PICKUP_SCALE = 1 / 9; // canister/gem read as small props, not ship-sized [was 1/3]
const GEM_SCALE = PICKUP_SCALE * 0.5; // -50% [tuning]
const MINI_ASTEROID_SCALE = SPLINTER_HIT_SCALE; // matches the sim's splinter collision scale exactly

// Asteroid-mined loot (alloys/gems power-ups and their Metals/Crystals cargo, ROC-L1-3) reads as
// a gem, not salvage; ship-upgrade power-ups (laser/missile) read as a distinctive tumbling coin,
// sized and marked so they don't get lost among ordinary cargo; everything else (market cargo
// from ships) is a drifting cargo canister.
const GEM_COMMODITIES = new Set(['Metals', 'Crystals']);
const SHIP_UPGRADE_MESH: Partial<Record<string, string>> = { laser: 'laser_pickup', missile: 'missile_pickup' };
const SHIP_UPGRADE_MESH_IDS = new Set(Object.values(SHIP_UPGRADE_MESH));
function pickupMeshId(pickup: { type: string; commodity?: string }): string {
  if (pickup.type === 'alloys' || pickup.type === 'gems') return 'gem';
  if (pickup.type === 'cargo' && pickup.commodity && GEM_COMMODITIES.has(pickup.commodity)) return 'gem';
  return SHIP_UPGRADE_MESH[pickup.type] ?? 'canister';
}

// White flash over the whole hull while a hull-damage hit is fresh. [ROC-DMG-6,6a]
function hullFlash(e: Entity): { fill: string; stroke: string } | undefined {
  return (e.flashTtl ?? 0) > 0 ? { fill: '#fff', stroke: '#fff' } : undefined;
}

// Concentric rings hugging the hull silhouette = remaining shield strength; brighten briefly
// when a hit is absorbed. Each ring sits its own gap outside the hull, so it tracks the ship's
// actual shape (and yaw/bank) rather than an unrelated ellipse. [ROC-DMG-1,2,3 shield-hug rework]
function drawShield(e: Entity, mesh: Mesh | undefined, model: Mat4): void {
  const rings = e.shield ?? 0;
  const base = e.meshId ? HULL_RADII[e.meshId] : undefined;
  const radius = base === undefined ? undefined : base * (e.scale ?? 1); // gap tracks the drawn size [ROC-FDL-1]
  if (rings <= 0 || !mesh || !radius) return;
  const flash = (e.shieldFlashTtl ?? 0) > 0;
  renderer.drawShieldRing(mesh, model, radius, rings, {
    stroke: flash ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
    lineWidth: flash ? 2.5 : 1.2,
  });
}

// Cloaked-hull opacity for the current phase/timer: fully opaque while visible, near-transparent
// while fully cloaked, ramping smoothly through the two transition phases. Render-only — the
// entity stays fully damageable and on-screen throughout (cloak never affects collision). [ROC-CLK-1,2,3]
const CLOAK_MIN_OPACITY = 0.14;
function cloakOpacity(c: NonNullable<Entity['cloak']>): number {
  const span = 1 - CLOAK_MIN_OPACITY;
  switch (c.phase) {
    case 'visible':
      return 1;
    case 'cloaked':
      return CLOAK_MIN_OPACITY;
    case 'cloaking':
      return 1 - span * (1 - c.timer / c.transitionSec);
    case 'decloaking':
      return CLOAK_MIN_OPACITY + span * (1 - c.timer / c.transitionSec);
  }
}

// A cloaked/transitioning hull reads as a faint, wobbling distortion rather than a solid ship —
// jittered per-frame (wall-clock, like the starfield) so it visibly warps instead of just fading.
const CLOAK_JITTER = 0.02; // world units
function drawCloakedShip(e: Entity, m: Mesh, model: Mat4, now: number): void {
  const c = e.cloak!;
  const opacity = cloakOpacity(c);
  const distorted = c.phase !== 'visible';
  let drawM = model;
  if (distorted) {
    const jx = Math.sin(now * 23 + e.id) * CLOAK_JITTER;
    const jz = Math.cos(now * 19 + e.id * 1.7) * CLOAK_JITTER;
    drawM = modelMatrix(vec3(e.pos.x + jx, e.pos.y, e.pos.z + jz), e.yaw, e.bank, SHIP_SCALE * (e.scale ?? 1));
  }
  if ((e.flashTtl ?? 0) > 0) {
    renderer.drawMesh(m, drawM, { fill: '#fff', stroke: '#fff' }); // a landed hit still reads through the cloak
  } else {
    renderer.drawMesh(m, drawM, {
      fill: `rgba(0,0,0,${(opacity * 0.85).toFixed(2)})`,
      stroke: `rgba(255,255,255,${opacity.toFixed(2)})`,
      lineWidth: distorted ? 1 : 1.5,
    });
  }
  if (!distorted) drawShield(e, m, drawM);
}

// Player cloak-device effect: unlike the Cougar's phased cycle, this is a flat on/off window
// (world.player.cloakTtl > 0), so instead of ramping opacity it reads as "only the hull's outline
// is visible" — silhouette-only (no facet lines, no shield ring), faint and flickering. [ROC-CLK-4,9]
function drawPlayerCloak(player: Entity, pmesh: Mesh, pos: Vec3, yaw: number, bank: number, scale: number, now: number): void {
  const jx = Math.sin(now * 27) * CLOAK_JITTER;
  const jz = Math.cos(now * 21) * CLOAK_JITTER;
  const model = modelMatrix(vec3(pos.x + jx, pos.y, pos.z + jz), yaw, bank, scale);
  if ((player.flashTtl ?? 0) > 0) {
    renderer.drawSilhouette(pmesh, model, { fill: '#fff', stroke: '#fff' }); // a landed hit still reads through the cloak
    return;
  }
  const pulse = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(now * 6)); // 0.35..0.85, flickering
  renderer.drawSilhouette(pmesh, model, {
    fill: `rgba(20,20,30,${(pulse * 0.5).toFixed(2)})`,
    stroke: `rgba(255,255,255,${pulse.toFixed(2)})`,
    lineWidth: 1,
  });
}

let prev = readPlayerPose();
let curr = prev;

// Floating credit/bonus text that rises from a kill and fades. [ROC-KC-1,2,3]
interface Floater { x: number; z: number; text: string; color: string; age: number; ttl: number }
const floaters: Floater[] = [];
const FLOATER_TTL = 1.1;

// Boss-ECM presentation: a brief full-screen flash and an "ECM" caption at the bottom. [ROC-BECM-1,3]
let ecmFlashTtl = 0;
let ecmTextTtl = 0;
const ECM_FLASH_SEC = 0.12;
const ECM_TEXT_SEC = 0.8;

// Energy-bomb presentation: a brighter, longer flash and a caption at the top. [ROC-BOMB-4]
let bombFlashTtl = 0;
let bombTextTtl = 0;
const BOMB_FLASH_SEC = 0.25;
const BOMB_TEXT_SEC = 2.5;

function drainFloaters(events: ReturnType<typeof sim.step>): void {
  for (const ev of events) {
    if (ev.type === 'floatingText' && (ev.category === 'bounty' || ev.category === 'cargo')) {
      const pos = (ev.pos as { x: number; z: number }) ?? curr;
      floaters.push({ x: pos.x, z: pos.z, text: String(ev.text ?? ''), color: ev.category === 'bounty' ? '#ffd76b' : '#7cd0ff', age: 0, ttl: FLOATER_TTL });
    } else if (ev.type === 'waveBonus') {
      floaters.push({ x: 0, z: curr.z + 0.4, text: `BONUS +${ev.amount}`, color: '#ffd76b', age: 0, ttl: FLOATER_TTL * 1.4 });
    } else if (ev.type === 'ecm') {
      ecmFlashTtl = ECM_FLASH_SEC;
      ecmTextTtl = ECM_TEXT_SEC;
    } else if (ev.type === 'energyBombDeployed') {
      bombFlashTtl = BOMB_FLASH_SEC;
      bombTextTtl = BOMB_TEXT_SEC;
    }
  }
  ecmFlashTtl = Math.max(0, ecmFlashTtl - DT);
  ecmTextTtl = Math.max(0, ecmTextTtl - DT);
  bombFlashTtl = Math.max(0, bombFlashTtl - DT);
  bombTextTtl = Math.max(0, bombTextTtl - DT);
  cheatFlashTtl = Math.max(0, cheatFlashTtl - DT);
  cheatDebugTtl = Math.max(0, cheatDebugTtl - DT);
  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].age += DT;
    if (floaters[i].age >= floaters[i].ttl) floaters.splice(i, 1);
  }
}

// Persistent hint on a portrait touch device (renderer.getViewport().rotated): the scene is
// intentionally drawn rotated 90° to fill the screen (viewport-spec.md), so the player needs
// telling to turn the device sideways to read it correctly. Drawn in plain physical screen
// coordinates, after the renderer's own rotation transform has been restored, so the hint itself
// reads upright regardless of how the game content beneath it is oriented.
function drawRotateHint(): void {
  if (!renderer.getViewport().rotated) return;
  const w = canvas!.clientWidth || canvas!.width;
  const h = canvas!.clientHeight || canvas!.height;
  ctx!.fillStyle = 'rgba(0,0,0,0.6)';
  ctx!.fillRect(0, h * 0.42, w, h * 0.16);
  ctx!.fillStyle = '#fff';
  ctx!.font = '15px monospace';
  ctx!.textAlign = 'center';
  ctx!.fillText('↻ Turn your phone sideways to play', w / 2, h * 0.5);
}

// The pattern/enemy pick list currently showing, if any, keyed off the in-progress add-wave flow.
function designPickList(): { title: string; rows: ReturnType<typeof pickListRows> } | null {
  const w = renderer.getViewport().box.w;
  if (designAdd?.kind === 'wave' && designAdd.step === 'pattern') {
    return { title: 'Pick a pattern', rows: pickListRows(PATTERN_NAMES, w) };
  }
  if (designAdd?.kind === 'wave' && designAdd.step === 'enemy') {
    return { title: 'Pick a ship', rows: pickListRows(ENEMY_IDS, w) };
  }
  return null;
}

// Design mode's frame: the same entity drawing as live play (so the preview is exactly what the
// player would see), the player ship at its exact position (never moves during a design replay —
// neutral input holds it fixed, so no interpolation is needed), ghost trails, and the designer
// toolbar in place of the normal HUD. [wave-designer-spec.md]
function renderDesignFrame(): void {
  const now = performance.now() / 1000;
  drawEntities(now);

  const player = sim.state.entities.get(PLAYER_ID)!;
  const pmesh = (player.meshId && MESHES[player.meshId]) || MESHES.sidewinder;
  const pmodel = modelMatrix(player.pos, player.yaw, player.bank, SHIP_SCALE * (player.scale ?? 1));
  renderer.drawMesh(pmesh, pmodel, hullFlash(player));

  const { box } = renderer.getViewport();
  const content = sim.design.content();
  drawDesigner(renderer, content, {
    w: box.w,
    phaseLabel: content?.phase ?? sim.state.levelState,
    scrubMs: designScrubFrame * DT * 1000,
    spanMs: designSpanFrames * DT * 1000,
    playing: designPlaying,
    mode: designUiMode,
    pickList: designPickList(),
  });
}

// Projectiles/missiles/particles/fragments/pickups/cargo/ships/asteroids + beam lasers — every
// entity in sim.state.entities except the player ship (drawn separately, interpolated, by the
// caller). Factored out so design mode's replayed preview can reuse the exact same drawing as
// live play, not a parallel simplified rendering. [wave-designer-spec.md]
function drawEntities(now: number): void {
  const particles: Vec3[] = [];
  for (const e of sim.state.entities.values()) {
    switch (e.kind) {
      case 'projectile':
      case 'missile': {
        // Missiles render as a small dart; pulses as a slightly longer streak. Military bolts
        // are shorter and thicker than a pulse. [ROC-LAS-5]
        const isEnemyBolt = e.kind === 'projectile' && e.team === 'enemy';
        const len = e.kind === 'missile' ? 0.09 : e.mil ? PULSE_LEN * 0.55 : isEnemyBolt ? PULSE_LEN * 0.5 : PULSE_LEN;
        const tail = sub(e.pos, scale(normalize(e.vel), len));
        if (isEnemyBolt) {
          // Incoming fire reads as a rapidly strobing white/black core inside a constant white
          // outline (the outline alone stays visible through the black phase), thicker overall
          // than before so it doesn't get lost against the starfield/HUD. [ROC-LAS-5 legibility]
          const flashOn = Math.floor(now * BOLT_FLASH_HZ) % 2 === 0;
          renderer.drawWorldLine(e.pos, tail, { stroke: '#fff', lineWidth: 5 });
          renderer.drawWorldLine(e.pos, tail, { stroke: flashOn ? '#fff' : '#000', lineWidth: 3 });
        } else {
          renderer.drawWorldLine(e.pos, tail, { stroke: '#fff', lineWidth: e.mil ? 4 : 2 });
        }
        break;
      }
      case 'particle':
        particles.push(e.pos);
        break;
      case 'fragment': {
        // A tumbling wireframe shard from a destroyed hull, fading over its life. [ROC-DMG-6]
        if (!e.seg) break;
        const a = vec3(e.pos.x - e.seg.x, e.pos.y, e.pos.z - e.seg.z);
        const b = vec3(e.pos.x + e.seg.x, e.pos.y, e.pos.z + e.seg.z);
        const fade = e.ttlMax ? Math.max(0, Math.min(1, (e.ttl ?? 0) / e.ttlMax)) : 1;
        renderer.drawWorldLine(a, b, { stroke: `rgba(255,255,255,${fade.toFixed(2)})`, lineWidth: 1.5 });
        break;
      }
      case 'pickup': {
        // Tumbles in place — cosmetic only (wall-clock driven, like the starfield), doesn't
        // touch sim state or collision. [ROC-PWR-*]
        if (!e.pickup) break;
        const meshId = pickupMeshId(e.pickup);
        const m = MESHES[meshId];
        if (!m) break;
        const phase = e.id * 0.7; // per-entity offset so pickups don't spin in lockstep
        // Ship-upgrade coins read at full ship size (a Sidewinder's scale); everything else
        // stays a small prop.
        const scale = meshId === 'gem' ? GEM_SCALE : SHIP_UPGRADE_MESH_IDS.has(meshId) ? SHIP_SCALE : PICKUP_SCALE;
        renderer.drawMesh(m, modelMatrix(e.pos, now * 1.1 + phase, now * 0.8 + phase * 1.3, scale));
        break;
      }
      case 'cargo': {
        // Jettisoned cargo canisters spilling from the player's wreck — tumbling, fading. [ROC-CARGO-6]
        const m = MESHES.canister;
        if (!m) break;
        const phase = e.id * 0.7;
        const fade = e.ttlMax ? Math.max(0, Math.min(1, (e.ttl ?? 0) / e.ttlMax)) : 1;
        renderer.drawMesh(m, modelMatrix(e.pos, now * 1.4 + phase, now * 1.1 + phase * 1.3, PICKUP_SCALE), {
          stroke: `rgba(255,255,255,${fade.toFixed(2)})`,
        });
        break;
      }
      case 'enemy':
      case 'boss':
      case 'station': {
        const m = e.meshId ? MESHES[e.meshId] : undefined;
        if (m) {
          const model = modelMatrix(e.pos, e.yaw, e.bank, SHIP_SCALE * (e.scale ?? 1)); // [ROC-FDL-1]
          if (e.cloak) {
            drawCloakedShip(e, m, model, now);
          } else {
            renderer.drawMesh(m, model, hullFlash(e));
            drawShield(e, m, model);
          }
        }
        // The docking bay is modelled into the hull mesh now (hermit + station), so it just
        // rolls with the hull; the invisible dock/damage footprint lives in the sim. [ROC-DCKG-1]
        break;
      }
      case 'asteroid': {
        // Tumbles freely (yaw + bank both spin independently of its drift). [ROC-L1-1]
        // A splinter is its own gameplay tier (collider, hull, drops all stay keyed off
        // meshId 'splinter'), but reads better on screen as a small asteroid chunk than the
        // authentic-but-oddly-angular bbcelite splinter shape, so it draws the asteroid mesh
        // at a fraction of the size instead.
        const isSplinter = e.meshId === 'splinter';
        // A giant asteroid is a solid, indestructible obstacle — its scale (matching the sim's
        // silhouette-based collider) comes straight off the entity, same as any other scaled
        // hull, and it draws as a plain outer outline only (no internal facet lines, no damage
        // flash since it never takes damage) so its shape and size alone read as "obstacle".
        // [ROC-GIANT-1]
        const isGiant = e.meshId === 'giant_asteroid';
        const m = isSplinter ? MESHES.asteroid : e.meshId ? MESHES[e.meshId] : undefined;
        const scale = isSplinter ? MINI_ASTEROID_SCALE : SHIP_SCALE * (e.scale ?? 1);
        if (m) {
          const matrix = modelMatrix(e.pos, e.yaw, e.bank, scale);
          if (isGiant) renderer.drawSilhouette(m, matrix);
          else renderer.drawMesh(m, matrix, hullFlash(e));
        }
        break;
      }
      default:
        break;
    }
  }
  if (particles.length) renderer.drawWorldParticles(particles, { fill: '#fff', size: 2 });

  // Beam lasers: instant, continuous shots from the ship to whatever they hit — a soft grey
  // glow underlay plus a bright white core. [ROC-LAS-6]
  for (const b of sim.state.beams) {
    const a = vec3(b.ax, 0, b.az);
    const c = vec3(b.bx, 0, b.bz);
    renderer.drawWorldLine(a, c, { stroke: 'rgba(200,200,200,0.35)', lineWidth: 6 });
    renderer.drawWorldLine(a, c, { stroke: '#fff', lineWidth: 2 });
  }
}

startGameLoop({
  step: () => {
    const frame = input.sample(DT); // always drain one-shot input edges, even while paused/designing
    if (designMode) {
      // Forward auto-play advances one frame per tick (cheap: sim.design.replayTo's forward
      // path is just one incremental step). Rewind is throttled since every backward step is a
      // full reset-and-replay from the phase's start. [wave-designer-spec.md]
      if (designPlaying === 1) {
        designScrubFrame = Math.min(designSpanFrames, designScrubFrame + 1);
        sim.design.replayTo(designScrubFrame);
        if (designScrubFrame >= designSpanFrames) designPlaying = 0;
      } else if (designPlaying === -1) {
        designRewindAccum++;
        if (designRewindAccum >= DESIGN_REWIND_THROTTLE_TICKS) {
          designRewindAccum = 0;
          designScrubFrame = Math.max(0, designScrubFrame - DESIGN_REWIND_THROTTLE_TICKS);
          sim.design.replayTo(designScrubFrame);
          if (designScrubFrame <= 0) designPlaying = 0;
        }
      }
      return;
    }
    if (paused) return;
    prev = curr;
    const events = sim.step(frame);
    // Dense-belt levels show the drifting asteroid backdrop. Follows whichever level is active,
    // not just the first. [ROC-L1-1]
    const lvl = currentLevel() as { backdrop?: string };
    renderer.showAsteroidBackdrop = lvl.backdrop === 'asteroids';
    // Reveal the asteroid belt as we drop out of hyperspace, so it drifts into view — arriving
    // at the field. Idempotent. [ROC-L1-1]
    const ls = sim.state.levelState;
    if (ls !== 'LAUNCH' && ls !== 'HYPERSPACE') renderer.revealAsteroidBelt();
    if (cheatUnlocked) {
      if (ls !== cheatClockState) {
        cheatClockState = ls;
        cheatClockMs = 0;
      } else {
        cheatClockMs += DT * 1000;
      }
    }
    curr = readPlayerPose();
    drainFloaters(events);
    captureRewindSnapshot();
  },
  render: (alpha) => {
    renderer.beginFrame(paused ? 0 : sim.state.scroll); // sim-owned: 0 halts for bosses/pause, >1 is hyperspace [ROC-BOSS-1, ROC-HYP-3]

    if (designMode) {
      renderDesignFrame();
      renderer.endFrame(alpha);
      drawRotateHint();
      return;
    }

    // Docked: show the station shop instead of the play field. [ROC-STN-1]
    if (dockActive()) {
      const { w, h } = renderer.getViewport().box;
      const buttons = stationButtons(sim.state, stationCtx, w, h, launchArmed, selectedLaser);
      drawStation(renderer, sim.state, stationCtx, MESHES, buttons, { w, h, time: performance.now() / 1000 });
      renderer.endFrame(alpha);
      drawRotateHint();
      return;
    }

    const now = performance.now() / 1000;
    drawEntities(now);

    // Player ship, interpolated between the last two sim states. Hidden while the wreck's
    // dramatic explosion plays out (respawnPending); blinks only during the fresh-ship window
    // right after a respawn, never for an ordinary hit's brief ramming i-frames. [ROC-LIFE-2,2b,3]
    const player = sim.state.entities.get(PLAYER_ID)!;
    const blink = sim.state.player.respawnBlinkTtl;
    const blinkOff = blink > 0 && Math.floor(blink / 0.1) % 2 === 1;
    if (sim.state.mode !== 'GAME_OVER' && !blinkOff && !sim.state.player.respawnPending) {
      const pmesh = (player.meshId && MESHES[player.meshId]) || MESHES.sidewinder;
      const pos = vec3(lerp(prev.x, curr.x, alpha), lerp(prev.y, curr.y, alpha), lerp(prev.z, curr.z, alpha));
      const yaw = lerp(prev.yaw, curr.yaw, alpha);
      const bank = lerp(prev.bank, curr.bank, alpha);
      const scale = SHIP_SCALE * (player.scale ?? 1); // the player-flown FdL is 1.5x too [ROC-FDL-1]
      if (sim.state.player.cloakTtl > 0) {
        drawPlayerCloak(player, pmesh, pos, yaw, bank, scale, now);
      } else {
        const model = modelMatrix(pos, yaw, bank, scale);
        renderer.drawMesh(pmesh, model, hullFlash(player));
        drawShield(player, pmesh, model);
      }
    }
    // Floating credit/bonus numbers, rising and fading from the explosion. [ROC-KC-1,2,3]
    for (const f of floaters) {
      const u = f.age / f.ttl;
      const alpha = (1 - u).toFixed(2);
      const col = f.color === '#ffd76b' ? `rgba(255,215,107,${alpha})` : `rgba(124,208,255,${alpha})`;
      renderer.drawWorldText(vec3(f.x, 0, f.z), f.text, { fill: col, font: '13px monospace', align: 'center', dy: -18 - u * 34 });
    }

    // Cheat mode: label every live member of each active content-authored wave with its
    // WaveDef.id, so the wave being pointed at can be named precisely regardless of which of its
    // ships is on screen. [dev cheat]
    if (cheatUnlocked) {
      for (const rec of sim.state.waves.active.values()) {
        if (!rec.defId) continue;
        for (const id of rec.members) {
          const e = sim.state.entities.get(id);
          if (!e) continue;
          renderer.drawWorldText(e.pos, rec.defId, { fill: 'rgba(255,215,107,0.9)', font: '13px monospace', align: 'center', dy: -24 });
        }
      }

      // Giant asteroids get the same treatment via their own authored id, so an obstacle can be
      // referred to precisely too (e.g. "g2 needs to move left"). [ROC-GIANT-1, dev cheat]
      for (const e of sim.state.entities.values()) {
        if (e.kind !== 'asteroid' || !e.indestructible || !e.debugLabel) continue;
        renderer.drawWorldText(e.pos, e.debugLabel, { fill: 'rgba(255,215,107,0.9)', font: '13px monospace', align: 'center', dy: -24 });
      }
    }

    // --- full-screen overlays -------------------------------------------------
    const { w, h } = renderer.getViewport().box;

    // Boss health bar: horizontal, black and white, top of the screen; shields + hull so the
    // bar moves from the very first hit. [ROC-BOSS-2]
    const boss = [...sim.state.entities.values()].find((e) => e.kind === 'boss');
    if (boss) {
      const total = (boss.shield ?? 0) + (boss.hull ?? 0);
      const max = (boss.shieldMax ?? 0) + (boss.hullMax ?? 1);
      const frac = Math.max(0, Math.min(1, total / max));
      const bw = w * 0.62;
      const bx = (w - bw) / 2;
      const by = 18;
      const bh = 10;
      ctx!.fillStyle = '#000';
      ctx!.fillRect(bx, by, bw, bh);
      ctx!.fillStyle = '#fff';
      ctx!.fillRect(bx, by, bw * frac, bh);
      ctx!.strokeStyle = '#fff';
      ctx!.lineWidth = 1.5;
      ctx!.strokeRect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
    }

    // "RIGHT ON COMMANDER" after a boss kill: holds, then fades with the sim's timer, and the
    // FSM resumes scrolling when it hits zero. [ROC-BOSS-3,4]
    if (sim.state.bossFadeTtl > 0) {
      const a = Math.min(1, sim.state.bossFadeTtl / (BOSS_FADE_SEC * 0.55));
      renderer.drawText('RIGHT ON COMMANDER', { x: w / 2, y: h * 0.42 }, {
        fill: `rgba(255,255,255,${a.toFixed(2)})`,
        font: '28px monospace',
        align: 'center',
      });
    }

    // Boss ECM: white screen flash + "ECM" at the bottom. [ROC-BECM-1,3]
    if (ecmFlashTtl > 0) {
      ctx!.fillStyle = `rgba(255,255,255,${(0.65 * (ecmFlashTtl / ECM_FLASH_SEC)).toFixed(2)})`;
      ctx!.fillRect(0, 0, w, h);
    }
    if (ecmTextTtl > 0) {
      renderer.drawText('ECM', { x: w / 2, y: h - 24 }, { fill: '#fff', font: '20px monospace', align: 'center' });
    }

    // Emergency energy bomb: a brighter flash + a caption at the top. [ROC-BOMB-4]
    if (bombFlashTtl > 0) {
      ctx!.fillStyle = `rgba(255,255,255,${(0.85 * (bombFlashTtl / BOMB_FLASH_SEC)).toFixed(2)})`;
      ctx!.fillRect(0, 0, w, h);
    }
    if (bombTextTtl > 0) {
      const a = Math.min(1, bombTextTtl / (BOMB_TEXT_SEC * 0.4));
      renderer.drawText('Emergency energy bomb deployed', { x: w / 2, y: 24 }, {
        fill: `rgba(255,255,255,${a.toFixed(2)})`,
        font: '16px monospace',
        align: 'center',
      });
    }

    // Hyperspace countdown: "Hyperspace Lave 5" ... 1. [ROC-HYP-2]
    if (sim.state.levelState === 'HYPERSPACE') {
      const n = hyperCountdown(sim.state.levelTimer);
      if (n !== null) {
        renderer.drawText(`Hyperspace ${currentLevel().name} ${n}`, { x: w / 2, y: h * 0.3 }, {
          fill: '#fff',
          font: '22px monospace',
          align: 'center',
        });
      }
    }

    // Post-jump system info card: a few classic-Elite facts. [ROC-HYP-5]
    if (sim.state.levelState === 'INFO') {
      renderer.drawText(currentLevel().name.toUpperCase(), { x: w / 2, y: h * 0.3 }, { fill: '#fff', font: '26px monospace', align: 'center' });
      (currentLevel().facts ?? []).forEach((line, i) => {
        renderer.drawText(line, { x: w / 2, y: h * 0.3 + 34 + i * 22 }, { fill: 'rgba(255,255,255,0.85)', font: '14px monospace', align: 'center' });
      });
    }

    // Cheat unlock flash: a brief confirmation the corner-tap sequence worked. [dev cheat]
    if (cheatFlashTtl > 0) {
      const a = Math.min(1, cheatFlashTtl / (CHEAT_FLASH_SEC * 0.5));
      renderer.drawText(`CHEAT ACTIVE — +${CHEAT_LIVES} lives, +${CHEAT_CREDITS.toLocaleString()}cr`, { x: w / 2, y: h * 0.2 }, {
        fill: `rgba(255,255,255,${a.toFixed(2)})`,
        font: '16px monospace',
        align: 'center',
      });
    }

    // Corner-tap debug readout: shows on every corner-zone tap, even before (and win-)unlock, so a
    // failed attempt is diagnosable on-screen — no devtools needed, works on a phone. [dev cheat]
    if (cheatDebugTtl > 0 && !cheatUnlocked) {
      const a = Math.min(1, cheatDebugTtl / (CHEAT_DEBUG_SEC * 0.5));
      renderer.drawText(cheatDebugText, { x: w / 2, y: h * 0.12 }, {
        fill: `rgba(255,215,107,${a.toFixed(2)})`,
        font: '13px monospace',
        align: 'center',
      });
    }

    // Skip Level: revealed once the corner-tap cheat is unlocked; wipes the current combat and
    // jumps straight to the docking approach. [dev cheat]
    if (cheatUnlocked && !dockActive()) {
      const r = skipButtonRect(w);
      ctx!.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx!.lineWidth = 1;
      ctx!.strokeRect(r.x, r.y, r.w, r.h);
      renderer.drawText('SKIP LEVEL', { x: r.x + r.w / 2, y: r.y + r.h / 2 + 4 }, {
        fill: 'rgba(255,255,255,0.85)',
        font: '11px monospace',
        align: 'center',
      });
    }

    // Pause: same visibility as Skip Level, sits directly below it. [dev cheat]
    if (cheatUnlocked && !dockActive()) {
      const r = pauseButtonRect(w);
      ctx!.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx!.lineWidth = 1;
      ctx!.strokeRect(r.x, r.y, r.w, r.h);
      renderer.drawText(paused ? 'RESUME' : 'PAUSE', { x: r.x + r.w / 2, y: r.y + r.h / 2 + 4 }, {
        fill: 'rgba(255,255,255,0.85)',
        font: '11px monospace',
        align: 'center',
      });
    }

    if (paused) {
      renderer.drawText('PAUSED', { x: w / 2, y: h * 0.46 }, { fill: '#fff', font: '20px monospace', align: 'center' });
    }

    // Rewind: same visibility as Skip Level/Pause, sits directly below Pause. Labelled with the
    // seconds the next press will actually jump — capped at REWIND_SEC, but shows less whenever
    // that's all the buffer currently holds — so it's never ambiguous whether a press will land
    // short (or do nothing at all). [dev cheat]
    if (cheatUnlocked && !dockActive()) {
      const r = rewindButtonRect(w);
      const availableSec = rewindAvailableSec();
      const enabled = availableSec >= SNAPSHOT_INTERVAL_SEC;
      const jumpSec = Math.round(Math.min(REWIND_SEC, availableSec));
      ctx!.strokeStyle = enabled ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)';
      ctx!.lineWidth = 1;
      ctx!.strokeRect(r.x, r.y, r.w, r.h);
      renderer.drawText(`REWIND ${enabled ? jumpSec : REWIND_SEC}s`, { x: r.x + r.w / 2, y: r.y + r.h / 2 + 4 }, {
        fill: enabled ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
        font: '11px monospace',
        align: 'center',
      });
    }

    // Wave-authoring clock: elapsed ms since the current level state began — read this off the
    // screen and drop it straight into a new wave/asteroid entry's delayMs. [dev cheat]
    if (cheatUnlocked && !dockActive()) {
      const r = clockReadoutRect(w);
      renderer.drawText(sim.state.levelState, { x: r.x + r.w / 2, y: r.y + r.h / 2 - 3 }, {
        fill: 'rgba(255,215,107,0.85)',
        font: '9px monospace',
        align: 'center',
      });
      renderer.drawText(`${Math.round(cheatClockMs)}ms`, { x: r.x + r.w / 2, y: r.y + r.h / 2 + 11 }, {
        fill: 'rgba(255,215,107,0.85)',
        font: '13px monospace',
        align: 'center',
      });
    }

    // Temporary diagnostic readout for a reported iPad touch/pen input discrepancy: the canvas
    // size as measured by the renderer (clientWidth/clientHeight, used for the box the game is
    // drawn against) versus by DomInput (getBoundingClientRect, used for the box input is read
    // against) — if these ever disagree, that's the bug; if they match, the problem is elsewhere.
    // Remove once the discrepancy is understood. [dev cheat]
    if (cheatUnlocked && !dockActive()) {
      const rect = canvas!.getBoundingClientRect();
      const vp = renderer.getViewport();
      const dpr = window.devicePixelRatio || 1;
      const lines = [
        `client ${Math.round(canvas!.clientWidth)}x${Math.round(canvas!.clientHeight)}  rect ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        `box ${Math.round(vp.box.w)}x${Math.round(vp.box.h)} @(${Math.round(vp.box.x)},${Math.round(vp.box.y)}) rot:${vp.rotated} dpr:${dpr.toFixed(2)}`,
      ];
      lines.forEach((line, i) => {
        renderer.drawText(line, { x: 8, y: 20 + i * 14 }, { fill: 'rgba(255,215,107,0.9)', font: '11px monospace', align: 'left' });
      });
    }

    // Wave designer entry point: only meaningful in the four phases with authored content, but
    // stays visible (dimmed) elsewhere rather than popping in/out. [wave-designer-spec.md]
    if (cheatUnlocked && !dockActive()) {
      const r = designButtonRect(w);
      const available = isDesignPhase(sim.state.levelState as never);
      ctx!.strokeStyle = available ? 'rgba(255,215,107,0.7)' : 'rgba(255,255,255,0.25)';
      ctx!.lineWidth = 1;
      ctx!.strokeRect(r.x, r.y, r.w, r.h);
      renderer.drawText('DESIGN', { x: r.x + r.w / 2, y: r.y + r.h / 2 + 4 }, {
        fill: available ? 'rgba(255,215,107,0.9)' : 'rgba(255,255,255,0.35)',
        font: '11px monospace',
        align: 'center',
      });
    }

    if (sim.state.mode === 'GAME_OVER') {
      renderer.drawText('GAME OVER', { x: w / 2, y: h / 2 }, { fill: '#f55', font: '32px monospace', align: 'center' });
    } else {
      // Persistent status bar, bottom of the screen: shield, missile level + countdown, energy
      // bomb, energy bank countdown, score/credits/lives. No hull readout — the player has no hull
      // buffer once shields are down, one more hit is simply lethal. An ECM countdown will join
      // this row later. [ROC-HUD-2,3]
      const ps = sim.state.player;
      const missileStr = ps.missileGrade > 0 ? `Missile L${ps.missileGrade} ${Math.ceil(ps.missileTimer)}s` : 'Missile -';
      const bombCap = energyBombCap(ps.shipClass);
      const bankStr = ps.energyBank ? `Bank ${Math.ceil(ps.energyBankTimer)}s` : 'Bank -';
      const cloakStr = ps.cloakTtl > 0 ? `   Cloak ${Math.ceil(ps.cloakTtl)}s` : '';
      renderer.drawText(
        `Shield ${player.shield ?? 0}/${player.shieldMax ?? 0}   ${missileStr}   Bomb ${ps.energyBombs}/${bombCap}   ${bankStr}${cloakStr}`,
        { x: w / 2, y: h - 32 },
        { fill: '#9ab', font: '12px monospace', align: 'center' },
      );
      renderer.drawText(
        `Score ${sim.state.econ.score}   Credits ${sim.state.econ.wallet}cr   Lives ${ps.lives}`,
        { x: w / 2, y: h - 14 },
        { fill: '#9ab', font: '12px monospace', align: 'center' },
      );
    }

    renderer.endFrame(alpha);
    drawRotateHint();
  },
});

(window as unknown as { __rocBooted?: boolean; __rocSim?: unknown }).__rocBooted = true;
(window as unknown as { __rocSim?: unknown }).__rocSim = sim; // headed-debug handle (state inspection)
document.getElementById('boot')?.remove();
