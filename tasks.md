# Right on Commander — Tasks

**Version:** 0.4 (draft)
**Derives from:** requirements.md v1.7, design.md v0.6
**Stack:** TypeScript + Canvas 2D + Vite + Vitest/fast-check; Python for the ship-data parser only.

## How to read this

Tasks are grouped into **phases**; phases ending in a **🏁 milestone** are vertical slices you can run/play. Each task lists **Do**, **Done-when** (acceptance, test-led), and the **refs** it satisfies. House rule per task: *compiles, lint clean (incl. the `sim/` import-boundary rule), its tests green, no `Math.random` in `sim/`.* Tests land **with** the task, not after.

Dependencies flow top-down unless noted. IDs are stable; insert with letters (T4.2a) rather than renumber.

---

## Phase 0 — Scaffolding

- [ ] **T0.1 — Project setup.**
  **Do:** Vite + TS (strict) + Vitest + fast-check + ESLint; folder tree per design §2; npm scripts `dev`/`build`/`test`/`balance`; CI runs `test` headless; ESLint boundary rule "no DOM/Canvas/audio symbols in `sim/`".
  **Done-when:** `npm run dev` serves a blank canvas; `npm test` runs (zero tests ok); CI green; importing `document` inside `sim/` fails lint.
  **Refs:** AS-1, AS-1a, ROC-TEST-1.

- [ ] **T0.2 — Interfaces & core types.**
  **Do:** `interfaces.ts` (Renderer, AudioOut, InputFrame, Storage, Clock); `components.ts`; `world.ts` World shape; `vec3`/matrix math.
  **Done-when:** types compile; null/stub backends implement the interfaces; no logic yet.
  **Refs:** design §4–5, ROC-TEST-3.

- [ ] **T0.3 — RNG, snapshot & harness skeleton.**
  **Do:** `mulberry32` PRNG with state in/out; `snapshot()/restore()`; `test/harness.ts` (`makeSim`, `runFrames`, `replay`) with null backends + recording event sink.
  **Done-when:** **property test** — for random seeds and input logs, `restore(snapshot())` then N steps == N steps then snapshot (determinism + round-trip). `[ROC-TEST-2,4,5]`

---

## Phase 1 — Render foundation

- [ ] **T1.1 — Ship-data parser (the parser).** 🔧 *Python*
  **Do:** `tools/bbcelite_to_mesh.py` — parse bbcelite `VERTEX/EDGE/FACE` blueprints (and/or Ian Bell archive) → normalise the ±255 box → emit `src/content/meshes/<ship>.json` = `{vertices, edges, faces:{loop,normal}}`. First batch: Sidewinder, Cobra Mk III, Asp, Fer-de-Lance, Krait, Mamba, Gecko, Adder, Viper, Coriolis, Thargoid.
  **Done-when:** outputs schema-valid JSON; a Python check asserts known vertex/edge counts for ≥2 ships and that every face index is in range; meshes committed.
  **Refs:** design §16; data refs in requirements §References.

- [ ] **T1.2 — Software-3D Canvas renderer.**
  **Do:** `render/camera.ts`, `project.ts`, `renderer2d.ts` — model matrix (yaw∘bank∘translate), project, **back-face cull**, **painter sort**, **black fill + white stroke**; slow starfield layer.
  **Done-when:** a rotating Sidewinder renders solid (no back faces, nearer faces occlude); **unit tests** on `project.ts` for cull decision and face depth-ordering on a known cube.
  **Refs:** ROC-VIS-1..5,7; design §7.

- [ ] **T1.3 — Loop & wiring.**
  **Do:** `platform/loop.ts` fixed-timestep (1/120 s) + interpolation; `main.ts` wires sim + real renderer.
  **Done-when:** rotating ship animates smoothly at display rate while sim steps at fixed DT; harness drives same `sim.step` with no rAF.
  **Refs:** AS-2, ROC-TEST-5; design §3.

---

## Phase 2 — Player slice

- [ ] **T2.1 — Input layer.**
  **Do:** `input/domInput.ts` mouse/touch/keyboard/gamepad → `InputFrame`; remap; transparent ECM/bomb touch buttons (render hooks).
  **Done-when:** each input source produces correct `InputFrame`s; remap persists; sim consumes frames identically regardless of source.
  **Refs:** ROC-CTL-1..6.

