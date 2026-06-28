// Input remapping: logical actions, the default physical bindings, and persistence through
// the Storage interface. Pure data + helpers, so it is testable without the DOM. [ROC-CTL-6]

import type { Storage } from '../interfaces.js';

export type Action = 'up' | 'down' | 'left' | 'right' | 'fire' | 'ecm' | 'bomb' | 'confirm' | 'pause';

export interface RemapTable {
  keyboard: Record<string, Action>; // KeyboardEvent.code -> Action
  gamepad: Record<number, Action>; // gamepad button index -> Action
}

export const REMAP_STORAGE_KEY = 'roc.controls';

export function defaultRemap(): RemapTable {
  return {
    keyboard: {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      Space: 'fire',
      KeyE: 'ecm',
      KeyB: 'bomb',
      Enter: 'confirm',
      Escape: 'pause',
    },
    gamepad: {
      12: 'up', // d-pad up
      13: 'down',
      14: 'left',
      15: 'right',
      0: 'fire', // A / cross
      1: 'confirm', // B / circle
      2: 'ecm', // X / square
      3: 'bomb', // Y / triangle
      9: 'pause', // start
    },
  };
}

export function loadRemap(storage: Storage): RemapTable {
  const raw = storage.load(REMAP_STORAGE_KEY);
  const base = defaultRemap();
  if (raw && typeof raw === 'object') {
    const t = raw as Partial<RemapTable>;
    return {
      keyboard: { ...base.keyboard, ...(t.keyboard ?? {}) },
      gamepad: { ...base.gamepad, ...(t.gamepad ?? {}) },
    };
  }
  return base;
}

export function saveRemap(storage: Storage, table: RemapTable): void {
  storage.save(REMAP_STORAGE_KEY, table);
}

// Bind a keyboard code to an action, returning a new table (does not mutate the input).
export function rebindKey(table: RemapTable, code: string, action: Action): RemapTable {
  return { ...table, keyboard: { ...table.keyboard, [code]: action } };
}

export const keyAction = (table: RemapTable, code: string): Action | undefined => table.keyboard[code];
export const buttonAction = (table: RemapTable, index: number): Action | undefined => table.gamepad[index];
