# Right on Commander — Design

**Version:** 1.0 (draft — all design decisions resolved)

> **Changelog 0.9 → 1.0:** **Reversed the play/render area from portrait to a fixed 4:3 landscape "game box"** — supersedes ROC-HUD-1/ROC-NFR-4 as documented in requirements.md (a matching requirements.md update is tracked separately). New `render/viewport.ts` (`computeViewportBox`/`computeViewport`, pure) is the single source of truth for the box, consumed independently by `Renderer2D` (render scale, HUD/button layout) and `DomInput` (pointer-to-field mapping) so the two always agree without being wired together. `Renderer2D.beginFrame`/`endFrame` now draw through a box-local, letterboxed transform each frame with a 1px white border around the box; on a portrait **touch** device the frame draws through an additional 90° rotation so the box fills the screen instead of shrinking, with a persistent on-screen hint telling the player to turn their device sideways — a narrow **desktop** window (no touch) falls back to a plain shrink-to-fit box instead of rotating. See §7 (Viewport & aspect lock) and §17.
>
> **Changelog 0.8 → 0.9:** **Removed Level 3's star backdrop and star-flare hazard** — `renderer2d.ts`'s `drawStarBackdrop`/`showStarBackdrop`/`starFlareAlpha`, `systems/hazards.ts` (`HazardState`/`StarFlareDef`/`hazardsSystem`/`initHazard`) and `world.hazard`, and `level3.json`'s `backdrop`/`starFlare` fields, are all gone — the circle was large enough to cover the whole viewport at the game's aspect ratio rather than read as an edge limb (requirements v1.12). Added a **corner-tap cheat code**: tapping all four screen corners in clockwise order starting top-left grants 100 lives + 1,000,000cr once, and reveals a persistent **Skip Level** HUD button (`sim.cheatSkipLevel()`) that wipes the current combat and jumps straight to the docking approach, same as clearing the level normally. `gamestateSystem`'s life-loss decrement no longer clamps to `MAX_LIVES` before subtracting, so a cheat-granted life count above 5 decrements normally instead of snapping down to 4 on the next death.
>
> **Changelog 0.7 → 0.8:** Level 3's mid-boss changes to a **pair of Anacondas** (`midBoss: "anaconda_pair"`, ROC-L3-3). Added a **witchspace interlude between Level 2 and 3**: level3's schema entry becomes `"entry": "witchspace_interlude"`, and the level FSM gains a `WITCHSPACE_COMBAT` state between `HYPERSPACE` and `INFO` — `world.scroll` holds at its fully-stretched hyperspace value (instead of resuming) until a spawned Thargoid wave is cleared, then the jump resolves as usual (§12, §12a). **Level 4 renamed "Alien warzone"**, reverts to a normal `"entry": "launch"` (the misjump framing moved to the new interlude), adds **broken Galactic Navy wrecks** as scenery/hazard, and **drops its `midBoss`** entirely — wave combat runs straight to the end boss, and the level is paced shorter. See requirements v1.10 (ROC-L3-3, ROC-WITCH-1..4, ROC-L4-0,3,4).
>
> **Changelog 0.6 → 0.7:** Removed the player's graduated hull damage: `applyDamage` now special-cases `kind === 'player'` to set `hull = 0` outright on any unshielded hit, instantly lethal, while every other entity keeps subtracting damage as before. The player also now flashes white (`flashTtl`) on a shield-absorbed hit, not just an unshielded one. Split blink from i-frames: added `player.respawnBlinkTtl`, set only by `respawnPlayer()` (never by the ramming contact's `invulnTtl` grant), so the ship only blinks in the window right after a fresh respawn. Starting lives raised 3 → 4 to compensate. Dropped the hull segment from the bottom status bar. See §8, §12 Game FSM, and requirements v1.9 (ROC-DMG-2a,6b; ROC-LIFE-1,2c; ROC-HUD-2).
>
> **Changelog 0.5 → 0.6:** Designed the **boss encounters, docking and hyperspace** (requirements §3.23–3.27). The sim now owns a **`world.scroll` factor** (1 normal, 0 during boss fights, ramping >1 through hyperspace) that the render starfield consumes — scroll-stop is game state, not a render effect. The **level FSM** gains `HYPERSPACE`/`INFO` up front and a `DOCKING` approach phase before `DOCK`; death resolution branches on `levelState` (boss states respawn **in place** with all entities kept; `WAVES_B` restarts part 2; part 1 keeps the restart-level default). Entities gain an optional **per-entity `scale`** multiplier honoured by both the renderer and collision (FdL 1.5×, boss FdL 2.0×, hermit/dock station 2× Coriolis). New **boss ECM** system (300 ms fuse, harmless missile detonation, 500 ms cooldown, "ECM" caption) and two boss `ai` archetypes: `hermit` (y-rotation, port-aligned triple damage, adder launcher) and `strafe` (rounded-rect track, random direction reversals, timed aimed fire). See §12a.

> **Changelog 0.4 → 0.5:** Shields reworked to **hug the hull silhouette** instead of a separate ellipse — see §8 (Collision & damage model) and the Shields entry under §7 (Rendering). Collision, the drawn rings, and ship-to-ship ramming all now derive from the same `hullRadius`/`shieldGap`/`offsetPolygonPath` primitives, so a shot lands exactly where the outermost ring is drawn.

> **Changelog 0.3 → 0.4:** Project renamed **EliteShooter → Right on Commander**; requirement-ID prefix `ES-` → `ROC-`.

> **Changelog 0.2 → 0.3:** All §19 design decisions confirmed — TS, Vitest+fast-check (TS, not Python), Vite, convex-polygon hull collision, 1/120 s sim tick, 25° perspective camera. Ready to build.
**Derives from:** requirements.md v1.6
**Stack:** **TypeScript** (ES modules, bundled by Vite) + HTML5 Canvas 2D; Python for offline tooling only.

