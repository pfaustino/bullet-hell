/**
 * Channel Survivor - Game Logic
 * A top-down horde survival game.
 */

// --- CONFIGURATION & CONSTANTS ---
// --- CONFIGURATION & CONSTANTS ---
const CONFIG = {
    laneWidth: 600,
    fps: 60,
    baseEnemySpawnRate: 1000,
    difficultyScale: 0.98,
    colors: {
        player: '#00f2ff',
        bullet: '#ffe600',
        enemyBasic: '#ff2a6d',
        enemyFast: '#bd00ff',
        enemyTank: '#ff8800',
        xp: '#05ffa1',
        text: '#ffffff',
        upgrade: '#00ff00' // New color for upgrades
    }
};

const UPGRADE_POOL = [
    { id: 'dmg', name: 'DAMAGE UP', color: '#ff0055', weight: 1, apply: (p) => { p.stats.damageMult += 0.2; } },
    { id: 'spd', name: 'FIRE RATE UP', color: '#ffff00', weight: 1, apply: (p) => { p.stats.fireRateMult += 0.15; } },
    { id: 'mov', name: 'SPEED UP', color: '#00ccff', weight: 1, apply: (p) => { p.stats.speedMult += 0.1; } },
    { id: 'hp', name: 'HEAL', color: '#00ff66', weight: 0.8, apply: (p) => { p.maxHp += 10; p.heal(25); } },
    { id: 'cnt', name: 'MULTISHOT', color: '#ffffff', weight: 0.1, apply: (p) => { p.weapons[0].count++; } },
    { id: 'prc', name: 'PIERCE UP', color: '#ffaa00', weight: 0.5, apply: (p) => { p.weapons[0].pierce++; } }
];

// --- STATE MANAGEMENT ---
const STATE = {
    MENU: 0,
    PLAYING: 1,
    PAUSED: 2,
    GAME_OVER: 3,
    SHOP: 4
};
// Removed LEVEL_UP state

let currentState = STATE.MENU;
let lastTime = 0;
let deltaTime = 0;
let score = 0;
let gameTime = 0;
let killCount = 0;
let coinsRun = 0;
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

