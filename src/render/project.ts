// Pure projection + hidden-surface logic for the software-3D renderer. No Canvas/DOM here,
// so it is unit-testable headlessly. [design §7, ROC-VIS-4,5]

import { type Vec3, vec3, dot, normalize } from '../sim/math/vec3.js';
import {
  type Mat4,
  multiply,
  translation,
  rotationY,
  rotationZ,
  scaling,
  transformPoint,
  transformDir,
} from '../sim/math/mat4.js';
import type { Mesh } from '../interfaces.js';
import { type Camera, toCameraSpace, dirToCameraSpace } from './camera.js';

// Model matrix: scale, orient by bank (roll) then yaw (heading), then translate. [design §7]
export function modelMatrix(pos: Vec3, yaw: number, bank: number, scale = 1): Mat4 {
  return multiply(translation(pos), multiply(rotationY(yaw), multiply(rotationZ(bank), scaling(scale))));
}

export interface Projected {
  x: number; // screen-space x (right positive), pre-viewport
  y: number; // screen-space y (up positive), pre-viewport
  depth: number; // camera-space depth (into screen)
}

export function projectCameraPoint(cam: Camera, cs: Vec3): Projected {
  const inv = cs.z !== 0 ? cam.focal / cs.z : 0;
  return { x: cs.x * inv, y: cs.y * inv, depth: cs.z };
}

export function projectPoint(cam: Camera, world: Vec3): Projected {
  return projectCameraPoint(cam, toCameraSpace(cam, world));
}

// A face is back-facing (cullable) when its normal points the same way as the ray from the
// camera to the face — i.e. away from the viewer. In camera space the camera is at the
// origin, so that ray is just the face centroid. [ROC-VIS-4]
export function isBackFace(normalCam: Vec3, centroidCam: Vec3): boolean {
  return dot(normalCam, centroidCam) > 0;
}

export interface PreparedFace {
  loop: number[];
  depth: number; // mean camera-space depth, for the painter sort
  normalCam: Vec3;
}

export interface PreparedMesh {
  projected: Projected[]; // per source vertex
  cameraSpace: Vec3[]; // per source vertex
  faces: PreparedFace[]; // visible faces only, sorted far -> near
  faceVisible: boolean[]; // per source face index: survived back-face cull
}

// Transform a mesh by its model matrix, project to screen, cull back faces, and painter-sort
// the survivors far -> near so nearer faces are drawn last and occlude. [ROC-VIS-4,5]
export function prepareMesh(mesh: Mesh, model: Mat4, cam: Camera): PreparedMesh {
  const cameraSpace = mesh.vertices.map((v) => toCameraSpace(cam, transformPoint(model, v)));
  const projected = cameraSpace.map((cs) => projectCameraPoint(cam, cs));

  const faces: PreparedFace[] = [];
  const faceVisible: boolean[] = new Array<boolean>(mesh.faces.length).fill(false);
  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    const normalCam = dirToCameraSpace(cam, transformDir(model, face.normal));

    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const i of face.loop) {
      cx += cameraSpace[i].x;
      cy += cameraSpace[i].y;
      cz += cameraSpace[i].z;
    }
    const n = face.loop.length;
    const centroidCam = vec3(cx / n, cy / n, cz / n);

    if (isBackFace(normalCam, centroidCam)) continue;
    faceVisible[fi] = true;
    faces.push({ loop: face.loop, depth: centroidCam.z, normalCam: normalize(normalCam) });
  }

  faces.sort((a, b) => b.depth - a.depth); // larger depth = farther = drawn first
  return { projected, cameraSpace, faces, faceVisible };
}
