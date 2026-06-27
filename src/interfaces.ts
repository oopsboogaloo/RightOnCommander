// The seam between the pure sim and the outside world. Real implementations live in
// render/, audio/, input/, platform/; null/recording implementations live in test/.
// [design §4 — the test contract]

import type { Vec3 } from './sim/math/vec3.js';

export interface Vec2 {
  x: number;
  y: number;
}

// Per-step player input, produced by any input source (pointer/touch/keyboard/gamepad).
// The sim consumes these identically regardless of source. [ROC-CTL-*]
export interface InputFrame {
  moveTarget: Vec2 | null; // pointer/stick target in play-field coords
  firing: boolean; // fire held (autofire) [ROC-CTL-1]
  fireTapped: boolean; // single-shot edge
  ecm: boolean; // edge-triggered
  energyBomb: boolean; // edge-triggered
  confirm: boolean; // menus / "are you sure" [ROC-STN-6]
  pause: boolean;
}

// A mesh as emitted by the bbcelite parser (§16) and consumed by the renderer.
export interface Mesh {
  vertices: Vec3[];
  edges: [number, number][];
  faces: { loop: number[]; normal: Vec3 }[];
}

export interface DrawOpts {
  [key: string]: unknown;
}

// Read-only projection of sim state. Never mutates the world. [design §1.5, §7]
export interface Renderer {
  beginFrame(): void;
  drawMesh(mesh: Mesh, xform: unknown, opts?: DrawOpts): void; // 3D hull: cull+sort+black fill+white stroke
  drawLine(a: Vec2, b: Vec2, opts?: DrawOpts): void; // lasers, dock wireframe
  drawEllipse(c: Vec2, rx: number, ry: number, opts?: DrawOpts): void; // shields [ROC-DMG-3]
  drawParticles(points: Vec2[], opts?: DrawOpts): void;
  drawText(text: string, pos: Vec2, opts?: DrawOpts): void; // score/credits/lives, floating text
  endFrame(alpha: number): void; // alpha = interpolation factor between sim steps
}

// Sound output, driven by drained sim events. Disabled = silent no-op. [ROC-SFX-1]
export interface AudioOut {
  play(id: string, opts?: DrawOpts): void;
  setEnabled(on: boolean): void;
}

// Persistence behind a single key. [design §11]
export interface Storage {
  load(key: string): unknown | null;
  save(key: string, value: unknown): void;
}

// Time source for the shell loop only — the sim never reads it. [design §3]
export interface Clock {
  now(): number;
}
