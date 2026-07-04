// Boss behaviours. Two archetypes drive the Level 1 fights and are reusable by later levels:
//
// - 'hermit': the pirate hermit asteroid — parked top-centre, rolling slowly about its docking
//   axis (through the port on its player-facing face), launching an adder escort every few seconds (or letting
//   one slip in from a screen edge) until it is destroyed; survivors then flee off-screen. All
//   escorts across the whole fight form one open wave, so clearing every one of them (fleers
//   included) pays the standard 50% bonus. [requirements §3.24, ROC-HERM-3..6,11,12]
// - 'strafe': the boss Fer-de-Lance — strafes fast around a rounded-rectangle track, reversing
//   direction at random intervals, firing an aimed shot on a fixed cadence (the rate/aimed
//   fields ride on the same ai object aiSystem reads). [requirements §3.25, ROC-FDL-3,4]
//
// Escort movement lives here (not in waves.ts): winding paths are open-ended — they last until
// the adder dies or flees, never "expiring off-field" like a wave member. [ROC-HERM-6]

import { vec3 } from '../math/vec3.js';
import type { Entity } from '../components.js';
import type { Rng } from '../rng.js';
import type { World } from '../world.js';
import type { WaveContext } from './waves.js';

export const HERMIT_POS = { x: 0, z: 1.05 }; // middle top of the screen [ROC-HERM-2]
export const HERMIT_SPIN = 0.25; // slow y-rotation, rad/s [ROC-HERM-3]
// How far toward the player, from the rock's centre, the modelled docking bay sits (it's on the
// roll axis, so this offset holds regardless of the rock's current roll). A rock-launched escort
// spawns here instead of at the rock's centre, reading as emerging from the entrance. [ROC-HERM-5]
const HERMIT_PORT_OFFSET = 0.35;
export const HERMIT_SPAWN_SEC = 2.5; // an adder every 2.5 seconds [ROC-HERM-4]
export const HERMIT_INITIAL_ESCORTS = 2; // adders already launched when the fight opens [ROC-HERM-4]
export const HERMIT_ESCORT_CAP = 3; // max adders on screen [ROC-HERM-4]
const ESCORT_ENEMY = 'adder';
const ESCORT_FIRE_RATE = 0.225; // aimed shots/sec, matching the level's (halved) adder waves
const ESCORT_BLEND_SEC = 1.2; // launch/entry glide into the winding path
const ESCORT_FLEE_SPEED = 1.1;
const ESCORT_EXIT_X = 1.55; // past this the fleer has escaped (forfeiting the bonus)

// The boss FdL's strafing track: a rounded rectangle over the upper play field. [ROC-FDL-3]
export interface TrackDef {
  cx: number;
  cz: number;
  hx: number; // half-width to the straight edges
  hz: number;
  r: number; // corner radius
  speed: number; // fast — hard to hit [ROC-FDL-3]
}

export const FDL_TRACK: TrackDef = { cx: 0, cz: 0.55, hx: 0.65, hz: 0.4, r: 0.18, speed: 0.56 };
export const FDL_FLIP_RANGE: [number, number] = [0.2, 2.0]; // direction-reversal interval, s [ROC-FDL-3]
export const FDL_FIRE_RATE = 1.25; // one aimed shot every 800 ms [ROC-FDL-4]

// The FdL flies in from off the top of the screen (rather than popping onto its track) while the
// starfield keeps scrolling, then halts the field and starts strafing once it arrives. [ROC-FDL-*]
export const FDL_ENTRY_SPAWN_Z = 2.2; // above the top edge (enemies enter around z=1.8)
export const FDL_ENTRY_SEC = 1.8; // glide-in duration

interface HermitAi {
  kind: 'hermit';
  spawnTimer: number;
  started: boolean; // whether the opening escort burst has launched [ROC-HERM-4]
}

interface StrafeAi {
  kind: 'strafe';
  state: 'entry' | 'strafe'; // gliding in from off-screen, or strafing the track [ROC-FDL-*]
  age: number; // seconds in the current phase (drives the entry glide)
  from: { x: number; z: number }; // off-screen spawn pose, for the entry glide
  s: number; // arc-length position along the track
  dir: 1 | -1;
  flip: number; // seconds until the next direction reversal
  rate: number; // read by aiSystem: aimed fire cadence (0 while entering) [ROC-FDL-4]
  aimed: boolean;
  cooldown: number;
}

