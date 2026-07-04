// Entity + component types for the lightweight struct-of-fields model. The World owns
// flat maps of entities; systems iterate by kind. [design §5]

import type { Vec3 } from './math/vec3.js';

export type EntityKind =
  | 'player'
  | 'enemy'
  | 'boss'
  | 'asteroid'
  | 'projectile'
  | 'missile'
  | 'pickup'
  | 'cargo'
  | 'particle'
  | 'fragment'
  | 'station';

export type PickupType =
  | 'fuel'
  | 'gems'
  | 'alloys'
  | 'laser'
  | 'missile'
  | 'ecm'
  | 'bomb'
  | 'life'
  | 'cargo'; // a tradeable commodity (see `commodity`) [ROC-CARGO-1]

export interface Entity {
  id: number;
  kind: EntityKind;
  pos: Vec3; // world space (see §7 axes)
  vel: Vec3;
  yaw: number; // facing (path tangent / heading)
  bank: number; // roll angle, ∝ lateral motion [ROC-MOV-3, ROC-ENM-3]
  meshId?: string;
  scale?: number; // per-entity size multiplier over the global SHIP_SCALE; honoured by render
  // AND collision so the hitbox always matches the sprite (FdL 1.5x, bosses 2x) [ROC-FDL-1]
  shield?: number; // remaining ellipses [ROC-DMG-3]
  shieldMax?: number;
  hull?: number;
  hullMax?: number;
  flashTtl?: number; // white damage flash timer [ROC-DMG-6a]
  shieldFlashTtl?: number;
  thrust?: boolean; // engine-flame flag: thrusting up-screen [ROC-MOV-4]
  ttl?: number; // remaining lifetime in seconds (projectiles, particles, fragments)
  ttlMax?: number; // initial ttl, for fade [ROC-DMG-6]
  seg?: { x: number; z: number }; // half-segment vector for a wireframe fragment line
  spin?: number; // fragment angular velocity, radians/sec
  tumble?: { yawRate: number; bankRate: number }; // free 3D roll, independent of heading/motion [ROC-L1-1]
  speed?: number; // current scalar speed (missiles accelerate toward their max) [ROC-MIS-3]
  team?: 'player' | 'enemy'; // who fired a projectile
  damage?: number; // damage dealt by a projectile
  mil?: boolean; // a military-laser bolt: rendered shorter + thicker [ROC-LAS-5]
  beamExposure?: number; // seconds of continuous beam-laser fire accumulated toward the next hit [ROC-LAS-6]
  colliderRx?: number; // fallback collider radii (play plane), used when no hull silhouette is available
  colliderRz?: number;
  hitMeshId?: string; // collide against this mesh's silhouette instead of meshId (e.g. a splinter
  // collides as the smaller asteroid chunk it's drawn as, not its own mesh) [DEFECTS: render/collide mismatch]
  hitScale?: number; // absolute scale for hitMeshId's silhouette, replacing colliderScale (matches
  // the scale the renderer actually draws that substituted mesh at)
  heavyDamage?: boolean; // persistent smoke/fire while badly hurt [ROC-DMG-7]
  bounty?: number;
  waveId?: number; // membership for the 50% bonus [ROC-ECO-1a]
  path?: unknown; // spline + t for enemies [ROC-ENM-2]
  ai?: unknown; // fire cadence, pattern, boss phase
  pickup?: { type: PickupType; commodity?: string }; // commodity set when type === 'cargo'
  drops?: string; // power-up dropped on destruction (e.g. a guaranteed laser) [ROC-PWR-6]
  cargoDrops?: number; // random cargo canisters shed on destruction (boss hauls) [ROC-HERM-10, ROC-FDL-5]
  ecm?: boolean; // boss ECM: detonates player missiles harmlessly while alive [ROC-BECM-1..4]
  port?: boolean; // has a centred docking-port rectangle (hermit / stations): rendered, dockable,
  // and worth triple damage on a direct hit [ROC-HERM-1,8, ROC-DCKG-3]
  contraband?: boolean; // different shape [ROC-ECO-4]
}

// Events emitted by the sim each step and drained by the shell (routed to Renderer/AudioOut).
// Tests assert on these. [design §4, ROC-SFX-2]
export interface SimEvent {
  type: string;
  [key: string]: unknown;
}
