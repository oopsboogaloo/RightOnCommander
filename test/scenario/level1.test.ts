// T5.2 scenario: Level 1 plays start -> dock, reaching both bosses, and the mid-boss always
// drops a laser. Drives the real content + systems headless, with the player destroying
// everything. [ROC-L1-1..5, ROC-PWR-6]

import { describe, it, expect } from 'vitest';
import enemiesJson from '../../src/content/enemies.json';
import level1Json from '../../src/content/level1.json';
import { loadContent } from '../../src/sim/content/loadContent.js';
import { makeWorld } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import { waveSystem } from '../../src/sim/systems/waves.js';
import { asteroidFieldSystem, asteroidSplitSystem } from '../../src/sim/systems/asteroids.js';
import { startLevel, levelStateSystem } from '../../src/sim/systems/levelstate.js';
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
    let docked = false;

    for (let i = 0; i < 30000 && w.levelState !== 'DOCK'; i++) {
      w.events = [];
      waveSystem(w, rng, DT, ctx);
      asteroidFieldSystem(w, rng, DT);
      levelStateSystem(w, DT, level!, ctx);
      for (const e of [...w.entities.values()]) {
        if (e.kind === 'enemy' || e.kind === 'boss' || e.kind === 'asteroid') applyDamage(w, e, 999); // player destroys it
      }
      asteroidSplitSystem(w, rng);
      dropsSystem(w, rng);

      states.add(w.levelState);
      if ([...w.entities.values()].some((e) => e.kind === 'pickup' && e.pickup?.type === 'laser')) laserDropped = true;
      if (w.events.some((e) => e.type === 'dock')) docked = true;
    }

    expect(w.levelState).toBe('DOCK');
    expect(states.has('ASTEROIDS')).toBe(true); // opening asteroid field [ROC-L1-1]
    expect(states.has('MID_BOSS')).toBe(true);
    expect(states.has('END_BOSS')).toBe(true);
    expect(laserDropped).toBe(true); // guaranteed mid-boss laser [ROC-PWR-6]
    expect(docked).toBe(true);
  });
});
