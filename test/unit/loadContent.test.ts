// T5.2: content loader parses valid content and rejects malformed data. [design §2]

import { describe, it, expect } from 'vitest';
import enemiesJson from '../../src/content/enemies.json';
import level1Json from '../../src/content/level1.json';
import { loadContent } from '../../src/sim/content/loadContent.js';

describe('loadContent', () => {
  it('loads the bundled Level 1 content', () => {
    const { enemies, level } = loadContent({ enemies: enemiesJson, level: level1Json });
    expect(enemies.fer_de_lance.bounty).toBe(250);
    expect(level?.midBoss).toBe('hermit');
    expect(level?.endBoss).toBe('fer_de_lance');
    expect(level?.wavesA.length).toBe(13);
    expect(level?.wavesB.length).toBe(13);
    expect(enemies.transporter.hull).toBe(12); // tanky, unarmed freighter [ROC-TR-3]
    // Waves are sequenced by delayMs (the loader must preserve it, not just startWave).
    expect(level?.wavesA[1].delayMs).toBeGreaterThan(0);
    expect(level?.wavesA[2].delayMs).toBeGreaterThan(level!.wavesA[1].delayMs!);
  });

  it('rejects a wave referencing an unknown enemy', () => {
    expect(() =>
      loadContent({
        enemies: { grunt: { hull: 1, bounty: 1 } },
        level: { id: 'x', wavesA: [{ pattern: 'vform', enemy: 'ghost', count: 1, spacingMs: 0 }], midBoss: 'grunt', wavesB: [], endBoss: 'grunt' },
      }),
    ).toThrow();
  });

  it('rejects an unknown pattern', () => {
    expect(() =>
      loadContent({
        enemies: { grunt: { hull: 1, bounty: 1 } },
        level: { id: 'x', wavesA: [{ pattern: 'spiral', enemy: 'grunt', count: 1, spacingMs: 0 }], midBoss: 'grunt', wavesB: [], endBoss: 'grunt' },
      }),
    ).toThrow();
  });

  it('rejects a boss referencing an unknown enemy', () => {
    expect(() =>
      loadContent({ enemies: { grunt: { hull: 1, bounty: 1 } }, level: { id: 'x', wavesA: [], midBoss: 'nope', wavesB: [], endBoss: 'grunt' } }),
    ).toThrow();
  });
});
