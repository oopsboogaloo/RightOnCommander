// T2.1: remap defaults, lookups, and persistence through the Storage interface. [ROC-CTL-6]

import { describe, it, expect } from 'vitest';
import {
  defaultRemap,
  loadRemap,
  saveRemap,
  rebindKey,
  keyAction,
  buttonAction,
  REMAP_STORAGE_KEY,
} from '../../src/input/remap.js';
import { memoryStorage } from '../nullBackends.js';

describe('remap', () => {
  it('default bindings cover movement, fire and momentary actions', () => {
    const t = defaultRemap();
    expect(keyAction(t, 'KeyW')).toBe('up');
    expect(keyAction(t, 'ArrowLeft')).toBe('left');
    expect(keyAction(t, 'Space')).toBe('fire');
    expect(keyAction(t, 'KeyE')).toBe('ecm');
    expect(keyAction(t, 'Escape')).toBe('pause');
    expect(buttonAction(t, 0)).toBe('fire');
    expect(buttonAction(t, 12)).toBe('up');
    expect(keyAction(t, 'KeyZ')).toBeUndefined();
  });

  it('loadRemap returns defaults when storage is empty', () => {
    const storage = memoryStorage();
    expect(loadRemap(storage)).toEqual(defaultRemap());
  });

  it('persists a rebind and reloads it (merged over defaults)', () => {
    const storage = memoryStorage();
    const table = rebindKey(defaultRemap(), 'KeyJ', 'fire');
    saveRemap(storage, table);

    expect(storage.data.has(REMAP_STORAGE_KEY)).toBe(true);
    const reloaded = loadRemap(storage);
    expect(keyAction(reloaded, 'KeyJ')).toBe('fire');
    expect(keyAction(reloaded, 'KeyW')).toBe('up'); // defaults still present
  });

  it('rebindKey does not mutate the original table', () => {
    const original = defaultRemap();
    rebindKey(original, 'KeyJ', 'fire');
    expect(keyAction(original, 'KeyJ')).toBeUndefined();
  });
});
