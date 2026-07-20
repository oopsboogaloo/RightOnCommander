// The fixed 4:3 game box: always centered, always exactly 4:3, always fits within its canvas —
// and the portrait-rotation input mapping round-trips back to the same box-local point.
// [viewport-spec.md]

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { GAME_ASPECT, computeViewportBox, computeViewport, physicalToLogical } from '../../src/render/viewport.js';

const dim = fc.double({ min: 1, max: 4000, noNaN: true });

describe('computeViewportBox', () => {
  it('is always centered, exactly 4:3, and fits within the canvas', () => {
    fc.assert(
      fc.property(dim, dim, (canvasW, canvasH) => {
        const box = computeViewportBox(canvasW, canvasH);
        expect(box.w / box.h).toBeCloseTo(GAME_ASPECT, 9);
        expect(box.x).toBeCloseTo((canvasW - box.w) / 2, 9);
        expect(box.y).toBeCloseTo((canvasH - box.h) / 2, 9);
        expect(box.x).toBeGreaterThanOrEqual(-1e-9);
        expect(box.y).toBeGreaterThanOrEqual(-1e-9);
        expect(box.x + box.w).toBeLessThanOrEqual(canvasW + 1e-9);
        expect(box.y + box.h).toBeLessThanOrEqual(canvasH + 1e-9);
      }),
    );
  });

  it('uses the full width when the canvas is exactly 4:3', () => {
    const box = computeViewportBox(800, 600);
    expect(box).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });

  it('pillarboxes left/right on a canvas wider than 4:3', () => {
    const box = computeViewportBox(1000, 500);
    expect(box.h).toBe(500); // full height used
    expect(box.w).toBeCloseTo(666.67, 1);
    expect(box.x).toBeGreaterThan(0); // bars left/right
    expect(box.y).toBeCloseTo(0, 9);
  });

  it('letterboxes top/bottom on a canvas narrower than 4:3 (non-rotated case)', () => {
    const box = computeViewportBox(400, 1000);
    expect(box.w).toBe(400); // full width used
    expect(box.h).toBeCloseTo(300, 9);
    expect(box.y).toBeGreaterThan(0); // bars top/bottom
    expect(box.x).toBeCloseTo(0, 9);
  });
});

describe('computeViewport', () => {
  it('never rotates when the canvas is landscape, regardless of touch capability', () => {
    fc.assert(
      fc.property(dim, dim, fc.boolean(), (a, b, touch) => {
        const canvasW = Math.max(a, b);
        const canvasH = Math.min(a, b);
        const v = computeViewport(canvasW, canvasH, touch);
        expect(v.rotated).toBe(false);
        expect(v.logicalW).toBe(canvasW);
        expect(v.logicalH).toBe(canvasH);
      }),
    );
  });

  it('rotates only when portrait AND touch-capable', () => {
    const portraitTouch = computeViewport(400, 800, true);
    expect(portraitTouch.rotated).toBe(true);
    expect(portraitTouch.logicalW).toBe(800);
    expect(portraitTouch.logicalH).toBe(400);

    const portraitDesktop = computeViewport(400, 800, false);
    expect(portraitDesktop.rotated).toBe(false);
    expect(portraitDesktop.logicalW).toBe(400);
    expect(portraitDesktop.logicalH).toBe(800);
  });
});

describe('physicalToLogical', () => {
  it('is the identity when not rotated', () => {
    const v = computeViewport(800, 600, true);
    expect(physicalToLogical(v, 123, 45)).toEqual({ x: 123, y: 45 });
  });

  it('maps the physical corners onto the logical corners when rotated', () => {
    const v = computeViewport(400, 800, true); // canvasW=400, canvasH=800, logical 800x400
    expect(physicalToLogical(v, 400, 0)).toEqual({ x: 0, y: 0 }); // physical top-right -> logical top-left
    expect(physicalToLogical(v, 400, 800)).toEqual({ x: 800, y: 0 }); // physical bottom-right -> logical top-right
    expect(physicalToLogical(v, 0, 0)).toEqual({ x: 0, y: 400 }); // physical top-left -> logical bottom-left
    expect(physicalToLogical(v, 0, 800)).toEqual({ x: 800, y: 400 }); // physical bottom-left -> logical bottom-right
  });

  it('round-trips: physicalToLogical is consistent with the render pipeline\'s rotation', () => {
    // Renderer2D.beginFrame rotates via translate(canvasW,0) + rotate(90°); a logical point
    // (lx,ly) lands at physical (canvasW - ly, lx) [derived in viewport-spec.md]. Confirm
    // physicalToLogical is exactly its inverse for arbitrary points.
    fc.assert(
      fc.property(dim, dim, dim, dim, (canvasW, canvasH, lx, ly) => {
        fc.pre(canvasW < canvasH);
        const v = computeViewport(canvasW, canvasH, true);
        const px = canvasW - ly;
        const py = lx;
        const logical = physicalToLogical(v, px, py);
        expect(logical.x).toBeCloseTo(lx, 9);
        expect(logical.y).toBeCloseTo(ly, 9);
      }),
    );
  });
});
