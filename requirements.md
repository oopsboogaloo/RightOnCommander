# Right on Commander — Requirements Specification

**Version:** 1.11 (draft — all design decisions resolved)
**Author:** Chloe
**Notation:** EARS (Easy Approach to Requirements Syntax)
**Status:** Spec under construction — review

> **Changelog 1.10 → 1.11:** **Level 3 end boss changed** from the generation ship to an **Elite-rated ace pilot flying a fully-kitted Cobra Mk III** — military laser, beam lasers, missiles, and shields to match (ROC-L3-4 revised) — keeping every boss in the roster a real Elite hull rather than an original invention.
>
> **Changelog 1.9 → 1.10:** **Level 3 mid-boss changed** from the rogue station/Vipers to **a pair of Anacondas** (ROC-L3-3). **Added a witchspace interlude between Level 2 and Level 3** (new): the Level 2 → 3 hyperspace jump now lingers in witchspace — starfield held in its stretched, hyperspace state — for a **Thargoid wave the player must clear** before the jump resolves and Level 3 begins (ROC-WITCH-1..4). **Level 4 renamed "Alien warzone"** (was "Alien space") and **no longer entered via a forced witchspace misjump** — that framing now belongs to the Level 2→3 interlude instead — Level 4 is entered by an ordinary jump/launch like every other level (ROC-L4-0 revised). Level 4 also gains the **broken remains of Galactic Navy vessels** scattered through it as wreckage (ROC-L4-3, new), and **drops its mid-boss** — wave combat runs straight to the end boss — making it **shorter** than the standard §3.9 pacing (ROC-L4-4, new).
>
> **Changelog 1.8 → 1.9:** **Removed graduated hull damage for the player** (ROC-DMG-6b, new): once shields are at zero, any further hit is now **instantly lethal** — the player has no hull hit-point buffer, unlike enemies/bosses/hazards which are unaffected. To compensate, **starting lives raised from 3 to 4** (ROC-LIFE-1). The player now **flashes white on every hit**, including one a shield ring fully absorbs (ROC-DMG-2a) — previously only unshielded hull hits flashed. **Blinking (visibility toggling) is now reserved solely for the brief invulnerability window right after a respawn** (ROC-LIFE-2c) — it no longer triggers for an ordinary hit's short ramming/contact i-frames, so a blinking ship on screen always means "just respawned," never "just got hit." **Removed the hull readout from the bottom status bar** (ROC-HUD-2 revised) since hull no longer functions as a player survivability stat.
>
> **Changelog 1.7 → 1.8:** Reversed the v1.0 no-HUD decision — added a **persistent bottom status bar** (ROC-HUD-2,3) showing hull, shield, missile level + countdown, energy bomb count and energy bank countdown alongside score/credits/lives (an ECM countdown is planned to join it later); the diegetic shield rings and damage particles stay too. **Death no longer restarts anything**: every death (wherever it happens — part 1, part 2, a boss fight) now just respawns the player **in place** once the ship's explosion has fully played out, superseding the old "restart the level" default and the part-2 checkpoint (ROC-LIFE-2, replacing ROC-BOSS-5/6/7). The player's own explosion is now bigger and longer-lived than a routine kill, and — since the ship can die at speed — it **does not carry the ship's momentum**, so it plays out **in place**; a new ship appears **500 ms after the explosion finishes**, flashing with its usual respawn invulnerability. **Removed the Escape Pod** entirely (ROC-LIFE-3 old wording). Added the **Energy Bomb auto-trigger** (ROC-DEF-2 revised): it now fires automatically instead of the ship dying — destroying every non-boss hazard and enemy shot/missile on screen, dealing a boss 50% of its current hull in damage (which can kill a weakened one), leaving the ship at 1 hull, and captioning **"Emergency energy bomb deployed"** — capped at **one** carried at a time, or **two** in the Fer-de-Lance. Added the **Energy Bank** (new, purchasable at dock): passively regenerates one shield ring every 15 seconds. Fixed **touch fire** to autofire continuously while held/dragged, matching the mouse (ROC-CTL-1,2) — needed for the beam laser to sustain on touch. Corrected the docking-sequence spec (ROC-DCKG-3) to match the station-as-backdrop behaviour already shipped: the Coriolis has no collision, and the shop opens automatically once it's held in view for a beat.
>
> **Changelog 1.6 → 1.7:** Specified the **mid- and end-of-level boss fights**. Added **§3.23 Boss encounters** (scroll stops for the fight, horizontal black-and-white boss health bar at the top of the screen, "RIGHT ON COMMANDER" kill text that fades, scroll resumes; **boss ECM** that harmlessly detonates player missiles 300 ms after launch on a 500 ms cooldown with an "ECM" caption; death at a boss respawns **in place** with the boss keeping its damage, death in part 2 resumes at the **start of part 2** — refining ROC-LIFE-2). Added **§3.24 L1 mid-boss: pirate hermit asteroid** (asteroid mesh replacing the Coriolis placeholder, Coriolis-style docking-port rectangle on the rotation axis, 2× Coriolis size at top-centre, slow y-rotation, adder launches every 5 s capped at 3 alive, no shields / 30-hit hull with **triple damage on the docking port**, 1,000 cr + guaranteed laser + 10 random cargo, survivors flee, whole-fight adder wave bonus). Added **§3.25 L1 end boss: Fer-de-Lance** (**all FdL rescaled 1.5×, including the player's; the boss renders 2.0×**, 8 shield rings, boss ECM, fast rounded-rectangle strafing track with direction reversals every 200–2000 ms, aimed laser every 400 ms, 1,000 cr + 10 cargo). Added **§3.26 Docking sequence** (2× rotating Coriolis scrolls in, guns/missiles disabled, dock through the port when within 30° of horizontal; collision = death, then the shop if lives remain) and **§3.27 Launch & hyperspace** (Coriolis departure on **every** launch, "Hyperspace [destination] 5" countdown, starfield stretches to full-height lines then settles, system info card with Elite facts).

> **Changelog 1.5 → 1.6:** **Shields now hug the hull** instead of a separate ellipse (ROC-DMG-1,2,3,5 revised) — the collision shape and the rendered rings are both the hull's own silhouette, offset outward by a small gap (proportional to hull size), one increment per remaining ring; ship-to-ship ramming uses the same silhouette shape (dilated by each side's shield gap) instead of a bounding circle.

