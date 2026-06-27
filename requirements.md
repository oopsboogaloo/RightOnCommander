# Right on Commander — Requirements Specification

**Version:** 1.4 (draft — all design decisions resolved)
**Author:** Chloe
**Notation:** EARS (Easy Approach to Requirements Syntax)
**Status:** Spec under construction — review

> **Changelog 1.3 → 1.4:** Project renamed **EliteShooter → Right on Commander** (the game's title is Elite's victory cry on reaching the Elite rating, ROC-RTG-3). Requirement-ID prefix changed `ES-` → `ROC-` throughout. Matching domain available.

> **Changelog 1.2 → 1.3:** Aligned tooling with design.md — property tests and balance-sim run in **TypeScript (Vitest + fast-check)**; **Python reserved for the ship-data parser** only (AS-1b, decisions-log item 4). Stack confirmed TypeScript + Canvas 2D + Vite.

> **Changelog 1.1 → 1.2:** Added **§4.1 Testability** — pure deterministic, seedable, headless simulation core decoupled from render/audio/input; abstract scriptable input; serialisable state; headless harness; unit + property-based + scenario tests; and a **balance-simulation auto-player** for tuning (ROC-TEST-1…8). Added **§3.18 Audio** (optional SFX + indicative file list). Added **§3.19 Title/intro screen** — rotating Sidewinder à la Elite, fly-into-play on start, title/credits top, **local-storage privacy disclaimer** bottom (ROC-TTL-1…5).

> **Changelog 1.0 → 1.1:** Added **§3.17 Lore & flavour** (procedural blurbs, named systems + Riedquat, Jameson, The Dark Wheel, Raxxla, varied docks, Blue Danube cue). Level 4 entered via **witchspace misjump**. L2 boss corrected to the **Constrictor**.

> **Changelog 0.9 → 1.0:** Closed all open decisions — no-HUD diegetic status (ROC-HUD-3); **Gems shatter** when shot (ROC-PWR-3); **missile levels upgradable at dock, still timed** (ROC-ECO-9, ROC-STN-5b); **endgame progression** — Elite mode then playable Thargoid, plus a **high score table** (ROC-PROG-1/2/3, ROC-LBD-1a, ROC-SHIP-6).

> **Changelog 0.8 → 0.9:** Clarified the **wave bounty** — paid only when **all ships are destroyed** (escapes forfeit it), and it **flashes prominently on screen** when awarded (ROC-ECO-1a/1b).

> **Changelog 0.7 → 0.8:** Added **wave-clear bounty** = 50% of the wave's total ship bounties (ROC-ECO-1a). Starfield refined to a **slow-scrolling background parallax** layer (ROC-VIS-7). **Level 4 gains Thargoid-saucer variants** (size / shield / Thargon behaviour / attack pattern) for variety (ROC-L4-1a).

> **Changelog 0.6 → 0.7:** Mid-boss always drops a laser (ROC-PWR-6); unified **white damage flash** (shield flashes if it absorbed); **slow dodgeable enemy projectiles** (ROC-ENM-11); **per-level difficulty escalation** + L3 homing missiles, L3–4 Xenon 2 bullet-hell (ROC-ENM-12/13); **enemy count** as live-tuning lever (ROC-ENM-14); **Lives, death & difficulty** (§3.16); **contraband → Viper interception** (ROC-LVL-4).

> **Changelog 0.5 → 0.6:** Added the **Station / dock screen** (§3.15). **Ships purchased** again (§3.2), priced so a player keeping pace upgrades ~once per level. Added a **data-driven, composable wave system** (§3.13).

