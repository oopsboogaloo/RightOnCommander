// Thargons: the small remote-controlled craft a Thargoid launches. Any enemy or boss with a
// `launch` state (from its EnemyDef.launches) puts one out every few seconds while fewer than its
// cap of its own Thargons are still active. A Thargon chases the player with a limited turn rate,
// ramming rather than shooting; it goes inert (stops steering, tumbles, drifts off the field)
// when its parent dies — or once it has chased long enough, so a wave section can always end.
// [ROC-ENM-6, ROC-L4-1a]

import { vec3 } from '../math/vec3.js';
import type { Entity } from '../components.js';
import type { Rng } from '../rng.js';
import { PLAYER_ID, type World } from '../world.js';
import type { WaveContext } from './waves.js';

export const THARGON = {
  launchSpeed: 0.55, // world units / s while clearing the parent
  launchSec: 0.45,
  chaseSpeed: 0.85,
  turnRate: 1.7, // rad/s — dodgeable at speed, deadly if you sit still
  chaseSec: 5, // then it gives up and goes inert, like a lost parent
  inertSpeedMul: 0.55,
  inertSpin: 3, // rad/s tumble
};

// A launcher only launches while it is actually on screen. [ROC-ENM-6]
const LAUNCH_FIELD = { x: 1.4, zMin: -1.7, zMax: 1.7 };
// Past this an inert (or any) Thargon has left the field and is removed.
const CULL = { x: 1.8, zMin: -2.1, zMax: 2.5 };

export interface ThargonAi {
  kind: 'thargon';
  parentId: number;
  state: 'launch' | 'chase' | 'inert';
  age: number;
  heading: number; // radians: 0 = up-screen (+z), PI = down-screen
  speed: number;
  rate: 0; // aiSystem: Thargons never shoot, they ram
  aimed: false;
  cooldown: number;
}

export const isThargon = (e: Entity): boolean => (e.ai as ThargonAi | undefined)?.kind === 'thargon';

const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

function activeChildren(world: World, parentId: number): number {
  let n = 0;
  for (const e of world.entities.values()) {
    const ai = e.ai as ThargonAi | undefined;
    if (ai?.kind === 'thargon' && ai.parentId === parentId && ai.state !== 'inert') n++;
  }
  return n;
}

function launchThargon(world: World, rng: Rng, parent: Entity, ctx: WaveContext): void {
  const name = parent.launch!.enemy;
  const def = ctx.enemies[name];
  if (!def) return;
  const player = world.entities.get(PLAYER_ID);
  const toPlayer = player ? Math.atan2(player.pos.x - parent.pos.x, player.pos.z - parent.pos.z) : Math.PI;
  const heading = toPlayer + rng.range(-0.9, 0.9); // fan out of the parent, then home in
  const ai: ThargonAi = {
    kind: 'thargon',
    parentId: parent.id,
    state: 'launch',
    age: 0,
    heading,
    speed: THARGON.launchSpeed,
    rate: 0,
    aimed: false,
    cooldown: 0,
  };
  const id = world.nextId++;
  world.entities.set(id, {
    id,
    kind: 'enemy',
    pos: vec3(parent.pos.x, 0, parent.pos.z),
    vel: vec3(Math.sin(heading) * ai.speed, 0, Math.cos(heading) * ai.speed),
    yaw: heading,
    bank: 0,
    hull: def.hull,
    hullMax: def.hull,
    shield: def.shield ?? 0,
    shieldMax: def.shield ?? 0,
    bounty: def.bounty,
    meshId: def.meshId,
    scale: def.scale,
    colliderRx: def.colliderRx,
    colliderRz: def.colliderRz,
    missileImmune: def.missileImmune,
    ai,
  });
  world.events.push({ type: 'thargonLaunched', parentId: parent.id });
}

function parentAlive(world: World, id: number): boolean {
  const p = world.entities.get(id);
  return !!p && !p.dying && (p.hull ?? 0) > 0;
}

function moveThargon(world: World, e: Entity, dt: number): void {
  const ai = e.ai as ThargonAi;
  ai.age += dt;

  // Lost its parent (or chased too long): the link is gone, it goes inert. [ROC-ENM-6]
  if (ai.state !== 'inert' && (!parentAlive(world, ai.parentId) || ai.age > THARGON.launchSec + THARGON.chaseSec)) {
    ai.state = 'inert';
    ai.speed *= THARGON.inertSpeedMul;
  }

  if (ai.state === 'launch' && ai.age >= THARGON.launchSec) {
    ai.state = 'chase';
    ai.speed = THARGON.chaseSpeed;
  }

  if (ai.state === 'chase') {
    // Steer toward the player at a limited turn rate. A cloaked player can't be tracked, so it
    // just holds its heading. [ROC-CLK-4]
    const player = world.entities.get(PLAYER_ID);
    if (player && world.player.cloakTtl <= 0) {
      const want = Math.atan2(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
      const diff = wrapAngle(want - ai.heading);
      const maxTurn = THARGON.turnRate * dt;
      ai.heading = wrapAngle(ai.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)));
    }
    e.yaw = ai.heading;
    e.bank = 0;
  } else if (ai.state === 'inert') {
    e.yaw += THARGON.inertSpin * dt; // dead in space: tumbling, no longer pointing anywhere
    e.bank += THARGON.inertSpin * 0.7 * dt;
  } else {
    e.yaw = ai.heading;
  }

  e.vel = vec3(Math.sin(ai.heading) * ai.speed, 0, Math.cos(ai.heading) * ai.speed);
  e.pos = vec3(e.pos.x + e.vel.x * dt, 0, e.pos.z + e.vel.z * dt);

  if (Math.abs(e.pos.x) > CULL.x || e.pos.z < CULL.zMin || e.pos.z > CULL.zMax) world.entities.delete(e.id);
}

export function thargonSystem(world: World, rng: Rng, dt: number, ctx: WaveContext): void {
  for (const e of [...world.entities.values()]) {
    if (e.kind === 'enemy' && isThargon(e)) {
      moveThargon(world, e, dt);
      continue;
    }
    const launch = e.launch;
    if (!launch || (e.kind !== 'enemy' && e.kind !== 'boss') || e.dying || (e.hull ?? 0) <= 0) continue;
    launch.timer -= dt;
    if (launch.timer > 0) continue;
    launch.timer += launch.everySec;
    const onField = Math.abs(e.pos.x) < LAUNCH_FIELD.x && e.pos.z > LAUNCH_FIELD.zMin && e.pos.z < LAUNCH_FIELD.zMax;
    if (onField && activeChildren(world, e.id) < launch.max) launchThargon(world, rng, e, ctx);
  }
}