interface EscortAi {
  kind: 'escort';
  state: 'blend' | 'wind' | 'flee';
  age: number; // seconds since spawn (drives the winding path)
  from: { x: number; z: number; yaw: number }; // spawn pose, for the entry glide
  // Winding-path parameters, drawn per escort from world.rng: a lissajous wander below the
  // hermit, so they never collide with it. [ROC-HERM-6]
  ax: number;
  wx: number;
  px: number;
  zBase: number;
  az: number;
  wz: number;
  pz: number;
  rate: number; // read by aiSystem
  aimed: boolean;
  cooldown: number;
}

// Spawn placement + ai for a boss with the given behaviour (levelstate calls this).
export function bossPlacement(behavior: string | undefined): {
  pos: { x: number; y: number; z: number };
  yaw: number;
  ai?: HermitAi | StrafeAi;
  port?: boolean;
} {
  if (behavior === 'hermit') {
    return {
      pos: { x: HERMIT_POS.x, y: 0, z: HERMIT_POS.z },
      yaw: 0,
      ai: { kind: 'hermit', spawnTimer: HERMIT_SPAWN_SEC, started: false },
      port: true, // Coriolis-style docking-port rectangle on the rotation axis [ROC-HERM-1,3]
    };
  }
  if (behavior === 'strafe') {
    // Spawn off the top of the screen, above the track's x, and glide in. rate 0 => holds fire
    // until it reaches the track. [ROC-FDL-*]
    const from = { x: trackPoint(FDL_TRACK, 0).x, z: FDL_ENTRY_SPAWN_Z };
    return {
      pos: { x: from.x, y: 0, z: from.z },
      yaw: Math.PI,
      ai: { kind: 'strafe', state: 'entry', age: 0, from, s: 0, dir: 1, flip: 1.0, rate: 0, aimed: true, cooldown: 1 / FDL_FIRE_RATE },
    };
  }
  // Legacy static boss: up-screen, facing the player.
  return { pos: { x: 0, y: 0, z: 0.7 }, yaw: Math.PI };
}

// Arc-length point on the rounded-rectangle track (counterclockwise from the bottom-left
// straight). Continuous everywhere, wraps modulo the perimeter.
export function trackPoint(t: TrackDef, s: number): { x: number; z: number } {
  const sx = t.hx - t.r;
  const sz = t.hz - t.r;
  const lS = 2 * sx; // horizontal straight
  const lZ = 2 * sz; // vertical straight
  const lC = (Math.PI / 2) * t.r; // quarter corner
  const P = 2 * lS + 2 * lZ + 4 * lC;
  const rel = (x: number, z: number): { x: number; z: number } => ({ x: t.cx + x, z: t.cz + z });
  const corner = (cx: number, cz: number, a: number): { x: number; z: number } =>
    rel(cx + t.r * Math.cos(a), cz + t.r * Math.sin(a));

  let u = ((s % P) + P) % P;
  if (u < lS) return rel(-sx + u, -t.hz); // bottom, heading +x
  u -= lS;
  if (u < lC) return corner(sx, -sz, -Math.PI / 2 + u / t.r);
  u -= lC;
  if (u < lZ) return rel(t.hx, -sz + u); // right, heading +z
  u -= lZ;
  if (u < lC) return corner(sx, sz, u / t.r);
  u -= lC;
  if (u < lS) return rel(sx - u, t.hz); // top, heading -x
  u -= lS;
  if (u < lC) return corner(-sx, sz, Math.PI / 2 + u / t.r);
  u -= lC;
  if (u < lZ) return rel(-t.hx, sz - u); // left, heading -z
  u -= lZ;
  return corner(-sx, -sz, Math.PI + u / t.r);
}

export const trackPerimeter = (t: TrackDef): number =>
  2 * (2 * (t.hx - t.r)) + 2 * (2 * (t.hz - t.r)) + 2 * Math.PI * t.r;

const clampAbs = (v: number, m: number): number => Math.min(m, Math.max(-m, v));
const smoothstep = (u: number): number => u * u * (3 - 2 * u);
const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

const windPoint = (ai: EscortAi, age: number): { x: number; z: number } => ({
  x: ai.ax * Math.sin(ai.wx * age + ai.px),
  z: ai.zBase + ai.az * Math.sin(ai.wz * age + ai.pz),
});

function findHermit(world: World): Entity | undefined {
  for (const e of world.entities.values()) {
    if (e.kind === 'boss' && (e.ai as HermitAi | undefined)?.kind === 'hermit') return e;
  }
  return undefined;
}

