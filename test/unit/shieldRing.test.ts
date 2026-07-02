// Pure geometry for the hull-hugging shield ring: offsetting a convex polygon outward by a gap,
// with rounded corners (Minkowski sum with a disk). [ROC-DMG-1,3 shield-hug rework]

import { describe, it, expect } from 'vitest';
import { offsetPolygonPath, type RingCmd } from '../../src/render/shieldRing.js';
import type { Pt } from '../../src/sim/math/geom2.js';

const square: Pt[] = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 2 },
  { x: 0, y: 2 },
];

describe('offsetPolygonPath', () => {
  it('is null for a degenerate polygon or a non-positive gap', () => {
    expect(offsetPolygonPath([{ x: 0, y: 0 }, { x: 1, y: 1 }], 1)).toBeNull(); // only 2 points
    expect(offsetPolygonPath(square, 0)).toBeNull();
    expect(offsetPolygonPath(square, -1)).toBeNull();
  });

  it('offsets a CCW square outward with 4 straight edges and 4 quarter-circle arcs', () => {
    const path = offsetPolygonPath(square, 1);
    expect(path).not.toBeNull();
    const cmds = path!.cmds;
    const lines = cmds.filter((c): c is Extract<RingCmd, { kind: 'line' }> => c.kind === 'line');
    const arcs = cmds.filter((c): c is Extract<RingCmd, { kind: 'arc' }> => c.kind === 'arc');
    expect(lines.length).toBe(4);
    expect(arcs.length).toBe(4);
    for (const arc of arcs) expect(arc.radius).toBeCloseTo(1, 9);

    // Arc centres are the original square's corners.
    const centres = arcs.map((a) => `${a.center.x},${a.center.y}`).sort();
    expect(centres).toEqual(['0,2', '2,0', '2,2', '0,0'].sort());

    // Path starts 1 unit outward from the bottom edge (below the square).
    expect(path!.start).toEqual({ x: 0, y: -1 });
    // Offset edges sit exactly `gap` outside each original edge.
    expect(lines.map((l) => `${l.to.x},${l.to.y}`).sort()).toEqual(
      ['2,-1', '3,2', '0,3', '-1,0'].sort(),
    );
  });

  it('offsets a CW-wound square identically (winding-agnostic)', () => {
    const cw = square.slice().reverse();
    const ccwPath = offsetPolygonPath(square, 1)!;
    const cwPath = offsetPolygonPath(cw, 1)!;
    // Walk every command, collecting the point reached after each one — 4 line-ends + 4
    // arc-ends, the full 8-point boundary trace. Different windings start the cycle at a
    // different vertex, so compare the traces as sets, not in order.
    const trace = (p: typeof ccwPath): string[] => {
      const pts: Pt[] = [];
      for (const cmd of p.cmds) {
        if (cmd.kind === 'line') pts.push(cmd.to);
        else pts.push({ x: cmd.center.x + cmd.radius * Math.cos(cmd.to), y: cmd.center.y + cmd.radius * Math.sin(cmd.to) });
      }
      const fmt = (n: number): string => {
        const s = n.toFixed(6);
        return s === '-0.000000' ? '0.000000' : s;
      };
      return pts.map((pt) => `${fmt(pt.x)},${fmt(pt.y)}`).sort();
    };
    expect(trace(cwPath)).toEqual(trace(ccwPath));
  });

  it('scales the ring outward proportionally to the gap', () => {
    const small = offsetPolygonPath(square, 0.5)!;
    const big = offsetPolygonPath(square, 2)!;
    expect(small.start).toEqual({ x: 0, y: -0.5 });
    expect(big.start).toEqual({ x: 0, y: -2 });
  });

  it('traces a continuous path: each command starts where the previous one ended', () => {
    const path = offsetPolygonPath(square, 1)!;
    let cur = path.start;
    for (const cmd of path.cmds) {
      if (cmd.kind === 'line') {
        cur = cmd.to;
      } else {
        // The arc must pick up exactly where the path currently is...
        const start = { x: cmd.center.x + cmd.radius * Math.cos(cmd.from), y: cmd.center.y + cmd.radius * Math.sin(cmd.from) };
        expect(start.x).toBeCloseTo(cur.x, 9);
        expect(start.y).toBeCloseTo(cur.y, 9);
        // ...and leave the path at its far end, ready for the next command.
        cur = { x: cmd.center.x + cmd.radius * Math.cos(cmd.to), y: cmd.center.y + cmd.radius * Math.sin(cmd.to) };
      }
    }
    // Final position returns to the start (closed loop).
    expect(cur.x).toBeCloseTo(path.start.x, 9);
    expect(cur.y).toBeCloseTo(path.start.y, 9);
  });
});
