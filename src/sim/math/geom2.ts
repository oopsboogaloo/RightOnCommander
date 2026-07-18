// 2D collision primitives in the play plane (x = right, y maps to world z = up-screen). Pure
// and dependency-free, so they are unit-testable on known shapes. [design §8, ROC-DMG-1,5]

export interface Pt {
  x: number;
  y: number;
}

const distSq = (a: Pt, b: Pt): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// Squared distance from point p to segment a-b.
export function distPointToSegmentSq(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return distSq(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return (p.x - (a.x + t * dx)) ** 2 + (p.y - (a.y + t * dy)) ** 2;
}

// --- ellipse (shielded target) ---------------------------------------------

export function pointInEllipse(p: Pt, c: Pt, rx: number, ry: number): boolean {
  return ((p.x - c.x) / rx) ** 2 + ((p.y - c.y) / ry) ** 2 <= 1;
}

// Map the ellipse to a unit circle and test the segment's distance to the origin. [ROC-DMG-1]
export function segmentIntersectsEllipse(a: Pt, b: Pt, c: Pt, rx: number, ry: number): boolean {
  const a2: Pt = { x: (a.x - c.x) / rx, y: (a.y - c.y) / ry };
  const b2: Pt = { x: (b.x - c.x) / rx, y: (b.y - c.y) / ry };
  return distPointToSegmentSq({ x: 0, y: 0 }, a2, b2) <= 1;
}

// --- convex polygon (hull silhouette) --------------------------------------

const orient = (a: Pt, b: Pt, c: Pt): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const onSegment = (a: Pt, b: Pt, p: Pt): boolean =>
  Math.min(a.x, b.x) <= p.x &&
  p.x <= Math.max(a.x, b.x) &&
  Math.min(a.y, b.y) <= p.y &&
  p.y <= Math.max(a.y, b.y);

export function segmentsIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;
  return false;
}

// True if p is inside (or on the boundary of) a convex polygon, regardless of winding.
export function pointInConvexPolygon(p: Pt, poly: Pt[]): boolean {
  const tol = 1e-9;
  let pos = false;
  let neg = false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross > tol) pos = true;
    else if (cross < -tol) neg = true;
    if (pos && neg) return false;
  }
  return true;
}

export function segmentIntersectsConvexPolygon(a: Pt, b: Pt, poly: Pt[]): boolean {
  if (pointInConvexPolygon(a, poly) || pointInConvexPolygon(b, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    if (segmentsIntersect(a, b, poly[i], poly[(i + 1) % poly.length])) return true;
  }
  return false;
}

// Squared distance between two segments. For segments that intersect this is 0; otherwise the
// closest points always include an endpoint of one segment, so the four endpoint-to-segment
// distances suffice. [ROC-DMG-1 shield-hug rework]
export function segSegDistanceSq(a1: Pt, a2: Pt, b1: Pt, b2: Pt): number {
  if (segmentsIntersect(a1, a2, b1, b2)) return 0;
  return Math.min(
    distPointToSegmentSq(a1, b1, b2),
    distPointToSegmentSq(a2, b1, b2),
    distPointToSegmentSq(b1, a1, a2),
    distPointToSegmentSq(b2, a1, a2),
  );
}

// Squared distance from a segment to a convex polygon's boundary/interior (0 if the segment
// enters it). Used for shielded hits: the ring sits `gap` outside the hull, so a shot lands once
// it's within `gap` of the silhouette, not just once it crosses it.
export function segmentDistToConvexPolygonSq(a: Pt, b: Pt, poly: Pt[]): number {
  if (poly.length === 0) return Infinity;
  if (pointInConvexPolygon(a, poly) || pointInConvexPolygon(b, poly)) return 0;
  let min = Infinity;
  for (let i = 0; i < poly.length; i++) {
    min = Math.min(min, segSegDistanceSq(a, b, poly[i], poly[(i + 1) % poly.length]));
  }
  return min;
}

// Squared distance between two convex polygons (0 if they overlap, including one fully inside
// the other). Used for ramming: two silhouettes collide once they're within the sum of their
// shield gaps (0 + 0 for two unshielded hulls, i.e. the hulls touching).
export function convexPolygonsDistanceSq(a: Pt[], b: Pt[]): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  for (const p of a) if (pointInConvexPolygon(p, b)) return 0;
  for (const p of b) if (pointInConvexPolygon(p, a)) return 0;
  let min = Infinity;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      min = Math.min(min, segSegDistanceSq(a1, a2, b[j], b[(j + 1) % b.length]));
    }
  }
  return min;
}

