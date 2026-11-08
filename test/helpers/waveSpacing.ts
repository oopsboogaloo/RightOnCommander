// Wave spacing analysis: do members of the same attack wave overlap on screen?
//
// Every member of a wave flies the identical path, only `spacingMs` later than the one before
// (plus an optional sideways `spreadX` slot), so whether two of them overlap is a pure function
// of the pattern, the timing and the ship's drawn size. This replays each pair's positions over
// their shared lifetime (while both are on screen) and finds the closest they get, against the
// sum of their drawn radii (hull silhouette radius x SHIP_SCALE x the enemy's scale). Touching is
// fine; overlapping isn't — but only *sustained* overlap counts (two ships flying stacked
// nose-to-tail, or parked on one spot). A loop or orbit path crosses itself, so a later member
// briefly passes through where an earlier one is; that quick crossing (under MAX_OVERLAP_SEC)
// reads as ships crossing, not as one sat on top of another, and is allowed. Used by the content
// test and to re-space the level files.

import type { Mesh } from '../../src/interfaces.js';
import type { WaveDef, EnemyDef } from '../../src/sim/systems/waves.js';
import { memberOffsetX } from '../../src/sim/systems/waves.js';
import { getPattern } from '../../src/sim/systems/paths.js';
import { hullRadius, meshSilhouette } from '../../src/sim/systems/collision.js';
import { createRng } from '../../src/sim/rng.js';
import { SHIP_SCALE } from '../../src/sim/index.js';

// Only overlaps a player can see count: both members inside the visible field.
const VISIBLE = { x: 1.4, zMin: -1.7, zMax: 1.75 };
const DT = 1 / 120;
const DEFAULT_DURATION_MS = 4000;
export const MAX_OVERLAP_SEC = 0.25; // longer than this continuously and it reads as stacked

export interface SpacingResult {
  id: string;
  minDist: number; // closest approach of any two members while both are visible
  needed: number; // 2 x the drawn radius: closer than this, they overlap
  overlapSec: number; // longest any one pair stays overlapped, continuously
  overlaps: boolean; // overlapSec > MAX_OVERLAP_SEC
}

export function drawnRadius(enemy: EnemyDef | undefined, meshes: Record<string, Mesh>): number {
  const mesh = enemy?.meshId ? meshes[enemy.meshId] : undefined;
  if (!mesh) return 0;
  return hullRadius(meshSilhouette(mesh), SHIP_SCALE * (enemy?.scale ?? 1));
}

export function analyseWave(wave: WaveDef, enemies: Record<string, EnemyDef>, meshes: Record<string, Mesh>): SpacingResult {
  const r = drawnRadius(enemies[wave.enemy], meshes);
  const needed = 2 * r;
  const pattern = getPattern(wave.pattern);
  const n = wave.count;
  if (!pattern || n < 2 || r === 0) return { id: wave.id, minDist: Infinity, needed, overlapSec: 0, overlaps: false };

  const rng = createRng(1); // patterns are pure in (t, params)
  const params = wave.params ?? {};
  const duration = (wave.durationMs ?? DEFAULT_DURATION_MS) / 1000 / (wave.speed ?? 1);
  const spacing = wave.spacingMs / 1000;
  const offsets = Array.from({ length: n }, (_, i) => memberOffsetX(params, i, n));
  const end = (n - 1) * spacing + duration;

  let minDist = Infinity;
  let overlapSec = 0;
  const run = new Float64Array(n * n); // per pair: how long they have been overlapped, continuously
  const pos: ({ x: number; z: number } | null)[] = new Array(n);
  for (let T = 0; T <= end; T += DT) {
    for (let i = 0; i < n; i++) {
      const u = (T - i * spacing) / duration;
      if (u < 0 || u > 1) {
        pos[i] = null;
        continue;
      }
      const p = pattern(u, params, rng).pos;
      const x = p.x + offsets[i];
      pos[i] = Math.abs(x) <= VISIBLE.x && p.z >= VISIBLE.zMin && p.z <= VISIBLE.zMax ? { x, z: p.z } : null;
    }
    for (let i = 0; i < n; i++) {
      const a = pos[i];
      if (!a) continue;
      for (let j = i + 1; j < n; j++) {
        const b = pos[j];
        const k = i * n + j;
        if (!b) {
          run[k] = 0;
          continue;
        }
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d < minDist) minDist = d;
        run[k] = d < needed ? run[k] + DT : 0;
        if (run[k] > overlapSec) overlapSec = run[k];
      }
    }
  }
  return { id: wave.id, minDist, needed, overlapSec, overlaps: overlapSec > MAX_OVERLAP_SEC };
}
