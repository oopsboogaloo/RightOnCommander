# Defects log

Running list of observed defects to triage/fix later. Newest first.

## Resolved

### D4 — Enemies are too large and overlap — FIXED 2026-06-28
- **Area:** rendering scale (enemies/bosses) — `platform/main.ts` draw + model matrix.
- **Observed:** enemy ships rendered too big and overlapped each other.
- **Fix:** introduced a per-draw model scale. `modelMatrix(pos, yaw, bank, scale)` now folds a
  `scaling(s)` into the model transform (`src/render/project.ts`, `src/sim/math/mat4.ts`), and
  the shell draws every hull at `SHIP_SCALE = 1/3` (`src/platform/main.ts`). Shrinking the hulls
  (which are ~1 world-unit wide) without touching the play-field bounds removes the overlap.

### D3 — Banking rolls the wrong way — FIXED 2026-06-28
- **Area:** `sim/systems/movement.ts` bank sign.
- **Observed:** moving right rolled the ship anticlockwise (inverted).
- **Fix:** flipped the bank target sign to `-bankFactor * vx` so moving right rolls clockwise and
  left rolls anticlockwise (bank into the turn). `test/unit/movement.test.ts` updated to lock the
  on-screen direction (right ⇒ bank < 0, left ⇒ bank > 0).

### D2 — Player ship is too large on screen — FIXED 2026-06-28
- **Area:** rendering scale.
- **Observed:** the player Cobra Mk III drew too big.
- **Fix:** same `SHIP_SCALE = 1/3` model scale as D4, applied to the interpolated player draw in
  `src/platform/main.ts`.

### D1 — Player Cobra Mk III renders skewed / asymmetric — FIXED 2026-06-28
- **Area:** mesh face reconstruction — `tools/bbcelite_to_mesh.py` + `content/meshes/cobra_mk3.json`.
- **Observed:** lopsided nose — an edge ran from the right of the nose out to the gun tip,
  pulling the top/bottom nose faces into a skewed point.
- **Root cause (corrected):** the gun barrel is `EDGE 20,21` with face fields `0,11`. The parser
  treated any edge whose two face fields differ as a polygon boundary, so it folded the gun-tip
  vertices (20, 21) into the loops of faces 0 and 11. The gun is a decorative line spur, not a
  face corner. (The earlier "mesh is symmetric, skew was just banking" diagnosis was wrong.)
- **Fix:**
  - `_face_loop` now keeps only vertices that lie on ≥ 2 of a face's boundary edges; a genuine
    polygon corner is entered and left, so degree-1 spur tips (the gun) are excluded.
  - `build_mesh` emits a new `details` list: edges that are not face boundaries (gun barrel,
    cockpit and engine line work), each carrying its two controlling faces.
  - The renderer draws each detail edge only while one of its controlling faces is visible —
    Elite's hidden-line rule — so the nose gun shows but rear detailing hides when culled
    (`Mesh.details` in `interfaces.ts`, `faceVisible` in `render/project.ts`, draw loop in
    `render/renderer2d.ts`).
  - All meshes regenerated; `tools/test_meshes.py` still passes (counts unchanged).
- **Verified:** offline-rendered through the game's own projection — symmetric wedge with the gun
  as a dorsal mast spike.
