// T5a.3: boss ECM — a player missile in flight arms a 300 ms fuse; on expiry every player
// missile detonates harmlessly (screen flash + "ECM" caption via events), then a 500 ms
// cooldown gates the next firing; the whole effect dies with the boss. [ROC-BECM-1..4]

import { describe, it, expect } from 'vitest';
import { makeWorld, type World } from '../../src/sim/world.js';
import type { Entity } from '../../src/sim/components.js';
import { ecmSystem, DEFAULT_ECM } from '../../src/sim/systems/ecm.js';

const DT = 1 / 120;

function addBoss(w: World, ecm = true): Entity {
  const id = w.nextId++;
  const e: Entity = {
    id,
    kind: 'boss',
    pos: { x: 0, y: 0, z: 1 },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    bank: 0,
    hull: 10,
    hullMax: 10,
    ecm,
  };
  w.entities.set(id, e);
  return e;
}

function addMissile(w: World): Entity {
  const id = w.nextId++;
  const e: Entity = {
    id,
    kind: 'missile',
    team: 'player',
    pos: { x: 0, y: 0, z: 0.3 },
    vel: { x: 0, y: 0, z: 2 },
    yaw: 0,
    bank: 0,
    hull: 1,
  };
  w.entities.set(id, e);
  return e;
}

const missiles = (w: World): Entity[] => [...w.entities.values()].filter((e) => e.kind === 'missile');

function run(w: World, seconds: number): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) ecmSystem(w, DT);
}

describe('boss ECM', () => {
  it('detonates all player missiles 300 ms after launch, harmlessly', () => {
    const w = makeWorld(1);
    addBoss(w);
    addMissile(w);
    addMissile(w);

    run(w, DEFAULT_ECM.fuseSec - 2 * DT); // just before the fuse
    expect(missiles(w)).toHaveLength(2);
    expect(w.events.some((e) => e.type === 'ecm')).toBe(false);

    run(w, 4 * DT); // across the fuse
    expect(missiles(w)).toHaveLength(0); // [ROC-BECM-1]
    expect(w.events.filter((e) => e.type === 'ecm')).toHaveLength(1); // flash + caption, once
    expect(w.events.filter((e) => e.type === 'ecmDetonate')).toHaveLength(2); // one puff each
    expect(w.events.some((e) => e.type === 'destroyed')).toBe(false); // harmless — no damage path
    expect(w.ecm.cooldown).toBeGreaterThan(0); // [ROC-BECM-2]
  });

  it('honours the 500 ms cooldown before re-arming', () => {
    const w = makeWorld(1);
    addBoss(w);
    addMissile(w);
    run(w, DEFAULT_ECM.fuseSec + 2 * DT); // first firing
    expect(missiles(w)).toHaveLength(0);

    addMissile(w); // immediately relaunch
    run(w, DEFAULT_ECM.fuseSec + 2 * DT); // fuse-length later the cooldown still holds
    expect(missiles(w)).toHaveLength(1); // not yet detonated

    run(w, DEFAULT_ECM.cooldownSec); // cooldown passes -> re-arms -> fires again
    expect(missiles(w)).toHaveLength(0);
  });

  it('dies with the boss: missiles fired afterwards fly unaffected', () => {
    const w = makeWorld(1);
    const boss = addBoss(w);
    addMissile(w);
    run(w, 0.1); // fuse armed but not expired
    w.entities.delete(boss.id); // boss destroyed mid-fuse

    run(w, 2); // plenty of time — nothing may fire
    expect(missiles(w)).toHaveLength(1); // [ROC-BECM-4]
    expect(w.events.some((e) => e.type === 'ecm')).toBe(false);
  });

  it('ignores missiles when the boss has no ECM', () => {
    const w = makeWorld(1);
    addBoss(w, false);
    addMissile(w);
    run(w, 2);
    expect(missiles(w)).toHaveLength(1);
  });
});