> **Changelog 0.1 → 0.2:** Language locked to **TypeScript** (was JS+JSDoc). The interface typedefs in §4 become real TS `interface`s, and the sim/render/audio/input seam is enforced by the TS compiler. Vitest + fast-check run the TS sim directly.

> This document turns the EARS requirements into architecture. The organising idea is a **pure, deterministic simulation core** with everything else (render, audio, input, storage, time) behind swappable interfaces — which is what makes the headless testing in §4.1 of the requirements possible. Requirement IDs are cited as `[ROC-…]`.

---

## 1. Goals & principles

1. **Pure sim, thin shell.** All game logic lives in a `sim/` core that imports nothing from the DOM, Canvas, Web Audio, or `Math.random`. The browser shell wires real backends into it; tests wire null/recording backends. `[ROC-TEST-1]`
2. **Determinism by construction.** Same seed + same input log ⇒ identical state, every time. All randomness flows through one injected PRNG; time advances in fixed steps. `[ROC-TEST-2, AS-2]`
3. **State is data.** The whole world is a plain serialisable object (including RNG state), so tests and the balance-sim assert on numbers, never pixels. `[ROC-TEST-4]`
4. **Content is data.** Ships, lasers, enemies, waves, levels, economy and blurbs are JSON, loaded and validated into the sim — so tuning and variety need no code changes. `[ROC-ENM-7, ROC-SHIP-1a]`
5. **Render is a projection of state.** The renderer is read-only over the sim; it may interpolate between steps but never mutates game state.

---

## 2. Layered architecture & file layout

```
right-on-commander/
  index.html
  src/
    interfaces.ts          # TS interfaces: Renderer, AudioOut, InputFrame, Storage, Clock
    sim/                   # PURE. No DOM/Canvas/Audio/Math.random.
      index.js             # createSim({seed, content, config}) -> Sim
      world.js             # World state container; step(inputFrame)
      rng.js               # seedable PRNG (mulberry32) + state in/out
      entities.js          # entity factory, id allocation
      components.js        # JSDoc component typedefs
      snapshot.js          # serialise / restore full World (incl. rng, frame)
      systems/
        intent.js          # InputFrame -> player intent (move target, fire, ecm, bomb)
        movement.js        # integrate motion; player bounds clamp; banking
        paths.js           # enemy spline path eval; tangent orientation + bank
        weapons.js         # pulse/beam/military firing, cooldowns, all-mounts-fire
        missiles.js        # homing missiles; grade timer; downgrade on expiry
        collision.js       # broadphase + shield-dilated / hull-polygon tests
        damage.js          # shield depletion -> hull; flash flags; destruction
        particles.js       # explosions (edges fly apart), smoke/fire (seeded)
        pickups.js         # fuel/gems/alloys/cargo; shot-effects; banking surplus
        economy.js         # bounty, wave bonus, credits(wallet) vs score(lifetime)
        waves.js           # spawn schedule; wave membership; full-clear bonus
        ai.js              # enemy fire decisions (slow projectiles), boss phases
        levelstate.js      # per-level FSM: launch -> waves -> midboss -> waves -> endboss -> [vipers] -> dock
        gamestate.js       # meta FSM: title -> L1..L4 -> complete -> elite -> thargoid
      content/
        loadContent.js     # parse + schema-validate JSON -> typed sim structures
    content/               # DATA
      ships.json  lasers.json  enemies.json  economy.json  ratings.json  blurbs.json
      levels/level1.json ... level4.json
      waves/*.json
      meshes/*.json        # generated from bbcelite (see §15)
    render/                # Canvas 2D backend implementing Renderer
      renderer2d.js  project.js  camera.js
      viewport.js          # fixed 4:3 game box (pure) — shared by Renderer2D and DomInput, §7
      screens/title.js  station.js  hud.js  overlays.js
    audio/  webaudio.js  nullaudio.js
    input/  domInput.js  remap.js
    platform/  storage.js  loop.js  main.js
  test/
    harness.js             # headless: createSim + null backends; runFrames(); replay()
    unit/*.test.js
    property/*.test.js      # fast-check generators + invariants
    scenario/*.test.js      # scripted level runs
    balance/ autoplayer.js  balance.test.js
  tools/                   # Python (offline, ships nothing to browser)
    bbcelite_to_mesh.py
  vite.config.js  package.json
```

**Dependency rule:** `sim/` may be imported by everyone; `sim/` imports nothing outside itself. Enforced by the TS compiler config plus an ESLint boundary rule ("no DOM/Canvas/audio symbols in `sim/`"). All `src/` files are `.ts` (the tree shows base names); generated `content/` data stays `.json`.

---

## 3. Core loop & determinism

### Fixed-timestep loop
The shell drives a fixed-step accumulator; the sim only ever advances in whole steps of `DT` (proposed **1/120 s** sim tick, rendered at display rate with interpolation). `[AS-2]`

```js
// platform/loop.js (shell only)
const DT = 1 / 120;
let acc = 0, prev = performance.now();
function frame(now) {
  acc += Math.min(0.25, (now - prev) / 1000); prev = now;
  while (acc >= DT) { sim.step(input.sample()); acc -= DT; }
  renderer.render(sim.state, acc / DT);   // alpha for interpolation
  requestAnimationFrame(frame);
}
```

The **headless harness** calls `sim.step(scriptedInput)` directly in a tight loop — no `requestAnimationFrame`, no wall clock — so a full level runs in milliseconds. `[ROC-TEST-5]`

### RNG
Single `mulberry32(seed)` instance lives in the World. Every stochastic draw (particle vectors, drop rolls, AI jitter, wave spawn variance) calls `world.rng()`. RNG state is part of the snapshot. `Math.random` is banned in `sim/`. `[ROC-TEST-2]`

