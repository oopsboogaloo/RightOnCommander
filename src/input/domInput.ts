// DOM input backend: wires mouse / touch / keyboard / gamepad into an InputFrame each sample,
// via the pure remap + compose modules. Touch drag moves, tap fires, and ECM/Energy-Bomb have
// explicit trigger hooks for the transparent on-screen buttons. [ROC-CTL-1..6]

import type { InputFrame, Vec2, Storage } from '../interfaces.js';
import { type RemapTable, type Action, defaultRemap, loadRemap, keyAction, buttonAction } from './remap.js';
import { composeInputFrame, type FieldBounds, type RawInput } from './compose.js';
import { computeViewport, isTouchCapable, physicalToLogical } from '../render/viewport.js';

const EDGE_ACTIONS: ReadonlySet<Action> = new Set(['fire', 'ecm', 'bomb', 'confirm', 'pause']);

// The flight-control field's default extent — the compose step clamps the pointer/virtual-cursor
// target to this. minX/maxX = ±4/3 matches the 4:3 box's visible horizontal range (see
// FIELD_HALF_WIDTH in movement.ts, kept in sync) so a drag can carry the ship edge-to-edge across
// the landscape width; minY/maxY (world z) stay ±1.6. [ROC-HUD-1 landscape]
export const DEFAULT_FIELD_BOUNDS: FieldBounds = { minX: -4 / 3, maxX: 4 / 3, minY: -1.6, maxY: 1.6 };

export interface DomInputOptions {
  canvas: HTMLCanvasElement;
  storage?: Storage;
  bounds?: FieldBounds;
  speed?: number;
}

export class DomInput {
  private readonly canvas: HTMLCanvasElement;
  private readonly remap: RemapTable;
  private readonly bounds: FieldBounds;
  private readonly speed: number;

  private keyHeld = new Set<Action>();
  private padHeld = new Set<Action>();
  private padPrev = new Set<Action>();

  private pointerTarget: Vec2 | null = null;
  private pointerFiring = false;
  private pointerTapped = false;

  private edges = { fire: false, ecm: false, bomb: false, confirm: false, pause: false };
  private virtualTarget: Vec2 = { x: 0, y: 0 };

  constructor(opts: DomInputOptions) {
    this.canvas = opts.canvas;
    this.remap = opts.storage ? loadRemap(opts.storage) : defaultRemap();
    this.bounds = opts.bounds ?? DEFAULT_FIELD_BOUNDS;
    this.speed = opts.speed ?? 2;
    this.attach();
  }

  // Map client pixels to play-field coords by inverting the *exact* world->screen transform the
  // renderer draws with, so a drag lands the ship under the pointer on any window/device aspect.
  // [viewport-spec.md]
  //
  // Renderer2D draws every world point at `screen = box.(x|y) + box.(w|h)/2 + projected * scale`
  // with a single UNIFORM `scale = box.h/2` px per world unit (see refreshViewport/toPixel), and
  // for a point on the play plane the camera's projected.x == world.x exactly (the 25° tilt is a
  // rotation about the x-axis, so it never foreshortens x — see camera.ts). So the horizontal
  // inverse is exactly `(px - boxCenterX) / (box.h/2)`.
  //
  // The earlier version instead stretched the field across box.w horizontally and box.h
  // vertically independently — which disagreed with the renderer's uniform scale by exactly the
  // box's 4:3 aspect, so the ship travelled only ~box.h ("one portrait width") while the pointer
  // ranged across the full box.w, and the pointer ran ahead of the ship near the edges. Using the
  // renderer's own scale for both axes removes that mismatch. (Vertical carries the camera's mild
  // cos(tilt) foreshortening, as it always has; the scroll axis is forgiving and this is the same
  // ~10% looseness the portrait build shipped with. The reported bug was horizontal, which is now
  // exact.)
  //
  // Canvas size is measured via clientWidth/clientHeight — the same properties Renderer2D reads —
  // so both sides feed computeViewport identical inputs and agree by construction.
  // getBoundingClientRect() supplies only left/top, to turn page-relative client coords into
  // canvas-relative pixels.
  private toField(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const canvasW = this.canvas.clientWidth || this.canvas.width;
    const canvasH = this.canvas.clientHeight || this.canvas.height;
    const viewport = computeViewport(canvasW, canvasH, isTouchCapable());
    const logical = physicalToLogical(viewport, clientX - rect.left, clientY - rect.top);
    const { box } = viewport;
    const scale = box.h / 2; // MUST match Renderer2D's `scale` (px per world unit)
    return {
      x: (logical.x - box.x - box.w / 2) / scale,
      y: (box.y + box.h / 2 - logical.y) / scale, // screen-y is down; world/field +y (forward) is up
    };
  }

