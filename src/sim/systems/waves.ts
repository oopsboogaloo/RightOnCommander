// Wave manager. Spawns enemies from data-driven wave definitions (pattern × enemy, fully
// decoupled), tracks membership, flies each member along its path, and awards the 50%
// wave-clear bonus — but only when every member is destroyed by the player (any escape
// forfeits it). [tasks T4.2, design §10, ROC-ENM-1,7,8, ROC-ECO-1a,1b]

import { vec3 } from '../math/vec3.js';
import type { CloakState, Entity, PickupType } from '../components.js';
import type { Rng } from '../rng.js';
import type { ClearFieldDef, World, WaveRecord } from '../world.js';
import { getPattern, yawFromTangent, type PathParams } from './paths.js';
import { difficultyScale, scaledCount } from './difficulty.js';

// Cloak cycle timings for a cloak-capable enemy (the Cougar): repeats visible -> cloaking ->
// cloaked -> decloaking -> visible for as long as it's alive. [ROC-CLK-1,2,3]
export interface CloakCycleDef {
  visibleSec: number;
  transitionSec: number;
  cloakedSec: number;
}

export interface EnemyDef {
  hull: number;
  shield?: number;
  bounty: number;
  meshId?: string;
  colliderRx?: number;
  colliderRz?: number;
  scale?: number; // render + collision size multiplier (FdL 1.5, bosses 2.0) [ROC-FDL-1]
  ecm?: boolean; // boss ECM: harmlessly detonates player missiles while alive [ROC-BECM-1..4]
  behavior?: 'hermit' | 'strafe'; // boss movement/escort archetype [ROC-HERM-*, ROC-FDL-3]
  cargoDrops?: number; // random cargo canisters shed on destruction [ROC-HERM-10, ROC-FDL-5]
  missileImmune?: boolean; // player missiles won't lock onto or home toward this enemy type
  drops?: PickupType; // guaranteed power-up on destruction (e.g. the Cougar's cloak device)
  cloakCycle?: CloakCycleDef; // periodic cloak/decloak (the Cougar) [ROC-CLK-1,2,3]
  fireSpeedMul?: number; // per-enemy shot-speed multiplier over ai.ts's base shotSpeed [ROC-CLK-7]
}

// Wave-as-data: pattern, enemy and stats are orthogonal. [ROC-ENM-7,8]
export interface WaveDef {
  id: string;
  pattern: string;
  enemy: string;
  count: number;
  spacingMs: number;
  delayMs?: number; // wait before this wave starts spawning (sequences waves within a phase)
  durationMs?: number; // member lifetime before it flies off-field
  speed?: number; // scales the path rate
  params?: PathParams;
  fire?: { rate: number; aimed?: boolean }; // enemy weapon (driven by ai.ts) [ROC-ENM-11]
  clearField?: ClearFieldDef; // a solo encounter (the Cougar): clears every other wave around its
  // own appearance [ROC-CLK-5,6]
}

export interface WaveContext {
  enemies: Record<string, EnemyDef>;
}

interface PathRuntime {
  pattern: string;
  params: PathParams;
  age: number;
  duration: number;
}

const BANK_K = 6; // bank ∝ turn rate
const MAX_BANK = 0.6;
const clampAbs = (v: number, m: number): number => Math.min(m, Math.max(-m, v));

// Register a wave as active; members spawn over the following steps. Returns its id.
export function startWave(world: World, def: WaveDef, ctx: WaveContext): number {
  const enemy = ctx.enemies[def.enemy];
  if (!enemy) throw new Error(`unknown enemy '${def.enemy}'`);

  const id = world.nextId++;
  const count = scaledCount(def.count, world.difficulty); // enemy-count scaler [ROC-ENM-14, ROC-DIF-2]
  const rec: WaveRecord = {
    members: new Set(),
    total: count,
    bountySum: count * enemy.bounty,
    killed: 0,
    escaped: false,
    defId: def.id,
    clearField: def.clearField,
    spawn: {
      pattern: def.pattern,
      enemy: def.enemy,
      params: def.params ?? {},
      count,
      spacingSec: def.spacingMs / 1000,
      durationSec: (def.durationMs ?? 4000) / 1000 / (def.speed ?? 1),
      pending: count,
      timer: (def.delayMs ?? 0) / 1000, // hold off until the wave's turn [sequenced phases]
      spawnedIndex: 0,
      fireRate: def.fire?.rate ?? 0,
      fireAimed: def.fire?.aimed ?? false,
      sinceSpawnSec: Infinity, // no member has spawned yet
    },
  };
  world.waves.active.set(id, rec);
  return id;
}

