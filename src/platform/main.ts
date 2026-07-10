// Browser entry point (the shell). Wires the deterministic sim to the real renderer through
// the fixed-timestep loop, loads Level 1 content, and renders ships, lasers, missiles,
// particles and pickups. [tasks T1.3/T5.2, design §3]

import { createSim, SHIP_SCALE } from '../sim/index.js';
import { PLAYER_ID } from '../sim/world.js';
import { vec3, sub, scale, normalize, type Vec3 } from '../sim/math/vec3.js';
import { Renderer2D } from '../render/renderer2d.js';
import { modelMatrix } from '../render/project.js';
import type { Mat4 } from '../sim/math/mat4.js';
import { startGameLoop, DT } from './loop.js';
import { DomInput } from '../input/domInput.js';
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
import { SPLINTER_HIT_SCALE } from '../sim/systems/asteroids.js';
import { hyperCountdown, BOSS_FADE_SEC } from '../sim/systems/levelstate.js';
import { stationButtons, buttonAt, drawStation, type StationAction } from '../render/screens/station.js';

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
  rock_hermit,
  splinter,
  canister,
  gem,
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
const dockActive = (): boolean => sim.state.levelState === 'DOCK';

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
      if (launch(w, true).ok) { sim.relaunch(); launchArmed = false; }
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
function inRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// Station taps and the cheat's corner detection both need a tap's local (canvas-space) x/y. Mouse
// events carry that in offsetX/offsetY; touch events don't, so it's derived from the bounding
// rect instead — same technique DomInput's own toField() uses for its flight-control targeting.
// Listening on 'mousedown' + 'touchstart' directly (rather than the unified 'pointerdown') matches
// DomInput's existing input handling, since pointer events aren't uniformly reliable for touch
// across every mobile browser/WebView. [dev cheat]
function handleTapAt(px: number, py: number): void {
  const w = canvas!.clientWidth || canvas!.width;
  const h = canvas!.clientHeight || canvas!.height;

  tryCheatTap(px, py, w, h);

  if (dockActive()) {
    const btn = buttonAt(stationButtons(sim.state, stationCtx, w, h, launchArmed, selectedLaser), px, py);
    if (btn && btn.enabled) runStationAction(btn.action);
    return;
  }

  if (cheatUnlocked && inRect(px, py, skipButtonRect(w))) sim.cheatSkipLevel();
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
const PICKUP_SCALE = 1 / 9; // canister/gem read as small props, not ship-sized [was 1/3]
const GEM_SCALE = PICKUP_SCALE * 0.5; // -50% [tuning]
const MINI_ASTEROID_SCALE = SPLINTER_HIT_SCALE; // matches the sim's splinter collision scale exactly

// Asteroid-mined loot (alloys/gems power-ups and their Metals/Crystals cargo, ROC-L1-3) reads as
// a gem, not salvage; everything else (equipment power-ups, market cargo from ships) is a drifting
// cargo canister.
const GEM_COMMODITIES = new Set(['Metals', 'Crystals']);
function pickupMeshId(pickup: { type: string; commodity?: string }): string {
  if (pickup.type === 'alloys' || pickup.type === 'gems') return 'gem';
  if (pickup.type === 'cargo' && pickup.commodity && GEM_COMMODITIES.has(pickup.commodity)) return 'gem';
  return 'canister';
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

startGameLoop({
  step: () => {
    prev = curr;
    const events = sim.step(input.sample(DT));
    // Dense-belt levels show the drifting asteroid backdrop. Follows whichever level is active,
    // not just the first. [ROC-L1-1]
    const lvl = currentLevel() as { backdrop?: string };
    renderer.showAsteroidBackdrop = lvl.backdrop === 'asteroids';
    // Reveal the asteroid belt as we drop out of hyperspace, so it drifts into view — arriving
    // at the field. Idempotent. [ROC-L1-1]
    const ls = sim.state.levelState;
    if (ls !== 'LAUNCH' && ls !== 'HYPERSPACE') renderer.revealAsteroidBelt();
    curr = readPlayerPose();
    drainFloaters(events);
  },
  render: (alpha) => {
    renderer.beginFrame(sim.state.scroll); // sim-owned: 0 halts for bosses, >1 is hyperspace [ROC-BOSS-1, ROC-HYP-3]

    // Docked: show the station shop instead of the play field. [ROC-STN-1]
    if (dockActive()) {
      const w = canvas!.clientWidth || canvas!.width;
      const h = canvas!.clientHeight || canvas!.height;
      const buttons = stationButtons(sim.state, stationCtx, w, h, launchArmed, selectedLaser);
      drawStation(renderer, sim.state, stationCtx, MESHES, buttons, { w, h, time: performance.now() / 1000 });
      renderer.endFrame(alpha);
      return;
    }

    const particles: Vec3[] = [];
    const now = performance.now() / 1000;
    for (const e of sim.state.entities.values()) {
      switch (e.kind) {
        case 'projectile':
        case 'missile': {
          // Missiles render as a small dart; pulses as a slightly longer streak. Enemy laser
          // bolts render at half size so incoming fire reads as smaller than the player's own.
          // Military bolts are shorter and thicker than a pulse. [ROC-LAS-5]
          const isEnemyBolt = e.kind === 'projectile' && e.team === 'enemy';
          const len = e.kind === 'missile' ? 0.09 : e.mil ? PULSE_LEN * 0.55 : isEnemyBolt ? PULSE_LEN * 0.5 : PULSE_LEN;
          const tail = sub(e.pos, scale(normalize(e.vel), len));
          renderer.drawWorldLine(e.pos, tail, {
            stroke: '#fff',
            lineWidth: e.mil ? 4 : isEnemyBolt ? 1 : 2,
          });
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
          const scale = meshId === 'gem' ? GEM_SCALE : PICKUP_SCALE;
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
            renderer.drawMesh(m, model, hullFlash(e));
            drawShield(e, m, model);
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
          const m = isSplinter ? MESHES.asteroid : e.meshId ? MESHES[e.meshId] : undefined;
          if (m) renderer.drawMesh(m, modelMatrix(e.pos, e.yaw, e.bank, isSplinter ? MINI_ASTEROID_SCALE : SHIP_SCALE), hullFlash(e));
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

    // Player ship, interpolated between the last two sim states. Hidden while the wreck's
    // dramatic explosion plays out (respawnPending); blinks only during the fresh-ship window
    // right after a respawn, never for an ordinary hit's brief ramming i-frames. [ROC-LIFE-2,2b,3]
    const player = sim.state.entities.get(PLAYER_ID)!;
    const blink = sim.state.player.respawnBlinkTtl;
    const blinkOff = blink > 0 && Math.floor(blink / 0.1) % 2 === 1;
    if (sim.state.mode !== 'GAME_OVER' && !blinkOff && !sim.state.player.respawnPending) {
      const pmesh = (player.meshId && MESHES[player.meshId]) || MESHES.sidewinder;
      const pos = vec3(lerp(prev.x, curr.x, alpha), lerp(prev.y, curr.y, alpha), lerp(prev.z, curr.z, alpha));
      const model = modelMatrix(
        pos,
        lerp(prev.yaw, curr.yaw, alpha),
        lerp(prev.bank, curr.bank, alpha),
        SHIP_SCALE * (player.scale ?? 1), // the player-flown FdL is 1.5x too [ROC-FDL-1]
      );
      renderer.drawMesh(pmesh, model, hullFlash(player));
      drawShield(player, pmesh, model);
    }

    // Floating credit/bonus numbers, rising and fading from the explosion. [ROC-KC-1,2,3]
    for (const f of floaters) {
      const u = f.age / f.ttl;
      const alpha = (1 - u).toFixed(2);
      const col = f.color === '#ffd76b' ? `rgba(255,215,107,${alpha})` : `rgba(124,208,255,${alpha})`;
      renderer.drawWorldText(vec3(f.x, 0, f.z), f.text, { fill: col, font: '13px monospace', align: 'center', dy: -18 - u * 34 });
    }

    // Cheat mode: label the lead ship of each active content-authored wave with its WaveDef.id,
    // so the wave being pointed at can be named precisely. [dev cheat]
    if (cheatUnlocked) {
      for (const rec of sim.state.waves.active.values()) {
        if (!rec.defId) continue;
        let lead: Entity | undefined;
        for (const id of rec.members) {
          const e = sim.state.entities.get(id);
          if (e && (!lead || e.id < lead.id)) lead = e;
        }
        if (!lead) continue;
        renderer.drawWorldText(lead.pos, rec.defId, { fill: 'rgba(255,215,107,0.9)', font: '10px monospace', align: 'center', dy: -22 });
      }
    }

    // --- full-screen overlays -------------------------------------------------
    const w = canvas!.clientWidth || canvas!.width;
    const h = canvas!.clientHeight || canvas!.height;

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
      renderer.drawText(
        `Shield ${player.shield ?? 0}/${player.shieldMax ?? 0}   ${missileStr}   Bomb ${ps.energyBombs}/${bombCap}   ${bankStr}`,
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
  },
});

(window as unknown as { __rocBooted?: boolean; __rocSim?: unknown }).__rocBooted = true;
(window as unknown as { __rocSim?: unknown }).__rocSim = sim; // headed-debug handle (state inspection)
document.getElementById('boot')?.remove();
