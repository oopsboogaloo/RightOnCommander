// Local high-score table, kept in the browser's storage through the Storage interface. Starts
// seeded with characters from Elite's world — the cast of Robert Holdstock's novella The Dark
// Wheel (packed with the original game) and Commander Jameson, Elite's default commander — so
// the table is never empty. [ROC-LBD-1,1a]

import type { Storage } from '../interfaces.js';

export interface HighScore {
  name: string;
  score: number;
  rank: string; // combat rating reached
}

export const TABLE_SIZE = 8;
export const MAX_NAME = 14; // fits "Elyssia Fields"
// v2: the seeded scores were raised (top 80,000 -> 120,000) after playtesting showed a full run
// beat them too easily. A new key, so a browser's saved table picks up the new seeds; the
// player's own entries are carried over from the old key (see loadHighScores).
export const HIGH_SCORES_KEY = 'roc.highScores.v2';
export const OLD_HIGH_SCORES_KEY = 'roc.highScores';

export const DEFAULT_HIGH_SCORES: HighScore[] = [
  { name: 'Rafe Zetter', score: 120000, rank: 'Elite' },
  { name: 'Jason Ryder', score: 90000, rank: 'Deadly' },
  { name: 'Elyssia Fields', score: 67500, rank: 'Deadly' },
  { name: 'Alex Ryder', score: 45000, rank: 'Dangerous' },
  { name: 'P. McGreavy', score: 22500, rank: 'Competent' },
  { name: 'Jameson', score: 7500, rank: 'Average' },
];

// The seeds the v1 table shipped with — dropped when migrating, so only real entries carry over.
const OLD_DEFAULT_HIGH_SCORES: HighScore[] = [
  { name: 'Rafe Zetter', score: 80000, rank: 'Elite' },
  { name: 'Jason Ryder', score: 60000, rank: 'Deadly' },
  { name: 'Elyssia Fields', score: 45000, rank: 'Deadly' },
  { name: 'Alex Ryder', score: 30000, rank: 'Dangerous' },
  { name: 'P. McGreavy', score: 15000, rank: 'Competent' },
  { name: 'Jameson', score: 5000, rank: 'Average' },
];

const isEntry = (v: unknown): v is HighScore =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as HighScore).name === 'string' &&
  typeof (v as HighScore).score === 'number' &&
  Number.isFinite((v as HighScore).score) &&
  typeof (v as HighScore).rank === 'string';

const sorted = (table: HighScore[]): HighScore[] => [...table].sort((a, b) => b.score - a.score).slice(0, TABLE_SIZE);

const validEntries = (raw: unknown): HighScore[] =>
  Array.isArray(raw) ? raw.filter(isEntry).map((e) => ({ name: e.name.slice(0, MAX_NAME), score: e.score, rank: e.rank })) : [];

// The saved table, or the seeded one if nothing valid is stored. A browser that only has the old
// (v1) table gets the new seeds plus its own entries from it — the old seeds are left behind.
export function loadHighScores(storage: Storage): HighScore[] {
  const current = validEntries(storage.load(HIGH_SCORES_KEY));
  if (current.length) return sorted(current);
  const isOldSeed = (e: HighScore): boolean => OLD_DEFAULT_HIGH_SCORES.some((d) => d.name === e.name && d.score === e.score);
  const carried = validEntries(storage.load(OLD_HIGH_SCORES_KEY)).filter((e) => !isOldSeed(e));
  return sorted([...DEFAULT_HIGH_SCORES, ...carried]);
}

export function saveHighScores(storage: Storage, table: HighScore[]): void {
  storage.save(HIGH_SCORES_KEY, sorted(table));
}

// Does this score earn a place on the table?
export function qualifies(table: HighScore[], score: number): boolean {
  if (score <= 0) return false;
  return table.length < TABLE_SIZE || score > table[table.length - 1].score;
}

// The table with this entry added in score order (ties go below existing entries), and the
// 0-based row it landed on (-1 if it didn't make the cut).
export function insertScore(table: HighScore[], entry: HighScore): { table: HighScore[]; row: number } {
  const clean = { ...entry, name: (entry.name.trim() || 'Jameson').slice(0, MAX_NAME) };
  const next = [...table];
  let row = next.findIndex((e) => clean.score > e.score);
  if (row < 0) row = next.length;
  next.splice(row, 0, clean);
  const cut = next.slice(0, TABLE_SIZE);
  return { table: cut, row: row < TABLE_SIZE ? row : -1 };
}
