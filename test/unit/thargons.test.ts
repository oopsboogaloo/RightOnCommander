// T7.3: Thargoid launchers + Thargons, fanned enemy volleys, and the mothership boss.
// [ROC-ENM-6, ROC-ENM-11, ROC-L4-1a, ROC-L4-2]

import { describe, it, expect } from 'vitest';
import { makeWorld, PLAYER_ID, type World } from '../../src/sim/world.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import { createRng } from '../../src/sim/rng.js';
import type { Entity } from '../../src/sim/components.js';
import { launchState, type WaveContext } from '../../src/sim/systems/waves.js';
import { thargonSystem, THARGON, type ThargonAi } from '../../src/sim/systems/thargons.js';
import { aiSystem } from '../../src/sim/systems/ai.js';
import { bossSystem, bossPlacement, MOTHERSHIP, type MothershipAi } from '../../src/sim/systems/boss.js';

const DT = 1 / 120;
const ctx: WaveContext = {
  enemies: { thargon: { hull: 1, bounty: 12, meshId: 'thargoid_saucer', scale: 0.2 } },
};

function addLauncher(w: World, everySec = 1, max = 2, pos = vec3(0, 0, 0.8)): Entity {
  const id = w.nextId++;
  const e: Entity = { id, kind: 'enemy', pos, vel: vec3(), yaw: 0, bank: 0, hull: 5, launch: launchState({ enemy: 'thargon', everySec, max }) };
  w.entities.set(id, e);
  return e;
}
const thargons = (w: World) => [...w.entities.values()].filter((e) => (e.ai as ThargonAi | undefined)?.kind === 'thargon');
const bolts = (w: World) => [...w.entities.values()].filter((e) => e.kind === 'projectile' && e.team === 'enemy');
const run = (secs: number, f: () => void) => {
  for (let i = 0; i < Math.round(secs / DT); i++) f();
};

describe('Thargoid launcher', () => {
  it('launches one Thargon per interval, up to its cap of active children', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    addLauncher(w, 1, 2);
    run(0.49, () => thargonSystem(w, rng, DT, ctx));
    expect(thargons(w).length).toBe(0); // first launch half an interval in
    run(0.02, () => thargonSystem(w, rng, DT, ctx));
    expect(thargons(w).length).toBe(1);
    run(1, () => thargonSystem(w, rng, DT, ctx));
    expect(thargons(w).length).toBe(2);
    run(2, () => thargonSystem(w, rng, DT, ctx));
    expect(thargons(w).filter((e) => (e.ai as ThargonAi).state !== 'inert').length).toBeLessThanOrEqual(2);
  });

  it('only launches while the parent is on screen', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    addLauncher(w, 0.5, 4, vec3(0, 0, 2.2)); // above the top edge
    run(3, () => thargonSystem(w, rng, DT, ctx));
    expect(thargons(w).length).toBe(0);
  });
});

describe('Thargon', () => {
  it('turns toward the player no faster than its turn rate', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    w.entities.get(PLAYER_ID)!.pos = vec3(0, 0, -1.2);
    addLauncher(w, 0.2, 1);
    run(0.11, () => thargonSystem(w, rng, DT, ctx));
    const t = thargons(w)[0];
    run(THARGON.launchSec + 0.01, () => thargonSystem(w, rng, DT, ctx));
    let prev = (t.ai as ThargonAi).heading;
    for (let i = 0; i < 120; i++) {
      thargonSystem(w, rng, DT, ctx);
      const h = (t.ai as ThargonAi).heading;
      expect(Math.abs(Math.atan2(Math.sin(h - prev), Math.cos(h - prev)))).toBeLessThanOrEqual(THARGON.turnRate * DT + 1e-9);
      prev = h;
    }
    // ...and ends up pointing roughly at the player (down-screen).
    expect(Math.cos((t.ai as ThargonAi).heading - Math.atan2(-t.pos.x, -1.2 - t.pos.z))).toBeGreaterThan(0.9);
  });

  it('goes inert when its parent dies, and drifts off the field', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    const parent = addLauncher(w, 0.2, 1);
    run(0.2, () => thargonSystem(w, rng, DT, ctx));
    const t = thargons(w)[0];
    expect((t.ai as ThargonAi).state).not.toBe('inert');
    w.entities.delete(parent.id);
    thargonSystem(w, rng, DT, ctx);
    expect((t.ai as ThargonAi).state).toBe('inert');
    run(10, () => thargonSystem(w, rng, DT, ctx));
    expect(w.entities.has(t.id)).toBe(false); // culled once off the field
  });

  it('gives up the chase after chaseSec even if the parent lives', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    addLauncher(w, 100, 1); // one launch only
    run(51, () => thargonSystem(w, rng, DT, ctx)); // first launch at 50 s
    const t = thargons(w)[0];
    w.entities.get(PLAYER_ID)!.pos = vec3(0, 0, 0); // a centred target: it circles in, staying on the field
    run(THARGON.launchSec + THARGON.chaseSec - 1.1, () => thargonSystem(w, rng, DT, ctx));
    expect((t.ai as ThargonAi).state).toBe('chase');
    run(0.2, () => thargonSystem(w, rng, DT, ctx));
    expect((t.ai as ThargonAi).state).toBe('inert');
  });
});

