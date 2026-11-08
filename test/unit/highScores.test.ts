// High-score table: seeded with Elite characters, persisted through the Storage interface,
// with qualification + insertion rules; and the name-entry keyboard's key handling.
// [ROC-LBD-1,1a]

import { describe, it, expect } from 'vitest';
import type { Storage } from '../../src/interfaces.js';
import {
  DEFAULT_HIGH_SCORES,
  TABLE_SIZE,
  MAX_NAME,
  HIGH_SCORES_KEY,
  OLD_HIGH_SCORES_KEY,
  loadHighScores,
  saveHighScores,
  qualifies,
  insertScore,
} from '../../src/platform/highScores.js';
import { applyEntryKey, entryKeys, entryKeyAt } from '../../src/render/screens/title.js';

function memStorage(init: Record<string, unknown> = {}): Storage & { data: Record<string, unknown> } {
  const data = { ...init };
  return { data, load: (k) => (k in data ? data[k] : null), save: (k, v) => void (data[k] = structuredClone(v)) };
}

describe('high scores', () => {
  it('starts with the Elite characters, highest first', () => {
    const t = loadHighScores(memStorage());
    expect(t.map((e) => e.name)).toEqual(DEFAULT_HIGH_SCORES.map((e) => e.name));
    expect(t.map((e) => e.name)).toContain('Jameson');
    for (let i = 1; i < t.length; i++) expect(t[i].score).toBeLessThanOrEqual(t[i - 1].score);
  });

  it('round-trips through storage, and ignores junk', () => {
    const s = memStorage();
    const { table } = insertScore(loadHighScores(s), { name: 'CHLOE', score: 50000, rank: 'Deadly' });
    saveHighScores(s, table);
    expect(loadHighScores(s)).toEqual(table);
    expect(loadHighScores(memStorage({ [HIGH_SCORES_KEY]: 'nonsense' }))).toEqual(loadHighScores(memStorage()));
    expect(loadHighScores(memStorage({ [HIGH_SCORES_KEY]: [{ name: 1 }] }))).toEqual(loadHighScores(memStorage()));
  });

  it('tops out at 120,000 (raised after playtesting)', () => {
    expect(loadHighScores(memStorage())[0].score).toBe(120000);
  });

  it("migrates a v1 table: keeps the player's own entries, swaps the old seeds for the new", () => {
    const v1 = [
      { name: 'Rafe Zetter', score: 80000, rank: 'Elite' }, // an old seed: dropped
      { name: 'CHLOE', score: 85000, rank: 'Elite' }, // the player's run: kept
      { name: 'Jameson', score: 5000, rank: 'Average' }, // an old seed: dropped
    ];
    const t = loadHighScores(memStorage({ [OLD_HIGH_SCORES_KEY]: v1 }));
    expect(t[0]).toEqual({ name: 'Rafe Zetter', score: 120000, rank: 'Elite' });
    expect(t.some((e) => e.name === 'CHLOE' && e.score === 85000)).toBe(true);
    expect(t.some((e) => e.score === 80000 || e.score === 5000)).toBe(false);
  });

  it('a score qualifies while the table has room, then only by beating the lowest', () => {
    const t = loadHighScores(memStorage());
    expect(t.length).toBeLessThan(TABLE_SIZE);
    expect(qualifies(t, 1)).toBe(true); // room left
    expect(qualifies(t, 0)).toBe(false); // never for nothing
    let full = t;
    while (full.length < TABLE_SIZE) full = insertScore(full, { name: 'X', score: 1000, rank: 'Poor' }).table;
    expect(qualifies(full, 1000)).toBe(false); // a tie with the lowest doesn't
    expect(qualifies(full, 1001)).toBe(true);
  });

  it('inserts in score order, reports the row, and keeps the table to size', () => {
    const t = loadHighScores(memStorage());
    const r = insertScore(t, { name: 'CHLOE', score: 100000, rank: 'Elite' });
    expect(r.row).toBe(1); // between Rafe Zetter (120000) and Jason Ryder (90000)
    expect(r.table[1].name).toBe('CHLOE');
    let full = r.table;
    for (let i = 0; i < 10; i++) full = insertScore(full, { name: `P${i}`, score: 90000 + i, rank: 'Elite' }).table;
    expect(full).toHaveLength(TABLE_SIZE);
    expect(insertScore(full, { name: 'LOW', score: 1, rank: 'Harmless' }).row).toBe(-1);
  });

  it('defaults a blank name to Jameson and caps the length', () => {
    const t = loadHighScores(memStorage());
    expect(insertScore(t, { name: '  ', score: 999999, rank: 'Elite' }).table[0].name).toBe('Jameson');
    expect(insertScore(t, { name: 'A'.repeat(30), score: 999999, rank: 'Elite' }).table[0].name).toHaveLength(MAX_NAME);
  });
});

describe('name entry keys', () => {
  it('types, deletes, spaces and confirms', () => {
    let n: string | null = '';
    for (const k of ['C', 'H', 'L', 'O', 'E', 'SPACE', 'X', 'DEL']) n = applyEntryKey(n!, k);
    expect(n).toBe('CHLOE ');
    expect(applyEntryKey('CHLOE', 'OK')).toBeNull();
    expect(applyEntryKey('A'.repeat(MAX_NAME), 'B')).toHaveLength(MAX_NAME);
  });

  it('lays out tappable keys for every letter plus DEL and OK', () => {
    const keys = entryKeys(800, 600);
    for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') expect(keys.some((k) => k.key === c)).toBe(true);
    const ok = keys.find((k) => k.key === 'OK')!;
    expect(entryKeyAt(keys, ok.x + 2, ok.y + 2)?.key).toBe('OK');
    expect(entryKeyAt(keys, 1, 1)).toBeUndefined();
  });
});
