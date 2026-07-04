// T5a.7 scenario: the end-of-level station — the 2x Coriolis scrolls in and holds while rotating,
// guns and missiles are disabled, and once it is fully in view the shop opens automatically after
// a short beat. The station is a backdrop: no collision, no fly-in docking. [ROC-DCKG-1,2]

import { describe, it, expect } from 'vitest';
import { makeSim, emptyInput } from '../harness.js';
import { PLAYER_ID } from '../../src/sim/world.js';
import type { Sim } from '../../src/sim/index.js';
import type { Entity } from '../../src/sim/components.js';
import type { InputFrame } from '../../src/interfaces.js';
import { loadContent } from '../../src/sim/content/loadContent.js';
import { enterLevelState, DOCK_STATION, DOCK_SETTLE_SEC } from '../../src/sim/systems/levelstate.js';

const settleSteps = Math.ceil((DOCK_SETTLE_SEC + 0.1) * 120);

const firing = (): InputFrame => ({ ...emptyInput(), firing: true });

const content = {
  enemies: {
    grunt: { hull: 1, bounty: 5, colliderRx: 0.2, colliderRz: 0.2 },
    midboss: { hull: 2, bounty: 100, colliderRx: 0.3, colliderRz: 0.3 },
    endboss: { hull: 2, bounty: 100, colliderRx: 0.3, colliderRz: 0.3 },
  },
  level: {
    id: 'tiny',
    launchMs: 20,
    wavesA: [{ id: 'a', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 200 }],
    midBoss: 'midboss',
    wavesB: [{ id: 'b', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 200 }],
    endBoss: 'endboss',
  },
};

const station = (sim: Sim): Entity | undefined =>
  [...sim.state.entities.values()].find(
    (e) => e.kind === 'station' && (e.ai as { kind?: string })?.kind === 'dock',
  );

// Jump the sim straight into DOCKING (the FSM path there is covered by the levelstate tests).
// The LAUNCH state already spawned a departure station — clear it so only the dock one remains.
function startDocking(sim: Sim): void {
  for (const e of [...sim.state.entities.values()]) {
    if (e.kind === 'station') sim.state.entities.delete(e.id);
  }
  const { enemies, level } = loadContent(content);
  enterLevelState(sim.state, 'DOCKING', level!, { enemies });
}

describe('docking sequence', () => {
  it('scrolls the station in, holds it, and rotates it slowly', () => {
    const sim = makeSim(1, content);
    startDocking(sim);
    const st = station(sim)!;
    expect(st.scale).toBe(DOCK_STATION.scale); // twice the old placeholder [ROC-DCKG-1]
    expect(st.port).toBe(true);
    expect(st.pos.z).toBeGreaterThan(2); // enters from beyond the top

    const bank0 = st.bank;
    for (let i = 0; i < 120 * 8; i++) sim.step(emptyInput());
    expect(st.pos.z).toBe(DOCK_STATION.holdZ); // scrolled in and held [ROC-DCKG-1]
    expect(st.bank).toBeGreaterThan(bank0); // rolling on its docking axis
    expect(sim.state.scroll).toBe(1); // the starfield keeps scrolling
  });

  it('disables guns and missiles during the approach', () => {
    const sim = makeSim(1, content);
    startDocking(sim);
    sim.state.player.missileGrade = 1;
    sim.state.player.missileTimer = 60;
    for (let i = 0; i < 240; i++) sim.step(firing());
    const armed = [...sim.state.entities.values()].filter(
      (e) => (e.kind === 'projectile' || e.kind === 'missile') && e.team === 'player',
    );
    expect(armed).toHaveLength(0); // [ROC-DCKG-2]
  });

  it('opens the shop automatically a beat after the station holds — no input needed', () => {
    const sim = makeSim(1, content);
    startDocking(sim);
    const st = station(sim)!;
    st.pos.z = DOCK_STATION.holdZ; // fully in view, holding
    st.vel = { x: 0, y: 0, z: 0 };

    const all: { type: string }[] = [];
    for (let i = 0; i < settleSteps; i++) all.push(...sim.step(emptyInput()));

    expect(sim.state.levelState).toBe('DOCK');
    expect(all.some((e) => e.type === 'docked')).toBe(true);
    expect(all.some((e) => e.type === 'dock')).toBe(true); // shop screen entry [ROC-LVL-1]
    expect(sim.state.player.lives).toBe(4); // no life lost — nothing to crash into [ROC-DCKG-1]
  });

  it('does not wait, or advance, until the station is fully in view', () => {
    const sim = makeSim(1, content);
    startDocking(sim);
    const st = station(sim)!;
    st.pos.z = DOCK_STATION.holdZ + 0.6; // still scrolling in
    st.vel = { x: 0, y: 0, z: -DOCK_STATION.approachSpeed };

    for (let i = 0; i < settleSteps; i++) sim.step(emptyInput());
    expect(sim.state.levelState).toBe('DOCKING'); // hasn't held long enough yet
  });

  it('never collides with the station hull — it is just a backdrop', () => {
    const sim = makeSim(1, content);
    startDocking(sim);
    const st = station(sim)!;
    st.pos.z = DOCK_STATION.holdZ;
    st.vel = { x: 0, y: 0, z: 0 };
    st.bank = Math.PI / 4; // an orientation that used to be a lethal misalignment
    sim.state.entities.get(PLAYER_ID)!.pos = { ...st.pos }; // parked inside the hull

    for (let i = 0; i < settleSteps; i++) sim.step(emptyInput());
    expect(sim.state.player.lives).toBe(4); // no death
    expect(sim.state.levelState).toBe('DOCK'); // and it still reaches the shop
  });
});
