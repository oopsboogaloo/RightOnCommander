// T4.3: enemies fire slow, dodgeable projectiles on cadence, aimed or straight down. [ROC-ENM-11]

import { describe, it, expect } from 'vitest';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import { aiSystem, DEFAULT_AI } from '../../src/sim/systems/ai.js';
import { DEFAULT_WEAPONS } from '../../src/sim/systems/weapons.js';
import type { Entity } from '../../src/sim/components.js';

const DT = 1 / 120;

function addEnemy(w: ReturnType<typeof makeWorld>, ai: object, pos = vec3(0, 0, 1)): Entity {
  const id = w.nextId++;
  const e: Entity = { id, kind: 'enemy', pos, vel: vec3(), yaw: 0, bank: 0, ai };
  w.entities.set(id, e);
  return e;
}
const shots = (w: ReturnType<typeof makeWorld>) =>
  [...w.entities.values()].filter((e) => e.kind === 'projectile' && e.team === 'enemy');

describe('aiSystem', () => {
  it('fires at the configured rate', () => {
    const w = makeWorld(1);
    addEnemy(w, { rate: 2, aimed: false, cooldown: 0 });
    for (let i = 0; i < 120; i++) aiSystem(w, DT); // one second
    expect(shots(w).length).toBe(2); // 2 shots/sec
  });

  it('fires slow projectiles, well below player pulse speed', () => {
    const w = makeWorld(1);
    addEnemy(w, { rate: 5, aimed: false, cooldown: 0 });
    aiSystem(w, DT);
    const p = shots(w)[0];
    const speed = Math.hypot(p.vel.x, p.vel.z);
    expect(speed).toBeCloseTo(DEFAULT_AI.shotSpeed, 6);
    expect(speed).toBeGreaterThanOrEqual(1);
    expect(speed).toBeLessThanOrEqual(3);
    expect(speed).toBeLessThan(DEFAULT_WEAPONS.pulseSpeed); // slower than the player's lasers
  });

  it('aims at the player when aimed, else fires straight down', () => {
    const w = makeWorld(1);
    w.entities.get(PLAYER_ID)!.pos = vec3(1, 0, 0); // player to the right and below
    addEnemy(w, { rate: 5, aimed: true, cooldown: 0 }, vec3(0, 0, 0.5));
    aiSystem(w, DT);
    const aimed = shots(w)[0];
    expect(aimed.vel.x).toBeGreaterThan(0); // toward player (+x)
    expect(aimed.vel.z).toBeLessThan(0); // and down-screen (-z)

    const w2 = makeWorld(1);
    addEnemy(w2, { rate: 5, aimed: false, cooldown: 0 });
    aiSystem(w2, DT);
    const straight = shots(w2)[0];
    expect(straight.vel.x).toBe(0);
    expect(straight.vel.z).toBeLessThan(0);
  });
});
