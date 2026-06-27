// Browser entry point (the shell). Wires the deterministic sim to the real renderer through
// the fixed-timestep loop: the sim steps at DT while the renderer interpolates between the
// last two states for smooth motion at the display rate. [tasks T1.3, design §3]

import { createSim } from '../sim/index.js';
import { PLAYER_ID } from '../sim/world.js';
import { vec3 } from '../sim/math/vec3.js';
import { Renderer2D } from '../render/renderer2d.js';
import { modelMatrix } from '../render/project.js';
import { startGameLoop, DT } from './loop.js';
import { DomInput } from '../input/domInput.js';
import { createLocalStorage } from './storage.js';
import type { Mesh } from '../interfaces.js';
import sidewinder from '../content/meshes/sidewinder.json';

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

const sim = createSim({ seed: 1 });
const renderer = new Renderer2D(ctx);
const input = new DomInput({ canvas, storage: createLocalStorage() });
const mesh = sidewinder as unknown as Mesh;

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

// Keep the last two render-relevant poses so the renderer can interpolate between them.
let prev = readPlayerPose();
let curr = prev;

startGameLoop({
  step: () => {
    prev = curr;
    sim.step(input.sample(DT));
    curr = readPlayerPose();
  },
  render: (alpha) => {
    const pos = vec3(
      lerp(prev.x, curr.x, alpha),
      lerp(prev.y, curr.y, alpha),
      lerp(prev.z, curr.z, alpha),
    );
    renderer.beginFrame();
    renderer.drawMesh(mesh, modelMatrix(pos, lerp(prev.yaw, curr.yaw, alpha), lerp(prev.bank, curr.bank, alpha)));
    renderer.endFrame(alpha);
  },
});
