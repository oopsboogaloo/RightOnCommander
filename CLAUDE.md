# RightOnCommander

A vertically scrolling space shooter for web and mobile, themed on the classic 8-bit game Elite.

## Project Overview

- **Genre:** Vertical scrolling shooter (shmup)
- **Platform:** Web (HTML5 Canvas 2D) + Mobile (touch controls)
- **Theme:** Elite 8-bit universe — Cobra ships, pirates, space stations, hyperspace jumps
- **Tech:** **TypeScript** (ES modules) bundled by **Vite**; HTML5 Canvas 2D for a software-3D
  vector renderer. Tests with **Vitest + fast-check**. **Python** is used for offline tooling only
  (the bbcelite ship-data → mesh parser).

> Authoritative specs live in `requirements.md` (v1.7), `design.md` (v0.6) and `tasks.md`.
> If anything here disagrees with those, the design/tasks docs win — update this file to match.

## Architecture (one-line version)

A **pure, deterministic simulation core** (`src/sim/`) that imports nothing from the DOM, Canvas,
Web Audio, or `Math.random`. Everything else (render, audio, input, storage, time) sits behind
swappable interfaces. The browser shell wires real backends in; tests wire null/recording backends.
Same seed + same input log ⇒ identical state. See `design.md` §1–4.

## Structure

See `design.md` §2 for the full tree. In brief (all `src/` files are `.ts`):

```
src/
  interfaces.ts     — Renderer, AudioOut, InputFrame, Storage, Clock
  sim/              — PURE core. No DOM/Canvas/Audio/Math.random.
    index.ts        — createSim({seed, content, config}) -> Sim
    world.ts        — World state container
    rng.ts          — seedable PRNG (mulberry32) with state in/out
    components.ts    — entity/component types
    snapshot.ts     — serialise / restore full World (incl. rng, frame)
    math/           — vec3 / matrix math
    systems/        — intent, movement, paths, weapons, missiles, collision,
                      damage, particles, pickups, economy, waves, ai,
                      levelstate, gamestate
    content/        — loadContent.ts (parse + schema-validate JSON)
  content/          — DATA: ships/lasers/enemies/economy/ratings/blurbs/levels/waves/meshes (.json)
  render/           — Canvas 2D backend (renderer2d, project, camera, screens/)
  audio/            — webaudio.ts, nullaudio.ts
  input/            — domInput.ts, remap.ts
  platform/         — storage.ts, loop.ts, main.ts (browser entry)
test/
  harness.ts        — headless: createSim + null backends; runFrames(); replay()
  unit/ property/ scenario/ balance/
tools/
  bbcelite_to_mesh.py  — offline ship-data parser (Python)
index.html          — Vite entry
```

**Dependency rule:** `sim/` may be imported by anyone; `sim/` imports nothing outside itself.
Enforced by the ESLint boundary rule (no DOM/Canvas/audio globals or shell imports in `sim/`,
no `Math.random`).

## npm scripts

- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production bundle
- `npm test` — Vitest (headless, runs the real sim)
- `npm run lint` — ESLint (incl. the `sim/` boundary rule)
- `npm run balance` — balance-sim suite (added in Phase 9)

## Git Branching

Default branch is `master`. Develop on feature branches and merge into `master`.

## Instructions

- Prefer the project's npm scripts for all build/test/run tasks (cross-platform).
  When working locally on Windows, PowerShell is fine; the scripts themselves are OS-agnostic.
- Target 60fps on desktop, 30fps acceptable on mobile.
- Keep mobile-first in mind: all controls must work via touch.
- Determinism is a hard rule: no `Math.random` in `sim/`; all randomness flows through `world.rng`.
- Elite flavor: ship names, faction names, systems should echo the Elite universe
  (Lave, Riedquat, Cobra Mk III, Viper, etc.).