- [ ] **T2.2 — Movement & banking.**
  **Do:** `systems/movement.ts` — follow `moveTarget`, full-screen clamp, bank ∝ lateral velocity, level-out on release, engine-flame flag on forward thrust.
  **Done-when:** **unit tests** — ship never exits bounds for any target; bank sign matches lateral direction; flames flag true only when thrusting up.
  **Refs:** ROC-MOV-1..5.

- [ ] **T2.3 — Pulse laser.**
  **Do:** `systems/weapons.ts` — autofire-while-held + tap single-shot; pulse projectile entities; object pool.
  **Done-when:** firing cadence correct under held vs tapped; **unit test** rounds-per-second; pool reuses, no leak.
  **Refs:** ROC-CTL-1, ROC-LAS-3,4.

🏁 **Milestone M1 — "Fly & shoot":** a banking Sidewinder on a starfield firing pulse lasers, fully deterministic and harness-runnable.

---

## Phase 3 — Combat core

- [x] **T3.1 — Collision.**
  **Do:** `systems/collision.ts` — spatial-hash broadphase; **hull convex-polygon** test (silhouette precomputed per mesh), dilated by a small shield-ring gap while shielded (`hullRadius`/`shieldGap`), undilated once unshielded; an ellipse only as the meshless fallback. Ramming (`gamestate.ts`) uses the same silhouettes instead of a bounding circle.
  **Done-when:** **unit tests** for point/segment-in-ellipse, segment-in-dilated-polygon and polygon-vs-polygon distance on known shapes; broadphase returns same pairs as brute force.
  **Refs:** ROC-DMG-1,5; design §8.

- [ ] **T3.2 — Damage & shields.**
  **Do:** `systems/damage.ts` — shield-ring depletion → hull; `shieldFlashTtl` vs white `flashTtl`; destruction → fragments; smoke/fire on heavy hull damage.
  **Done-when:** **property tests** — shields always deplete before hull; a shielded hit flashes shield not hull; destruction fires exactly at hull≤0; flash rule applies to every damageable kind.
  **Refs:** ROC-DMG-2,3,6,6a,7.

- [ ] **T3.3 — Economy: bounty & counters.**
  **Do:** `systems/economy.ts` — bounty on kill → wallet **and** lifetime score; floating-text events.
  **Done-when:** **unit tests** — wallet vs score diverge correctly across kills + spends; events emitted.
  **Refs:** ROC-ECO-1,2.

- [ ] **T3.4 — Explosions & particles.**
  **Do:** `systems/particles.ts` — edges fly apart + white circular particles; all seeded via `world.rng`; pooled.
  **Done-when:** deterministic across a seed; **unit test** particle count/lifetime bounds.
  **Refs:** ROC-VIS-6.

---

## Phase 4 — Enemies & waves

- [ ] **T4.1 — Paths & pattern library.**
  **Do:** `systems/paths.ts` + patterns `vform`, `loop`, `sine_column`, `side_stream`, `pincer`, `orbit`, `drop_hold`; tangent orientation + banking.
  **Done-when:** each pattern is a pure `(t,params,rng)→{pos,tangent}`; **unit tests** for path continuity and that orientation tracks tangent.
  **Refs:** ROC-ENM-2,3,9.

- [ ] **T4.2 — Wave manager & bonus.**
  **Do:** `systems/waves.ts` — data-driven spawn from wave JSON; membership tracking; **50%-on-full-clear** bonus + screen flash; escapees forfeit.
  **Done-when:** **property tests** — bonus = exactly 0.5×Σ member bounty, once, only when killed==count; any escape ⇒ no bonus; **no off-field stalls** within a frame bound.
  **Refs:** ROC-ENM-1,7,8; ROC-ECO-1a,1b.

- [ ] **T4.3 — Enemy AI & difficulty.**
  **Do:** `systems/ai.ts` — slow, dodgeable enemy projectiles (aimed/patterned); difficulty scaler = enemy-count multiplier + hp/shield/fire-rate multipliers.
  **Done-when:** **unit tests** — projectile speed band; count scaler changes spawn totals; stat multipliers applied.
  **Refs:** ROC-ENM-11,12,13,14; ROC-DIF-1,2.

- [ ] **T4.4 — Missiles power-up.**
  **Do:** `systems/missiles.ts` — homing, continuous autofire, grade 1→4, 60 s timer, downgrade on expiry, destructible.
  **Done-when:** **property tests** — re-collect restarts timer & raises grade (cap 4); expiry drops one grade then removes at 0; volley size == grade; missiles can be shot.
  **Refs:** ROC-MIS-1..5.