> **Determinism scope:** identical results are guaranteed within one JS engine (V8 powers both Node and Chromium). `Math.sin/cos/sqrt` are IEEE-754 and stable on V8; if we ever need cross-engine bit-identity we'll swap transcendentals for fixed tables, but that's not needed for CI (Node) or for replay on the same client.

---

## 4. Interfaces — the test contract

These four interfaces are the seam between the pure sim and the world (shown below as JSDoc-style typedefs for brevity — in the codebase they are TS `interface`s). Real impls in `render/`, `audio/`, `input/`, `platform/`; null/recording impls in `test/`.

```js
/** @typedef {Object} InputFrame
 *  @property {{x:number,y:number}|null} moveTarget  // pointer/stick target in play-field coords
 *  @property {boolean} firing        // fire held (autofire) [ROC-CTL-1]
 *  @property {boolean} fireTapped     // single-shot edge
 *  @property {boolean} ecm            // edge-triggered
 *  @property {boolean} energyBomb     // edge-triggered
 *  @property {boolean} confirm        // menus / "are you sure" [ROC-STN-6]
 *  @property {boolean} pause
 */

/** @typedef {Object} Renderer
 *  @property {() => void} beginFrame
 *  @property {(mesh, xform, opts) => void} drawMesh   // 3D hull: cull+sort+black fill+white stroke
 *  @property {(a, b, opts) => void} drawLine          // lasers, dock wireframe
 *  @property {(c, rx, ry, opts) => void} drawEllipse  // generic pixel-space ellipse primitive
 *  @property {(points, opts) => void} drawParticles
 *  @property {(text, pos, opts) => void} drawText     // score/credits/lives, floating text
 *  @property {(alpha:number) => void} endFrame
 */

/** @typedef {Object} AudioOut
 *  @property {(id:string, opts?) => void} play   // no-op if disabled [ROC-SFX-1]
 *  @property {(on:boolean) => void} setEnabled
 */

/** @typedef {Object} Storage
 *  @property {(key:string) => any|null} load
 *  @property {(key:string, value:any) => void} save
 */
```

**Sim surface:**
```js
const sim = createSim({ seed, content, config });
sim.step(inputFrame);     // advance one DT
sim.state;                // readonly World (renderer & tests read this)
sim.snapshot();           // -> plain object (incl. rng, frame) [ROC-TEST-4]
sim.restore(snapshot);    // for replay/regression [ROC-TEST-5]
```

The renderer/audio are **not** passed into the sim — the sim emits an **event list** each step (e.g. `{type:'explosion',pos}`, `{type:'sfx',id:'laser_pulse'}`, `{type:'flashWaveBonus',amount}`) which the shell drains and routes to Renderer/AudioOut. This keeps the sim pure while still driving effects, and lets tests assert on emitted events. `[ROC-SFX-2, ROC-ECO-1b]`

---

## 5. Sim data model

A lightweight **entity + components** model (struct-of-fields, not a heavy ECS — entity counts are modest). The World owns flat arrays/maps; systems iterate by tag.

```js
/** @typedef {Object} Entity
 *  @property {number} id
 *  @property {string} kind        // 'player'|'enemy'|'boss'|'projectile'|'missile'|'pickup'|'cargo'|'particle'|'station'
 *  @property {Vec3}   pos         // world space (see §7 axes)
 *  @property {Vec3}   vel
 *  @property {number} yaw         // facing (path tangent / heading)
 *  @property {number} bank        // roll angle, ∝ lateral motion [ROC-MOV-3, ROC-ENM-3]
 *  @property {string} [meshId]
 *  @property {number} [scale]     // per-entity size multiplier over SHIP_SCALE; render + collision [ROC-FDL-1]
 *  @property {number} [shield]    // remaining shield rings [ROC-DMG-3]
 *  @property {number} [shieldMax]
 *  @property {number} [hull]
 *  @property {number} [hullMax]
 *  @property {number} [flashTtl]  // white damage flash timer [ROC-DMG-6a]
 *  @property {number} [shieldFlashTtl]
 *  @property {number} [bounty]
 *  @property {number} [waveId]    // membership for the 50% bonus [ROC-ECO-1a]
 *  @property {Object} [path]      // spline + t for enemies [ROC-ENM-2]
 *  @property {Object} [ai]        // fire cadence, pattern, boss phase
 *  @property {Object} [pickup]    // {type:'fuel'|'gems'|'alloys'|'laser'|'missile'|'ecm'|'bomb'|...}
 *  @property {boolean}[contraband]// different shape [ROC-ECO-4]
 */
```

**World (the serialisable state):**
```js
World = {
  frame, rngState,
  mode,                 // gamestate FSM tag
  levelIndex, levelState,
  entities,             // Map<id, Entity>
  player: {             // persistent across deaths within a run
    shipClass, hardpoints, lasers: {front,rear,left,right}, // laser type or null [ROC-LAS-2]
    missileGrade, missileTimer,                              // [ROC-MIS-1..4]
    ecm, energyBombs, energyBank, energyBankTimer, lives,    // [ROC-LIFE-1..4, ROC-BANK-1,2]
    invulnTtl,             // post-spawn / post-contact i-frames (no blink of its own) [ROC-LIFE-2]
    respawnBlinkTtl,       // blink window, set only on respawn — never by a ramming contact [ROC-LIFE-2c]
    respawnPending: {x,z,timer} | null,   // wreck waiting out its explosion + 500ms [ROC-LIFE-2b]
  },
  econ: { wallet, score },          // credits vs lifetime score [ROC-ECO-2]
  cargo: { /* type -> tonnage */ }, // sellable at dock
  rating: { kills, weightedTally, rank }, // kill-based [ROC-RTG-1]
  waves: { active: Map<waveId,{members:Set,total,bountySum}> }, // [ROC-ECO-1a]
  unlocks: { eliteMode:false, thargoidShip:false },           // [ROC-PROG-1,2]
  events: [],            // drained by shell each step
}
```

