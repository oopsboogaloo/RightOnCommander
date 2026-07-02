// T5a.4/5: boss behaviours — the FdL's rounded-rectangle strafe track (continuity, random
// direction reversals within [200 ms, 2000 ms], 400 ms aimed cadence) and the hermit's escort
// launcher (5 s cadence, 3-alive cap, rock-angle launches, flee on death, whole-fight wave
// bonus). [ROC-HERM-3..6,11,12, ROC-FDL-3,4]

import { describe, it, expect } from 'vitest';
import { makeWorld, type World } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import type { Entity } from '../../src/sim/components.js';
import type { WaveContext } from '../../src/sim/systems/waves.js';
import { waveSystem } from '../../src/sim/systems/waves.js';
import {
  bossSystem,
  bossPlacement,
  trackPoint,
  trackPerimeter,
  FDL_TRACK,
  FDL_FLIP_RANGE,
  FDL_FIRE_RATE,
  HERMIT_SPAWN_SEC,
  HERMIT_ESCORT_CAP,
  HERMIT_SPIN,
} from '../../src/sim/systems/boss.js';

const DT = 1 / 120;

const ctx: WaveContext = {
  enemies: {
    adder: { hull: 2, bounty: 16, meshId: 'adder', colliderRx: 0.22, colliderRz: 0.22 },
  },
};

function spawnHermit(w: World): Entity {
  const place = bossPlacement('hermit');
  const id = w.nextId++;
  const e: Entity = {
    id,
    kind: 'boss',
    pos: { ...place.pos },
    vel: { x: 0, y: 0, z: 0 },
    yaw: place.yaw,
    bank: 0,
    hull: 30,
    hullMax: 30,
    port: place.port,
    ai: place.ai,
  };
  w.entities.set(id, e);
  const recId = w.nextId++;
  w.waves.active.set(recId, {
    members: new Set(),
    total: 0,
    bountySum: 0,
    killed: 0,
    escaped: false,
    spawn: null,
    open: true,
  });
  w.hermitWaveId = recId;
  return e;
}

function spawnStrafe(w: World): Entity {
  const place = bossPlacement('strafe');
  const id = w.nextId++;
  const e: Entity = {
    id,
    kind: 'boss',
    pos: { ...place.pos },
    vel: { x: 0, y: 0, z: 0 },
    yaw: place.yaw,
    bank: 0,
    hull: 24,
    hullMax: 24,
    shield: 8,
    shieldMax: 8,
    ai: place.ai,
  };
  w.entities.set(id, e);
  return e;
}

const escorts = (w: World): Entity[] =>
  [...w.entities.values()].filter((e) => e.kind === 'enemy' && (e.ai as { kind?: string })?.kind === 'escort');

describe('strafe track', () => {
  it('is continuous and wraps the perimeter', () => {
    const P = trackPerimeter(FDL_TRACK);
    for (let s = 0; s < P; s += 0.01) {
      const a = trackPoint(FDL_TRACK, s);
      const b = trackPoint(FDL_TRACK, s + 0.01);
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.02); // no jumps
    }
    const w0 = trackPoint(FDL_TRACK, 0.3);
    const w1 = trackPoint(FDL_TRACK, 0.3 + P);
    expect(w1.x).toBeCloseTo(w0.x, 10);
    expect(w1.z).toBeCloseTo(w0.z, 10);
  });

  it('moves the boss continuously at track speed and reverses within [200, 2000] ms', () => {
    const w = makeWorld(1);
    const rng = createRng(7);
    const boss = spawnStrafe(w);
    const ai = boss.ai as { dir: 1 | -1; rate: number };
    expect(ai.rate).toBe(FDL_FIRE_RATE); // 2.5/s = one aimed shot every 400 ms [ROC-FDL-4]

    let last = { ...boss.pos };
    let lastDir = ai.dir;
    let sinceFlip = 0;
    const flips: number[] = [];
    for (let i = 0; i < Math.round(30 / DT); i++) {
      bossSystem(w, rng, DT, ctx);
      const step = Math.hypot(boss.pos.x - last.x, boss.pos.z - last.z);
      expect(step).toBeLessThanOrEqual(FDL_TRACK.speed * DT + 1e-6); // continuous, fast [ROC-FDL-3]
      last = { ...boss.pos };
      sinceFlip += DT;
      if (ai.dir !== lastDir) {
        flips.push(sinceFlip);
        sinceFlip = 0;
        lastDir = ai.dir;
      }
    }
    expect(flips.length).toBeGreaterThan(10); // it really does keep switching
    for (const gap of flips.slice(1)) {
      expect(gap).toBeGreaterThanOrEqual(FDL_FLIP_RANGE[0] - DT);
      expect(gap).toBeLessThanOrEqual(FDL_FLIP_RANGE[1] + DT);
    }
  });
});

