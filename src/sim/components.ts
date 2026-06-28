// Entity + component types for the lightweight struct-of-fields model. The World owns
// flat maps of entities; systems iterate by kind. [design §5]

import type { Vec3 } from './math/vec3.js';

export type EntityKind =
  | 'player'
  | 'enemy'
  | 'boss'
  | 'projectile'
  | 'missile'
  | 'pickup'
  | 'cargo'
  | 'particle'
  | 'station';

export type PickupType =
  | 'fuel'
  | 'gems'
  | 'alloys'
  | 'laser'
  | 'missile'
  | 'ecm'
  | 'bomb'
  | 'pod'
  | 'life';

export interface Entity {
  id: number;
  kind: EntityKind;
  pos: Vec3; // world space (see §7 axes)
  vel: Vec3;
  yaw: number; // facing (path tangent / heading)
  bank: number; // roll angle, ∝ lateral motion [ROC-MOV-3, ROC-ENM-3]
  meshId?: string;
  shield?: number; // remaining ellipses [ROC-DMG-3]
  shieldMax?: number;
  hull?: number;
  hullMax?: number;
  flashTtl?: number; // white damage flash timer [ROC-DMG-6a]
  shieldFlashTtl?: number;
  thrust?: boolean; // engine-flame flag: thrusting up-screen [ROC-MOV-4]
  ttl?: number; // remaining lifetime in seconds (projectiles, particles)
  team?: 'player' | 'enemy'; // who fired a projectile
  colliderRx?: number; // shield ellipse radii (play plane) [ROC-DMG-1]
  colliderRz?: number;
  bounty?: number;
  waveId?: number; // membership for the 50% bonus [ROC-ECO-1a]
  path?: unknown; // spline + t for enemies [ROC-ENM-2]
  ai?: unknown; // fire cadence, pattern, boss phase
  pickup?: { type: PickupType };
  contraband?: boolean; // different shape [ROC-ECO-4]
}

// Events emitted by the sim each step and drained by the shell (routed to Renderer/AudioOut).
// Tests assert on these. [design §4, ROC-SFX-2]
export interface SimEvent {
  type: string;
  [key: string]: unknown;
}
