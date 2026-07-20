// The fixed 4:3 landscape "game box" that render, HUD/button layout and input all agree on, so
// play reads identically regardless of window/device aspect ratio. On a portrait touch device the
// box is computed against swapped dimensions and the render pipeline draws through a 90°
// rotation (Renderer2D.beginFrame) so the box fills the screen instead of shrinking into a small
// letterboxed rectangle. [viewport-spec.md]

export const GAME_ASPECT = 4 / 3;

export interface ViewportBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// The largest 4:3 rect that fits within canvasW x canvasH, centered.
export function computeViewportBox(canvasW: number, canvasH: number): ViewportBox {
  let w = canvasW;
  let h = canvasW / GAME_ASPECT;
  if (h > canvasH) {
    h = canvasH;
    w = canvasH * GAME_ASPECT;
  }
  return { x: (canvasW - w) / 2, y: (canvasH - h) / 2, w, h };
}

export interface Viewport {
  canvasW: number; // physical/CSS canvas size
  canvasH: number;
  rotated: boolean; // portrait + touch: rendered through a 90° rotation to fill the screen
  logicalW: number; // canvasW/canvasH, swapped when rotated
  logicalH: number;
  box: ViewportBox; // the 4:3 game box, in logical (pre-rotation) coordinates
}

export function isTouchCapable(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  return 'ontouchstart' in window || (nav?.maxTouchPoints ?? 0) > 0;
}

export function computeViewport(canvasW: number, canvasH: number, touchCapable: boolean): Viewport {
  const rotated = canvasW < canvasH && touchCapable;
  const logicalW = rotated ? canvasH : canvasW;
  const logicalH = rotated ? canvasW : canvasH;
  return { canvasW, canvasH, rotated, logicalW, logicalH, box: computeViewportBox(logicalW, logicalH) };
}

// Physical (event) pixel -> logical (pre-rotation) pixel; the inverse of the render pipeline's
// rotation (translate(canvasW,0) then rotate(90°) in Renderer2D.beginFrame). Identity when not
// rotated.
export function physicalToLogical(v: Viewport, px: number, py: number): { x: number; y: number } {
  if (!v.rotated) return { x: px, y: py };
  return { x: py, y: v.canvasW - px };
}

// Some devices never actually report a pointer coordinate at the literal edge of the box —
// notably a pen/finger on iPad Safari, where the OS reserves a strip near the physical screen
// edge for its own edge-swipe gestures (Control Center, app switching, back/forward), regardless
// of the page's own touch-action. Left unaddressed, the ship visibly stops short of the true
// field edge no matter how far the drag goes. Saturating the outer `margin` fraction of the box
// on each side to the full [0,1] range compensates: getting *close* to an edge is enough to reach
// it, while the interior 1-2*margin of the box still maps smoothly and proportionally. Applied
// uniformly across input sources (not just touch) so the box's input contract stays one thing —
// mouse/desktop users can already reach the literal edge, so this is imperceptible for them.
export function saturateEdges(t: number, margin: number): number {
  if (t <= margin) return 0;
  if (t >= 1 - margin) return 1;
  return (t - margin) / (1 - 2 * margin);
}
