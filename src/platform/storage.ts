// localStorage-backed Storage implementation. The full save object (high scores, unlocks,
// settings, controls) is fleshed out in T6.5; for now this just round-trips JSON values so
// control remapping can persist. [design §11, ROC-CTL-6]

import type { Storage } from '../interfaces.js';

export function createLocalStorage(): Storage {
  return {
    load(key: string): unknown | null {
      try {
        const s = window.localStorage.getItem(key);
        return s == null ? null : JSON.parse(s);
      } catch {
        return null;
      }
    },
    save(key: string, value: unknown): void {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // storage unavailable (private mode / quota) — ignore
      }
    },
  };
}