describe('fanned volleys', () => {
  it('fires `spread` bolts per volley, fanned evenly across `arc`', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    const id = w.nextId++;
    w.entities.set(id, { id, kind: 'enemy', pos: vec3(0, 0, 1), vel: vec3(), yaw: 0, bank: 0, ai: { rate: 1, aimed: false, cooldown: 0, spread: 5, arc: 1 } });
    aiSystem(w, rng, DT);
    const b = bolts(w);
    expect(b.length).toBe(5);
    const headings = b.map((e) => Math.atan2(e.vel.x, e.vel.z)).map((h) => (h < 0 ? h + Math.PI * 2 : h)).sort();
    expect(headings[4] - headings[0]).toBeCloseTo(1, 6); // full arc
    expect(headings[2]).toBeCloseTo(Math.PI, 6); // centred straight down
  });
});

describe('Thargoid mothership', () => {
  function spawnMothership(w: World): Entity {
    const place = bossPlacement('mothership');
    const id = w.nextId++;
    const e: Entity = { id, kind: 'boss', pos: { ...place.pos }, vel: vec3(), yaw: 0, bank: 0, hull: 200, hullMax: 200, ai: place.ai };
    w.entities.set(id, e);
    return e;
  }

  it('descends from above the field, then halts the scroll and starts firing', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    w.scroll = 1;
    const m = spawnMothership(w);
    run(MOTHERSHIP.entrySec - 0.1, () => bossSystem(w, rng, DT, ctx));
    expect(w.scroll).toBe(1);
    expect(bolts(w).length).toBe(0); // holds fire while entering
    run(0.2, () => bossSystem(w, rng, DT, ctx));
    expect(w.scroll).toBe(0);
    expect(m.pos.z).toBeCloseTo(MOTHERSHIP.holdZ, 6);
    run(1, () => bossSystem(w, rng, DT, ctx));
    expect(bolts(w).length).toBeGreaterThanOrEqual(MOTHERSHIP.ringBolts); // its first ring is out
  });

  it('cycles rings -> fans -> spiral', () => {
    const w = makeWorld(1);
    const rng = createRng(1);
    const m = spawnMothership(w);
    run(MOTHERSHIP.entrySec + 0.01, () => bossSystem(w, rng, DT, ctx));
    const ai = m.ai as MothershipAi;
    expect(ai.phase).toBe('rings');
    run(MOTHERSHIP.phaseSec.rings, () => bossSystem(w, rng, DT, ctx));
    expect(ai.phase).toBe('fans');
    run(MOTHERSHIP.phaseSec.fans, () => bossSystem(w, rng, DT, ctx));
    expect(ai.phase).toBe('spiral');
  });

  it('fires faster once below half hull', () => {
    const count = (hull: number): number => {
      const w = makeWorld(1);
      const rng = createRng(1);
      const m = spawnMothership(w);
      run(MOTHERSHIP.entrySec + 0.01, () => bossSystem(w, rng, DT, ctx));
      m.hull = hull;
      let n = 0;
      run(10, () => {
        bossSystem(w, rng, DT, ctx);
        n += bolts(w).length;
        for (const b of bolts(w)) w.entities.delete(b.id);
      });
      return n;
    };
    expect(count(60)).toBeGreaterThan(count(200) * 1.3);
  });
});
