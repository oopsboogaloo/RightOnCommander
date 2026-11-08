// Combat rating: Elite's Harmless -> Elite ladder, driven by a kill tally kept separately from
// credits. Every ship destroyed adds points, more for tougher ships (1, plus 1 per 50cr of
// bounty — so bosses and Thargoids count most). Crossing a threshold promotes the commander one
// rank, pays a credit bonus, and emits `rankUp` for the shell to flash on screen; reaching Elite
// says "RIGHT ON, COMMANDER!". [ROC-RTG-1,2,3]
//
// Thresholds come from the campaign itself: Elite is ELITE_SHARE (75%) of every point the levels
// can award (all wave members, the witchspace wave and every boss), so a commander who destroys
// about three-quarters of everything reaches Elite by the end of the last level. The other ranks
// sit at set fractions of that, spread so promotions keep coming through the whole campaign
// rather than bunching up in Level 1. (v1.18: raised 25% from 60%, early ranks spread out, after
// playtesting reached Elite too soon and most ranks within Level 1.)

import type { World } from '../world.js';
import type { EnemyDef } from './waves.js';
import type { LevelDef } from './levelstate.js';

export interface Rank {
  name: string;
  points: number; // tally needed to hold this rank
  bonus: number; // credits paid on reaching it
}

// Each rank's threshold as a fraction of Elite's (Mostly Harmless: the first kill), and its bonus.
export const RANK_TABLE: { name: string; share: number; bonus: number }[] = [
  { name: 'Harmless', share: 0, bonus: 0 },
  { name: 'Mostly Harmless', share: 0.02, bonus: 100 },
  { name: 'Poor', share: 0.06, bonus: 200 },
  { name: 'Average', share: 0.12, bonus: 300 },
  { name: 'Above Average', share: 0.2, bonus: 500 },
  { name: 'Competent', share: 0.3, bonus: 1000 },
  { name: 'Dangerous', share: 0.45, bonus: 2500 },
  { name: 'Deadly', share: 0.65, bonus: 5000 },
  { name: 'Elite', share: 1, bonus: 10000 },
];

export const ELITE = 'Elite';
export const ELITE_SHARE = 0.75; // of all campaign points
const BOUNTY_PER_POINT = 50;

// Points for one kill: 1, plus 1 per 50cr of bounty (tougher ships carry bigger bounties).
export const killPoints = (bounty: number): number => 1 + Math.floor(Math.max(0, bounty) / BOUNTY_PER_POINT);

// Every point the campaign can award if every enemy it spawns is destroyed: all wave members
// (both halves and the witchspace wave) and every boss. Open-ended extras — hermit escorts,
// Thargons — are left out, so the estimate never assumes them.
export function campaignPoints(levels: LevelDef[], enemies: Record<string, EnemyDef>): number {
  const pts = (name: string): number => killPoints(enemies[name]?.bounty ?? 0);
  let total = 0;
  for (const lvl of levels) {
    const waves = [...lvl.wavesA, ...lvl.wavesB, ...(lvl.witchspace ? [lvl.witchspace] : [])];
    for (const w of waves) total += w.count * pts(w.enemy);
    const mids = lvl.midBoss === undefined ? [] : Array.isArray(lvl.midBoss) ? lvl.midBoss : [lvl.midBoss];
    for (const b of [...mids, lvl.endBoss]) total += pts(b);
  }
  return total;
}

// The ladder for a campaign worth `totalPoints`: Elite at ELITE_SHARE of it, the rest at their
// shares of Elite (never below the rank beneath, and at least the first kill).
export function buildRanks(totalPoints: number): Rank[] {
  const elite = Math.max(RANK_TABLE.length, Math.round(totalPoints * ELITE_SHARE));
  const ranks: Rank[] = [];
  RANK_TABLE.forEach((r, i) => {
    const want = i === 0 ? 0 : Math.max(1, Math.round(r.share * elite));
    const points = i === 0 ? 0 : Math.max(want, ranks[i - 1].points + 1);
    ranks.push({ name: r.name, points, bonus: r.bonus });
  });
  return ranks;
}

// The rank held at a given tally.
export function rankFor(ranks: Rank[], tally: number): Rank {
  let r = ranks[0];
  for (const rank of ranks) if (tally >= rank.points) r = rank;
  return r;
}

// Tally every ship destroyed this step (damage's `destroyed` events) and promote through every
// threshold crossed, paying each rank's bonus once. Runs after economySystem.
export function ratingSystem(world: World, ranks: Rank[]): void {
  const rating = world.rating;
  for (const ev of world.events.filter((e) => e.type === 'destroyed')) {
    if (ev.kind !== 'enemy' && ev.kind !== 'boss') continue;
    rating.kills += 1;
    rating.weightedTally += killPoints(typeof ev.bounty === 'number' ? ev.bounty : 0);
  }

  let idx = ranks.findIndex((r) => r.name === rating.rank);
  if (idx < 0) idx = 0;
  while (idx + 1 < ranks.length && rating.weightedTally >= ranks[idx + 1].points) {
    idx += 1;
    const rank = ranks[idx];
    rating.rank = rank.name;
    world.econ.wallet += rank.bonus;
    world.econ.score += rank.bonus;
    world.events.push({ type: 'rankUp', rank: rank.name, bonus: rank.bonus, elite: rank.name === ELITE });
  }
}
