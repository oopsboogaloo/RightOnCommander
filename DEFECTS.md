# Defects log

Running list of observed defects to triage/fix later. Newest first.

## Open

### D4 — Enemies are too large and overlap
- **Area:** rendering scale (enemies/bosses) — `platform/main.ts` draw + mesh/world sizing.
- **Observed:** enemy ships render too big and **overlap each other**, which looks wrong.
- **Expected:** reduce enemies to **1/3** of current on-screen size.
- **Notes:** D2 wants the player at 1/2 and this wants enemies at 1/3 — different factors, so a
  single global viewport `scale` won't do it. Introduce a **per-entity / per-mesh render scale**
  (or scale meshes at load), and make sure wave/path spacing still reads well once ships shrink
  (overlap may partly be formation spacing, not just size).
- **Severity:** cosmetic.
- **Reported:** 2026-06-28.

### D3 — Banking rolls the wrong way
- **Area:** `sim/systems/movement.ts` bank sign and/or `render` roll (`mat4.rotationZ` / model matrix).
- **Observed:** moving **right** rolls the ship **anticlockwise** (and left rolls clockwise) —
  inverted.
- **Expected:** moving **right** rolls **clockwise**, moving **left** rolls **anticlockwise**
  (bank into the turn).
- **Notes:** flip the sign where bank is derived from lateral velocity (`bankFactor * vx`) or
  the roll direction in the renderer. The movement unit test asserts "bank sign matches lateral
  direction" — update it to encode the correct on-screen direction so it locks the fix.
- **Severity:** cosmetic.
- **Reported:** 2026-06-28.

### D2 — Player ship is too large on screen
- **Area:** rendering scale — `render/renderer2d.ts` (viewport `scale`) / camera distance.
- **Observed:** the player Cobra Mk III is drawn too big.
- **Expected:** render at **1/3 of current on-screen size** (updated from 1/2 — matches the
  enemy factor in D4, so everything shrinks by the same 1/3).
- **Notes:** since player and enemies now use the **same 1/3 factor**, a single global change
  works — reduce pixels-per-unit `scale` (currently `min(w,h) * 0.5`) to ~`min(w,h) * 0.5/3`,
  or equivalently increase camera distance. No per-entity scaling needed (supersedes the D4
  note). Re-check formation spacing/readability after shrinking.
- **Severity:** cosmetic.
- **Reported:** 2026-06-28.

### D1 — Player Cobra Mk III renders skewed / asymmetric
- **Area:** rendering (player ship) — `render/` + `content/meshes/cobra_mk3.json`
- **Observed:** the player Cobra Mk III draws with a **lopsided, stretched silhouette** —
  left/right are not mirror-symmetric and the lower hull edge sweeps unevenly (one side
  pulled out to a sharp point).
- **Expected:** a clean, **bilaterally symmetric** Cobra Mk III wedge (per reference image),
  including the small **dorsal mast/antenna at the nose**.
- **Notes / suspects to investigate:**
  - camera asymmetry or the 25° tilt interacting with the model transform;
  - residual `bank` applied at rest, or yaw not exactly 0;
  - mesh not centred on its origin, or a vertex/face-loop reconstruction error in the
    bbcelite parser for `cobra_mk3` specifically (compare to canonical vertex coords);
  - projection / aspect handling in `render/project.ts`.
- **Severity:** cosmetic (does not affect gameplay/sim).
- **Reported:** 2026-06-28, via screenshots (current vs. target).
