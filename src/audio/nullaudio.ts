// Silent audio backend for tests: records what would have played. [ROC-SFX-1, design §14]

import type { AudioOut } from '../interfaces.js';

export class NullAudio implements AudioOut {
  readonly played: string[] = [];
  private enabled = true;

  play(id: string): void {
    if (this.enabled) this.played.push(id);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }
}
