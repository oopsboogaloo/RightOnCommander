// 4x4 transform matrices (row-major, 16-element arrays) for building model matrices:
// yaw (heading) ∘ bank (roll about forward axis) ∘ translate. [design §7]

import type { Vec3 } from './vec3.js';

export type Mat4 = number[]; // length 16, row-major

export const identity = (): Mat4 => [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

// Row-major multiply: result = a * b.
export const multiply = (a: Mat4, b: Mat4): Mat4 => {
  const out = new Array<number>(16).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[r * 4 + k] * b[k * 4 + c];
      out[r * 4 + c] = sum;
    }
  }
  return out;
};

export const translation = (t: Vec3): Mat4 => [
  1, 0, 0, t.x,
  0, 1, 0, t.y,
  0, 0, 1, t.z,
  0, 0, 0, 1,
];

// Rotation about +y (yaw / heading).
export const rotationY = (rad: number): Mat4 => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    c, 0, s, 0,
    0, 1, 0, 0,
    -s, 0, c, 0,
    0, 0, 0, 1,
  ];
};

// Rotation about +z (bank / roll).
export const rotationZ = (rad: number): Mat4 => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    c, -s, 0, 0,
    s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
};

// Transform a point (assumes w = 1) and perspective-divide.
export const transformPoint = (m: Mat4, v: Vec3): Vec3 => {
  const x = m[0] * v.x + m[1] * v.y + m[2] * v.z + m[3];
  const y = m[4] * v.x + m[5] * v.y + m[6] * v.z + m[7];
  const z = m[8] * v.x + m[9] * v.y + m[10] * v.z + m[11];
  const w = m[12] * v.x + m[13] * v.y + m[14] * v.z + m[15];
  const iw = w !== 0 ? 1 / w : 1;
  return { x: x * iw, y: y * iw, z: z * iw };
};
