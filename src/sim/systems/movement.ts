// Movement & banking for the player ship. Pure: reads the InputFrame's moveTarget, integrates
// motion with a speed cap, keeps the whole ship on the field, banks proportional to lateral
// velocity, levels out when lateral motion ceases, and flags engine thrust. [ROC-MOV-1..5]
//
// The play plane is x (right) and z (up-screen, forward); height y stays ~0. The InputFrame's
// moveTarget.y addresses world z (the screen-vertical axis).

import type { InputFrame } from '../../interfaces.js';
import { PLAYER_ID, type World } from '../world.js';

export interface MovementConfig {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  shipRadius: number; // inset so no part of the ship leaves the field [ROC-MOV-2]
  maxSpeed: number; // world units / second
  responsiveness: number; // fraction of the remaining gap closed per step
  bankFactor: number; // bank radians per (unit/s) of lateral velocity [ROC-MOV-3]
  maxBank: number;
  bankResponsiveness: number; // easing toward the target bank (and back to level) [ROC-MOV-5]
  thrustEpsilon: number; // minimum +z velocity to count as thrusting up [ROC-MOV-4]
}

export const DEFAULT_MOVEMENT: MovementConfig = {
  bounds: { minX: -1, maxX: 1, minZ: -1.6, maxZ: 1.6 },
  shipRadius: 0.2,
  maxSpeed: 4,
  responsiveness: 0.2,
  bankFactor: 0.125,
  maxBank: 0.5,
  bankResponsiveness: 0.15,
  thrustEpsilon: 0.05,
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const clampAbs = (v: number, m: number): number => clamp(v, -m, m);

export function movementSystem(
  world: World,
  input: InputFrame,
  dt: number,
  cfg: MovementConfig = DEFAULT_MOVEMENT,
): void {
  const p = world.entities.get(PLAYER_ID);
  if (!p) return;
  if (world.player.respawnPending) return; // the wreck sits inert through its explosion [ROC-LIFE-3]

  // Follow the target (or hold position when there is none). [ROC-MOV-1]
  const targetX = input.moveTarget ? input.moveTarget.x : p.pos.x;
  const targetZ = input.moveTarget ? input.moveTarget.y : p.pos.z;

  let sx = (targetX - p.pos.x) * cfg.responsiveness;
  let sz = (targetZ - p.pos.z) * cfg.responsiveness;
  const maxStep = cfg.maxSpeed * dt;
  const mag = Math.hypot(sx, sz);
  if (mag > maxStep && mag > 0) {
    const s = maxStep / mag;
    sx *= s;
    sz *= s;
  }

  // Clamp the centre so the whole ship stays on the field. [ROC-MOV-2]
  const { bounds: b, shipRadius: r } = cfg;
  const newX = clamp(p.pos.x + sx, b.minX + r, b.maxX - r);
  const newZ = clamp(p.pos.z + sz, b.minZ + r, b.maxZ - r);

  // Actual velocity (reflects any clamping, so banking levels out at the edges).
  const vx = (newX - p.pos.x) / dt;
  const vz = (newZ - p.pos.z) / dt;
  p.pos.x = newX;
  p.pos.z = newZ;
  p.vel.x = vx;
  p.vel.z = vz;

  // Bank into the turn: moving right rolls clockwise, left anticlockwise. Eases back to level
  // when lateral motion ceases. [ROC-MOV-3,5; DEFECTS D3]
  const bankTarget = clampAbs(-cfg.bankFactor * vx, cfg.maxBank);
  p.bank += (bankTarget - p.bank) * cfg.bankResponsiveness;

  // Engine flame only while thrusting up-screen. [ROC-MOV-4]
  p.thrust = vz > cfg.thrustEpsilon;
}
