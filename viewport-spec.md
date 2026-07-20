# Viewport & Aspect-Ratio Lock — Spec (draft)

**Status:** agreed in discussion, not yet implemented. Not wired into `requirements.md` / `design.md`
/ `tasks.md` — see "Doc updates needed" below before/when this lands.

## Problem

The canvas currently fills the whole window (`100vw` / `100dvh` in `index.html`, resized in
`src/platform/main.ts`'s `resize()`), so its aspect ratio is whatever the browser window happens
to be. Two things fall out of that:

- **Render scale drifts with window shape.** `Renderer2D.refreshViewport()`
  (`src/render/renderer2d.ts:172`) sets `scale = min(w,h) * 0.5`, so the world-to-pixel scale
  shrinks or grows with window aspect. Meanwhile HUD text, station buttons, and cheat hit-zones in
  `main.ts` are positioned off the *raw* `canvas.clientWidth/clientHeight` — a different box than
  the one the 3D scene is scaled against. On a wide desktop window these visibly disagree.
- **Input mapping doesn't match render scale.** `DomInput.toField()`
  (`src/input/domInput.ts:44`) normalizes `clientX/clientY` across the *full* canvas rect and maps
  linearly into fixed field bounds (`±1` x, `±1.6` y). Since the renderer's visual scale only uses
  `min(w,h)`, a full-width mouse sweep on a wide screen doesn't correspond 1:1 to what's visually
  reachable on screen. This is the main reason the game plays differently at different aspect
  ratios.

Also: `requirements.md` (ROC-HUD-1, ROC-NFR-4) and `design.md` §17 currently document this as a
**portrait** game with "portrait-fit canvas sizing." Locking to landscape 4:3 reverses that — a
real spec change, not a bugfix.

## Goal

A single, fixed **4:3 landscape "game box"** that render, HUD/button layout, and input all agree
on, so play feels identical regardless of device/window shape.

## Design

### 1. Pure box calculator — new `src/render/viewport.ts`

```ts
export const GAME_ASPECT = 4 / 3;
export interface ViewportBox { x: number; y: number; w: number; h: number }

export function computeViewportBox(canvasW: number, canvasH: number): ViewportBox {
  let w = canvasW, h = canvasW / GAME_ASPECT;
  if (h > canvasH) { h = canvasH; w = canvasH * GAME_ASPECT; }
  return { x: (canvasW - w) / 2, y: (canvasH - h) / 2, w, h };
}
```

Pure and stateless — fits the project's fast-check property-testing style. Invariants to test:
box always centered, `w / h === 4/3` exactly, box always fits within `[0,canvasW] x [0,canvasH]`.

### 2. Landscape case (`canvasW >= canvasH`)

- `Renderer2D.refreshViewport()` computes the box from `canvas.clientWidth/clientHeight` and
  derives `cx/cy/scale` from the box instead of the raw canvas, so visible world extent is
  identical on every device.
- `beginFrame` / `endFrame` clip drawing to the box and stroke a **1px (dpr-aware) white border**
  around it.
- A new `getViewportBox()` getter lets `main.ts` align the HUD bar, station buttons, corner
  cheat-zones, and skip/pause/rewind/clock buttons to the same rectangle (`box.w/box.h`, offset by
  `box.x/box.y`) instead of raw `canvas.clientWidth/clientHeight`.
- `DomInput.toField` (and `main.ts`'s own tap handler for station/cheat hits) maps client
  coordinates into box-local `u,v`, **clamped to `[0,1]` before scaling** — so a drag onto the
  letterbox bars, or a click past the edge, reads as the nearest field edge rather than being
  ignored or extrapolated.

### 3. Portrait on a touch device (`canvasW < canvasH`, touch-capable)

Rather than shrinking the 4:3 box into a small letterboxed rectangle, fill the screen by
rendering rotated 90°:

- DOM/CSS is untouched — canvas stays a plain full-viewport `<canvas>`, exactly as today. No CSS
  `transform: rotate(...)` on the element (that makes `getBoundingClientRect()`-based touch math
  fiddly and has real cross-browser quirks around `visualViewport`, safe-area insets, etc.).
- Instead, the box is computed against the **swapped** dimensions
  (`computeViewportBox(canvasH, canvasW)` — treating the phone's height as available width), and
  the render pipeline draws through a `ctx.rotate(90°)` (plus matching translate) before drawing
  the scene, so the box fills the portrait screen edge-to-edge instead of being squeezed.
- `DomInput` applies the matching inverse rotation to incoming touch/mouse coordinates before
  computing box-local `u,v` — pure math we own and can unit-test, not implicit DOM/CSS behavior.
- A persistent on-screen hint (text + rotate icon, e.g. "Turn your phone sideways ↻") is shown the
  entire time the device is held portrait, and disappears the instant it's turned landscape. No
  dismiss state to persist.
- Does **not** use the Fullscreen API (`Element.requestFullscreen()`) — unsupported on iOS Safari
  for ordinary pages, so relying on it would silently break for a large chunk of the mobile
  audience. "Full screen" here just means using all available viewport pixels via the rotation,
  which the existing `100vw`/`100dvh` canvas sizing already provides.
- Touch-capability gate: `'ontouchstart' in window || navigator.maxTouchPoints > 0`.

### 4. Portrait on desktop (no touch)

Falls back to the plain shrink-to-fit box from §2 (just a smaller centered 4:3 box) — no rotation,
no "turn your phone" text, since there's no phone to turn.

## Decisions made

| Question | Decision |
|---|---|
| How to handle a narrow/portrait window in general | Shrink-to-fit box (superseded for touch devices by §3 below) |
| Rotate-to-fill-and-instruct scope | **Touch devices only** — desktop narrow windows get shrink-to-fit, not the rotate treatment |
| "Turn your phone" hint lifecycle | **Persistent** while portrait, not a one-time dismissable banner |

## Doc updates needed once implemented

- `requirements.md` ROC-HUD-1 ("shall run in portrait aspect ratio") and ROC-NFR-4 ("fit a
  portrait field responsively") need rewriting for the fixed 4:3 landscape box + portrait-rotate
  behavior.
- `design.md` §17 ("portrait-fit canvas sizing") needs the same update, plus a new subsection
  (probably new ROC-VP-* tags) documenting the viewport box, its render/input contract, and the
  portrait-rotation behavior.
- `tasks.md` should get a new task entry for this work under whichever phase is current.

## Not yet decided / out of scope here

- Exact pixel size/weight of the white border and the rotate-hint's text/icon styling.
- Whether the border and box should also gate/clip the starfield background, or only foreground
  gameplay (current lean: clip everything to the box, since a starfield outside the box would
  look inconsistent with a hard-edged border).
