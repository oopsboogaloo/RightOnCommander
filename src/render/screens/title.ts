// Title screen and high-score name entry. The title evokes classic Elite: a slowly rotating
// wireframe Sidewinder on the starfield, title and credits at the top, the high-score table, and
// the local-storage notice at the bottom. Name entry has an on-screen keyboard so it works by
// touch; a physical keyboard works too (the shell routes its keys). [ROC-TTL-1,2,4, ROC-LBD-1a]

import type { Renderer2D } from '../renderer2d.js';
import type { Mesh } from '../../interfaces.js';
import { modelMatrix } from '../project.js';
import { vec3 } from '../../sim/math/vec3.js';
import type { HighScore } from '../../platform/highScores.js';
import { MAX_NAME } from '../../platform/highScores.js';

export const AUTHOR = 'Chloe';
export const COPYRIGHT_YEAR = 2026;

const FAINT = '#9ab';
const GOLD = '#ffd76b';

function drawTable(r: Renderer2D, w: number, y0: number, table: HighScore[], highlight: number, t: number): void {
  r.drawText('HIGH SCORES', { x: w / 2, y: y0 }, { fill: '#fff', font: 'bold 16px monospace', align: 'center' });
  const left = w / 2 - 210;
  table.forEach((e, i) => {
    const y = y0 + 26 + i * 20;
    const lit = i === highlight && Math.floor(t * 4) % 2 === 0; // your new entry blinks
    const fill = i === highlight ? (lit ? GOLD : '#fff') : FAINT;
    const font = '14px monospace';
    r.drawText(`${i + 1}.`, { x: left, y }, { fill, font, align: 'left' });
    r.drawText(e.name, { x: left + 34, y }, { fill, font, align: 'left' });
    r.drawText(String(e.score), { x: left + 260, y }, { fill, font, align: 'right' });
    r.drawText(e.rank, { x: left + 280, y }, { fill, font, align: 'left' });
  });
}

// The title's rotating Sidewinder: where it sits and how it turns, at `t` seconds. Shared with the
// shell's fly-in so the transition starts exactly where the title ship is. [ROC-TTL-1,3]
export const TITLE_SHIP = { z: 0.42, scale: 0.75 };
export function titleShipPose(t: number): { yaw: number; bank: number } {
  return { yaw: t * 0.6, bank: 0.35 * Math.sin(t * 0.5) };
}

// Title and credits, at an opacity (they fade out as the ship flies into play). [ROC-TTL-2]
export function drawTitleHeading(r: Renderer2D, w: number, h: number, alpha = 1): void {
  const a = alpha.toFixed(2);
  const white = `rgba(255,255,255,${a})`;
  const faint = `rgba(153,170,187,${a})`;
  r.drawText('RIGHT ON COMMANDER', { x: w / 2, y: h * 0.09 }, { fill: white, font: 'bold 40px monospace', align: 'center' });
  r.drawText(`A game by ${AUTHOR}`, { x: w / 2, y: h * 0.09 + 30 }, { fill: faint, font: '16px monospace', align: 'center' });
  r.drawText(`© ${COPYRIGHT_YEAR} ${AUTHOR}. An unofficial fan homage.`, { x: w / 2, y: h * 0.09 + 52 }, { fill: faint, font: '12px monospace', align: 'center' });
  r.drawText('Based on Elite by David Braben & Ian Bell (Acornsoft, 1984).', { x: w / 2, y: h * 0.09 + 68 }, {
    fill: faint,
    font: '12px monospace',
    align: 'center',
  });
}

// The title screen. `t` is seconds since it opened (drives the rotation and the flashing prompt);
// `highlight` marks a just-entered score's row (or -1).
export function drawTitleScreen(r: Renderer2D, w: number, h: number, t: number, table: HighScore[], sidewinder: Mesh | undefined, highlight = -1): void {
  drawTitleHeading(r, w, h);

  // The slowly rotating Sidewinder. [ROC-TTL-1]
  if (sidewinder) {
    const pose = titleShipPose(t);
    r.drawMesh(sidewinder, modelMatrix(vec3(0, 0, TITLE_SHIP.z), pose.yaw, pose.bank, TITLE_SHIP.scale));
  }

  drawTable(r, w, h * 0.5, table, highlight, t);

  if (Math.floor(t * 2) % 2 === 0) {
    r.drawText('TAP OR PRESS FIRE TO START', { x: w / 2, y: h * 0.88 }, { fill: '#fff', font: 'bold 18px monospace', align: 'center' });
  }
  // Local-storage notice. [ROC-TTL-4]
  r.drawText('This game keeps your high scores and settings in your browser\'s local storage.', { x: w / 2, y: h - 14 }, {
    fill: '#678',
    font: '11px monospace',
    align: 'center',
  });
}

