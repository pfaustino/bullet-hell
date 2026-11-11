# Bullet Hell

A top-down lane shooter in the browser. You hold the bottom of three lanes, the gun fires on its own, and enemies march down the center. Survive the waves, bank coins, and build a fleet of allies that fuse into larger ships.

Play the current build:

- [GitHub Pages](https://pfaustino.github.io/bullet-hell/)
- [itch.io](https://pfaustino.itch.io/bullet-hell/) (Play in browser)

Saves stay in the browser for that site. A run on GitHub Pages and a run on itch.io do not share coins, allies, or settings.

## How a run works

The ship sits near the bottom and can only move left and right. It fires straight up on its own. You start with **10 lives** and **100 HP** (more if you have bought Max Health).

- Touching an enemy deals **10 damage** and destroys that enemy.
- At 0 HP you lose a life. If any lives remain, HP refills to full.
- An enemy that exits the bottom of the screen is a **breach** and costs a life immediately.
- At 0 lives the run ends. The game-over screen shows time survived, enemies defeated, and coins earned that run.

Waves last **30 seconds**, then there is a **5 second** break before the next one. The first visit waits 3 seconds before wave 1. A saved wave starts as soon as you press continue.

## Controls

The ship does not move up or down, and there is no fire button.

| Action | Keyboard | Pointer |
| --- | --- | --- |
| Move left | `A` or `Left Arrow` | Drag left |
| Move right | `D` or `Right Arrow` | Drag right |
| Pause or resume | `Esc` | Pause button |
| Back to the pause menu | `Esc`, while the upgrades shop was opened from pause | — |
| Submit a leaderboard name | `Enter` in the name field | Submit button |

`A` and `D` are the lowercase letter keys. Caps Lock blocks them. The arrow keys still move the ship. Mouse and touch use the horizontal drag: the ship follows your pointer across the lanes.

Keyboard move speed is fixed. Dragging moves the ship by the same distance as the pointer.

## Lanes

The playfield is three vertical lanes, sized for a portrait window.

- **Center lane.** Enemies spawn here and walk downward. Your shots and your allies fight in this space.
- **Left edge.** A special weapon drifts down this lane about every **10 seconds**.
- **Right edge.** An ally drifts down this lane every **8–12 seconds**. About **1 in 10** of those is a strong ally.

Pickups fall until they enter a collection field, then fly to whoever is closest.

## Combat

The blaster starts at **15 damage**, one shot every **0.5 seconds**, one projectile, and **1 pierce**. Shots are small (radius 4). Permanent Base Damage and temporary weapons change this gun only. Ally guns do not use those bonuses.

The stats bar under the playfield shows, in order:

| Icon | Meaning |
| --- | --- |
| Heart | Lives remaining |
| People | Ally fleet (`3`, `2+1M`, `1G`, and similar) |
| Sword | Current shot damage |
| Flame | Fire-rate multiplier |
| Sparkles | Projectiles per volley |
| Bow | Pierce |

The top of the screen shows the HP bar, wave, timer, and kill count. The bottom shows banked coins and the on-screen score: `(kills × 10) + seconds survived + (wave × 50)`.

## Enemies

Enemies spawn only in the center lane. Their health grows with time survived and with the difficulty HP multiplier.

| Enemy | When it appears | Speed | Notes |
| --- | --- | --- | --- |
| Basic | Every wave | Medium | Most common |
| Fast | Wave 3 and later | Fast | Less health than a basic |
| Tank | Wave 5 and later | Slow | Much more health |
| Boss | Every 5th wave | Slowest | Huge. Always drops a large coin pile, and often a second one |

A normal kill drops a coin about **20%** of the time. A boss always drops **50** coins and has a **50%** chance to drop **30** more.

Later waves spawn more enemies, and they appear faster. The count and the gap between spawns both scale with the wave number.

## Allies

Collect an ally in the right lane and it joins the formation around your ship. Allies aim at the nearest enemy within range and fire on their own. Their damage rises slowly during the run, up to **double**, and that growth is separate from your upgrades.

| Ally | How you get it | Damage | Look |
| --- | --- | --- | --- |
| Normal | Pick up a green ally | 12 | Small green ship |
| Strong | About 1 in 10 right-lane spawns | 20 | Cyan, slightly faster fire |
| MegaAlly | **10** normal allies fuse | 120 | Larger orange ship, larger shots |
| GigaAlly | **10** MegaAllies fuse | 1200 | Largest magenta ship, largest shots |

Fusion is announced on screen. A Mega shot is wider than a normal shot, and a Giga shot is wider still.

A **GigaAlly** has a magenta ring just outside its hull. Coins, allies, and special weapons inside that ring are pulled to the GigaAlly and collected for you. Your own pickup field is a bit larger than that ring. If more than one field overlaps a pickup, the closest one wins.

The fleet is saved with the run, including which ships are strong, Mega, or Giga. The save keeps up to **200** allies.

## Special weapons

These spawn in the left lane and last for a short time on **your** gun. Picking the same one up again while it is already active does not stack a second copy of Homing. The others add their bonus for a new duration.

| Weapon | Effect | Duration |
| --- | --- | --- |
| Homing Bullets | Shots steer toward an enemy | 15 seconds |
| Rapid Fire | Adds 1.0 to the fire-rate multiplier | 12 seconds |
| Mega Damage | Adds 1.0 to the damage multiplier | 10 seconds |
| Spread Shot | Adds 3 projectiles | 15 seconds |
| Pierce Shot | Adds 3 pierce | 12 seconds |

## Difficulty

Change difficulty on the pause menu with **−** and **+**. The choice is saved, and the continue button shows it next to the wave (`CONTINUE · EASY · WAVE 4`).

| Name | Enemy HP |
| --- | --- |
| Easiest | ×1 |
| Easy | ×1.2 |
| Normal | ×1.5 |
| Hard | ×2.5 |
| Expert | ×4 |
| Insane | ×8 |

The pause menu also prints a spawn figure next to the HP multiplier. Enemy health uses the HP column above.

## Permanent upgrades

Open **Upgrades** from the main menu, or from the pause menu. Each purchase spends coins and raises that upgrade by one **rank**. The next rank costs more: base cost times `(rank + 1)`.

Coins are added to your balance as soon as you collect them. Closing the tab does not drop coins you already picked up.

| Upgrade | Effect per rank | First cost |
| --- | --- | --- |
| Max Health | +20 maximum HP, applied when a run starts | 100 |
| Base Damage | +2 blaster damage (the gun starts at 15) | 150 |
| Coin Greed | +20% coins when a coin is collected | 200 |
| XP Gain | Saved on the account. A run does not award XP, so this rank does not change combat or score | 200 |

These ranks affect your ship and your coin income. They do not change ally damage, ally fire rate, or ally shot size.

## Score and leaderboards

Two scores exist:

- **On-screen score** is the number in the HUD: kills, time, and wave added together.
- **Leaderboard score** ranks a run by wave first, then time survived, then kills. A higher wave always beats a lower wave.

The leaderboard has a **Local** list (this browser) and a **Global** list. Submit a name of up to 24 characters from the game-over screen. Quitting to the menu also records the run. If a global name is already saved, that quit is submitted. If not, the game asks for a name and you can skip.

Open the board from the main menu or from pause. It is read-only there.

## What is saved

The game stores one save in this browser (`localStorage`). A refresh or a new publish of the same site keeps it. It stores:

- Coins
- Upgrade ranks
- Difficulty
- Wave, once you have started at least wave 1
- The ally fleet (counts and which ships are strong, Mega, or Giga)
- Sound-effect volume and music volume

**Reset Game**, on the pause menu, asks for confirmation and then clears that save, local scores, and the saved leaderboard name. It returns you to a fresh Play button.

## Audio

Settings has two sliders, from the main menu or from pause.

| Slider | Default | At 0% |
| --- | --- | --- |
| SFX | 50% | Silent. Shots, hits, coins, and pickups do not play |
| Music | 30% | Muted |

Music starts after the first click or key press. Both volumes are saved.

## Running locally

```bash
npm install
npm run dev
```

The dev server is [http://localhost:5177/](http://localhost:5177/). `npm run check` runs the smoke test.

Add `?dev=1` to the URL for a small developer panel that can reload the page or clear `localStorage`. That panel is not part of the public game.
