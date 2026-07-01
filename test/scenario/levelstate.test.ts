// T5.1 scenario: the level FSM runs LAUNCH -> WAVES_A -> MID_BOSS -> WAVES_B -> END_BOSS ->
// [VIPER_INTERCEPT] -> DOCK headless, with the player clearing every wave and boss. [ROC-LVL-1,2]

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import { waveSystem, type WaveContext } from '../../src/sim/systems/waves.js';
import { asteroidFieldSystem } from '../../src/sim/systems/asteroids.js';
import { startLevel, levelStateSystem, type LevelDef } from '../../src/sim/systems/levelstate.js';

const DT = 1 / 120;

const ctx: WaveContext = {
  enemies: {
    grunt: { hull: 1, bounty: 5 },
    midboss: { hull: 1, bounty: 50 },
    endboss: { hull: 1, bounty: 100 },
    viper: { hull: 1, bounty: 20 },
  },
};

const wave = (id: string, enemy: string): LevelDef['wavesA'][number] => ({
  id,
  pattern: 'sine_column',
  enemy,
  count: 2,
  spacingMs: 0,
  durationMs: 1e7, // huge: members never escape, so they must be killed
});

const level: LevelDef = {
  id: 'l1',
  launchMs: 50,
  wavesA: [wave('a', 'grunt')],
  midBoss: 'midboss',
  wavesB: [wave('b', 'grunt')],
  endBoss: 'endboss',
  viper: { ...wave('v', 'viper'), pattern: 'side_stream' },
};

// Drive the FSM to DOCK, killing everything the player can. Returns the distinct state order.
function runToDock(contraband: boolean): string[] {
  const w = makeWorld(1);
  const rng = createRng(1);
  if (contraband) w.cargo.contraband = 1;
  startLevel(w, level, ctx);

  const seq: string[] = [];
  const record = () => {
    if (seq[seq.length - 1] !== w.levelState) seq.push(w.levelState);
  };
  record();

  for (let i = 0; i < 5000 && w.levelState !== 'DOCK'; i++) {
    waveSystem(w, rng, DT, ctx);
    levelStateSystem(w, DT, level, ctx);
    for (const e of [...w.entities.values()]) {
      if (e.kind === 'enemy' || e.kind === 'boss') w.entities.delete(e.id); // player kills everything
    }
    record();
  }
  return seq;
}

describe('level FSM', () => {
  it('runs every state through to DOCK (no contraband)', () => {
    const seq = runToDock(false);
    expect(seq).toEqual(['LAUNCH', 'WAVES_A', 'MID_BOSS', 'WAVES_B', 'END_BOSS', 'DOCK']);
  });

  it('inserts the Viper interception when carrying contraband', () => {
    const seq = runToDock(true);
    expect(seq).toEqual([
      'LAUNCH',
      'WAVES_A',
      'MID_BOSS',
      'WAVES_B',
      'END_BOSS',
      'VIPER_INTERCEPT',
      'DOCK',
    ]);
  });

  it('inserts an opening ASTEROIDS phase when the level has an asteroid field', () => {
    const withField: LevelDef = { ...level, asteroidWaves: [{ count: 2, spacingMs: 0 }] };
    const w = makeWorld(1);
    const rng = createRng(1);
    startLevel(w, withField, ctx);

    const seq: string[] = [];
    const record = () => {
      if (seq[seq.length - 1] !== w.levelState) seq.push(w.levelState);
    };
    record();

    for (let i = 0; i < 5000 && w.levelState !== 'DOCK'; i++) {
      waveSystem(w, rng, DT, ctx);
      asteroidFieldSystem(w, rng, DT);
      levelStateSystem(w, DT, withField, ctx);
      for (const e of [...w.entities.values()]) {
        if (e.kind === 'enemy' || e.kind === 'boss' || e.kind === 'asteroid') w.entities.delete(e.id);
      }
      record();
    }
    expect(seq).toEqual(['LAUNCH', 'ASTEROIDS', 'WAVES_A', 'MID_BOSS', 'WAVES_B', 'END_BOSS', 'DOCK']);
  });

  it('emits a dock event on arrival', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    startLevel(w, level, ctx);
    let docked = false;
    for (let i = 0; i < 5000 && w.levelState !== 'DOCK'; i++) {
      waveSystem(w, rng, DT, ctx);
      levelStateSystem(w, DT, level, ctx);
      if (w.events.some((e) => e.type === 'dock')) docked = true;
      for (const e of [...w.entities.values()]) {
        if (e.kind === 'enemy' || e.kind === 'boss') w.entities.delete(e.id);
      }
    }
    expect(w.levelState).toBe('DOCK');
    expect(docked).toBe(true);
  });
});
