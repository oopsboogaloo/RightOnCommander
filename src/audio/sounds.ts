// The sound set: which file plays for each sound id, how loud, and how often. Files live in
// public/sounds/ (taken from Mammoth Gravity Battles). Pure data + a pure event mapping, so it
// can be unit-tested without a browser. [ROC-SFX-1,2]

import type { SimEvent } from '../sim/components.js';

export interface SoundDef {
  files: string[]; // one is picked at random per play, for variety
  gain: number; // relative loudness, 0..1, before the master volume
  minGap?: number; // seconds: the same id won't retrigger sooner than this
  maxVoices?: number; // most copies of this id allowed to overlap
  rate?: number; // playback rate (pitch), default 1
  jitter?: number; // +/- random pitch variation, so repeats don't sound identical
}

export const SOUNDS: Record<string, SoundDef> = {
  laser_pulse: { files: ['shortPistol1.wav'], gain: 0.22, minGap: 0.07, maxVoices: 3, jitter: 0.05 },
  laser_military: { files: ['mg1.wav'], gain: 0.16, minGap: 0.07, maxVoices: 3, jitter: 0.05 },
  laser_beam: { files: ['shortPistol1.wav'], gain: 0.12, minGap: 0.14, maxVoices: 2, rate: 0.6 },
  enemy_shot: { files: ['pistol1.wav'], gain: 0.1, minGap: 0.12, maxVoices: 3, rate: 0.85, jitter: 0.08 },
  missile_launch: { files: ['RocketLaunch.wav'], gain: 0.3, minGap: 0.1, maxVoices: 2 },
  shield_hit: { files: ['Pop2.wav'], gain: 0.35, minGap: 0.08, maxVoices: 2 },
  explode_small: {
    files: ['Explosion1.wav', 'Explosion2.wav', 'Explosion3.wav', 'Explosion4.wav', 'Explosion5.wav'],
    gain: 0.4,
    minGap: 0.05,
    maxVoices: 4,
    jitter: 0.08,
  },
  explode_large: { files: ['ExplosionLarge1.wav', 'ExplosionLarge2.wav'], gain: 0.6, minGap: 0.3, maxVoices: 2 },
  explode_player: { files: ['ExplosionLarge1.wav', 'ExplosionLarge2.wav'], gain: 0.6, minGap: 0.3, maxVoices: 1 },
  pickup: { files: ['sfxclickbleep2.wav'], gain: 0.35, minGap: 0.05, maxVoices: 2 },
  ecm: { files: ['GlassSmash.wav'], gain: 0.45, maxVoices: 1 },
  energy_bomb: { files: ['NovaEditGain.wav'], gain: 0.5, maxVoices: 1 },
  decloak: { files: ['SunSoundCombined.wav'], gain: 0.35, minGap: 0.3, maxVoices: 2 },
  witchspace: { files: ['teleport.wav'], gain: 0.45, maxVoices: 1 },
  hyperspace: { files: ['teleport.wav'], gain: 0.4, maxVoices: 1 },
  launch: { files: ['CannonLaunch.wav'], gain: 0.4, maxVoices: 1 },
  rank_up: { files: ['fireworkBang.wav'], gain: 0.45, maxVoices: 1 },
  wave_bonus: { files: ['sfxclickbleep1.wav'], gain: 0.35, minGap: 0.1, maxVoices: 1 },
  thargoid: { files: ['SaucerNoise.wav'], gain: 0.2, minGap: 6, maxVoices: 1 },
  ui_select: { files: ['sfxclickbleep1.wav'], gain: 0.35, minGap: 0.04, maxVoices: 2 },
};

// Background loop, played quietly whenever sound is on.
export const AMBIENCE = { file: 'SpaceAmbience.mp3', gain: 0.3 };

// The distinct files to load.
export function soundFiles(): string[] {
  return [...new Set([...Object.values(SOUNDS).flatMap((s) => s.files), AMBIENCE.file])];
}

// Turn one step's sim events into sound ids. Most come straight from the sim's 'sfx' events; a
// few existing gameplay events get a sound here, so the sim doesn't need to know about them.
export function soundsForEvents(events: readonly SimEvent[]): string[] {
  const out: string[] = [];
  for (const ev of events) {
    switch (ev.type) {
      case 'sfx':
        if (typeof ev.id === 'string') out.push(ev.id);
        break;
      case 'launch':
        out.push('launch');
        break;
      case 'rankUp':
        out.push('rank_up');
        break;
      case 'waveBonus':
        out.push('wave_bonus');
        break;
      case 'levelState':
        if (ev.state === 'HYPERSPACE') out.push('hyperspace');
        break;
      case 'thargonLaunched':
      case 'droneLaunched':
        out.push('thargoid');
        break;
    }
  }
  return out;
}
