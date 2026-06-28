// T4.1: every pattern is continuous in t, has a unit tangent that tracks the direction of
// travel, and yaw follows the tangent. [ROC-ENM-2,3,9]

import { describe, it, expect } from 'vitest';
import { PATTERNS, yawFromTangent } from '../../src/sim/systems/paths.js';
import { createRng } from '../../src/sim/rng.js';
import { vec3, sub, dot, length, normalize } from '../../src/sim/math/vec3.js';

const rng = createRng(1);
const names = Object.keys(PATTERNS);

describe('path patterns', () => {
  it('produce continuous positions and unit tangents over their lifetime', () => {
    for (const name of names) {
      const fn = PATTERNS[name];
      let prev = fn(0, {}, rng);
      for (let i = 1; i <= 200; i++) {
        const cur = fn(i / 200, {}, rng);
        expect(length(sub(cur.pos, prev.pos))).toBeLessThan(0.1); // no jumps
        expect(length(cur.tangent)).toBeCloseTo(1, 6); // unit heading
        prev = cur;
      }
    }
  });

  it('orient along the direction of travel', () => {
    for (const name of names) {
      const fn = PATTERNS[name];
      for (const t of [0.2, 0.4, 0.6, 0.8]) {
        const here = fn(t, {}, rng);
        const motion = sub(fn(t + 0.01, {}, rng).pos, fn(t - 0.01, {}, rng).pos);
        if (length(motion) < 1e-4) continue; // stationary (e.g. drop_hold hover)
        expect(dot(here.tangent, normalize(motion))).toBeGreaterThan(0.9);
      }
    }
  });
});

describe('yawFromTangent', () => {
  it('maps headings to yaw about the height axis', () => {
    expect(yawFromTangent(vec3(0, 0, 1))).toBeCloseTo(0, 9); // forward
    expect(yawFromTangent(vec3(1, 0, 0))).toBeCloseTo(Math.PI / 2, 9); // right
    expect(yawFromTangent(vec3(-1, 0, 0))).toBeCloseTo(-Math.PI / 2, 9); // left
  });
});

describe('drop_hold', () => {
  it('drops from the entry height to the hold height and stays', () => {
    const fn = PATTERNS.drop_hold;
    expect(fn(0, {}, rng).pos.z).toBeCloseTo(1.8, 6); // entry
    expect(fn(1, {}, rng).pos.z).toBeCloseTo(0.8, 6); // hold
    expect(fn(0.75, {}, rng).pos.z).toBeCloseTo(0.8, 6); // already holding by 3/4
  });
});
