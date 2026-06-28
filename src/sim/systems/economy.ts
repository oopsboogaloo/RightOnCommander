// Economy: bounty on kill flows to both the spendable wallet and the lifetime score, with
// floating bounty text. Two counters: wallet is reduced by purchases; score is a monotonic
// running total of all credits earned. The wave-clear bonus (ROC-ECO-1a/1b) lands in T4.2.
// [tasks T3.3, design §11, ROC-ECO-1,2]

import type { Vec3 } from '../math/vec3.js';
import type { World } from '../world.js';

// Add earned credits to both counters and emit floating bounty text. [ROC-ECO-1]
export function awardBounty(world: World, bounty: number, pos?: Vec3): void {
  if (bounty <= 0) return;
  world.econ.wallet += bounty;
  world.econ.score += bounty; // lifetime/gross, never reduced [ROC-ECO-2]
  world.events.push({ type: 'floatingText', category: 'bounty', text: `+${bounty}`, pos: pos ? { ...pos } : undefined });
}

// Award bounty for every ship destroyed this step (from damage's `destroyed` events).
export function economySystem(world: World): void {
  for (const ev of world.events.filter((e) => e.type === 'destroyed')) {
    const bounty = typeof ev.bounty === 'number' ? ev.bounty : 0;
    awardBounty(world, bounty, ev.pos as Vec3 | undefined);
  }
}

export function canAfford(world: World, amount: number): boolean {
  return world.econ.wallet >= amount;
}

// Spend from the wallet only; the lifetime score is untouched. [ROC-ECO-2]
export function spend(world: World, amount: number): boolean {
  if (!canAfford(world, amount)) return false;
  world.econ.wallet -= amount;
  return true;
}
