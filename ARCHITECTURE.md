# Bullet Hell — Architecture (full scope)

Top-down lane bullet-heaven survivor. **v3** (`game_v3.js`). Zero-build Canvas 2D — single HTML + monolithic JS.

## Stack

Vanilla JS, Canvas 2D API, Web Audio (procedural). No npm. Open `index.html` or static serve.

## Entry

`index.html` → `game_v3.js` (active). Legacy `game.js` (Channel Survivor) not wired.

## Architecture pattern

Monolith: `CONFIG`, classes (`Player`, `Projectile`, `Enemy`, `Pickup`, `Ally`, `Particle`), namespaces (`Game`, `UI`, `Input`, `AudioFX`), global state.

## State machine

`STATE`: `MENU` | `PLAYING` | `PAUSED` | `GAME_OVER` | `SHOP` | `SETTINGS`. Updates only when `PLAYING`.

## Game loop

`Game.loop(timestamp)` via rAF; delta capped at 0.1 s. Order: input → wave timers → entity updates → collision → draw (with screen shake).

## Gameplay systems

- **Lanes:** center main + left/right edge lanes; portrait-oriented widths in `resize()`  
- **Waves:** ~30 s active, 5 s break; boss every 5th wave; difficulty index scales HP/spawn  
- **Combat:** auto-fire multishot + pierce; enemy types basic/fast/tank/boss  
- **Edge lanes:** allies and timed special weapon pickups  
- **Meta:** `localStorage` key `bulletHellSave` — coins + permanent shop upgrades  
- **In-run:** level-up UI exists but XP flow removed in v3  

## UI

DOM screens via `UI.showScreen()`: menu, permanent upgrades shop, settings, HUD, pause, game over.

## Data

In-file constants: `UPGRADE_POOL`, wave tables, enemy defs. No external JSON.

## Docs

`bullethell-gdd.md`, `docs/adr/`.
