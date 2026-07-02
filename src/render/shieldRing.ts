// Rounded outward offset (Minkowski sum with a disk) of a convex polygon — the shape a shield
// ring traces around a projected hull outline, hugging it with a uniform gap and rounded
// corners. Pure 2D geometry, operating in whatever space (world, projected, pixel) the caller's
// points and gap are already in; winding-agnostic, so it works regardless of axis conventions.
// [ROC-DMG-1,3 shield-hug rework]

import type { Pt } from '../sim/math/geom2.js';

export type RingCmd =
  | { kind: 'line'; to: Pt }
  | { kind: 'arc'; center: Pt; radius: number; from: number; to: number; anticlockwise: boolean };

export interface RingPath {
  start: Pt;
  cmds: RingCmd[]; // ends back at `start`; caller may still close the path explicitly
}

const signedArea = (poly: Pt[]): number => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s;
};

// The shorter rotation from angle a1 to a2, as ctx.arc(from, to, anticlockwise) params.
function shortArc(a1: number, a2: number): { from: number; to: number; anticlockwise: boolean } {
  const twoPi = Math.PI * 2;
  const diff = (((a2 - a1 + Math.PI) % twoPi) + twoPi) % twoPi - Math.PI;
  return { from: a1, to: a1 + diff, anticlockwise: diff < 0 };
}

// Offsets every edge of a convex polygon outward by `gap` and joins the corners with rounded
// arcs of radius `gap` — the exact boundary of polygon ⊕ disk(gap). Null for a degenerate
// polygon or a non-positive gap (nothing to draw).
export function offsetPolygonPath(poly: Pt[], gap: number): RingPath | null {
  const n = poly.length;
  if (n < 3 || gap <= 0) return null;

  // Outward = away from the interior; which rotation of the edge vector that is depends on the
  // polygon's winding, which we don't assume — read it off the signed area instead.
  const sign = signedArea(poly) >= 0 ? 1 : -1;
  const outwardNormal = (a: Pt, b: Pt): Pt => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return sign > 0 ? { x: dy / len, y: -dx / len } : { x: -dy / len, y: dx / len };
  };

  const normals = poly.map((p, i) => outwardNormal(p, poly[(i + 1) % n]));
  const offsetAt = (vertexIdx: number, edgeIdx: number): Pt => ({
    x: poly[vertexIdx].x + normals[edgeIdx].x * gap,
    y: poly[vertexIdx].y + normals[edgeIdx].y * gap,
  });

  const cmds: RingCmd[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    cmds.push({ kind: 'line', to: offsetAt(j, i) }); // offset edge i, ending at vertex j
    const a1 = Math.atan2(normals[i].y, normals[i].x);
    const a2 = Math.atan2(normals[j].y, normals[j].x);
    cmds.push({ kind: 'arc', center: poly[j], radius: gap, ...shortArc(a1, a2) }); // round the corner at j
  }
  return { start: offsetAt(0, 0), cmds };
}