---

## Phase 5 — Level 1 playable 🏁

- [ ] **T5.1 — Level FSM.**
  **Do:** `systems/levelstate.ts` — LAUNCH(Coriolis) → WAVES_A → MID_BOSS → WAVES_B → END_BOSS → [VIPER if contraband] → DOCK.
  **Done-when:** **scenario test** drives the FSM through every state headless.
  **Refs:** ROC-LVL-1,2.

- [ ] **T5.2 — Level 1 content.**
  **Do:** `content/level1.json` + asteroids (fragment→boulders, yield alloys/metals/gems/crystals), lone Sidewinder/Krait/Gecko/Adder, **hermit-asteroid mid-boss (guaranteed laser drop)**, **Fer-de-Lance end boss**.
  **Done-when:** plays start→dock; mid-boss always drops a laser; **scenario test** asserts both bosses reached and laser dropped.
  **Refs:** ROC-L1-1..5, ROC-PWR-6.

- [ ] **T5.3 — Pickups.**
  **Do:** `systems/pickups.ts` — fuel/gems→shield (surplus→cargo), alloys→hull; shot-effects (fuel explode-no-splash, alloys/gems shatter); cargo scoop text; laser pickups fit.
  **Done-when:** **unit tests** for each pickup's collect + shot behaviour; surplus banks as cargo.
  **Refs:** ROC-PWR-1..6, ROC-ECO-3.

🏁 **Milestone M2 — "Level 1 playable":** launch → waves → hermit boss → Fer-de-Lance → dock, with M1 controls, pickups, economy, and the harness + first property/scenario suites green. *This is the first human-playtestable build.*

---

## Phase 5a — Boss fights, docking & hyperspace (requirements §3.23–3.27)

Turns the placeholder bosses into the specified fights and adds the level bookends. Order: T5a.1 → T5a.2 → T5a.3 → {T5a.4, T5a.5 in either order} → T5a.6 → T5a.7 → T5a.8.

- [ ] **T5a.1 — Sim-owned scroll & boss framing.**
  **Do:** add `world.scroll` (default 1; 0 through `MID_BOSS`/`END_BOSS` and the kill-text fade); starfield drift multiplies by it (renderer reads sim state, drops its wall-clock drift); render the horizontal black-and-white boss health bar top-of-screen from `boss.hull/hullMax`; on boss death emit `bossKilled` → shell fades "RIGHT ON COMMANDER" in white; FSM holds the boss state until the fade elapses, then restores scroll and advances.
  **Done-when:** **scenario test** — entering a boss state sets `scroll` 0; killing the boss emits `bossKilled`; `scroll` returns to 1 only after the fade timer; bar fraction tracks damage in state.
  **Refs:** ROC-BOSS-1..4; design §12a.

- [ ] **T5a.2 — Per-entity scale (render + collision).**
  **Do:** `Entity.scale` multiplier over `SHIP_SCALE`, honoured by the renderer model matrix, silhouette collision (`hullRadius`, dilation) and the ram test; content plumbs it — **Fer-de-Lance 1.5× everywhere incl. the player hull** (ships.json/enemies.json), boss FdL 2.0×, hermit & docking Coriolis 2× the Coriolis' drawn size.
  **Done-when:** **unit tests** — a scaled entity's collision silhouette matches its drawn size; player FdL and enemy FdL both come out 1.5×; boss override 2.0×.
  **Refs:** ROC-FDL-1, ROC-HERM-2, ROC-DCKG-1.

- [ ] **T5a.3 — Boss ECM.**
  **Do:** `systems/ecm.ts` — while an ECM-flagged boss lives, a player missile launch arms a 300 ms fuse; on expiry remove **all player missiles harmlessly** (no damage path), emit `{type:'ecm'}` (shell: screen flash + "ECM" caption bottom-of-screen), 500 ms cooldown; dies with the boss.
  **Done-when:** **unit tests** — fuse and cooldown timings; detonation damages nothing; missiles fired after the boss dies fly unaffected.
  **Refs:** ROC-BECM-1..4.