> **Changelog 1.4 → 1.5:** **Collectables are now inert to weapons fire** — bullets and missiles pass through pickups/cargo; only the player scoop collects them (ROC-PWR-2, ROC-PWR-3, ROC-CARGO-2, revising the earlier "shot fuel explodes / gems shatter"). Added **§3.20 Cargo drops** (enemies sometimes drop cargo from the full commodity list; Alien Items only from Thargoids; collected type shown), **§3.21 Kill-credit display** (floating credit/bonus text rising from the explosion), a **§3.4a directional-hardpoint model** (per-ship hardpoint counts per direction, multiple per direction), a **§3.5a missile-behaviour revision** (smaller, slower, ≤4 alive with oldest-removed, one-at-a-time alternating wings, fire only with an on-screen target, 30 s hard lifetime, per-ship capacity), and **§3.22 Transporters** (slow, unarmed, high-hull enemy that always drops a significant pickup). Playtest tuning: wave fighters weakened and **Level 1 wave count ~5×**.

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

  | Order | Ship | Movement | Shield (hp / rings) | Hull (hp) | Hardpoints |
  |------|------|----------|----------------------|-----------|------------|
  | 1 | Sidewinder | very quick, low mass | 1 | 2 | 1 |
  | 2 | Cobra Mk III | fast, mid mass | 2 | 3 | 2 |
  | 3 | Asp Mk II | mid speed, mid mass, larger than Cobra | 3 | 3 | 3 |
  | 4 | Fer-de-Lance | heavy, sluggish | 4 | 4 | 4 |

- **ROC-SHIP-3** The system shall treat **shield hp as the number of concentric shield rings** (§3.3) for the player ship.
- **ROC-SHIP-4** The system shall cap the player's equipped lasers at the ship's hardpoint count, with **at most one laser per firing direction** (front, rear, left, right) — see §3.4.
- **ROC-SHIP-5** When the player buys a new ship, the system shall **carry equipped weapons forward** and re-fit them up to the new hull's hardpoint count (since each step up the ladder adds a hardpoint, no laser is lost).
- **ROC-SHIP-6** Where the player has unlocked it (ROC-PROG-2), the system shall offer the **Thargoid ship as a playable bonus craft** beyond the four-ship ladder.

### 3.3 Shields, hull & damage model

Applies to enemies and (assumed) the player — see §5.

