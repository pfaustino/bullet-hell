BulletHell

High‑level concept
Working title: “Channel Survivor”

Genre: Horde survival (bullet heaven / reverse bullet hell).
​

Platform: Mobile‑first web game (HTML5, runs in browser), touch controls.

Core fantasy: Stand alone in a lane while endless monsters pour in and you become absurdly powerful through random upgrades.

Core gameplay loop
Start a run, basic weapon auto‑fires at slow rate.

Monsters spawn in waves and move down a narrow lane toward the player.

Kill monsters to gain XP and occasional coins.

On level‑up, pause and choose one of 3 random upgrades.

Survive as long as possible; when health reaches zero, the run ends and stats are shown.

Between runs, spend coins on permanent meta‑upgrades.

Player, controls, and stats
Controls:

Touch drag / virtual joystick to move left–right and slightly up–down within the lane.

Shooting is auto‑fire; no manual aim.

Player stats (per run):

Health, movement speed, weapon damage, rate of fire, projectile speed, projectile count, pickup range.

Meta‑progression stats (persistent):

+max health, +base damage, +XP gain, +coin gain, starting with one extra upgrade, etc.

Weapons and upgrades
Base weapon: Straight‑line projectile that travels up the lane and pierces a limited number of enemies.

Additional weapons (examples):

Side Blades: Short‑range slashes left and right.

Lightning Strike: Random strikes along the lane.

Orbital Orbs: Circling projectiles that damage on contact.

Level‑up upgrade types (random choices of 3):

Damage up (weapon‑specific or global).

Fire rate up.

Extra projectiles / wider spread.

Movement speed up.

Health up / regen.

New weapon unlock (once prerequisites met).

Each upgrade can have levels (e.g., “Damage +10% (1/5)”).

Enemies and waves
Enemy behaviors:

Basic grunt: Slow, low health.

Fast runner: Low health, high speed.

Tank: High health, slow.

Ranged caster (optional later): Stops mid‑lane and shoots projectiles.

Spawn system:

Time‑based waves with increasing spawn rate and mix of enemy types.

Every 2 minutes, introduce a tougher enemy type.

Periodic mini‑boss: High health enemy moving slowly down the lane.

Scaling:

Enemy health and damage increase gradually over time.

Coin and XP rewards scale slightly to keep upgrades flowing.

Win/lose and progression
Win condition: Survive to a target time (e.g., 15 minutes) for that stage.

Lose condition: Player health hits zero.

End‑of‑run screen:

Time survived, enemies killed, highest DPS weapon, coins earned, XP earned.

Buttons: “Retry”, “Upgrade base stats”, “Main menu”.

Meta systems and economy
Currencies:

Coins (from runs) used for permanent upgrades.

Optional premium currency (future): cosmetics only.

Permanent upgrade tree:

Health Track: +5% max HP per level.

Damage Track: +5% base damage per level.

Growth Track: +5% XP gain per level.

Economy Track: +5% coins gained per level.

Unlocks:

New characters with different starting weapons.

New maps (lanes with different visuals or patterns).

Visual and audio direction
Perspective: Top‑down or slightly angled lane. Player at bottom, enemies coming from top.

Style: Simple 2D art; bold silhouettes so hordes read clearly on mobile.

FX: Hit flashes, knockback, basic screen shake on damage.

Audio:

Looping music that intensifies over time.

Impactful SFX for kills, level‑ups, and picking upgrades.

UI flow
Main menu: Play, Upgrades, Settings.

In‑game HUD:

HP bar, timer, XP bar, coin counter.

Pause button.

Upgrade choice screen:

Three cards with name, short description, and value change (+10% damage, etc.).

Technical scope for Antigravity
Stack: Single‑page browser game using HTML, CSS, and JavaScript (no backend needed initially).

Devices: Must work smoothly in mobile Chrome/Safari at 60 FPS if possible.

Structure:

index.html – canvas and basic layout.

style.css – simple responsive layout.

game.js – game loop, entities, upgrade logic, waves.

assets/ – placeholder images and sounds (can be simple colored shapes or generated placeholders).