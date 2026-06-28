// T3.3: bounty awards both counters, spends reduce only the wallet, and the two diverge
// correctly across a mix of kills and purchases. [ROC-ECO-1,2]

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import { awardBounty, economySystem, spend, canAfford } from '../../src/sim/systems/economy.js';

describe('economy', () => {
  it('bounty raises both wallet and score and emits floating text', () => {
    const w = makeWorld(1);
    awardBounty(w, 50, vec3(1, 0, 2));
    expect(w.econ.wallet).toBe(50);
    expect(w.econ.score).toBe(50);
    const text = w.events.find((e) => e.type === 'floatingText');
    expect(text?.text).toBe('+50');
    expect(text?.category).toBe('bounty');
  });

  it('spend reduces the wallet but never the score', () => {
    const w = makeWorld(1);
    awardBounty(w, 100);
    expect(spend(w, 30)).toBe(true);
    expect(w.econ.wallet).toBe(70);
    expect(w.econ.score).toBe(100); // lifetime gross unchanged
  });

  it('disallows overspending', () => {
    const w = makeWorld(1);
    awardBounty(w, 20);
    expect(canAfford(w, 25)).toBe(false);
    expect(spend(w, 25)).toBe(false);
    expect(w.econ.wallet).toBe(20);
  });

  it('wallet and score diverge correctly across kills and spends', () => {
    const w = makeWorld(1);
    awardBounty(w, 40);
    awardBounty(w, 60);
    spend(w, 25);
    awardBounty(w, 10);
    spend(w, 35);
    // earned 110, spent 60
    expect(w.econ.score).toBe(110);
    expect(w.econ.wallet).toBe(50);
  });

  it('economySystem awards bounty for each destroyed event this step', () => {
    const w = makeWorld(1);
    w.events.push({ type: 'destroyed', id: 7, kind: 'enemy', pos: vec3(0, 0, 1), bounty: 25 });
    w.events.push({ type: 'destroyed', id: 8, kind: 'enemy', pos: vec3(0, 0, 2), bounty: 15 });
    economySystem(w);
    expect(w.econ.wallet).toBe(40);
    expect(w.econ.score).toBe(40);
    expect(w.events.filter((e) => e.type === 'floatingText').length).toBe(2);
  });
});
