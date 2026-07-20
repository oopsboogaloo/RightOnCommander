// Design-mode toolbar + ghost-trail overlay. Pure layout/hit-testing (mirrors station.ts), plus
// a draw function — dev-only, reachable from cheat mode. [wave-designer-spec.md]

import type { Renderer2D } from '../renderer2d.js';
import { vec3 } from '../../sim/math/vec3.js';
import { sampleWavePath, type DesignPhaseContent } from '../../sim/systems/designMode.js';

// A generous, fixed span covering where a pattern's entry/exit and a drifting asteroid actually
// live — matches the z0≈1.8 convention shared by every pattern in paths.ts.
const FIELD_Z_TOP = 1.9;
const FIELD_Z_BOTTOM = -1.9;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function hitTest<T extends Rect>(items: T[], px: number, py: number): T | undefined {
  return items.find((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
}

// ---- toolbar layout ---------------------------------------------------------

const ROW = { scrubY: 6, scrubH: 18, transportY: 28, transportH: 24, actionY: 56, actionH: 24 };
export const CONTENT_LIST_TOP = 86; // where the toolbar ends and the live field view begins

export type ScrubBar = Rect;
export function scrubBarRect(w: number): ScrubBar {
  return { x: 10, y: ROW.scrubY, w: w - 20, h: ROW.scrubH };
}
export const scrubFractionAt = (bar: ScrubBar, px: number): number => Math.max(0, Math.min(1, (px - bar.x) / bar.w));

export type TransportAction = 'rewind' | 'stepBack' | 'playPause' | 'stepFwd';
export interface TransportButton extends Rect {
  action: TransportAction;
  label: string;
}
// `playing`: 0 idle, 1 auto-playing forward, -1 auto-rewinding — flips REWIND/PLAY's own glyph
// to a pause glyph while that direction is the one currently running.
export function transportButtons(playing: 0 | 1 | -1): TransportButton[] {
  const y = ROW.transportY;
  const h = ROW.transportH;
  const bw = 46;
  const gap = 4;
  const defs: { action: TransportAction; label: string }[] = [
    { action: 'rewind', label: playing === -1 ? '❚❚' : '◀◀' },
    { action: 'stepBack', label: '◀' },
    { action: 'playPause', label: playing === 1 ? '❚❚' : '▶' },
    { action: 'stepFwd', label: '▶' },
  ];
  return defs.map((d, i) => ({ x: 10 + i * (bw + gap), y, w: bw, h, ...d }));
}

export type DesignerAction = 'addWave' | 'addGiant' | 'addField' | 'remove' | 'export' | 'exit';
export interface DesignerButton extends Rect {
  action: DesignerAction;
  label: string;
  enabled: boolean;
}
// `canAddWave` is false in the two ASTEROIDS phases, which carry no ship-wave content at all.
export function actionButtons(canAddWave: boolean): DesignerButton[] {
  const y = ROW.actionY;
  const h = ROW.actionH;
  const defs: { action: DesignerAction; label: string; enabled: boolean }[] = [
    { action: 'addWave', label: '+ WAVE', enabled: canAddWave },
    { action: 'addGiant', label: '+ OBSTACLE', enabled: true },
    { action: 'addField', label: '+ FIELD', enabled: true },
    { action: 'remove', label: 'REMOVE', enabled: true },
    { action: 'export', label: 'EXPORT', enabled: true },
    { action: 'exit', label: 'PLAY ▸', enabled: true },
  ];
  let x = 10;
  const out: DesignerButton[] = [];
  for (const d of defs) {
    const w = d.label.length * 7 + 16;
    out.push({ x, y, w, h, ...d });
    x += w + 4;
  }
  return out;
}

// ---- remove-flow content list ------------------------------------------------

export type ContentRowKind = 'wave' | 'asteroidField' | 'giant';
export interface ContentRow extends Rect {
  kind: ContentRowKind;
  refId: string; // wave/giant id, or the asteroid field's index (stringified)
  index: number; // asteroid-field index (meaningless for wave/giant rows)
  label: string;
}

export function contentListRows(content: DesignPhaseContent, w: number): ContentRow[] {
  const rows: ContentRow[] = [];
  let y = CONTENT_LIST_TOP;
  const h = 22;
  const rw = w - 20;
  for (const wave of content.waves) {
    rows.push({
      x: 10,
      y,
      w: rw,
      h,
      kind: 'wave',
      refId: wave.id,
      index: -1,
      label: `WAVE ${wave.id} — ${wave.pattern} / ${wave.enemy} x${wave.count}`,
    });
    y += h + 2;
  }
  content.asteroidField.forEach((f, i) => {
    rows.push({
      x: 10,
      y,
      w: rw,
      h,
      kind: 'asteroidField',
      refId: String(i),
      index: i,
      label: `FIELD #${i + 1} (${content.asteroidFieldKey}) — count ${f.count} speed ${f.speed ?? 1} spread ${f.xSpread ?? '—'}`,
    });
    y += h + 2;
  });
  for (const g of content.giantAsteroids) {
    rows.push({
      x: 10,
      y,
      w: rw,
      h,
      kind: 'giant',
      refId: g.id ?? '',
      index: -1,
      label: `OBSTACLE ${g.id ?? ''} @ x=${g.x.toFixed(2)}`,
    });
    y += h + 2;
  }
  return rows;
}

// ---- generic pick list (pattern / enemy selection) ---------------------------

export interface PickRow extends Rect {
  item: string;
  label: string;
}
export function pickListRows(items: string[], w: number, labelFor: (item: string) => string = (i) => i): PickRow[] {
  const rows: PickRow[] = [];
  let y = CONTENT_LIST_TOP;
  const h = 22;
  const rw = w - 20;
  for (const item of items) {
    rows.push({ x: 10, y, w: rw, h, item, label: labelFor(item) });
    y += h + 2;
  }
  return rows;
}

// ---- drawing ------------------------------------------------------------------

const strokeRect = (r: Renderer2D, box: Rect, color: string, lineWidth = 1): void => {
  const p = [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ];
  for (let i = 0; i < 4; i++) r.drawLine(p[i], p[(i + 1) % 4], { stroke: color, lineWidth });
};

function drawButton(r: Renderer2D, b: DesignerButton | TransportButton, active: boolean): void {
  const enabled = 'enabled' in b ? b.enabled : true;
  const color = !enabled ? 'rgba(255,255,255,0.25)' : active ? '#ffd76b' : 'rgba(255,255,255,0.75)';
  strokeRect(r, b, color);
  r.drawText(b.label, { x: b.x + b.w / 2, y: b.y + b.h / 2 + 4 }, { fill: color, font: '11px monospace', align: 'center' });
}

// Every wave/obstacle/field currently in the working phase, drawn as a static overlay sampled
// straight from the pure pattern functions — no sim stepping involved, so it's always in sync
// with the working content regardless of scrub position. [wave-designer-spec.md]
function drawGhostTrails(r: Renderer2D, content: DesignPhaseContent): void {
  for (const wave of content.waves) {
    const pts = sampleWavePath(wave);
    for (let i = 1; i < pts.length; i++) {
      r.drawWorldLine(vec3(pts[i - 1].x, 0, pts[i - 1].z), vec3(pts[i].x, 0, pts[i].z), {
        stroke: 'rgba(120,200,255,0.55)',
        lineWidth: 1.5,
      });
    }
    if (pts.length) {
      r.drawWorldText(vec3(pts[0].x, 0, pts[0].z), wave.id, {
        fill: 'rgba(120,200,255,0.85)',
        font: '10px monospace',
        align: 'center',
        dy: -8,
      });
    }
  }

  // Giant asteroids drift straight down a fixed x, like any other asteroid — drawn as a vertical
  // column at that x rather than a single point, so it reads the same "this is roughly where it
  // travels" way a wave's trail does.
  for (const g of content.giantAsteroids) {
    r.drawWorldLine(vec3(g.x, 0, FIELD_Z_TOP), vec3(g.x, 0, FIELD_Z_BOTTOM), {
      stroke: 'rgba(255,255,255,0.35)',
      lineWidth: 1.5,
    });
    r.drawWorldText(vec3(g.x, 0, FIELD_Z_TOP), g.id ?? 'obstacle', {
      fill: 'rgba(255,255,255,0.7)',
      font: '10px monospace',
      align: 'center',
      dy: -8,
    });
  }

  // A randomized asteroid field has no single path — shown as a hatched band across its spawn
  // spread instead of a trail.
  for (const f of content.asteroidField) {
    const spread = f.xSpread ?? 0.9;
    const lines = 7;
    for (let i = 0; i < lines; i++) {
      const x = -spread + (2 * spread * i) / (lines - 1);
      r.drawWorldLine(vec3(x, 0, FIELD_Z_TOP), vec3(x, 0, FIELD_Z_BOTTOM), {
        stroke: 'rgba(200,160,110,0.22)',
        lineWidth: 1,
      });
    }
  }
}

export interface DesignerDrawOpts {
  w: number;
  phaseLabel: string;
  scrubMs: number;
  spanMs: number;
  playing: 0 | 1 | -1;
  mode: 'idle' | 'placing' | 'removing';
  pickList?: { title: string; rows: PickRow[] } | null; // pattern/enemy selection, drawn over the placing hint
}

export function drawDesigner(r: Renderer2D, content: DesignPhaseContent | null, opts: DesignerDrawOpts): void {
  if (content) drawGhostTrails(r, content);

  const { w } = opts;
  const bar = scrubBarRect(w);
  strokeRect(r, bar, 'rgba(255,255,255,0.6)');
  const frac = opts.spanMs > 0 ? Math.max(0, Math.min(1, opts.scrubMs / opts.spanMs)) : 0;
  r.drawLine({ x: bar.x, y: bar.y + bar.h / 2 }, { x: bar.x + bar.w * frac, y: bar.y + bar.h / 2 }, {
    stroke: 'rgba(255,215,107,0.85)',
    lineWidth: bar.h - 4,
  });
  const markerX = bar.x + bar.w * frac;
  r.drawLine({ x: markerX, y: bar.y - 2 }, { x: markerX, y: bar.y + bar.h + 2 }, { stroke: '#fff', lineWidth: 2 });
  r.drawText(`${opts.phaseLabel}  ${(opts.scrubMs / 1000).toFixed(1)}s / ${(opts.spanMs / 1000).toFixed(1)}s`, {
    x: bar.x + bar.w,
    y: bar.y - 5,
  }, { fill: 'rgba(255,255,255,0.7)', font: '10px monospace', align: 'right' });

  for (const b of transportButtons(opts.playing)) {
    const active = (b.action === 'rewind' && opts.playing === -1) || (b.action === 'playPause' && opts.playing === 1);
    drawButton(r, b, active);
  }

  const canAddWave = content?.waveField != null;
  for (const b of actionButtons(canAddWave)) drawButton(r, b, opts.mode === 'placing' && b.action.startsWith('add'));

  if (opts.pickList) {
    r.drawText(opts.pickList.title, { x: w / 2, y: CONTENT_LIST_TOP - 10 }, {
      fill: 'rgba(255,215,107,0.9)',
      font: '12px monospace',
      align: 'center',
    });
    for (const row of opts.pickList.rows) {
      strokeRect(r, row, 'rgba(120,200,255,0.7)');
      r.drawText(row.label, { x: row.x + 8, y: row.y + row.h / 2 + 4 }, {
        fill: 'rgba(160,215,255,0.9)',
        font: '11px monospace',
        align: 'left',
      });
    }
  } else if (opts.mode === 'placing') {
    r.drawText('Tap the field to place it…', { x: w / 2, y: ROW.actionY + ROW.actionH + 16 }, {
      fill: 'rgba(255,215,107,0.9)',
      font: '12px monospace',
      align: 'center',
    });
  }

  if (opts.mode === 'removing' && content) {
    const rows = contentListRows(content, w);
    r.drawText(rows.length ? 'Tap an item to remove it' : 'Nothing placed in this phase yet', {
      x: w / 2,
      y: CONTENT_LIST_TOP - 10,
    }, { fill: 'rgba(255,215,107,0.9)', font: '12px monospace', align: 'center' });
    for (const row of rows) {
      strokeRect(r, row, 'rgba(255,120,120,0.6)');
      r.drawText(row.label, { x: row.x + 8, y: row.y + row.h / 2 + 4 }, {
        fill: 'rgba(255,160,160,0.9)',
        font: '11px monospace',
        align: 'left',
      });
    }
  }
}
