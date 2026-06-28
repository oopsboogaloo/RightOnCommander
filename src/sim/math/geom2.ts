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