const escorts = (world: World): Entity[] =>
  [...world.entities.values()].filter((e) => e.kind === 'enemy' && (e.ai as EscortAi | undefined)?.kind === 'escort');

// Launch one adder: from the asteroid itself (spawning with the rock's current y-rotation, then
// unwinding to flight attitude), or entering from a screen edge. [ROC-HERM-4,5]
function spawnEscort(world: World, rng: Rng, hermit: Entity, ctx: WaveContext): void {
  const def = ctx.enemies[ESCORT_ENEMY];
  if (!def || world.hermitWaveId == null) return;
  const rec = world.waves.active.get(world.hermitWaveId);
  if (!rec) return;

  const fromRock = rng.int(2) === 0;
  const from = fromRock
    ? { x: hermit.pos.x, z: hermit.pos.z - HERMIT_PORT_OFFSET, yaw: hermit.yaw } // from the docking port, not the rock's centre [ROC-HERM-5]
    : { x: rng.int(2) === 0 ? -1.45 : 1.45, z: rng.range(-0.5, 0.1), yaw: 0 };

  const ai: EscortAi = {
    kind: 'escort',
    state: 'blend',
    age: 0,
    from,
    ax: rng.range(0.5, 0.85),
    wx: rng.range(0.9, 1.6),
    px: rng.range(0, Math.PI * 2),
    zBase: rng.range(-0.95, -0.25), // the wander band sits below the hermit [ROC-HERM-6]
    az: rng.range(0.3, 0.5),
    wz: rng.range(1.1, 1.9),
    pz: rng.range(0, Math.PI * 2),
    rate: ESCORT_FIRE_RATE,
    aimed: true,
    cooldown: 1.2,
  };

  const id = world.nextId++;
  world.entities.set(id, {
    id,
    kind: 'enemy',
    pos: vec3(from.x, 0, from.z),
    vel: vec3(),
    yaw: from.yaw,
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
    waveId: world.hermitWaveId,
    ai,
  });

  // The whole fight is one wave: every spawn raises the bar for the 50% bonus. [ROC-HERM-12]
  rec.members.add(id);
  rec.total += 1;
  rec.bountySum += def.bounty;
}

function moveEscort(world: World, e: Entity, dt: number): void {
  const ai = e.ai as EscortAi;
  ai.age += dt;
  const prev = { x: e.pos.x, z: e.pos.z };

  if (ai.state === 'flee') {
    // Head for the nearest side edge; crossing it is an escape (forfeits the bonus). [ROC-HERM-11]
    const dir = e.pos.x >= 0 ? 1 : -1;
    e.pos.x += dir * ESCORT_FLEE_SPEED * dt;
    e.pos.z += 0.15 * dt;
    e.vel = vec3(dir * ESCORT_FLEE_SPEED, 0, 0.15);
    e.yaw = Math.atan2(e.vel.x, e.vel.z);
    e.bank = clampAbs(-1.2 * e.vel.x, 0.5);
    if (Math.abs(e.pos.x) > ESCORT_EXIT_X) {
      const rec = e.waveId != null ? world.waves.active.get(e.waveId) : undefined;
      if (rec) {
        rec.members.delete(e.id);
        rec.escaped = true; // any escape forfeits the wave bonus [ROC-HERM-12, ROC-ECO-1a]
      }
      world.entities.delete(e.id);
    }
    return;
  }

  const wind = windPoint(ai, ai.age);
  if (ai.state === 'blend') {
    // Glide from the launch pose into the winding path, unwinding the rock-launch rotation
    // back to flight attitude as it flies. [ROC-HERM-5]
    const u = Math.min(1, ai.age / ESCORT_BLEND_SEC);
    const k = smoothstep(u);
    e.pos.x = ai.from.x + (wind.x - ai.from.x) * k;
    e.pos.z = ai.from.z + (wind.z - ai.from.z) * k;
    if (u >= 1) ai.state = 'wind';
  } else {
    e.pos.x = wind.x;
    e.pos.z = wind.z;
  }

  e.vel = vec3((e.pos.x - prev.x) / dt, 0, (e.pos.z - prev.z) / dt);
  const travelYaw = Math.hypot(e.vel.x, e.vel.z) > 1e-4 ? Math.atan2(e.vel.x, e.vel.z) : e.yaw;
  if (ai.state === 'blend') {
    const u = smoothstep(Math.min(1, ai.age / ESCORT_BLEND_SEC));
    e.yaw = e.yaw + wrapAngle(travelYaw - e.yaw) * u;
  } else {
    e.yaw = travelYaw;
  }
  e.bank = clampAbs(-1.2 * e.vel.x, 0.5);
}

