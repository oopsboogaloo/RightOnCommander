// Sanity unit tests for the vec3 / mat4 math primitives. [T0.2]

import { describe, it, expect } from 'vitest';
import { vec3, add, sub, dot, cross, length, normalize } from '../../src/sim/math/vec3.js';
import { identity, multiply, translation, rotationY, transformPoint } from '../../src/sim/math/mat4.js';

describe('vec3', () => {
  it('basic ops', () => {
    expect(add(vec3(1, 2, 3), vec3(4, 5, 6))).toEqual(vec3(5, 7, 9));
    expect(sub(vec3(4, 5, 6), vec3(1, 2, 3))).toEqual(vec3(3, 3, 3));
    expect(dot(vec3(1, 0, 0), vec3(0, 1, 0))).toBe(0);
    expect(cross(vec3(1, 0, 0), vec3(0, 1, 0))).toEqual(vec3(0, 0, 1));
    expect(length(vec3(3, 4, 0))).toBe(5);
  });

  it('normalize yields unit length', () => {
    const n = normalize(vec3(0, 3, 4));
    expect(length(n)).toBeCloseTo(1, 10);
  });
});

describe('mat4', () => {
  it('identity * v = v', () => {
    expect(transformPoint(identity(), vec3(2, 3, 4))).toEqual(vec3(2, 3, 4));
  });

  it('translation moves a point', () => {
    expect(transformPoint(translation(vec3(1, 2, 3)), vec3(0, 0, 0))).toEqual(vec3(1, 2, 3));
  });

  it('rotationY by 90° maps +z to +x', () => {
    const p = transformPoint(rotationY(Math.PI / 2), vec3(0, 0, 1));
    expect(p.x).toBeCloseTo(1, 10);
    expect(p.z).toBeCloseTo(0, 10);
  });

  it('multiply composes transforms', () => {
    const m = multiply(translation(vec3(1, 0, 0)), rotationY(Math.PI / 2));
    const p = transformPoint(m, vec3(0, 0, 1));
    expect(p.x).toBeCloseTo(2, 10); // rotate +z->+x (x=1) then translate +1 => x=2
  });
});
