// T6.3: combat rating — a kill tally kept apart from credits, weighted by bounty, driving the
// Harmless -> Elite ladder; each promotion pays its bonus once and emits `rankUp`; Elite is
// flagged for "RIGHT ON, COMMANDER!". [ROC-RTG-1,2,3]

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { makeWorld, type World } from '../../src/sim/world.js';
import { ratingSystem, RANKS, killPoints, rankFor, ELITE } from '../../src/sim/systems/rating.js';

function kill(w: World, bounty: number, kind = 'enemy'): void {
  w.events.push({ type: 'destroyed', kind, bounty });
}
const rankUps = (w: World) => w.events.filter((e) => e.type === 'rankUp');

describe('rating ladder', () => {
  it('follows Elite\'s ranks in order, each threshold higher than the last', () => {
    expect(RANKS.map((r) => r.name)).toEqual([
      'Harmless', 'Mostly Harmless', 'Poor', 'Average', 'Above Average', 'Competent', 'Dangerous', 'Deadly', 'Elite',
    ]);
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].points).toBeGreaterThan(RANKS[i - 1].points);
      expect(RANKS[i].bonus).toBeGreaterThan(RANKS[i - 1].bonus);
    }
  });

  it('weights tougher (higher-bounty) kills more', () => {
    expect(killPoints(10)).toBe(1); // a Sidewinder
    expect(killPoints(300)).toBe(7); // a Thargoid
    expect(killPoints(5000)).toBe(101); // the mothership
    expect(rankFor(0).name).toBe('Harmless');
    expect(rankFor(1000).name).toBe(ELITE);
  });
});

describe('ratingSystem', () => {
  it('promotes on the first kill and pays the bonus into wallet and score', () => {
    const w = makeWorld(1);
    kill(w, 10);
    ratingSystem(w);
    expect(w.rating.kills).toBe(1);
    expect(w.rating.rank).toBe('Mostly Harmless');
    expect(w.econ.wallet).toBe(RANKS[1].bonus);
    expect(w.econ.score).toBe(RANKS[1].bonus);
    expect(rankUps(w)).toEqual([{ type: 'rankUp', rank: 'Mostly Harmless', bonus: RANKS[1].bonus, elite: false }]);
  });

  it('steps through every rank crossed in one go, paying each bonus once', () => {
    const w = makeWorld(1);
    kill(w, 950); // 20 points: straight to Competent
    ratingSystem(w);
    expect(w.rating.rank).toBe('Competent');
    expect(rankUps(w).map((e) => e.rank)).toEqual(['Mostly Harmless', 'Poor', 'Average', 'Above Average', 'Competent']);
    expect(w.econ.wallet).toBe(100 + 200 + 300 + 500 + 1000);
    w.events = [];
    ratingSystem(w); // nothing new destroyed: no repeat
    expect(rankUps(w)).toHaveLength(0);
  });

  it('ignores asteroids and the player', () => {
    const w = makeWorld(1);
    kill(w, 0, 'asteroid');
    kill(w, 0, 'player');
    ratingSystem(w);
    expect(w.rating.kills).toBe(0);
    expect(w.rating.rank).toBe('Harmless');
  });

  it('flags Elite for "RIGHT ON, COMMANDER!"', () => {
    const w = makeWorld(1);
    w.rating = { kills: 500, weightedTally: 999, rank: 'Deadly' };
    kill(w, 10);
    ratingSystem(w);
    expect(w.rating.rank).toBe(ELITE);
    expect(rankUps(w)).toEqual([{ type: 'rankUp', rank: ELITE, bonus: 10000, elite: true }]);
  });

  it('property: the tally never falls, and every rank is awarded at most once', () => {
    fc.assert(
      fc.property(fc.array(fc.array(fc.integer({ min: 0, max: 6000 }), { maxLength: 8 }), { maxLength: 60 }), (steps) => {
        const w = makeWorld(1);
        const awarded: string[] = [];
        let prev = 0;
        for (const bounties of steps) {
          w.events = [];
          for (const b of bounties) kill(w, b);
          ratingSystem(w);
          expect(w.rating.weightedTally).toBeGreaterThanOrEqual(prev);
          prev = w.rating.weightedTally;
          awarded.push(...rankUps(w).map((e) => String(e.rank)));
        }
        expect(new Set(awarded).size).toBe(awarded.length);
        expect(w.rating.rank).toBe(rankFor(w.rating.weightedTally).name);
      }),
    );
  });
});