> **Changelog 0.4 → 0.5:** Locked the stack — **JS/TS runtime on Canvas 2D** (software 3D, painter's algorithm), behind a thin renderer interface; WebGL only as a profiled future fallback. Python reserved for offline tooling/tests. Renderer is no longer an open decision.

> **Changelog 0.3 → 0.4:** Ship is now **fixed per level** (Sidewinder/Cobra/Asp/Fer-de-Lance for L1–4) with a stat table (shield 1–4, hull 2–4, hardpoints 1–4); no purchase/unlock. Lasers use **four firing directions (front/rear/left/right), one per direction**. Added **purchase prices** (pulse 100, beam 1,000, military 10,000, ECM 2,000, energy bomb 5,000) and a **starting missile level**. Added **level pacing** (~3–5 min + ~1 min boss).

> **Changelog 0.2 → 0.3:** Lasers reworked from a single tiered weapon into a **mount-based model**. Added **Missiles** power-up, **Pickups** (Fuel/Gems/Alloys), bounty+cargo **Economy** (score = total credits earned), and the **four-level structure** with bosses. Resolved the Coriolis bookend question.

---

## 1. Vision

Right on Commander is a browser-based **vertical scrolling shoot 'em up** and unofficial fan homage to Acornsoft's *Elite* (Braben & Bell, BBC Micro, 1984). It transplants Elite's **monochrome 3D wireframe aesthetic**, ship roster, equipment and the **Harmless → Elite rating ladder** into a classic arcade shmup. The title is the message Elite displays on reaching the **Elite** rating — "RIGHT ON, COMMANDER!" (ROC-RTG-3).

The player launches from a **Coriolis station**, flies up a scrolling field across **four themed levels** (asteroid field, deep space, star surface, alien space), kills pirates for **bounty**, collects cargo and power-ups, fights mid- and end-of-level bosses, docks at a Coriolis to sell cargo and re-equip, and climbs toward the **Elite** rating ("Right On, Commander!").

> **Note on IP:** Fan homage; hulls and names re-drawn/referenced for tribute, not copied. Licensing sanity-check advised before public release.

---

## 2. Architecture assumptions (flag for confirmation)

- **AS-1** Browser-native, no install. The runtime is **JavaScript/TypeScript** rendering to **HTML5 Canvas 2D**. Ships are real 3D models projected per frame in software (matrix transform → back-face cull via face-normal sign → **painter's-algorithm** depth sort → black polygon fill + white edge stroke). Canvas 2D is chosen for its native crisp anti-aliased lines, which match the white-on-black vector aesthetic, and for low build complexity.
- **AS-1a** *(implementation guidance)* The renderer should sit behind a small interface (`drawMesh`, `drawLine`, `drawParticles`, `drawText`) so the deterministic simulation (AS-2) never depends on the backend; a WebGL backend remains a possible future swap **only if** profiling on target mobile shows particle-heavy moments (energy-bomb clears, Thargon swarms) dropping frames. Not planned for v1.
- **AS-1b** *(tooling)* Property-based tests and the balance-simulation run in **TypeScript (Vitest + fast-check) against the real sim** (see design.md §15). **Python is reserved for the offline ship-data → mesh-JSON parser** only; it ships nothing to the browser.
- **AS-2** Fixed-timestep simulation (60 Hz) decoupled from `requestAnimationFrame` render.
- **AS-3** Core gameplay fully client-side and offline-capable.
- **AS-4** Optional **Firebase** for the leaderboard only, reusing the DSB consent/GDPR pattern.
- **AS-5** Portrait aspect ratio is the primary target.

---

## 3. Functional requirements

### 3.1 Player movement & feel

- **ROC-MOV-1** While *playing*, the system shall move the player ship freely on both axes (free 2D positioning, not lanes).
- **ROC-MOV-2** The system shall clamp the ship so **no part ever leaves the visible play field**.
- **ROC-MOV-3** When motion has a significant left/right component, the system shall **bank** the 3D model toward that direction, proportional to the lateral component.
- **ROC-MOV-4** While thrusting up-screen, the system shall render small **V-shaped engine-flame lines** at the rear; otherwise it shall not.
- **ROC-MOV-5** When lateral input ceases, the system shall return the ship to level attitude.

### 3.2 Player ships (purchased; ~one per level)

- **ROC-SHIP-1** The system shall start the player in a **Sidewinder** and offer the ladder **Sidewinder → Cobra Mk III → Asp Mk II → Fer-de-Lance**, each **bought at the station** (§3.15), not auto-granted.
- **ROC-SHIP-1a** The system shall **tune ship prices and bounty income so that a player who keeps pace can afford the next ship roughly once per level**; a player who under-earns continues in their current ship into harder levels (risk/reward). *(Exact prices are a tuning parameter — see §5.)*
- **ROC-SHIP-2** When the player flies a ship, the system shall render it as a faithful 3D wireframe and apply its stats:

  | Order | Ship | Movement | Shield (hp / ellipses) | Hull (hp) | Hardpoints |
  |------|------|----------|------------------------|-----------|------------|
  | 1 | Sidewinder | very quick, low mass | 1 | 2 | 1 |
  | 2 | Cobra Mk III | fast, mid mass | 2 | 3 | 2 |
  | 3 | Asp Mk II | mid speed, mid mass, larger than Cobra | 3 | 3 | 3 |
  | 4 | Fer-de-Lance | heavy, sluggish | 4 | 4 | 4 |

- **ROC-SHIP-3** The system shall treat **shield hp as the number of concentric shield ellipses** (§3.3) for the player ship.
- **ROC-SHIP-4** The system shall cap the player's equipped lasers at the ship's hardpoint count, with **at most one laser per firing direction** (front, rear, left, right) — see §3.4.
- **ROC-SHIP-5** When the player buys a new ship, the system shall **carry equipped weapons forward** and re-fit them up to the new hull's hardpoint count (since each step up the ladder adds a hardpoint, no laser is lost).
- **ROC-SHIP-6** Where the player has unlocked it (ROC-PROG-2), the system shall offer the **Thargoid ship as a playable bonus craft** beyond the four-ship ladder.

### 3.3 Shields, hull & damage model

Applies to enemies and (assumed) the player — see §5.

- **ROC-DMG-1** While shielded, the system shall use an **elliptical collision shape** around the hull.
- **ROC-DMG-2** While shielded, when hit, the system shall briefly **flash the shield ellipse** and shall **not** flash the hull (the shield absorbed it).
- **ROC-DMG-3** The system shall render shield strength as **concentric ellipses**, the **count indicating remaining strength**.
- **ROC-DMG-4** The system shall allow **different ship types to have different maximum shield strengths**.
- **ROC-DMG-5** When shields deplete, the system shall switch the collision shape to the **hull** outline.
- **ROC-DMG-6** While unshielded, when the hull is hit, the system shall **briefly flash the whole object white** and emit **lines-and-dots fragments** blown off the ship's own wireframe.
- **ROC-DMG-6a** The system shall apply the white-damage-flash rule to **any object that takes hull damage** (player, enemies, bosses, destructible hazards), reserving the shield flash (ROC-DMG-2) for hits a shield absorbs.
- **ROC-DMG-7** While the hull is significantly damaged, the system shall display persistent **white smoke and fire** particles on that ship.

### 3.4 Lasers (mount-based weapons)

- **ROC-LAS-1** The system shall let a ship carry **one or more lasers** up to its hardpoint count (§3.2); **bigger ships can carry more**.
- **ROC-LAS-2** The system shall support **four firing directions — front, rear, left, right — with at most one laser per direction**; the number of directions a ship can arm equals its hardpoint count (Sidewinder 1 … Fer-de-Lance 4, §3.2).
- **ROC-LAS-3** When the player fires, the system shall **fire all equipped lasers simultaneously**, each along its mount facing.
- **ROC-LAS-4** The system shall render a **Pulse Laser** as **short white line segments that travel across the screen**.
- **ROC-LAS-5** The system shall render a **Beam Laser** as a **near-instant beam across the screen that deals damage continuously while in contact** with a target.
- **ROC-LAS-6** The system shall render a **Military Laser** as a **faster, fatter, longer pulse that deals the most damage** of the three.
- **ROC-LAS-7** The system shall let lasers be obtained by **purchase at dock or by pickup** in flight.

### 3.5 Missiles (timed power-up)

- **ROC-MIS-1** When a Missiles power-up is collected, the system shall grant **continuously auto-firing homing missiles** that seek and destroy targets, for a **60-second timer**.
- **ROC-MIS-2** When Missiles are collected again, the system shall **restart the 60s timer and raise the grade** one step, up to **double → triple → quad** (max 4).
- **ROC-MIS-3** The system shall fire a number of homing missiles per volley equal to the current grade.
- **ROC-MIS-4** When the timer expires, the system shall **drop the grade by one** (restarting the timer if a grade remains) and remove missiles entirely at grade zero.
- **ROC-MIS-5** The system shall make in-flight missiles **destructible** (they can be shot down).

### 3.6 Pickups & power-ups

Power-ups drop from destroyed ships (and asteroids, §3.9) and are highly desirable. Uncollected functional pickups that aren't needed convert to **sellable cargo** at dock.

- **ROC-PWR-1** Where a **Fuel** pickup is collected, the system shall **restore shield power**; if the shield is already full, the system shall bank it as **sellable cargo**.
- **ROC-PWR-2** If a **Fuel** pickup is shot, then the system shall make it **explode with no splash damage**.
- **ROC-PWR-3** Where a **Gems** pickup is collected, the system shall **restore shield power**; if full, bank it as **sellable cargo**. If a Gems pickup is shot, the system shall make it **shatter**.
- **ROC-PWR-4** Where an **Alloys** pickup is collected, the system shall **repair hull**; if shot, the system shall make it **shatter**.
- **ROC-PWR-5** The system shall make the weapon/utility pickups (lasers §3.4, missiles §3.5, ECM, Energy Bomb) **collectable in flight as well as purchasable**.
- **ROC-PWR-6** When a **mid-level boss** is destroyed, the system shall **always drop a laser power-up** (guaranteed), collectable by the player.

### 3.7 ECM & Energy Bomb

- **ROC-DEF-1** Where **ECM** is triggered, the system shall **destroy all missiles and bullets on screen** and then enter a **cooldown** before it can be used again.
- **ROC-DEF-2** Where the **Energy Bomb** is triggered, the system shall **destroy all non-boss enemies, missiles and bullets on screen** (consuming one charge). The system shall **never destroy a mid- or end-of-level boss** with an Energy Bomb; at most it may apply limited, non-lethal damage.
- **ROC-DEF-3** The system shall expose ECM and Energy Bomb via the partly-transparent touch buttons (§3.12) and bindable controls.

### 3.8 Economy: bounty, cargo & score

- **ROC-ECO-1** When a ship is destroyed, the system shall award its **bounty as credits immediately** and show floating **bounty text beneath the explosion**.
- **ROC-ECO-1a** When the player **destroys every ship in a wave** (the bonus is **not** paid if any ship escapes off-screen — the wave must be cleared by kills), the system shall award a **wave bounty equal to 50% of the summed bounties of that wave's ships**, in addition to the individual bounties.
- **ROC-ECO-1b** When a wave bounty is awarded, the system shall **flash it prominently on screen** (a brief full-screen-readable wave-bonus announcement, distinct from the small per-kill floating text).
- **ROC-ECO-2** The system shall define **score as the running total of all credits earned** (lifetime/gross), distinct from the spendable **credit balance** (wallet, reduced by purchases).
- **ROC-ECO-3** When the player collects cargo, the system shall show floating text naming the commodity and tonnage (e.g. **"Computers 3T"**).
- **ROC-ECO-4** The system shall render **illegal/contraband cargo with a visibly different shape** so the player can choose to avoid it.
- **ROC-ECO-5** If a cargo canister is shot, then the system shall **destroy it**.
- **ROC-ECO-6** While docked, the system shall let the player **sell collected cargo** (and any banked surplus pickups) for credits.
- **ROC-ECO-7** While docked, the system shall let the player spend credits on weapons and equipment at the following prices:

  | Item | Cost (cr) |
  |------|-----------|
  | Pulse laser | 100 |
  | Beam laser | 1,000 |
  | Military laser | 10,000 |
  | ECM | 2,000 |
  | Energy bomb | 5,000 |
  | Escape pod | tuned (see §5) |
  | Extra life (max 5 held) | tuned (see §5) |
  | Next ship (Cobra / Asp / Fer-de-Lance) | tuned per ROC-SHIP-1a |

  All purchases are made on the station screen (§3.15).

- **ROC-ECO-9** The system shall give the player a **starting missile level**, and shall let the player **upgrade the missile level at the station** for credits. Dock-purchased missile levels **still run on the §3.5 timer** (they raise the grade and (re)start the countdown, decaying a grade on expiry as normal).
- **ROC-ECO-8** If the player lacks credits for an item, then the system shall disable its purchase and indicate the shortfall.

### 3.9 Level structure & bosses

- **ROC-LVL-1** The system shall **begin every level launching from a Coriolis station** and **end every level docking at a Coriolis station** (then the dock/sell/equip screen). The Coriolis is the non-combat bookend, not a boss.
- **ROC-LVL-2** The system shall stage, within each level, scrolling wave combat (§3.13) plus a **mid-level boss** and an **end-of-level boss** as below.
- **ROC-LVL-3** The system shall pace each level so its **combat/wave phase lasts roughly 3–5 minutes**, plus **about 1 minute for the end-of-level boss**.
- **ROC-LVL-4** If the player is carrying **illegal/contraband cargo** at the end of a level, then before docking the system shall stage an **extra interception fight against a number of Vipers**; this fight yields **no credit reward (kills still count toward rating)** and scales the Viper count with the amount of contraband / difficulty.

**Level 1 — Asteroid field**
- **ROC-L1-1** The system shall fill the level with **drifting asteroids that fragment into boulders** when shot.
- **ROC-L1-2** The system shall spawn **occasional lone Sidewinder / Krait / Gecko / Adder** pirates.
- **ROC-L1-3** The system shall make asteroids **sometimes yield Alloys, Metals, Gems or Crystals**.
- **ROC-L1-4** The system shall provide a **mid-level boss: a well-defended hermit asteroid**.
- **ROC-L1-5** The system shall provide an **end boss: a Fer-de-Lance**.

**Level 2 — Deep space**
- **ROC-L2-1** The system shall spawn **more dangerous pirates** in **more elaborate multi-ship attack waves**.
- **ROC-L2-2** The system shall require the player to **shoot through dense bands of asteroids**.
- **ROC-L2-3** The system shall provide a **mid boss: a Python**.
- **ROC-L2-4** The system shall provide an **end boss: the Constrictor** — the prototype warship with abnormally strong shields that GalCop wants stopped (the canonical disk-Elite mission target); its boss fight shall reflect its **unusually high shield strength**.

**Level 3 — Star surface**
- **ROC-L3-1** The system shall render a **large white star occupying the right-hand side with massive curvature**.
- **ROC-L3-2** The system shall present **dangerous ships** plus the **star as an environmental hazard, with occasional white star activity** (flares/eruptions).
- **ROC-L3-3** The system shall provide a **mid boss: a rogue station with Vipers**.
- **ROC-L3-4** The system shall provide an **end boss: a generation ship**.

**Level 4 — Alien space**
- **ROC-L4-0** The system shall frame the **entry to Level 4 as a forced misjump into witchspace** — the player's hyperspace jump is dragged short by the Thargoids (per Elite lore) rather than a normal Coriolis launch, dropping them straight into the alien ambush.
- **ROC-L4-1** The system shall populate the level with **Thargoids and asteroids**.
- **ROC-L4-1a** The system shall include **several variants of the Thargoid saucer** — differing in size, shield strength, Thargon-launch behaviour and/or attack pattern — to keep Level 4 varied.
- **ROC-L4-2** The system shall provide an **end boss: the (Thargoid) mothership**.

### 3.10 Visual style

- **ROC-VIS-1** The system shall render **white lines on black only — no colour** in core play.
- **ROC-VIS-2** The system shall draw **all objects as true 3D models** (faithful hull shapes).
- **ROC-VIS-3** The system shall place the camera **top-down, tilted slightly back from directly overhead**.
- **ROC-VIS-4** The system shall **not draw the far side** of an object's wireframe (back-face culling), as in Elite.
- **ROC-VIS-5** Unlike Elite, the system shall **fill objects with black** so a nearer object **partially occludes** the one behind (painter's-algorithm ordering).
- **ROC-VIS-6** The system shall render **explosions** as the object's **own edges flying apart** plus **a significant number of white circular particles**.
- **ROC-VIS-7** The system shall render a **background starfield of white dots that scrolls slowly** as the field advances, sitting behind all gameplay objects to convey gentle forward motion (parallax: stars move slower than foreground action).
- **ROC-VIS-8** The system shall render floating **bounty / cargo text** as transient white world-space labels (distinct from the HUD, §3.11).

### 3.11 Screen & HUD

- **ROC-HUD-1** The system shall run in **portrait aspect ratio**.
- **ROC-HUD-2** The system shall display **no persistent HUD except score, credits and lives**, as simple white text.
- **ROC-HUD-3** The system shall keep the screen otherwise clear and convey player shield/hull state **entirely diegetically** — via the player ship's own shield ellipses and hull-damage particles (§3.3) — with no gauges or bars.

### 3.12 Controls

- **ROC-CTL-1** Where a mouse is used, the system shall move the ship to follow the pointer and **autofire while the button is held**; a single click fires one shot (tap-fire fallback).
- **ROC-CTL-2** Where touch is used, the system shall move the ship by drag and **fire on tap**.
- **ROC-CTL-3** On touch, the system shall present **partly-transparent white buttons for ECM and Energy Bomb**.
- **ROC-CTL-4** The system shall support full **keyboard** control.
- **ROC-CTL-5** The system shall support **game-controller** input.
- **ROC-CTL-6** The system shall allow input remapping and persist it locally.

### 3.13 Enemies & wave design

- **ROC-ENM-1** The system shall spawn enemies as **waves that fly on, follow a path, and fly off**, firing while on screen.
- **ROC-ENM-2** The system shall implement **formations and curved/spline paths**, scaling count/aggression with level.
- **ROC-ENM-3** The system shall **orient enemies along their path tangent** and **bank them into turns** like the player.
- **ROC-ENM-4** The system shall give enemy types distinct movement, fire behaviour and **max shield strength** (§3.3).
- **ROC-ENM-5** When an enemy is killed, the system shall award bounty (§3.8) and may drop cargo or a power-up.
- **ROC-ENM-6** The system shall introduce **Thargoids** (Level 4) as rare, high-value, heavily-shielded enemies launching pursuing **Thargon** swarms that go inert when the parent dies.
- **ROC-ENM-7** The system shall define attack waves as **data (e.g. JSON), fully tuneable** without code changes — controlling spawn timing/cadence, entity counts, speeds, spacing, path control points, and fire rate.
- **ROC-ENM-8** The system shall keep **wave pattern decoupled from enemy type**, so any pattern can be **paired with any enemy** (and any enemy stat profile) to maximise variety from a small set of parts.
- **ROC-ENM-9** The system shall ship a **library of reusable pattern archetypes** drawn from classic vertical scrollers (Xenon 2, Raiden, Flying Shark / Sky Shark, 1942), at minimum:
  - **Echelon / V-formation** entering together (1942-style), holding then peeling off.
  - **Loop-the-loop** sweep: enter from top, arc into a loop, exit (1942).
  - **Sine / serpentine column**: a stream snaking left-right down-screen (Xenon 2 / Raiden).
  - **Side-stream strafe**: enemies pour in from a screen edge in a line, crossing and firing (Flying Shark).
  - **Pincer**: simultaneous mirrored entries from left and right converging on the player.
  - **Circle / orbit**: a group enters and orbits a screen point before dispersing (Raiden).
  - **Drop-and-hold turret line**: a rank that descends to a y-band, holds, suppresses, then withdraws.
- **ROC-ENM-10** The system shall allow waves to be **sequenced and layered** per level (and scaled by level/difficulty) from these archetypes plus enemy pairings, and should keep the schema friendly to property-based testing of invariants (e.g. every spawned enemy eventually exits or dies; no off-field stalls).
- **ROC-ENM-11** The system shall fire most enemy weapons as **comparatively slow projectiles that take time to cross the screen**, so they **persist and must be dodged/manoeuvred around** (enabling bullet-hell play), distinct from the player's fast lasers.
- **ROC-ENM-12** The system shall **escalate enemy difficulty by level** — later enemies have **more hull, more shields, and fire more shots**; from **Level 3** onward some enemies also carry **homing missiles that must be shot down** (destructible, per ROC-MIS-5).
- **ROC-ENM-13** The system shall tune **density by level**: **Levels 1–2 are sparser and more readable** (earlier-arcade pacing), while **Levels 3 and especially 4 approach a Xenon 2-style bullet-hell** density.
- **ROC-ENM-14** The system shall make **enemy count per wave the primary live-tuning lever** — a global difficulty value (§3.16) that **scales the number of enemies up or down** for playtest balancing without code changes.

> **Illustrative wave schema (non-normative):**
> ```json
> {
>   "pattern": "sine_column",
>   "enemy": "krait",
>   "count": 6,
>   "spacingMs": 350,
>   "speed": 1.0,
>   "params": { "amplitude": 120, "wavelengthPx": 480, "entryEdge": "top" },
>   "fire": { "rate": 0.6, "aimed": true }
> }
> ```
> Pattern + enemy + params compose; the same `sine_column` pairs with a Gecko or a Thargon by swapping one field.

### 3.14 Scoring, rating & persistence

- **ROC-RTG-1** The system shall maintain a **cumulative kill tally, weighted by ship type** (tougher ships — up to the Thargoid — count for more), held **separately from the credit score**.
- **ROC-RTG-2** The system shall drive the **Harmless → Mostly Harmless → … → Elite** rating ladder from the **kill tally**, each threshold materially higher than the last.
- **ROC-RTG-3** When a kill pushes the tally across a threshold, the system shall **award the rating increase and show a rank-up notice**; on reaching **Elite**, it shall display **"RIGHT ON, COMMANDER!"**.
- **ROC-LBD-1** The system shall persist high score, best rating, current ship class, **unlocks (Elite mode, Thargoid ship)** and settings locally.
- **ROC-LBD-1a** The system shall maintain and display a **high score table** (local at minimum; online where the leaderboard is enabled).
- **ROC-LBD-2** Where the online leaderboard is enabled, when a run ends, the system shall offer score submission with a commander name, **defaulting to "Jameson"** (the canonical starting commander).
- **ROC-LBD-3** Where Firebase is used, the system shall obtain explicit consent before storing any identifier and comply with the GDPR/cookie pattern; if declined, all data stays local.

---

### 3.15 Station / dock screen

Shown on docking (§3.9), between levels.

- **ROC-STN-1** The system shall present the player's ship **docked against a wireframe dock** (white-on-black, in style); the dock geometry may vary by level (Coriolis / Dodo / icosahedral, ROC-LORE-6) and the screen shall show the system's flavour blurb (ROC-LORE-1).
- **ROC-STN-2** The system shall provide a **Sell Cargo** action that converts all collected cargo (and banked surplus pickups) to credits and updates the wallet.
- **ROC-STN-3** The system shall provide an **Upgrade Ship** action that lets the player **buy the next ship** in the ladder (§3.2) if they can afford it, carrying weapons forward per ROC-SHIP-5; if unaffordable, the action shall be disabled and indicate the shortfall.
- **ROC-STN-4** The system shall provide **laser-fitting controls** that let the player **add a laser of any type (Pulse / Beam / Military) to any available firing direction (front / rear / left / right)**, up to the ship's hardpoint count and at most one per direction (§3.4), charging the per-type price (§3.8).
- **ROC-STN-5** The system shall let the player buy **ECM** and **Energy Bomb** here at their listed prices (§3.8).
- **ROC-STN-5a** The system shall let the player buy an **Escape Pod** and **additional lives** here (lives capped at 5, §3.16), at their tuned prices.
- **ROC-STN-5b** The system shall let the player **upgrade the missile level** here (still timed, per ROC-ECO-9 / §3.5).
- **ROC-STN-6** The system shall provide a **Launch** action that, **after an "Are you sure?" confirmation**, undocks the ship and begins the next level's launch sequence (§3.9).
- **ROC-STN-7** While on the station screen, the system shall display the player's current **credit balance** so purchase decisions are informed.

### 3.16 Lives, death & difficulty

- **ROC-DIF-1** The system shall provide a **global, tuneable difficulty** setting, selectable by the player, so the game can be **replayed at a harder setting**.
- **ROC-DIF-2** The system shall implement difficulty primarily via the per-wave **enemy-count scaler** (ROC-ENM-14) plus enemy hp/shield/fire-rate multipliers.
- **ROC-LIFE-1** The system shall start a run with **3 lives**.
- **ROC-LIFE-2** When the player ship is destroyed, the system shall **deduct one life** and, by default, **restart the current level from its beginning**.
- **ROC-LIFE-3** Where the player holds an **Escape Pod** at the moment of destruction, the system shall instead **respawn the player at the location of death**, **consume the pod** (the player then has no pod), and **not restart the level**.
- **ROC-LIFE-4** The system shall let the player **buy additional lives**, up to a **maximum of 5** held at once.
- **ROC-LIFE-5** If lives reach **zero**, then the system shall end the run (game over) and proceed to score submission (§3.14).
- **ROC-PROG-1** When the player **completes all four levels**, the system shall **unlock Elite mode** — a replay of the game at greater difficulty.
- **ROC-PROG-2** When the player **completes Elite mode**, the system shall **unlock the Thargoid ship as playable** (a bonus craft beyond the standard ladder, §3.2).
- **ROC-PROG-3** The system shall persist these unlocks locally (§3.14).

### 3.17 Lore & flavour (Elite homage)

- **ROC-LORE-1** *(Procedural blurbs)* The system shall show an **Elite-style one-line system description** on each level-intro / station screen (e.g. "Lave is most famous for its vast rain forests and the Laveian tree grub"), drawn from a tuneable text bank in the period style.
- **ROC-LORE-2** *(Named systems)* The system shall name levels after **canonical Elite systems** (default mapping, adjustable: L1 Lave, L2 Diso, L3 Leesti/Zaonce, L4 the witchspace sector), and reserve the **anarchy system Riedquat** for a hard level / **Elite mode**.
- **ROC-LORE-3** *(Commander Jameson)* The system shall use **"Jameson"** as the default commander / high-score name (ROC-LBD-2).
- **ROC-LORE-4** *(The Dark Wheel)* The system shall present elite ace-pirate squadrons as **"The Dark Wheel"** — a recurring, tougher named enemy wave (the shadowy cult from the packaged novella).
- **ROC-LORE-5** *(Raxxla)* The system shall hide a single well-buried **Raxxla** secret/bonus for completionists (Elite's enduring mystery system).
- **ROC-LORE-6** *(Station variety)* The system shall vary the **dock geometry** by level — beyond the **Coriolis**, the wireframe **Dodo (dodecahedral)** and **icosahedral** station types — for visual interest (§3.15).
- **ROC-LORE-7** *(Docking music)* The system shall play a brief **"Blue Danube"-style waltz** cue on launch/dock as a nod to the Archimedes/16-bit versions. *(IP note: the Strauss composition is public domain, but recordings are not — use an original or public-domain arrangement.)*

### 3.18 Audio (sound effects)

- **ROC-SFX-1** The system shall treat **all sound as optional** — fully playable silent, with an audio toggle (ROC-NFR-3) — and shall load SFX from external files the player/author provides.
- **ROC-SFX-2** The system shall use the following sound set (files to be supplied; names indicative):

  | Event | Sound |
  |------|-------|
  | Player laser — pulse / beam / military | `laser_pulse`, `laser_beam`, `laser_military` |
  | Enemy fire | `enemy_shot` |
  | Missile launch / homing | `missile_launch` |
  | Hit on shield (flash) | `shield_hit` |
  | Hull hit / damage | `hull_hit` |
  | Explosion (small / boss) | `explode_small`, `explode_large` |
  | Pickup collected | `pickup` |
  | Cargo scooped | `cargo_scoop` |
  | Bounty / wave-bonus award | `cash`, `wave_bonus` |
  | ECM activate | `ecm` |
  | Energy bomb | `energy_bomb` |
  | Low shield / warning ("Condition Red") | `alert` |
  | Launch from station | `launch` |
  | Docking | `dock` |
  | Witchspace misjump (L4 entry) | `witchspace` |
  | Rank-up / "Right On, Commander!" | `rank_up` |
  | Menu / button select | `ui_select` |
  | Docking music cue (Blue Danube-style, ROC-LORE-7) | `docking_theme` |

### 3.19 Title / intro screen

- **ROC-TTL-1** The system shall present an intro screen evoking classic Elite — a **slowly rotating wireframe ship**, here the **Sidewinder**, on the black starfield.
- **ROC-TTL-2** The system shall show the **title and credits at the top** of the intro screen.
- **ROC-TTL-3** When the player presses/taps **start**, the system shall **fly the rotating Sidewinder into gameplay position** and hand control to the player (a continuous transition into play, not a hard cut).
- **ROC-TTL-4** The system shall show a **privacy disclaimer at the bottom** of the intro screen, informing the player that **local storage is used to save mission progress** (and settings/high scores) — the disclosure expected of web games — with an expandable/link for detail.
- **ROC-TTL-5** Where online features (leaderboard/Firebase) are enabled, the disclaimer shall also cover that data path and defer to the consent flow (ROC-LBD-3).


---

## 4. Non-functional requirements

- **ROC-NFR-1** The system shall sustain 60 fps on a mid-range laptop with ≥ 50 on-screen entities (swarm + wave + particles).
- **ROC-NFR-2** The system shall be fully playable with mouse only, touch only, keyboard only, or controller only.
- **ROC-NFR-3** The system shall provide accessibility options: remappable controls, audio toggle, reduced-flash mode (shield-flash, explosions, star activity).
- **ROC-NFR-4** The system shall fit a portrait field responsively across phone and desktop.
- **ROC-NFR-5** The system shall load to a playable title screen within a few seconds on typical broadband.

### 4.1 Testability (headless, no screenshots)

The game shall be architected so that **almost all of it can be tested headless**, with assertions made against game state, never against pixels.

- **ROC-TEST-1** The system shall separate a **pure simulation core** (all game logic, physics, economy, AI, waves) from rendering, audio, input and DOM, such that the core runs with **no browser, canvas, or screenshot dependency** (e.g. under Node).
- **ROC-TEST-2** The simulation shall be **deterministic**: given an initial seed and a scripted input sequence, stepping the fixed-timestep loop (AS-2) shall always produce the **same state**. All randomness shall come from a single **injected, seedable PRNG**.
- **ROC-TEST-3** Input shall be an **abstract, scriptable event stream** (not raw DOM events), so tests can feed exact inputs per frame; the rendering and audio layers shall be replaceable with **null/no-op backends** behind the AS-1a interface.
- **ROC-TEST-4** The full game state shall be **serialisable and inspectable** (snapshot), so tests assert on entities, hp/shields, credits, kill tally, timers, wave membership, RNG state, etc.
- **ROC-TEST-5** The system shall provide a **headless harness** that runs scenarios at uncapped speed (no `requestAnimationFrame`) — spawn a wave, script inputs, advance N frames, assert outcomes — and a way to **replay a seed+input log** for regression.
- **ROC-TEST-6** The system shall ship an automated test suite covering, at minimum: **unit** (damage/shield depletion, hull flash, missile-grade timer decay, bounty + wave-bonus arithmetic, lives 0–5 bounds, credit wallet vs. score); **property-based** invariants (wave bonus = exactly 50% of summed member bounties and only on full clear; shields deplete before hull; rating tally is monotonic; every spawned enemy eventually dies or exits — no off-field stalls; lives never <0 or >5); and **scenario/integration** (run a scripted level headless and assert boss reached, dock entered, contraband triggers the Viper fight).
- **ROC-TEST-7** The system shall support **balance simulation**: a scripted/heuristic auto-player that runs levels headless and reports per-level **bounty income, deaths, time-to-clear and difficulty curve**, to drive the numeric tuning (ROC-SHIP-1a, §5 item 4) before and between human playtests.
- **ROC-TEST-8** The test and balance suites shall be **fast and CI-runnable** without a display.

---

## 5. Decisions log

All design open-questions are resolved:

1. **Player self-status** — no HUD; status is fully diegetic via shield ellipses + hull-damage visuals (ROC-HUD-3). ✔
2. **Gems when shot** — shatter (ROC-PWR-3). ✔
3. **Missile levels** — upgradable at the station, still timed (ROC-ECO-9, ROC-STN-5b). ✔
4. **Pricing & balance** — ship / pod / life / missile costs are tuning parameters, set against per-level bounty income via the **TS balance-simulation auto-player** (Vitest, design.md §15) once playable (ROC-SHIP-1a). ✔ (approach agreed; exact numbers are a build-time tuning task)
5. **Endgame / replay** — completing the 4 levels unlocks **Elite mode** (harder); completing Elite mode unlocks the **Thargoid ship** as playable; **high score table** maintained (ROC-PROG-1/2/3, ROC-LBD-1a). ✔

Earlier resolutions: stack is JS/TS + Canvas 2D (AS-1); ships purchased and tuned to ~one per level (§3.2); rating is kill-based, separate from credits (ROC-RTG); Energy Bomb cannot destroy bosses (ROC-DEF-2); station screen (§3.15); data-driven composable waves (§3.13).

**Remaining before code:** only the numeric balance pass (item 4) — everything else is specified.

---

## References

- *Elite* — Acornsoft, BBC Micro, 1984; Braben & Bell; first home game with hidden-line-removal wireframe 3D. (Elite Dangerous Wiki; MobyGames)
- Roster, Thargoid/Thargon, Coriolis, rating ladder, commodities (legal vs. contraband), equipment. (alt.fan.elite FAQ — bbc.nvg.org; MSX Elite — wiki.alioth.net)
- 3D hull data: **bbcelite.com** (VERTEX/EDGE/FACE blueprints) and **Ian Bell's archive** (elitehomepage.org, incl. ArcElite C-source models).