  private rise(action: Action): void {
    if (action in this.edges) this.edges[action as keyof typeof this.edges] = true;
  }

  private attach(): void {
    window.addEventListener('keydown', (e) => {
      const action = keyAction(this.remap, e.code);
      if (!action) return;
      e.preventDefault();
      if (!this.keyHeld.has(action)) this.rise(action);
      this.keyHeld.add(action);
    });
    window.addEventListener('keyup', (e) => {
      const action = keyAction(this.remap, e.code);
      if (action) this.keyHeld.delete(action);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.pointerTarget = this.toField(e.clientX, e.clientY);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.pointerTarget = this.toField(e.clientX, e.clientY);
      this.pointerFiring = true;
      this.pointerTapped = true;
    });
    window.addEventListener('mouseup', () => {
      this.pointerFiring = false;
    });

    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        this.pointerTarget = this.toField(t.clientX, t.clientY);
        this.pointerTapped = true; // a touch fires one shot [ROC-CTL-2]
        this.pointerFiring = true; // and holding fires continuously, same as a held mouse button
      },
      { passive: false },
    );
    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        this.pointerTarget = this.toField(t.clientX, t.clientY);
        this.pointerFiring = true; // dragging still counts as holding down [ROC-CTL-1,2]
      },
      { passive: false },
    );
    const endTouch = (): void => {
      this.pointerTarget = null;
      this.pointerFiring = false;
    };
    this.canvas.addEventListener('touchend', endTouch);
    this.canvas.addEventListener('touchcancel', endTouch);
  }

  private pollGamepad(): void {
    this.padHeld = new Set<Action>();
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[0];
    if (!pad) {
      this.padPrev = new Set<Action>();
      return;
    }
    pad.buttons.forEach((b, i) => {
      if (!b.pressed) return;
      const action = buttonAction(this.remap, i);
      if (action) this.padHeld.add(action);
    });
    // Left stick -> directional held.
    const [ax, ay] = pad.axes;
    if (ax < -0.5) this.padHeld.add('left');
    else if (ax > 0.5) this.padHeld.add('right');
    if (ay < -0.5) this.padHeld.add('up');
    else if (ay > 0.5) this.padHeld.add('down');

    // Rising edges for momentary actions on the pad.
    for (const action of this.padHeld) {
      if (EDGE_ACTIONS.has(action) && !this.padPrev.has(action)) this.rise(action);
    }
    this.padPrev = new Set(this.padHeld);
  }

  // Touch-button hooks for the transparent ECM / Energy-Bomb buttons. [ROC-CTL-3]
  triggerEcm(): void {
    this.edges.ecm = true;
  }
  triggerBomb(): void {
    this.edges.bomb = true;
  }

  sample(dt: number): InputFrame {
    this.pollGamepad();
    const held = new Set<Action>([...this.keyHeld, ...this.padHeld]);

    const raw: RawInput = {
      pointerTarget: this.pointerTarget,
      pointerFiring: this.pointerFiring,
      pointerTapped: this.pointerTapped,
      held,
      fireEdge: this.edges.fire,
      ecm: this.edges.ecm,
      bomb: this.edges.bomb,
      confirm: this.edges.confirm,
      pause: this.edges.pause,
      virtualTarget: this.virtualTarget,
    };

    const { frame, virtualTarget } = composeInputFrame(raw, { dt, bounds: this.bounds, speed: this.speed });
    this.virtualTarget = virtualTarget;

    // Consume one-shot edges.
    this.pointerTapped = false;
    this.edges = { fire: false, ecm: false, bomb: false, confirm: false, pause: false };

    return frame;
  }
}