function spawnMember(world: World, waveId: number, rec: WaveRecord, ctx: WaveContext, rng: Rng): void {
  const s = rec.spawn;
  if (!s) return;
  const def = ctx.enemies[s.enemy];
  const pattern = getPattern(s.pattern);
  if (!def || !pattern) return;

  const id = world.nextId++;
  const params = s.params;
  const start = pattern(0, params, rng);
  const path: PathRuntime = { pattern: s.pattern, params, age: 0, duration: s.durationSec };

  // Enemy stats scale with difficulty (more hull/shields/fire later). [ROC-ENM-12, ROC-DIF-2]
  const scale = difficultyScale(world.difficulty);
  const hull = def.hull * scale.hull;
  const shield = Math.round((def.shield ?? 0) * scale.shield);
  const fireRate = s.fireRate > 0 ? s.fireRate * scale.fireRate : 0;

  const cloak: CloakState | undefined = def.cloakCycle
    ? { phase: 'visible', timer: def.cloakCycle.visibleSec, ...def.cloakCycle }
    : undefined;

  const e: Entity = {
    id,
    kind: 'enemy',
    pos: vec3(start.pos.x, start.pos.y, start.pos.z),
    vel: vec3(),
    yaw: yawFromTangent(start.tangent),
    bank: 0,
    hull,
    hullMax: hull,
    shield,
    shieldMax: shield,
    bounty: def.bounty,
    meshId: def.meshId,
    scale: def.scale,
    colliderRx: def.colliderRx,
    colliderRz: def.colliderRz,
    missileImmune: def.missileImmune,
    drops: def.drops,
    cloak,
    waveId,
    path,
    ai: fireRate > 0 ? { rate: fireRate, aimed: s.fireAimed, cooldown: 1 / fireRate, speedMul: def.fireSpeedMul } : undefined,
  };
  world.entities.set(id, e);
  rec.members.add(id);
  s.sinceSpawnSec = 0; // this wave just appeared — starts (or restarts) its post-appearance window [ROC-CLK-6]
}

// Is this wave's solo-encounter window (clearField) currently open — from `beforeMs` ahead of its
// own spawn through `afterMs` after it? [ROC-CLK-5,6]
function inClearWindow(rec: WaveRecord): boolean {
  const cf = rec.clearField;
  const s = rec.spawn;
  if (!cf || !s) return false;
  const before = s.pending > 0 && s.timer <= cf.beforeMs / 1000;
  const after = s.sinceSpawnSec <= cf.afterMs / 1000;
  return before || after;
}

export function waveSystem(world: World, rng: Rng, dt: number, ctx: WaveContext): void {
  // 1. Reconcile kills: members the player destroyed are already gone from the world.
  for (const rec of world.waves.active.values()) {
    for (const id of [...rec.members]) {
      if (!world.entities.has(id)) {
        rec.members.delete(id);
        rec.killed++;
      }
    }
  }

  // A solo encounter (the Cougar) gets the field to itself: while its clearField window is open,
  // every other wave's members are swept away (asteroids aren't wave members, so they're
  // untouched) and every other wave's spawn timer is paused rather than cancelled — it resumes
  // exactly where it left off once the window closes. [ROC-CLK-5,6]
  let soloWaveId: number | null = null;
  for (const [id, rec] of world.waves.active) {
    if (inClearWindow(rec)) {
      soloWaveId = id;
      break;
    }
  }
  if (soloWaveId !== null) {
    for (const [id, rec] of world.waves.active) {
      if (id === soloWaveId) continue;
      for (const mid of [...rec.members]) {
        const e = world.entities.get(mid);
        if (!e || e.kind !== 'enemy') continue;
        world.entities.delete(mid);
        rec.members.delete(mid);
        rec.escaped = true; // cleared, not killed — forfeits that wave's bonus [ROC-ECO-1a]
      }
    }
  }

  // 2. Spawn any due members (paused, not ticked, for every wave but the solo one while its
  // window is open).
  for (const [waveId, rec] of world.waves.active) {
    const s = rec.spawn;
    if (!s) continue;
    s.sinceSpawnSec += dt;
    if (s.pending <= 0) continue;
    if (soloWaveId !== null && waveId !== soloWaveId) continue;
    s.timer -= dt;
    while (s.pending > 0 && s.timer <= 0) {
      spawnMember(world, waveId, rec, ctx, rng);
      s.pending--;
      s.spawnedIndex++;
      s.timer += s.spacingSec;
    }
  }

  // 3. Fly members along their paths; off-field members escape (forfeiting the bonus).
  for (const e of [...world.entities.values()]) {
    if (e.kind !== 'enemy' || !e.path) continue;
    const path = e.path as PathRuntime;
    const pattern = getPattern(path.pattern);
    if (!pattern) continue;

    path.age += dt;
    const t = Math.min(path.age / path.duration, 1);
    const pt = pattern(t, path.params, rng);
    const prev = e.pos;
    const np = vec3(pt.pos.x, pt.pos.y, pt.pos.z);
    e.vel = vec3((np.x - prev.x) / dt, (np.y - prev.y) / dt, (np.z - prev.z) / dt); // real motion, so wrecks inherit it
    e.pos = np;
    const yaw = yawFromTangent(pt.tangent);
    e.bank = clampAbs((yaw - e.yaw) * BANK_K, MAX_BANK); // [ROC-ENM-3]
    e.yaw = yaw;

    if (path.age >= path.duration) {
      const rec = e.waveId != null ? world.waves.active.get(e.waveId) : undefined;
      if (rec) {
        rec.members.delete(e.id);
        rec.escaped = true; // [ROC-ECO-1a]
      }
      world.entities.delete(e.id);
    }
  }

  // 4. Resolve finished waves: award the bonus on a full kill-clear, else just clean up. An
  // `open` record (open-ended boss escorts) never resolves until its owner closes it, so a
  // momentarily-empty field mid-fight can't award the bonus early. [ROC-HERM-12]
  for (const [waveId, rec] of [...world.waves.active]) {
    const doneSpawning = !rec.spawn || rec.spawn.pending === 0;
    if (rec.open || !doneSpawning || rec.members.size > 0) continue;

    if (!rec.escaped && rec.total > 0 && rec.killed === rec.total) {
      const bonus = 0.5 * rec.bountySum; // [ROC-ECO-1a]
      world.econ.wallet += bonus;
      world.econ.score += bonus;
      world.events.push({ type: 'waveBonus', amount: bonus }); // prominent flash [ROC-ECO-1b]
    }
    world.waves.active.delete(waveId);
  }
}
