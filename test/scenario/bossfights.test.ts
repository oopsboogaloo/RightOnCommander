// T5a.1/4 scenario: boss-fight framing through the full sim — the starfield scroll stops when a
// boss fight begins, the kill emits bossKilled and holds the state while "RIGHT ON COMMANDER"
// fades, then scrolling resumes into the next phase; the hermit pays 1,000 cr and sheds 10 cargo
// canisters (no guaranteed laser drop — that's bought at a station now). [ROC-BOSS-1..4, ROC-HERM-9,10]

import { describe, it, expect } from 'vitest';
import { makeSim } from '../harness.js';
import { emptyInput } from '../harness.js';
import type { Sim } from '../../src/sim/index.js';
import type { SimEvent } from '../../src/sim/components.js';
import type { InputFrame } from '../../src/interfaces.js';

const firing = (): InputFrame => ({ ...emptyInput(), firing: true });

// Tiny content: one instantly-clearing grunt wave per phase, weak bosses the default front
// pulse laser can kill quickly. The hermit mid-boss carries the real behavior + rewards.
const content = {
  enemies: {
    grunt: { hull: 1, bounty: 5, colliderRx: 0.2, colliderRz: 0.2 },
    adder: { hull: 2, bounty: 16, colliderRx: 0.22, colliderRz: 0.22 },
    // Sturdy enough that the single missile leaking through the ECM cooldown (2 damage, x3 on
    // its port-crossing path) cannot kill it during the ECM scenario.
    hermit: { hull: 12, bounty: 1000, behavior: 'hermit', ecm: true, cargoDrops: 10, colliderRx: 0.35, colliderRz: 0.35 },
    endboss: { hull: 3, bounty: 100, colliderRx: 0.3, colliderRz: 0.3 },
  },
  levels: [{
    id: 'tiny',
    name: 'Testville',
    launchMs: 20,
    wavesA: [{ id: 'a', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 200 }],
    midBoss: 'hermit',
    wavesB: [{ id: 'b', pattern: 'sine_column', enemy: 'grunt', count: 1, spacingMs: 0, durationMs: 200 }],
    endBoss: 'endboss',
  }],
};

// Step until a predicate holds, holding fire the whole time (the player parks at the bottom
// middle, so shots fly up the boss's column). Returns the events seen.
function runUntil(sim: Sim, pred: () => boolean, maxFrames = 30000, fire = true): SimEvent[] {
  const seen: SimEvent[] = [];
  for (let i = 0; i < maxFrames && !pred(); i++) {
    // Shop for nothing and leave straight away, so a bare "run past the mid-boss" isn't stuck
    // waiting at the trader. [ROC-MDCK-2]
    if (sim.state.levelState === 'MID_DOCK') sim.midDockLaunch();
    seen.push(...sim.step(fire ? firing() : emptyInput()));
  }
  return seen;
}

describe('boss-fight framing', () => {
  it('stops the scroll for the fight, fades RIGHT ON COMMANDER, then resumes', () => {
    const sim = makeSim(1, content);
    runUntil(sim, () => sim.state.levelState === 'MID_BOSS', 30000, false);

    expect(sim.state.scroll).toBe(0); // scrolling stops when the fight begins [ROC-BOSS-1]
    const boss = [...sim.state.entities.values()].find((e) => e.kind === 'boss');
    expect(boss).toBeDefined();
    expect(boss!.pos.z).toBeGreaterThan(0.8); // middle top of the screen [ROC-HERM-2]

    // Kill the hermit with the front pulse laser.
    const events = runUntil(sim, () => sim.state.bossFadeTtl > 0);
    expect(events.some((e) => e.type === 'bossKilled')).toBe(true); // [ROC-BOSS-3]
    expect(sim.state.levelState).toBe('MID_BOSS'); // held for the fade [ROC-BOSS-4]
    expect(sim.state.scroll).toBe(0); // still parked while the text fades

    // The fade hands off to the mid-level trader, not straight to part 2 — leaving it (as if the
    // player shopped and launched) is what actually reaches WAVES_B. [ROC-MDCK-1,2]
    runUntil(sim, () => sim.state.levelState === 'MID_DOCK');
    sim.midDockLaunch();
    expect(sim.state.levelState).toBe('WAVES_B'); // part 2 plays after a mid-boss [ROC-BOSS-4]
    expect(sim.state.scroll).toBe(1); // scrolling resumed
  });

  it('pays the hermit kill: 1,000 cr and 10 cargo canisters, no guaranteed laser drop', () => {
    const sim = makeSim(1, content);
    runUntil(sim, () => sim.state.levelState === 'MID_BOSS', 30000, false);
    const before = sim.state.econ.wallet;
    runUntil(sim, () => sim.state.bossFadeTtl > 0);

    expect(sim.state.econ.wallet - before).toBeGreaterThanOrEqual(1000); // [ROC-HERM-10]
    const pickups = [...sim.state.entities.values()].filter((e) => e.kind === 'pickup');
    expect(pickups.filter((p) => p.pickup?.type === 'laser')).toHaveLength(0); // bought at a station now
    expect(pickups.filter((p) => p.pickup?.type === 'cargo').length).toBeGreaterThanOrEqual(10); // [ROC-HERM-10]
  });

  it('arms the boss ECM: player missiles pop 300 ms after launch while the hermit lives', () => {
    const sim = makeSim(1, content);
    runUntil(sim, () => sim.state.levelState === 'MID_BOSS', 30000, false);

    sim.state.player.missileGrade = 1; // as if a missiles power-up were held
    sim.state.player.missileTimer = 60;
    const events = runUntil(sim, () => false, Math.round(1.5 / (1 / 120)), false);
    expect(events.some((e) => e.type === 'ecm')).toBe(true); // flash + caption [ROC-BECM-1,3]
    expect(events.some((e) => e.type === 'ecmDetonate')).toBe(true);
    // The player can't lean on missiles: unimpeded, every volley in this window would land
    // (2 damage, x3 across the port) and kill the hermit — with ECM it survives. A missile may
    // still slip through during the 500 ms cooldown; that residual leak is by design. [ROC-BECM-2]
    const boss = [...sim.state.entities.values()].find((e) => e.kind === 'boss')!;
    expect(boss.hull!).toBeGreaterThan(0);
  });
});
