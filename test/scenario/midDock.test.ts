// Mid-level trader: a transporter (50% larger than the ones fought in waves) stands in for a
// full station between the mid-boss and wavesB — same "scroll in, hold, open the shop" backdrop
// mechanic as the end-of-level Coriolis, just no ship purchases. Leaving it resumes wavesB in the
// same level/run, not a level restart. [ROC-MDCK-1,2,3]

import { describe, it, expect } from 'vitest';
import { makeSim, emptyInput } from '../harness.js';
import { PLAYER_ID } from '../../src/sim/world.js';
import type { Sim } from '../../src/sim/index.js';
import type { Entity } from '../../src/sim/components.js';
import type { InputFrame } from '../../src/interfaces.js';
import { loadContent } from '../../src/sim/content/loadContent.js';
import { enterLevelState, DOCK_SETTLE_SEC } from '../../src/sim/systems/levelstate.js';

const settleSteps = Math.ceil((DOCK_SETTLE_SEC + 0.1) * 120);
const MID_DOCK_TRADER = { meshId: 'transporter', scale: 1.5, spawnZ: 2.4, holdZ: 0.55, approachSpeed: 0.4 };

const firing = (): InputFrame => ({ ...emptyInput(), firing: true });

const content = {
  enemies: {
    grunt: { hull: 1, bounty: 5, colliderRx: 0.2, colliderRz: 0.2 },
    midboss: { hull: 1, bounty: 100, colliderRx: 0.3, colliderRz: 0.3 },
    endboss: { hull: 1, bounty: 100, colliderRx: 0.3, colliderRz: 0.3 },
  },
  levels: [{
    id: 'tiny',
    launchMs: 20,
    wavesA: [{ id: 'a', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 200 }],
    midBoss: 'midboss',
    wavesB: [{ id: 'b', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 200 }],
    endBoss: 'endboss',
  }],
};

const trader = (sim: Sim): Entity | undefined =>
  [...sim.state.entities.values()].find(
    (e) => e.kind === 'station' && (e.ai as { kind?: string })?.kind === 'dock',
  );

// Jump straight into MID_DOCKING (the FSM path there is covered by the levelstate tests).
function startMidDocking(sim: Sim): void {
  for (const e of [...sim.state.entities.values()]) {
    if (e.kind === 'station') sim.state.entities.delete(e.id);
  }
  const { enemies, levels } = loadContent(content);
  enterLevelState(sim.state, 'MID_DOCKING', levels[0], { enemies });
}

describe('mid-level trader', () => {
  it('spawns 50% larger than a wave transporter, facing up-screen, with no roll', () => {
    const sim = makeSim(1, content);
    startMidDocking(sim);
    const st = trader(sim)!;
    expect(st.meshId).toBe(MID_DOCK_TRADER.meshId);
    expect(st.scale).toBe(1.5); // wave transporters draw at 1x [ROC-MDCK-1]
    expect(st.yaw).toBe(0); // facing up-screen
    expect(st.pos.z).toBeGreaterThan(2); // enters from beyond the top

    const bank0 = st.bank;
    for (let i = 0; i < 120 * 8; i++) sim.step(emptyInput());
    expect(st.pos.z).toBe(MID_DOCK_TRADER.holdZ); // scrolled in and held
    expect(st.bank).toBe(bank0); // no roll, unlike the Coriolis's slow spin
  });

  it('disables guns and missiles during the approach', () => {
    const sim = makeSim(1, content);
    startMidDocking(sim);
    sim.state.player.missileGrade = 1;
    sim.state.player.missileTimer = 60;
    for (let i = 0; i < 240; i++) sim.step(firing());
    const armed = [...sim.state.entities.values()].filter(
      (e) => (e.kind === 'projectile' || e.kind === 'missile') && e.team === 'player',
    );
    expect(armed).toHaveLength(0); // [ROC-MDCK-1]
  });

  it('opens the shop automatically a beat after the trader holds — no input needed', () => {
    const sim = makeSim(1, content);
    startMidDocking(sim);
    const st = trader(sim)!;
    st.pos.z = MID_DOCK_TRADER.holdZ;
    st.vel = { x: 0, y: 0, z: 0 };

    const all: { type: string }[] = [];
    for (let i = 0; i < settleSteps; i++) all.push(...sim.step(emptyInput()));

    expect(sim.state.levelState).toBe('MID_DOCK');
    expect(all.some((e) => e.type === 'midDocked')).toBe(true);
    expect(all.some((e) => e.type === 'midDock')).toBe(true); // shop screen entry
  });

  it('does not advance until the trader is fully in view', () => {
    const sim = makeSim(1, content);
    startMidDocking(sim);
    const st = trader(sim)!;
    st.pos.z = MID_DOCK_TRADER.holdZ + 0.6; // still scrolling in
    st.vel = { x: 0, y: 0, z: -MID_DOCK_TRADER.approachSpeed };

    for (let i = 0; i < settleSteps; i++) sim.step(emptyInput());
    expect(sim.state.levelState).toBe('MID_DOCKING'); // hasn't held long enough yet
  });

  it('midDockLaunch resumes wavesB in the same level and run — no restart, no campaign advance', () => {
    const sim = makeSim(1, content);
    startMidDocking(sim);
    const st = trader(sim)!;
    st.pos.z = MID_DOCK_TRADER.holdZ;
    st.vel = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < settleSteps; i++) sim.step(emptyInput());
    expect(sim.state.levelState).toBe('MID_DOCK');

    const levelIndexBefore = sim.state.levelIndex;
    const p = sim.state.entities.get(PLAYER_ID)!;
    p.hull = 0;
    p.shield = 0;

    sim.midDockLaunch();

    expect(sim.state.levelState).toBe('WAVES_B'); // resumes in place, not a restart
    expect(sim.state.levelIndex).toBe(levelIndexBefore); // same level, no campaign advance
    expect(p.hull).toBe(p.hullMax); // repaired, same as the real station gives on relaunch
    expect(p.shield).toBe(p.shieldMax);
    expect([...sim.state.entities.values()].some((e) => e.kind === 'station')).toBe(false); // trader gone
  });
});
