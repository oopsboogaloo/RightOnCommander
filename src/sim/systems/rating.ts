// Combat rating: Elite's Harmless -> Elite ladder, driven by a kill tally kept separately from
// credits. Every ship destroyed adds points, more for tougher ships (1, plus 1 per 50cr of
// bounty — so bosses and Thargoids count most). Crossing a threshold promotes the commander one
// rank, pays a credit bonus, and emits `rankUp` for the shell to flash on screen; reaching Elite
// says "RIGHT ON, COMMANDER!". [ROC-RTG-1,2,3]
//
// The thresholds keep the ratios of the original BBC Elite ladder (0, 8, 16, 32, 64, 128, 512,
// 2560, 6400 kills) scaled by 1/6.4, so Elite (1000 points) takes an excellent full campaign
// rather than thousands of kills.

import type { World } from '../world.js';

export interface Rank {
  name: string;
  points: number; // tally needed to hold this rank
  bonus: number; // credits paid on reaching it
}

export const RANKS: Rank[] = [
  { name: 'Harmless', points: 0, bonus: 0 },
  { name: 'Mostly Harmless', points: 1, bonus: 100 },
  { name: 'Poor', points: 3, bonus: 200 },
  { name: 'Average', points: 5, bonus: 300 },
  { name: 'Above Average', points: 10, bonus: 500 },
  { name: 'Competent', points: 20, bonus: 1000 },
  { name: 'Dangerous', points: 80, bonus: 2500 },
  { name: 'Deadly', points: 400, bonus: 5000 },
  { name: 'Elite', points: 1000, bonus: 10000 },
];

export const ELITE = RANKS[RANKS.length - 1].name;
const BOUNTY_PER_POINT = 50;

// Points for one kill: 1, plus 1 per 50cr of bounty (tougher ships carry bigger bounties).
export const killPoints = (bounty: number): number => 1 + Math.floor(Math.max(0, bounty) / BOUNTY_PER_POINT);

// The rank held at a given tally.
export function rankFor(tally: number): Rank {
  let r = RANKS[0];
  for (const rank of RANKS) if (tally >= rank.points) r = rank;
  return r;
}

// Tally every ship destroyed this step (damage's `destroyed` events) and promote through every
// threshold crossed, paying each rank's bonus once. Runs after economySystem.
export function ratingSystem(world: World): void {
  const rating = world.rating;
  for (const ev of world.events.filter((e) => e.type === 'destroyed')) {
    if (ev.kind !== 'enemy' && ev.kind !== 'boss') continue;
    rating.kills += 1;
    rating.weightedTally += killPoints(typeof ev.bounty === 'number' ? ev.bounty : 0);
  }

  let idx = RANKS.findIndex((r) => r.name === rating.rank);
  if (idx < 0) idx = 0;
  while (idx + 1 < RANKS.length && rating.weightedTally >= RANKS[idx + 1].points) {
    idx += 1;
    const rank = RANKS[idx];
    rating.rank = rank.name;
    world.econ.wallet += rank.bonus;
    world.econ.score += rank.bonus;
    world.events.push({ type: 'rankUp', rank: rank.name, bonus: rank.bonus, elite: rank.name === ELITE });
  }
}