describe('hermit', () => {
  it('rotates slowly about y and launches an adder every 5 s, capped at 3 alive', () => {
    const w = makeWorld(1);
    const rng = createRng(3);
    const hermit = spawnHermit(w);
    const yaw0 = hermit.yaw;

    const run = (sec: number): void => {
      for (let i = 0; i < Math.round(sec / DT); i++) bossSystem(w, rng, DT, ctx);
    };

    run(HERMIT_SPAWN_SEC - 0.1);
    expect(escorts(w)).toHaveLength(0); // not yet
    run(0.2);
    expect(escorts(w)).toHaveLength(1); // first at 5 s [ROC-HERM-4]
    expect(hermit.yaw).toBeCloseTo(yaw0 + HERMIT_SPIN * (HERMIT_SPAWN_SEC + 0.1), 1); // [ROC-HERM-3]

    run(2 * HERMIT_SPAWN_SEC);
    expect(escorts(w)).toHaveLength(3);
    run(2 * HERMIT_SPAWN_SEC);
    expect(escorts(w)).toHaveLength(HERMIT_ESCORT_CAP); // never above the cap [ROC-HERM-4]

    // Escorts wander below the hermit — never colliding with it. [ROC-HERM-6]
    for (const e of escorts(w)) expect(e.pos.z).toBeLessThan(hermit.pos.z - 0.4);

    // The whole-fight wave record grew with every spawn. [ROC-HERM-12]
    const rec = w.waves.active.get(w.hermitWaveId!)!;
    expect(rec.total).toBe(3);
    expect(rec.bountySum).toBe(3 * 16);
    expect(rec.open).toBe(true);
  });

  it('sends survivors fleeing when destroyed; an escape forfeits, a full clear pays the bonus', () => {
    // Fleeing escape forfeits the bonus.
    const w = makeWorld(1);
    const rng = createRng(3);
    const hermit = spawnHermit(w);
    const recId = w.hermitWaveId!;
    for (let i = 0; i < Math.round(6 / DT); i++) bossSystem(w, rng, DT, ctx);
    expect(escorts(w)).toHaveLength(1);

    w.entities.delete(hermit.id); // hermit destroyed
    for (let i = 0; i < Math.round(4 / DT); i++) {
      bossSystem(w, rng, DT, ctx);
      waveSystem(w, rng, DT, ctx);
    }
    expect(escorts(w)).toHaveLength(0); // it flew off screen [ROC-HERM-11]
    expect(w.waves.active.has(recId)).toBe(false); // record resolved
    expect(w.events.some((e) => e.type === 'waveBonus')).toBe(false); // escape forfeits [ROC-HERM-12]

    // Killing every adder (fleeers included) pays 50% of the summed bounties.
    const w2 = makeWorld(1);
    const rng2 = createRng(3);
    const hermit2 = spawnHermit(w2);
    for (let i = 0; i < Math.round(6 / DT); i++) bossSystem(w2, rng2, DT, ctx);
    expect(escorts(w2)).toHaveLength(1);
    w2.entities.delete(hermit2.id);
    bossSystem(w2, rng2, DT, ctx); // closes the record, escorts turn to flee
    for (const e of escorts(w2)) w2.entities.delete(e.id); // shot down before exiting
    waveSystem(w2, rng2, DT, ctx); // reconcile + resolve
    const bonus = w2.events.find((e) => e.type === 'waveBonus');
    expect(bonus?.amount).toBe(0.5 * 16); // [ROC-HERM-12, ROC-ECO-1a]
  });
});
