// Web Audio backend. Sound is optional: nothing loads until the player's first tap/click/key
// (browsers block audio before that), a file that fails to load is simply skipped, and with
// sound off every play() is a no-op. [ROC-SFX-1]

import type { AudioOut, DrawOpts } from '../interfaces.js';
import { SOUNDS, AMBIENCE, soundFiles } from './sounds.js';

// Master level at full volume. Kept well under 1 so the game stays modest even at 100%.
const MASTER_MAX = 0.7;

export interface WebAudioOptions {
  baseUrl: string; // where the sound files are served, e.g. 'sounds/'
  enabled: boolean;
  volume: number; // 0..1
}

export class WebAudioOut implements AudioOut {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private lastPlayed = new Map<string, number>();
  private voices = new Map<string, number>();
  private ambienceStarted = false;
  private enabled: boolean;
  private volume: number;
  private hidden = false;
  private readonly baseUrl: string;

  constructor(opts: WebAudioOptions) {
    this.baseUrl = opts.baseUrl;
    this.enabled = opts.enabled;
    this.volume = clamp01(opts.volume);
  }

  // Call from inside a user gesture. Creates the audio context the first time (and starts
  // loading the files); afterwards just wakes it if the browser suspended it.
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return; // no Web Audio: play silent
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      void this.loadAll();
    }
    this.syncRunning();
  }

  play(id: string, _opts?: DrawOpts): void {
    const ctx = this.ctx;
    const def = SOUNDS[id];
    if (!ctx || !this.master || !def || !this.enabled || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (def.minGap && now - (this.lastPlayed.get(id) ?? -Infinity) < def.minGap) return;
    const playing = this.voices.get(id) ?? 0;
    if (playing >= (def.maxVoices ?? 4)) return;
    const file = def.files[Math.floor(Math.random() * def.files.length)];
    const buffer = this.buffers.get(file);
    if (!buffer) return; // still loading, or failed to load

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = (def.rate ?? 1) * (1 + (Math.random() * 2 - 1) * (def.jitter ?? 0));
    const gain = ctx.createGain();
    gain.gain.value = def.gain;
    src.connect(gain).connect(this.master);
    src.onended = () => this.voices.set(id, Math.max(0, (this.voices.get(id) ?? 1) - 1));
    this.voices.set(id, playing + 1);
    this.lastPlayed.set(id, now);
    src.start();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.syncRunning();
  }

  setVolume(v: number): void {
    this.volume = clamp01(v);
    this.applyVolume();
  }

  // The page went to the background (or came back): stop making sound while it can't be seen.
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.syncRunning();
  }

  // Suspending the context when sound is off stops the ambience too and saves battery.
  private syncRunning(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.enabled && !this.hidden) {
      if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    } else if (ctx.state === 'running') {
      void ctx.suspend().catch(() => {});
    }
  }

  private applyVolume(): void {
    // Squared so the slider feels even: half-way sounds about half as loud.
    if (this.master) this.master.gain.value = MASTER_MAX * this.volume * this.volume;
  }

  private async loadAll(): Promise<void> {
    await Promise.all(
      soundFiles().map(async (file) => {
        try {
          const res = await fetch(this.baseUrl + file);
          if (!res.ok) return;
          const data = await res.arrayBuffer();
          this.buffers.set(file, await this.ctx!.decodeAudioData(data));
          if (file === AMBIENCE.file) this.startAmbience();
        } catch {
          // Missing or undecodable file: that sound just stays silent.
        }
      }),
    );
  }

  private startAmbience(): void {
    const ctx = this.ctx;
    const buffer = this.buffers.get(AMBIENCE.file);
    if (!ctx || !this.master || !buffer || this.ambienceStarted) return;
    this.ambienceStarted = true;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = AMBIENCE.gain;
    src.connect(gain).connect(this.master);
    src.start();
  }
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}
