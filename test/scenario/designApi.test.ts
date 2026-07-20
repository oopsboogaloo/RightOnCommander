// sim.design (wave-designer-spec.md): entering only works in a designable phase, content()
// reflects live add/remove, and replayTo() is deterministic regardless of which direction the
// scrub took to reach a given frame — the forward-shortcut optimization must never diverge from
// a full reset-and-replay.

import { describe, it, expect } from 'vitest';
import { createSim } from '../../src/sim/index.js';
import type { InputFrame } from '../../src/interfaces.js';
import type { LevelDef } from '../../src/sim/systems/levelstate.js';

const NEUTRAL: InputFrame = { moveTarget: null, firing: false, fireTapped: false, ecm: false, energyBomb: false, confirm: false, pause: false };

const enemies = { grunt: { hull: 5, bounty: 10 } };
const level: LevelDef = {
  id: 'l1',
  wavesA: [{ id: 'a1', pattern: 'vform', enemy: 'grunt', count: 3, spacingMs: 300, durationMs: 4000 }],
  midBoss: 'grunt',
  wavesB: [],
  endBoss: 'grunt',
};

function makeSim(): ReturnType<typeof createSim> {
  return createSim({ seed: 1, content: { enemies, levels: [level] } });
}

function advanceToWavesA(sim: ReturnType<typeof createSim>): void {
  for (let i = 0; i < 4000 && sim.state.levelState !== 'WAVES_A'; i++) sim.step(NEUTRAL);
  expect(sim.state.levelState).toBe('WAVES_A');
}

describe('sim.design.enter', () => {
  it('fails outside a designable phase', () => {
    const sim = makeSim();
    expect(sim.state.levelState).toBe('LAUNCH');
    expect(sim.design.enter()).toBe(false);
    expect(sim.design.content()).toBeNull();
  });

  it('succeeds once WAVES_A is reached', () => {
    const sim = makeSim();
    advanceToWavesA(sim);
    expect(sim.design.enter()).toBe(true);
    expect(sim.design.content()?.phase).toBe('WAVES_A');
  });
});

describe('sim.design content mutation', () => {
  it('add/remove immediately show up in content()', () => {
    const sim = makeSim();
    advanceToWavesA(sim);
    sim.design.enter();
    expect(sim.design.content()?.waves.map((w) => w.id)).toEqual(['a1']);

    sim.design.addWave({ id: 'a2', pattern: 'loop', enemy: 'grunt', count: 2, spacingMs: 200 });
    expect(sim.design.content()?.waves.map((w) => w.id)).toEqual(['a1', 'a2']);

    sim.design.removeWave('a1');
    expect(sim.design.content()?.waves.map((w) => w.id)).toEqual(['a2']);
  });

  // enterLevelState() is what turns content into live wave records, and it only runs once at
  // phase entry — a naive implementation could mutate the content array without ever actually
  // registering the new wave against the replay base. [wave-designer-spec.md]
  it('a wave added after enter() actually spawns members during replay, not just in content()', () => {
    const sim = makeSim();
    advanceToWavesA(sim);
    sim.design.enter();

    sim.design.addWave({ id: 'a2', pattern: 'loop', enemy: 'grunt', count: 1, spacingMs: 0, delayMs: 0 });
    sim.design.replayTo(60); // half a second in — long enough for an instant (spacingMs:0) member to spawn

    const enemyCount = [...sim.state.entities.values()].filter((e) => e.kind === 'enemy').length;
    expect(enemyCount).toBeGreaterThan(0);
  });

  it('removing a wave means its members never spawn on the next replay', () => {
    const sim = makeSim();
    advanceToWavesA(sim);
    sim.design.enter();
    sim.design.replayTo(60);
    expect([...sim.state.entities.values()].some((e) => e.kind === 'enemy')).toBe(true);

    sim.design.removeWave('a1');
    sim.design.replayTo(60);
    expect([...sim.state.entities.values()].some((e) => e.kind === 'enemy')).toBe(false);
  });
});

describe('sim.design.replayTo determinism', () => {
  it('reaching the same frame via forward-then-back-then-forward matches a direct replay', () => {
    const sim = makeSim();
    advanceToWavesA(sim);
    sim.design.enter();

    sim.design.replayTo(500);
    const direct = sim.snapshot();

    sim.design.replayTo(800); // forward past it (cheap incremental path)
    sim.design.replayTo(100); // back before it (forces a full reset+replay)
    sim.design.replayTo(500); // forward again, back to the same target
    const viaDetour = sim.snapshot();

    expect(viaDetour.entities).toEqual(direct.entities);
    expect(viaDetour.frame).toBe(direct.frame);
    expect(viaDetour.rngState).toBe(direct.rngState);
  });

  it('replaying to 0 matches the phase\'s freshly-entered state', () => {
    const sim = makeSim();
    advanceToWavesA(sim);
    sim.design.enter();
    const fresh = sim.snapshot();

    sim.design.replayTo(200);
    sim.design.replayTo(0);

    expect(sim.snapshot().entities).toEqual(fresh.entities);
  });

  it('is a no-op before enter() has been called', () => {
    const sim = makeSim();
    const before = sim.snapshot();
    sim.design.replayTo(500);
    expect(sim.snapshot()).toEqual(before);
  });
});
