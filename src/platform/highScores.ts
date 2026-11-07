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
export const HIGH_SCORES_KEY = 'roc.highScores';

export const DEFAULT_HIGH_SCORES: HighScore[] = [
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

// The saved table, or the seeded one if nothing valid is stored.
export function loadHighScores(storage: Storage): HighScore[] {
  const raw = storage.load(HIGH_SCORES_KEY);
  if (!Array.isArray(raw)) return sorted(DEFAULT_HIGH_SCORES);
  const valid = raw.filter(isEntry).map((e) => ({ name: e.name.slice(0, MAX_NAME), score: e.score, rank: e.rank }));
  return valid.length ? sorted(valid) : sorted(DEFAULT_HIGH_SCORES);
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
