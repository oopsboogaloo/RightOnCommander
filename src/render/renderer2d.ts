// Canvas 2D backend implementing the Renderer interface: software-3D hulls (cull + painter
// sort + black fill + white stroke), plus a slow starfield, lines, ellipses, particles and
// text. Read-only over sim state. [design §7, ROC-VIS-1..8]

import type { Renderer, Mesh, Vec2, DrawOpts } from '../interfaces.js';
import type { Mat4 } from '../sim/math/mat4.js';
import type { Vec3 } from '../sim/math/vec3.js';
import { type Camera, createCamera } from './camera.js';
import { prepareMesh, projectPoint, type Projected } from './project.js';

interface Star {
  x: number; // normalised [0,1) across the canvas
  y: number;
  z: number; // parallax layer in (0,1]; larger = nearer/faster/brighter
}

class Starfield {
  private stars: Star[] = [];

  constructor(count = 140) {
    for (let i = 0; i < count; i++) {
      // Render-only randomness (not part of the deterministic sim).
      this.stars.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 });
    }
  }

  update(dt: number): void {
    for (const s of this.stars) {
      s.y += dt * 0.05 * s.z; // slow downward scroll, nearer stars faster [ROC-VIS-7]
      if (s.y >= 1) {
        s.y -= 1;
        s.x = Math.random();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    for (const s of this.stars) {
      const shade = Math.round(120 + s.z * 135);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      const size = s.z * 1.6;
      ctx.fillRect(s.x * w, s.y * h, size, size);
    }
  }
}

export class Renderer2D implements Renderer {
  private ctx: CanvasRenderingContext2D;
  private starfield: Starfield;
  camera: Camera;

  // Viewport mapping, refreshed each frame.
  private cx = 0;
  private cy = 0;
  private scale = 1;
  private w = 0;
  private h = 0;

  constructor(ctx: CanvasRenderingContext2D, camera: Camera = createCamera()) {
    this.ctx = ctx;
    this.camera = camera;
    this.starfield = new Starfield();
  }

  private refreshViewport(): void {
    const { canvas } = this.ctx;
    this.w = canvas.clientWidth || canvas.width;
    this.h = canvas.clientHeight || canvas.height;
    this.cx = this.w / 2;
    this.cy = this.h / 2;
    this.scale = Math.min(this.w, this.h) * 0.5; // pixels per projected unit
  }

  // Projected (y-up) -> canvas pixels (y-down).
  private toPixel(p: Projected): Vec2 {
    return { x: this.cx + p.x * this.scale, y: this.cy - p.y * this.scale };
  }

  beginFrame(): void {
    this.refreshViewport();
    const { ctx } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.w, this.h);
    this.starfield.update(1 / 60);
    this.starfield.draw(ctx, this.w, this.h);
  }

  drawMesh(mesh: Mesh, xform: unknown, opts: DrawOpts = {}): void {
    const model = xform as Mat4;
    const prep = prepareMesh(mesh, model, this.camera);
    const { ctx } = this;

    ctx.lineJoin = 'round';
    ctx.lineWidth = (opts.lineWidth as number) ?? 1.5;
    ctx.fillStyle = (opts.fill as string) ?? '#000';
    ctx.strokeStyle = (opts.stroke as string) ?? '#fff';

    for (const face of prep.faces) {
      ctx.beginPath();
      face.loop.forEach((vi, i) => {
        const px = this.toPixel(prep.projected[vi]);
        if (i === 0) ctx.moveTo(px.x, px.y);
        else ctx.lineTo(px.x, px.y);
      });
      ctx.closePath();
      ctx.fill(); // black fill occludes hulls behind (painter order) [ROC-VIS-2,5]
      ctx.stroke(); // white vector edges [ROC-VIS-1]
    }

    // Decorative detail lines (gun barrel, cockpit/engine work) drawn over the hull, but only
    // while one of each edge's controlling faces is visible — Elite's hidden-line rule. [ROC-VIS-1]
    if (mesh.details) {
      for (const d of mesh.details) {
        if (!prep.faceVisible[d.faces[0]] && !prep.faceVisible[d.faces[1]]) continue;
        const a = this.toPixel(prep.projected[d.edge[0]]);
        const b = this.toPixel(prep.projected[d.edge[1]]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  // Project a world-space segment and stroke it (lasers, dock wireframe). [ROC-LAS-4]
  drawWorldLine(a: Vec3, b: Vec3, opts: DrawOpts = {}): void {
    const pa = this.toPixel(projectPoint(this.camera, a));
    const pb = this.toPixel(projectPoint(this.camera, b));
    this.drawLine(pa, pb, opts);
  }

  // Project world-space points and draw them as small dots (explosion particles). [ROC-VIS-6]
  drawWorldParticles(points: Vec3[], opts: DrawOpts = {}): void {
    this.drawParticles(
      points.map((p) => this.toPixel(projectPoint(this.camera, p))),
      opts,
    );
  }

  // The 2D primitives below take canvas-pixel coordinates; they get richer use in later tasks.
  drawLine(a: Vec2, b: Vec2, opts: DrawOpts = {}): void {
    const { ctx } = this;
    ctx.strokeStyle = (opts.stroke as string) ?? '#fff';
    ctx.lineWidth = (opts.lineWidth as number) ?? 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  drawEllipse(c: Vec2, rx: number, ry: number, opts: DrawOpts = {}): void {
    const { ctx } = this;
    ctx.strokeStyle = (opts.stroke as string) ?? '#fff';
    ctx.lineWidth = (opts.lineWidth as number) ?? 1;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawParticles(points: Vec2[], opts: DrawOpts = {}): void {
    const { ctx } = this;
    ctx.fillStyle = (opts.fill as string) ?? '#fff';
    const size = (opts.size as number) ?? 2;
    for (const p of points) ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }

  drawText(text: string, pos: Vec2, opts: DrawOpts = {}): void {
    const { ctx } = this;
    ctx.fillStyle = (opts.fill as string) ?? '#fff';
    ctx.font = (opts.font as string) ?? '16px monospace';
    ctx.textAlign = (opts.align as CanvasTextAlign) ?? 'left';
    ctx.fillText(text, pos.x, pos.y);
  }

  endFrame(_alpha: number): void {
    // Single-buffered canvas; nothing to flush yet.
  }
}
