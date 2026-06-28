// T3.1: 2D collision primitives on known shapes. [ROC-DMG-1,5]

import { describe, it, expect } from 'vitest';
import {
  pointInEllipse,
  segmentIntersectsEllipse,
  pointInConvexPolygon,
  segmentIntersectsConvexPolygon,
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
