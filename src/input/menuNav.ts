// Gamepad menu navigation: turns the pad's d-pad / left stick and face buttons into one-shot menu
// steps for the shell's screens (title, station shop, high-score name entry, game over / win).
// A direction fires once when pressed, then auto-repeats while held (like a keyboard), so the
// shop list can be scrolled by holding down. Uses the standard gamepad layout: d-pad 12-15,
// A = 0 (select), B = 1 (back), Start = 9. Pure, so it is testable without a real pad.
// [ROC-CTL-5]

export type MenuDir = 'up' | 'down' | 'left' | 'right';

export interface PadSnapshot {
  dirs: Record<MenuDir, boolean>; // d-pad, or the stick pushed past MENU_STICK
  select: boolean; // A
  back: boolean; // B
  start: boolean; // Start
}

export interface MenuEdges {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  select: boolean;
  back: boolean;
  start: boolean;
}

export interface MenuNavState {
  held: Record<MenuDir, number>; // seconds each direction has been held (-1 = not held)
  repeatAt: Record<MenuDir, number>; // hold time at which it next repeats
  select: boolean;
  back: boolean;
  start: boolean;
}

export const MENU_STICK = 0.6; // stick deflection that counts as a menu direction
export const REPEAT_DELAY = 0.4; // seconds before a held direction starts repeating
export const REPEAT_EVERY = 0.12;

const DIRS: MenuDir[] = ['up', 'down', 'left', 'right'];

export function initialMenuNav(): MenuNavState {
  return {
    held: { up: -1, down: -1, left: -1, right: -1 },
    repeatAt: { up: 0, down: 0, left: 0, right: 0 },
    select: false,
    back: false,
    start: false,
  };
}

export const NO_MENU_EDGES: MenuEdges = { up: false, down: false, left: false, right: false, select: false, back: false, start: false };

// Advance one sample: returns this sample's menu edges and the new state.
export function stepMenuNav(state: MenuNavState, pad: PadSnapshot | null, dt: number): { edges: MenuEdges; state: MenuNavState } {
  const next = initialMenuNav();
  const edges: MenuEdges = { ...NO_MENU_EDGES };
  if (!pad) return { edges, state: next };

  for (const d of DIRS) {
    if (!pad.dirs[d]) continue;
    if (state.held[d] < 0) {
      // Fresh press: one step now, then wait before repeating.
      edges[d] = true;
      next.held[d] = 0;
      next.repeatAt[d] = REPEAT_DELAY;
    } else {
      const t = state.held[d] + dt;
      next.held[d] = t;
      next.repeatAt[d] = state.repeatAt[d];
      if (t >= state.repeatAt[d]) {
        edges[d] = true;
        next.repeatAt[d] = state.repeatAt[d] + REPEAT_EVERY;
      }
    }
  }
  edges.select = pad.select && !state.select;
  edges.back = pad.back && !state.back;
  edges.start = pad.start && !state.start;
  next.select = pad.select;
  next.back = pad.back;
  next.start = pad.start;
  return { edges, state: next };
}

// Spatial navigation over a set of on-screen rectangles: from the focused one, the nearest in the
// pressed direction (straight-line distance, with sideways offset counting double so it prefers
// staying in line). Returns the same index when nothing lies that way. Used for the on-screen
// name-entry keyboard.
export function moveFocus(rects: { x: number; y: number; w: number; h: number }[], focus: number, dir: MenuDir): number {
  const c = (i: number) => ({ x: rects[i].x + rects[i].w / 2, y: rects[i].y + rects[i].h / 2 });
  if (!rects[focus]) return 0;
  const from = c(focus);
  let best = focus;
  let bestScore = Infinity;
  rects.forEach((_, i) => {
    if (i === focus) return;
    const p = c(i);
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
    const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    if (along <= 1) return; // not in that direction
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
