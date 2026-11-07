// T7.3 scenario: Level 4, the Alien warzone. Runs the real content through the full sim headless:
// an ordinary launch, ~90 s of dense Thargoid waves (several saucer variants, Thargons launched),
// no mid-boss, no trader, no part 2 — straight into the Thargoid mothership, then dock.
// [ROC-L4-0..4, ROC-ENM-6]

import { describe, it, expect } from 'vitest';
import enemiesJson from '../../src/content/enemies.json';
import level4Json from '../../src/content/level4.json';
import { createSim } from '../../src/sim/index.js';
import { loadContent } from '../../src/sim/content/loadContent.js';
import { emptyInput } from '../harness.js';
import { applyDamage } from '../../src/sim/systems/damage.js';
import { COMPLETION_BONUS } from '../../src/sim/systems/levelstate.js';

const DT = 1 / 120;

describe('Level 4', () => {
  it('is a single short wave section of varied Thargoids with no mid-boss', () => {
    const { levels } = loadContent({ enemies: enemiesJson, levels: [level4Json] });
    const level = levels[0];
    expect(level.name).toBe('Zaonce');
    expect(level.midBoss).toBeUndefined(); // [ROC-L4-4]
    expect(level.wavesB).toEqual([]);
    expect(level.endBoss).toBe('thargoid_mothership'); // [ROC-L4-2]
    const variants = new Set(level.wavesA.map((w) => w.enemy));
    expect(variants.size).toBeGreaterThanOrEqual(3); // several saucer variants [ROC-L4-1a]
    for (const v of variants) expect(v.startsWith('thargoid')).toBe(true);
  });

  it('plays launch -> 1:30 of waves -> mothership -> game complete, launching Thargons along the way', () => {
    const sim = createSim({ seed: 1, content: { enemies: enemiesJson, levels: [level4Json] } as never });
    const seq: string[] = [sim.state.levelState];
    let wavesStart = 0;
    let wavesSec = 0;
    let thargons = 0;
    let bossMesh: string | undefined;
    let complete: Record<string, unknown> | undefined;
    for (let f = 0; f < 120 * 60 * 4 && sim.state.levelState !== 'COMPLETE'; f++) {
      const w = sim.state;
      w.player.invulnTtl = 10; // a headless run: nothing here is about surviving
      if (w.levelState === 'END_BOSS') {
        for (const e of w.entities.values()) {
          if (e.kind === 'boss') {
            bossMesh = e.meshId;
            if ((e.hull ?? 0) > 0 && !e.dying && w.scroll === 0) {
              e.shield = 0; // kill it once it has arrived
              applyDamage(w, e, 1e6);
            }
          }
        }
      }
      const events = sim.step(emptyInput());
      thargons += events.filter((e) => e.type === 'thargonLaunched').length;
      complete ??= events.find((e) => e.type === 'gameComplete');
      if (sim.state.levelState !== seq[seq.length - 1]) {
        if (seq[seq.length - 1] === 'WAVES_A') wavesSec = (f - wavesStart) * DT;
        if (sim.state.levelState === 'WAVES_A') wavesStart = f;
        seq.push(sim.state.levelState);
      }
    }
    // The last level of the campaign: killing the mothership wins the game. [ROC-PROG-1]
    expect(seq).toEqual(['LAUNCH', 'HYPERSPACE', 'INFO', 'WAVES_A', 'END_BOSS', 'COMPLETE']);
    expect(sim.state.mode).toBe('COMPLETE');
    expect(sim.state.rating.rank).toBe('Elite'); // made Elite regardless of the tally
    expect(complete).toMatchObject({ type: 'gameComplete', bonus: COMPLETION_BONUS });
    expect(wavesSec).toBeGreaterThan(85);
    expect(wavesSec).toBeLessThan(97); // ~1.5 minutes [ROC-L4-4]
    expect(thargons).toBeGreaterThan(10); // [ROC-ENM-6]
    expect(bossMesh).toBe('thargoid_saucer');
  });
});
