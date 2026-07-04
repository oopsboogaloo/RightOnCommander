// T7.2: Level 3's star flare — a slow, telegraphed environmental hazard. It warns for `warnSec`
// before landing, then damages the player only if they're still in the danger zone (x > zoneX)
// at that instant — dodgeable, like enemy fire (ROC-ENM-11 precedent). [ROC-L3-1,2]

import { describe, it, expect } from 'vitest';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import { initHazard, hazardsSystem, type StarFlareDef } from '../../src/sim/systems/hazards.js';

const DT = 1 / 120;

const def: StarFlareDef = { intervalSec: 2, warnSec: 0.5, zoneX: 0.9, damage: 1 };

function run(w: ReturnType<typeof makeWorld>, sec: number): void {
  for (let i = 0; i < Math.round(sec / DT); i++) hazardsSystem(w, DT, def);
}

describe('star flare hazard', () => {
  it('does nothing when the level has no star flare', () => {
    const w = makeWorld(1);
    w.hazard = null;
    run(w, 10);
    expect(w.events.length).toBe(0);
  });

  it('warns after intervalSec, then lands warnSec later', () => {
    const w = makeWorld(1);
    w.hazard = initHazard(def);
    run(w, def.intervalSec - 0.01);
    expect(w.events.some((e) => e.type === 'starFlareWarn')).toBe(false);
    w.events = [];
    run(w, 0.02); // crosses intervalSec
    expect(w.events.some((e) => e.type === 'starFlareWarn')).toBe(true);
    expect(w.hazard!.warnTtl).toBeGreaterThan(0);
  });

  it('hits the player if they are in the danger zone when the flare lands', () => {
    const w = makeWorld(1);
    w.hazard = initHazard(def);
    const p = w.entities.get(PLAYER_ID)!;
    p.pos.x = 1.2; // inside the danger zone (> zoneX)
    const shieldBefore = p.shield;
    run(w, def.intervalSec + def.warnSec + 0.01);
    expect(w.events.some((e) => e.type === 'starFlareHit')).toBe(true);
    expect(p.shield).toBe((shieldBefore ?? 0) - 1); // one ring gone, same rule as any other hit
  });

  it('spares the player outside the danger zone', () => {
    const w = makeWorld(1);
    w.hazard = initHazard(def);
    const p = w.entities.get(PLAYER_ID)!;
    p.pos.x = 0; // well clear of the star
    const shieldBefore = p.shield;
    run(w, def.intervalSec + def.warnSec + 0.01);
    expect(w.events.some((e) => e.type === 'starFlareHit')).toBe(false);
    expect(p.shield).toBe(shieldBefore);
  });

  it('resets the timer and repeats', () => {
    const w = makeWorld(1);
    w.hazard = initHazard(def);
    run(w, def.intervalSec + def.warnSec + 0.01);
    w.events = [];
    run(w, def.intervalSec - 0.01);
    expect(w.events.some((e) => e.type === 'starFlareWarn')).toBe(false);
    run(w, 0.02);
    expect(w.events.some((e) => e.type === 'starFlareWarn')).toBe(true);
  });
});
