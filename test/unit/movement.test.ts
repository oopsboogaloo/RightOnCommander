// T2.2: movement follow, banking sign + level-out, and the engine-thrust flag. [ROC-MOV-1,3,4,5]

import { describe, it, expect } from 'vitest';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import { movementSystem } from '../../src/sim/systems/movement.js';
import type { InputFrame, Vec2 } from '../../src/interfaces.js';
import type { Entity } from '../../src/sim/components.js';

const DT = 1 / 120;

const frame = (moveTarget: Vec2 | null): InputFrame => ({
  moveTarget,
  firing: false,
  fireTapped: false,
  ecm: false,
  energyBomb: false,
  confirm: false,
  pause: false,
});

function run(targets: (Vec2 | null)[]): Entity {
  const w = makeWorld(1);
  for (const t of targets) movementSystem(w, frame(t), DT);
  return w.entities.get(PLAYER_ID)!;
}

describe('movementSystem', () => {
  it('follows the target toward its position', () => {
    const p = run(Array<Vec2>(400).fill({ x: 0.5, y: 0.3 }));
    expect(p.pos.x).toBeCloseTo(0.5, 2);
    expect(p.pos.z).toBeCloseTo(0.3, 2);
  });

  it('banks in the direction of lateral motion', () => {
    const right = run(Array<Vec2>(3).fill({ x: 1, y: 0 }));
    expect(right.vel.x).toBeGreaterThan(0);
    expect(right.bank).toBeGreaterThan(0); // sign matches lateral direction

    const left = run(Array<Vec2>(3).fill({ x: -1, y: 0 }));
    expect(left.vel.x).toBeLessThan(0);
    expect(left.bank).toBeLessThan(0);
  });

  it('levels out when lateral motion ceases', () => {
    const w = makeWorld(1);
    for (let i = 0; i < 5; i++) movementSystem(w, frame({ x: 1, y: 0 }), DT); // bank right
    const banked = w.entities.get(PLAYER_ID)!.bank;
    expect(banked).toBeGreaterThan(0);
    for (let i = 0; i < 300; i++) movementSystem(w, frame(null), DT); // release
    expect(Math.abs(w.entities.get(PLAYER_ID)!.bank)).toBeLessThan(1e-3);
  });

  it('flags thrust only when moving up-screen (+z)', () => {
    expect(run([{ x: 0, y: 1 }]).thrust).toBe(true); // moving up
    expect(run([{ x: 0, y: -1 }]).thrust).toBe(false); // moving down
    expect(run([{ x: 1, y: 0 }]).thrust).toBe(false); // purely lateral
    expect(run([null]).thrust).toBe(false); // stationary
  });
});