- **ROC-DMG-1** While shielded, the system shall use a collision shape that **hugs the hull's own silhouette**, offset outward by a small gap proportional to the hull's size (one gap increment per remaining shield ring), rather than an unrelated ellipse.
- **ROC-DMG-2** While shielded, when hit, the system shall briefly **flash the shield ring** and shall **not** flash the hull (the shield absorbed it).
- **ROC-DMG-2a** *(v1.9, new)* For the **player only**, every hit — including one a shield ring fully absorbs — shall also trigger the white hull flash (ROC-DMG-6), so any hit reads the same way on screen regardless of whether a shield was up.
- **ROC-DMG-3** The system shall render shield strength as **concentric rings that hug the hull's silhouette** (rounded outward offset, larger gap per ring outward), the **count indicating remaining strength**; rings render white at ~50% opacity, briefly brightening on absorb, and track the ship's own yaw and bank.
- **ROC-DMG-4** The system shall allow **different ship types to have different maximum shield strengths**.
- **ROC-DMG-5** When shields deplete, the system shall switch the collision shape to the **hull** outline (undilated).
- **ROC-DMG-6** While unshielded, when the hull is hit, the system shall **briefly flash the whole object white** and emit **lines-and-dots fragments** blown off the ship's own wireframe.
- **ROC-DMG-6a** The system shall apply the white-damage-flash rule to **any object that takes hull damage** (player, enemies, bosses, destructible hazards), reserving the shield flash (ROC-DMG-2) for hits a shield absorbs.
- **ROC-DMG-6b** *(v1.9, new — removes graduated player hull damage)* The **player** has no hull hit-point buffer: once its shields are at zero, **any** further hit is **instantly lethal** (ROC-LIFE-2), rather than depleting hull points over multiple hits. Every other object (enemies, bosses, destructible hazards) keeps graduated hull damage per ROC-DMG-6 unchanged.
- **ROC-DMG-7** While the hull is significantly damaged, the system shall display persistent **white smoke and fire** particles on that ship. *(Applies to enemies/bosses/hazards; the player has no graduated hull damage to display this way, ROC-DMG-6b.)*

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
- **ROC-PWR-2** Where a **Fuel** pickup is collected, the system shall **restore shield power**; if full, bank it as **sellable cargo**.
- **ROC-PWR-2a** The system shall make **collectables inert to weapons fire**: bullets and missiles shall **pass through pickups and cargo without colliding**; only the player's **scoop** collects them. *(Revises the earlier fuel-explodes / gems-shatter behaviour — v1.5.)*
- **ROC-PWR-3** Where a **Gems** pickup is collected, the system shall **restore shield power**; if full, bank it as **sellable cargo**.
- **ROC-PWR-4** Where an **Alloys** pickup is collected, the system shall **repair hull**; if shot, the system shall make it **shatter**.
- **ROC-PWR-5** The system shall make the weapon/utility pickups (lasers §3.4, missiles §3.5, ECM, Energy Bomb) **collectable in flight as well as purchasable**.
- **ROC-PWR-6** When a **mid-level boss** is destroyed, the system shall **always drop a laser power-up** (guaranteed), collectable by the player.

### 3.7 ECM, Energy Bomb & Energy Bank

