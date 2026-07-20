// Dev-only design-mode support: which of a level's content arrays are "live" for a given phase,
// mutators for adding/removing wave/asteroid-field/giant-asteroid entries, a static path sampler
// for ghost-trail previews, and a scrub-range estimate. Pure — no sim stepping, no DOM; the
// stepping/replay side lives in sim/index.ts's `design` surface, built on these. [wave-designer-spec.md]

import { createRng } from '../rng.js';
import type { LevelDef, LevelState } from './levelstate.js';
import type { WaveDef } from './waves.js';
import { getPattern, type PathParams } from './paths.js';
import type { AsteroidFieldDef, GiantAsteroidDef, GiantAsteroidPhase } from './asteroids.js';

export const DESIGN_PHASES = ['ASTEROIDS', 'WAVES_A', 'ASTEROIDS_B', 'WAVES_B'] as const;
export type DesignPhase = (typeof DESIGN_PHASES)[number];

export function isDesignPhase(state: LevelState): state is DesignPhase {
  return (DESIGN_PHASES as readonly string[]).includes(state);
}

const GIANT_PHASE_OF: Record<DesignPhase, GiantAsteroidPhase> = {
  ASTEROIDS: 'asteroids',
  WAVES_A: 'wavesA',
  ASTEROIDS_B: 'asteroidsB',
  WAVES_B: 'wavesB',
};

// Only WAVES_A/WAVES_B carry ship waves — the two ASTEROIDS phases have none.
const WAVE_FIELD_OF: Partial<Record<DesignPhase, 'wavesA' | 'wavesB'>> = {
  WAVES_A: 'wavesA',
  WAVES_B: 'wavesB',
};

// combatAsteroids is shared between WAVES_A and WAVES_B in the content schema itself (levelstate.ts
// starts it in both phases) — editing it from either phase edits the same array. Not a design-mode
// quirk, just how the level content already works. [ROC-L1-1]
const ASTEROID_FIELD_OF: Record<DesignPhase, 'asteroidWaves' | 'midAsteroids' | 'combatAsteroids'> = {
  ASTEROIDS: 'asteroidWaves',
  WAVES_A: 'combatAsteroids',
  ASTEROIDS_B: 'midAsteroids',
  WAVES_B: 'combatAsteroids',
};

// Which of a pattern's params represent its placeable "start location" — x0/z0 for the
// edge-entry patterns, cx/cz for the center-defined ones (orbit/wander), x0/zHold for drop_hold
// (its meaningful placed position is where it holds, not its always-off-screen entry). [wave-designer-spec.md]
const ANCHOR_PARAM_OF: Record<string, { x: string; z: string }> = {
  vform: { x: 'x0', z: 'z0' },
  loop: { x: 'x0', z: 'z0' },
  sine_column: { x: 'x0', z: 'z0' },
  side_stream: { x: 'x0', z: 'z0' },
  pincer: { x: 'x0', z: 'z0' },
  orbit: { x: 'cx', z: 'cz' },
  wander: { x: 'cx', z: 'cz' },
  drop_hold: { x: 'x0', z: 'zHold' },
};

// Maps a tapped (x, z) field position onto the given pattern's anchor param(s), on top of any
// existing params (so a pattern's other defaults are left alone).
export function anchorParams(pattern: string, x: number, z: number, base: PathParams = {}): PathParams {
  const anchor = ANCHOR_PARAM_OF[pattern];
  if (!anchor) return { ...base };
  return { ...base, [anchor.x]: x, [anchor.z]: z };
}

export interface DesignPhaseContent {
  phase: DesignPhase;
  waveField: 'wavesA' | 'wavesB' | null; // null where this phase carries no ship waves
  waves: WaveDef[];
  asteroidFieldKey: 'asteroidWaves' | 'midAsteroids' | 'combatAsteroids';
  asteroidField: AsteroidFieldDef[];
  giantAsteroids: GiantAsteroidDef[]; // pre-filtered to this phase
  giantPhase: GiantAsteroidPhase;
}

