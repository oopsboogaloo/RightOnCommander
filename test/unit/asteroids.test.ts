// Drifting asteroid field: spawn cadence, free tumble (independent of heading/motion), drift,
// off-field culling, and fragmenting a destroyed large asteroid into faster splinters — but a
// splinter itself is terminal (no further split). [ROC-L1-1]

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import {
  startAsteroidField,
  asteroidFieldSystem,
  asteroidSplitSystem,
} from '../../src/sim/systems/asteroids.js';

const DT = 1 / 120;
const asteroids = (w: ReturnType<typeof makeWorld>) => [...w.entities.values()].filter((e) => e.kind === 'asteroid');

describe('asteroid field', () => {
  it('spawns members spaced over time up to count', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    startAsteroidField(w, { count: 3, spacingMs: 100 });

    asteroidFieldSystem(w, rng, DT);
    expect(asteroids(w).length).toBe(1); // first spawns immediately

    for (let i = 0; i < 40; i++) asteroidFieldSystem(w, rng, DT); // ~0.3s elapses
    expect(asteroids(w).length).toBe(3);
    expect(w.asteroidField?.pending).toBe(0);
  });

  it('tumbles freely: yaw and bank advance independently of position/heading', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    startAsteroidField(w, { count: 1, spacingMs: 0 });
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
    startAsteroidField(w, { count: 1, spacingMs: 0, speed: 5 }); // fast, so it culls quickly
    asteroidFieldSystem(w, rng, DT);
    expect(asteroids(w).length).toBe(1);

    for (let i = 0; i < 200; i++) asteroidFieldSystem(w, rng, DT);
    expect(asteroids(w).length).toBe(0); // drifted off-field
  });

  it('fragments a destroyed large asteroid into 2-3 faster splinters', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    w.events = [
      { type: 'destroyed', kind: 'asteroid', meshId: 'asteroid', pos: vec3(0.1, 0, 0.2), vel: vec3(0, 0, -0.28) },
    ];
    asteroidSplitSystem(w, rng);

    const children = asteroids(w);
    expect(children.length).toBeGreaterThanOrEqual(2);
    expect(children.length).toBeLessThanOrEqual(3);
    for (const c of children) {
      expect(c.meshId).toBe('splinter');
      expect(c.bounty).toBeGreaterThan(0); // terminal fragment rewards the kill [ROC-L1-3]
      const speed = Math.hypot(c.vel.x, c.vel.z);
      expect(speed).toBeGreaterThan(0.28); // faster than the parent's drift
    }
  });

  it('never splits a destroyed splinter (terminal fragment)', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    w.events = [{ type: 'destroyed', kind: 'asteroid', meshId: 'splinter', pos: vec3(), vel: vec3() }];
    asteroidSplitSystem(w, rng);
    expect(asteroids(w).length).toBe(0);
  });
});
