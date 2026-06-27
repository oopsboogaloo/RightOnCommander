// T1.2 unit tests: back-face cull decision and painter depth-ordering on a known cube,
// plus basic projection sanity. [ROC-VIS-4,5]

import { describe, it, expect } from 'vitest';
import { vec3 } from '../../src/sim/math/vec3.js';
import { identity } from '../../src/sim/math/mat4.js';
import { createCamera } from '../../src/render/camera.js';
import { isBackFace, projectPoint, prepareMesh } from '../../src/render/project.js';
import type { Mesh } from '../../src/interfaces.js';

// Unit cube centred at the origin, with outward face normals and CCW loops.
function unitCube(): Mesh {
  const v = (x: number, y: number, z: number) => vec3(x, y, z);
  return {
    vertices: [
      v(-0.5, -0.5, -0.5), // 0
      v(0.5, -0.5, -0.5), // 1
      v(0.5, 0.5, -0.5), // 2
      v(-0.5, 0.5, -0.5), // 3
      v(-0.5, -0.5, 0.5), // 4
      v(0.5, -0.5, 0.5), // 5
      v(0.5, 0.5, 0.5), // 6
      v(-0.5, 0.5, 0.5), // 7
    ],
    edges: [],
    faces: [
      { loop: [4, 5, 6, 7], normal: v(0, 0, 1) }, // +z front
      { loop: [0, 3, 2, 1], normal: v(0, 0, -1) }, // -z back
      { loop: [1, 2, 6, 5], normal: v(1, 0, 0) }, // +x right
      { loop: [0, 4, 7, 3], normal: v(-1, 0, 0) }, // -x left
      { loop: [3, 7, 6, 2], normal: v(0, 1, 0) }, // +y top
      { loop: [0, 1, 5, 4], normal: v(0, -1, 0) }, // -y bottom
    ],
  };
}

const loopSet = (loop: number[]): string => loop.slice().sort((a, b) => a - b).join(',');

describe('isBackFace', () => {
  it('culls a face whose normal points away from the camera (origin)', () => {
    // Camera at origin; a face out at +z with its normal also pointing +z faces away.
    expect(isBackFace(vec3(0, 0, 1), vec3(0, 0, 5))).toBe(true);
    // Normal pointing back toward the camera is visible.
    expect(isBackFace(vec3(0, 0, -1), vec3(0, 0, 5))).toBe(false);
  });
});

describe('projectPoint', () => {
  const cam = createCamera();

  it('projects the look-at origin to screen centre at positive depth', () => {
    const p = projectPoint(cam, vec3(0, 0, 0));
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(0, 9);
    expect(p.depth).toBeGreaterThan(0);
  });

  it('maps +x to the right and +z (forward) to up', () => {
    expect(projectPoint(cam, vec3(0.5, 0, 0)).x).toBeGreaterThan(0);
    expect(projectPoint(cam, vec3(0, 0, 0.5)).y).toBeGreaterThan(0);
  });
});

describe('prepareMesh (cull + painter sort)', () => {
  const cam = createCamera();
  const prep = prepareMesh(unitCube(), identity(), cam);
  const visible = prep.faces.map((f) => loopSet(f.loop));

  it('keeps the top face and culls the bottom face', () => {
    expect(visible).toContain('2,3,6,7'); // +y top, visible from above
    expect(visible).not.toContain('0,1,4,5'); // -y bottom, culled
  });

  it('culls roughly half the faces of a convex hull', () => {
    expect(prep.faces.length).toBeGreaterThan(0);
    expect(prep.faces.length).toBeLessThan(6);
  });

  it('sorts visible faces far -> near (non-increasing depth)', () => {
    for (let i = 1; i < prep.faces.length; i++) {
      expect(prep.faces[i - 1].depth).toBeGreaterThanOrEqual(prep.faces[i].depth);
    }
  });
});
