// DOM input backend: wires mouse / touch / keyboard / gamepad into an InputFrame each sample,
// via the pure remap + compose modules. Touch drag moves, tap fires, and ECM/Energy-Bomb have
// explicit trigger hooks for the transparent on-screen buttons. [ROC-CTL-1..6]

import type { InputFrame, Vec2, Storage } from '../interfaces.js';
import { type RemapTable, type Action, defaultRemap, loadRemap, keyAction, buttonAction } from './remap.js';
import { composeInputFrame, type FieldBounds, type RawInput } from './compose.js';

const EDGE_ACTIONS: ReadonlySet<Action> = new Set(['fire', 'ecm', 'bomb', 'confirm', 'pause']);

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
    this.bounds = opts.bounds ?? { minX: -1, maxX: 1, minY: -1.6, maxY: 1.6 };
    this.speed = opts.speed ?? 2;
    this.attach();
  }

  // Map client pixels to play-field coords; screen-up maps to +y (forward).
  private toField(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;
    return {
      x: this.bounds.minX + u * (this.bounds.maxX - this.bounds.minX),
      y: this.bounds.maxY - v * (this.bounds.maxY - this.bounds.minY),
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
