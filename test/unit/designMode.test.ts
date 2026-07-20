// Pure design-mode helpers: per-phase content mapping, add/remove mutators, pattern-anchor
// mapping, scrub-span estimate, and ghost-trail path sampling. [wave-designer-spec.md]

import { describe, it, expect } from 'vitest';
import {
  DESIGN_PHASES,
  isDesignPhase,
  designPhaseContent,
  addWave,
  removeWave,
  addAsteroidField,
  removeAsteroidFieldAt,
  addGiantAsteroid,
  removeGiantAsteroid,
  anchorParams,
  estimatePhaseSpanMs,
  sampleWavePath,
} from '../../src/sim/systems/designMode.js';
import type { LevelDef } from '../../src/sim/systems/levelstate.js';
import type { WaveDef } from '../../src/sim/systems/waves.js';

function makeLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return { id: 'test-level', wavesA: [], midBoss: 'krait', wavesB: [], endBoss: 'krait', ...overrides };
}

function makeWave(overrides: Partial<WaveDef> = {}): WaveDef {
  return { id: 'w1', pattern: 'vform', enemy: 'krait', count: 3, spacingMs: 300, ...overrides };
}

describe('isDesignPhase', () => {
  it('is true only for the four combat/asteroid phases', () => {
    for (const p of DESIGN_PHASES) expect(isDesignPhase(p)).toBe(true);
    for (const other of ['LAUNCH', 'HYPERSPACE', 'INFO', 'MID_BOSS', 'MID_DOCK', 'END_BOSS', 'DOCKING', 'DOCK']) {
      expect(isDesignPhase(other as never)).toBe(false);
    }
  });
});

describe('designPhaseContent', () => {
  it('maps WAVES_A to wavesA + combatAsteroids + giantAsteroids filtered to wavesA', () => {
    const level = makeLevel({
      wavesA: [makeWave({ id: 'a1' })],
      wavesB: [makeWave({ id: 'b1' })],
      combatAsteroids: [{ count: 5, spacingMs: 400 }],
      giantAsteroids: [
        { phase: 'wavesA', x: 0.2, id: 'gA' },
        { phase: 'wavesB', x: -0.2, id: 'gB' },
      ],
    });
    const c = designPhaseContent(level, 'WAVES_A');
    expect(c.waveField).toBe('wavesA');
    expect(c.waves.map((w) => w.id)).toEqual(['a1']);
    expect(c.asteroidFieldKey).toBe('combatAsteroids');
    expect(c.asteroidField).toEqual([{ count: 5, spacingMs: 400 }]);
    expect(c.giantAsteroids.map((g) => g.id)).toEqual(['gA']);
  });

  it('maps the two ASTEROIDS phases to their own field, with no ship waves', () => {
    const level = makeLevel({
      asteroidWaves: [{ count: 6, spacingMs: 350 }],
      midAsteroids: [{ count: 4, spacingMs: 500 }],
    });
    const asteroids = designPhaseContent(level, 'ASTEROIDS');
    expect(asteroids.waveField).toBeNull();
    expect(asteroids.waves).toEqual([]);
    expect(asteroids.asteroidFieldKey).toBe('asteroidWaves');
    expect(asteroids.asteroidField).toEqual([{ count: 6, spacingMs: 350 }]);

    const asteroidsB = designPhaseContent(level, 'ASTEROIDS_B');
    expect(asteroidsB.asteroidFieldKey).toBe('midAsteroids');
    expect(asteroidsB.asteroidField).toEqual([{ count: 4, spacingMs: 500 }]);
  });

  it('defaults every array to empty when the level has none', () => {
    const c = designPhaseContent(makeLevel(), 'WAVES_B');
    expect(c.waves).toEqual([]);
    expect(c.asteroidField).toEqual([]);
    expect(c.giantAsteroids).toEqual([]);
  });
});

describe('addWave / removeWave', () => {
  it('adds to the right phase field and is a no-op on phases with no ship waves', () => {
    const level = makeLevel();
    addWave(level, 'WAVES_A', makeWave({ id: 'a1' }));
    addWave(level, 'WAVES_B', makeWave({ id: 'b1' }));
    addWave(level, 'ASTEROIDS', makeWave({ id: 'ignored' })); // no-op: ASTEROIDS carries no waves
    expect(level.wavesA.map((w) => w.id)).toEqual(['a1']);
    expect(level.wavesB.map((w) => w.id)).toEqual(['b1']);
  });

  it('removes by id, leaving the rest untouched', () => {
    const level = makeLevel({ wavesA: [makeWave({ id: 'a1' }), makeWave({ id: 'a2' })] });
    removeWave(level, 'WAVES_A', 'a1');
    expect(level.wavesA.map((w) => w.id)).toEqual(['a2']);
  });
});

