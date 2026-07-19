// Cloaking: an enemy cycles visible -> cloaking -> cloaked -> decloaking -> visible forever,
// firing a 'decloak' special-effect event as it starts to reappear; the player's cloak-device
// pickup timer counts down the same system. [ROC-CLK-1..4]

import { describe, it, expect } from 'vitest';
import { makeWorld, type World } from '../../src/sim/world.js';
import type { Entity } from '../../src/sim/components.js';
import { cloakSystem, CLOAK_PICKUP_SEC } from '../../src/sim/systems/cloak.js';

const DT = 1 / 120;

function addCloaked(w: World): Entity {
  const id = w.nextId++;
  const e: Entity = {
    id,
    kind: 'enemy',
    pos: { x: 0, y: 0, z: 1 },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    bank: 0,
    hull: 10,
    hullMax: 10,
    cloak: { phase: 'visible', timer: 2, visibleSec: 2, transitionSec: 1, cloakedSec: 3 },
  };
  w.entities.set(id, e);
  return e;
}

function run(w: World, seconds: number): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) cloakSystem(w, DT);
}

describe('cloakSystem', () => {
  it('cycles visible -> cloaking -> cloaked -> decloaking -> visible on the authored timings', () => {
    const w = makeWorld(1);
    const e = addCloaked(w);

    run(w, 2 - 2 * DT); // just before the visible phase ends
    expect(e.cloak!.phase).toBe('visible');
    run(w, 4 * DT); // cross the boundary with a little headroom against fp rounding
    expect(e.cloak!.phase).toBe('cloaking');

    run(w, 1 + 2 * DT); // transitionSec, plus headroom
    expect(e.cloak!.phase).toBe('cloaked');

    run(w, 3 + 2 * DT); // cloakedSec, plus headroom
    expect(e.cloak!.phase).toBe('decloaking');

    run(w, 1 + 2 * DT); // transitionSec, plus headroom
    expect(e.cloak!.phase).toBe('visible');
    expect(e.cloak!.timer).toBeCloseTo(2, 1); // restarts the visible window
  });

  it('fires the decloak special-effect events exactly as it starts reappearing', () => {
    const w = makeWorld(1);
    const e = addCloaked(w);
    run(w, 2 + 2 * DT); // through visible -> cloaking, with headroom
    expect(e.cloak!.phase).toBe('cloaking');
    run(w, 1 + 2 * DT); // through cloaking -> cloaked
    expect(e.cloak!.phase).toBe('cloaked');
    expect(w.events.filter((ev) => ev.type === 'decloak')).toHaveLength(0);

    run(w, 3 + 2 * DT); // through cloaked -> decloaking: the special effect fires here
    expect(e.cloak!.phase).toBe('decloaking');
    expect(w.events.filter((ev) => ev.type === 'decloak')).toHaveLength(1);
    expect(w.events.some((ev) => ev.type === 'sfx' && ev.id === 'decloak')).toBe(true);
  });

  it('never emits decloak events for a dying entity', () => {
    const w = makeWorld(1);
    const e = addCloaked(w);
    e.dying = true;
    run(w, 10);
    expect(e.cloak!.phase).toBe('visible'); // frozen — no longer ticked
    expect(w.events.filter((ev) => ev.type === 'decloak')).toHaveLength(0);
  });

  it('counts down the player cloak-device timer to zero and no further', () => {
    const w = makeWorld(1);
    w.player.cloakTtl = CLOAK_PICKUP_SEC;
    run(w, CLOAK_PICKUP_SEC - 1);
    expect(w.player.cloakTtl).toBeCloseTo(1, 6);
    run(w, 5);
    expect(w.player.cloakTtl).toBe(0);
  });
});
