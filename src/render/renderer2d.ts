// Canvas 2D backend implementing the Renderer interface: software-3D hulls (cull + painter
// sort + black fill + white stroke), plus a slow starfield, lines, ellipses, particles and
// text. Read-only over sim state. [design §7, ROC-VIS-1..8]

import type { Renderer, Mesh, Vec2, DrawOpts } from '../interfaces.js';
import type { Mat4 } from '../sim/math/mat4.js';
import type { Vec3 } from '../sim/math/vec3.js';
import { convexHull } from '../sim/math/geom2.js';
import { shieldGap } from '../sim/systems/collision.js';
import { type Camera, createCamera } from './camera.js';
import { prepareMesh, projectPoint, type Projected } from './project.js';
import { offsetPolygonPath } from './shieldRing.js';

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

  // `scroll` is the sim-owned factor: 0 halts the field for boss fights, 1 is the normal
  // drift, and hyperspace ramps it far past 1. [ROC-BOSS-1, ROC-HYP-3]
  update(dt: number, scroll = 1): void {
    for (const s of this.stars) {
      s.y += dt * 0.05 * s.z * scroll;
      if (s.y >= 1) {
        s.y -= s.y | 0; // hyperspace can advance more than a full wrap per frame
        s.x = Math.random();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, scroll = 1, hyperPeak = 30): void {
    // Past normal speed the dots stretch into vertical lines, reaching full screen height at
    // the hyperspace peak, then shrink back as the jump settles. [ROC-HYP-3,4]
    const stretch = Math.max(0, Math.min(1, (scroll - 1) / (hyperPeak - 1)));
    for (const s of this.stars) {
      const shade = Math.round(120 + s.z * 135);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      const size = s.z * 1.6;
      if (stretch <= 0) {
        ctx.fillRect(s.x * w, s.y * h, size, size);
      } else {
        const len = Math.max(size, stretch * h * (0.5 + 0.5 * s.z));
        ctx.fillRect(s.x * w, s.y * h - len, size, len);
      }
    }
  }
}

interface BgRock {
  x: number; // normalised [0,1) across the canvas
  y: number;
  depth: number; // parallax layer (0.6..1], nearer = faster/bigger/lighter
  radius: number; // as a fraction of min(w,h)
  rot: number;
  spin: number; // slow tumble, rad/s
  verts: { x: number; y: number }[]; // unit-circle irregular polygon
}

// A slow, dark-grey wireframe asteroid field drawn just above the starfield, to sell "dense
// asteroid belt" and set this level apart. Render-only (Math.random, wall-clock), like the stars.
class BackgroundAsteroids {
  private rocks: BgRock[] = [];
  private revealed = false;

  constructor(count = 25) {
    for (let i = 0; i < count; i++) {
      const n = 6 + Math.floor(Math.random() * 4); // 6-9 vertices
      const verts: { x: number; y: number }[] = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const r = 0.7 + Math.random() * 0.6; // jagged radius 0.7..1.3
        verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      this.rocks.push({
        x: Math.random(),
        y: Math.random(),
        depth: 0.6 + Math.random() * 0.4,
        radius: 0.012 + Math.random() * 0.04, // range of sizes
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.25,
        verts,
      });
    }
  }

  get isRevealed(): boolean {
    return this.revealed;
  }

  // Called as the ship drops out of hyperspace: park every rock above the top edge (staggered) so
  // the belt drifts into view rather than being there from the start — "arriving at the field".
  reveal(): void {
    if (this.revealed) return;
    this.revealed = true;
    for (const r of this.rocks) {
      r.x = Math.random();
      r.y = -0.02 - Math.random() * 1.5;
    }
  }

  // Drift ~1.5x the starfield's base rate (still very slow), following the sim `scroll` so the
  // belt halts for boss fights; the hyperspace surge is capped so it doesn't go berserk.
  update(dt: number, scroll = 1): void {
    const sc = Math.min(scroll, 3);
    for (const r of this.rocks) {
      r.y += dt * 0.075 * r.depth * sc;
      if (scroll > 0) r.rot += dt * r.spin;
      while (r.y >= 1.1) {
        r.y -= 1.2;
        r.x = Math.random();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const unit = Math.min(w, h);
    ctx.lineWidth = 1;
    for (const r of this.rocks) {
      const cx = r.x * w;
      const cy = r.y * h;
      const rad = r.radius * unit;
      const c = Math.cos(r.rot);
      const s = Math.sin(r.rot);
      const shade = Math.round(42 + r.depth * 34); // dark grey, nearer rocks a touch lighter
      ctx.fillStyle = '#000'; // opaque — occludes the stars behind the rock
      ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
      ctx.beginPath();
      r.verts.forEach((v, i) => {
        const px = cx + (v.x * c - v.y * s) * rad;
        const py = cy + (v.x * s + v.y * c) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

export class Renderer2D implements Renderer {
  private ctx: CanvasRenderingContext2D;
  private starfield: Starfield;
  private bgAsteroids = new BackgroundAsteroids();
  showAsteroidBackdrop = false; // set by the shell for asteroid-belt levels
  showStarBackdrop = false; // set by the shell for the star-surface level [ROC-L3-1]
  starFlareAlpha = 0; // 0..1, set by the shell while a flare is telegraphing [ROC-L3-2]
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

  beginFrame(scroll = 1): void {
    this.refreshViewport();
    const { ctx } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.w, this.h);
    this.starfield.update(1 / 60, scroll);
    this.starfield.draw(ctx, this.w, this.h, scroll);
    if (this.showAsteroidBackdrop && this.bgAsteroids.isRevealed) {
      this.bgAsteroids.update(1 / 60, scroll);
      this.bgAsteroids.draw(ctx, this.w, this.h);
    }
    if (this.showStarBackdrop) this.drawStarBackdrop();
  }

  // A large white star with massive curvature, sitting mostly off the right edge of the field —
  // most of its circle is off-screen, so what's visible reads as a huge, gently-curved limb
  // rather than a small disc. Brightens briefly while a flare telegraphs. [ROC-L3-1,2]
  private drawStarBackdrop(): void {
    const { ctx } = this;
    const r = this.h * 1.15;
    const cx = this.w + r * 0.3;
    const cy = this.h * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    if (this.starFlareAlpha > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1 + 0.04 * this.starFlareAlpha), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${(this.starFlareAlpha * 0.5).toFixed(2)})`;
      ctx.fill();
    }
  }

  // The shell calls this as the ship exits hyperspace, so the belt drifts into view. [ROC-L1-1]
  revealAsteroidBelt(): void {
    this.bgAsteroids.reveal();
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

  // Shield rings: N concentric outlines that hug the hull's own silhouette with a small,
  // rounded outward gap (larger for each further-out ring) rather than an unrelated ellipse, so
  // the ring reads as "this hull's own energy field" and tracks yaw + bank exactly as the hull
  // is drawn. [ROC-DMG-1,3 shield-hug rework]
  drawShieldRing(mesh: Mesh, model: Mat4, hullRadiusWorld: number, rings: number, opts: DrawOpts = {}): void {
    if (rings <= 0 || hullRadiusWorld <= 0) return;
    const prep = prepareMesh(mesh, model, this.camera);
    if (prep.cameraSpace.length < 3) return;

    // Perspective is mild and the hull is small relative to the camera distance, so one
    // world-unit -> pixel factor at the hull's average depth is an acceptable stand-in for
    // projecting each offset point individually. [ROC-VIS-3]
    const avgDepth = prep.cameraSpace.reduce((s, v) => s + v.z, 0) / prep.cameraSpace.length;
    if (avgDepth <= 0) return; // behind the camera
    const pxPerUnit = (this.camera.focal / avgDepth) * this.scale;

    const hullPx = convexHull(prep.projected.map((p) => this.toPixel(p)));
    if (hullPx.length < 3) return;

    const { ctx } = this;
    ctx.strokeStyle = (opts.stroke as string) ?? 'rgba(255,255,255,0.5)';
    ctx.lineWidth = (opts.lineWidth as number) ?? 1.2;
    for (let ring = 1; ring <= rings; ring++) {
      const path = offsetPolygonPath(hullPx, shieldGap(hullRadiusWorld, ring) * pxPerUnit);
      if (!path) continue;
      ctx.beginPath();
      ctx.moveTo(path.start.x, path.start.y);
      for (const cmd of path.cmds) {
        if (cmd.kind === 'line') ctx.lineTo(cmd.to.x, cmd.to.y);
        else ctx.arc(cmd.center.x, cmd.center.y, cmd.radius, cmd.from, cmd.to, cmd.anticlockwise);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Project world-space points and draw them as small dots (explosion particles). [ROC-VIS-6]
  drawWorldParticles(points: Vec3[], opts: DrawOpts = {}): void {
    this.drawParticles(
      points.map((p) => this.toPixel(projectPoint(this.camera, p))),
      opts,
    );
  }

  // Project a world point and draw text there (optionally nudged in pixels for a rising float).
  drawWorldText(world: Vec3, text: string, opts: DrawOpts = {}): void {
    const p = this.toPixel(projectPoint(this.camera, world));
    this.drawText(text, { x: p.x + ((opts.dx as number) ?? 0), y: p.y + ((opts.dy as number) ?? 0) }, opts);
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