describe('addAsteroidField / removeAsteroidFieldAt', () => {
  it('combatAsteroids is shared between WAVES_A and WAVES_B, matching the level content schema', () => {
    const level = makeLevel();
    addAsteroidField(level, 'WAVES_A', { count: 8, spacingMs: 400 });
    expect(designPhaseContent(level, 'WAVES_A').asteroidField).toHaveLength(1);
    expect(designPhaseContent(level, 'WAVES_B').asteroidField).toHaveLength(1); // same underlying array
  });

  it('asteroidWaves and midAsteroids are independent per-phase arrays', () => {
    const level = makeLevel();
    addAsteroidField(level, 'ASTEROIDS', { count: 6, spacingMs: 350 });
    addAsteroidField(level, 'ASTEROIDS_B', { count: 4, spacingMs: 500 });
    expect(designPhaseContent(level, 'ASTEROIDS').asteroidField).toHaveLength(1);
    expect(designPhaseContent(level, 'ASTEROIDS_B').asteroidField).toHaveLength(1);
  });

  it('removes by index', () => {
    const level = makeLevel({ asteroidWaves: [{ count: 1, spacingMs: 1 }, { count: 2, spacingMs: 2 }] });
    removeAsteroidFieldAt(level, 'ASTEROIDS', 0);
    expect(level.asteroidWaves).toEqual([{ count: 2, spacingMs: 2 }]);
  });
});

describe('addGiantAsteroid / removeGiantAsteroid', () => {
  it('tags the new obstacle with the phase it was added from', () => {
    const level = makeLevel();
    addGiantAsteroid(level, 'WAVES_A', 0.3, 5000, 'g1');
    expect(level.giantAsteroids).toEqual([{ phase: 'wavesA', x: 0.3, delayMs: 5000, id: 'g1' }]);
  });

  it('removes by id regardless of phase', () => {
    const level = makeLevel({
      giantAsteroids: [
        { phase: 'wavesA', x: 0.1, id: 'g1' },
        { phase: 'wavesB', x: -0.1, id: 'g2' },
      ],
    });
    removeGiantAsteroid(level, 'g1');
    expect(level.giantAsteroids?.map((g) => g.id)).toEqual(['g2']);
  });
});

describe('anchorParams', () => {
  const cases: [string, string, string][] = [
    ['vform', 'x0', 'z0'],
    ['loop', 'x0', 'z0'],
    ['sine_column', 'x0', 'z0'],
    ['side_stream', 'x0', 'z0'],
    ['pincer', 'x0', 'z0'],
    ['orbit', 'cx', 'cz'],
    ['wander', 'cx', 'cz'],
    ['drop_hold', 'x0', 'zHold'],
  ];

  it.each(cases)('maps a tapped point onto %s\'s own anchor params', (pattern, xKey, zKey) => {
    const params = anchorParams(pattern, 0.4, -0.6);
    expect(params[xKey]).toBe(0.4);
    expect(params[zKey]).toBe(-0.6);
  });

  it('preserves other params already present', () => {
    const params = anchorParams('vform', 0.4, -0.6, { x1: 0.9 });
    expect(params.x1).toBe(0.9);
    expect(params.x0).toBe(0.4);
  });

  it('is a no-op for an unknown pattern name', () => {
    expect(anchorParams('nope', 0.4, -0.6, { foo: 1 })).toEqual({ foo: 1 });
  });
});

describe('estimatePhaseSpanMs', () => {
  it('is a fixed floor for empty content', () => {
    const c = designPhaseContent(makeLevel(), 'WAVES_A');
    expect(estimatePhaseSpanMs(c)).toBeGreaterThan(0);
  });

  it('grows with the latest-placed wave, accounting for its speed', () => {
    const slow = designPhaseContent(makeLevel({ wavesA: [makeWave({ delayMs: 10_000, durationMs: 4000, speed: 0.5 })] }), 'WAVES_A');
    const fast = designPhaseContent(makeLevel({ wavesA: [makeWave({ delayMs: 10_000, durationMs: 4000, speed: 2 })] }), 'WAVES_A');
    // A slower wave (speed 0.5, so it takes longer to fly its path) pushes the span out further
    // than the same wave at speed 2.
    expect(estimatePhaseSpanMs(slow)).toBeGreaterThan(estimatePhaseSpanMs(fast));
  });

  it('grows with the furthest-out asteroid field / giant asteroid delay', () => {
    const base = estimatePhaseSpanMs(designPhaseContent(makeLevel(), 'ASTEROIDS'));
    const withField = estimatePhaseSpanMs(
      designPhaseContent(makeLevel({ asteroidWaves: [{ count: 1, spacingMs: 1, delayMs: 50_000 }] }), 'ASTEROIDS'),
    );
    expect(withField).toBeGreaterThan(base);
  });
});

describe('sampleWavePath', () => {
  it('samples the requested number of points along the pattern', () => {
    const points = sampleWavePath(makeWave({ pattern: 'vform' }), 10);
    expect(points).toHaveLength(10);
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
    }
  });

  it('matches the pattern function directly at its endpoints', () => {
    const wave = makeWave({ pattern: 'drop_hold', params: { x0: 0.5 } });
    const points = sampleWavePath(wave, 5);
    expect(points[0].z).toBeCloseTo(1.8, 6); // entry, per paths.ts's drop_hold default z0
    expect(points[points.length - 1].z).toBeCloseTo(0.8, 6); // hold, per its default zHold
  });

  it('returns an empty array for an unknown pattern', () => {
    expect(sampleWavePath(makeWave({ pattern: 'not-a-pattern' }))).toEqual([]);
  });
});
