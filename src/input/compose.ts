// Pure mapping from a raw input snapshot (pointer + held actions + edges) to a single
// InputFrame, plus the directional "virtual cursor" used by keyboard/gamepad. Source-agnostic
// so the sim consumes frames identically regardless of input device. [ROC-CTL-1..6]

import type { InputFrame, Vec2 } from '../interfaces.js';
import type { Action } from './remap.js';

export interface FieldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface RawInput {
  pointerTarget: Vec2 | null; // play-field coords, or null when no pointer is active
  pointerFiring: boolean; // mouse button held (autofire)
  pointerTapped: boolean; // rising edge of a click/tap this sample
  held: Set<Action>; // currently-held actions (keyboard + gamepad)
  fireEdge: boolean; // rising edge of the fire action
  ecm: boolean; // rising edges (momentary)
  bomb: boolean;
  confirm: boolean;
  pause: boolean;
  virtualTarget: Vec2; // persistent directional cursor
}

export interface ComposeOptions {
  dt: number;
  bounds: FieldBounds;
  speed: number; // directional cursor speed, field-units per second
}

const clampField = (p: Vec2, b: FieldBounds): Vec2 => ({
  x: Math.min(b.maxX, Math.max(b.minX, p.x)),
  y: Math.min(b.maxY, Math.max(b.minY, p.y)),
});

export function composeInputFrame(
  raw: RawInput,
  opts: ComposeOptions,
): { frame: InputFrame; virtualTarget: Vec2 } {
  const dx = (raw.held.has('right') ? 1 : 0) - (raw.held.has('left') ? 1 : 0);
  const dy = (raw.held.has('up') ? 1 : 0) - (raw.held.has('down') ? 1 : 0);
  const directional = dx !== 0 || dy !== 0;

  let virtual = raw.virtualTarget;
  let moveTarget: Vec2;

  if (raw.pointerTarget) {
    // Pointer wins; keep the virtual cursor synced so releasing it never snaps the ship.
    virtual = clampField(raw.pointerTarget, opts.bounds);
    moveTarget = virtual;
  } else if (directional) {
    const len = Math.hypot(dx, dy) || 1; // normalise so diagonals aren't faster
    virtual = clampField(
      { x: virtual.x + (dx / len) * opts.speed * opts.dt, y: virtual.y + (dy / len) * opts.speed * opts.dt },
      opts.bounds,
    );
    moveTarget = virtual;
  } else {
    moveTarget = virtual; // hold last position
  }

  const frame: InputFrame = {
    moveTarget,
    firing: raw.pointerFiring || raw.held.has('fire'),
    fireTapped: raw.pointerTapped || raw.fireEdge,
    ecm: raw.ecm,
    energyBomb: raw.bomb,
    confirm: raw.confirm,
    pause: raw.pause,
  };

  return { frame, virtualTarget: virtual };
}
