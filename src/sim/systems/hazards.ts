// Environmental level hazards. Currently just the Level 3 star: it periodically flares near the
// right-hand edge of the field, dealing damage to the player if they're caught in the danger zone
// when it lands — a slow, telegraphed threat to dodge around, in the spirit of the enemy
// projectiles' own "slow, dodgeable" design (ROC-ENM-11). [ROC-L3-1,2]

import { PLAYER_ID, type World } from '../world.js';
import { applyDamage } from './damage.js';

export interface StarFlareDef {
  intervalSec: number; // time between flares
  warnSec: number; // telegraph window before the flare actually lands
  zoneX: number; // the danger zone is x > zoneX (the star sits off the right edge) [ROC-L3-1]
  damage: number; // hull/shield damage dealt if caught in the zone when the flare lands
}

export interface HazardState {
  timer: number; // seconds until the next flare's telegraph begins
  warnTtl: number; // >0 while the telegraph is active (shell flashes the star); 0 otherwise
}

export function initHazard(def: StarFlareDef | undefined): HazardState | null {
  return def ? { timer: def.intervalSec, warnTtl: 0 } : null;
}

export function hazardsSystem(world: World, dt: number, def: StarFlareDef | undefined): void {
  if (!def || !world.hazard) return;
  const h = world.hazard;

  if (h.warnTtl > 0) {
    h.warnTtl -= dt;
    if (h.warnTtl <= 0) {
      h.warnTtl = 0;
      const player = world.entities.get(PLAYER_ID);
      if (player && player.pos.x > def.zoneX) {
        applyDamage(world, player, def.damage);
        world.events.push({ type: 'starFlareHit' });
      }
      h.timer = def.intervalSec;
    }
    return;
  }

  h.timer -= dt;
  if (h.timer <= 0) {
    h.warnTtl = def.warnSec;
    world.events.push({ type: 'starFlareWarn' });
  }
}
