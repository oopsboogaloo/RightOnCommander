// Browser entry point (the shell). For T1.2 this drives a rotating Sidewinder to exercise the
// software-3D renderer (cull + painter sort + black-fill/white-stroke + starfield). The
// fixed-timestep loop wired to the real sim arrives in T1.3.

import { Renderer2D } from '../render/renderer2d.js';
import { modelMatrix } from '../render/project.js';
import { vec3 } from '../sim/math/vec3.js';
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

const renderer = new Renderer2D(ctx);
const mesh = sidewinder as unknown as Mesh;

let yaw = 0;
function frame(): void {
  yaw += 0.012;
  renderer.beginFrame();
  renderer.drawMesh(mesh, modelMatrix(vec3(0, 0, 0), yaw, 0));
  renderer.endFrame(0);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
