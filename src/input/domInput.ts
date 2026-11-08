// DOM input backend: wires mouse / touch / keyboard / gamepad into an InputFrame each sample,
// via the pure remap + compose modules. Touch drag moves, tap fires, and ECM/Energy-Bomb have
// explicit trigger hooks for the transparent on-screen buttons. [ROC-CTL-1..6]

import type { InputFrame, Vec2, Storage } from '../interfaces.js';
import { type RemapTable, type Action, defaultRemap, loadRemap, keyAction, buttonAction } from './remap.js';
import { composeInputFrame, applyDeadzone, type FieldBounds, type RawInput } from './compose.js';
import { initialMenuNav, stepMenuNav, NO_MENU_EDGES, MENU_STICK, type MenuEdges, type MenuNavState, type PadSnapshot } from './menuNav.js';
import { computeViewport, isTouchCapable, physicalToLogical } from '../render/viewport.js';

const EDGE_ACTIONS: ReadonlySet<Action> = new Set(['fire', 'ecm', 'bomb', 'confirm', 'pause']);
const DIRECTIONS: ReadonlySet<Action> = new Set(['up', 'down', 'left', 'right']);

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

  // Which device moved the ship last. The mouse's position is remembered between moves, so it
  // would otherwise override a gamepad/keyboard for good once touched; instead the most recent
  // device is in charge — move the stick to take over from the mouse, move the mouse to take
  // back. [ROC-CTL-1,5]
  private lastDevice: 'mouse' | 'touch' | 'keys' | 'pad' = 'mouse';
  // Who steers: the pointer, or direct controls (stick / d-pad / arrow keys). Only *movement*
  // hands steering over, so firing with Space or the pad's A while steering with the mouse
  // doesn't take the ship off the mouse.
  private steering: 'pointer' | 'direct' = 'pointer';
  // Only *new* pad movement takes steering from the mouse: a d-pad direction newly pressed, or
  // the stick moving well away from where it was when the mouse last moved. A stick or d-pad just
  // being held mustn't keep stealing it back from a mouse that has moved since.
  private stickAnchor: Vec2 = { x: 0, y: 0 };
  private dpadPrev = false;
  private static readonly STICK_TAKEOVER = 0.25;
  private stick: Vec2 = { x: 0, y: 0 };
  private menuState: MenuNavState = initialMenuNav();
  private menuEdges: MenuEdges = { ...NO_MENU_EDGES };

  // This sample's gamepad menu steps (d-pad/stick, A, B, Start), for the shell's screens.
  get menu(): MenuEdges {
    return this.menuEdges;
  }

  // Is the gamepad the device in use right now? (The shell shows menu highlights only then.)
  get padActive(): boolean {
    return this.lastDevice === 'pad';
  }

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
      this.lastDevice = 'keys';
      if (DIRECTIONS.has(action) && !e.repeat) this.steering = 'direct'; // a fresh press, not key auto-repeat
    });
    window.addEventListener('keyup', (e) => {
      const action = keyAction(this.remap, e.code);
      if (action) this.keyHeld.delete(action);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.pointerTarget = this.toField(e.clientX, e.clientY);
      this.lastDevice = 'mouse';
      this.takePointerSteering();
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.pointerTarget = this.toField(e.clientX, e.clientY);
      this.lastDevice = 'mouse';
      this.takePointerSteering();
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
        this.lastDevice = 'touch';
        this.takePointerSteering();
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

  // The pointer takes steering; remember where the stick rests now, so only moving it again (not
  // merely holding it) hands steering back to the pad.
  private takePointerSteering(): void {
    this.steering = 'pointer';
    this.stickAnchor = { ...this.stick };
  }

  private pollGamepad(dt: number): void {
    this.padHeld = new Set<Action>();
    // The first connected pad, wherever the browser put it (not always slot 0).
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads ? Array.from(pads).find((p) => p && p.connected) : undefined;
    if (!pad) {
      this.padPrev = new Set<Action>();
      this.stick = { x: 0, y: 0 };
      ({ edges: this.menuEdges, state: this.menuState } = stepMenuNav(this.menuState, null, dt));
      return;
    }
    pad.buttons.forEach((b, i) => {
      if (!b.pressed) return;
      const action = buttonAction(this.remap, i);
      if (action) this.padHeld.add(action);
    });
    // Left stick: analogue flight (deadzoned), and a menu direction once pushed well over.
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    this.stick = applyDeadzone(ax, ay);
    const pressed = (i: number): boolean => !!pad.buttons[i]?.pressed;
    const snap: PadSnapshot = {
      dirs: {
        up: pressed(12) || ay < -MENU_STICK,
        down: pressed(13) || ay > MENU_STICK,
        left: pressed(14) || ax < -MENU_STICK,
        right: pressed(15) || ax > MENU_STICK,
      },
      select: pressed(0),
      back: pressed(1),
      start: pressed(9),
    };
    ({ edges: this.menuEdges, state: this.menuState } = stepMenuNav(this.menuState, snap, dt));
    if (this.stick.x !== 0 || this.stick.y !== 0 || pad.buttons.some((b) => b.pressed)) this.lastDevice = 'pad';
    const dpad = pressed(12) || pressed(13) || pressed(14) || pressed(15);
    const stickMoved = Math.hypot(this.stick.x - this.stickAnchor.x, this.stick.y - this.stickAnchor.y) > DomInput.STICK_TAKEOVER;
    if ((dpad && !this.dpadPrev) || stickMoved) this.steering = 'direct';
    if (this.steering === 'direct') this.stickAnchor = { ...this.stick }; // track it while the pad steers
    this.dpadPrev = dpad;

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
    this.pollGamepad(dt);
    const held = new Set<Action>([...this.keyHeld, ...this.padHeld]);
    // A gamepad or keyboard in use takes the ship away from a resting mouse cursor (touch keeps
    // its own drag; it clears itself when the finger lifts). [ROC-CTL-1,5]
    // Steering only: a held mouse button keeps autofiring (pointerFiring is separate) while the
    // pad steers.
    if (this.steering === 'direct' && this.lastDevice !== 'touch' && this.pointerTarget) {
      this.pointerTarget = null;
    }

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
      stick: this.stick,
    };

    const { frame, virtualTarget } = composeInputFrame(raw, { dt, bounds: this.bounds, speed: this.speed });
    this.virtualTarget = virtualTarget;

    // Consume one-shot edges.
    this.pointerTapped = false;
    this.edges = { fire: false, ecm: false, bomb: false, confirm: false, pause: false };

    return frame;
  }
}
