// T7.1 scenario: Level 2 plays start -> dock, reaching both bosses (the Python mid-boss and the
// Constrictor end boss); the Constrictor's "abnormally strong shields" (ROC-L2-4) are asserted to
// exceed the Level 1 end boss's, which is otherwise the toughest shield in the game so far. Drives
// the real content + systems headless, same technique as the Level 1 scenario test.
// [ROC-L2-1..4]

import { describe, it, expect } from 'vitest';
import enemiesJson from '../../src/content/enemies.json';
import level2Json from '../../src/content/level2.json';
import { loadContent } from '../../src/sim/content/loadContent.js';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import { waveSystem } from '../../src/sim/systems/waves.js';
import { asteroidFieldSystem, asteroidSplitSystem } from '../../src/sim/systems/asteroids.js';
import { startLevel, levelStateSystem, enterLevelState } from '../../src/sim/systems/levelstate.js';
import { bossSystem } from '../../src/sim/systems/boss.js';
import { applyDamage, tickFlashes } from '../../src/sim/systems/damage.js';
import { dropsSystem } from '../../src/sim/systems/drops.js';

const DT = 1 / 120;

describe('Level 2', () => {
  it('plays through to dock, reaching the Python mid-boss and the Constrictor end boss', () => {
    const { enemies, levels } = loadContent({ enemies: enemiesJson, levels: [level2Json] });
    const level = levels[0];
    expect(level).toBeDefined();
    const ctx = { enemies };

    expect(enemies.constrictor.shield).toBeGreaterThan(enemies.fer_de_lance_boss.shield!); // [ROC-L2-4]

    const w = makeWorld(1);
    const rng = createRng(1);
    startLevel(w, level!, ctx);

    const states = new Set<string>([w.levelState]);
    let midBossMeshId: string | undefined;
    let endBossMeshId: string | undefined;
    let docked = false;

    for (let i = 0; i < 60000 && w.levelState !== 'DOCK'; i++) {
      w.events = [];
      waveSystem(w, rng, DT, ctx);
      asteroidFieldSystem(w, rng, DT);
      bossSystem(w, rng, DT, ctx); // Python/Constrictor both reuse the strafe boss ai
      levelStateSystem(w, DT, level!, ctx);
      for (const e of [...w.entities.values()]) {
        if (e.kind === 'enemy' || e.kind === 'boss' || e.kind === 'asteroid') applyDamage(w, e, 999); // player destroys it
      }
      tickFlashes(w, DT); // let a lethal hit's brief white-flash beat run out, same as a real step [ROC-DMG-6a]
      asteroidSplitSystem(w, rng);
      dropsSystem(w, rng);

      if (w.levelState === 'MID_BOSS' && !midBossMeshId) {
        const boss = [...w.entities.values()].find((e) => e.kind === 'boss');
        midBossMeshId = boss?.meshId;
      }
      if (w.levelState === 'END_BOSS' && !endBossMeshId) {
        const boss = [...w.entities.values()].find((e) => e.kind === 'boss');
        endBossMeshId = boss?.meshId;
      }

      // Fly straight into the aligned port once docking begins. [ROC-DCKG-3]
      if (w.levelState === 'DOCKING') {
        const st = [...w.entities.values()].find((e) => e.kind === 'station');
        const p = w.entities.get(PLAYER_ID);
        if (st && p) {
          st.bank = 0; // port level — inside the 30° tolerance [ROC-DCKG-3]
          p.pos = { ...st.pos };
        }
      }

      states.add(w.levelState);

      // Shop for nothing at the mid-level trader and leave straight away — recorded above first,
      // so a state entered and left within one iteration still shows up. [ROC-MDCK-1,2]
      if (w.levelState === 'MID_DOCK') enterLevelState(w, 'WAVES_B', level!, ctx);
      for (const ev of w.events) if (ev.type === 'dock') docked = true;
    }

    expect(w.levelState).toBe('DOCK');
    expect(states.has('HYPERSPACE')).toBe(true);
    expect(states.has('INFO')).toBe(true);
    expect(states.has('ASTEROIDS')).toBe(true); // dense opening field [ROC-L2-2]
    expect(states.has('MID_BOSS')).toBe(true);
    expect(states.has('MID_DOCK')).toBe(true); // mid-level trader stop [ROC-MDCK-1]
    expect(states.has('END_BOSS')).toBe(true);
    expect(states.has('DOCKING')).toBe(true);
    expect(midBossMeshId).toBe('python'); // [ROC-L2-3]
    expect(endBossMeshId).toBe('constrictor'); // [ROC-L2-4]
    expect(docked).toBe(true);
  });
});
