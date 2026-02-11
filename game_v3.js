/**
 * Bullet Hell - Game Logic
 * A top-down horde survival game.
 */

// --- CONFIGURATION & CONSTANTS ---
// --- CONFIGURATION & CONSTANTS ---
const CONFIG = {
    fps: 60,
    baseEnemySpawnRate: 1000,
    difficultyScale: 0.98,
    maxMainColumns: 6,  // Maximum columns in main lane
    colors: {
        player: '#00f2ff',
        bullet: '#ffe600',
        enemyBasic: '#ff2a6d',
        enemyFast: '#bd00ff',
        enemyTank: '#ff8800',
        enemyBoss: '#ff0000',
        xp: '#05ffa1',
        text: '#ffffff',
        upgrade: '#00ff00',
        laneBorder: '#ffffff20'
    },
    // Lane configuration (calculated dynamically for portrait mode)
    // Will be set in resize() based on screen width
    lanes: {
        mainHalf: 150,      // Main lane half-width (will be recalculated)
        edgeWidth: 60,      // Edge lane width (left and right)
        columnWidth: 50,    // Width per column in main lane
        actualColumns: 6    // Actual number of columns (will be recalculated)
    }
};

const UPGRADE_POOL = [
    { id: 'dmg', name: 'DAMAGE UP', icon: '⚔️', color: '#ff0055', weight: 1, apply: (p) => { p.stats.damageMult += 0.2; } },
    { id: 'spd', name: 'FIRE RATE UP', icon: '🔥', color: '#ffff00', weight: 1, apply: (p) => { p.stats.fireRateMult += 0.15; } },
    { id: 'mov', name: 'SPEED UP', icon: '⏩', color: '#00ccff', weight: 1, apply: (p) => { p.stats.speedMult += 0.1; game.speedUpsWave++; } },
    { id: 'hp', name: 'HEART', icon: '❤️', color: '#ff0066', weight: 0.8, apply: (p) => { p.maxHp += 10; p.heal(100); game.gainLife(); } },
    { id: 'cnt', name: 'MULTISHOT', icon: '✨', color: '#ffffff', weight: 0.1, apply: (p) => { if (p.weapons[0].count < 30) p.weapons[0].count++; } },
    { id: 'prc', name: 'PIERCE UP', icon: '🏹', color: '#ffaa00', weight: 0.5, apply: (p) => { if (p.weapons[0].pierce < 5) p.weapons[0].pierce++; } }
];

// Special Weapons Pool - spawns in left lane every 10 seconds
const SPECIAL_WEAPONS = [
    {
        name: "HOMING BULLETS",
        icon: "🎯",
        color: "#00ffff",
        id: "homing",
        apply: (p) => {
            // Add homing property to projectiles for 15 seconds
            if (!p.homingActive) {
                p.homingActive = true;
                p.activeSpecialWeapons.push({ id: "homing", expires: gameTime + 15 });
                setTimeout(() => {
                    p.homingActive = false;
                    p.activeSpecialWeapons = p.activeSpecialWeapons.filter(sw => sw.id !== "homing");
                }, 15000);
                Game.addNotification("HOMING BULLETS!", "#00ffff");
            }
        }
    },
    {
        name: "RAPID FIRE",
        icon: "💥",
        color: "#ff00ff",
        id: "rapid",
        apply: (p) => {
            p.stats.fireRateMult += 1.0; // Double fire rate
            p.activeSpecialWeapons.push({ id: "rapid", expires: gameTime + 12 });
            setTimeout(() => {
                p.stats.fireRateMult -= 1.0;
                p.activeSpecialWeapons = p.activeSpecialWeapons.filter(sw => sw.id !== "rapid");
            }, 12000);
            Game.addNotification("RAPID FIRE!", "#ff00ff");
        }
    },
    {
        name: "MEGA DAMAGE",
        icon: "🔥",
        color: "#ff0000",
        id: "mega",
        apply: (p) => {
            p.stats.damageMult += 1.0; // Double damage
            p.activeSpecialWeapons.push({ id: "mega", expires: gameTime + 10 });
            setTimeout(() => {
                p.stats.damageMult -= 1.0;
                p.activeSpecialWeapons = p.activeSpecialWeapons.filter(sw => sw.id !== "mega");
            }, 10000);
            Game.addNotification("MEGA DAMAGE!", "#ff0000");
        }
    },
    {
        name: "SPREAD SHOT",
        icon: "🌟",
        color: "#ffff00",
        id: "spread",
        apply: (p) => {
            const oldCount = p.weapons[0].count;
            p.weapons[0].count += 3; // Add 3 more projectiles
            p.activeSpecialWeapons.push({ id: "spread", expires: gameTime + 15, oldCount: oldCount });
            setTimeout(() => {
                p.weapons[0].count = oldCount;
                p.activeSpecialWeapons = p.activeSpecialWeapons.filter(sw => sw.id !== "spread");
            }, 15000);
            Game.addNotification("SPREAD SHOT!", "#ffff00");
        }
    },
    {
        name: "PIERCE SHOT",
        icon: "⚡",
        color: "#00ff00",
        id: "pierce",
        apply: (p) => {
            const oldPierce = p.weapons[0].pierce;
            p.weapons[0].pierce += 3; // Add 3 pierce
            p.activeSpecialWeapons.push({ id: "pierce", expires: gameTime + 12, oldPierce: oldPierce });
            setTimeout(() => {
                p.weapons[0].pierce = Math.max(1, p.weapons[0].pierce - 3);
                p.activeSpecialWeapons = p.activeSpecialWeapons.filter(sw => sw.id !== "pierce");
            }, 12000);
            Game.addNotification("PIERCE SHOT!", "#00ff00");
        }
    }
];

// --- STATE MANAGEMENT ---
const STATE = {
    MENU: 0,
    PLAYING: 1,
    PAUSED: 2,
    GAME_OVER: 3,
    SHOP: 4,
    SETTINGS: 5
};
// Removed LEVEL_UP state

let currentState = STATE.MENU;
let previousState = STATE.MENU; // For Settings navigation
let lastTime = 0;
let deltaTime = 0;
let score = 0;
let gameTime = 0;
let killCount = 0;
let coinsRun = 0;
let lives = 10;
let notifications = []; // Global notification queue

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let centerX, centerY;

// Permanent Data (Meta Progression)
// ... (saveData logic remains)
let saveData = {
    coins: 0,
    upgrades: {
        maxHealth: 0, // Level 0
        damage: 0,
        xpGain: 0,
        coinGain: 0
    }
};

// Load saved data
// Load saved data
const defaultSave = {
    coins: 0,
    upgrades: {
        maxHealth: 0,
        damage: 0,
        xpGain: 0,
        coinGain: 0
    }
};

if (localStorage.getItem('bulletHellSave')) {
    try {
        const loaded = JSON.parse(localStorage.getItem('bulletHellSave'));
        // Merge with defaults to prevent missing keys/NaN
        saveData = {
            coins: typeof loaded.coins === 'number' ? loaded.coins : 0,
            upgrades: { ...defaultSave.upgrades, ...loaded.upgrades }
        };
    } catch (e) {
        console.error('Save file corrupted, resetting.');
        saveData = JSON.parse(JSON.stringify(defaultSave));
    }
} else {
    saveData = JSON.parse(JSON.stringify(defaultSave));
}