- [ ] **T5a.4 — Hermit-asteroid mid-boss.**
  **Do:** composite hermit visual (asteroid mesh at 2× Coriolis size + the station's docking-port rectangle) fixed top-centre, slow y-spin with the port on the rotation axis; hits inside the port rect deal **3× damage**; hull 30 / no shields; boss ECM on; adder launcher — every 5 s while <3 alive, either launch-from-rock (spawn yaw = rock's current angle, unwinding in flight) or side entry, winding medium-fast paths that never collide with the rock, until the rock dies; on death: 1,000 cr, guaranteed laser drop, 10 random cargo, survivors flee off-screen; one whole-fight wave record → 50% bonus only if **every** adder (incl. fleers) died.
  **Done-when:** **scenario tests** — port hits triple; spawn cadence/cap; flee-on-death; bonus paid only on total clearance; rewards land.
  **Refs:** ROC-HERM-1..12, ROC-PWR-6, ROC-ECO-1a.

- [ ] **T5a.5 — Fer-de-Lance end boss.**
  **Do:** `strafe` boss ai — fast rounded-rectangle track, direction reverses on an rng timer in [200, 2000] ms, aimed shot every 400 ms; 8 shield rings; boss ECM on; 2.0× scale; on death: 10 cargo items + 1,000 cr + `bossKilled` text.
  **Done-when:** **unit tests** — track position is continuous, reversal intervals stay in-bounds, fire cadence 400 ms; **scenario test** on rewards and shield count.
  **Refs:** ROC-FDL-1..5.

- [ ] **T5a.6 — Death checkpoints & respawn-in-place.**
  **Do:** death resolution branches on `levelState` — boss states: respawn in place, **keep all entities** (boss damage persists); `WAVES_B`: clear combat, restart part 2 only; earlier states: today's restart-level; escape pod unchanged and checked first.
  **Done-when:** **scenario tests** for all three branches; boss hull is identical before/after a player death mid-fight.
  **Refs:** ROC-BOSS-5..7, ROC-LIFE-2,3.

- [ ] **T5a.7 — Docking sequence.**
  **Do:** `DOCKING` state after the end-boss fade — scroll resumes, 2× Coriolis scrolls into view spinning slowly on y; guns + missiles disabled; dock test = player inside the port rect while the port is within 30° of horizontal ⇒ `DOCK` (shop); hull contact ⇒ death (life loss) then, with lives remaining, `DOCK` anyway; zero lives ⇒ game over.
  **Done-when:** **scenario tests** — aligned entry docks; misaligned/hull contact kills then still reaches the shop; firing inputs are inert throughout.
  **Refs:** ROC-DCKG-1..4.

- [ ] **T5a.8 — Launch & hyperspace.**
  **Do:** `LAUNCH` renders the up-pointing Coriolis scrolling away behind the player; `HYPERSPACE` emits "Hyperspace [system] 5…1" countdown events (system name from level content), ramps `world.scroll` up (starfield dots stretch to full-height lines), holds a few seconds, ramps back; `INFO` shows a card of Elite facts for the system, then the level proper begins. Runs on **every** launch, including the first.
  **Done-when:** **scenario test** drives LAUNCH → HYPERSPACE → INFO → level start headless; countdown events carry the right system name; `world.scroll` follows the ramp profile.
  **Refs:** ROC-HYP-1..5, ROC-LORE-1,2.

🏁 **Milestone M2a — "Boss fights feel like boss fights":** scroll-stop + health bar + "RIGHT ON COMMANDER" on both L1 bosses, missiles countered by boss ECM, checkpointed deaths, a real docking approach, and the launch/hyperspace bookends.

---

## Phase 6 — Station, ships & progression

- [ ] **T6.1 — Ships content & fitting.**
  **Do:** `content/ships.json` (stats + hardpoints per design table); laser-fit-per-direction rules; weapons carry forward on ship change.
  **Done-when:** **unit tests** — hardpoint cap + one-laser-per-direction; buying next ship re-fits lasers with no loss.
  **Refs:** ROC-SHIP-1..6, ROC-LAS-1,2.

- [ ] **T6.2 — Station screen.**
  **Do:** `screens/station.ts` — wireframe dock + docked ship, blurb, Sell Cargo, Upgrade Ship, fit lasers, buy ECM/bomb/pod/life/missile-level, **Launch (confirm)**, balance shown.
  **Done-when:** **headless tests** on intents — sell converts cargo→credits; upgrade with sufficient wallet changes ship + carries lasers; insufficient funds disables; launch needs confirm.
  **Refs:** ROC-STN-1..7, ROC-ECO-6,7,9.

