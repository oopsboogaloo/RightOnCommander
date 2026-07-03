// T5.1/T5a scenario: the level FSM runs LAUNCH -> HYPERSPACE -> INFO -> WAVES_A -> MID_BOSS ->
// WAVES_B -> END_BOSS -> [VIPER_INTERCEPT] -> DOCKING -> DOCK headless, with the player
// clearing every wave and boss, then flying into the station's aligned port. [ROC-LVL-1,2,
// ROC-BOSS-4, ROC-HYP-*, ROC-DCKG-3]

import { describe, it, expect } from 'vitest';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
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

// One frame of "the player wins": kill every enemy/boss, and when docking, fly straight into
// the aligned port.
function playerWins(w: ReturnType<typeof makeWorld>): void {
  for (const e of [...w.entities.values()]) {
    if (e.kind === 'enemy' || e.kind === 'boss' || e.kind === 'asteroid') w.entities.delete(e.id);
  }
  if (w.levelState === 'DOCKING') {
    const st = [...w.entities.values()].find((e) => e.kind === 'station');
    const p = w.entities.get(PLAYER_ID);
    if (st && p) {
      st.bank = 0; // port level — inside the 30° tolerance [ROC-DCKG-3]
      p.pos = { ...st.pos };
    }
  }
}

// Drive the FSM to DOCK. Returns the distinct state order.
function runToDock(contraband: boolean, withField = false): string[] {
  const w = makeWorld(1);
  const rng = createRng(1);
  if (contraband) w.cargo.contraband = 1;
  const def: LevelDef = withField ? { ...level, asteroidWaves: [{ count: 2, spacingMs: 0 }] } : level;
  startLevel(w, def, ctx);

  const seq: string[] = [];
  const record = () => {
    if (seq[seq.length - 1] !== w.levelState) seq.push(w.levelState);
  };
  record();

  for (let i = 0; i < 30000 && w.levelState !== 'DOCK'; i++) {
    waveSystem(w, rng, DT, ctx);
    if (withField) asteroidFieldSystem(w, rng, DT);
    levelStateSystem(w, DT, def, ctx);
    playerWins(w);
    record();
  }
  return seq;
}

describe('level FSM', () => {
  it('runs every state through to DOCK (no contraband)', () => {
    const seq = runToDock(false);
    expect(seq).toEqual([
      'LAUNCH',
      'HYPERSPACE',
      'INFO',
      'WAVES_A',
      'MID_BOSS',
      'WAVES_B',
      'END_BOSS',
      'DOCKING',
      'DOCK',
    ]);
  });

  it('inserts the Viper interception when carrying contraband', () => {
    const seq = runToDock(true);
    expect(seq).toEqual([
      'LAUNCH',
      'HYPERSPACE',
      'INFO',
      'WAVES_A',
      'MID_BOSS',
      'WAVES_B',
      'END_BOSS',
      'VIPER_INTERCEPT',
      'DOCKING',
      'DOCK',
    ]);
  });

  it('inserts an opening ASTEROIDS phase when the level has an asteroid field', () => {
    const seq = runToDock(false, true);
    expect(seq).toEqual([
      'LAUNCH',
      'HYPERSPACE',
      'INFO',
      'ASTEROIDS',
      'WAVES_A',
      'MID_BOSS',
      'WAVES_B',
      'END_BOSS',
      'DOCKING',
      'DOCK',
    ]);
  });

  it('emits a dock event on arrival', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    startLevel(w, level, ctx);
    let docked = false;
    for (let i = 0; i < 30000 && w.levelState !== 'DOCK'; i++) {
      waveSystem(w, rng, DT, ctx);
      levelStateSystem(w, DT, level, ctx);
      if (w.events.some((e) => e.type === 'dock')) docked = true;
      playerWins(w);
      w.events = [];
    }
    expect(w.levelState).toBe('DOCK');
    expect(docked).toBe(true);
  });
});
