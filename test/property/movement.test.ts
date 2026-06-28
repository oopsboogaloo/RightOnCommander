// T2.2 property: the ship never leaves the field for any sequence of targets. [ROC-MOV-2]

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import { movementSystem, DEFAULT_MOVEMENT } from '../../src/sim/systems/movement.js';
import type { InputFrame } from '../../src/interfaces.js';

const DT = 1 / 120;
const { bounds: b, shipRadius: r } = DEFAULT_MOVEMENT;
const EPS = 1e-9;

const targetArb = fc.option(
  fc.record({
    x: fc.double({ min: -3, max: 3, noNaN: true }),
    y: fc.double({ min: -3, max: 3, noNaN: true }),
  }),
  { nil: null },
);

describe('movement bounds', () => {
  it('keeps the whole ship inside the field for any targets', () => {
    fc.assert(
      fc.property(fc.array(targetArb, { maxLength: 100 }), (targets) => {
        const w = makeWorld(1);
        for (const moveTarget of targets) {
          const input: InputFrame = {
            moveTarget,
            firing: false,
            fireTapped: false,
            ecm: false,
            energyBomb: false,
            confirm: false,
            pause: false,
          };
          movementSystem(w, input, DT);
          const p = w.entities.get(PLAYER_ID)!;
          expect(p.pos.x).toBeGreaterThanOrEqual(b.minX + r - EPS);
          expect(p.pos.x).toBeLessThanOrEqual(b.maxX - r + EPS);
          expect(p.pos.z).toBeGreaterThanOrEqual(b.minZ + r - EPS);
          expect(p.pos.z).toBeLessThanOrEqual(b.maxZ - r + EPS);
        }
      }),
    );
  });
});