- **ROC-DEF-1** Where **ECM** is triggered, the system shall **destroy all missiles and bullets on screen** and then enter a **cooldown** before it can be used again.
- **ROC-DEF-2** *(v1.8 — auto-trigger)* When the player's hull would reach **zero** and an **Energy Bomb** is carried, the system shall trigger it **automatically instead of destroying the ship**: consume one charge, leave the ship at **1 hull** (bare survival — the next hit can still kill), **destroy every non-boss enemy, asteroid, and enemy shot/missile on screen**, and deal a **boss 50% of its current hull** in damage (enough to kill an already-weakened one). The system shall display **"Emergency energy bomb deployed"** near the top of the screen with a bright flash.
- **ROC-DEF-2a** The system shall cap the number of Energy Bombs carried at **one**, or **two** while flying the **Fer-de-Lance** (§3.2).
- **ROC-DEF-3** The system shall expose **ECM** via a partly-transparent touch button (§3.12) and bindable control; the Energy Bomb has **no manual trigger** — it is purely automatic (ROC-DEF-2).
- **ROC-BANK-1** *(v1.8, new)* The system shall offer an **Energy Bank** as a one-time station purchase (§3.15).
- **ROC-BANK-2** While the Energy Bank is owned, the system shall **regenerate one shield ring every 15 seconds** (capped at the ship's maximum), independently of any other shield-restoring pickup.

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
  | Energy bomb (max 1, or 2 in the Fer-de-Lance) | 5,000 |
  | Energy bank | 5,000 |
  | Extra life (max 5 held) | tuned (see §5) |
  | Next ship (Cobra / Asp / Fer-de-Lance) | tuned per ROC-SHIP-1a |

  All purchases are made on the station screen (§3.15).

- **ROC-ECO-9** The system shall give the player a **starting missile level**, and shall let the player **upgrade the missile level at the station** for credits. Dock-purchased missile levels **still run on the §3.5 timer** (they raise the grade and (re)start the countdown, decaying a grade on expiry as normal).
- **ROC-ECO-8** If the player lacks credits for an item, then the system shall disable its purchase and indicate the shortfall.

### 3.9 Level structure & bosses

- **ROC-LVL-1** The system shall **begin every level launching from a Coriolis station** and **end every level docking at a Coriolis station** (then the dock/sell/equip screen). The Coriolis is the non-combat bookend, not a boss.
- **ROC-LVL-2** The system shall stage, within each level, scrolling wave combat (§3.13) plus a **mid-level boss** and an **end-of-level boss** as below — **except Level 4**, which drops the mid-boss (ROC-L4-4).
- **ROC-LVL-3** The system shall pace each level so its **combat/wave phase lasts roughly 3–5 minutes**, plus **about 1 minute for the end-of-level boss**.
- **ROC-LVL-4** If the player is carrying **illegal/contraband cargo** at the end of a level, then before docking the system shall stage an **extra interception fight against a number of Vipers**; this fight yields **no credit reward (kills still count toward rating)** and scales the Viper count with the amount of contraband / difficulty.

**Level 1 — Asteroid field**
- **ROC-L1-1** The system shall fill the level with **drifting asteroids that fragment into boulders** when shot.
- **ROC-L1-2** The system shall spawn **occasional lone Sidewinder / Krait / Gecko / Adder** pirates.
- **ROC-L1-3** The system shall make asteroids **sometimes yield Alloys, Metals, Gems or Crystals**.
- **ROC-L1-4** The system shall provide a **mid-level boss: a well-defended hermit asteroid** (fight detailed in §3.24).
- **ROC-L1-5** The system shall provide an **end boss: a Fer-de-Lance** (fight detailed in §3.25).

**Level 2 — Deep space**
- **ROC-L2-1** The system shall spawn **more dangerous pirates** in **more elaborate multi-ship attack waves**.
- **ROC-L2-2** The system shall require the player to **shoot through dense bands of asteroids**.
- **ROC-L2-3** The system shall provide a **mid boss: a Python**.
- **ROC-L2-4** The system shall provide an **end boss: the Constrictor** — the prototype warship with abnormally strong shields that GalCop wants stopped (the canonical disk-Elite mission target); its boss fight shall reflect its **unusually high shield strength**.

**Witchspace interlude — between Level 2 and 3** *(v1.10, new)*
- **ROC-WITCH-1** The system shall insert a **witchspace interlude** into the Level 2 → Level 3 transition: launching from the Level 2 station triggers the standard hyperspace sequence (§3.27), but instead of settling directly into Level 3's arrival, the jump **lingers in witchspace** — the starfield stays held in its fully-stretched, hyperspace-lines state — for a combat encounter before arrival.
- **ROC-WITCH-2** While the interlude holds, the system shall spawn a **wave of Thargoids** (ROC-ENM-6) that the player must defeat; the ship's guns/missiles/movement all function normally against the stretched-starfield backdrop.
- **ROC-WITCH-3** Once the Thargoid wave is cleared, the system shall **resolve the hyperspace jump** — the stretched lines shrink back into the normal scrolling starfield (as ROC-HYP-4) — and proceed into Level 3's arrival (info card, then wave combat) exactly as any other inter-level jump.
- **ROC-WITCH-4** This witchspace framing is used **only** for the Level 2 → 3 transition; Level 4 is entered by an ordinary jump (ROC-L4-0), since the witchspace beat has already been spent here.

**Level 3 — Star surface**
- **ROC-L3-1** The system shall render a **large white star occupying the right-hand side with massive curvature**.
- **ROC-L3-2** The system shall present **dangerous ships** plus the **star as an environmental hazard, with occasional white star activity** (flares/eruptions).
- **ROC-L3-3** *(v1.10 — was a rogue station with Vipers)* The system shall provide a **mid boss: a pair of Anacondas** fought together.
- **ROC-L3-4** *(v1.11 — was a generation ship)* The system shall provide an **end boss: an Elite-rated ace pilot flying a fully-kitted Cobra Mk III** — military laser, beam lasers, missiles, and shields to match its pilot's rating — rather than an original hull, keeping the boss roster drawn entirely from real Elite ships.

**Level 4 — Alien warzone** *(v1.10 — renamed from "Alien space")*
- **ROC-L4-0** *(v1.10 — revised: no longer a misjump)* The system shall enter Level 4 via an **ordinary hyperspace jump/launch** (§3.27), the same as every other level. *(The forced-witchspace-misjump framing previously used here has moved to the Level 2→3 transition, ROC-WITCH-1..4, so it isn't reused.)*
- **ROC-L4-1** The system shall populate the level with **Thargoids and asteroids**.
- **ROC-L4-1a** The system shall include **several variants of the Thargoid saucer** — differing in size, shield strength, Thargon-launch behaviour and/or attack pattern — to keep Level 4 varied.
- **ROC-L4-2** The system shall provide an **end boss: the (Thargoid) mothership**.
- **ROC-L4-3** *(v1.10, new)* The system shall scatter the **broken remains of Galactic Navy vessels** through the level as wreckage — passive environmental scenery/hazard (in the spirit of ROC-L1-1's asteroid field) — underscoring that this is an active warzone.
- **ROC-L4-4** *(v1.10, new)* The system shall **omit a mid-level boss for Level 4** (relaxing the §3.9/ROC-LVL-2 mid+end default for this level only) — wave combat runs straight through to the end boss — and shall **pace the level shorter** than the standard combat window (ROC-LVL-3).

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
- **ROC-HUD-2** *(v1.9 — drops the hull readout)* The system shall display a **persistent status bar at the bottom of the screen**, as simple white/grey text, showing: **shield**, **missile level with a countdown in seconds**, **energy bomb count**, and **energy bank countdown** — plus **score, credits and lives**. *(No hull readout: the player has no hull hit-point buffer, ROC-DMG-6b. An ECM countdown is planned to join this row later.)*
- **ROC-HUD-3** In addition to the numeric bar (ROC-HUD-2), the system shall keep conveying player shield state **diegetically** too — via the player ship's own shield rings and its white damage flash (§3.3) — so the two reinforce each other rather than replacing one another.

### 3.12 Controls

- **ROC-CTL-1** Where a mouse is used, the system shall move the ship to follow the pointer and **autofire while the button is held**; a single click fires one shot (tap-fire fallback).
- **ROC-CTL-2** *(v1.8 — fixed touch parity)* Where touch is used, the system shall move the ship by drag and **fire continuously while the touch is held or dragged, matching ROC-CTL-1**; a single tap fires one shot (needed for the beam laser, which has no discrete "shot" to fire on a tap alone).
- **ROC-CTL-3** On touch, the system shall present a **partly-transparent white button for ECM** (§3.7).
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
- **ROC-STN-5** The system shall let the player buy **ECM** and **Energy Bomb** here at their listed prices (§3.8), the latter **capped at one carried (two in the Fer-de-Lance, ROC-DEF-2a)**.
- **ROC-STN-5a** *(v1.8 — Escape Pod removed)* The system shall let the player buy an **Energy Bank** (a one-time purchase that passively regenerates one shield ring every 15 seconds, §3.7) and **additional lives** here (lives capped at 5, §3.16), at their tuned prices.
- **ROC-STN-5b** The system shall let the player **upgrade the missile level** here (still timed, per ROC-ECO-9 / §3.5).
- **ROC-STN-6** The system shall provide a **Launch** action that, **after an "Are you sure?" confirmation**, undocks the ship and begins the next level's launch sequence (§3.9).
- **ROC-STN-7** While on the station screen, the system shall display the player's current **credit balance** so purchase decisions are informed.

### 3.16 Lives, death & difficulty

- **ROC-DIF-1** The system shall provide a **global, tuneable difficulty** setting, selectable by the player, so the game can be **replayed at a harder setting**.
- **ROC-DIF-2** The system shall implement difficulty primarily via the per-wave **enemy-count scaler** (ROC-ENM-14) plus enemy hp/shield/fire-rate multipliers.
- **ROC-LIFE-1** The system shall start a run with **4 lives** *(v1.9 — raised from 3 to offset the harder ROC-DMG-6b instant-death rule)*.
- **ROC-LIFE-2** *(v1.8 — always respawn in place)* When the player ship is destroyed (and no Energy Bomb saves it, ROC-DEF-2), the system shall **deduct one life immediately** and — once the explosion has fully played out (ROC-LIFE-2b) — **respawn the player at the location of death**. This applies **everywhere**: part 1, part 2, and mid-/end-boss fights (§3.23) all behave identically; nothing about the level, its waves, or a boss's damage/state is ever reset. *(Supersedes the old "restart the level from its beginning" default and the old Escape Pod.)*
- **ROC-LIFE-2a** Where an **Energy Bomb** is carried at the moment the hull would reach zero, the system shall trigger it instead (ROC-DEF-2) — the ship never dies, no life is lost, and ROC-LIFE-2 does not apply.
- **ROC-LIFE-2b** *(v1.8, new)* The player's own explosion shall be **larger and longer-lived** than an ordinary kill (§3.10, ROC-VIS-6), and — since the ship may be destroyed at speed — shall **not carry the ship's momentum**, so it plays out **in place** rather than drifting across the field. The system shall hide the ship for the explosion's full duration, then wait a further **500 ms**, before the new ship appears (flashing with respawn invulnerability, as any respawn does).
- **ROC-LIFE-2c** *(v1.9, new)* The ship shall **blink (toggle visibility)** only during the brief invulnerability window granted right after a respawn (ROC-LIFE-2b) — never during the shorter contact/ramming i-frame window (§3.16 contact grace) that follows an ordinary hit. A hit's feedback is the flash (ROC-DMG-2a), not a blink.
- **ROC-LIFE-4** The system shall let the player **buy additional lives**, up to a **maximum of 5** held at once.
- **ROC-LIFE-5** If lives reach **zero**, then the system shall end the run (game over) and proceed to score submission (§3.14).
- **ROC-PROG-1** When the player **completes all four levels**, the system shall **unlock Elite mode** — a replay of the game at greater difficulty.
- **ROC-PROG-2** When the player **completes Elite mode**, the system shall **unlock the Thargoid ship as playable** (a bonus craft beyond the standard ladder, §3.2).
- **ROC-PROG-3** The system shall persist these unlocks locally (§3.14).

### 3.17 Lore & flavour (Elite homage)

- **ROC-LORE-1** *(Procedural blurbs)* The system shall show an **Elite-style one-line system description** on each level-intro / station screen (e.g. "Lave is most famous for its vast rain forests and the Laveian tree grub"), drawn from a tuneable text bank in the period style.
- **ROC-LORE-2** *(Named systems)* The system shall name levels after **canonical Elite systems** (default mapping, adjustable: L1 Lave, L2 Diso, [witchspace interlude, ROC-WITCH-1], L3 Leesti/Zaonce, L4 the Thargoid Exclusion Zone *(v1.10 — replaces "the witchspace sector" now that L4 is an ordinary jump, not a misjump)*), and reserve the **anarchy system Riedquat** for a hard level / **Elite mode**.
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
  | Witchspace interlude (L2→3 transition, ROC-WITCH-1) | `witchspace` |
  | Rank-up / "Right On, Commander!" | `rank_up` |
  | Menu / button select | `ui_select` |
  | Docking music cue (Blue Danube-style, ROC-LORE-7) | `docking_theme` |

### 3.19 Title / intro screen

- **ROC-TTL-1** The system shall present an intro screen evoking classic Elite — a **slowly rotating wireframe ship**, here the **Sidewinder**, on the black starfield.
- **ROC-TTL-2** The system shall show the **title and credits at the top** of the intro screen.
- **ROC-TTL-3** When the player presses/taps **start**, the system shall **fly the rotating Sidewinder into gameplay position** and hand control to the player (a continuous transition into play, not a hard cut).
- **ROC-TTL-4** The system shall show a **privacy disclaimer at the bottom** of the intro screen, informing the player that **local storage is used to save mission progress** (and settings/high scores) — the disclosure expected of web games — with an expandable/link for detail.
- **ROC-TTL-5** Where online features (leaderboard/Firebase) are enabled, the disclaimer shall also cover that data path and defer to the consent flow (ROC-LBD-3).


### 3.4a Directional hardpoints (v1.5)

- **ROC-HP-1** The system shall define weapon **hardpoints per ship and per firing direction** (front / rear / left / right), allowing **more than one hardpoint in a direction**.
- **ROC-HP-2** The system shall use the following hardpoint layout:

  | Ship | Front | Rear | Left | Right |
  |------|-------|------|------|-------|
  | Sidewinder | 2 | 1 | 0 | 0 |
  | Cobra Mk III | 2 | 1 | 1 | 1 |
  | Asp Mk II | 3 | 2 | 2 | 2 |
  | Fer-de-Lance | 3 | 3 | 3 | 3 |

- **ROC-HP-3** When a weapon is installed in a directional hardpoint, the system shall let that weapon **fire in that direction**; all installed weapons fire together on the trigger.
- **ROC-HP-4** When the player **picks up** a weapon, the system shall place it in an empty hardpoint if one is available, preferring directions in the order **Front → Rear → Left → Right**.
- **ROC-HP-5** The system shall supersede the earlier "one laser per direction" rule (ROC-SHIP-4 / ROC-LAS-2) with this multi-hardpoint model.

### 3.5a Missile behaviour revision (v1.5)

- **ROC-MIS-6** The system shall render missiles **smaller** and move them **slower** than the pre-v1.5 implementation.
- **ROC-MIS-7** When the player fires missiles, the system shall **only launch if at least one enemy is on screen**.
- **ROC-MIS-8** When missiles are fired, the system shall launch them **one at a time with a short delay**, **alternating** between the ship's **left and right wing** launch positions.
- **ROC-MIS-9** The system shall cap **alive missiles at 4**; when a fifth would launch, the system shall **remove the oldest** active missile.
- **ROC-MIS-10** The system shall expire every missile after **30 seconds** (a hard lifetime that also prevents missiles stuck orbiting a target from persisting).
- **ROC-MIS-11** When a missile is moving, the system shall emit **more exhaust particles** than the pre-v1.5 implementation.
- **ROC-MIS-12** The system shall limit **per-ship missile capacity**: Sidewinder 1, Cobra Mk III 2, Asp 3, Fer-de-Lance 4.

### 3.20 Cargo drops (v1.5)

- **ROC-CARGO-1** When an enemy is destroyed, the system shall **sometimes drop cargo**.
- **ROC-CARGO-2** The system shall **not** let bullets or missiles collide with cargo (see ROC-PWR-2a).
- **ROC-CARGO-3** When the player collects cargo, the system shall **display the collected cargo type**.
- **ROC-CARGO-4** The system shall support the cargo types: **Food, Textiles, Radioactives, Slaves (illegal), Liquor/Wines, Firearms (illegal), Narcotics (illegal), Computers, Machinery, Alloys, Furs, Minerals, Gold, Platinum, Gem-Stones, Alien Items**.
- **ROC-CARGO-5** Where cargo is dropped by a **non-Thargoid** enemy, the system shall **not** drop **Alien Items**; where dropped by a **Thargoid**, it **may**.

### 3.21 Kill-credit display (v1.5)

- **ROC-KC-1** When an enemy is destroyed, the system shall **briefly display the credits earned** for that kill.
- **ROC-KC-2** When a **wave bonus** is awarded, the system shall **briefly display the bonus amount**.
- **ROC-KC-3** When a credit value is displayed, the system shall show it **at/under the explosion, drifting upward as it fades out**.

### 3.22 Transporters (v1.5)

- **ROC-TR-1** The system shall add **transporter** enemy ships using the original Elite transporter visual.
- **ROC-TR-2** When a transporter appears, the system shall move it **slowly** across the screen and **prevent it from shooting**.
- **ROC-TR-3** The system shall make a transporter **take more hits to destroy** than the player might expect (high hull).
- **ROC-TR-4** When a transporter is destroyed, the system shall **always drop a significant pickup**.

### 3.23 Boss encounters (v1.7)

Framing shared by **every mid-level and end-of-level boss** (§3.9). Level 1's two fights are detailed in §3.24–3.25; later levels' bosses adopt the same framing with their own content.

- **ROC-BOSS-1** When a boss fight begins, the system shall **stop the starfield scrolling** for the duration of the fight (the play field holds position).
- **ROC-BOSS-2** While a boss is alive, the system shall display a **horizontal black-and-white boss health bar at the top of the screen** that **reduces as the boss is damaged**.
- **ROC-BOSS-3** When a boss is destroyed, after its explosion the system shall display the text **"RIGHT ON COMMANDER"** in white, then **fade it out**. *(This deliberately reuses the Elite-rating cry of ROC-RTG-3; both usages are retained.)*
- **ROC-BOSS-4** When the boss-kill text has faded, the system shall **resume scrolling**: after a **mid-level** boss, the second half of the level (WAVES_B) plays; after an **end-of-level** boss, a space station scrolls into view for the docking sequence (§3.26).
- **ROC-BOSS-5** *(v1.8 — folded into the universal rule)* Dying during a boss fight is just the general case of ROC-LIFE-2: the player respawns in place once the explosion plays out, and the boss (and any escorts) **retain their current damage and state** exactly as everything else on the field does. *(ROC-BOSS-6/7, the old part-2 checkpoint and its part-1-only restart carve-out, are removed — every death behaves identically now; see ROC-LIFE-2.)*

**Boss ECM** (carried by both Level 1 bosses; reusable by later bosses):

- **ROC-BECM-1** While a boss with ECM is alive, when the player launches missiles, the system shall — after **300 ms** — **flash the screen** and **harmlessly detonate all player missiles in flight** (no damage to any object).
- **ROC-BECM-2** The system shall give the boss ECM a **500 ms cooldown** between firings.
- **ROC-BECM-3** When the boss ECM fires, the system shall **briefly display "ECM" at the bottom of the screen**.
- **ROC-BECM-4** When the ECM-carrying boss is destroyed, the system shall **end all ECM effects immediately** — missiles fired thereafter are unaffected. *(Design intent: the player cannot lean on missiles against these bosses and must win on aim and movement.)*

### 3.24 Level 1 mid-boss — pirate hermit asteroid (v1.7, refines ROC-L1-4)

- **ROC-HERM-1** The system shall render the hermit as an **asteroid mesh** — replacing the placeholder Coriolis station graphic — with a **rectangle identical to the space station's docking-port rectangle** on its surface representing the docking port.
- **ROC-HERM-2** The system shall size the hermit asteroid at **twice the size of the current Coriolis station** and position it at the **middle top of the screen**.
- **ROC-HERM-3** The system shall rotate the asteroid **slowly about its y axis**, with the **docking port aligned on the centre of rotation** so the port is **always on the gameplay surface**.
- **ROC-HERM-4** Every **5 seconds**, while fewer than **3 adders are on screen**, the system shall spawn an **Adder** that either **launches from the asteroid** or **enters from the left or right screen edge**; spawning continues until the asteroid is destroyed.
- **ROC-HERM-5** When an adder launches from the asteroid, the system shall spawn it with a **y-axis rotation appropriate to the asteroid's current angle**, then **rotate it back to normal flight attitude** as it flies out.
- **ROC-HERM-6** The system shall fly the adders on **winding paths around the screen** at **medium-fast** speed, **never colliding with the asteroid**.
- **ROC-HERM-7** The system shall give the asteroid **no shields** and a hull of **30 hits** (one pulse-laser hit = 1 hit; heavier lasers deal their normal damage multiples).
- **ROC-HERM-8** When a shot lands **directly on the docking port**, the system shall apply **triple damage**.
- **ROC-HERM-9** The system shall equip the hermit with the **boss ECM** (ROC-BECM-1..4).
- **ROC-HERM-10** When the asteroid is destroyed, the system shall award **1,000 cr**, drop the **guaranteed (pulse) laser power-up as normal** (ROC-PWR-6) and **10 random cargo canisters** (per §3.20 rules).
- **ROC-HERM-11** When the asteroid is destroyed, the system shall make all surviving adders **attempt to fly off screen**.
- **ROC-HERM-12** The system shall treat **every adder spawned during the fight as one wave** for the bonus: destroying them **all** — including the fleeing survivors, before any exits — awards the standard 50% wave bounty (ROC-ECO-1a); any escape forfeits it.

### 3.25 Level 1 end boss — Fer-de-Lance (v1.7, refines ROC-L1-5)

- **ROC-FDL-1** The system shall rescale the **Fer-de-Lance to 1.5× everywhere it appears — including the player-flown hull** (§3.2) — correcting its under-sized rendering; the **boss FdL shall render at 2.0×** instead.
- **ROC-FDL-2** The system shall give the boss FdL **8 shield rings** and the **boss ECM** (ROC-BECM-1..4).
- **ROC-FDL-3** The system shall strafe the boss FdL **fast** around a **rectangular track with rounded corners**, alternating **clockwise and anticlockwise**, **reversing direction at random intervals of 200–2000 ms** — it should be hard to hit.
- **ROC-FDL-4** While the fight is on, the system shall have the boss **fire its laser at the player every 400 ms**.
- **ROC-FDL-5** When the boss FdL is destroyed, the system shall reward the player with **10 cargo items** and **1,000 cr**, and display the "RIGHT ON COMMANDER" boss-kill text (ROC-BOSS-3).

### 3.26 End-of-level docking sequence (v1.7, refines the ROC-LVL-1 dock bookend)

- **ROC-DCKG-1** When the end boss's kill text has faded, the system shall **resume scrolling** and scroll a **Coriolis station into view** at **twice the size of the current one** (the old hermit placeholder), **rotating slowly on its y axis**.
- **ROC-DCKG-2** While the docking sequence is active, the system shall **disable the player's guns and missiles**.
- **ROC-DCKG-3** *(v1.8 — corrected: the fly-in docking minigame wasn't fun and was removed)* The docking Coriolis is a **backdrop only, with no collision** — it cannot kill the player. Once it has scrolled fully into view and held for a short beat, the system shall **open the station shop screen (§3.15) automatically**.

### 3.27 Launch & hyperspace sequence (v1.7)

- **ROC-HYP-1** When the player launches — **every level, including the first** — the system shall show the ship **leaving a Coriolis station pointing up-screen**, which then **scrolls out of view behind the player**.
- **ROC-HYP-2** A few seconds after launch, the system shall show a **text countdown "Hyperspace [destination] 5"**, counting down in seconds, where *destination* is the **target system name for the level** (ROC-LORE-2).
- **ROC-HYP-3** When the countdown ends, the system shall **rapidly accelerate the starfield**, **stretching the dots into lines until the lines span the full screen height**.
- **ROC-HYP-4** After a few seconds at full stretch, the system shall **shrink and slow the lines** back into the normal scrolling starfield.
- **ROC-HYP-5** When hyperspace completes, the system shall resume the level with an **info display showing a few facts about the classic Elite location** (extending the ROC-LORE-1 blurb).

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

1. **Player self-status** — *(v1.8, reversed)* a persistent bottom status bar (hull/shield/missile+countdown/bomb/bank/score/credits/lives, ROC-HUD-2) alongside the diegetic shield rings + hull-damage visuals (ROC-HUD-3). ✔
2. **Gems when shot** — shatter (ROC-PWR-3). ✔
3. **Missile levels** — upgradable at the station, still timed (ROC-ECO-9, ROC-STN-5b). ✔
4. **Pricing & balance** — ship / bank / life / missile costs are tuning parameters, set against per-level bounty income via the **TS balance-simulation auto-player** (Vitest, design.md §15) once playable (ROC-SHIP-1a). ✔ (approach agreed; exact numbers are a build-time tuning task)
5. **Endgame / replay** — completing the 4 levels unlocks **Elite mode** (harder); completing Elite mode unlocks the **Thargoid ship** as playable; **high score table** maintained (ROC-PROG-1/2/3, ROC-LBD-1a). ✔

Earlier resolutions: stack is JS/TS + Canvas 2D (AS-1); ships purchased and tuned to ~one per level (§3.2); rating is kill-based, separate from credits (ROC-RTG); station screen (§3.15); data-driven composable waves (§3.13).

**Remaining before code:** only the numeric balance pass (item 4) — everything else is specified.

---

## References

- *Elite* — Acornsoft, BBC Micro, 1984; Braben & Bell; first home game with hidden-line-removal wireframe 3D. (Elite Dangerous Wiki; MobyGames)
- Roster, Thargoid/Thargon, Coriolis, rating ladder, commodities (legal vs. contraband), equipment. (alt.fan.elite FAQ — bbc.nvg.org; MSX Elite — wiki.alioth.net)
- 3D hull data: **bbcelite.com** (VERTEX/EDGE/FACE blueprints) and **Ian Bell's archive** (elitehomepage.org, incl. ArcElite C-source models).
