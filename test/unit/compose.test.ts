// T2.1: the pure input composer maps every source into an identical InputFrame shape, and the
// directional virtual cursor behaves correctly. [ROC-CTL-1..5]

import { describe, it, expect } from 'vitest';
import { composeInputFrame, type RawInput, type FieldBounds } from '../../src/input/compose.js';
import type { Action } from '../../src/input/remap.js';

const BOUNDS: FieldBounds = { minX: -1, maxX: 1, minY: -1.6, maxY: 1.6 };
const OPTS = { dt: 1 / 60, bounds: BOUNDS, speed: 2 };

function raw(over: Partial<RawInput> = {}): RawInput {
  return {
    pointerTarget: null,
    pointerFiring: false,
    pointerTapped: false,
    held: new Set<Action>(),
    fireEdge: false,
    ecm: false,
    bomb: false,
    confirm: false,
    pause: false,
    virtualTarget: { x: 0, y: 0 },
    ...over,
  };
}

describe('composeInputFrame', () => {
  it('pointer drag sets moveTarget (clamped) and pointer fire/tap', () => {
    const { frame } = composeInputFrame(
      raw({ pointerTarget: { x: 5, y: -5 }, pointerFiring: true, pointerTapped: true }),
      OPTS,
    );
    expect(frame.moveTarget).toEqual({ x: 1, y: -1.6 }); // clamped to bounds
    expect(frame.firing).toBe(true);
    expect(frame.fireTapped).toBe(true);
  });

  it('keyboard right/up advances the virtual cursor in the right direction', () => {
    const { frame, virtualTarget } = composeInputFrame(raw({ held: new Set(['right', 'up']) }), OPTS);
    expect(virtualTarget.x).toBeGreaterThan(0);
    expect(virtualTarget.y).toBeGreaterThan(0);
    expect(frame.moveTarget).toEqual(virtualTarget);
  });

  it('normalises diagonal speed (no faster than a single axis)', () => {
    const diag = composeInputFrame(raw({ held: new Set(['right', 'up']) }), OPTS).virtualTarget;
    const straight = composeInputFrame(raw({ held: new Set(['right']) }), OPTS).virtualTarget;
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(straight.x, 6);
  });

  it('holds the last position when nothing is pressed', () => {
    const { frame } = composeInputFrame(raw({ virtualTarget: { x: 0.4, y: -0.2 } }), OPTS);
    expect(frame.moveTarget).toEqual({ x: 0.4, y: -0.2 });
  });

  it('fire held (keyboard) sets firing; momentary edges pass through', () => {
    const { frame } = composeInputFrame(
      raw({ held: new Set(['fire']), ecm: true, bomb: true, confirm: true, pause: true }),
      OPTS,
    );
    expect(frame.firing).toBe(true);
    expect(frame.ecm).toBe(true);
    expect(frame.energyBomb).toBe(true);
    expect(frame.confirm).toBe(true);
    expect(frame.pause).toBe(true);
  });

  it('clamps the virtual cursor to the field bounds', () => {
    let v = { x: 0.99, y: 0 };
    for (let i = 0; i < 200; i++) {
      v = composeInputFrame(raw({ held: new Set(['right']), virtualTarget: v }), OPTS).virtualTarget;
    }
    expect(v.x).toBeLessThanOrEqual(BOUNDS.maxX + 1e-9);
  });
});