// A read-only view of the current phase's editable content, straight off the level object (no
// copies) — reflects any prior add/remove immediately.
export function designPhaseContent(level: LevelDef, phase: DesignPhase): DesignPhaseContent {
  const waveField = WAVE_FIELD_OF[phase] ?? null;
  const asteroidFieldKey = ASTEROID_FIELD_OF[phase];
  const giantPhase = GIANT_PHASE_OF[phase];
  return {
    phase,
    waveField,
    waves: (waveField ? level[waveField] : undefined) ?? [],
    asteroidFieldKey,
    asteroidField: level[asteroidFieldKey] ?? [],
    giantAsteroids: (level.giantAsteroids ?? []).filter((g) => g.phase === giantPhase),
    giantPhase,
  };
}

export function addWave(level: LevelDef, phase: DesignPhase, wave: WaveDef): void {
  const field = WAVE_FIELD_OF[phase];
  if (!field) return; // this phase has no ship-wave content
  (level[field] ??= []).push(wave);
}

export function removeWave(level: LevelDef, phase: DesignPhase, waveId: string): void {
  const field = WAVE_FIELD_OF[phase];
  if (!field || !level[field]) return;
  level[field] = level[field]!.filter((w) => w.id !== waveId);
}

export function addAsteroidField(level: LevelDef, phase: DesignPhase, field: AsteroidFieldDef): void {
  const key = ASTEROID_FIELD_OF[phase];
  (level[key] ??= []).push(field);
}

export function removeAsteroidFieldAt(level: LevelDef, phase: DesignPhase, index: number): void {
  const key = ASTEROID_FIELD_OF[phase];
  level[key]?.splice(index, 1);
}

export function addGiantAsteroid(level: LevelDef, phase: DesignPhase, x: number, delayMs: number, id: string): void {
  (level.giantAsteroids ??= []).push({ phase: GIANT_PHASE_OF[phase], x, delayMs, id });
}

export function removeGiantAsteroid(level: LevelDef, id: string): void {
  if (!level.giantAsteroids) return;
  level.giantAsteroids = level.giantAsteroids.filter((g) => g.id !== id);
}

// A generous scrub-range estimate (ms), covering every authored delayMs in the phase plus a tail
// long enough for the last-placed wave to fly its full path and clear. Recomputed on demand, so
// the design UI's timeline always covers everything currently placed.
const TAIL_MS = 8000;
const DEFAULT_DURATION_MS = 4000; // matches waves.ts's own fallback for an unset durationMs

export function estimatePhaseSpanMs(content: DesignPhaseContent): number {
  let end = 0;
  for (const w of content.waves) {
    const speed = w.speed ?? 1;
    end = Math.max(end, (w.delayMs ?? 0) + (w.durationMs ?? DEFAULT_DURATION_MS) / speed);
  }
  for (const a of content.asteroidField) end = Math.max(end, (a.delayMs ?? 0) + TAIL_MS);
  for (const g of content.giantAsteroids) end = Math.max(end, (g.delayMs ?? 0) + TAIL_MS);
  return end > 0 ? end + TAIL_MS : TAIL_MS;
}

// Static preview of a wave's path — sampling the same pure pattern function the sim itself flies
// members along, at N points across its lifetime (t=0..1). No sim stepping involved, so every
// wave in a phase can be drawn as an instant "ghost trail" overlay regardless of scrub position.
// [wave-designer-spec.md]
const TRAIL_SAMPLES = 40;
const dummyRng = createRng(1); // patterns are pure in (t, params) — none currently read rng

export function sampleWavePath(wave: WaveDef, samples = TRAIL_SAMPLES): { x: number; z: number }[] {
  const pattern = getPattern(wave.pattern);
  if (!pattern) return [];
  const points: { x: number; z: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const p = pattern(t, wave.params ?? {}, dummyRng);
    points.push({ x: p.pos.x, z: p.pos.z });
  }
  return points;
}
