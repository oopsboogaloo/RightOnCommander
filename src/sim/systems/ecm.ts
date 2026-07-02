// Boss ECM. While an ECM-carrying boss is alive, a player missile in flight arms a short fuse;
// when it expires the screen flashes, "ECM" shows at the bottom, and every player missile
// detonates harmlessly (no damage to anything). A cooldown then gates the next firing. The whole
// effect dies with the boss — missiles fired afterwards are unaffected. The player cannot lean
// on missiles against these bosses and must win on aim. [requirements §3.23, ROC-BECM-1..4]

import type { World } from '../world.js';

export interface EcmConfig {
  fuseSec: number; // delay between a missile launch and the ECM firing [ROC-BECM-1]
  cooldownSec: number; // minimum gap between firings [ROC-BECM-2]
}

export const DEFAULT_ECM: EcmConfig = {
  fuseSec: 0.3,
  cooldownSec: 0.5,
};

export function ecmSystem(world: World, dt: number, cfg: EcmConfig = DEFAULT_ECM): void {
  const s = world.ecm;
  if (s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - dt);

  let bossEcmAlive = false;
  let missiles = 0;
  for (const e of world.entities.values()) {
    if (e.kind === 'boss' && e.ecm && (e.hull ?? 0) > 0) bossEcmAlive = true;
    else if (e.kind === 'missile' && e.team === 'player') missiles++;
  }

  // The ECM ends with the boss: disarm any pending fuse immediately. [ROC-BECM-4]
  if (!bossEcmAlive) {
    s.fuse = -1;
    return;
  }

  if (s.fuse >= 0) {
    s.fuse -= dt;
    if (s.fuse <= 0) {
      s.fuse = -1;
      s.cooldown = cfg.cooldownSec;
      // Harmless detonation: the missiles simply vanish in a puff — no damage path is touched.
      for (const e of [...world.entities.values()]) {
        if (e.kind !== 'missile' || e.team !== 'player') continue;
        world.events.push({ type: 'ecmDetonate', pos: { ...e.pos } });
        world.entities.delete(e.id);
        world.pool.missiles.push(e);
      }
      world.events.push({ type: 'ecm' }); // shell: screen flash + "ECM" caption [ROC-BECM-1,3]
      world.events.push({ type: 'sfx', id: 'ecm' });
    }
  } else if (s.cooldown <= 0 && missiles > 0) {
    s.fuse = cfg.fuseSec; // a missile in flight arms the fuse [ROC-BECM-1]
  }
}