// Nearest distance along a ray (from `origin`, unit-ish direction `dir`) to where it enters a
// convex polygon dilated outward by `gap` (0 for the bare hull) — the same shape the shielded
// hit test in collision.ts treats as solid, but for a ray instead of a short swept segment.
// Cyrus-Beck clipping: each edge's outward half-plane bounds the ray's parameter t; the ray hits
// the (possibly gap-expanded) polygon over [tEnter, tExit], entering at 0 if already inside. Null
// if the ray misses entirely or the entry is beyond maxDist. [ROC-LAS-6]
export function rayEntryDistanceToConvexPolygon(
  origin: Pt,
  dir: Pt,
  poly: Pt[],
  maxDist: number,
  gap = 0,
): number | null {
  if (poly.length < 3) return null;

  let cx = 0;
  let cy = 0;
  for (const p of poly) {
    cx += p.x;
    cy += p.y;
  }
  cx /= poly.length;
  cy /= poly.length;

  let tEnter = 0;
  let tExit = maxDist;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const elen = Math.hypot(ex, ey) || 1;
    let nx = ey / elen;
    let ny = -ex / elen;
    if (nx * (cx - a.x) + ny * (cy - a.y) > 0) {
      nx = -nx;
      ny = -ny;
    }
    const numerator = nx * (a.x - origin.x) + ny * (a.y - origin.y) + gap;
    const denominator = nx * dir.x + ny * dir.y;
    if (Math.abs(denominator) < 1e-12) {
      if (numerator < 0) return null; // parallel to this edge and outside its half-plane
      continue;
    }
    const t = numerator / denominator;
    if (denominator < 0) {
      if (t > tEnter) tEnter = t;
    } else if (t < tExit) {
      tExit = t;
    }
  }
  if (tEnter > tExit || tEnter > maxDist) return null;
  return tEnter;
}

// Nearest distance along a ray to where it enters an ellipse (mapped to a unit circle). Mirrors
// segmentIntersectsEllipse's transform, but solves for the entry point of an unbounded ray
// instead of a yes/no test against a fixed segment. [ROC-LAS-6]
export function rayEntryDistanceToEllipse(
  origin: Pt,
  dir: Pt,
  c: Pt,
  rx: number,
  ry: number,
  maxDist: number,
): number | null {
  const ox = (origin.x - c.x) / rx;
  const oy = (origin.y - c.y) / ry;
  const dx = dir.x / rx;
  const dy = dir.y / ry;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return null;
  const b = 2 * (ox * dx + oy * dy);
  const cc = ox * ox + oy * oy - 1;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < 0) t = (-b + sq) / (2 * a);
  if (t < 0 || t > maxDist) return null;
  return t;
}

// Convex hull (Andrew's monotone chain), returned counter-clockwise. Used to precompute a
// hull's 2D silhouette. [design §8]
export function convexHull(points: Pt[]): Pt[] {
  const pts = points.slice().sort((p, q) => (p.x === q.x ? p.y - q.y : p.x - q.x));
  if (pts.length <= 2) return pts;

  const build = (src: Pt[]): Pt[] => {
    const h: Pt[] = [];
    for (const p of src) {
      while (h.length >= 2 && orient(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };

  const lower = build(pts);
  const upper = build(pts.slice().reverse());
  return lower.concat(upper);
}
