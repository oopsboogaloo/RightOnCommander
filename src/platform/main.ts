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

import enemies from '../content/enemies.json';
import level1 from '../content/level1.json';
import cobra_mk3 from '../content/meshes/cobra_mk3.json';
import sidewinder from '../content/meshes/sidewinder.json';
import krait from '../content/meshes/krait.json';
import gecko from '../content/meshes/gecko.json';
import adder from '../content/meshes/adder.json';
import viper from '../content/meshes/viper.json';
import fer_de_lance from '../content/meshes/fer_de_lance.json';
import coriolis from '../content/meshes/coriolis.json';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
if (!canvas) throw new Error('gameCanvas element not found');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas context unavailable');

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
  krait,
  gecko,
  adder,
  viper,
  fer_de_lance,
  coriolis,
} as unknown as Record<string, Mesh>;

const sim = createSim({ seed: 1, content: { enemies, level: level1 } });
const renderer = new Renderer2D(ctx);
const input = new DomInput({ canvas, storage: createLocalStorage() });

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

// White flash over the whole hull while a hull-damage hit is fresh. [ROC-DMG-6,6a]
function hullFlash(e: Entity): { fill: string; stroke: string } | undefined {
  return (e.flashTtl ?? 0) > 0 ? { fill: '#fff', stroke: '#fff' } : undefined;
}

// Concentric shield ellipses = remaining strength; brighten briefly when a hit is absorbed.
// Drawn a little outside the hull for clarity, foreshortened by the camera. [ROC-DMG-2,3]
function drawShield(e: Entity): void {
  const rings = e.shield ?? 0;
  if (rings <= 0) return;
  const flash = (e.shieldFlashTtl ?? 0) > 0;
  const rx = (e.colliderRx ?? 0.3) * SHIP_SCALE;
  const rz = (e.colliderRz ?? 0.3) * SHIP_SCALE;
  for (let i = 0; i < rings; i++) {
    const f = 1.25 + i * 0.28; // each remaining ring sits a little further out
    renderer.drawWorldEllipse(e.pos, rx * f, rz * f, {
      stroke: flash ? '#cffcff' : '#39d',
      lineWidth: flash ? 2.5 : 1.2,
    });
  }
}

let prev = readPlayerPose();
let curr = prev;

startGameLoop({
  step: () => {
    prev = curr;
    sim.step(input.sample(DT));
    curr = readPlayerPose();
  },
  render: (alpha) => {
    renderer.beginFrame();

    const particles: Vec3[] = [];
    const pickups: Vec3[] = [];
    for (const e of sim.state.entities.values()) {
      switch (e.kind) {
        case 'projectile':
        case 'missile': {
          const tail = sub(e.pos, scale(normalize(e.vel), PULSE_LEN));
          renderer.drawWorldLine(e.pos, tail, { stroke: '#fff', lineWidth: e.kind === 'missile' ? 3 : 2 });
          break;
        }
        case 'particle':
          particles.push(e.pos);
          break;
        case 'pickup':
          pickups.push(e.pos);
          break;
        case 'enemy':
        case 'boss': {
          const m = e.meshId ? MESHES[e.meshId] : undefined;
          if (m) renderer.drawMesh(m, modelMatrix(e.pos, e.yaw, e.bank, SHIP_SCALE), hullFlash(e));
          drawShield(e);
          break;
        }
        default:
          break;
      }
    }
    if (particles.length) renderer.drawWorldParticles(particles, { fill: '#fff', size: 2 });
    if (pickups.length) renderer.drawWorldParticles(pickups, { fill: '#6cf', size: 7 });

    // Player ship, interpolated between the last two sim states.
    const player = sim.state.entities.get(PLAYER_ID)!;
    const pmesh = (player.meshId && MESHES[player.meshId]) || MESHES.cobra_mk3;
    const pos = vec3(lerp(prev.x, curr.x, alpha), lerp(prev.y, curr.y, alpha), lerp(prev.z, curr.z, alpha));
    renderer.drawMesh(pmesh, modelMatrix(pos, lerp(prev.yaw, curr.yaw, alpha), lerp(prev.bank, curr.bank, alpha), SHIP_SCALE), hullFlash(player));

    renderer.endFrame(alpha);
  },
});

(window as unknown as { __rocBooted?: boolean }).__rocBooted = true;
document.getElementById('boot')?.remove();
