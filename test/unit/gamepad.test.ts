// Gamepad support: the analogue stick (radial deadzone, proportional steering, pointer still
// wins while it owns control), and menu navigation (one step per press, auto-repeat while held,
// A/B/Start edges, spatial focus on the name-entry keyboard). [ROC-CTL-1,5]

import { describe, it, expect } from 'vitest';
import { composeInputFrame, applyDeadzone, STICK_DEADZONE, type RawInput } from '../../src/input/compose.js';
import type { Action } from '../../src/input/remap.js';
import {
  initialMenuNav,
  stepMenuNav,
  moveFocus,
  REPEAT_DELAY,
  REPEAT_EVERY,
  type PadSnapshot,
  type MenuNavState,
} from '../../src/input/menuNav.js';
import { entryKeys } from '../../src/render/screens/title.js';

const OPTS = { dt: 1 / 60, bounds: { minX: -4 / 3, maxX: 4 / 3, minY: -1.6, maxY: 1.6 }, speed: 2 };
const raw = (over: Partial<RawInput> = {}): RawInput => ({
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
});

describe('analogue stick', () => {
  it('ignores a resting stick inside the deadzone, and rescales beyond it (y flipped to up)', () => {
    expect(applyDeadzone(0.1, -0.1)).toEqual({ x: 0, y: 0 });
    expect(applyDeadzone(STICK_DEADZONE, 0)).toEqual({ x: 0, y: 0 });
    const full = applyDeadzone(0, -1); // stick pushed fully up (gamepad y is down)
    expect(full.x).toBeCloseTo(0, 9);
    expect(full.y).toBeCloseTo(1, 9);
    const half = applyDeadzone(0.6, 0);
    expect(half.x).toBeCloseTo(0.5, 9); // (0.6 - 0.2) / 0.8
  });

  it('steers proportionally: a slight tilt moves the ship slower than a full push', () => {
    const slow = composeInputFrame(raw({ stick: applyDeadzone(0.4, 0) }), OPTS).frame.moveTarget!;
    const fast = composeInputFrame(raw({ stick: applyDeadzone(1, 0) }), OPTS).frame.moveTarget!;
    expect(slow.x).toBeGreaterThan(0);
    expect(fast.x).toBeCloseTo(OPTS.speed * OPTS.dt, 9);
    expect(slow.x).toBeLessThan(fast.x / 2);
  });

  it('a pointer in control still wins over the stick', () => {
    const { frame } = composeInputFrame(raw({ pointerTarget: { x: -0.5, y: 0.2 }, stick: { x: 1, y: 0 } }), OPTS);
    expect(frame.moveTarget).toEqual({ x: -0.5, y: 0.2 });
  });
});

describe('menu navigation', () => {
  const pad = (over: Partial<PadSnapshot> = {}): PadSnapshot => ({
    dirs: { up: false, down: false, left: false, right: false },
    select: false,
    back: false,
    start: false,
    ...over,
  });
  const down = pad({ dirs: { up: false, down: true, left: false, right: false } });

  it('steps once on press, then repeats after a delay while held', () => {
    const DT = 1 / 120;
    let s: MenuNavState = initialMenuNav();
    let steps = 0;
    let t = 0;
    for (; t < REPEAT_DELAY + REPEAT_EVERY * 3 + 2 * DT; t += DT) {
      const r = stepMenuNav(s, down, DT);
      s = r.state;
      if (r.edges.down) steps++;
    }
    expect(steps).toBe(1 + 4); // the press, then repeats at the delay and every interval after
    const released = stepMenuNav(s, pad(), DT);
    expect(released.edges.down).toBe(false);
    expect(stepMenuNav(released.state, down, DT).edges.down).toBe(true); // a fresh press steps at once
  });

  it('reports A / B / Start only on the press, not while held', () => {
    let s = initialMenuNav();
    const a = pad({ select: true });
    const first = stepMenuNav(s, a, 1 / 60);
    expect(first.edges.select).toBe(true);
    s = first.state;
    expect(stepMenuNav(s, a, 1 / 60).edges.select).toBe(false);
    expect(stepMenuNav(initialMenuNav(), null, 1 / 60).edges.select).toBe(false); // no pad
  });

  it('moves focus across the on-screen keyboard spatially', () => {
    const keys = entryKeys(800, 600);
    const at = (c: string) => keys.findIndex((k) => k.key === c);
    expect(keys[moveFocus(keys, at('A'), 'right')].key).toBe('B');
    expect(keys[moveFocus(keys, at('A'), 'down')].key).toBe('J');
    expect(keys[moveFocus(keys, at('B'), 'left')].key).toBe('A');
    expect(moveFocus(keys, at('A'), 'up')).toBe(at('A')); // nothing above the top row: stay
    // From the bottom row of letters/digits down to the action keys.
    expect(['SPACE', 'DEL', 'OK']).toContain(keys[moveFocus(keys, at('4'), 'down')].key);
  });
});
