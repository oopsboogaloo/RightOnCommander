// T5a.7 scenario: the docking sequence — the 2x Coriolis scrolls in and holds while rotating,
// guns and missiles are disabled, entering the port while it is within 30° of horizontal docks,
// and a collision costs a life but still reaches the shop. [ROC-DCKG-1..4]

import { describe, it, expect } from 'vitest';
import { makeSim, emptyInput } from '../harness.js';
import { PLAYER_ID } from '../../src/sim/world.js';
import type { Sim } from '../../src/sim/index.js';
import type { Entity } from '../../src/sim/components.js';
import type { InputFrame } from '../../src/interfaces.js';
import { loadContent } from '../../src/sim/content/loadContent.js';
import { enterLevelState, DOCK_STATION } from '../../src/sim/systems/levelstate.js';

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

  it('docks when the player enters the port within 30° of horizontal', () => {
    const sim = makeSim(1, content);
    startDocking(sim);
    const st = station(sim)!;
    st.pos.z = DOCK_STATION.holdZ;
    st.vel = { x: 0, y: 0, z: 0 };
    st.bank = Math.PI / 12; // 15° — inside the tolerance [ROC-DCKG-3]
    sim.state.entities.get(PLAYER_ID)!.pos = { ...st.pos };

    const events = sim.step(emptyInput());
    expect(sim.state.levelState).toBe('DOCK');
    expect(events.some((e) => e.type === 'docked')).toBe(true);
    expect(events.some((e) => e.type === 'dock')).toBe(true); // shop screen entry [ROC-LVL-1]
    expect(sim.state.player.lives).toBe(3); // clean dock, no life lost
  });

  it('kills on a collision (misaligned port), then still reaches the shop with a life lost', () => {
    const sim = makeSim(1, content);
    startDocking(sim);
    const st = station(sim)!;
    st.pos.z = DOCK_STATION.holdZ;
    st.vel = { x: 0, y: 0, z: 0 };
    st.bank = Math.PI / 4; // 45° — the doors are closed [ROC-DCKG-3]
    sim.state.entities.get(PLAYER_ID)!.pos = { ...st.pos };

    sim.step(emptyInput());
    expect(sim.state.player.lives).toBe(2); // collision = death [ROC-DCKG-4]
    expect(sim.state.levelState).toBe('DOCK'); // the dock is not retried [ROC-DCKG-4]
  });

  it('kills on hull contact away from the port', () => {
    const sim = makeSim(1, content);
    startDocking(sim);
    const st = station(sim)!;
    st.pos.z = DOCK_STATION.holdZ;
    st.vel = { x: 0, y: 0, z: 0 };
    st.bank = 0; // aligned — but the player hits the hull, not the slot
    const p = sim.state.entities.get(PLAYER_ID)!;
    p.pos = { x: st.pos.x + 0.1, y: 0, z: st.pos.z + 0.3 }; // inside the body, off the corridor

    sim.step(emptyInput());
    expect(sim.state.player.lives).toBe(2); // [ROC-DCKG-4]
    expect(sim.state.levelState).toBe('DOCK');
  });
});