---

## 6. Systems (ordered per step)

Each `step()` runs systems in a fixed order so behaviour is deterministic:

1. **intent** — `InputFrame` → player intent. `[ROC-CTL-*]`
2. **waves** — advance spawn schedule; register members; detect full-clear → emit wave bonus. `[ROC-ENM-1, ROC-ECO-1a/1b]`
3. **ai** — enemy/boss fire decisions; spawn slow projectiles; boss phase transitions. `[ROC-ENM-11, ROC-L*-bosses]`
4. **paths** — advance enemy path `t`; set `yaw` to tangent; set `bank` from turn rate. `[ROC-ENM-2,3]`
5. **movement** — integrate vel; player follows `moveTarget`, clamp fully on-screen; bank from lateral velocity; engine-flame flag. `[ROC-MOV-1..5]`
6. **weapons** — fire all equipped mounts simultaneously; pulse spawns moving segments, beam raycasts, military spawns fat pulse. `[ROC-LAS-3..6]`
7. **missiles** — tick grade timer (downgrade/expire); home active missiles; missiles are destructible. `[ROC-MIS-1..5]`
8. **collision** — broadphase grid; shield-dilated-silhouette vs hull-polygon tests; ramming via silhouette-vs-silhouette. `[ROC-DMG-1,5,6a]`
9. **damage** — apply hits: shield first (flash the ring, and for the player also flash white); then hull (flash white + fragments + smoke/fire), except the player, who has no hull buffer and dies instantly once unshielded; destruction → bounty, drops, particles. `[ROC-DMG-2,2a,6,6a,6b,7; ROC-ECO-1]`
10. **pickups** — collection effects (fuel/gems→shield, alloys→hull, surplus→cargo); shot-effects (fuel explode no-splash, alloys/gems shatter); cargo scoop text. `[ROC-PWR-1..4, ROC-ECO-3]`
11. **particles** — integrate/expire; all spawned via `world.rng`. `[ROC-VIS-6]`
12. **lifetime** — cull expired/off-field entities; mark wave escapees (forfeits bonus). `[ROC-ECO-1a]`
13. **levelstate / gamestate** — advance FSMs (below).

---

## 7. 3D render pipeline (Canvas 2D software 3D)

### Axes & camera
World space: **+x** right, **+z** forward (up-screen, the scroll axis), **+y** height above the play plane (ships sit near `y=0`). The fixed 4:3 landscape game box (below) maps x→box-x, z→box-y — supersedes ROC-HUD-1's portrait framing (see the 0.9 → 1.0 changelog above).

Camera sits **above and slightly behind** the action looking forward-down, tilt **θ ≈ 25°** from vertical — giving the "slightly back from directly overhead" view that reveals hull tops/backs. `[ROC-VIS-3]` Projection is **mild perspective** (small FOV) so depth occlusion reads naturally; near-orthographic to keep the flat vector feel.

### Viewport & aspect lock
The play/render area is a fixed **4:3 landscape box**, not the raw canvas — so play reads identically regardless of window/device aspect ratio (the previous portrait-fills-the-window approach let render scale and input mapping silently drift out of sync on anything but a portrait-shaped window). `render/viewport.ts` is the single pure source of truth:

- `computeViewportBox(canvasW, canvasH)` — the largest 4:3 rect that fits within the canvas, centered; letterboxed (bars top/bottom) or pillarboxed (bars left/right) as needed.
- `computeViewport(canvasW, canvasH, touchCapable)` — wraps the box with a `rotated` flag: **true** only when the canvas is portrait *and* the device is touch-capable.
  - **Landscape**, or **portrait on a non-touch (desktop) window**: `rotated = false`; the box is a plain shrink-to-fit rect.
  - **Portrait + touch** (phone/tablet held upright): `rotated = true`. Rather than shrinking the box into a small letterboxed rectangle, `Renderer2D.beginFrame` draws the whole frame through an additional 90° rotation (`ctx.translate(canvasW,0); ctx.rotate(90°)`) against the *swapped* dimensions, so the box fills the screen edge-to-edge instead. A persistent on-screen hint ("turn your phone sideways"), drawn in plain physical screen coordinates *after* the frame's rotation transform is restored, tells the player to physically turn the device — deliberately not the Fullscreen API, which iOS Safari doesn't support for ordinary pages.

`Renderer2D` and `DomInput` each call `computeViewport` independently (from the same canvas CSS dimensions + touch capability) rather than sharing a live object — being a pure function of the same inputs, they agree by construction with no coordination needed. `Renderer2D.beginFrame`/`endFrame` bracket each frame with the rotation + box-offset transform (plus a clip to the box, and the 1px white border drawn just inside it once the clip is lifted), so every draw call for the rest of the frame — including `main.ts`'s own HUD/button/overlay drawing — works in plain box-local pixel coordinates with no per-call offset math. `DomInput.toField` and `main.ts`'s cheat/station tap handling map incoming client coordinates through the same box (via `physicalToLogical`, the inverse of the render rotation), so a drag or tap that lands outside the box — in a letterbox bar, or past the device's physical rotation — clamps to the nearest field edge rather than reading as an out-of-sync or ignored position.

This is a real-renderer/real-input concern only — the abstract `Renderer` interface (§4) and the headless test harness are untouched; null/recording backends in tests have no notion of a box or aspect ratio.

### Per-object draw (`drawMesh`)
A mesh = `{ vertices:Vec3[], edges:[i,j][], faces:{loop:int[], normal:Vec3}[] }` (from bbcelite, §15).

