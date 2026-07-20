// Pure layout/hit-testing for the wave designer's toolbar and content list. [wave-designer-spec.md]

import { describe, it, expect } from 'vitest';
import {
  hitTest,
  scrubBarRect,
  scrubFractionAt,
  transportButtons,
  actionButtons,
  contentListRows,
} from '../../src/render/screens/designer.js';
import { designPhaseContent } from '../../src/sim/systems/designMode.js';
import type { LevelDef } from '../../src/sim/systems/levelstate.js';

function makeLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return { id: 'test-level', wavesA: [], midBoss: 'krait', wavesB: [], endBoss: 'krait', ...overrides };
}

describe('hitTest', () => {
  it('finds the rect containing the point, or none', () => {
    const items = [
      { x: 0, y: 0, w: 10, h: 10, tag: 'a' },
      { x: 20, y: 0, w: 10, h: 10, tag: 'b' },
    ];
    expect(hitTest(items, 5, 5)?.tag).toBe('a');
    expect(hitTest(items, 25, 5)?.tag).toBe('b');
    expect(hitTest(items, 15, 5)).toBeUndefined();
  });
});

describe('scrubBarRect / scrubFractionAt', () => {
  it('maps a tap at the bar\'s edges to 0 and 1, and clamps beyond them', () => {
    const bar = scrubBarRect(800);
    expect(scrubFractionAt(bar, bar.x)).toBeCloseTo(0, 6);
    expect(scrubFractionAt(bar, bar.x + bar.w)).toBeCloseTo(1, 6);
    expect(scrubFractionAt(bar, bar.x - 500)).toBe(0);
    expect(scrubFractionAt(bar, bar.x + bar.w + 500)).toBe(1);
  });
});

describe('transportButtons', () => {
  it('shows a pause glyph only on whichever direction is currently auto-playing', () => {
    const idle = transportButtons(0);
    expect(idle.find((b) => b.action === 'rewind')?.label).toBe('◀◀');
    expect(idle.find((b) => b.action === 'playPause')?.label).toBe('▶');

    const playing = transportButtons(1);
    expect(playing.find((b) => b.action === 'playPause')?.label).toBe('❚❚');
    expect(playing.find((b) => b.action === 'rewind')?.label).toBe('◀◀');

    const rewinding = transportButtons(-1);
    expect(rewinding.find((b) => b.action === 'rewind')?.label).toBe('❚❚');
    expect(rewinding.find((b) => b.action === 'playPause')?.label).toBe('▶');
  });

  it('lays buttons out left to right with no overlap', () => {
    const buttons = transportButtons(0);
    for (let i = 1; i < buttons.length; i++) {
      expect(buttons[i].x).toBeGreaterThanOrEqual(buttons[i - 1].x + buttons[i - 1].w);
    }
  });
});

describe('actionButtons', () => {
  it('disables + WAVE when the phase carries no ship waves, enables it otherwise', () => {
    expect(actionButtons(false).find((b) => b.action === 'addWave')?.enabled).toBe(false);
    expect(actionButtons(true).find((b) => b.action === 'addWave')?.enabled).toBe(true);
  });

  it('every other action stays enabled regardless', () => {
    for (const b of actionButtons(false)) {
      if (b.action === 'addWave') continue;
      expect(b.enabled).toBe(true);
    }
  });
});

describe('contentListRows', () => {
  it('lists waves, asteroid fields and giant asteroids for the phase, each labelled', () => {
    const level = makeLevel({
      wavesA: [{ id: 'a1', pattern: 'vform', enemy: 'krait', count: 6, spacingMs: 350 }],
      combatAsteroids: [{ count: 8, spacingMs: 400, xSpread: 0.9, speed: 0.3 }],
      giantAsteroids: [{ phase: 'wavesA', x: 0.3, id: 'g1' }],
    });
    const content = designPhaseContent(level, 'WAVES_A');
    const rows = contentListRows(content, 800);

    expect(rows.map((r) => r.kind)).toEqual(['wave', 'asteroidField', 'giant']);
    expect(rows[0].label).toContain('a1');
    expect(rows[0].label).toContain('vform');
    expect(rows[1].label).toContain('count 8');
    expect(rows[2].label).toContain('g1');
  });

  it('rows never overlap vertically', () => {
    const level = makeLevel({
      wavesA: [
        { id: 'a1', pattern: 'vform', enemy: 'krait', count: 6, spacingMs: 350 },
        { id: 'a2', pattern: 'loop', enemy: 'sidewinder', count: 4, spacingMs: 300 },
      ],
    });
    const rows = contentListRows(designPhaseContent(level, 'WAVES_A'), 800);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].y).toBeGreaterThanOrEqual(rows[i - 1].y + rows[i - 1].h);
    }
  });

  it('is empty for a phase with nothing placed', () => {
    expect(contentListRows(designPhaseContent(makeLevel(), 'ASTEROIDS'), 800)).toEqual([]);
  });
});
