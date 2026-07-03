// T5.2/T5a scenario: Level 1 plays start -> dock, reaching both bosses; the hermit drops the
// guaranteed laser plus its cargo haul and bounty. Drives the real content + systems headless,
// with the player destroying everything and then docking through the aligned port.
// [ROC-L1-1..5, ROC-PWR-6, ROC-HERM-10, ROC-DCKG-3]

import { describe, it, expect } from 'vitest';
import enemiesJson from '../../src/content/enemies.json';
import level1Json from '../../src/content/level1.json';
import { loadContent } from '../../src/sim/content/loadContent.js';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import { waveSystem } from '../../src/sim/systems/waves.js';
import { asteroidFieldSystem, asteroidSplitSystem } from '../../src/sim/systems/asteroids.js';
import { startLevel, levelStateSystem } from '../../src/sim/systems/levelstate.js';
import { bossSystem } from '../../src/sim/systems/boss.js';
import { applyDamage } from '../../src/sim/systems/damage.js';
import { dropsSystem } from '../../src/sim/systems/drops.js';

const DT = 1 / 120;

describe('Level 1', () => {
  it('plays through to dock, reaching both bosses and dropping a laser', () => {
    const { enemies, level } = loadContent({ enemies: enemiesJson, level: level1Json });
    expect(level).toBeDefined();
    const ctx = { enemies };

    const w = makeWorld(1);
    const rng = createRng(1);
    startLevel(w, level!, ctx);

    const states = new Set<string>([w.levelState]);
    let laserDropped = false;
    let hermitBounty = 0;
    let docked = false;

    for (let i = 0; i < 60000 && w.levelState !== 'DOCK'; i++) {
      w.events = [];
      waveSystem(w, rng, DT, ctx);
      asteroidFieldSystem(w, rng, DT);
      bossSystem(w, rng, DT, ctx); // hermit escorts + record close, FdL strafe [ROC-HERM-*, ROC-FDL-*]
      levelStateSystem(w, DT, level!, ctx);
      for (const e of [...w.entities.values()]) {
        if (e.kind === 'enemy' || e.kind === 'boss' || e.kind === 'asteroid') applyDamage(w, e, 999); // player destroys it
      }
      asteroidSplitSystem(w, rng);
      dropsSystem(w, rng);

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
      if ([...w.entities.values()].some((e) => e.kind === 'pickup' && e.pickup?.type === 'laser')) laserDropped = true;
      for (const ev of w.events) {
        if (ev.type === 'destroyed' && ev.meshId === 'rock_hermit' && ev.kind === 'boss') hermitBounty = ev.bounty as number;
        if (ev.type === 'dock') docked = true;
      }
    }

    expect(w.levelState).toBe('DOCK');
    expect(states.has('HYPERSPACE')).toBe(true); // launch jump [ROC-HYP-2]
    expect(states.has('INFO')).toBe(true); // system facts card [ROC-HYP-5]
    expect(states.has('ASTEROIDS')).toBe(true); // opening asteroid field [ROC-L1-1]
    expect(states.has('MID_BOSS')).toBe(true);
    expect(states.has('END_BOSS')).toBe(true);
    expect(states.has('DOCKING')).toBe(true); // station approach [ROC-DCKG-1]
    expect(laserDropped).toBe(true); // guaranteed mid-boss laser [ROC-PWR-6]
    expect(hermitBounty).toBe(1000); // hermit kill award [ROC-HERM-10]
    expect(docked).toBe(true);
  });
});