1. Build model matrix: `yaw` (heading) ∘ `bank` (roll about forward axis) ∘ translate to `pos`. `[ROC-MOV-3]`
2. Transform vertices to camera space; project to 2D.
3. **Back-face cull:** drop faces whose transformed normal faces away (`n·viewDir > 0`). `[ROC-VIS-4]`
4. **Painter's sort:** order surviving faces by mean camera-space depth, far→near. `[ROC-VIS-5]`
5. **Fill black, stroke white:** fill each face polygon black (occludes hulls behind), then stroke its edges white. Anti-aliased Canvas strokes give the crisp vector look for free. `[ROC-VIS-1,2]`

### Other render
- **Lasers:** `drawLine` white segments (pulse short, military fatter, beam full-length flash). `[ROC-LAS-4..6]`
- **Shields:** N concentric rings hugging the hull's own projected silhouette (rounded outward offset, gap proportional to hull size and shield count) = remaining strength; drawn white @ 50% alpha, brief brighten on `shieldFlashTtl`. Collision uses the identical silhouette + gap, so a shot lands exactly where the outermost ring is drawn — see `hullRadius`/`shieldGap`/`SHIELD_GAP_FRAC` in `sim/systems/collision.ts` and `offsetPolygonPath` in `render/shieldRing.ts`. Ramming (ship-vs-ship contact) uses the same silhouettes dilated by each side's shield gap, instead of a bounding circle. `[ROC-DMG-1,2,3, ROC-DMG-6a]`
- **Explosions:** scatter the dying mesh's edges as line particles + white circular `drawParticles`. The player's own death (v1.8) uses a denser, longer-lived `PLAYER_EXPLOSION_PARTICLES` config with `base` velocity forced to zero — it plays out **in place**, not carried by the ship's speed. `[ROC-VIS-6, ROC-LIFE-2b]`
- **Starfield:** slow-scrolling white-dot layer drawn first, behind everything. `[ROC-VIS-7]`
- **Text/overlays:** persistent **bottom status bar** — shield/missile+countdown/bomb/bank, plus score/credits/lives (v1.9 — no hull readout, the player has no hull buffer; an ECM countdown is planned to join it) — floating bounty/cargo text; full-screen wave-bonus and rank-up flashes; a top-of-screen flash + caption on the energy-bomb auto-trigger. `[ROC-HUD-2,3, ROC-VIS-8, ROC-ECO-1b, ROC-RTG-3, ROC-DEF-2]`

Renderer interpolates positions by `alpha` between the last two sim states for smoothness without sub-stepping the sim.

---

## 8. Collision & damage model

- **Broadphase:** uniform spatial-hash grid over the play field; only same-cell/neighbour pairs tested.
- **Shielded target:** collision shape is the hull's **2D convex silhouette polygon**, dilated by `shieldGap(hullRadius, rings)` — the same gap the outermost shield ring is drawn at, so a shot lands exactly where the ring is; segment-vs-dilated-polygon test. `[ROC-DMG-1]`
- **Unshielded target:** collision shape is the **2D convex silhouette polygon** of the hull (precomputed per mesh), undilated; segment-vs-polygon test. (Chosen over circle-clusters/ellipses for fidelity to the visible shape; cheap at these counts — see Open Decisions.) `[ROC-DMG-5]`
- **Fallback:** an entity with no hull mesh (or content missing one) collides against a `colliderRx/Rz` ellipse instead, for both branches above.
- **Ramming:** silhouette-vs-silhouette (`convexPolygonsDistanceSq`), each dilated by its own side's shield gap — not a bounding circle, so a ram lands where the hulls (or shield rings) actually touch. `[ROC-DMG-6a]`
- **Damage resolution:** a hit removes one shield ring if shielded (→ `shieldFlashTtl`; for the player only, also sets `flashTtl`, ROC-DMG-2a), else subtracts hull and sets `flashTtl` (white flash) + spawns fragment particles; `hull ≤ 0` ⇒ destruction. **Exception:** the player has no hull buffer — once unshielded, `applyDamage` sets `hull = 0` outright on any hit rather than subtracting, so it's always instantly lethal; every other entity kind keeps graduated hull damage. `[ROC-DMG-2,2a,6,6a,6b]`
- **Damage flash rule** is centralised in `damage.js` so every damageable entity (player, enemy, boss, hazard) behaves identically. `[ROC-DMG-6a]`

---

## 9. Weapons

- **Mounts:** `player.lasers = {front,rear,left,right}`, each `null` or a laser type, capped by `hardpoints`; all non-null mounts fire on the same trigger. `[ROC-LAS-1,2,3]`
- **Pulse:** spawns a short moving segment-projectile per mount. `[ROC-LAS-4]`
- **Beam:** no projectile entity; on each tick while firing it raycasts the mount direction and applies `dps*DT` to the first target hit (continuous contact). `[ROC-LAS-5]`
- **Military:** fatter/longer pulse projectile, highest damage, slightly slower cadence. `[ROC-LAS-6]`
- **Missiles:** while `missileGrade>0`, auto-fire `grade` homing missiles per volley at nearest targets; `missileTimer` counts down `DT`; on expiry `grade--` and reset timer (remove at 0). Missiles are entities and destructible. `[ROC-MIS-1..5]`
- **ECM:** clears all `projectile`+`missile` entities on field, then cooldown. **Energy bomb** (v1.8 — auto-triggers instead of the ship dying, `gamestate.js`): destroys all non-boss enemies/asteroids + enemy projectiles/missiles; a boss takes 50% of its *current* hull as real damage (can kill an already-weakened one); the ship survives at 1 hull; capped at 1 carried (2 in the Fer-de-Lance). **Energy bank** (new): while owned, +1 shield ring every 15s (`energyBank.js`). `[ROC-DEF-1,2,2a; ROC-BANK-1,2]`

