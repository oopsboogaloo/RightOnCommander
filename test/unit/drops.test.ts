// §3.20: enemies sometimes shed cargo on death; Alien Items only from Thargoids; explicit
// power-up drops still work; cargo never spawns without the rng (deterministic). [ROC-CARGO-1,5]

import { describe, it, expect } from 'vitest';
import { makeWorld } from '../../src/sim/world.js';
import { createRng } from '../../src/sim/rng.js';
import { vec3 } from '../../src/sim/math/vec3.js';
import { dropsSystem, COMMODITIES, ALIEN_ITEMS } from '../../src/sim/systems/drops.js';
import type { EntityKind } from '../../src/sim/components.js';

function cargoFrom(seed: number, kind: EntityKind, meshId: string | undefined, n: number): string[] {
  const w = makeWorld(1);
  const rng = createRng(seed);
  for (let i = 0; i < n; i++) {
    w.events = [{ type: 'destroyed', kind, pos: vec3(0, 0, 0), meshId }];
    dropsSystem(w, rng);
  }
  return [...w.entities.values()].filter((e) => e.kind === 'pickup' && e.pickup?.type === 'cargo').map((e) => e.pickup!.commodity!);
}

describe('cargo drops', () => {
  it('sometimes drops a market commodity from a downed fighter', () => {
    const drops = cargoFrom(3, 'enemy', 'sidewinder', 60);
    expect(drops.length).toBeGreaterThan(0); // "sometimes"
    expect(drops.length).toBeLessThan(60); // ...not always
    for (const c of drops) expect(COMMODITIES).toContain(c);
  });

  it('never drops Alien Items from a non-Thargoid', () => {
    const drops = cargoFrom(7, 'enemy', 'krait', 200);
    expect(drops).not.toContain(ALIEN_ITEMS); // [ROC-CARGO-5]
    expect(COMMODITIES).not.toContain(ALIEN_ITEMS);
  });

  it('a Thargoid may drop Alien Items', () => {
    const drops = cargoFrom(1, 'boss', 'thargoid', 400);
    for (const c of drops) expect([...COMMODITIES, ALIEN_ITEMS]).toContain(c);
    expect(drops).toContain(ALIEN_ITEMS);
  });

  it('honours an explicit power-up drop and needs no rng for it', () => {
    const w = makeWorld(1);
    w.events = [{ type: 'destroyed', kind: 'boss', pos: vec3(0, 0, 0), drops: 'laser' }];
    dropsSystem(w); // no rng
    const pickups = [...w.entities.values()].filter((e) => e.kind === 'pickup');
    expect(pickups).toHaveLength(1);
    expect(pickups[0].pickup?.type).toBe('laser');
  });

  it('a destroyed transporter always drops a significant haul', () => {
    for (const seed of [1, 2, 3]) {
      const w = makeWorld(1);
      const rng = createRng(seed);
      w.events = [{ type: 'destroyed', kind: 'enemy', pos: vec3(0, 0, 0), meshId: 'transporter' }];
      dropsSystem(w, rng);
      const loot = [...w.entities.values()].filter((e) => e.kind === 'pickup');
      expect(loot).toHaveLength(1); // always [ROC-TR-4]
      expect(['Platinum', 'Gold', 'Gem-Stones', 'Computers']).toContain(loot[0].pickup?.commodity);
    }
  });

  it('drops no cargo when called without an rng', () => {
    const w = makeWorld(1);
    w.events = [{ type: 'destroyed', kind: 'enemy', pos: vec3(0, 0, 0), meshId: 'sidewinder' }];
    dropsSystem(w);
    expect([...w.entities.values()].some((e) => e.kind === 'pickup')).toBe(false);
  });

  it('a cracked splinter sometimes yields mined loot (alloys, gems, or raw cargo)', () => {
    const w = makeWorld(1);
    const rng = createRng(2);
    for (let i = 0; i < 60; i++) {
      w.events = [{ type: 'destroyed', kind: 'asteroid', pos: vec3(0, 0, 0), meshId: 'splinter' }];
      dropsSystem(w, rng);
    }
    const pickups = [...w.entities.values()].filter((e) => e.kind === 'pickup');
    expect(pickups.length).toBeGreaterThan(0); // "sometimes" [ROC-L1-3]
    expect(pickups.length).toBeLessThan(60); // ...not always
    for (const p of pickups) {
      expect(['alloys', 'gems', 'cargo']).toContain(p.pickup?.type);
      if (p.pickup?.type === 'cargo') expect(['Metals', 'Crystals']).toContain(p.pickup.commodity);
    }
  });

  it('a large asteroid never drops loot directly (only its splinters can)', () => {
    const w = makeWorld(1);
    const rng = createRng(5);
    for (let i = 0; i < 40; i++) {
      w.events = [{ type: 'destroyed', kind: 'asteroid', pos: vec3(0, 0, 0), meshId: 'asteroid' }];
      dropsSystem(w, rng);
    }
    expect([...w.entities.values()].some((e) => e.kind === 'pickup')).toBe(false);
  });
});
