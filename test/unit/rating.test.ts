// T6.3: combat rating — a kill tally kept apart from credits, weighted by bounty, driving the
// Harmless -> Elite ladder. Elite sits at 60% of every point the campaign can award; each
// promotion pays its bonus once and emits `rankUp`; Elite is flagged for "RIGHT ON, COMMANDER!".
// [ROC-RTG-1,2,3]

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import enemiesJson from '../../src/content/enemies.json';
import level1Json from '../../src/content/level1.json';
import level2Json from '../../src/content/level2.json';
import level3Json from '../../src/content/level3.json';
import level4Json from '../../src/content/level4.json';
import { loadContent } from '../../src/sim/content/loadContent.js';
import { makeWorld, type World } from '../../src/sim/world.js';
import {
  ratingSystem,
  buildRanks,
  campaignPoints,
  killPoints,
  rankFor,
  ELITE,
  ELITE_SHARE,
  RANK_TABLE,
} from '../../src/sim/systems/rating.js';

const ranks = buildRanks(1000); // Elite at 600 points

function kill(w: World, bounty: number, kind = 'enemy'): void {
  w.events.push({ type: 'destroyed', kind, bounty });
}
const rankUps = (w: World) => w.events.filter((e) => e.type === 'rankUp');

describe('rating ladder', () => {
  it("uses Elite's rank names in order, each threshold and bonus higher than the last", () => {
    expect(ranks.map((r) => r.name)).toEqual([
      'Harmless', 'Mostly Harmless', 'Poor', 'Average', 'Above Average', 'Competent', 'Dangerous', 'Deadly', 'Elite',
    ]);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i].points).toBeGreaterThan(ranks[i - 1].points);
      expect(ranks[i].bonus).toBeGreaterThan(ranks[i - 1].bonus);
    }
    expect(ranks[1].points).toBe(1); // Mostly Harmless on the first kill
    expect(ranks[ranks.length - 1].points).toBe(600); // Elite at 60%
  });

  it('puts Elite at 60% of every point the real campaign can award', () => {
    const { enemies, levels } = loadContent({ enemies: enemiesJson, levels: [level1Json, level2Json, level3Json, level4Json] });
    const total = campaignPoints(levels, enemies);
    expect(total).toBeGreaterThan(1000);
    const real = buildRanks(total);
    expect(rankFor(real, Math.round(total * ELITE_SHARE)).name).toBe(ELITE);
    expect(rankFor(real, Math.round(total * ELITE_SHARE) - 1).name).toBe('Deadly');
  });

  it('weights tougher (higher-bounty) kills more', () => {
    expect(killPoints(10)).toBe(1); // a Sidewinder
    expect(killPoints(300)).toBe(7); // a Thargoid
    expect(killPoints(5000)).toBe(101); // the mothership
  });

  it('keeps thresholds strictly rising even for a tiny campaign', () => {
    const tiny = buildRanks(3);
    for (let i = 1; i < tiny.length; i++) expect(tiny[i].points).toBeGreaterThan(tiny[i - 1].points);
    expect(tiny).toHaveLength(RANK_TABLE.length);
  });
});

describe('ratingSystem', () => {
  it('promotes on the first kill and pays the bonus into wallet and score', () => {
    const w = makeWorld(1);
    kill(w, 10);
    ratingSystem(w, ranks);
    expect(w.rating.kills).toBe(1);
    expect(w.rating.rank).toBe('Mostly Harmless');
    expect(w.econ.wallet).toBe(ranks[1].bonus);
    expect(w.econ.score).toBe(ranks[1].bonus);
    expect(rankUps(w)).toEqual([{ type: 'rankUp', rank: 'Mostly Harmless', bonus: ranks[1].bonus, elite: false }]);
  });

  it('steps through every rank crossed in one go, paying each bonus once', () => {
    const w = makeWorld(1);
    kill(w, 50 * (ranks[5].points - 1)); // exactly Competent's points
    ratingSystem(w, ranks);
    expect(w.rating.rank).toBe('Competent');
    expect(rankUps(w).map((e) => e.rank)).toEqual(['Mostly Harmless', 'Poor', 'Average', 'Above Average', 'Competent']);
    expect(w.econ.wallet).toBe(100 + 200 + 300 + 500 + 1000);
    w.events = [];
    ratingSystem(w, ranks); // nothing new destroyed: no repeat
    expect(rankUps(w)).toHaveLength(0);
  });

  it('ignores asteroids and the player', () => {
    const w = makeWorld(1);
    kill(w, 0, 'asteroid');
    kill(w, 0, 'player');
    ratingSystem(w, ranks);
    expect(w.rating.kills).toBe(0);
    expect(w.rating.rank).toBe('Harmless');
  });

  it('flags Elite for "RIGHT ON, COMMANDER!"', () => {
    const w = makeWorld(1);
    w.rating = { kills: 500, weightedTally: ranks[8].points - 1, rank: 'Deadly' };
    kill(w, 10);
    ratingSystem(w, ranks);
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
          ratingSystem(w, ranks);
          expect(w.rating.weightedTally).toBeGreaterThanOrEqual(prev);
          prev = w.rating.weightedTally;
          awarded.push(...rankUps(w).map((e) => String(e.rank)));
        }
        expect(new Set(awarded).size).toBe(awarded.length);
        expect(w.rating.rank).toBe(rankFor(ranks, w.rating.weightedTally).name);
      }),
    );
  });
});
