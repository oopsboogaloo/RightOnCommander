// Energy Bank: a one-time purchase (station.ts buyEnergyBank) that very slowly regenerates
// shields — one ring every ENERGY_BANK_INTERVAL_SEC, whether or not the previous tick actually
// had a ring to give, so the cadence never drifts. [ROC-BANK-1,2]

import { PLAYER_ID, type World } from '../world.js';

export const ENERGY_BANK_INTERVAL_SEC = 15;

export function energyBankSystem(world: World, dt: number): void {
  if (!world.player.energyBank || world.player.respawnPending) return;
  const player = world.entities.get(PLAYER_ID);
  if (!player) return;

  world.player.energyBankTimer -= dt;
  if (world.player.energyBankTimer <= 0) {
    world.player.energyBankTimer += ENERGY_BANK_INTERVAL_SEC; // keep the cadence even on a no-op tick
    if ((player.shield ?? 0) < (player.shieldMax ?? 0)) player.shield = (player.shield ?? 0) + 1;
  }
}