// --- CLASSES ---

class Player {
    constructor() {
        this.reset();
    }

    reset() {
        // Safe access to upgrades (just in case)
        const ups = saveData.upgrades || { maxHealth: 0, damage: 0 };

        // Base stats + Meta upgrades
        this.maxHp = 100 + ((ups.maxHealth || 0) * 20);
        this.hp = this.maxHp;

        // Dynamic Logic Stats
        this.width = 40; // Virtual units - Increased
        this.height = 40;
        this.x = 0; // Center relative to lane center (0 is middle)
        this.y = 0; // Will be set in resize

        // Combat Stats
        this.moveSpeed = 300; // Pixels per second
        this.pickupRange = 100;

        // Multipliers (from run upgrades)
        this.stats = {
            damageMult: 1,
            fireRateMult: 1,
            speedMult: 1
        };
        
        // Special weapon states
        this.homingActive = false;

        const baseDmg = ups.damage || 0;

        // Weapon System
        this.weapons = [
            {
                id: 'basic_blaster',
                fireTimer: 0,
                cooldown: 0.5,
                damage: 15 + (baseDmg * 2), // Buffed starting damage to 15
                projectileSpeed: 600,
                count: 1,
                pierce: 1,
                update: (dt, owner) => {
                    // Update this specific weapon state
                    const w = owner.weapons[0];
                    w.fireTimer -= dt;
                    if (w.fireTimer <= 0) {
                        owner.shootBasic(w);
                        w.fireTimer = Math.max(0.1, w.cooldown / owner.stats.fireRateMult);
                    }
                }
            }
        ];

        // Special Weapons (temporary power-ups)
        this.specialWeapons = [];
        this.activeSpecialWeapons = []; // Track active special weapons with timers

        // Allies (companion ships)
        this.allies = [];

        // Experience
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 100;
    }

    update(dt) {
        // Movement is handled by input directly influencing x/y for instant feel
        // But we apply boundary checks here
        // Always 3-lane mode: Left Edge, Main, Right Edge
        // Main lane: [-mainHalf, +mainHalf]
        // Left edge: [-mainHalf - edgeWidth, -mainHalf]
        // Right edge: [+mainHalf, +mainHalf + edgeWidth]
        const mainHalf = CONFIG.lanes.mainHalf;
        const edgeWidth = CONFIG.lanes.edgeWidth;
        
        const minX = -mainHalf - edgeWidth + (this.width / 2);
        const maxX = mainHalf + edgeWidth - (this.width / 2);

        // Clamp player position to 3-lane bounds
        if (this.x < minX) this.x = minX;
        if (this.x > maxX) this.x = maxX;

        // Update Weapons
        this.weapons.forEach(w => w.update(dt, this));
        
        // Update Special Weapons
        this.specialWeapons.forEach(sw => {
            if (sw.update) sw.update(dt, this);
        });
        
        // Update Allies
        this.allies.forEach((ally, index) => {
            ally.formationAngle = (index / Math.max(1, this.allies.length)) * Math.PI * 2;
            ally.update(dt, this);
        });
    }

    shootBasic(weapon) {
        // Fire logic
        AudioFX.shoot(); // Sound
        const offsetStep = 10;
        const totalWidth = (weapon.count - 1) * offsetStep;
        let startX = this.x - (totalWidth / 2);

        for (let i = 0; i < weapon.count; i++) {
            const proj = new Projectile(
                startX + (i * offsetStep),
                this.y - 20,
                weapon.damage * this.stats.damageMult,
                weapon.projectileSpeed,
                weapon.pierce
            );
            // Add homing property if active
            if (this.homingActive) {
                proj.isHoming = true;
            }
            // Check if Mega Damage is active
            const hasMega = this.activeSpecialWeapons.some(sw => sw.id === "mega");
            if (hasMega) {
                proj.isMega = true;
            }
            game.projectiles.push(proj);
        }
    }

    gainXp(amount) {
        // Renamed concept: now just 'Score' or unused logic if XP drops are gone.
        // But if 'gainXp' is called by something else, let's keep it safe.
        // Since XP orbs are removed, this might not be called.
        // If it is called, just add to score.
        this.xp += amount;
        UI.updateHUD();
    }

    // Removed levelUp() method

    heal(amount) {
        this.hp = Math.min(this.hp + amount, this.maxHp);
        // Visual heal
        game.addNotification("HEAL", "#00ff66");
        UI.updateHUD();
    }

    takeDamage(amount) {
        this.hp -= amount;
        UI.updateHUD();
        // Visual shake?
        game.shake = 5;
        if (this.hp <= 0) {
            game.loseLife();
            // Reset HP if still alive
            if (lives > 0) {
                this.hp = this.maxHp;
                game.addNotification("HEART LOST!", "#ff0000", "big");
                // Clear nearby enemies to prevent instant death loop?
                game.enemies.forEach(e => {
                    if (Math.abs(e.y - this.y) < 300) e.die();
                });
            }
        }
    }

