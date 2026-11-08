// Sound on/off and volume, remembered between visits. [ROC-NFR-3]

import type { Storage } from '../interfaces.js';

export interface AudioSettings {
  enabled: boolean;
  volume: number; // 0..1
}

const KEY = 'roc.audio';
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { enabled: true, volume: 0.6 };

export function loadAudioSettings(storage: Storage): AudioSettings {
  const raw = storage.load(KEY) as Partial<AudioSettings> | null;
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AUDIO_SETTINGS };
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_AUDIO_SETTINGS.enabled,
    volume: typeof raw.volume === 'number' && Number.isFinite(raw.volume) ? Math.max(0, Math.min(1, raw.volume)) : DEFAULT_AUDIO_SETTINGS.volume,
  };
}

export function saveAudioSettings(storage: Storage, s: AudioSettings): void {
  storage.save(KEY, s);
}
