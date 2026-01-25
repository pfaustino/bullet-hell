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
        upgrade: '#00ff00',
        laneBorder: '#ffffff20'
    },
    // Lane configuration (relative to centerX)
    lanes: {
        mainHalf: 200,      // Main lane: -200 to +200 (enemies spawn here)
        edgeInner: 200,     // Edge lane inner boundary  
        edgeOuter: 320      // Edge lane outer boundary (power-ups fall here)
    }
};

const GAME_MODES = [
    { id: 0, name: "1 LANE", desc: "Classic: Loot from Kills", lanes: ['main'] },
    { id: 1, name: "2 LANE", desc: "Left Lane: Upgrades", lanes: ['left', 'main'] },
    { id: 2, name: "3 LANE", desc: "Right Lane: Allies", lanes: ['left', 'main', 'right'] }
];
let gameMode = 0; // Index into GAME_MODES

const UPGRADE_POOL = [
    { id: 'dmg', name: 'DAMAGE UP', icon: '⚔️', color: '#ff0055', weight: 1, apply: (p) => { p.stats.damageMult += 0.2; } },
    { id: 'spd', name: 'FIRE RATE UP', icon: '🔥', color: '#ffff00', weight: 1, apply: (p) => { p.stats.fireRateMult += 0.15; } },
    { id: 'mov', name: 'SPEED UP', icon: '⏩', color: '#00ccff', weight: 1, apply: (p) => { p.stats.speedMult += 0.1; game.speedUpsWave++; } },
    { id: 'hp', name: 'HEART', icon: '❤️', color: '#ff0066', weight: 0.8, apply: (p) => { p.maxHp += 10; p.heal(100); game.gainLife(); } },
    { id: 'cnt', name: 'MULTISHOT', icon: '✨', color: '#ffffff', weight: 0.1, apply: (p) => { if (p.weapons[0].count < 30) p.weapons[0].count++; } },
    { id: 'prc', name: 'PIERCE UP', icon: '🏹', color: '#ffaa00', weight: 0.5, apply: (p) => { if (p.weapons[0].pierce < 5) p.weapons[0].pierce++; } }
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
        // Calculate movement bounds based on Game Mode
        const mode = GAME_MODES[gameMode];
        let minX = -CONFIG.laneWidth / 2;
        let maxX = CONFIG.laneWidth / 2;

        if (mode.lanes.includes('left')) minX -= 150; // Side lane width
        if (mode.lanes.includes('right')) maxX += 150;

        const laneHalf = (Math.min(canvas.width, CONFIG.laneWidth) / 2) - (this.width / 2);

        // Actually, let's use the explicit bounds relative to CenterX(0)
        // Main Lane is always [-300, 300]
        // Left Lane is [-450, -300]
        // Right Lane is [300, 450]

        // Override basic lane clamp
        if (this.x < minX + (this.width / 2)) this.x = minX + (this.width / 2);
        if (this.x > maxX - (this.width / 2)) this.x = maxX - (this.width / 2);

        // Update Weapons
        this.weapons.forEach(w => w.update(dt, this));
    }

    shootBasic(weapon) {
        // Fire logic
        AudioFX.shoot(); // Sound
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
            this.hp = (10 + (gameTime * 1.0)) * hpMult;
            this.speed = 150;
            this.color = CONFIG.colors.enemyFast;
            this.radius = 12;
            this.xpValue = 15;
            this.icon = '⚡';
        } else if (type === 'tank') {
            this.hp = (100 + (gameTime * 5.0)) * hpMult;
            this.speed = 40;
            this.color = CONFIG.colors.enemyTank;
            this.radius = 25;
            this.xpValue = 50;
            this.icon = '👹';
        } else { // Basic
            this.hp = (20 + (gameTime * 2.0)) * hpMult;
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
        game.spawnExplosion(this.x, this.y, this.color, 20, 300); // Massive visual

        // Drop Chance Logic - INCREASED DROP RATE
        const roll = Math.random();

        if (gameMode === 0) {
            if (roll < 0.40) { // 40% Chance for Upgrade Drop (Mode 1)
                // Filter out Speed if already taken this wave
                const available = UPGRADE_POOL.filter(u => u.id !== 'mov' || game.speedUpsWave < 1);

                if (available.length > 0) {
                    const idx = Math.floor(Math.random() * available.length);
                    const upgrade = available[idx];
                    game.pickups.push(new Pickup(this.x, this.y, 1, 'upgrade', upgrade));
                }
            } else if (roll < 0.60) {
                game.pickups.push(new Pickup(this.x, this.y, 10, 'coin'));
            }
        } else {
            // Modes 2 & 3: Only coins drop from enemies
            if (roll < 0.20) {
                game.pickups.push(new Pickup(this.x, this.y, 10, 'coin'));
            }
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
                    Game.addNotification(this.data.name, this.data.color);
                    AudioFX.powerup(); // Sound
                } else {
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
            // Pulse size
            const pulse = 1 + (Math.sin(gameTime * 5) * 0.2);

            ctx.translate(screenX, this.y);
            ctx.scale(pulse, pulse);

            ctx.shadowBlur = 20;
            ctx.shadowColor = this.color;

            ctx.font = `${size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Icon
            const icon = this.data.icon || '💎';
            ctx.fillText(icon, 0, 0);

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
        xpBar: document.getElementById('xp-bar-fill'),
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

        const statText = `LEVEL: ${game.wave}
❤️ ${lives}
____________
⚔️ ${(15 * p.stats.damageMult).toFixed(1)}
⏩ ${(150 * p.stats.speedMult).toFixed(0)}
🔥 x${p.stats.fireRateMult.toFixed(2)}
✨ ${p.weapons[0].count}
🏹 ${p.weapons[0].pierce}`;

        // Update stats box using cached element
        if (this.elements.statBox) {
            this.elements.statBox.textContent = statText;
            this.elements.statBox.style.whiteSpace = 'pre-line'; // Ensure line breaks
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
    sideLaneTimer: 0, // For upgrades/allies
    heartSpawnTimer: 0, // New: Hearts every 20s
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

        // Mode Selector Buttons
        document.getElementById('btn-mode-prev').onclick = () => this.changeMode(-1);
        document.getElementById('btn-mode-next').onclick = () => this.changeMode(1);
        this.updateModeDisplay();

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

    changeMode(dir) {
        gameMode += dir;
        if (gameMode < 0) gameMode = GAME_MODES.length - 1;
        if (gameMode >= GAME_MODES.length) gameMode = 0;
        this.updateModeDisplay();
    },

    updateModeDisplay() {
        const m = GAME_MODES[gameMode];
        document.getElementById('mode-display').innerText = m.name;
        document.getElementById('mode-desc').innerText = m.desc;
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
        this.sideLaneTimer = 0;
        this.heartSpawnTimer = 20; // 20 seconds start

        score = 0;
        gameTime = 0;
        killCount = 0;
        lives = 10;
        coinsRun = 0;
        this.speedUpsWave = 0;
        this.wave = 0; // Init Wave Count

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

    spawnWave(waveNum) {
        // Reset Wave Limits
        this.speedUpsWave = 0;

        // Visual Notification
        const color = waveNum % 5 === 0 ? '#ff0000' : '#bd00ff';
        this.addNotification(`WAVE ${waveNum} INCOMING!`, color, 'big');

        // Wave Logic
        // Increased Wave Density
        const base = 10;
        const perWave = 5; // Previously 2
        const count = base + (waveNum * perWave); // Wave 3 = 25 enemies

        for (let i = 0; i < count; i++) {
            // Slight delay between spawns so they don't overlap perfectly
            setTimeout(() => {
                if (currentState === STATE.PLAYING) {
                    const type = waveNum % 3 === 0 ? 'tank' : 'fast';
                    this.enemies.push(new Enemy(type));
                }
            }, i * 50); // Faster spawn release (50ms)
        }
    },

    spawnEnemy() {
        // Probability based on time
        const r = Math.random();
        let type = 'basic';

        if (gameTime > 60 && r < 0.2) type = 'fast';
        if (gameTime > 120 && r < 0.05) type = 'tank';

        // Pass difficulty mult to enemy
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

        // Wave Check (Every 60 seconds)
        const newWave = Math.floor(gameTime / 60) + 1;
        if (newWave > this.wave) {
            this.wave = newWave;
            this.spawnWave(this.wave);
        }

        // Spawning
        const diff = DIFFICULTY_LEVELS[difficultyIndex];
        this.enemySpawnTimer -= deltaTime * 1000 * diff.spawnMult; // Apply Spawn Mult
        if (this.enemySpawnTimer <= 0) {
            this.spawnEnemy();
            // Scale difficulty
            const currentSpawnRate = Math.max(200, CONFIG.baseEnemySpawnRate * Math.pow(CONFIG.difficultyScale, gameTime / 10));
            this.enemySpawnTimer = currentSpawnRate;
        }

        // Side Lane Logistics (Modes 2 & 3)
        // Spawn upgrades in Left Lane, Allies in Right Lane
        if (gameMode > 0) {
            this.sideLaneTimer -= deltaTime;
            if (this.sideLaneTimer <= 0) {
                // Determine spawn type based on mode and random chance
                let spawnSide = 'none';

                // Mode 2: Left Lane Only
                if (gameMode === 1) {
                    spawnSide = 'left';
                }
                // Mode 3: Left or Right
                else if (gameMode === 2) {
                    spawnSide = Math.random() < 0.5 ? 'left' : 'right';
                }

                // Calculate spawn X in the CENTER of edge lanes
                // Edge lane is between mainHalf and edgeOuter
                const edgeLaneCenter = (CONFIG.lanes.mainHalf + CONFIG.lanes.edgeOuter) / 2;
                const safeLeftX = -edgeLaneCenter;
                const safeRightX = edgeLaneCenter;

                if (spawnSide === 'left') {
                    // Spawn Upgrade
                    // Filter out Speed if already taken this wave
                    const available = UPGRADE_POOL.filter(u => u.id !== 'mov' || game.speedUpsWave < 1);

                    if (available.length > 0) {
                        const idx = Math.floor(Math.random() * available.length);
                        const upgrade = available[idx];
                        game.pickups.push(new Pickup(safeLeftX, 50, 1, 'upgrade', upgrade));
                    }

                    // Debug Visual
                    // this.addNotification("LEFT LOOT", "#00ff00");
                } else if (spawnSide === 'right') {
                    // Spawn Ally
                    const ms = UPGRADE_POOL.find(u => u.id === 'cnt');
                    let p = new Pickup(safeRightX, 50, 1, 'upgrade', ms);
                    p.color = '#00ffff';
                    game.pickups.push(p);

                    // Debug Visual
                    // this.addNotification("RIGHT ALLY", "#00ffff");
                }

                this.sideLaneTimer = 2.0; // Spawn every 2 seconds roughly
            }
        }

        // Heart Spawner (Every 20s) - Left Lane
        this.heartSpawnTimer -= deltaTime;
        if (this.heartSpawnTimer <= 0) {
            // Spawn Heart in center of left edge lane
            const healUp = UPGRADE_POOL.find(u => u.id === 'hp');
            const edgeLaneCenter = (CONFIG.lanes.mainHalf + CONFIG.lanes.edgeOuter) / 2;
            game.pickups.push(new Pickup(-edgeLaneCenter, 50, 1, 'upgrade', healUp));
            this.addNotification("HEART SPAWNED!", "#ff0066");

            this.heartSpawnTimer = 20;
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

        // Draw Extra Lane Dividers (Edge lanes for power-ups)
        if (gameMode >= 1) {
            // Left inner divider (main lane boundary)
            ctx.beginPath();
            ctx.moveTo(centerX - CONFIG.lanes.mainHalf, 0);
            ctx.lineTo(centerX - CONFIG.lanes.mainHalf, canvas.height);
            ctx.stroke();

            // Outer Left (edge lane boundary)
            ctx.beginPath();
            ctx.moveTo(centerX - CONFIG.lanes.edgeOuter, 0);
            ctx.lineTo(centerX - CONFIG.lanes.edgeOuter, canvas.height);
            ctx.stroke();
        }
        if (gameMode === 2) {
            // Right inner divider (main lane boundary)
            ctx.beginPath();
            ctx.moveTo(centerX + CONFIG.lanes.mainHalf, 0);
            ctx.lineTo(centerX + CONFIG.lanes.mainHalf, canvas.height);
            ctx.stroke();

            // Outer Right (edge lane boundary)
            ctx.beginPath();
            ctx.moveTo(centerX + CONFIG.lanes.edgeOuter, 0);
            ctx.lineTo(centerX + CONFIG.lanes.edgeOuter, canvas.height);
            ctx.stroke();
        }
        ctx.lineTo(laneRight, canvas.height);
        ctx.stroke();

        this.pickups.forEach(p => p.draw(ctx));
        this.enemies.forEach(e => e.draw(ctx)); // Draw enemies under player
        this.player.draw(ctx);
        this.projectiles.forEach(p => p.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));

        // Draw Notifications
        ctx.textAlign = 'center';
        notifications.forEach(n => {
            let screenX = centerX + n.x;
            let screenY = n.y;
            let font = 'bold 20px "Orbitron", sans-serif';

            if (n.size === 'big') {
                font = 'bold 60px "Orbitron", sans-serif';
                screenX = centerX; // Absolute center
                screenY = canvas.height * 0.3; // Fixed top-ish position
            }

            ctx.font = font;
            ctx.fillStyle = n.color;
            ctx.shadowBlur = 5;
            ctx.shadowColor = n.color;
            // Fade out
            ctx.globalAlpha = Math.min(1, n.life);
            ctx.fillText(n.text, screenX, screenY);
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        });

        if (this.shake > 0) ctx.restore();
    }
};

// Global accessor for HTML onclicks
window.game = Game; // Expose for debugging/clicks
window.onload = () => Game.init();
