// T4.3: enemies fire slow, dodgeable projectiles on cadence, aimed or straight down; a random
// heading while the player is cloaked (nothing can target them). [ROC-ENM-11, ROC-CLK-4,8]

import { describe, it, expect } from 'vitest';
import { makeWorld, PLAYER_ID } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import { createRng } from '../../src/sim/rng.js';
import { aiSystem, DEFAULT_AI } from '../../src/sim/systems/ai.js';
import { DEFAULT_WEAPONS } from '../../src/sim/systems/weapons.js';
import type { Entity } from '../../src/sim/components.js';

const DT = 1 / 120;
const rng = createRng(1);

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
    for (let i = 0; i < 120; i++) aiSystem(w, rng, DT); // one second
    expect(shots(w).length).toBe(2); // 2 shots/sec
  });

  it('fires slow projectiles, well below player pulse speed', () => {
    const w = makeWorld(1);
    addEnemy(w, { rate: 5, aimed: false, cooldown: 0 });
    aiSystem(w, rng, DT);
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
    aiSystem(w, rng, DT);
    const aimed = shots(w)[0];
    expect(aimed.vel.x).toBeGreaterThan(0); // toward player (+x)
    expect(aimed.vel.z).toBeLessThan(0); // and down-screen (-z)

    const w2 = makeWorld(1);
    addEnemy(w2, { rate: 5, aimed: false, cooldown: 0 });
    aiSystem(w2, rng, DT);
    const straight = shots(w2)[0];
    expect(straight.vel.x).toBe(0);
    expect(straight.vel.z).toBeLessThan(0);
  });

  it('multiplies shot speed by the enemy\'s own speedMul (the Cougar\'s faster bolts)', () => {
    const w = makeWorld(1);
    addEnemy(w, { rate: 5, aimed: false, cooldown: 0, speedMul: 1.4 });
    aiSystem(w, rng, DT);
    const speed = Math.hypot(shots(w)[0].vel.x, shots(w)[0].vel.z);
    expect(speed).toBeCloseTo(DEFAULT_AI.shotSpeed * 1.4, 6);
  });

  it('fires in a random heading — not toward the player, not straight down — while the player is cloaked, even when aimed is set', () => {
    const w = makeWorld(1);
    w.entities.get(PLAYER_ID)!.pos = vec3(1, 0, 0); // player to the right and below
    w.player.cloakTtl = 5; // cloak-device active [ROC-CLK-4]
    addEnemy(w, { rate: 5, aimed: true, cooldown: 0 }, vec3(0, 0, 0.5));
    const localRng = createRng(7);
    aiSystem(w, localRng, DT);
    const shot = shots(w)[0];
    const speed = Math.hypot(shot.vel.x, shot.vel.z);
    expect(speed).toBeCloseTo(DEFAULT_AI.shotSpeed, 6); // still a normal shot, just not aimed

    const towardPlayerAngle = Math.atan2(1, -0.5); // what "aimed" would have produced
    const straightDownAngle = Math.PI; // vel (0, -shotSpeed) under this yaw convention
    const actualAngle = Math.atan2(shot.vel.x, shot.vel.z);
    expect(Math.abs(actualAngle - towardPlayerAngle)).toBeGreaterThan(0.05); // not aimed
    expect(Math.abs(actualAngle - straightDownAngle)).toBeGreaterThan(0.05); // and not the unaimed default either

    // Deterministic given the seed: firing again (a fresh enemy so cooldown allows it) draws the
    // next rng value and lands somewhere else, proving it's actually randomised, not fixed.
    addEnemy(w, { rate: 5, aimed: true, cooldown: 0 }, vec3(0.3, 0, 0.5));
    aiSystem(w, localRng, DT);
    const shot2 = shots(w).find((s) => Math.abs(s.pos.x - 0.3) < 1e-6)!;
    const angle2 = Math.atan2(shot2.vel.x, shot2.vel.z);
    expect(angle2).not.toBeCloseTo(actualAngle, 3);
  });
});
