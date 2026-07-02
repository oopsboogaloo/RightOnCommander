// T3.1: 2D collision primitives on known shapes. [ROC-DMG-1,5]

import { describe, it, expect } from 'vitest';
import {
  pointInEllipse,
  segmentIntersectsEllipse,
  pointInConvexPolygon,
  segmentIntersectsConvexPolygon,
  segSegDistanceSq,
  segmentDistToConvexPolygonSq,
  convexPolygonsDistanceSq,
  convexHull,
  type Pt,
} from '../../src/sim/math/geom2.js';

const C: Pt = { x: 0, y: 0 };
const square: Pt[] = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 2 },
  { x: 0, y: 2 },
];

describe('ellipse tests', () => {
  it('pointInEllipse respects the radii', () => {
    expect(pointInEllipse({ x: 1.9, y: 0 }, C, 2, 1)).toBe(true);
    expect(pointInEllipse({ x: 0, y: 0.9 }, C, 2, 1)).toBe(true);
    expect(pointInEllipse({ x: 2.1, y: 0 }, C, 2, 1)).toBe(false);
    expect(pointInEllipse({ x: 0, y: 1.1 }, C, 2, 1)).toBe(false);
  });

  it('segmentIntersectsEllipse for crossing / missing / inside / tangent', () => {
    expect(segmentIntersectsEllipse({ x: -3, y: 0 }, { x: 3, y: 0 }, C, 2, 1)).toBe(true); // through
    expect(segmentIntersectsEllipse({ x: -3, y: 2 }, { x: 3, y: 2 }, C, 2, 1)).toBe(false); // above
    expect(segmentIntersectsEllipse({ x: 0, y: 0 }, { x: 0, y: 5 }, C, 2, 1)).toBe(true); // endpoint inside
    expect(segmentIntersectsEllipse({ x: -3, y: 1 }, { x: 3, y: 1 }, C, 2, 1)).toBe(true); // tangent at y=1
  });
});

describe('convex polygon tests', () => {
  it('pointInConvexPolygon inside / outside / on edge', () => {
    expect(pointInConvexPolygon({ x: 1, y: 1 }, square)).toBe(true);
    expect(pointInConvexPolygon({ x: 3, y: 1 }, square)).toBe(false);
    expect(pointInConvexPolygon({ x: 0, y: 1 }, square)).toBe(true); // on edge
  });

  it('segmentIntersectsConvexPolygon crossing / inside / missing', () => {
    expect(segmentIntersectsConvexPolygon({ x: -1, y: 1 }, { x: 3, y: 1 }, square)).toBe(true); // crosses
    expect(segmentIntersectsConvexPolygon({ x: 1, y: 1 }, { x: 1, y: 5 }, square)).toBe(true); // from inside
    expect(segmentIntersectsConvexPolygon({ x: -1, y: 3 }, { x: 3, y: 3 }, square)).toBe(false); // misses
  });
});

describe('segSegDistanceSq', () => {
  it('is 0 for intersecting (incl. crossing "X") segments', () => {
    expect(segSegDistanceSq({ x: -1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 })).toBe(0);
  });

  it('measures parallel-segment gap correctly', () => {
    expect(segSegDistanceSq({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 3 }, { x: 2, y: 3 })).toBe(9);
  });

  it('measures endpoint-to-segment distance when the closest approach is a corner', () => {
    // Segment b sits to the right of and above segment a's end; closest points are a's endpoint
    // (2,0) and the foot of the perpendicular on b.
    expect(segSegDistanceSq({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: -1 }, { x: 4, y: 1 })).toBe(4);
  });
});

describe('segmentDistToConvexPolygonSq', () => {
  it('is 0 when the segment enters the polygon', () => {
    expect(segmentDistToConvexPolygonSq({ x: -1, y: 1 }, { x: 3, y: 1 }, square)).toBe(0);
    expect(segmentDistToConvexPolygonSq({ x: 1, y: 1 }, { x: 1, y: 5 }, square)).toBe(0); // starts inside
  });

  it('measures the gap to a clean miss', () => {
    // square spans x:[0,2] y:[0,2]; segment runs along y=4, 2 units above the top edge.
    expect(segmentDistToConvexPolygonSq({ x: -1, y: 4 }, { x: 3, y: 4 }, square)).toBe(4);
  });

  it('shrinks to 0 once within a shield-style gap threshold', () => {
    const gapSq = segmentDistToConvexPolygonSq({ x: -1, y: 2.5 }, { x: 3, y: 2.5 }, square);
    expect(gapSq).toBeCloseTo(0.25, 9); // 0.5 above the top edge
    expect(gapSq <= 0.5 ** 2).toBe(true); // within a 0.5 gap: counts as a hit
    expect(gapSq <= 0.2 ** 2).toBe(false); // outside a tighter 0.2 gap: still a miss
  });
});

describe('convexPolygonsDistanceSq', () => {
  const shifted = (dx: number, dy: number): Pt[] => square.map((p) => ({ x: p.x + dx, y: p.y + dy }));

  it('is 0 when polygons overlap (incl. containment, incl. edge-crossing with no vertex inside)', () => {
    expect(convexPolygonsDistanceSq(square, shifted(1, 1))).toBe(0); // partial overlap
    expect(convexPolygonsDistanceSq(square, [{ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 }, { x: 1, y: 1.5 }])).toBe(0); // contained
    // Two congruent squares rotated 45° about the same centre ("Star of David" cross): no vertex
    // of either lies inside the other, but their edges cross.
    const diamond: Pt[] = [{ x: 1, y: -1 }, { x: 3, y: 1 }, { x: 1, y: 3 }, { x: -1, y: 1 }];
    expect(convexPolygonsDistanceSq(square, diamond)).toBe(0);
  });

  it('measures the gap between clearly separated polygons', () => {
    expect(convexPolygonsDistanceSq(square, shifted(5, 0))).toBe(9); // 3-unit gap: 2..5 on x
  });

  it('shrinks to 0 once within the combined shield-gap threshold, matching a ram trigger', () => {
    const gapSq = convexPolygonsDistanceSq(square, shifted(2.5, 0)); // 0.5-unit gap
    expect(gapSq).toBeCloseTo(0.25, 9);
    expect(gapSq <= (0.3 + 0.3) ** 2).toBe(true); // both sides shielded: rams
    expect(gapSq <= 0 ** 2).toBe(false); // neither shielded: hulls not yet touching
  });
});

describe('convexHull', () => {
  it('drops interior points and keeps the corners', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 1, y: 1 }, // interior
    ]);
    expect(hull.length).toBe(4);
    for (const corner of square) {
      expect(hull.some((h) => h.x === corner.x && h.y === corner.y)).toBe(true);
    }
  });
});