// ---- name entry -------------------------------------------------------------

export interface EntryKey {
  x: number;
  y: number;
  w: number;
  h: number;
  key: string; // a character, 'DEL' or 'OK'
}

const KEY_ROWS = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ-', '0123456789'];

// The on-screen keyboard's keys, laid out across the lower half of the box.
export function entryKeys(w: number, h: number): EntryKey[] {
  const size = Math.min(52, (w - 40) / 10, (h * 0.45) / 6);
  const keys: EntryKey[] = [];
  const y0 = h * 0.45;
  KEY_ROWS.forEach((row, ri) => {
    const rowW = row.length * size;
    row.split('').forEach((c, ci) => {
      keys.push({ x: w / 2 - rowW / 2 + ci * size, y: y0 + ri * size, w: size - 4, h: size - 4, key: c });
    });
  });
  const y = y0 + KEY_ROWS.length * size;
  const wide = size * 2.5;
  keys.push({ x: w / 2 - wide * 1.5 - 8, y, w: wide - 4, h: size - 4, key: 'SPACE' });
  keys.push({ x: w / 2 - wide / 2, y, w: wide - 4, h: size - 4, key: 'DEL' });
  keys.push({ x: w / 2 + wide / 2 + 8, y, w: wide - 4, h: size - 4, key: 'OK' });
  return keys;
}

export function entryKeyAt(keys: EntryKey[], px: number, py: number): EntryKey | undefined {
  return keys.find((k) => px >= k.x && px <= k.x + k.w && py >= k.y && py <= k.y + k.h);
}

// Apply one key to the name being typed; returns the new name, or null when the player confirms.
export function applyEntryKey(name: string, key: string): string | null {
  if (key === 'OK') return null;
  if (key === 'DEL') return name.slice(0, -1);
  const c = key === 'SPACE' ? ' ' : key;
  if (c.length !== 1 || name.length >= MAX_NAME) return name;
  return name + c;
}

export function drawEntryScreen(r: Renderer2D, w: number, h: number, t: number, name: string, score: number, rank: string): void {
  r.drawText('NEW HIGH SCORE', { x: w / 2, y: h * 0.1 }, { fill: GOLD, font: 'bold 32px monospace', align: 'center' });
  r.drawText(`${score}   ${rank}`, { x: w / 2, y: h * 0.1 + 32 }, { fill: '#fff', font: '18px monospace', align: 'center' });
  r.drawText('ENTER YOUR NAME, COMMANDER', { x: w / 2, y: h * 0.25 }, { fill: FAINT, font: '16px monospace', align: 'center' });
  const cursor = Math.floor(t * 3) % 2 === 0 && name.length < MAX_NAME ? '_' : ' ';
  r.drawText(`${name}${cursor}`, { x: w / 2, y: h * 0.25 + 44 }, { fill: '#fff', font: 'bold 30px monospace', align: 'center' });

  for (const k of entryKeys(w, h)) {
    const p = [
      { x: k.x, y: k.y },
      { x: k.x + k.w, y: k.y },
      { x: k.x + k.w, y: k.y + k.h },
      { x: k.x, y: k.y + k.h },
    ];
    for (let i = 0; i < 4; i++) r.drawLine(p[i], p[(i + 1) % 4], { stroke: '#6cf', lineWidth: 1 });
    r.drawText(k.key, { x: k.x + k.w / 2, y: k.y + k.h / 2 + 6 }, { fill: '#6cf', font: k.key.length > 1 ? '14px monospace' : 'bold 18px monospace', align: 'center' });
  }
  r.drawText('or type on your keyboard — Enter to finish', { x: w / 2, y: h - 16 }, { fill: '#678', font: '12px monospace', align: 'center' });
}
