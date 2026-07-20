# Interactive Attack-Wave Designer — Spec (draft)

**Status:** agreed in discussion, not yet implemented. Depends on the fixed 4:3 viewport/box
(`viewport-spec.md`) landing first — placement uses that box as its coordinate surface. Not wired
into `requirements.md` / `design.md` / `tasks.md` yet — see "Doc updates needed" below.

**Target devices:** iPad and desktop only. No phone/portrait handling needed for this tool.

## Problem

Waves are authored today as hand-edited JSON (`src/content/level*.json`), against the schema in
`design.md` §10 (`WaveDef`: `id, pattern, enemy, count, spacingMs, delayMs, speed, params, fire`).
The only feedback loop is: guess a `delayMs`/param value → reload → play the level from the start
→ read elapsed time off the dev "wave-authoring clock" cheat (`main.ts`'s `cheatClockMs`) → go
edit the JSON → repeat. There's no way to see a wave's shape, or how it sits against sibling waves
in time and space, without actually flying through it in real time. That's the core blocker to
designing waves that feel good rather than guessing at numbers.

## Goal

A dev-only "design mode," reachable from the existing cheat-mode tools, that lets you:

1. Scrub a level phase's timeline forward/backward and watch it play, frame-accurately.
2. See every wave/obstacle in the current phase as a static path overlay ("ghost trail") without
   having to run or scrub anything.
3. Add a wave / giant asteroid by tapping a location in the box and picking pattern + ship +
   count + speed + spacing (asteroid *fields* — the randomized kind — via a small parameter form
   instead, since they have no single location).
4. Remove anything placed.
5. Export the current phase's edited content as JSON, ready to paste into the level file.
6. Drop back into ordinary cheat-mode play, live, from wherever you left the timeline, to feel
   the change under real control.

Full param-level design control (custom path shapes, per-param tuning beyond what's listed above)
is explicitly out of scope — new *patterns* are still authored in code (`src/sim/systems/paths.ts`).
This tool only composes instances of existing patterns/enemies into a level.

## Design

### 1. Entry / exit

A `DESIGN` button joins the existing cheat-mode button stack (`SKIP` / `PAUSE` / `REWIND` in
`main.ts`), visible once the corner-tap cheat is unlocked. Tapping it:

- Freezes ordinary play (same mechanism as the existing `paused` flag — sim stops stepping from
  live input).
- Switches the screen to the design UI: timeline scrubber, ghost trails, and the
  add/remove/export controls, all drawn over (or in place of) the normal HUD.

A `PLAY` button in the design UI does the reverse: resumes ordinary cheat-mode play, live, from
the sim state at the current scrub position — this is the "go back and try it" loop.

### 2. Scrubbing — deterministic replay, not the player rewind buffer

The existing `REWIND` cheat is deliberately approximate (0.5s snapshot granularity, fixed 30s
jumps) — it's a player panic button, not a precision tool, and reuse would make scrubbing lossy.

Design mode instead scrubs by **replay**: since the sim is a pure deterministic function of
(seed, content, input log) — no live player input needed while scrubbing, since design mode
doesn't drive the ship — seeking to any target frame means:

1. Reset to a snapshot of the current phase's very start (taken once, on entering design mode /
   whenever the working wave list changes).
2. Loop `sim.step()` synchronously (headless — no rendering, no real-time wait, neutral/empty
   input) up to the target frame.
3. Render that resulting state.

This is exact (not interpolated/approximated) and cheap — a phase is at most a couple of minutes
of sim time at a 1/120s fixed step, over a few dozen entities, which replays far faster than
real time. Forward-scrub, back-scrub, and jumping to an arbitrary point are all the same
operation: "replay to frame N." A drag-scrubber bar plus frame-step buttons (for fine adjustment)
covers the interaction; play/pause of the replay itself is just "auto-advance N once per render
frame."

### 3. Ghost trails — static preview, no simulation required

Pattern functions are pure `(t, params, rng) → {pos, tangent}` with no dependency on live sim
state (`src/sim/systems/paths.ts`). So every wave and giant asteroid currently in the working
phase can be drawn as a static path — sample `t = 0..1` at some fixed resolution (e.g. 40
points) directly from `PATTERNS[wave.pattern]`, no `sim.step()` involved — overlaid on the box
as thin lines, updating instantly whenever a wave is added, removed, or edited. This is
independent of the scrub position; it's the "whole phase as a spatial diagram" view, not a
snapshot of one instant.

Randomized asteroid fields (`asteroidWaves`/`midAsteroids`/`combatAsteroids`) have no single path
to trace — they're shown instead as a shaded vertical band spanning their `xSpread`, since that's
the actual shape of what they'll do.

### 4. Add a wave

Flow: tap a point in the box → pick pattern → pick ship (enemy id) → set count, speed, spacing.

- **Location**: the tapped `(x, z)` maps onto whichever param each pattern treats as its anchor —
  `x0`/`z0` for the edge-entry patterns (`vform`, `sine_column`, `side_stream`, `pincer`,
  `drop_hold`), `cx`/`cz` for the center-defined ones (`orbit`, `wander`).
- **Pattern**: picked from the existing library (`vform`, `loop`, `sine_column`, `side_stream`,
  `pincer`, `orbit`, `drop_hold`, `wander`) — a simple list, no new patterns authored here.
- **Ship**: picked from `enemies.json`'s ids.
- **Count**: number of members in the wave.
- **Speed**: scales the path rate (`WaveDef.speed`). **Default 1.0** (matches the existing
  content convention — see `design.md` §10's example and level1.json's usage).
- **Spacing**: time between successive members spawning (`WaveDef.spacingMs`). **Default 400ms**
  — the middle of the range already in use across `level1.json` (roughly 350–420ms for standard
  waves).
- **Timing**: `delayMs` is set implicitly from the current scrub position within the phase — you
  place a wave *at* the moment you're looking at, not by typing a millisecond offset.
- Newly-added waves get an auto-generated `id` (e.g. `<levelId>-<phase>-<n>`) so they're
  addressable in cheat-mode's existing per-member wave-id label overlay.

Anything not listed here (`durationMs`, `fire`, `params` beyond the anchor point, `clearField`)
is left at the `WaveDef` schema's own defaults — consistent with "full param control is out of
scope."

### 5. Add a giant asteroid

Same tap-to-place flow, no pattern picker (it's a fixed obstacle, not a path):
tap sets `x`; `delayMs` comes from the current scrub position; `phase` is whichever phase you're
editing.

### 6. Add an asteroid field

No location tap (there's no single point — it's a randomized spread). A small form instead:
`count`, `speed`, `xSpread`, `spacingMs`, with defaults mirroring the sensible middle of existing
content (`count: 8`, `speed: 0.3`, `xSpread: 0.9`, `spacingMs: 400`). `delayMs` again comes from
the current scrub position.

### 7. Remove

Tap an existing ghost trail (wave or giant asteroid) or the shaded band (asteroid field), or pick
from a simple list of "everything in this phase" — either deletes it from the working copy.

### 8. Export

A button dumps the current phase's edited arrays (`wavesA`/`wavesB`/`asteroidWaves`/etc., in the
exact `WaveDef`/`AsteroidFieldDef`/`GiantAsteroidDef` JSON shape already used in
`level1.json`/`level2.json`/`level3.json`) — e.g. to the clipboard or a visible text box — ready
to paste into the real level content file. This is how design-mode work actually ships; nothing
here writes to disk on its own.

## Sim-side changes needed

`createSim()`'s closure (`src/sim/index.ts`) currently keeps the loaded level list and
`currentLevel()` private — nothing outside can read or replace a level's wave/asteroid arrays, or
re-enter a phase from its start. Design mode needs a small dev-only addition to the `Sim`
interface, still entirely inside `sim/` (no DOM/Canvas — consistent with the project's purity
rule):

- Read the current level's editable arrays for the phase being designed.
- Replace them with a working copy (add/remove operations mutate this, not the original content).
- Re-enter the current phase from its start (already exists internally as `enterLevelState`, just
  needs to be reachable) — this is what "replay to frame N" resets against.

## Decisions made

| Question | Decision |
|---|---|
| What a tapped "start location" sets | Full `(x, z)` point, mapped per-pattern to its anchor param(s) |
| Export vs. preview-only | **Export to JSON**, matching the real content schema |
| Scope for v1 | `wavesA`/`wavesB` **and** `asteroidWaves`/`midAsteroids`/`combatAsteroids`/`giantAsteroids` |
| Entry/exit UX | New `DESIGN` button beside `SKIP`/`PAUSE`/`REWIND`; `PLAY` returns to live cheat-mode play |
| Speed/spacing on add | Both settable per wave, with defaults **speed 1.0**, **spacing 400ms** |

## Doc updates needed once implemented

- New `tasks.md` entry (this is squarely a dev-tooling task, not a `requirements.md` player-facing
  item — no new `ROC-*` player requirement, but worth a design.md subsection under §10 documenting
  the design-mode `Sim` API surface and the replay-based scrub mechanism).

## Not yet decided (deferred to implementation)

- Exact widget style for pattern/ship pickers on iPad (list vs. wheel vs. grid).
- Whether/how to **edit** an already-placed wave in place (vs. remove + re-add) — not asked for,
  but likely to want soon.
- Visual treatment of ghost trails vs. the live scrub position (e.g. dimming trails behind/ahead
  of "now," or highlighting the trail of whichever wave is selected).
- Auto-generated wave `id` scheme's exact format.
