// Cloaking. Two independent uses of the same idea:
//  - An enemy (the rare Cougar) cycles visible -> cloaking -> cloaked -> decloaking -> visible
//    forever, rendering as a distortion while cloaked/transitioning but always still damageable
//    and still firing — cloak is a presentation state, not invulnerability. Missiles still can't
//    lock it (missileImmune, same mechanism as the Thargoid). [ROC-CLK-1,2,3]
//  - The player's cloak-device pickup grants a flat window during which aimed enemy fire can't
//    target them (ai.ts falls back to unaimed fire); ramming/collision is unaffected. [ROC-CLK-4]

import type { World } from '../world.js';

export const CLOAK_PICKUP_SEC = 15; // player cloak-device duration [ROC-CLK-4]

export function cloakSystem(world: World, dt: number): void {
  if (world.player.cloakTtl > 0) world.player.cloakTtl = Math.max(0, world.player.cloakTtl - dt);

  for (const e of world.entities.values()) {
    if (!e.cloak || e.dying) continue;
    const c = e.cloak;
    c.timer -= dt;
    if (c.timer > 0) continue;

    switch (c.phase) {
      case 'visible':
        c.phase = 'cloaking';
        c.timer = c.transitionSec;
        break;
      case 'cloaking':
        c.phase = 'cloaked';
        c.timer = c.cloakedSec;
        break;
      case 'cloaked':
        c.phase = 'decloaking';
        c.timer = c.transitionSec;
        // The special effect + particle burst plays as it starts to reappear. [ROC-CLK-2]
        world.events.push({ type: 'decloak', pos: { ...e.pos } });
        world.events.push({ type: 'sfx', id: 'decloak' });
        break;
      case 'decloaking':
        c.phase = 'visible';
        c.timer = c.visibleSec;
        break;
    }
  }
}
