// Wave spacing: no attack wave in any level has members sitting on top of one another. Members
// of a wave fly the same path a fixed time apart, so slow ships or tight spacing stack them
// nose-to-tail, and a hover pattern (drop_hold) parks them all on one spot unless spread out.
// Brief crossings on looping paths are allowed. Guards the level content against regressions.
// [v1.19 wave spacing]

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import enemiesJson from '../../src/content/enemies.json';
import level1Json from '../../src/content/level1.json';
import level2Json from '../../src/content/level2.json';
import level3Json from '../../src/content/level3.json';
import level4Json from '../../src/content/level4.json';
import type { Mesh } from '../../src/interfaces.js';
import { loadContent } from '../../src/sim/content/loadContent.js';
import { memberOffsetX, type WaveDef } from '../../src/sim/systems/waves.js';
import { analyseWave, MAX_OVERLAP_SEC } from '../helpers/waveSpacing.js';

const meshes: Record<string, Mesh> = {};
for (const f of readdirSync('src/content/meshes')) {
  meshes[f.replace('.json', '')] = JSON.parse(readFileSync(`src/content/meshes/${f}`, 'utf8')) as Mesh;
}
const { enemies, levels } = loadContent({ enemies: enemiesJson, levels: [level1Json, level2Json, level3Json, level4Json] });

describe('wave spacing detector', () => {
  const base: WaveDef = { id: 't', pattern: 'vform', enemy: 'krait', count: 4, spacingMs: 100, durationMs: 6000 };

  it('flags ships following nose-to-tail too closely, and clears them once spaced out', () => {
    expect(analyseWave(base, enemies, meshes).overlaps).toBe(true);
    expect(analyseWave({ ...base, spacingMs: 1500 }, enemies, meshes).overlaps).toBe(false);
  });

  it('flags a hover pattern that parks every ship on one spot, until they are spread into a row', () => {
    const hold: WaveDef = { ...base, pattern: 'drop_hold', spacingMs: 400, params: { x0: 0, zHold: 0.7, dropFraction: 0.3 } };
    expect(analyseWave(hold, enemies, meshes).overlaps).toBe(true);
    expect(analyseWave({ ...hold, params: { ...hold.params, spreadX: 0.4 } }, enemies, meshes).overlaps).toBe(false);
  });

  it('spreads members evenly either side of the path', () => {
    expect([0, 1, 2, 3].map((i) => memberOffsetX({ spreadX: 0.4 }, i, 4))).toEqual([-0.6000000000000001, -0.2, 0.2, 0.6000000000000001]);
    expect(memberOffsetX({}, 2, 4)).toBe(0); // opt-in: no spreadX, no offset
  });
});

describe('level content', () => {
  for (const [i, lvl] of levels.entries()) {
    it(`Level ${i + 1}: no wave's ships stay stacked on one another for more than ${MAX_OVERLAP_SEC}s`, () => {
      const waves = [...lvl.wavesA, ...lvl.wavesB, ...(lvl.witchspace ? [lvl.witchspace] : [])];
      const stacked = waves.map((w) => analyseWave(w, enemies, meshes)).filter((r) => r.overlaps);
      expect(stacked.map((r) => `${r.id} (${r.overlapSec.toFixed(2)}s)`)).toEqual([]);
    });
  }
});
