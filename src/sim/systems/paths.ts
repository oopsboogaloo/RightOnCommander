// Enemy path / pattern library. Each pattern is a pure function (t, params, rng) -> {pos,
// tangent} evaluated along a member's lifetime (t in [0,1]). Patterns are deterministic in
// (t, params); per-member variety comes from params chosen at spawn time (the wave manager
// draws those from rng). Orientation tracks the path tangent. [tasks T4.1, design §10, ROC-ENM-2,3,9]
//
// Play plane: x = right, z = up-screen (enemies enter near z = +1.8 and descend toward -z);
// height y stays 0.

import { type Vec3, vec3 } from '../math/vec3.js';
import type { Rng } from '../rng.js';

export type PathParams = Record<string, number>;

export interface PathPoint {
  pos: Vec3;
  tangent: Vec3; // unit heading; falls back to (0,0,-1) when momentarily still
}

export type PatternFn = (t: number, params: PathParams, rng: Rng) => PathPoint;

const P = (params: PathParams, key: string, def: number): number => params[key] ?? def;

// Unit heading from a planar delta; faces down-screen when essentially stationary.
const heading = (dx: number, dz: number): Vec3 => {
  const m = Math.hypot(dx, dz);
  return m > 1e-6 ? vec3(dx / m, 0, dz / m) : vec3(0, 0, -1);
};

// Wrap a position function so tangent is the (central-difference) direction of travel — so
// orientation always tracks the path by construction. [ROC-ENM-3]
const TANGENT_H = 1e-3;
const withTangent = (posAt: (t: number, p: PathParams) => Vec3): PatternFn => {
  return (t, params) => {
    const a = posAt(t - TANGENT_H, params);
    const b = posAt(t + TANGENT_H, params);
    return { pos: posAt(t, params), tangent: heading(b.x - a.x, b.z - a.z) };
  };
};

const TAU = Math.PI * 2;
const smoothstep = (u: number): number => u * u * (3 - 2 * u);

// --- position functions ----------------------------------------------------

// Straight diagonal descent — one arm of a V formation. [ROC-ENM-9]
const vformPos = (t: number, p: PathParams): Vec3 =>
  vec3(P(p, 'x0', 0) + t * (P(p, 'x1', 0.8) - P(p, 'x0', 0)), 0, P(p, 'z0', 1.8) + t * (P(p, 'z1', -1.8) - P(p, 'z0', 1.8)));

// Loop-the-loop while descending (1942).
const loopPos = (t: number, p: PathParams): Vec3 => {
  const r = P(p, 'radius', 0.4);
  const th = t * TAU * P(p, 'loops', 1);
  const z0 = P(p, 'z0', 1.8);
  return vec3(P(p, 'x0', 0) + r * Math.sin(th), 0, z0 + t * (P(p, 'z1', -1.8) - z0) + r * (Math.cos(th) - 1));
};

// Sinusoidal column descending the screen (Xenon 2 / Raiden).
const sineColumnPos = (t: number, p: PathParams): Vec3 => {
  const z0 = P(p, 'z0', 1.8);
  return vec3(
    P(p, 'x0', 0) + P(p, 'amplitude', 0.6) * Math.sin(t * P(p, 'cycles', 2) * TAU),
    0,
    z0 + t * (P(p, 'z1', -1.8) - z0),
  );
};

// Stream across from one side with a gentle downward bow (Flying Shark).
const sideStreamPos = (t: number, p: PathParams): Vec3 => {
  const x0 = P(p, 'x0', -1.4);
  const z0 = P(p, 'z0', 1.0);
  return vec3(x0 + t * (P(p, 'x1', 1.4) - x0), 0, z0 + t * (P(p, 'z1', 0.4) - z0) + P(p, 'arc', 0.3) * Math.sin(t * Math.PI));
};

// Quarter-arc converging from a side toward the centre.
const pincerPos = (t: number, p: PathParams): Vec3 => {
  const z0 = P(p, 'z0', 1.6);
  return vec3(P(p, 'x0', 1.2) * Math.cos((t * Math.PI) / 2), 0, z0 + t * (P(p, 'z1', -0.2) - z0));
};

// Fly a straight line in from off-screen to the start of a circular loop, fly the loop, then fly
// a straight line off-screen from wherever the loop ends — so a centre-screen circle still reads
// as arriving and departing rather than materialising/vanishing mid-loop. [ROC-ENM-9]
const orbitPos = (t: number, p: PathParams): Vec3 => {
  const cx = P(p, 'cx', 0);
  const cz = P(p, 'cz', 0.6);
  const r = P(p, 'r', 0.5);
  const startAngle = P(p, 'phase', 0);
  const endAngle = startAngle + P(p, 'turns', 1) * TAU;
  const z0 = P(p, 'z0', 1.8); // entry: straight down from off-screen to the loop's start point
  const z1 = P(p, 'z1', -1.8); // exit: straight down from the loop's end point to off-screen
  const entryFrac = Math.max(0, P(p, 'entryFrac', 0.2));
  const exitFrac = Math.max(0, P(p, 'exitFrac', 0.2));
  const loopFrac = Math.max(0.01, 1 - entryFrac - exitFrac);

  const startX = cx + r * Math.cos(startAngle);
  const startZ = cz + r * Math.sin(startAngle);
  if (t < entryFrac) {
    const u = entryFrac > 0 ? t / entryFrac : 1;
    return vec3(startX, 0, z0 + u * (startZ - z0));
  }

  if (t < entryFrac + loopFrac) {
    const u = (t - entryFrac) / loopFrac;
    const th = startAngle + u * (endAngle - startAngle);
    return vec3(cx + r * Math.cos(th), 0, cz + r * Math.sin(th));
  }

  const endX = cx + r * Math.cos(endAngle);
  const endZ = cz + r * Math.sin(endAngle);
  const u = exitFrac > 0 ? (t - entryFrac - loopFrac) / exitFrac : 1;
  return vec3(endX, 0, endZ + u * (z1 - endZ));
};

// Drop in from the top to a hold position, then hover.
const dropHoldPos = (t: number, p: PathParams): Vec3 => {
  const z0 = P(p, 'z0', 1.8);
  const zHold = P(p, 'zHold', 0.8);
  const h = Math.min(Math.max(P(p, 'dropFraction', 0.5), 0.01), 1);
  const z = t <= h ? z0 + smoothstep(t / h) * (zHold - z0) : zHold;
  return vec3(P(p, 'x0', 0), 0, z);
};

export const PATTERNS: Record<string, PatternFn> = {
  vform: withTangent(vformPos),
  loop: withTangent(loopPos),
  sine_column: withTangent(sineColumnPos),
  side_stream: withTangent(sideStreamPos),
  pincer: withTangent(pincerPos),
  orbit: withTangent(orbitPos),
  drop_hold: withTangent(dropHoldPos),
};

export const getPattern = (name: string): PatternFn | undefined => PATTERNS[name];

// Heading angle (yaw about the height axis) for a tangent: +z -> 0, +x -> +pi/2. [ROC-ENM-3]
export const yawFromTangent = (tangent: Vec3): number => Math.atan2(tangent.x, tangent.z);
