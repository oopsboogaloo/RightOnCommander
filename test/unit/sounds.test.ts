// T8.2: sim events turn into sound ids, every id has a file, and a real run makes noise.
// [ROC-SFX-1,2]

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SOUNDS, AMBIENCE, soundFiles, soundsForEvents } from '../../src/audio/sounds.js';
import { NullAudio } from '../../src/audio/nullaudio.js';
import { makeSim, runFrames, emptyInput } from '../harness.js';

describe('sound mapping', () => {
  it('passes sfx ids through and maps gameplay events', () => {
    const ids = soundsForEvents([
      { type: 'sfx', id: 'laser_pulse' },
      { type: 'launch' },
      { type: 'rankUp', rank: 'Competent' },
      { type: 'waveBonus', amount: 50 },
      { type: 'levelState', state: 'HYPERSPACE' },
      { type: 'levelState', state: 'WAVES' },
      { type: 'thargonLaunched' },
      { type: 'floatingText' },
    ]);
    expect(ids).toEqual(['laser_pulse', 'launch', 'rank_up', 'wave_bonus', 'hyperspace', 'thargoid']);
  });

  it('every sound the sim emits has a definition', () => {
    const emitted = ['laser_pulse', 'laser_military', 'laser_beam', 'enemy_shot', 'missile_launch', 'shield_hit',
      'explode_small', 'explode_large', 'explode_player', 'pickup', 'ecm', 'energy_bomb', 'decloak', 'witchspace'];
    for (const id of emitted) expect(SOUNDS[id], id).toBeDefined();
  });

  it('every referenced file is in public/sounds', () => {
    const dir = join(__dirname, '../../public/sounds');
    for (const f of soundFiles()) expect(existsSync(join(dir, f)), f).toBe(true);
    expect(soundFiles()).toContain(AMBIENCE.file);
  });

  it('firing in a real run plays laser sounds; disabled audio plays nothing', () => {
    const sim = makeSim(1);
    const events = runFrames(sim, 240, () => ({ ...emptyInput(), firing: true }));
    const on = new NullAudio();
    const off = new NullAudio();
    off.setEnabled(false);
    for (const id of soundsForEvents(events)) {
      on.play(id);
      off.play(id);
    }
    expect(on.played).toContain('laser_pulse');
    expect(off.played).toEqual([]);
  });
});