- [ ] **T6.3 — Rating.**
  **Do:** `systems` kill-weighted tally → Harmless…Elite ladder; rank-up notice; "RIGHT ON, COMMANDER!".
  **Done-when:** **property test** — tally monotonic; threshold crossing fires once; Thargoid weighted highest.
  **Refs:** ROC-RTG-1,2,3.

- [ ] **T6.4 — Lives, death, escape pod, difficulty.**
  **Do:** 3 lives; death→lose life + restart level; escape-pod→respawn at death point, consume pod; buy lives max 5; global difficulty.
  **Done-when:** **unit/scenario tests** — 0≤lives≤5; pod path vs restart path; game-over at 0.
  **Refs:** ROC-LIFE-1..5, ROC-DIF-1,2.

- [ ] **T6.5 — Persistence.**
  **Do:** `platform/storage.ts` save object (high scores, best rating, unlocks, settings, controls); high-score table.
  **Done-when:** round-trips via Storage interface; **unit test** with in-memory Storage stub.
  **Refs:** ROC-LBD-1,1a; ROC-PROG-3.

---

## Phase 7 — Levels 2–4, bosses, hazards

Order: **T7.0 → T7.0a → T7.1 → T7.1a → T7.2**. T7.0/T7.0a are new prerequisites — today `createSim`
loads exactly one hardcoded `LevelDef` (`platform/main.ts` imports `level1.json` directly; `world.levelIndex`
exists but nothing reads it, and `launch()` in `station.ts` only emits an event) — so Level 2 and 3
have nowhere to load into until the campaign can actually advance between levels.