    draw(ctx) {
        // Draw Player Ship (Glowing Circle for maximum visibility)
        const screenX = centerX + this.x;
        const screenY = this.y;

        // Glow
        ctx.shadowBlur = 30;
        ctx.shadowColor = CONFIG.colors.player; // Cyan
        ctx.fillStyle = CONFIG.colors.player;

        ctx.beginPath();
        // Draw a triangle ship but LARGER
        ctx.moveTo(screenX, screenY - 30); // Top
        ctx.lineTo(screenX + 25, screenY + 25); // Bottom Right
        ctx.lineTo(screenX, screenY + 15); // Inner Bottom
        ctx.lineTo(screenX - 25, screenY + 25); // Bottom Left
        ctx.closePath();
        ctx.fill();

        // Inner Core (White)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Add bright white border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

class Projectile {
    constructor(x, y, damage, speed, pierce, angle = -Math.PI / 2) {
        this.x = x;
        this.y = y;
        this.damage = damage;
        this.speed = speed;
        this.pierce = pierce;
        this.angle = angle; // Direction angle (default: straight up)
        this.radius = 4;
        this.markedForDeletion = false;
        this.hitList = []; // Enemies already hit
        this.isHoming = false; // Homing bullets
        this.homingTarget = null;
    }

    update(dt) {
        // Homing logic
        if (this.isHoming && !this.homingTarget) {
            // Find nearest enemy
            let nearest = null;
            let minDist = Infinity;
            
            if (Game && Game.enemies) {
                Game.enemies.forEach(e => {
                    const dx = e.x - this.x;
                    const dy = e.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < minDist && dist < 600) { // Max homing range
                        minDist = dist;
                        nearest = e;
                    }
                });
            }
            
            if (nearest) {
                this.homingTarget = nearest;
            }
        }
        
        // Update homing target angle
        if (this.isHoming && this.homingTarget && !this.homingTarget.markedForDeletion) {
            const dx = this.homingTarget.x - this.x;
            const dy = this.homingTarget.y - this.y;
            const targetAngle = Math.atan2(dy, dx);
            
            // Smoothly rotate towards target (homing strength)
            const turnSpeed = 8.0; // How fast it turns
            let angleDiff = targetAngle - this.angle;
            
            // Normalize angle difference
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            this.angle += angleDiff * turnSpeed * dt;
        } else if (this.isHoming && this.homingTarget && this.homingTarget.markedForDeletion) {
            this.homingTarget = null; // Target destroyed, find new one
        }
        
        // Move in direction
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;
        
        // Remove if off screen
        if (this.y < -50 || this.y > canvas.height + 50 || 
            this.x < -canvas.width/2 || this.x > canvas.width/2) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        const screenX = centerX + this.x;
        
        if (this.isMega) {
            // Mega bullets: Larger, red/orange color, more glow
            const megaRadius = this.radius * 1.8;
            const megaColor = '#ff4400'; // Red-orange
            
            // Outer glow
            ctx.shadowBlur = 25;
            ctx.shadowColor = megaColor;
            ctx.fillStyle = megaColor;
            ctx.beginPath();
            ctx.arc(screenX, this.y, megaRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner bright core
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(screenX, this.y, megaRadius * 0.6, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.pierce > 1) {
            // Piercing bullets: Blue/cyan color with electric effect
            const pierceRadius = this.radius * 1.3;
            const pierceColor = '#00ffff'; // Cyan
            
            // Outer glow with pulsing effect
            const pulse = 1 + (Math.sin(gameTime * 10 + this.x * 0.1) * 0.2);
            ctx.shadowBlur = 15 * pulse;
            ctx.shadowColor = pierceColor;
            ctx.fillStyle = pierceColor;
            ctx.beginPath();
            ctx.arc(screenX, this.y, pierceRadius * pulse, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner bright white core
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(screenX, this.y, pierceRadius * 0.4, 0, Math.PI * 2);
            ctx.fill();
            
            // Add small electric sparks around it
            ctx.strokeStyle = '#88ffff';
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                const angle = (gameTime * 5 + i * Math.PI * 2 / 3) % (Math.PI * 2);
                const sparkX = screenX + Math.cos(angle) * pierceRadius * 1.2;
                const sparkY = this.y + Math.sin(angle) * pierceRadius * 1.2;
                ctx.beginPath();
                ctx.moveTo(screenX, this.y);
                ctx.lineTo(sparkX, sparkY);
                ctx.stroke();
            }
        } else {
            // Normal bullets
            ctx.fillStyle = CONFIG.colors.bullet;
            ctx.shadowBlur = 10;
            ctx.shadowColor = CONFIG.colors.bullet;
            ctx.beginPath();
            ctx.arc(screenX, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
}

class Enemy {
    constructor(type) {
        this.type = type;
        this.radius = 15;
        // Random horizontal position within MAIN lane only (not edge lanes)
        const mainLaneHalf = CONFIG.lanes.mainHalf - 20; // Leave margin from edges
        this.x = (Math.random() * mainLaneHalf * 2) - mainLaneHalf;
        this.y = -50;

        this.markedForDeletion = false;

        // Type stats - DRASTICALLY REDUCED SCALING
        // gameTime is seconds.
        const diff = DIFFICULTY_LEVELS[difficultyIndex];
        const hpMult = diff.hpMult;

        // Reverted Speed Scaling

        if (type === 'fast') {
            this.hp = ((10 + (gameTime * 1.0)) * hpMult) / 2; // Half health
            this.speed = 150;
            this.color = CONFIG.colors.enemyFast;
            this.radius = 12;
            this.xpValue = 15;
            this.icon = '⚡';
        } else if (type === 'tank') {
            this.hp = ((100 + (gameTime * 5.0)) * hpMult) / 2; // Half health
            this.speed = 40;
            this.color = CONFIG.colors.enemyTank;
            this.radius = 25;
            this.xpValue = 50;
            this.icon = '👹';
        } else if (type === 'boss') {
            // Boss: 5x size, 5x base HP but with reduced time scaling to keep it killable
            // Formula: 5x tank base HP, but only 2x time scaling to prevent it from becoming unkillable
            this.hp = ((500 + (gameTime * 10.0)) * hpMult) / 2; // 5x tank base, 2x time scaling
            this.speed = 30; // Slower than tank
            this.color = CONFIG.colors.enemyBoss;
            this.radius = 125; // 5x tank radius (25 * 5)
            this.xpValue = 250; // 5x tank XP value
            this.icon = '👑';
        } else { // Basic
            this.hp = ((20 + (gameTime * 2.0)) * hpMult) / 2; // Half health
            this.speed = 80;
            this.color = CONFIG.colors.enemyBasic;
            this.xpValue = 10;
            this.icon = '👾';
        }
    }

    update(dt) {
        this.y += this.speed * dt;

        // Remove if off screen bottom
        if (this.y > canvas.height + 50) {
            this.markedForDeletion = true;
            // Life Lost Mechanic
            game.loseLife();
            game.addNotification("BREACH!", "#ff0000");
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
        } else {
            // Flash effect could go here
        }
    }

    die() {
        this.markedForDeletion = true;
        killCount++;

        AudioFX.explode(); // Sound
        
        // Boss gets bigger explosion
        const explosionCount = this.type === 'boss' ? 50 : 20;
        const explosionSpeed = this.type === 'boss' ? 500 : 300;
        game.spawnExplosion(this.x, this.y, this.color, explosionCount, explosionSpeed);

        // Boss drops more coins
        const roll = Math.random();
        if (this.type === 'boss') {
            // Boss always drops coins, and more of them
            game.pickups.push(new Pickup(this.x, this.y, 50, 'coin'));
            if (roll < 0.5) {
                game.pickups.push(new Pickup(this.x, this.y, 30, 'coin'));
            }
        } else if (roll < 0.20) {
            game.pickups.push(new Pickup(this.x, this.y, 10, 'coin'));
        }
    }

    draw(ctx) {
        const screenX = centerX + this.x;

        ctx.font = `${this.radius * 2}px Arial`; // Scale emoji
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadow/Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        // Wobble animation
        // const wobble = Math.sin(gameTime * 10 + this.x) * 5;
        // ctx.fillText(this.icon, screenX + wobble, this.y);

        ctx.fillText(this.icon, screenX, this.y);

        ctx.shadowBlur = 0;
    }
}

class Pickup {
    constructor(x, y, amount, type, data = null) {
        this.x = x;
        this.y = y;
        this.amount = amount;
        this.type = type; // 'upgrade', 'coin', 'ally', 'special_weapon', 'strong_ally'
        this.data = data; // Upgrade object or ally data
        this.radius = type === 'upgrade' || type === 'ally' || type === 'strong_ally' || type === 'special_weapon' ? 15 : 6;
        this.markedForDeletion = false;
        this.magnetized = false;
        this.isStrongAlly = type === 'strong_ally';
        this.color = type === 'upgrade' ? (data ? data.color : '#00ff00') : 
                     type === 'ally' || type === 'strong_ally' ? '#00ff88' :
                     type === 'special_weapon' ? '#ff00ff' : '#ffee00';
    }

    update(dt, player) {
        if (this.markedForDeletion) return;

        // Magnet check
        const dx = this.x - player.x;
        const dy = this.y - player.y;

        const distSq = (dx * dx) + (dy * dy);

        if (distSq < player.pickupRange * player.pickupRange) {
            this.magnetized = true;
        }

        if (this.magnetized) {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            const speed = 500; // Move fast to player
            this.x += Math.cos(angle) * speed * dt;
            this.y += Math.sin(angle) * speed * dt;

            const collectedDistSq = 900; // 30px distance
            const distToPlayerSq = Math.pow(this.x - player.x, 2) + Math.pow(this.y - player.y, 2);

            if (distToPlayerSq < collectedDistSq) {
                if (this.type === 'upgrade') {
                    // Apply Upgrade Immediately
                    this.data.apply(player);
                    // Notify
                    Game.addNotification(this.data.name, this.data.color);
                    AudioFX.powerup(); // Sound
                } else if (this.type === 'ally' || this.type === 'strong_ally') {
                    // Add ally ship (limit to 30 allies to balance performance and progression)
                    const MAX_ALLIES = 30;
                    if (player.allies.length < MAX_ALLIES) {
                        const newAlly = new Ally(player.x, player.y, this.isStrongAlly);
                        player.allies.push(newAlly);
                        Game.addNotification(this.isStrongAlly ? "STRONG ALLY JOINED!" : "ALLY JOINED!", "#00ff88");
                        AudioFX.powerup();
                    } else {
                        // Already at max - give coins instead
                        coinsRun += 10;
                        Game.addNotification("MAX ALLIES!\n+10 COINS", "#00ff88");
                        AudioFX.playTone(800, 'sine', 0.05, 0.05);
                    }
                } else if (this.type === 'special_weapon') {
                    // Add special weapon (temporary)
                    if (this.data && this.data.apply) {
                        this.data.apply(player);
                        Game.addNotification(this.data.name || "SPECIAL WEAPON!", "#ff00ff");
                        AudioFX.powerup();
                    }
                } else {
                    // Coin
                    const mult = 1 + (saveData.upgrades.coinGain * 0.2);
                    const val = Math.ceil(this.amount * mult);
                    coinsRun += val;
                    UI.updateHUD();
                    AudioFX.playTone(800, 'sine', 0.05, 0.05); // Coin sound
                }
                this.markedForDeletion = true;
            }
        }

        this.y += 150 * dt; // Fall down the lane FASTER
    }

    draw(ctx) {
        const screenX = centerX + this.x;

        if (this.type === 'upgrade') {
            // Draw Floating Emoji
            const size = 30;
            const pulse = 1 + (Math.sin(gameTime * 5) * 0.2);

            ctx.translate(screenX, this.y);
            ctx.scale(pulse, pulse);

            ctx.shadowBlur = 20;
            ctx.shadowColor = this.color;

            ctx.font = `${size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const icon = this.data.icon || '💎';
            ctx.fillText(icon, 0, 0);

            ctx.shadowBlur = 0;
            ctx.scale(1 / pulse, 1 / pulse);
            ctx.translate(-screenX, -this.y);

        } else if (this.type === 'ally' || this.type === 'strong_ally') {
            // Draw ally ship icon
            const size = 25;
            const pulse = 1 + (Math.sin(gameTime * 4) * 0.15);
            
            ctx.translate(screenX, this.y);
            ctx.scale(pulse, pulse);
            
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
            ctx.fillStyle = this.color;
            
            // Draw small ship shape
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.6);
            ctx.lineTo(size * 0.5, size * 0.5);
            ctx.lineTo(0, size * 0.3);
            ctx.lineTo(-size * 0.5, size * 0.5);
            ctx.closePath();
            ctx.fill();
            
            ctx.shadowBlur = 0;
            ctx.scale(1 / pulse, 1 / pulse);
            ctx.translate(-screenX, -this.y);
            
        } else if (this.type === 'special_weapon') {
            // Draw special weapon icon
            const size = 30;
            const pulse = 1 + (Math.sin(gameTime * 6) * 0.25);
            
            ctx.translate(screenX, this.y);
            ctx.scale(pulse, pulse);
            
            ctx.shadowBlur = 25;
            ctx.shadowColor = this.data ? this.data.color : this.color;
            
            ctx.font = `${size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.data ? this.data.icon : '⚡', 0, 0);
            
            ctx.shadowBlur = 0;
            ctx.scale(1 / pulse, 1 / pulse);
            ctx.translate(-screenX, -this.y);
            
        } else {
            // Coin
            const size = 20;
            ctx.font = `${size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#ffee00';
            ctx.fillText('🪙', screenX, this.y);
            ctx.shadowBlur = 0;
        }
    }
}

class Ally {
    constructor(x, y, isStrong = false) {
        this.x = x;
        this.y = y;
        this.isStrong = isStrong;
        this.radius = isStrong ? 20 : 15;
        this.width = isStrong ? 35 : 30;
        this.height = isStrong ? 35 : 30;
        
        // Combat stats
        this.fireTimer = 0;
        this.cooldown = isStrong ? 0.3 : 0.4;
        this.damage = isStrong ? 20 : 12;
        this.projectileSpeed = 600;
        
        // Formation position relative to player
        this.formationOffset = 0; // Will be set when added
        this.formationAngle = 0; // For circular formation
    }

    update(dt, player) {
        // Position relative to player in formation
        const formationRadius = 60;
        const angle = this.formationAngle + (gameTime * 0.5); // Slow rotation
        this.x = player.x + Math.cos(angle) * formationRadius;
        this.y = player.y + Math.sin(angle) * formationRadius;
        
        // Auto-attack nearest enemy
        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
            const nearestEnemy = this.findNearestEnemy();
            if (nearestEnemy) {
                this.shoot(nearestEnemy);
                this.fireTimer = this.cooldown;
            }
        }
    }

    findNearestEnemy() {
        let nearest = null;
        let minDist = Infinity;
        
        if (Game && Game.enemies) {
            Game.enemies.forEach(e => {
                const dx = e.x - this.x;
                const dy = e.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist && dist < 800) { // Max range
                    minDist = dist;
                    nearest = e;
                }
            });
        }
        
        return nearest;
    }

    shoot(target) {
        AudioFX.shoot();
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const angle = Math.atan2(dy, dx);
        
        // Scale ally damage with gameTime to keep them relevant as enemies get stronger
        // Base damage increases by 1% per 10 seconds of gameTime (capped at 2x)
        const timeScale = Math.min(2.0, 1.0 + (gameTime * 0.001)); // 1% per 10 seconds
        const scaledDamage = this.damage * timeScale;
        
        if (Game && Game.projectiles) {
            Game.projectiles.push(new Projectile(
                this.x,
                this.y,
                scaledDamage,
                this.projectileSpeed,
                1,
                angle // Direction
            ));
        }
    }

    draw(ctx) {
        const screenX = centerX + this.x;
        const screenY = this.y;
        
        // Draw ally ship (smaller version of player ship)
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.isStrong ? '#00ffff' : '#00ff88';
        ctx.fillStyle = this.isStrong ? '#00ffff' : '#00ff88';
        
        ctx.beginPath();
        ctx.moveTo(screenX, screenY - (this.height * 0.6));
        ctx.lineTo(screenX + (this.width * 0.5), screenY + (this.height * 0.5));
        ctx.lineTo(screenX, screenY + (this.height * 0.3));
        ctx.lineTo(screenX - (this.width * 0.5), screenY + (this.height * 0.5));
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
}

class Particle {
    constructor(x, y, color, speedFn, sizeFn) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = speedFn ? speedFn() : (Math.random() * 100 + 50);
        this.life = 1.0; // Scaled life
        this.decay = Math.random() * 0.03 + 0.02;
        this.size = sizeFn ? sizeFn() : (Math.random() * 3 + 1);
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
    }

    update(dt) {
        this.life -= this.decay * (dt * 60);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.95; // Friction
        this.vy *= 0.95;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const screenX = centerX + this.x;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(screenX, this.y, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

const AudioFX = {
    ctx: null,
    sfxVolume: 0.5, // Default 50%
    musicVolume: 0.3, // Default 30%
    musicTrack: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            // Setup Music
            this.musicTrack = new Audio('audio/arms-ready-443024.mp3');
            this.musicTrack.loop = true;
            this.updateMusicVolume();
        }
    },

    startMusic() {
        if (this.musicTrack) {
            this.musicTrack.play().catch(e => console.log("Music play blocked until interaction"));
        }
    },

    updateMusicVolume() {
        if (this.musicTrack) {
            this.musicTrack.volume = this.musicVolume;
        }
    },

    playTone(freq, type, duration, vol = 0.1) {
        if (!this.ctx) this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        // Apply global volume
        const finalVol = vol * this.sfxVolume;

        gain.gain.setValueAtTime(finalVol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    shoot() { this.playTone(400, 'square', 0.1, 0.05); },
    hit() { this.playTone(150, 'sawtooth', 0.1, 0.05); },
    explode() {
        // Noise sim (random freq ramps)
        this.playTone(100, 'sawtooth', 0.2, 0.1);
        setTimeout(() => this.playTone(50, 'square', 0.2, 0.1), 50);
    },
    damage() {
        this.playTone(150, 'sawtooth', 0.5, 0.2);
        this.playTone(100, 'sawtooth', 0.5, 0.2);
    },
    powerup() {
        this.playTone(600, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(900, 'sine', 0.2, 0.1), 100);
    }
};

// --- SYSTEMS ---

const Input = {
    x: 0,
    isDown: false,

    init() {
        // Touch
        canvas.addEventListener('touchstart', (e) => this.handleStart(e.touches[0].clientX));
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleMove(e.touches[0].clientX);
        }, { passive: false });
        canvas.addEventListener('touchend', () => this.handleEnd());

        // Mouse
        canvas.addEventListener('mousedown', (e) => this.handleStart(e.clientX));
        window.addEventListener('mousemove', (e) => {
            if (this.isDown) this.handleMove(e.clientX);
        });
        window.addEventListener('mouseup', () => this.handleEnd());

        // Keyboard (Bonus)
        this.keys = {};
        window.addEventListener('keydown', e => this.keys[e.key] = true);
        window.addEventListener('keyup', e => this.keys[e.key] = false);
    },

    handleStart(clientX) {
        if (currentState !== STATE.PLAYING) return;
        this.isDown = true;
        this.lastClientX = clientX;
    },

    handleMove(clientX) {
        if (!this.isDown) return;
        const delta = clientX - this.lastClientX;
        game.player.x += delta;
        this.lastClientX = clientX;
    },

    handleEnd() {
        this.isDown = false;
    },

    update(dt) {
        // Keyboard support
        const speed = 400 * dt;
        if (this.keys['ArrowLeft'] || this.keys['a']) game.player.x -= speed;
        if (this.keys['ArrowRight'] || this.keys['d']) game.player.x += speed;

        // Pause Toggle
        if (this.keys['Escape']) {
            // Debounce check needed? simpler: only trigger on 'down' event not 'pressed'
            // We'll handle it in keydown listener for proper toggle
        }
    }
};

// Add raw keydown handler to Input for non-continuous actions
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') UI.togglePause();
});

const UI = {
    screens: {
        menu: document.getElementById('main-menu'),
        hud: document.getElementById('hud'),
        pause: document.getElementById('pause-menu'),
        // levelUp removed
        gameOver: document.getElementById('game-over-screen'),
        upgrades: document.getElementById('upgrades-menu'),
        settings: document.getElementById('settings-menu')
    },

    elements: {
        hpBar: document.getElementById('hp-bar-fill'),
        lvlText: document.getElementById('level-indicator'),
        timer: document.getElementById('timer'),
        coins: document.getElementById('game-coins'),
        kills: document.getElementById('kill-count'),
        lives: document.getElementById('lives-count'),
        menuCoins: document.getElementById('menu-coins'),
        shopCoins: document.getElementById('shop-coins'),
        goTime: document.getElementById('go-time'),
        goKills: document.getElementById('go-kills'),
        goCoins: document.getElementById('go-coins'),
        statBox: document.getElementById('stat-debug-box') // Cache it!
    },

    // ...

    updateHUD() {
        const p = game.player;
        const hpPct = (p.hp / p.maxHp) * 100;
        this.elements.hpBar.style.width = `${hpPct}%`;

        // Build active special weapons list from tracked active weapons
        let activeSpecials = [];
        // Clean up expired special weapons
        p.activeSpecialWeapons = p.activeSpecialWeapons.filter(sw => sw.expires > gameTime);
        
        // Map active special weapons to display
        const specialMap = {
            "homing": "🎯 HOMING",
            "rapid": "💥 RAPID FIRE",
            "mega": "🔥 MEGA DMG",
            "spread": "🌟 SPREAD SHOT",
            "pierce": "⚡ PIERCE SHOT"
        };
        
        p.activeSpecialWeapons.forEach(sw => {
            if (specialMap[sw.id]) {
                activeSpecials.push(specialMap[sw.id]);
            }
        });
        
        const baseDmg = 15;

        const currentWave = (game && game.currentWave !== undefined) ? game.currentWave : 0;
        
        // Update wave display at top
        const waveDisplay = document.getElementById('wave-display');
        if (waveDisplay) {
            waveDisplay.textContent = `WAVE ${currentWave}`;
        }
        
        // Build 1-row layout: All stats + special weapons in single row
        const statsPart = `❤️ ${lives} | 👥 ${p.allies.length} | ⚔️ ${(baseDmg * p.stats.damageMult).toFixed(1)} | 🔥 x${p.stats.fireRateMult.toFixed(2)} | ✨ ${p.weapons[0].count} | 🏹 ${p.weapons[0].pierce}`;
        let specialsPart = '';
        if (activeSpecials.length > 0) {
            // Wrap special weapons in spans with class for styling
            const specialsHtml = activeSpecials.map(s => `<span class="special-weapon">${s}</span>`).join(' | ');
            specialsPart = ` | ${specialsHtml}`;
        }
        const singleRow = statsPart + specialsPart;

        // Update stats box using cached element - 1-row layout, full lane width
        if (this.elements.statBox) {
            // Create 1-row layout
            this.elements.statBox.innerHTML = `<div class="stat-row">${singleRow}</div>`;
            
            // Set width to full lane width (main lane + edge lanes)
            const mainLaneWidth = (CONFIG.lanes.mainHalf * 2) + (CONFIG.lanes.edgeWidth * 2);
            const fullLaneWidth = Math.min(mainLaneWidth + 20, window.innerWidth - 20); // Lane width + small padding
            this.elements.statBox.style.width = `${fullLaneWidth}px`;
            this.elements.statBox.style.maxWidth = `${fullLaneWidth}px`;
            this.elements.statBox.style.left = '50%';
            this.elements.statBox.style.transform = 'translateX(-50%)';
        } else {
            // Retry fetch if missed (racing condition safe)
            this.elements.statBox = document.getElementById('stat-debug-box');
        }

        // Update score: kills * 10 + time survived (seconds) + wave bonus
        const calculatedScore = (killCount * 10) + Math.floor(gameTime) + (currentWave * 50);
        
        const levelSpan = document.getElementById('level-indicator');
        if (levelSpan) {
            levelSpan.innerText = calculatedScore;
        }

        this.elements.coins.textContent = coinsRun;
        this.elements.kills.textContent = `💀 ${killCount}`;

        // Hide old lives counter
        if (this.elements.lives) this.elements.lives.style.display = 'none';

        // Timer format
        const totalSec = Math.floor(gameTime);
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        this.elements.timer.textContent = `${m}:${s}`;

        // Debug: Prove new JS is active
        this.elements.timer.style.color = '#ff00ff'; // MAGENTA v3
    },

    showScreen(name) {
        // Hide all screens except HUD (which is an overlay during gameplay)
        Object.entries(this.screens).forEach(([key, s]) => {
            if (key === 'hud') return; // Don't touch HUD here
            s.classList.remove('active');
            s.classList.add('hidden');
        });

        if (name && this.screens[name]) {
            this.screens[name].classList.remove('hidden');
            this.screens[name].classList.add('active');
        }

        // Show HUD during gameplay states
        if (currentState === STATE.PLAYING || currentState === STATE.PAUSED || currentState === STATE.SETTINGS) {
            // Only show HUD if we're in a game session (not returning to main menu)
            if (name !== 'menu' && name !== 'upgrades' && name !== 'gameOver') {
                this.screens.hud.classList.remove('hidden');
                this.screens.hud.classList.add('active');
            }
        }
    },

    togglePause() {
        if (currentState === STATE.PLAYING) {
            currentState = STATE.PAUSED;
            this.screens.pause.classList.remove('hidden');
            this.screens.pause.classList.add('active');
        } else if (currentState === STATE.PAUSED) {
            currentState = STATE.PLAYING;
            this.screens.pause.classList.add('hidden');
            this.screens.pause.classList.remove('active');
        }
    },

    // Duplicate updateHUD removed


    renderShop() {
        const list = document.getElementById('upgrades-list');
        list.innerHTML = '';

        const upgrades = [
            { id: 'maxHealth', name: 'Max Health', desc: '+20 HP', costBase: 100 },
            { id: 'damage', name: 'Base Damage', desc: '+2 Damage', costBase: 150 },
            { id: 'xpGain', name: 'XP Gain', desc: '+10% XP', costBase: 200 },
            { id: 'coinGain', name: 'Coin Greed', desc: '+20% Coins', costBase: 200 },
        ];

        upgrades.forEach(u => {
            const currentLvl = saveData.upgrades[u.id] || 0;
            const cost = u.costBase * (currentLvl + 1); // Simple scaling

            const item = document.createElement('div');
            item.className = 'shop-item';
            item.innerHTML = `
                <div class="shop-info">
                    <h3>${u.name} (Lvl ${currentLvl})</h3>
                    <p>${u.desc} - Per Level</p>
                </div>
                <button class="buy-btn" onclick="game.buyUpgrade('${u.id}', ${cost})">
                    ${cost} 🪙
                </button>
            `;
            // Disable if too expensive
            const btn = item.querySelector('button');
            if (saveData.coins < cost) {
                btn.disabled = true;
                btn.textContent = `Need ${cost}`;
            }
            list.appendChild(item);
        });

        this.elements.shopCoins.textContent = saveData.coins;
    }
};

const DIFFICULTY_LEVELS = [
    { name: "LEVEL 1", desc: "Easiest", hpMult: 1.0, spawnMult: 1.0 },
    { name: "LEVEL 2", desc: "Easy", hpMult: 1.2, spawnMult: 1.5 },
    { name: "LEVEL 3", desc: "Normal", hpMult: 1.5, spawnMult: 2.2 },
    { name: "LEVEL 4", desc: "Hard", hpMult: 2.5, spawnMult: 4.0 },
    { name: "LEVEL 5", desc: "Expert", hpMult: 4.0, spawnMult: 6.0 },
    { name: "LEVEL 6", desc: "INSANE", hpMult: 8.0, spawnMult: 12.0 }
];

let difficultyIndex = 0; // Default 0 (Level 1)

const Game = {
    player: null,
    enemies: [],
    projectiles: [],
    pickups: [],
    particles: [],
    enemySpawnTimer: 0,
    allySpawnTimer: 0, // For ally ships in right lane
    specialWeaponTimer: 0, // For special weapons in left lane (every 10s)
    waveBreakTimer: 0, // Break between waves
    currentWave: 0,
    isWaveActive: false,
    shake: 0,

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Init Audio on first interaction
        const startAudio = () => {
            AudioFX.init();
            AudioFX.startMusic();
        };
        window.addEventListener('click', startAudio, { once: true });
        window.addEventListener('keydown', startAudio, { once: true });

        this.player = new Player();
        Input.init();

        // Bind UI buttons
        document.getElementById('btn-play').onclick = () => this.startRun();
        document.getElementById('btn-upgrades').onclick = () => {
            UI.renderShop();
            UI.showScreen('upgrades');
            currentState = STATE.SHOP;
        };
        document.getElementById('btn-settings').onclick = () => {
            previousState = currentState;
            UI.showScreen('settings');
            currentState = STATE.SETTINGS;
        };
        document.getElementById('btn-back-main').onclick = () => UI.showScreen('menu');
        document.getElementById('btn-back-settings').onclick = () => {
            // Return to where we came from
            if (previousState === STATE.PAUSED) {
                UI.showScreen('pause');
                currentState = STATE.PAUSED;
            } else {
                UI.showScreen('menu');
                currentState = STATE.MENU;
            }
        };

        // Settings Listeners
        const sfxSlider = document.getElementById('vol-sfx');
        const sfxVal = document.getElementById('vol-sfx-val');
        sfxSlider.oninput = (e) => {
            const v = e.target.value;
            AudioFX.sfxVolume = v / 100;
            sfxVal.textContent = `${v}%`;
            // Test sound (debounced ideally, but okay for direct feedback)
            // AudioFX.playTone(400, 'sine', 0.1, 0.1); 
        };
        // Init SFX Slider logic
        sfxSlider.value = AudioFX.sfxVolume * 100;
        sfxVal.textContent = `${sfxSlider.value}%`;

        const musicSlider = document.getElementById('vol-music');
        const musicVal = document.getElementById('vol-music-val');
        musicSlider.oninput = (e) => {
            const v = e.target.value;
            AudioFX.musicVolume = v / 100;
            AudioFX.updateMusicVolume();
            musicVal.textContent = `${v}%`;
        };
        // Init Music Slider logic (Sync with default)
        musicSlider.value = AudioFX.musicVolume * 100;
        musicVal.textContent = `${musicSlider.value}%`;

        document.getElementById('btn-pause').onclick = () => UI.togglePause();
        document.getElementById('btn-resume').onclick = () => UI.togglePause();
        document.getElementById('btn-settings-pause').onclick = () => {
            previousState = STATE.PAUSED;
            UI.showScreen('settings');
            currentState = STATE.SETTINGS;
        };
        document.getElementById('btn-quit').onclick = () => this.quitToMenu();

        // Difficulty Buttons
        document.getElementById('btn-diff-up').onclick = () => this.changeDifficulty(1);
        document.getElementById('btn-diff-down').onclick = () => this.changeDifficulty(-1);
        this.updateDifficultyDisplay(); // Init text

        document.getElementById('btn-retry').onclick = () => this.startRun();
        document.getElementById('btn-menu').onclick = () => this.quitToMenu();

        // Main Loop Start
        requestAnimationFrame(t => this.loop(t));

        // Refresh Menu
        UI.elements.menuCoins.innerText = saveData.coins;
    },

    changeDifficulty(dir) {
        difficultyIndex += dir;
        if (difficultyIndex < 0) difficultyIndex = 0;
        if (difficultyIndex >= DIFFICULTY_LEVELS.length) difficultyIndex = DIFFICULTY_LEVELS.length - 1;
        this.updateDifficultyDisplay();
    },


    updateDifficultyDisplay() {
        const d = DIFFICULTY_LEVELS[difficultyIndex];
        document.getElementById('diff-display').textContent = d.name;
        document.getElementById('diff-desc').textContent = `${d.desc} (HP x${d.hpMult}, Spawn x${d.spawnMult})`;
    },

    resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        centerX = canvas.width / 2;
        centerY = canvas.height / 2;

        // Calculate lane dimensions for portrait mode
        // Ensure main lane fits max 6 columns, with edge lanes on sides
        const screenWidth = canvas.width;
        const edgeWidth = CONFIG.lanes.edgeWidth;
        const columnWidth = CONFIG.lanes.columnWidth;
        const maxMainWidth = CONFIG.maxMainColumns * columnWidth;
        
        // Calculate available width for main lane (leave padding on sides)
        const padding = 20; // Padding from screen edges
        const availableWidth = Math.max(0, screenWidth - (edgeWidth * 2) - (padding * 2));
        
        // Main lane width is the smaller of: available width or max width for 6 columns
        const mainWidth = Math.min(availableWidth, maxMainWidth);
        CONFIG.lanes.mainHalf = Math.max(50, mainWidth / 2); // Minimum 50px half-width
        
        // Recalculate actual number of columns that fit
        const actualColumns = Math.floor((CONFIG.lanes.mainHalf * 2) / columnWidth);
        CONFIG.lanes.actualColumns = Math.min(Math.max(1, actualColumns), CONFIG.maxMainColumns);

        if (this.player) {
            // Move player up to avoid bottom browser bars (15% from bottom)
            this.player.y = canvas.height - Math.max(120, canvas.height * 0.15);
        }
    },

    startRun() {
        this.player.reset();
        this.player.y = canvas.height - Math.max(120, canvas.height * 0.15);

        this.enemies = [];
        this.projectiles = [];
        this.pickups = [];
        this.particles = [];
        this.enemySpawnTimer = 0;
        this.allySpawnTimer = 0;
        this.specialWeaponTimer = 10; // Start at 10s so first spawn happens immediately
        this.waveBreakTimer = 3; // 3 second break before first wave
        this.currentWave = 0;
        this.isWaveActive = false;

        score = 0;
        gameTime = 0;
        killCount = 0;
        lives = 10;
        coinsRun = 0;
        this.speedUpsWave = 0;

        UI.showScreen('hud');
        UI.updateHUD();

        currentState = STATE.PLAYING;
    },

    quitToMenu() {
        UI.showScreen('menu');
        currentState = STATE.MENU;
        UI.elements.menuCoins.textContent = saveData.coins;
    },

    loseLife() {
        lives--;
        AudioFX.damage(); // Sound
        game.shake = 20; // Big shake
        // Flash screen logic could go here

        UI.updateHUD();
        if (lives <= 0) {
            lives = 0;
            this.gameOver();
        }
    },

    gainLife() {
        lives++;
        UI.updateHUD();
        this.addNotification("EXTRA LIFE!", "#ff0066");
    },

    spawnExplosion(x, y, color, count = 10, speedScale = 100) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(
                x, y, color,
                () => Math.random() * speedScale,
                () => Math.random() * 4 + 2
            ));
        }
    },

    gameOver() {
        currentState = STATE.GAME_OVER;
        saveData.coins += coinsRun;
        localStorage.setItem('bulletHellSave', JSON.stringify(saveData));

        UI.elements.goTime.textContent = UI.elements.timer.textContent;
        UI.elements.goKills.textContent = killCount;
        UI.elements.goCoins.textContent = coinsRun;

        UI.showScreen('gameOver');
    },

    buyUpgrade(id, cost) {
        if (saveData.coins >= cost) {
            saveData.coins -= cost;
            saveData.upgrades[id] = (saveData.upgrades[id] || 0) + 1;
            localStorage.setItem('bulletHellSave', JSON.stringify(saveData));
            UI.renderShop(); // Refresh
        }
    },

    addNotification(text, color, size = 'normal') {
        notifications.push({
            text: text,
            color: color,
            size: size,
            x: this.player.x,
            y: this.player.y - 50,
            life: 2.0, // seconds
            vy: -50 // float speed
        });
    },

    startWave(waveNum) {
        this.isWaveActive = true;
        this.currentWave = waveNum;
        
        // Visual Notification - Two lines for mobile portrait
        const color = waveNum % 5 === 0 ? '#ff0000' : '#bd00ff';
        this.addNotification(`WAVE ${waveNum}\nSTART!`, color, 'big');

        // Spawn boss at waves that are multiples of 5
        if (waveNum % 5 === 0 && waveNum > 0) {
            // Spawn boss at center of main lane after a short delay
            setTimeout(() => {
                const boss = new Enemy('boss');
                boss.x = 0; // Center of main lane
                this.enemies.push(boss);
                this.addNotification("BOSS\nINCOMING!", '#ff0000', 'big');
            }, 1000); // 1 second delay after wave start
        }

        // Calculate wave parameters - start interspersed, get denser
        const baseEnemies = 5 + (waveNum * 2); // Base count increases with wave
        const spawnInterval = Math.max(200, 1000 - (waveNum * 50)); // Faster spawns as waves increase
        const waveDuration = 30; // 30 seconds per wave
        
        let enemiesSpawned = 0;
        const maxEnemies = baseEnemies + (waveNum * 3);
        
        const spawnEnemyInWave = () => {
            if (enemiesSpawned < maxEnemies && this.isWaveActive && currentState === STATE.PLAYING) {
                // Spawn enemy with interspersed timing
                const r = Math.random();
                let type = 'basic';
                
                if (waveNum > 2 && r < 0.3) type = 'fast';
                if (waveNum > 4 && r < 0.1) type = 'tank';
                
                this.enemies.push(new Enemy(type));
                enemiesSpawned++;
                
                // Schedule next spawn
                if (enemiesSpawned < maxEnemies) {
                    setTimeout(spawnEnemyInWave, spawnInterval + (Math.random() * spawnInterval * 0.5));
                }
            }
        };
        
        // Start spawning enemies
        spawnEnemyInWave();
        
        // End wave after duration
        setTimeout(() => {
            this.isWaveActive = false;
            this.waveBreakTimer = 5; // 5 second break between waves
            this.addNotification(`WAVE ${waveNum}\nCOMPLETE!`, '#00ff00', 'big');
        }, waveDuration * 1000);
    },

    loop(timestamp) {
        requestAnimationFrame(t => this.loop(t));

        if (currentState !== STATE.PLAYING) {
            lastTime = timestamp; // Prevent delta jumps
            return;
        }

        deltaTime = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        if (deltaTime > 0.1) deltaTime = 0.1; // Cap lag

        // Updates
        Input.update(deltaTime);
        gameTime += deltaTime;

        // Wave System with Breaks
        if (!this.isWaveActive && this.waveBreakTimer <= 0) {
            // Start new wave
            this.startWave(this.currentWave + 1);
        }
        
        if (!this.isWaveActive) {
            this.waveBreakTimer -= deltaTime;
        }

        // Special Weapons - Left Lane (every 10 seconds)
        this.specialWeaponTimer -= deltaTime;
        if (this.specialWeaponTimer <= 0) {
            const mainHalf = CONFIG.lanes.mainHalf;
            const edgeWidth = CONFIG.lanes.edgeWidth;
            const edgeLaneCenter = mainHalf + (edgeWidth / 2);
            const safeLeftX = -edgeLaneCenter;
            
            // Randomly select a special weapon
            const randomWeapon = SPECIAL_WEAPONS[Math.floor(Math.random() * SPECIAL_WEAPONS.length)];
            
            game.pickups.push(new Pickup(safeLeftX, -50, 1, 'special_weapon', randomWeapon));
            this.specialWeaponTimer = 10; // Every 10 seconds
        }

        // Ally Ships - Right Lane (spawn periodically)
        this.allySpawnTimer -= deltaTime;
        if (this.allySpawnTimer <= 0) {
            const mainHalf = CONFIG.lanes.mainHalf;
            const edgeWidth = CONFIG.lanes.edgeWidth;
            const edgeLaneCenter = mainHalf + (edgeWidth / 2);
            const safeRightX = edgeLaneCenter;
            
            // Occasionally spawn strong ally (10% chance)
            const isStrong = Math.random() < 0.1;
            game.pickups.push(new Pickup(safeRightX, -50, 1, isStrong ? 'strong_ally' : 'ally', null));
            
            this.allySpawnTimer = 8 + (Math.random() * 4); // 8-12 seconds
        }

        this.player.update(deltaTime);

        // Update Entities
        this.projectiles.forEach(p => p.update(deltaTime));
        this.enemies.forEach(e => e.update(deltaTime));

        // Use reverse loop for pickups to safely handle removal during iteration
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.update(deltaTime, this.player);
            if (p.markedForDeletion) {
                this.pickups.splice(i, 1);
            }
        }

        this.particles.forEach(p => p.update(deltaTime));

        // Update Notifications
        for (let i = notifications.length - 1; i >= 0; i--) {
            const n = notifications[i];
            n.life -= deltaTime;
            n.y += n.vy * deltaTime;
            if (n.life <= 0) {
                notifications.splice(i, 1);
            }
        }

        // Cleanup (projectiles/enemies)
        this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);
        this.enemies = this.enemies.filter(e => !e.markedForDeletion);
        // Pickups already cleaned

        // Collisions
        // 1. Proj vs Enemy
        this.projectiles.forEach(p => {
            this.enemies.forEach(e => {
                const distSq = (p.x - e.x) * (p.x - e.x) + (p.y - e.y) * (p.y - e.y);
                const radii = p.radius + e.radius;
                if (distSq < radii * radii) {
                    if (!p.hitList.includes(e)) {
                        e.takeDamage(p.damage);
                        p.hitList.push(e);
                        AudioFX.hit(); // Sound
                        if (p.hitList.length >= p.pierce) {
                            p.markedForDeletion = true;
                        }
                        // Spark
                        this.spawnExplosion(e.x, e.y, '#fff', 2, 50);
                    }
                }
            });
        });

        // 2. Enemy vs Player
        this.enemies.forEach(e => {
            const dx = e.x - this.player.x;
            const dy = e.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Check box collision approx for player
            // Using slightly larger hitbox for player damage vs pickup
            const hitW = this.player.width * 0.8;
            const hitH = this.player.height * 0.8;

            if (Math.abs(dx) < hitW && Math.abs(dy) < hitH) {
                this.player.takeDamage(10);
                e.die();
            }
        });

        UI.updateHUD();

        // Drawing
        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Shake
        if (this.shake > 0) {
            ctx.save();
            const sx = (Math.random() - 0.5) * this.shake;
            const sy = (Math.random() - 0.5) * this.shake;
            ctx.translate(sx, sy);
            this.shake *= 0.9;
            if (this.shake < 0.5) this.shake = 0;
        }

        // Draw Lane Borders - Always 3-lane mode
        const mainHalf = CONFIG.lanes.mainHalf;
        const edgeWidth = CONFIG.lanes.edgeWidth;

        ctx.strokeStyle = '#ffffff10';
        ctx.lineWidth = 2;
        
        // Left edge lane boundaries
        ctx.beginPath();
        ctx.moveTo(centerX - mainHalf - edgeWidth, 0);
        ctx.lineTo(centerX - mainHalf - edgeWidth, canvas.height);
        ctx.moveTo(centerX - mainHalf, 0);
        ctx.lineTo(centerX - mainHalf, canvas.height);
        ctx.stroke();

        // Right edge lane boundaries
        ctx.beginPath();
        ctx.moveTo(centerX + mainHalf, 0);
        ctx.lineTo(centerX + mainHalf, canvas.height);
        ctx.moveTo(centerX + mainHalf + edgeWidth, 0);
        ctx.lineTo(centerX + mainHalf + edgeWidth, canvas.height);
        ctx.stroke();

        // Draw column dividers in main lane (optional visual guide)
        const columnWidth = CONFIG.lanes.columnWidth;
        const numColumns = CONFIG.lanes.actualColumns || Math.floor((mainHalf * 2) / columnWidth);
        ctx.strokeStyle = '#ffffff05';
        ctx.lineWidth = 1;
        for (let i = 1; i < numColumns; i++) {
            const x = centerX - mainHalf + (i * columnWidth);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        this.pickups.forEach(p => p.draw(ctx));
        this.enemies.forEach(e => e.draw(ctx)); // Draw enemies under player
        this.player.allies.forEach(a => a.draw(ctx)); // Draw allies
        this.player.draw(ctx);
        this.projectiles.forEach(p => p.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));

        // Draw Notifications
        ctx.textAlign = 'center';
        notifications.forEach(n => {
            let screenX = centerX + n.x;
            let screenY = n.y;
            let font = 'bold 20px "Orbitron", sans-serif';
            let lineHeight = 25;

            if (n.size === 'big') {
                font = 'bold 50px "Orbitron", sans-serif'; // Slightly smaller for mobile
                lineHeight = 60;
                screenX = centerX; // Absolute center
                screenY = canvas.height * 0.3; // Fixed top-ish position
            }

            ctx.font = font;
            ctx.fillStyle = n.color;
            ctx.shadowBlur = 5;
            ctx.shadowColor = n.color;
            // Fade out
            ctx.globalAlpha = Math.min(1, n.life);
            
            // Support multi-line text (split by \n)
            const lines = n.text.split('\n');
            lines.forEach((line, index) => {
                ctx.fillText(line, screenX, screenY + (index * lineHeight));
            });
            
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        });

        if (this.shake > 0) ctx.restore();
    }
};

// Global accessor for HTML onclicks
window.game = Game; // Expose for debugging/clicks
window.onload = () => Game.init();
