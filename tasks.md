# Right on Commander — Tasks

**Version:** 0.2 (draft)
**Derives from:** requirements.md v1.6, design.md v0.5
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

- [ ] **T7.1 — Level 2 (Deep space).** Dense asteroid bands; elaborate waves; **Python mid-boss**; **Constrictor end boss** (strong shields). Scenario test reaches both. **Refs:** ROC-L2-1..4.
- [ ] **T7.2 — Level 3 (Star surface).** Right-side curved star + flare hazard; **rogue-station + Vipers mid**; **generation-ship end**. **Refs:** ROC-L3-1..4.
- [ ] **T7.3 — Level 4 (Alien space).** **Witchspace entry**; Thargoids + **saucer variants** + Thargon swarms (inert on parent death); **mothership end**. **Refs:** ROC-L4-0,1,1a,2; ROC-ENM-6.
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
