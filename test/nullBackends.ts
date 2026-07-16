// Null / recording backend implementations of the shell interfaces, for headless tests.
// The recording variants let tests assert on what the sim asked the world to do. [design §4]

import type { AudioOut, Renderer, Storage, Clock, DrawOpts, Mesh, Vec2 } from '../src/interfaces.js';

export const nullRenderer: Renderer = {
  beginFrame() {},
  drawMesh(_mesh: Mesh, _xform: unknown, _opts?: DrawOpts) {},
  drawSilhouette(_mesh: Mesh, _xform: unknown, _opts?: DrawOpts) {},
  drawLine(_a: Vec2, _b: Vec2, _opts?: DrawOpts) {},
  drawEllipse(_c: Vec2, _rx: number, _ry: number, _opts?: DrawOpts) {},
  drawParticles(_points: Vec2[], _opts?: DrawOpts) {},
  drawText(_text: string, _pos: Vec2, _opts?: DrawOpts) {},
  endFrame(_alpha: number) {},
};

export function recordingAudio(): AudioOut & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    play(id: string) {
      calls.push(id);
    },
    setEnabled(_on: boolean) {},
  };
}

export function memoryStorage(): Storage & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    load(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    save(key: string, value: unknown) {
      data.set(key, value);
    },
  };
}

export const fixedClock = (start = 0): Clock => {
  let t = start;
  return { now: () => (t += 1000 / 120) };
};
