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
    expect(enemies.cougar.missileImmune).toBe(true); // [ROC-CLK-3]
    expect(enemies.cougar.drops).toBe('cloak'); // guaranteed cloak-device drop [ROC-CLK-4]
    expect(enemies.cougar.cloakCycle).toEqual({ visibleSec: 4, transitionSec: 1, cloakedSec: 5 }); // [ROC-CLK-1]
    expect(enemies.cougar.scale).toBe(2); // twice the size of an ordinary hull [ROC-CLK-10]
    expect(enemies.cougar.fireSpeedMul).toBeCloseTo(1.4, 6); // 40% faster bolts [ROC-CLK-7]
    expect(level?.midBoss).toBe('hermit');
    expect(level?.endBoss).toBe('fer_de_lance_boss');
    expect(level?.name).toBe('Lave'); // hyperspace destination [ROC-HYP-2]
    expect(level?.facts?.length).toBeGreaterThan(0); // info-card facts [ROC-HYP-5]
    expect(level?.wavesA.length).toBe(63);
    expect(level?.wavesB.length).toBe(64);
    expect(enemies.transporter.hull).toBe(12); // tanky, unarmed freighter [ROC-TR-3]
    // Waves are sequenced by delayMs (the loader must preserve it, not just startWave).
    expect(level?.wavesA[1].delayMs).toBeGreaterThan(0);
    expect(level?.wavesA[2].delayMs).toBeGreaterThan(level!.wavesA[1].delayMs!);
    expect(level?.asteroidWaves?.length).toBeGreaterThan(0); // opening asteroid waves [ROC-L1-1]
    expect(level?.asteroidWaves?.[0].count).toBeGreaterThan(0);
    // Sequential default ids across the whole level's giantAsteroids list, for cheat-mode
    // labelling — Level 1's content doesn't author explicit ids. [ROC-GIANT-1, dev cheat]
    expect(level?.giantAsteroids?.map((g) => g.id)).toEqual(['g1', 'g2', 'g3', 'g4']);
  });

  it('defaults giant-asteroid ids sequentially but keeps an explicit one when authored', () => {
    const { levels } = loadContent({
      enemies: { grunt: { hull: 1, bounty: 1 } },
      levels: [
        {
          id: 'x',
          wavesA: [],
          midBoss: 'grunt',
          wavesB: [],
          endBoss: 'grunt',
          giantAsteroids: [
            { phase: 'wavesA', x: 0 },
            { phase: 'wavesB', x: 0, id: 'rocky' },
            { phase: 'wavesA', x: 0 },
          ],
        },
      ],
    });
    expect(levels[0].giantAsteroids?.map((g) => g.id)).toEqual(['g1', 'rocky', 'g3']);
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

    const cougarWaveL2 = levels[1].wavesA.find((w) => w.enemy === 'cougar');
    expect(cougarWaveL2?.clearField).toEqual({ beforeMs: 3000, afterMs: 6000 }); // [ROC-CLK-5,6]
    expect(cougarWaveL2?.fire?.rate).toBeCloseTo(0.7, 6); // doubled rate of fire [ROC-CLK-11]
    const cougarWaveL3 = levels[2].wavesA.find((w) => w.enemy === 'cougar');
    expect(cougarWaveL3?.clearField).toEqual({ beforeMs: 3000, afterMs: 6000 });
    expect(cougarWaveL3?.fire?.rate).toBeCloseTo(0.8, 6);
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

  it('rejects an enemy with an unknown drops type', () => {
    expect(() =>
      loadContent({ enemies: { grunt: { hull: 1, bounty: 1, drops: 'nope' } }, levels: [] }),
    ).toThrow();
  });

  it('rejects an enemy with a malformed cloakCycle', () => {
    expect(() =>
      loadContent({ enemies: { grunt: { hull: 1, bounty: 1, cloakCycle: { visibleSec: 4 } } }, levels: [] }),
    ).toThrow();
  });

  it('rejects an enemy with a non-numeric fireSpeedMul', () => {
    expect(() =>
      loadContent({ enemies: { grunt: { hull: 1, bounty: 1, fireSpeedMul: 'fast' } }, levels: [] }),
    ).toThrow();
  });

  it('rejects a wave with a malformed clearField', () => {
    expect(() =>
      loadContent({
        enemies: { grunt: { hull: 1, bounty: 1 } },
        levels: [
          {
            id: 'x',
            wavesA: [{ pattern: 'vform', enemy: 'grunt', count: 1, spacingMs: 0, clearField: { beforeMs: 1000 } }],
            midBoss: 'grunt',
            wavesB: [],
            endBoss: 'grunt',
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects a boss referencing an unknown enemy', () => {
    expect(() =>
      loadContent({ enemies: { grunt: { hull: 1, bounty: 1 } }, levels: [{ id: 'x', wavesA: [], midBoss: 'nope', wavesB: [], endBoss: 'grunt' }] }),
    ).toThrow();
  });
});
