// Browser entry point (the shell). Wires the deterministic sim to the real renderer through
// the fixed-timestep loop, loads Level 1 content, and renders ships, lasers, missiles,
// particles and pickups. [tasks T1.3/T5.2, design §3]

import { createSim, SHIP_SCALE } from '../sim/index.js';
import { PLAYER_ID } from '../sim/world.js';
import { vec3, sub, scale, normalize, type Vec3 } from '../sim/math/vec3.js';
import { Renderer2D } from '../render/renderer2d.js';
import { modelMatrix } from '../render/project.js';
import { startGameLoop, DT } from './loop.js';
import { DomInput } from '../input/domInput.js';
import { createLocalStorage } from './storage.js';
import type { Mesh } from '../interfaces.js';
import type { Entity } from '../sim/components.js';

import {
  sellCargo,
  buyShip,
  fitLaserAt,
  buyEcm,
  buyEnergyBomb,
  buyEscapePod,
  buyLife,
  upgradeMissile,
  launch,
  type PricesContent,
  type StationContext,
} from '../sim/systems/station.js';
import { loadShips, type LaserType } from '../sim/systems/ships.js';
import { stationButtons, buttonAt, drawStation, type StationAction } from '../render/screens/station.js';

import enemies from '../content/enemies.json';
import level1 from '../content/level1.json';
import shipsJson from '../content/ships.json';
import economyJson from '../content/economy.json';
import cobra_mk3 from '../content/meshes/cobra_mk3.json';
import sidewinder from '../content/meshes/sidewinder.json';
import asp_mk2 from '../content/meshes/asp_mk2.json';
import krait from '../content/meshes/krait.json';
import gecko from '../content/meshes/gecko.json';
import adder from '../content/meshes/adder.json';
import viper from '../content/meshes/viper.json';
import fer_de_lance from '../content/meshes/fer_de_lance.json';
import coriolis from '../content/meshes/coriolis.json';
import transporter from '../content/meshes/transporter.json';
import asteroid from '../content/meshes/asteroid.json';
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

const MESHES: Record<string, Mesh> = {
  cobra_mk3,
  sidewinder,
  asp_mk2,
  krait,
  gecko,
  adder,
  viper,
  fer_de_lance,
  coriolis,
  transporter,
  asteroid,
  splinter,
  canister,
  gem,
} as unknown as Record<string, Mesh>;

const sim = createSim({ seed: 1, content: { enemies, level: level1, meshes: MESHES } });
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
    case 'pod': buyEscapePod(w, stationCtx); break;
    case 'life': buyLife(w, stationCtx); break;
    case 'missile': upgradeMissile(w, stationCtx); break;
    case 'launch':
      if (!launchArmed) { launchArmed = true; break; } // first tap arms the confirm [ROC-STN-6]
      if (launch(w, true).ok) { sim.relaunch(); launchArmed = false; }
      break;
  }
}

canvas.addEventListener('pointerdown', (e) => {
  if (!dockActive()) return;
  const w = canvas!.clientWidth || canvas!.width;
  const h = canvas!.clientHeight || canvas!.height;
  const btn = buttonAt(stationButtons(sim.state, stationCtx, w, h, launchArmed, selectedLaser), e.offsetX, e.offsetY);
  if (btn && btn.enabled) runStationAction(btn.action);
});

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
const MINI_ASTEROID_SCALE = 0.15; // a splinter renders as a small asteroid chunk, not the bbcelite shard shape

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

// Concentric shield ellipses = remaining strength; brighten briefly when a hit is absorbed.
// Drawn a little outside the hull for clarity, foreshortened by the camera. [ROC-DMG-2,3]
function drawShield(e: Entity, center: Vec3 = e.pos): void {
  const rings = e.shield ?? 0;
  if (rings <= 0) return;
  const flash = (e.shieldFlashTtl ?? 0) > 0;
  const rx = (e.colliderRx ?? 0.3) * SHIP_SCALE;
  const rz = (e.colliderRz ?? 0.3) * SHIP_SCALE;
  for (let i = 0; i < rings; i++) {
    const f = 1.25 + i * 0.28; // each remaining ring sits a little further out
    renderer.drawWorldEllipse(center, rx * f, rz * f, {
      stroke: flash ? '#cffcff' : '#39d',
      lineWidth: flash ? 2.5 : 1.2,
    });
  }
}

let prev = readPlayerPose();
let curr = prev;