---

## 10. Wave system & content schemas

### Pattern functions
A **pattern** is a pure function `(t, params, rng) → {pos, tangent}` evaluated along each member's lifetime. The library implements the archetypes in `[ROC-ENM-9]`: `vform`, `loop` (1942), `sine_column` (Xenon 2 / Raiden), `side_stream` (Flying Shark), `pincer`, `orbit`, `drop_hold`. Adding a pattern = adding one function.

### Wave schema (data) `[ROC-ENM-7,8]`
```json
{
  "id": "w12",
  "pattern": "sine_column",
  "enemy": "krait",
  "count": 6,
  "spacingMs": 350,
  "speed": 1.0,
  "params": { "amplitude": 120, "wavelengthPx": 480, "entryEdge": "top" },
  "fire": { "rate": 0.6, "aimed": true }
}
```
Pattern, enemy and stats are orthogonal: swap `enemy` to re-skin a pattern; the wave manager records `count` and summed bounty for the **50%-on-full-clear** bonus. `[ROC-ECO-1a]`

### Level schema `[ROC-LVL-*, ROC-L1..L4]`
```json
{
  "id": "level3",
  "name": "Leesti",
  "blurb": "Leesti is reasonably famous for its vast bird population.",
  "ship": "asp_mk2",
  "dock": "coriolis",
  "entry": "witchspace_interlude", // (v1.10) L2->L3 only: the hyperspace jump lingers, stretched
                                    // starfield held, for a Thargoid wave before arrival [ROC-WITCH-1..4]
  "waves": ["w30","w31","w32"],
  "midBoss": "anaconda_pair",      // (v1.10) two Anacondas fought together [ROC-L3-3]
  "endBoss": "cobra_ace",           // (v1.11) an Elite ace in a fully-kitted Cobra Mk III [ROC-L3-4]
  "difficultyBase": 3
}
```
Level 4 reverts to `"entry": "launch"` (v1.10 — the misjump framing moved to level3's `witchspace_interlude` above) and omits `midBoss` entirely (v1.10, ROC-L4-4).

### Difficulty scaling `[ROC-DIF-1,2, ROC-ENM-13,14]`
A single `difficulty` value scales **enemy count per wave** (primary live lever) and applies hull/shield/fire-rate multipliers; Elite mode raises the floor. Density profiles per level give L1–2 sparse, L3–4 bullet-hell.

---

## 11. Economy, progression & persistence

- **Two counters:** `econ.wallet` (spendable, decremented by purchases) and `econ.score` (lifetime gross credits, monotonic). `[ROC-ECO-2]`
- **Bounty** on kill → both counters + floating text; **wave bonus** = 50% of wave bountySum on full clear → both + screen flash. `[ROC-ECO-1,1a,1b]`
- **Cargo** inventory (type→tonnage), sold at dock; contraband flagged for the Viper interception. `[ROC-ECO-3,6; ROC-LVL-4]`
- **Rating** is the separate kill-weighted tally → rank ladder. `[ROC-RTG-1..3]`
- **Persistence (Storage):** one save object — `{ highScores[], bestRating, unlocks, settings, controls }` — under a single localStorage key; the **title screen discloses this**. `[ROC-LBD-1,1a; ROC-TTL-4]` Online submit + consent only where enabled. `[ROC-LBD-2,3]`

```json
// storage schema
{ "version":1,
  "highScores":[{"name":"Jameson","score":48200,"rank":"Deadly","mode":"normal"}],
  "bestRating":"Deadly",
  "unlocks":{"eliteMode":true,"thargoidShip":false},
  "settings":{"audio":true,"reducedFlash":false},
  "controls":{ /* remap */ } }
```

---

## 12. State machines

### Level FSM (`levelstate.js`) `[ROC-LVL-1,2, ROC-BOSS, ROC-DCKG, ROC-HYP, ROC-WITCH]`
`LAUNCH (Coriolis departure) → HYPERSPACE → [WITCHSPACE_COMBAT, L2→3 only (v1.10): starfield held stretched, Thargoid wave must clear before the jump resolves] → INFO → [ASTEROIDS] → WAVES_A → MID_BOSS (skipped for Level 4, v1.10 ROC-L4-4) → WAVES_B → END_BOSS → [VIPER_INTERCEPT if contraband] → DOCKING → DOCK → STATION`. Death respawns in place per §3.16/ROC-LIFE-2 (v1.8) — the level state is never touched by a death, so nothing here resets. `MID_BOSS`/`END_BOSS` set `world.scroll = 0` and run the boss-bar/kill-text framing; `WITCHSPACE_COMBAT` holds `world.scroll` at its hyperspace-stretched value instead of resuming it, until the Thargoid wave resolves; `DOCKING` is a backdrop-only approach (no collision, opens the shop automatically); `DOCK` remains the shop.

### Game FSM (`gamestate.js`) `[ROC-PROG-1,2]`
`TITLE → (fly-in) → LEVEL[1..4] → COMPLETE → (unlock Elite) → ELITE LEVEL[1..4] → (unlock Thargoid) → TITLE`. Death (v1.8): if an energy bomb is carried it auto-triggers instead (ROC-DEF-2) — no life lost, ship survives at 1 hull; otherwise `lives--` immediately, then once the player's in-place, momentum-free explosion has fully played out (`PLAYER_EXPLOSION_SEC`) plus a 500ms beat (`respawnDelaySec`), the ship **respawns at the exact death position** — always, regardless of `levelState` (boss fights, part 2, anywhere); `lives==0` ⇒ GAME_OVER → score submit, deferred the same way. Runs start with **4 lives** (v1.9, up from 3). The ship no longer has graduated hull damage — once unshielded, any hit is instantly lethal (v1.9) — and blinks on screen only during this respawn's invulnerability window, never for an ordinary hit's brief contact i-frames. `[ROC-LIFE-1,2,2a,2b,2c,5; ROC-DEF-2; ROC-DMG-2a,6b]`

### 12a. Boss encounters, docking & hyperspace `[requirements §3.23–3.27]`

- **Scroll is sim state.** `world.scroll` (number, default 1) is the single scroll factor: 0 while a boss is alive (and until the kill text fades), ramping up then back down through `HYPERSPACE`. The renderer's starfield multiplies its drift by it and stretches dots into lines as it grows (full-screen-height lines at peak) — so tests assert scroll-stop on state, never pixels. `[ROC-BOSS-1, ROC-HYP-3,4]`
- **Boss framing** is shell-rendered from state + events: the health bar reads `boss.hull/hullMax` (horizontal, black-and-white, top of screen); on `bossKilled` the shell plays the explosion, then fades in/out "RIGHT ON COMMANDER" in white; the FSM holds in the boss state until the fade timer elapses, then resumes scroll and advances. `[ROC-BOSS-2,3,4]`
- **Boss ECM** (`systems/ecm.ts`): world-level `{fuseTtl, cooldownTtl}` armed whenever an ECM-flagged boss is alive and a player missile launches; after the 300 ms fuse, remove every player missile (no damage application), emit `{type:'ecm'}` (screen flash + "ECM" caption at the bottom), enter the 500 ms cooldown. Dies with the boss. `[ROC-BECM-1..4]`
- **Per-entity `scale`** multiplies `SHIP_SCALE` in the renderer's model matrix *and* in collision (silhouette scaling, `hullRadius`, ram tests) so hitbox always matches sprite. Content sets it: FdL 1.5 (ships.json + enemies.json), boss FdL 2.0, hermit and the docking Coriolis 2× the Coriolis' current drawn size. `[ROC-FDL-1, ROC-HERM-2, ROC-DCKG-1]`
- **Hermit** (`ai.kind:'hermit'`): fixed at top-centre, slow y-spin with the docking port on the rotation axis facing the play plane; the port is a rectangle rendered over the hull — a "direct port hit" is judged by the **shot's path** (impact point traced forward along its velocity crossing the port rectangle), since collision stops a projectile at the hull's rim while the port sits on the face at the centre; such hits apply 3× damage. An adder launcher (5 s cadence, ≤3 alive, launch-from-rock spawns inherit the rock's current yaw and unwind in flight, else edge entry) runs until death; on death survivors switch to flee paths, and one whole-fight wave record backs the 50% bonus. `[ROC-HERM-*]`
- **Strafe boss** (`ai.kind:'strafe'`): position parameterised along a rounded-rectangle track (arc-length t, signed direction); direction flips when an rng timer in [200, 2000] ms expires; aimed shot every 400 ms. `[ROC-FDL-3,4]`
- **Docking** (`DOCKING`): weapons/missiles disabled; the 2× Coriolis scrolls down into the top of the field, rolling slowly about its own docking-port axis — purely a backdrop, v1.8: **no collision**. Once it holds in view for `DOCK_SETTLE_SEC`, the FSM enters `DOCK` (the shop) automatically. `[ROC-DCKG-1..3]`
- **Launch & hyperspace**: `LAUNCH` renders the departure Coriolis (pointing up-screen) scrolling away below the player; `HYPERSPACE` emits per-second countdown events (`Hyperspace <system> 5…1`, system name from level content), drives the `world.scroll` ramp, and hands over to `INFO` — a fading card of Elite-flavour facts for the level's system (extends blurbs content) — before the level proper. Plays on every launch, including the first. `[ROC-HYP-1..5]`

---

## 13. Screens

- **Title** (`screens/title.js`): rotating wireframe **Sidewinder**, title/credits top, privacy disclaimer bottom; on start, the Sidewinder flies into play position and control transfers (one continuous transition driven by the same renderer). `[ROC-TTL-1..5]`
- **Station** (`screens/station.js`): wireframe dock + docked ship (geometry varies by level), system blurb, **Sell Cargo / Upgrade Ship / fit lasers per direction / buy ECM·bomb·bank·life·missile-level / Launch (with confirm)**, current balance shown. `[ROC-STN-1..7, ROC-LORE-1,6]`
- **HUD** (v1.9): a persistent bottom status bar — shield/missile+countdown/bomb/bank, plus score/credits/lives (no hull readout) — alongside the diegetic shield rings/damage visuals. `[ROC-HUD-2,3]`

Screens are pure render + emit intents back as `InputFrame` flags (e.g. `confirm`), so the **station is testable headlessly too** (assert that "Upgrade Ship" intent with sufficient wallet changes `shipClass` and carries lasers forward). `[ROC-STN-3, ROC-SHIP-5]`

---

## 14. Audio

`AudioOut.play(id)` is called by the shell from drained sim events; disabled = silent no-op. The id set is the table in `[ROC-SFX-2]`. Null backend in tests records calls so we can assert "destroying a ship emits `explode_small` + `cash`". `[ROC-SFX-1]`

---

## 15. Testing architecture

**Stack:** **Vitest** (runner; pairs with Vite, runs the TS sim in Node) + **fast-check** (property testing — the TS/JS equivalent of Hypothesis). The sim runs natively under Node, so **all tests and the balance-sim exercise the real game code**, not a reimplementation.

> **Refinement of the requirements:** ROC-TEST-7 / §5-item-4 / AS-1b mentioned a Python/Hypothesis tuning model. Since the sim is JS and headless, it's both simpler and more faithful to run property tests and the balance-sim **in JS against the real sim** (fast-check + Vitest). **Python is therefore reserved for the offline ship-data parser only** (§16). Flagging this as a deliberate change.

- **Harness** (`test/harness.js`): `makeSim(seed, contentOverrides)` with null Renderer/AudioOut and a recording event sink; `runFrames(n, inputFn)`; `replay(seed, inputLog)`. `[ROC-TEST-5]`
- **Unit:** shield→hull depletion and flash flags; missile grade-timer decay; bounty + wave-bonus arithmetic; wallet vs score; lives bounds 0–5; laser-fit rules. `[ROC-TEST-6]`
- **Property (fast-check):**
  - wave bonus = exactly `0.5 * Σ member bounty`, awarded **once**, and **only** when members killed == count (escape ⇒ no bonus);
  - shields always deplete before hull;
  - rating tally monotonic non-decreasing;
  - every spawned enemy eventually dies or exits (no off-field stall) within a frame bound;
  - `0 ≤ lives ≤ 5`; wallet never negative after a permitted purchase. `[ROC-TEST-6]`
- **Scenario:** script a level headless; assert mid-boss reached, end-boss reached, dock entered; carrying contraband triggers the Viper fight with zero credit reward but counted kills. `[ROC-LVL-4]`
- **Balance-sim** (`test/balance/autoplayer.js`): a heuristic bot (dodge nearest projectile, target nearest enemy, hold fire, scoop pickups) runs each level across K seeds at difficulty D and reports **bounty income, deaths, time-to-clear, shots-faced**. This feeds the price/difficulty tuning **before** human playtests and regression-guards it after. `[ROC-TEST-7, ROC-SHIP-1a]`

All of the above run headless in CI with no display. `[ROC-TEST-8]`

---

## 16. Content pipeline (Python tooling)

`tools/bbcelite_to_mesh.py`: parse bbcelite `VERTEX/EDGE/FACE` blueprints (or Ian Bell archive data) → normalise the ±255 coordinate box → emit `src/content/meshes/<ship>.json` as `{vertices, edges, faces:{loop,normal}}`. Runs offline; output is committed data the sim loads. First batch: Sidewinder, Cobra Mk III, Asp, Fer-de-Lance, Krait, Mamba, Gecko, Adder, Viper, Coriolis, Thargoid. `[refs §1-data]`

---

## 17. Performance plan `[ROC-NFR-1,4]`

- **Pools** for projectiles, missiles and particles (no per-frame GC churn).
- **Pre-rendered particle dot** drawn via `drawImage` rather than per-particle `arc()`.
- Painter sort only over *visible, culled* faces; meshes are low-poly (tens of faces).
- Cap `devicePixelRatio` at ~2; canvas always fills the window — the 4:3 game box (§7) is a render/input-layer concept on top, not a canvas-element resize, so it needs no extra resize handling of its own.
- Particle/entity budget caps on mobile, scaling the energy-bomb/Thargon storms gracefully.

---

## 18. Requirement → design traceability (summary)

| Requirement area | Where realised |
|---|---|
| Movement/banking/flames `[ROC-MOV]` | `systems/movement.js`, render model matrix |
| Ships/hardpoints `[ROC-SHIP]` | `player` state, `content/ships.json`, station |
| Shields/damage/flash `[ROC-DMG]` | `systems/collision.js`, `systems/damage.js` |
| Lasers/missiles/ECM/bomb `[ROC-LAS,MIS,DEF]` | `systems/weapons.js`, `missiles.js` |
| Pickups/economy `[ROC-PWR,ECO]` | `systems/pickups.js`, `economy.js` |
| Waves/enemies/AI `[ROC-ENM]` | `systems/waves.js`, `paths.js`, `ai.js`, `content/waves` |
| Levels/bosses/witchspace `[ROC-LVL,L1-4]` | `systems/levelstate.js`, `content/levels` |
| Visuals `[ROC-VIS]` | `render/` |
| HUD/controls `[ROC-HUD,CTL]` | `platform/main.js` (bottom status bar, inline), `input/` |
| Rating/persistence/progression `[ROC-RTG,LBD,PROG]` | `economy.js`, `gamestate.js`, `platform/storage.js` |
| Station `[ROC-STN]` | `screens/station.js` |
| Lives/difficulty `[ROC-LIFE,DIF]` | `gamestate.js`, difficulty scalers |
| Lore/flavour `[ROC-LORE]` | `content/blurbs.json`, level data, render |
| Audio `[ROC-SFX]` | `audio/`, event sink |
| Title `[ROC-TTL]` | `screens/title.js` |
| Testability `[ROC-TEST]` | `sim/` purity, `test/` |

---

## 19. Design decisions (all resolved)

1. **Language: TypeScript.** ✔ TS over JS+JSDoc, for stricter guarantees on the sim/render/audio/input seam. Vite compiles it transparently.
2. **Test stack: TypeScript, not Python.** ✔ Vitest + fast-check against the real sim; Python kept only for the ship parser. Supersedes the requirements' Python/Hypothesis tuning note.
3. **Build tooling: Vite.** ✔ Fast dev server + production bundle; Vitest pairs with it.
4. **Collision fidelity: convex silhouette polygon** for hulls. ✔ Faithful to the visible shape, cheap at these counts; revisit only if profiling complains.
5. **Sim tick rate: 1/120 s** decoupled from render. ✔ Smooth fast projectiles, clean determinism; can drop to 1/60 if mobile needs it.
6. **Camera: mild perspective at ~25° tilt.** ✔ Nicer occlusion than pure orthographic; toggle retained.

---

## 20. Next

`tasks.md` — a build order from "starfield + title + player ship that banks" through "Level 1 playable with the headless harness and first property tests green", then content/levels 2–4, station, progression, audio. The ship-data parser (§16) is the first concrete tool, since it unblocks everything visual.
