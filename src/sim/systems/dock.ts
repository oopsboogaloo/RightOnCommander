// Docking-port geometry, shared by the hermit asteroid (direct port hits deal triple damage)
// and the end-of-level docking station (fly into the port while it is within 30° of horizontal).
// A port is a rectangle centred on its owner — the centre of the slow y-rotation, so it always
// faces the play surface — whose long axis rotates with the owner's yaw.
// [requirements §3.24/§3.26, ROC-HERM-1,3,8, ROC-DCKG-1,3]

import type { Entity } from '../components.js';
import { segmentIntersectsConvexPolygon } from '../math/geom2.js';

// Port half-extents in world units — fixed, NOT scaled by the owner, so the hermit carries "a
// rectangle the same as the space station's rectangle" exactly. [ROC-HERM-1]
export const PORT_HALF_LONG = 0.2; // along the port's long axis (local x)
export const PORT_HALF_SHORT = 0.08;

export const PORT_ALIGN_TOLERANCE = Math.PI / 6; // 30° [ROC-DCKG-3]

// Triple damage for a direct docking-port hit. [ROC-HERM-8]
export const PORT_DAMAGE_MULT = 3;

export interface PortDims {
  halfLong: number;
  halfShort: number;
}

export const portDims = (_owner: Entity): PortDims => ({
  halfLong: PORT_HALF_LONG,
  halfShort: PORT_HALF_SHORT,
});

// Rotate a world point into the owner's local play-plane frame (inverse of transformSilhouette's
// local->world rotation).
export function toLocal(owner: Entity, x: number, z: number): { x: number; z: number } {
  const c = Math.cos(owner.yaw);
  const s = Math.sin(owner.yaw);
  const dx = x - owner.pos.x;
  const dz = z - owner.pos.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

// Is a world point inside the owner's docking-port rectangle? [ROC-HERM-8, ROC-DCKG-3]
export function pointInPort(owner: Entity, x: number, z: number): boolean {
  if (!owner.port) return false;
  const p = toLocal(owner, x, z);
  const d = portDims(owner);
  return Math.abs(p.x) <= d.halfLong && Math.abs(p.z) <= d.halfShort;
}

// Is the port's long axis within the docking tolerance of horizontal? The long axis is local x
// rotated by yaw, so alignment repeats every half-turn. [ROC-DCKG-3]
export function portAligned(owner: Entity, tolerance = PORT_ALIGN_TOLERANCE): boolean {
  const a = ((owner.yaw % Math.PI) + Math.PI) % Math.PI; // yaw folded into [0, π)
  return Math.min(a, Math.PI - a) <= tolerance;
}

// How far past its impact point a shot's path is traced when judging a port hit — far enough
// to cross the largest hull from rim to centre.
const PORT_TRACE = 1.0;

// Damage multiplier for a projectile impact: triple when the shot was aimed into the port.
// Collision stops a projectile at the hull's rim, but the port sits on the face at the centre
// of rotation — so a "direct hit on the port" is judged by the shot's path: the impact point
// carried forward along its velocity must cross the port rectangle. [ROC-HERM-8]
export function portDamageMultiplier(target: Entity, x: number, z: number, vx = 0, vz = 0): number {
  if (!target.port) return 1;
  if (pointInPort(target, x, z)) return PORT_DAMAGE_MULT; // stopped inside the rect itself
  const m = Math.hypot(vx, vz);
  if (m < 1e-6) return 1;
  const b = { x: x + (vx / m) * PORT_TRACE, y: z + (vz / m) * PORT_TRACE };
  const rect = portCorners(target).map((c) => ({ x: c.x, y: c.z }));
  return segmentIntersectsConvexPolygon({ x, y: z }, b, rect) ? PORT_DAMAGE_MULT : 1;
}

// The port rectangle's four corners in world space, for rendering. Order: a closed loop.
export function portCorners(owner: Entity): { x: number; z: number }[] {
  const d = portDims(owner);
  const c = Math.cos(owner.yaw);
  const s = Math.sin(owner.yaw);
  const local: [number, number][] = [
    [-d.halfLong, -d.halfShort],
    [d.halfLong, -d.halfShort],
    [d.halfLong, d.halfShort],
    [-d.halfLong, d.halfShort],
  ];
  return local.map(([lx, lz]) => ({
    x: owner.pos.x + lx * c + lz * s,
    z: owner.pos.z - lx * s + lz * c,
  }));
}