// Floating credit/bonus text that rises from a kill and fades. [ROC-KC-1,2,3]
interface Floater { x: number; z: number; text: string; color: string; age: number; ttl: number }
const floaters: Floater[] = [];
const FLOATER_TTL = 1.1;

function drainFloaters(events: ReturnType<typeof sim.step>): void {
  for (const ev of events) {
    if (ev.type === 'floatingText' && (ev.category === 'bounty' || ev.category === 'cargo')) {
      const pos = (ev.pos as { x: number; z: number }) ?? curr;
      floaters.push({ x: pos.x, z: pos.z, text: String(ev.text ?? ''), color: ev.category === 'bounty' ? '#ffd76b' : '#7cd0ff', age: 0, ttl: FLOATER_TTL });
    } else if (ev.type === 'waveBonus') {
      floaters.push({ x: 0, z: curr.z + 0.4, text: `BONUS +${ev.amount}`, color: '#ffd76b', age: 0, ttl: FLOATER_TTL * 1.4 });
    }
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].age += DT;
    if (floaters[i].age >= floaters[i].ttl) floaters.splice(i, 1);
  }
}

startGameLoop({
  step: () => {
    prev = curr;
    const events = sim.step(input.sample(DT));
    curr = readPlayerPose();
    drainFloaters(events);
  },
  render: (alpha) => {
    renderer.beginFrame();

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
          // Missiles render as a small dart; pulses as a slightly longer streak. [ROC-MIS-6]
          const len = e.kind === 'missile' ? 0.09 : PULSE_LEN;
          const tail = sub(e.pos, scale(normalize(e.vel), len));
          renderer.drawWorldLine(e.pos, tail, { stroke: e.kind === 'missile' ? '#ffb060' : '#fff', lineWidth: 2 });
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
          const m = MESHES[pickupMeshId(e.pickup)];
          if (!m) break;
          const phase = e.id * 0.7; // per-entity offset so pickups don't spin in lockstep
          renderer.drawMesh(m, modelMatrix(e.pos, now * 1.1 + phase, now * 0.8 + phase * 1.3, PICKUP_SCALE));
          break;
        }
        case 'enemy':
        case 'boss': {
          const m = e.meshId ? MESHES[e.meshId] : undefined;
          if (m) renderer.drawMesh(m, modelMatrix(e.pos, e.yaw, e.bank, SHIP_SCALE), hullFlash(e));
          drawShield(e);
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

    // Player ship, interpolated between the last two sim states. Blink while invulnerable
    // (just spawned / after a hit) so the i-frames read on screen. [ROC-LIFE-2]
    const player = sim.state.entities.get(PLAYER_ID)!;
    const invuln = sim.state.player.invulnTtl;
    const blinkOff = invuln > 0 && Math.floor(invuln / 0.1) % 2 === 1;
    if (sim.state.mode !== 'GAME_OVER' && !blinkOff) {
      const pmesh = (player.meshId && MESHES[player.meshId]) || MESHES.sidewinder;
      const pos = vec3(lerp(prev.x, curr.x, alpha), lerp(prev.y, curr.y, alpha), lerp(prev.z, curr.z, alpha));
      renderer.drawMesh(pmesh, modelMatrix(pos, lerp(prev.yaw, curr.yaw, alpha), lerp(prev.bank, curr.bank, alpha), SHIP_SCALE), hullFlash(player));
      drawShield(player, pos);
    }

    // Floating credit/bonus numbers, rising and fading from the explosion. [ROC-KC-1,2,3]
    for (const f of floaters) {
      const u = f.age / f.ttl;
      const alpha = (1 - u).toFixed(2);
      const col = f.color === '#ffd76b' ? `rgba(255,215,107,${alpha})` : `rgba(124,208,255,${alpha})`;
      renderer.drawWorldText(vec3(f.x, 0, f.z), f.text, { fill: col, font: '13px monospace', align: 'center', dy: -18 - u * 34 });
    }

    if (sim.state.mode === 'GAME_OVER') {
      const cx = (canvas!.clientWidth || canvas!.width) / 2;
      const cy = (canvas!.clientHeight || canvas!.height) / 2;
      renderer.drawText('GAME OVER', { x: cx, y: cy }, { fill: '#f55', font: '32px monospace', align: 'center' });
    }

    renderer.endFrame(alpha);
  },
});

(window as unknown as { __rocBooted?: boolean }).__rocBooted = true;
document.getElementById('boot')?.remove();
