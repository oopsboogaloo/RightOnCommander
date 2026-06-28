// Drops: when an entity flagged with `drops` is destroyed, spawn the corresponding power-up
// pickup at its position. The mid-boss's guaranteed laser drop flows through here. Collection
// of pickups lands in T5.3. [tasks T5.2, ROC-PWR-6]

import { vec3, type Vec3 } from '../math/vec3.js';
import type { PickupType } from '../components.js';
import type { World } from '../world.js';

const DROP_TTL = 10; // seconds a dropped pickup lingers

export function dropsSystem(world: World): void {
  for (const ev of world.events) {
    if (ev.type !== 'destroyed' || typeof ev.drops !== 'string') continue;
    const at = (ev.pos as Vec3) ?? vec3();
    const id = world.nextId++;
    world.entities.set(id, {
      id,
      kind: 'pickup',
      pos: vec3(at.x, at.y, at.z),
      vel: vec3(),
      yaw: 0,
      bank: 0,
      pickup: { type: ev.drops as PickupType },
      ttl: DROP_TTL,
    });
  }
}