- [x] **T7.0 — Multi-level campaign plumbing.** *(new prerequisite)*
  **Do:** `SimContent.levels: LevelDef[]` (replacing the single `level` field) in `loadContent.ts`
  and `sim/index.ts`; `createSim` starts at `world.levelIndex` (default 0) via `startLevel(world,
  levels[world.levelIndex], ctx)`; on `DOCK` → `launch()` (`systems/station.ts`), increment
  `levelIndex` and call `startLevel` with `levels[levelIndex]` instead of just emitting `{type:
  'launch'}`; past the last level, hold at `DOCK` (or hand off to T9.1's Elite-mode replay loop —
  stub a `{type: 'campaignComplete'}` event for now). `platform/main.ts` imports `level1`, `level2`,
  `level3` and passes `levels: [level1, level2, level3]`.
  **Done-when:** **scenario test** — docking after level 1 and confirming launch advances
  `levelIndex` to 1 and starts level 2's `LAUNCH` state with level 2's own wave/boss content
  (not level 1's, and not a restart of level 1); snapshot round-trips `levelIndex` correctly
  (already serialised in `snapshot.ts`, just needs to be *used*).
  **Refs:** ROC-LVL-1,2; design §12 (levelstate).

- [x] **T7.0a — Multi-boss mid-fights.** *(new prerequisite, for T7.2's Anaconda pair)*
  **Do:** `LevelDef.midBoss` accepts `string | string[]`; `enterLevelState`'s `MID_BOSS` case
  spawns one boss entity per name via the existing `spawnBoss`. No change needed to `bossCleared`/
  `tickBossFade` — both already check "any entity of kind `boss`" generically, so the fight ends
  only once *all* spawned bosses are dead. Position the pair via `bossPlacement` params (e.g. two
  offset `strafe` tracks, or a shared symmetric track pair) so they don't overlap on spawn.
  **Done-when:** **scenario test** — a two-name `midBoss` spawns two boss entities; killing only
  one does not clear `MID_BOSS`; killing both does, exactly once, and `WAVES_B` follows.
  **Refs:** ROC-L3-3.

- [ ] **T7.1 — Level 2 content (Deep space).**
  **Do:** `content/level2.json` — denser `asteroidWaves`/`combatAsteroids` bands than Level 1
  (ROC-L2-2); more elaborate `wavesA`/`wavesB` (larger counts, tighter spacing, more aimed fire,
  mixed enemy pairings across the existing pattern library — no new patterns needed, ROC-ENM-8);
  **Python mid-boss** and **Constrictor end-boss** stat entries in `enemies.json` (Python: reuse
  the `hermit`-style parked/launching boss shape or a new stationary turret boss if the hermit
  framing doesn't fit narratively; Constrictor: `strafe` behavior reused from the FdL boss, with
  a materially higher `shield` than any Level 1 boss to read as "abnormally strong shields,"
  ROC-L2-4). New meshes: `python.json`, `constrictor.json` via `tools/bbcelite_to_mesh.py` —
  **requires adding `SHIP_PYTHON_*`/`SHIP_CONSTRICTOR_*` VERTEX/EDGE/FACE blocks to
  `tools/blueprints/elite-ships.asm`** (source from bbcelite.com / Ian Bell's archive — neither
  ship's blueprint data is in the repo yet, unlike Krait/Mamba/Cobra which already are), then
  regenerate and run `tools/test_meshes.py`.
  **Done-when:** meshes schema-valid with known vertex/edge counts (Python check, per T1.1's
  pattern); **scenario test** drives level 2 headless start→dock, asserting both bosses reached
  and Constrictor's shield count exceeds the FdL boss's.
  **Refs:** ROC-L2-1..4.

- [ ] **T7.1a — Witchspace interlude (L2→3).** *(v1.10, new)*
  **Do:** new `LevelState = 'WITCHSPACE_COMBAT'`, entered from `HYPERSPACE` in place of `INFO`
  when `level.witchspace` is set (only Level 3's `LevelDef` sets it, per ROC-WITCH-4). On entry,
  freeze `world.scroll` at `HYPER.peak` (don't let it settle) and `startWave(world,
  level.witchspace, ctx)` (a Thargoid wave, reusing `waves.ts` — no new spawn machinery). While
  in this state the tick holds `scroll` at `HYPER.peak` every frame (guard against `levelStateSystem`'s
  normal settle-back) and checks `groupCleared`; once clear, ramp `scroll` back to 1 over
  `HYPER.settleSec` (reuse `hyperScrollAt`'s settle curve, or a small local ramp) and transition to
  `INFO` exactly as an ordinary jump would. Guns/missiles/movement stay live throughout — this is a
  real fight, not a cutscene (ROC-WITCH-2).
  **Done-when:** **scenario test** — entering `WITCHSPACE_COMBAT` holds `scroll` at peak
  indefinitely while any Thargoid is alive (advance many frames, assert no drift); killing every
  Thargoid in the wave lets `scroll` settle and the FSM advance to `INFO` with Level 3's system
  name/facts; a level *without* `level.witchspace` set (Level 1, Level 2) skips straight to `INFO`
  unaffected.
  **Refs:** ROC-WITCH-1..4.

- [ ] **T7.2 — Level 3 content (Star surface).**
  **Do:** `content/level3.json` — `wavesA`/`wavesB` with the ROC-ENM-12 L3 escalation (homing
  missiles some enemies carry, shootable per `ROC-MIS-5`/existing `missiles.ts`; check whether
  enemy-fired homing missiles are already supported by `systems/ai.ts`/`missiles.ts` or need a
  small extension — they're currently player-only per T4.4); `midBoss: ["anaconda", "anaconda"]`
  (T7.0a) fought together; `endBoss: "generation_ship"`. New meshes: `anaconda.json`,
  `generation_ship.json` — same blueprint-sourcing gap as T7.1 (add blueprint blocks to
  `elite-ships.asm`, regenerate, `test_meshes.py`); the generation ship has no canonical Elite
  blueprint, so it needs an original hand-authored mesh (large, slow-silhouette, distinct from the
  saucer/wedge language of the rest of the roster) rather than a parser pass.
  **Do (star hazard):** a right-side star hazard is primarily a render/backdrop concern (reuse the
  `showAsteroidBackdrop`-style flag pattern already in `platform/main.ts`/`level1.json`'s
  `"backdrop"` field — e.g. `"backdrop": "star"`) plus a small new sim-side hazard: periodic
  "flare" events on a timer (`systems/particles.ts` or a new light `hazards.ts`) that deal damage
  in a screen-relative danger zone near the star edge, dodgeable like enemy fire (ROC-ENM-11
  precedent). Keep this scoped — a timer + damage-zone check, not a new system category.
  **Done-when:** meshes schema-valid; **scenario test** drives level 3 headless start→dock,
  asserting both Anacondas reached and killed before `WAVES_B`, generation ship reached and
  killed; **unit test** for the flare hazard's damage timing/zone on a known star position.
  **Refs:** ROC-L3-1..4.

- [ ] **T7.3 — Level 4 (Alien warzone).** *(v1.10 — renamed; ordinary launch entry, no mid-boss, shorter pacing)* Thargoids + **saucer variants** + Thargon swarms (inert on parent death) + **broken Galactic Navy wrecks** as scenery/hazard; **mothership end**, no mid-boss. **Refs:** ROC-L4-0,1,1a,2,3,4; ROC-ENM-6.
- [ ] **T7.4 — ECM & Energy Bomb.** ECM clears projectiles+missiles on cooldown; Energy Bomb clears non-boss + projectiles, **boss-safe (non-lethal)**. Property test: bomb never kills a boss. **Refs:** ROC-DEF-1,2,3.
- [ ] **T7.5 — Contraband interception.** Carrying illegal cargo at level end ⇒ extra Viper fight, no credits, kills count. Scenario test. **Refs:** ROC-LVL-4, ROC-ECO-4.
- [ ] **T7.6 — Density profiles.** L1–2 sparse/readable; L3–4 Xenon-2 bullet-hell via difficulty/count curves. **Refs:** ROC-ENM-13.

🏁 **Milestone M3 — "Full campaign":** all four levels, all bosses, ECM/bomb, contraband path — start to finish.

---

## Phase 8 — Title, audio, flavour

- [ ] **T8.1 — Title/intro screen.** Rotating Sidewinder; title/credits top; **local-storage privacy disclaimer** bottom; start ⇒ ship flies into play, control transfers (continuous). **Refs:** ROC-TTL-1..5.
- [ ] **T8.2 — Audio.** `audio/webaudio.ts` (optional, file-loaded) + `nullaudio.ts`; wire the SFX event set; silent-playable. Null backend asserts events (e.g. kill ⇒ `explode_small`+`cash`). **Refs:** ROC-SFX-1,2, ROC-NFR-3.
- [ ] **T8.3 — Lore & flavour.** `blurbs.json` + named systems (Riedquat for Elite mode), Jameson default name, **Dark Wheel** ace waves, **Raxxla** hidden secret, dock-geometry variety (Coriolis/Dodo/icosahedral), Blue-Danube-style cue (PD arrangement). **Refs:** ROC-LORE-1..7.

---

## Phase 9 — Endgame, tuning, polish

- [ ] **T9.1 — Unlocks.** Completing campaign ⇒ **Elite mode**; completing Elite mode ⇒ **playable Thargoid**. Scenario tests on the gate logic. **Refs:** ROC-PROG-1,2; ROC-SHIP-6.
- [ ] **T9.2 — Balance-sim & tuning.** `test/balance/autoplayer.ts` heuristic bot; run across seeds/difficulties; report income/deaths/time-to-clear; **set ship/pod/life/missile prices and difficulty curves** so "~one ship per level if keeping up" holds. **Refs:** ROC-TEST-7, ROC-SHIP-1a, decisions-log item 4.
- [ ] **T9.3 — Accessibility.** Reduced-flash mode (shield-flash/explosions/star activity), audio toggle, remap UI. **Refs:** ROC-NFR-3.
- [ ] **T9.4 — Performance pass.** Pools, pre-rendered particle dot, dPR cap, mobile entity/particle budgets; validate 60 fps at ≥50 entities incl. swarm+bomb. **Refs:** ROC-NFR-1,4.
- [ ] **T9.5 — Leaderboard (optional).** Firebase submit + **GDPR consent**; decline ⇒ local only. **Refs:** ROC-LBD-2,3,4.
- [ ] **T9.6 — Publish prep.** Portrait build, itch.io/CrazyGames packaging, IP/licensing sanity-check (hull/name homage; PD music arrangement).

🏁 **Milestone M4 — "Ship it":** tuned, accessible, performant, optionally online.

---

## Critical path (shortest route to a playable build)

T0.1 → T0.2 → T0.3 → **T1.1 (parser)** → T1.2 → T1.3 → T2.1 → T2.2 → T2.3 → **M1** → T3.1 → T3.2 → T3.3 → T3.4 → T4.1 → T4.2 → T4.3 → T4.4 → T5.1 → T5.2 → T5.3 → **M2 (first playtest)**.

Everything from Phase 6 on broadens the game but isn't needed to first feel it play.

## Suggested first sitting

T0.1 (scaffold) and **T1.1 (the parser)** can proceed in parallel — the parser has no dependency on the engine and gives you real hulls to look at immediately. I'd start there.
