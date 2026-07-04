// T7.2 scenario: Level 3 plays start -> dock, reaching both Anacondas of the mid-boss pair and
// the Cobra-ace end boss (an Elite-rated pilot in a fully-kitted Cobra Mk III, v1.11 — replacing
// the originally-planned generation ship so every boss stays a real Elite hull). Drives the real
// content + systems headless, same technique as the Level 1/2 scenario tests.
// [ROC-L3-1..4]

import { describe, it, expect } from 'vitest';
import enemiesJson from '../../src/content/enemies.json';
import level3Json from '../../src/content/level3.json';
import { loadContent } from '../../src/sim/content/loadContent.js';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import { waveSystem } from '../../src/sim/systems/waves.js';
import { asteroidFieldSystem, asteroidSplitSystem } from '../../src/sim/systems/asteroids.js';
import { startLevel, levelStateSystem } from '../../src/sim/systems/levelstate.js';
import { bossSystem } from '../../src/sim/systems/boss.js';
import { hazardsSystem } from '../../src/sim/systems/hazards.js';
import { applyDamage } from '../../src/sim/systems/damage.js';
import { dropsSystem } from '../../src/sim/systems/drops.js';

const DT = 1 / 120;

describe('Level 3', () => {
  it('plays through to dock, fighting both Anacondas and the Cobra-ace end boss', () => {
    const { enemies, levels } = loadContent({ enemies: enemiesJson, levels: [level3Json] });
    const level = levels[0];
    expect(level).toBeDefined();
    expect(level.midBoss).toEqual(['anaconda', 'anaconda']); // [ROC-L3-3]
    expect(level.endBoss).toBe('cobra_ace'); // [ROC-L3-4]
    const ctx = { enemies };

    const w = makeWorld(1);
    const rng = createRng(1);
    startLevel(w, level, ctx);

    const states = new Set<string>([w.levelState]);
    let maxMidBosses = 0;
    let endBossMeshId: string | undefined;
    let docked = false;

    for (let i = 0; i < 60000 && w.levelState !== 'DOCK'; i++) {
      w.events = [];
      waveSystem(w, rng, DT, ctx);
      asteroidFieldSystem(w, rng, DT);
      bossSystem(w, rng, DT, ctx);
      levelStateSystem(w, DT, level, ctx);
      hazardsSystem(w, DT, level.starFlare);
      for (const e of [...w.entities.values()]) {
        if (e.kind === 'enemy' || e.kind === 'asteroid') applyDamage(w, e, 999); // player destroys it
      }

      if (w.levelState === 'MID_BOSS') {
        const bosses = [...w.entities.values()].filter((e) => e.kind === 'boss');
        maxMidBosses = Math.max(maxMidBosses, bosses.length);
        // Kill just one boss per frame so the "both reached, not just one" assertion is real.
        if (bosses.length > 0) applyDamage(w, bosses[0], 999);
      }
      if (w.levelState === 'END_BOSS') {
        const boss = [...w.entities.values()].find((e) => e.kind === 'boss');
        if (boss) {
          endBossMeshId = boss.meshId;
          applyDamage(w, boss, 999);
        }
      }

      asteroidSplitSystem(w, rng);
      dropsSystem(w, rng);

      // Fly straight into the aligned port once docking begins. [ROC-DCKG-3]
      if (w.levelState === 'DOCKING') {
        const st = [...w.entities.values()].find((e) => e.kind === 'station');
        const p = w.entities.get(PLAYER_ID);
        if (st && p) {
          st.bank = 0;
          p.pos = { ...st.pos };
        }
      }

      states.add(w.levelState);
      for (const ev of w.events) if (ev.type === 'dock') docked = true;
    }

    expect(w.levelState).toBe('DOCK');
    expect(states.has('HYPERSPACE')).toBe(true);
    expect(states.has('INFO')).toBe(true);
    expect(states.has('MID_BOSS')).toBe(true);
    expect(states.has('END_BOSS')).toBe(true);
    expect(states.has('DOCKING')).toBe(true);
    expect(maxMidBosses).toBe(2); // both Anacondas spawned together [ROC-L3-3]
    expect(endBossMeshId).toBe('cobra_mk3'); // the ace flies a real Elite hull [ROC-L3-4]
    expect(docked).toBe(true);
  });
});
