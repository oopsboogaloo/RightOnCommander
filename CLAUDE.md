# RightOnCommander

A vertically scrolling space shooter for web and mobile, themed on the classic 8-bit game Elite.

## Project Overview

- **Genre:** Vertical scrolling shooter (shmup)
- **Platform:** Web (HTML5 Canvas) + Mobile (touch controls)
- **Theme:** Elite 8-bit universe — Cobra ships, pirates, space stations, hyperspace jumps
- **Tech:** Vanilla JS + HTML5 Canvas, no framework dependencies

## Structure

```
src/
  game.js       — main game loop, state machine
  player.js     — player ship (Cobra Mk III)
  enemy.js      — enemy types (pirates, vipers, etc.)
  bullet.js     — projectile system
  ui.js         — HUD, credits, status bar
  audio.js      — sound effects and music
assets/
  sprites/      — sprite sheets
  audio/        — sound files
index.html      — entry point
style.css       — canvas/page styling
```

## Git Branching

Default branch is `master`. Merge feature branches into `master`.

## Instructions

- Always use PowerShell for terminal commands.
- Target 60fps on desktop, 30fps acceptable on mobile.
- Keep mobile-first in mind: all controls must work via touch.
- Elite flavor: ship names, faction names, systems should echo the Elite universe (Lave, Riedquat, Cobra Mk III, Viper, etc.).