if (localStorage.getItem('channelSurvivorSave')) {
    try {
        const loaded = JSON.parse(localStorage.getItem('channelSurvivorSave'));
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

        // Experience
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 100;
    }

    update(dt) {
        // Movement is handled by input directly influencing x/y for instant feel
        // But we apply boundary checks here
        const laneHalf = (Math.min(canvas.width, CONFIG.laneWidth) / 2) - (this.width / 2);

        // Clamp X
        if (this.x < -laneHalf) this.x = -laneHalf;
        if (this.x > laneHalf) this.x = laneHalf;

        // Update Weapons
        this.weapons.forEach(w => w.update(dt, this));
    }

    shootBasic(weapon) {
        // Fire logic
        const offsetStep = 10;
        const totalWidth = (weapon.count - 1) * offsetStep;
        let startX = this.x - (totalWidth / 2);

        for (let i = 0; i < weapon.count; i++) {
            game.projectiles.push(new Projectile(
                startX + (i * offsetStep),
                this.y - 20,
                weapon.damage * this.stats.damageMult,
                weapon.projectileSpeed,
                weapon.pierce
            ));
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
            game.gameOver();
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
    constructor(x, y, damage, speed, pierce) {
        this.x = x;
        this.y = y;
        this.damage = damage;
        this.speed = speed;
        this.pierce = pierce;
        this.radius = 4;
        this.markedForDeletion = false;
        this.hitList = []; // Enemies already hit
    }

    update(dt) {
        this.y -= this.speed * dt;
        if (this.y < 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        const screenX = centerX + this.x;
        ctx.fillStyle = CONFIG.colors.bullet;
        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.colors.bullet;
        ctx.beginPath();
        ctx.arc(screenX, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Enemy {
    constructor(type) {
        this.type = type;
        this.radius = 15;
        // Random horizontal position within lane
        const laneHalf = (Math.min(canvas.width, CONFIG.laneWidth) / 2) - 20;
        this.x = (Math.random() * laneHalf * 2) - laneHalf;
        this.y = -50;

        this.markedForDeletion = false;

        // Type stats - DRASTICALLY REDUCED SCALING
        // gameTime is seconds.
        if (type === 'fast') {
            this.hp = 10 + (gameTime * 0.1);
            this.speed = 150;
            this.color = CONFIG.colors.enemyFast;
            this.radius = 12;
            this.xpValue = 15;
        } else if (type === 'tank') {
            this.hp = 60 + (gameTime * 0.5);
            this.speed = 40;
            this.color = CONFIG.colors.enemyTank;
            this.radius = 25;
            this.xpValue = 50;
        } else { // Basic
            this.hp = 20 + (gameTime * 0.2);
            this.speed = 80;
            this.color = CONFIG.colors.enemyBasic;
            this.xpValue = 10;
        }
    }

    update(dt) {
        this.y += this.speed * dt;

        // Remove if off screen bottom
        if (this.y > canvas.height + 50) {
            this.markedForDeletion = true;
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

        // Drop Chance Logic - INCREASED DROP RATE
        const roll = Math.random();

        if (roll < 0.40) { // 40% Chance for Upgrade Drop (Huge buff)
            // Select Weighted Upgrade
            // Simple random for now
            const idx = Math.floor(Math.random() * UPGRADE_POOL.length);
            const upgrade = UPGRADE_POOL[idx];
            game.pickups.push(new Pickup(this.x, this.y, 1, 'upgrade', upgrade));
        } else if (roll < 0.60) {
            // 20% Chance for Coin (40-60 range)
            game.pickups.push(new Pickup(this.x, this.y, 10, 'coin'));
        }

        // Spawn particles
        for (let i = 0; i < 5; i++) {
            game.particles.push(new Particle(this.x, this.y, this.color));
        }
    }

    draw(ctx) {
        const screenX = centerX + this.x;
        ctx.fillStyle = this.color;
        // Simple shape based on type
        ctx.beginPath();
        if (this.type === 'tank') {
            ctx.fillRect(screenX - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        } else if (this.type === 'fast') {
            ctx.moveTo(screenX, this.y + this.radius);
            ctx.lineTo(screenX - this.radius, this.y - this.radius);
            ctx.lineTo(screenX + this.radius, this.y - this.radius);
        } else {
            ctx.arc(screenX, this.y, this.radius, 0, Math.PI * 2);
        }
        ctx.fill();
    }
}

class Pickup {
    constructor(x, y, amount, type, data = null) {
        this.x = x;
        this.y = y;
        this.amount = amount;
        this.type = type; // 'upgrade', 'coin'
        this.data = data; // Upgrade object
        this.radius = type === 'upgrade' ? 12 : 6;
        this.markedForDeletion = false;
        this.magnetized = false;
        this.color = type === 'upgrade' ? data.color : '#ffee00';
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
                    game.addNotification(this.data.name, this.data.color);
                } else {
                    const mult = 1 + (saveData.upgrades.coinGain * 0.2);
                    const val = Math.ceil(this.amount * mult);
                    coinsRun += val;
                    UI.updateHUD();
                }
                this.markedForDeletion = true;

                // CRITICAL FIX: Immediately remove from array
                const idx = game.pickups.indexOf(this);
                if (idx > -1) {
                    game.pickups.splice(idx, 1);
                }
            }
        }

        this.y += 40 * dt; // Fall down the lane
    }

    draw(ctx) {
        const screenX = centerX + this.x;

        if (this.type === 'upgrade') {
            // Draw Floating Gem / Diamond
            const size = 15;
            // Pulse size
            const pulse = 1 + (Math.sin(gameTime * 5) * 0.1);

            ctx.translate(screenX, this.y);
            ctx.scale(pulse, pulse);
            // Spin effect?
            // ctx.rotate(gameTime); 

            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
            ctx.fillStyle = this.color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(0, -size); // Top
            ctx.lineTo(size, 0);  // Right
            ctx.lineTo(0, size);  // Bottom
            ctx.lineTo(-size, 0); // Left
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.scale(1 / pulse, 1 / pulse);
            ctx.translate(-screenX, -this.y);

        } else {
            // Coin
            ctx.beginPath();
            ctx.arc(screenX, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            // $ symbol
            ctx.fillStyle = '#000';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', screenX, this.y);
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = Math.random() * 100 + 50;
        this.life = 0.5; // seconds
        this.size = Math.random() * 3 + 1;
    }

    update(dt) {
        this.life -= dt;
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const screenX = centerX + this.x;
        ctx.globalAlpha = this.life * 2;
        ctx.fillStyle = this.color;
        ctx.fillRect(screenX, this.y, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

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
        upgrades: document.getElementById('upgrades-menu')
    },

    elements: {
        hpBar: document.getElementById('hp-bar-fill'),
        xpBar: document.getElementById('xp-bar-fill'),
        lvlText: document.getElementById('level-indicator'),
        timer: document.getElementById('timer'),
        coins: document.getElementById('game-coins'),
        kills: document.getElementById('kill-count'),
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

        const statText = `DMG: ${(15 * p.stats.damageMult).toFixed(1)}
SPD: ${(150 * p.stats.speedMult).toFixed(0)}
FR: x${p.stats.fireRateMult.toFixed(2)}
SHT: ${p.weapons[0].count}
PRC: ${p.weapons[0].pierce}`;

        // Update stats box using cached element
        if (this.elements.statBox) {
            this.elements.statBox.textContent = statText;
        } else {
            // Retry fetch if missed (racing condition safe)
            this.elements.statBox = document.getElementById('stat-debug-box');
        }

        const levelSpan = document.getElementById('level-indicator');
        if (levelSpan) {
            levelSpan.innerText = `SCORE: ${Math.floor(p.xp)}`;
        }

        this.elements.coins.textContent = coinsRun;
        this.elements.kills.textContent = `💀 ${killCount}`;

        // Timer format
        const totalSec = Math.floor(gameTime);
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        this.elements.timer.textContent = `${m}:${s}`;

        // Debug: Prove new JS is active
        this.elements.timer.style.color = '#00f2ff';
    },

    showScreen(name) {
        Object.values(this.screens).forEach(s => {
            s.classList.remove('active');
            s.classList.add('hidden');
        });
        if (name && this.screens[name]) {
            this.screens[name].classList.remove('hidden');
            this.screens[name].classList.add('active');
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

    updateHUD() {
        const p = game.player;
        const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
        this.elements.hpBar.style.width = `${hpPct}%`;

        const xpPct = (p.xp / p.xpToNext) * 100;
        this.elements.xpBar.style.width = `${xpPct}%`;

        // Debug XP Text
        const levelSpan = document.getElementById('level-indicator');
        if (levelSpan) {
            levelSpan.innerText = `${p.level} (${Math.floor(p.xp)}/${p.xpToNext})`;
        }
        this.elements.coins.textContent = coinsRun;
        this.elements.kills.textContent = `💀 ${killCount}`;

        // Timer format
        const totalSec = Math.floor(gameTime);
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        this.elements.timer.textContent = `${m}:${s}`;
    },

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

const Game = {
    player: null,
    enemies: [],
    projectiles: [],
    pickups: [],
    particles: [],
    enemySpawnTimer: 0,
    shake: 0,

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.player = new Player();
        Input.init();

        // Bind UI buttons
        document.getElementById('btn-play').onclick = () => this.startRun();
        document.getElementById('btn-upgrades').onclick = () => {
            UI.renderShop();
            UI.showScreen('upgrades');
            currentState = STATE.SHOP;
        };
        document.getElementById('btn-back-main').onclick = () => UI.showScreen('menu');

        document.getElementById('btn-pause').onclick = () => UI.togglePause();
        document.getElementById('btn-resume').onclick = () => UI.togglePause();
        document.getElementById('btn-quit').onclick = () => this.quitToMenu();

        document.getElementById('btn-retry').onclick = () => this.startRun();
        document.getElementById('btn-menu').onclick = () => this.quitToMenu();

        // Main Loop Start
        requestAnimationFrame(t => this.loop(t));

        // Refresh Menu
        UI.elements.menuCoins.innerText = saveData.coins;
    },

    resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        centerX = canvas.width / 2;
        centerY = canvas.height / 2;

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

        score = 0;
        gameTime = 0;
        killCount = 0;
        coinsRun = 0;

        UI.showScreen('hud');
        UI.updateHUD();

        currentState = STATE.PLAYING;
    },

    quitToMenu() {
        UI.showScreen('menu');
        currentState = STATE.MENU;
        UI.elements.menuCoins.textContent = saveData.coins;
    },

    gameOver() {
        currentState = STATE.GAME_OVER;
        saveData.coins += coinsRun;
        localStorage.setItem('channelSurvivorSave', JSON.stringify(saveData));

        UI.elements.goTime.textContent = UI.elements.timer.textContent;
        UI.elements.goKills.textContent = killCount;
        UI.elements.goCoins.textContent = coinsRun;

        UI.showScreen('gameOver');
    },

    buyUpgrade(id, cost) {
        if (saveData.coins >= cost) {
            saveData.coins -= cost;
            saveData.upgrades[id] = (saveData.upgrades[id] || 0) + 1;
            localStorage.setItem('channelSurvivorSave', JSON.stringify(saveData));
            UI.renderShop(); // Refresh
        }
    },

    addNotification(text, color) {
        notifications.push({
            text: text,
            color: color,
            x: this.player.x,
            y: this.player.y - 50,
            life: 2.0, // seconds
            vy: -50 // float speed
        });
    },

    spawnEnemy() {
        // Probability based on time
        const r = Math.random();
        let type = 'basic';

        if (gameTime > 60 && r < 0.2) type = 'fast';
        if (gameTime > 120 && r < 0.05) type = 'tank';

        this.enemies.push(new Enemy(type));
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

        // Spawning
        this.enemySpawnTimer -= deltaTime * 1000;
        if (this.enemySpawnTimer <= 0) {
            this.spawnEnemy();
            // Scale difficulty
            const currentSpawnRate = Math.max(200, CONFIG.baseEnemySpawnRate * Math.pow(CONFIG.difficultyScale, gameTime / 10));
            this.enemySpawnTimer = currentSpawnRate;
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
                        if (p.hitList.length >= p.pierce) {
                            p.markedForDeletion = true;
                        }
                        // Spark
                        this.particles.push(new Particle(e.x, e.y, '#fff'));
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

        // Draw Lane Borders (Optional visual guide)
        const laneWidth = Math.min(canvas.width, CONFIG.laneWidth);
        const laneLeft = centerX - laneWidth / 2;
        const laneRight = centerX + laneWidth / 2;

        ctx.strokeStyle = '#ffffff10';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(laneLeft, 0);
        ctx.lineTo(laneLeft, canvas.height);
        ctx.moveTo(laneRight, 0);
        ctx.lineTo(laneRight, canvas.height);
        ctx.stroke();

        this.pickups.forEach(p => p.draw(ctx));
        this.enemies.forEach(e => e.draw(ctx)); // Draw enemies under player
        this.player.draw(ctx);
        this.projectiles.forEach(p => p.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));

        // Draw Notifications
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px "Orbitron", sans-serif';
        notifications.forEach(n => {
            const screenX = centerX + n.x;
            ctx.fillStyle = n.color;
            ctx.shadowBlur = 5;
            ctx.shadowColor = n.color;
            // Fade out
            ctx.globalAlpha = Math.min(1, n.life);
            ctx.fillText(n.text, screenX, n.y);
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        });

        if (this.shake > 0) ctx.restore();
    }
};

// Global accessor for HTML onclicks
window.game = Game; // Expose for debugging/clicks
window.onload = () => Game.init();
