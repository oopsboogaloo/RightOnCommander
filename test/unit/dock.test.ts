// T5a: docking-port geometry — the centred rotating rectangle shared by the hermit and the
// stations: in-port tests, the 30° alignment window, and the triple-damage multiplier.
// [ROC-HERM-1,3,8, ROC-DCKG-3]

import { describe, it, expect } from 'vitest';
import type { Entity } from '../../src/sim/components.js';
import {
  PORT_HALF_LONG,
  PORT_HALF_SHORT,
  PORT_DAMAGE_MULT,
  pointInPort,
  portAligned,
  portDamageMultiplier,
  portCorners,
} from '../../src/sim/systems/dock.js';

// The port rides the owner's roll (bank), so the rotation the tests exercise is bank, not yaw.
const owner = (bank: number, port = true): Entity => ({
  id: 1,
  kind: 'boss',
  pos: { x: 0.2, y: 0, z: 0.5 },
  vel: { x: 0, y: 0, z: 0 },
  yaw: 0,
  bank,
  port,
});

describe('docking port', () => {
  it('contains points inside the rotated rectangle and rejects points outside', () => {
    const e = owner(0);
    expect(pointInPort(e, 0.2, 0.5)).toBe(true); // dead centre
    expect(pointInPort(e, 0.2 + PORT_HALF_LONG * 0.9, 0.5)).toBe(true); // along the long axis
    expect(pointInPort(e, 0.2 + PORT_HALF_LONG * 1.1, 0.5)).toBe(false); // past the long end
    expect(pointInPort(e, 0.2, 0.5 + PORT_HALF_SHORT * 1.2)).toBe(false); // past the short side

    // Rotated 90°: the long axis now runs up-screen.
    const r = owner(Math.PI / 2);
    expect(pointInPort(r, 0.2, 0.5 + PORT_HALF_LONG * 0.9)).toBe(true);
    expect(pointInPort(r, 0.2 + PORT_HALF_LONG * 0.9, 0.5)).toBe(false);
  });

  it('is only "in port" for entities that carry one', () => {
    expect(pointInPort(owner(0, false), 0.2, 0.5)).toBe(false);
  });

  it('is aligned within 30° of horizontal, on both half-turns', () => {
    expect(portAligned(owner(0))).toBe(true);
    expect(portAligned(owner(Math.PI / 6 - 0.01))).toBe(true); // just inside 30°
    expect(portAligned(owner(-Math.PI / 6 + 0.01))).toBe(true);
    expect(portAligned(owner(Math.PI))).toBe(true); // the slot repeats every half-turn
    expect(portAligned(owner(Math.PI + Math.PI / 7))).toBe(true);
    expect(portAligned(owner(Math.PI / 4))).toBe(false); // 45° — outside
    expect(portAligned(owner(Math.PI / 2))).toBe(false); // vertical
  });

  it('deals triple damage on a direct port hit, normal damage elsewhere', () => {
    const e = owner(0);
    expect(portDamageMultiplier(e, 0.2, 0.5)).toBe(PORT_DAMAGE_MULT); // stopped in the rect [ROC-HERM-8]
    expect(portDamageMultiplier(e, 0.2 + PORT_HALF_LONG * 2, 0.5)).toBe(1);
    expect(portDamageMultiplier(owner(0, false), 0.2, 0.5)).toBe(1); // no port, no weak spot

    // Collision stops shots at the hull rim: a rim impact whose path crosses the port still
    // counts as a direct port hit; one aimed past it does not. [ROC-HERM-8]
    expect(portDamageMultiplier(e, 0.2, 0.1, 0, 6)).toBe(PORT_DAMAGE_MULT); // up the centre line
    expect(portDamageMultiplier(e, 0.2 + PORT_HALF_LONG * 2, 0.1, 0, 6)).toBe(1); // misses wide
    expect(portDamageMultiplier(e, 0.2, 0.1, 6, 0)).toBe(1); // crossing sideways, below the port
  });

  it('produces a corner loop that rotates with the owner', () => {
    const flat = portCorners(owner(0));
    expect(flat).toHaveLength(4);
    // At yaw 0 the long axis is horizontal: x spread > z spread.
    const dx = Math.max(...flat.map((c) => c.x)) - Math.min(...flat.map((c) => c.x));
    const dz = Math.max(...flat.map((c) => c.z)) - Math.min(...flat.map((c) => c.z));
    expect(dx).toBeGreaterThan(dz);

    const up = portCorners(owner(Math.PI / 2));
    const udx = Math.max(...up.map((c) => c.x)) - Math.min(...up.map((c) => c.x));
    const udz = Math.max(...up.map((c) => c.z)) - Math.min(...up.map((c) => c.z));
    expect(udz).toBeGreaterThan(udx);
  });
});
