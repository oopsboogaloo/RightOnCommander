// Camera for the software-3D pipeline. Sits above and slightly behind the action looking
// forward-down, tilted ~25° from vertical, giving the "slightly back from directly overhead"
// view that reveals hull tops and backs. Mild perspective. [design §7, ROC-VIS-3]
//
// World axes: +x right, +z forward (up-screen scroll axis), +y height. Camera space:
// x = right, y = up (screen-up), z = depth into the screen (used for the painter sort).

import { type Vec3, vec3, dot, sub, scale, cross, normalize } from '../sim/math/vec3.js';

export interface Camera {
  pos: Vec3;
  right: Vec3;
  up: Vec3;
  forward: Vec3; // view direction (into the screen)
  focal: number; // perspective focal length
}

export interface CameraOptions {
  tiltFromVertical?: number; // radians; 0 = straight down, default 25°
  distance?: number; // distance from the look-at point along the view direction
  focal?: number;
  lookAt?: Vec3;
}

const DEG = Math.PI / 180;

export function createCamera(opts: CameraOptions = {}): Camera {
  const tilt = opts.tiltFromVertical ?? 25 * DEG;
  const distance = opts.distance ?? 8;
  const focal = opts.focal ?? 8;
  const lookAt = opts.lookAt ?? vec3(0, 0, 0);

  // Mostly looking down (-y), tilted forward (+z) by `tilt` from vertical.
  const forward = normalize(vec3(0, -Math.cos(tilt), Math.sin(tilt)));
  const right = vec3(1, 0, 0);
  const up = normalize(cross(forward, right)); // = (0, sinθ, cosθ): screen-up tracks world +z

  const pos = sub(lookAt, scale(forward, distance));
  return { pos, right, up, forward, focal };
}

// World point -> camera space (x right, y up, z depth).
export function toCameraSpace(cam: Camera, p: Vec3): Vec3 {
  const d = sub(p, cam.pos);
  return vec3(dot(d, cam.right), dot(d, cam.up), dot(d, cam.forward));
}

// World direction -> camera space (no translation) — for normals.
export function dirToCameraSpace(cam: Camera, v: Vec3): Vec3 {
  return vec3(dot(v, cam.right), dot(v, cam.up), dot(v, cam.forward));
}
