// Drifting asteroid field: spawn cadence, free tumble (independent of heading/motion), drift,
// off-field culling, and fragmenting a destroyed large asteroid into faster splinters — but a
// splinter itself is terminal (no further split). [ROC-L1-1]

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import {
  startAsteroidWaves,
  startGiantAsteroids,
  asteroidFieldSystem,
  asteroidSplitSystem,
} from '../../src/sim/systems/asteroids.js';
import { applyDamage } from '../../src/sim/systems/damage.js';

const DT = 1 / 120;
const asteroids = (w: ReturnType<typeof makeWorld>) => [...w.entities.values()].filter((e) => e.kind === 'asteroid');

describe('asteroid field', () => {
  it('spawns members spaced over time up to count', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    startAsteroidWaves(w, [{ count: 3, spacingMs: 100 }]);

    asteroidFieldSystem(w, rng, DT);
    expect(asteroids(w).length).toBe(1); // first spawns immediately

    for (let i = 0; i < 40; i++) asteroidFieldSystem(w, rng, DT); // ~0.3s elapses
    expect(asteroids(w).length).toBe(3);
    expect(w.asteroidWaves[0]?.pending).toBe(0);
  });

  it('sequences multiple waves by delayMs, like wavesA sequences fighter waves', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    startAsteroidWaves(w, [
      { count: 1, spacingMs: 0, delayMs: 0 },
      { count: 1, spacingMs: 0, delayMs: 500 },
    ]);

    asteroidFieldSystem(w, rng, DT);
    expect(asteroids(w).length).toBe(1); // only the first wave's member is due

    for (let i = 0; i < 60; i++) asteroidFieldSystem(w, rng, DT); // ~0.5s elapses
    expect(asteroids(w).length).toBe(2); // the second wave's member has now spawned
    expect(w.asteroidWaves.every((wave) => wave.pending <= 0)).toBe(true);
  });

  it('tumbles freely: yaw and bank advance independently of position/heading', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    startAsteroidWaves(w, [{ count: 1, spacingMs: 0 }]);
    asteroidFieldSystem(w, rng, DT);

    const rock = asteroids(w)[0];
    const { yawRate, bankRate } = rock.tumble!;
    const yaw0 = rock.yaw;
    const bank0 = rock.bank;

    for (let i = 0; i < 30; i++) asteroidFieldSystem(w, rng, DT);
    const elapsed = 30 * DT;
    expect(rock.yaw).toBeCloseTo(yaw0 + yawRate * elapsed, 6);
    expect(rock.bank).toBeCloseTo(bank0 + bankRate * elapsed, 6);
    expect(yawRate).not.toBe(bankRate); // two independent rotation axes, not a single spin
  });

  it('drifts downward and culls once it passes the bottom edge', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    startAsteroidWaves(w, [{ count: 1, spacingMs: 0, speed: 5 }]); // fast, so it culls quickly
    asteroidFieldSystem(w, rng, DT);
    expect(asteroids(w).length).toBe(1);

    for (let i = 0; i < 200; i++) asteroidFieldSystem(w, rng, DT);
    expect(asteroids(w).length).toBe(0); // drifted off-field
  });

  it('fragments a destroyed large asteroid into 4-5 slower splinters', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    // A stationary parent isolates the kick speed from the inherited-velocity component.
    w.events = [{ type: 'destroyed', kind: 'asteroid', meshId: 'asteroid', pos: vec3(0.1, 0, 0.2), vel: vec3() }];
    asteroidSplitSystem(w, rng);

    const children = asteroids(w);
    expect(children.length).toBeGreaterThanOrEqual(4);
    expect(children.length).toBeLessThanOrEqual(5);
    for (const c of children) {
      expect(c.meshId).toBe('splinter');
      expect(c.bounty).toBeGreaterThan(0); // terminal fragment rewards the kill [ROC-L1-3]
      const speed = Math.hypot(c.vel.x, c.vel.z);
      expect(speed).toBeGreaterThan(0); // still scatters...
      expect(speed).toBeLessThanOrEqual(0.28); // ...but no faster than the fallback reference speed
      expect(c.ttl).toBeGreaterThan(0); // guaranteed cleanup regardless of drift direction
    }
  });

  it('culls a splinter on a lifetime timer even if its drift never crosses the bottom edge', () => {
    // A splinter's outward kick can point any direction, including one that cancels its
    // inherited drift (unlike a large asteroid, whose velocity.z is always negative and so is
    // guaranteed to eventually cull). Without its own ttl it could linger forever and
    // permanently block the ASTEROIDS phase from ever clearing.
    const w = makeWorld(1);
    const id = w.nextId++;
    w.entities.set(id, {
      id,
      kind: 'asteroid',
      meshId: 'splinter',
      pos: vec3(0, 0, 0),
      vel: vec3(0.05, 0, 0), // pure sideways drift — z never approaches CULL_Z
      yaw: 0,
      bank: 0,
      hull: 1,
      hullMax: 1,
      ttl: 1, // short, for a fast test
    });

    const rng = createRng(1);
    for (let i = 0; i < 130; i++) asteroidFieldSystem(w, rng, DT); // > 1s
    expect(asteroids(w).length).toBe(0);
  });

  it('never splits a destroyed splinter (terminal fragment)', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    w.events = [{ type: 'destroyed', kind: 'asteroid', meshId: 'splinter', pos: vec3(), vel: vec3() }];
    asteroidSplitSystem(w, rng);
    expect(asteroids(w).length).toBe(0);
  });
});

describe('giant asteroids', () => {
  it('spawns a one-shot obstacle at its authored x position after delayMs, not a randomised field', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    startGiantAsteroids(w, [{ phase: 'wavesA', x: 0.42, delayMs: 500, id: 'g2' }]);

    asteroidFieldSystem(w, rng, DT);
    expect(asteroids(w).length).toBe(0); // not due yet

    for (let i = 0; i < 61; i++) asteroidFieldSystem(w, rng, DT); // ~0.5s elapses
    const giants = asteroids(w);
    expect(giants.length).toBe(1);
    expect(giants[0].pos.x).toBe(0.42);
    expect(giants[0].meshId).toBe('giant_asteroid');
    expect(giants[0].indestructible).toBe(true);
    expect(giants[0].scale).toBe(5.5);
    expect(giants[0].debugLabel).toBe('g2'); // carries its authored id for cheat-mode labelling
    expect(w.giantAsteroids.length).toBe(0); // consumed, one-shot
  });

  it('spins slowly about yaw only (bank stays fixed) — flat against the screen, not a chaotic tumble', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    startGiantAsteroids(w, [{ phase: 'wavesA', x: 0 }]);
    asteroidFieldSystem(w, rng, DT);

    const rock = asteroids(w)[0];
    const bank0 = rock.bank;
    expect(rock.tumble!.bankRate).toBe(0);
    for (let i = 0; i < 60; i++) asteroidFieldSystem(w, rng, DT);
    expect(rock.bank).toBe(bank0); // never rotates on this axis
    expect(rock.yaw).not.toBe(0); // yaw did advance
  });

  it('is indestructible: applyDamage never reduces its hull, however much damage it takes', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    startGiantAsteroids(w, [{ phase: 'wavesA', x: 0 }]);
    asteroidFieldSystem(w, rng, DT);

    const rock = asteroids(w)[0];
    const hull0 = rock.hull;
    applyDamage(w, rock, 99999);
    expect(rock.hull).toBe(hull0);
    expect(asteroids(w).length).toBe(1); // never destroyed/deleted
  });
});