function moveStrafe(world: World, e: Entity, rng: Rng, dt: number): void {
  const ai = e.ai as StrafeAi;
  const player = world.entities.get(1);

  // Entry: glide in from off-screen down to the track start while the field still scrolls; once
  // arrived, halt the field and open fire. [ROC-FDL-*]
  if (ai.state === 'entry') {
    ai.age += dt;
    const k = smoothstep(Math.min(1, ai.age / FDL_ENTRY_SEC));
    const target = trackPoint(FDL_TRACK, 0);
    const prev = { x: e.pos.x, z: e.pos.z };
    e.pos.x = ai.from.x + (target.x - ai.from.x) * k;
    e.pos.z = ai.from.z + (target.z - ai.from.z) * k;
    e.vel = vec3((e.pos.x - prev.x) / dt, 0, (e.pos.z - prev.z) / dt);
    if (player) e.yaw = Math.atan2(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
    e.bank = clampAbs(-0.8 * e.vel.x, 0.5);
    if (ai.age >= FDL_ENTRY_SEC) {
      ai.state = 'strafe';
      ai.rate = FDL_FIRE_RATE; // now it fires
      ai.cooldown = 1 / FDL_FIRE_RATE;
      ai.s = 0;
      world.scroll = 0; // the fight proper begins; halt the field [ROC-BOSS-1]
    }
    return;
  }

  // Reverse the strafe direction at a random interval in [200 ms, 2000 ms]. [ROC-FDL-3]
  ai.flip -= dt;
  if (ai.flip <= 0) {
    ai.dir = ai.dir === 1 ? -1 : 1;
    ai.flip = rng.range(FDL_FLIP_RANGE[0], FDL_FLIP_RANGE[1]);
  }

  const prev = { x: e.pos.x, z: e.pos.z };
  ai.s += ai.dir * FDL_TRACK.speed * dt;
  const p = trackPoint(FDL_TRACK, ai.s);
  e.pos.x = p.x;
  e.pos.z = p.z;
  e.vel = vec3((e.pos.x - prev.x) / dt, 0, (e.pos.z - prev.z) / dt);

  // Keep the guns (and the nose) on the player while strafing; bank into the motion.
  if (player) e.yaw = Math.atan2(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
  e.bank = clampAbs(-0.8 * e.vel.x, 0.5);
}

export function bossSystem(world: World, rng: Rng, dt: number, ctx: WaveContext): void {
  const hermit = findHermit(world);

  // The hermit is gone: close the whole-fight wave (so it can now resolve for the bonus) and
  // send every surviving adder running for the screen edge. [ROC-HERM-11,12]
  if (!hermit && world.hermitWaveId != null) {
    const rec = world.waves.active.get(world.hermitWaveId);
    if (rec) rec.open = false;
    for (const e of escorts(world)) (e.ai as EscortAi).state = 'flee';
    world.hermitWaveId = null;
  }

  if (hermit) {
    const ai = hermit.ai as HermitAi;
    hermit.bank += HERMIT_SPIN * dt; // slow roll about the docking axis; the port rides it [ROC-HERM-3]

    // Launch the opening burst so a couple of adders are already out when the fight opens. Runs on
    // the first tick, once the wave record exists (set by spawnBoss). [ROC-HERM-4]
    if (!ai.started) {
      ai.started = true;
      for (let i = 0; i < HERMIT_INITIAL_ESCORTS && escorts(world).length < HERMIT_ESCORT_CAP; i++) {
        spawnEscort(world, rng, hermit, ctx);
      }
    }

    // Then an adder every 2.5 seconds while under the on-screen cap, until the rock dies. [ROC-HERM-4]
    ai.spawnTimer -= dt;
    if (ai.spawnTimer <= 0) {
      if (escorts(world).length < HERMIT_ESCORT_CAP) spawnEscort(world, rng, hermit, ctx);
      ai.spawnTimer += HERMIT_SPAWN_SEC;
    }
  }

  for (const e of [...world.entities.values()]) {
    if (e.kind === 'enemy' && (e.ai as EscortAi | undefined)?.kind === 'escort') moveEscort(world, e, dt);
    else if (e.kind === 'boss' && (e.ai as StrafeAi | undefined)?.kind === 'strafe') moveStrafe(world, e, rng, dt);
  }
}
