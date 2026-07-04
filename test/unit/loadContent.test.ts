// T5.2: content loader parses valid content and rejects malformed data. [design §2]

import { describe, it, expect } from 'vitest';
import enemiesJson from '../../src/content/enemies.json';
import level1Json from '../../src/content/level1.json';
import level2Json from '../../src/content/level2.json';
import level3Json from '../../src/content/level3.json';
import { loadContent } from '../../src/sim/content/loadContent.js';

describe('loadContent', () => {
  it('loads the bundled Level 1 content', () => {
    const { enemies, levels } = loadContent({ enemies: enemiesJson, levels: [level1Json] });
    const level = levels[0];
    expect(enemies.fer_de_lance.bounty).toBe(250);
    expect(enemies.fer_de_lance.scale).toBe(1.5); // FdL rescaled everywhere [ROC-FDL-1]
    expect(enemies.fer_de_lance_boss.scale).toBe(2); // boss FdL is 2.0x [ROC-FDL-1]
    expect(enemies.fer_de_lance_boss.shield).toBe(8); // [ROC-FDL-2]
    expect(enemies.fer_de_lance_boss.ecm).toBe(true);
    expect(enemies.hermit.behavior).toBe('hermit');
    expect(enemies.hermit.meshId).toBe('rock_hermit'); // bespoke rock-hermit hull with a modelled bay [ROC-HERM-1]
    expect(enemies.thargoid.missileImmune).toBe(true); // ECM jams player missile lock-on [Thargoid tuning]
    expect(level?.midBoss).toBe('hermit');
    expect(level?.endBoss).toBe('fer_de_lance_boss');
    expect(level?.name).toBe('Lave'); // hyperspace destination [ROC-HYP-2]
    expect(level?.facts?.length).toBeGreaterThan(0); // info-card facts [ROC-HYP-5]
    expect(level?.wavesA.length).toBe(13);
    expect(level?.wavesB.length).toBe(13);
    expect(enemies.transporter.hull).toBe(12); // tanky, unarmed freighter [ROC-TR-3]
    // Waves are sequenced by delayMs (the loader must preserve it, not just startWave).
    expect(level?.wavesA[1].delayMs).toBeGreaterThan(0);
    expect(level?.wavesA[2].delayMs).toBeGreaterThan(level!.wavesA[1].delayMs!);
    expect(level?.asteroidWaves?.length).toBeGreaterThan(0); // opening asteroid waves [ROC-L1-1]
    expect(level?.asteroidWaves?.[0].count).toBeGreaterThan(0);
  });

  it('loads the full campaign (Levels 1-3) as an ordered array', () => {
    const { levels } = loadContent({ enemies: enemiesJson, levels: [level1Json, level2Json, level3Json] });
    expect(levels).toHaveLength(3);
    expect(levels[0].name).toBe('Lave');
    expect(levels[1].name).toBe('Diso'); // [ROC-LORE-2]
    expect(levels[1].midBoss).toBe('python'); // [ROC-L2-3]
    expect(levels[1].endBoss).toBe('constrictor'); // [ROC-L2-4]
    expect(levels[2].name).toBe('Leesti');
    expect(levels[2].midBoss).toEqual(['anaconda', 'anaconda']); // [ROC-L3-3]
    expect(levels[2].endBoss).toBe('cobra_ace'); // [ROC-L3-4]
    expect(levels[2].witchspace?.enemy).toBe('thargoid'); // the L2->3 interlude [ROC-WITCH-1..4]
    expect(levels[1].witchspace).toBeUndefined(); // only set on the level it delivers into
  });

  it('rejects a malformed asteroidWaves', () => {
    expect(() =>
      loadContent({
        enemies: { grunt: { hull: 1, bounty: 1 } },
        levels: [{ id: 'x', asteroidWaves: 'nope', wavesA: [], midBoss: 'grunt', wavesB: [], endBoss: 'grunt' }],
      }),
    ).toThrow();
    expect(() =>
      loadContent({
        enemies: { grunt: { hull: 1, bounty: 1 } },
        levels: [{ id: 'x', asteroidWaves: ['nope'], wavesA: [], midBoss: 'grunt', wavesB: [], endBoss: 'grunt' }],
      }),
    ).toThrow();
  });

  it('rejects a wave referencing an unknown enemy', () => {
    expect(() =>
      loadContent({
        enemies: { grunt: { hull: 1, bounty: 1 } },
        levels: [{ id: 'x', wavesA: [{ pattern: 'vform', enemy: 'ghost', count: 1, spacingMs: 0 }], midBoss: 'grunt', wavesB: [], endBoss: 'grunt' }],
      }),
    ).toThrow();
  });

  it('rejects an unknown pattern', () => {
    expect(() =>
      loadContent({
        enemies: { grunt: { hull: 1, bounty: 1 } },
        levels: [{ id: 'x', wavesA: [{ pattern: 'spiral', enemy: 'grunt', count: 1, spacingMs: 0 }], midBoss: 'grunt', wavesB: [], endBoss: 'grunt' }],
      }),
    ).toThrow();
  });

  it('rejects a boss referencing an unknown enemy', () => {
    expect(() =>
      loadContent({ enemies: { grunt: { hull: 1, bounty: 1 } }, levels: [{ id: 'x', wavesA: [], midBoss: 'nope', wavesB: [], endBoss: 'grunt' }] }),
    ).toThrow();
  });
});
