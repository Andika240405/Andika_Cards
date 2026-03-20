// Game Configuration
const CONFIG = {
    easy: { targetScore: 50, duration: 40, spawnRate: 700, speedMult: 0.8 },
    normal: { targetScore: 75, duration: 30, spawnRate: 600, speedMult: 1.0 },
    hard: { targetScore: 100, duration: 25, spawnRate: 450, speedMult: 1.3 }
};

// Game Variables
let canvas, ctx;
let gameRunning = false;
let gamePaused = false;
let score = 0;
let timeLeft = 30;
let lives = 3;
let combo = 0;
let multiplier = 1;
let timerInterval, animationId;
let playerX = 0;
let fallingObjects = [];
let effectParticles = [];
let trailParticles = [];
let lastSpawnTime = 0;
let spawnInterval = 600;
let difficulty = 'normal';
let highScore = parseInt(localStorage.getItem('lebaranHighScore')) || 0;

// Power-up states
let powerups = {
    shield: { active: false, duration: 0 },
    magnet: { active: false, duration: 0 },
    double: { active: false, duration: 0 },
    slowmo: { active: false, duration: 0 }
};

// Elements
const scoreBox = document.getElementById('scoreBox');
const timeBox = document.getElementById('timeBox');
const comboBox = document.getElementById('comboBox');
const livesBox = document.getElementById('livesBox');
const scoreDisplay = document.getElementById('scoreDisplay');
const timeDisplay = document.getElementById('timeDisplay');
const comboDisplay = document.getElementById('comboDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const playerBasket = document.getElementById('playerBasket');
const envelopeWrapper = document.getElementById('envelopeWrapper');
const clickHint = document.getElementById('clickHint');
const gameContainer = document.getElementById('gameContainer');

// Constants
const PLAYER_WIDTH = 80;
const PLAYER_HEIGHT = 50;

const OBJECT_TYPES = {
    STAR: { points: 10, color: '#d4a843', size: 28 },
    GOLDEN_STAR: { points: 25, color: '#ffd700', size: 35, rare: true },
    KETUPAT: { points: 15, color: '#2d8a54', size: 32 },
    GOLDEN_KETUPAT: { points: 40, color: '#00ff88', size: 40, rare: true },
    BOMB: { points: -20, color: '#ff6b6b', size: 26, isBomb: true },
    SHIELD: { points: 0, color: '#457b9d', size: 30, isPowerup: true, powerupType: 'shield' },
    MAGNET: { points: 0, color: '#7b2cbf', size: 30, isPowerup: true, powerupType: 'magnet' },
    DOUBLE: { points: 0, color: '#d4a843', size: 30, isPowerup: true, powerupType: 'double' },
    SLOWMO: { points: 0, color: '#2a9d8f', size: 30, isPowerup: true, powerupType: 'slowmo' },
    TIME_BONUS: { points: 0, color: '#ff9f1c', size: 28, isTimeBonus: true }
};

// Audio
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    switch(type) {
        case 'catch':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
            break;
        case 'rare':
            osc.type = 'sine';
            [800, 1000, 1200, 1400].forEach((freq, i) => {
                osc.frequency.setValueAtTime(freq, now + (i * 0.05));
            });
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
            break;
        case 'bomb':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
            break;
        case 'powerup':
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(600, now + 0.1);
            osc.frequency.setValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
            break;
        case 'combo':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(500 + (combo * 50), now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
            break;
        case 'win':
            osc.type = 'square';
            [400, 500, 600, 800].forEach((freq, i) => {
                osc.frequency.setValueAtTime(freq, now + (i * 0.1));
            });
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.6);
            osc.start(now); osc.stop(now + 0.6);
            break;
        case 'lose':
            osc.type = 'triangle';
            [300, 250, 200].forEach((freq, i) => {
                osc.frequency.setValueAtTime(freq, now + (i * 0.2));
            });
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.8);
            osc.start(now); osc.stop(now + 0.8);
            break;
    }
}

// Background Effects
function initBackgroundEffects() {
    const starsLayer = document.getElementById('starsLayer');
    const starCount = 50;
    
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        const size = Math.random();
        
        if (size < 0.6) {
            star.className = 'star-small';
        } else if (size < 0.9) {
            star.className = 'star-medium';
        } else {
            star.className = 'star-large';
        }
        
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 50 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        
        starsLayer.appendChild(star);
    }
    
    const lanternsContainer = document.getElementById('lanternsContainer');
    const lanternPositions = [15, 30, 70, 85];
    const lanternColors = ['#ff6b35', '#d4a843', '#ff6b35', '#d4a843'];
    
    lanternPositions.forEach((pos, index) => {
        const lantern = document.createElement('div');
        lantern.className = 'hanging-lantern';
        lantern.style.left = pos + '%';
        lantern.style.top = '0';
        lantern.style.animationDelay = (index * 0.5) + 's';
        lantern.innerHTML = `
            <svg width="30" height="80" viewBox="0 0 30 80">
                <line x1="15" y1="0" x2="15" y2="20" stroke="#8b4513" stroke-width="1"/>
                <ellipse cx="15" cy="45" rx="12" ry="20" fill="${lanternColors[index]}" opacity="0.7"/>
                <ellipse cx="15" cy="45" rx="8" ry="14" fill="${lanternColors[index]}" opacity="0.9"/>
                <ellipse cx="15" cy="45" rx="4" ry="8" fill="#fffbe6" opacity="0.8"/>
                <rect x="10" y="22" width="10" height="6" fill="#8b4513"/>
                <rect x="10" y="62" width="10" height="6" fill="#8b4513"/>
            </svg>
        `;
        lanternsContainer.appendChild(lantern);
    });
    
    setInterval(() => {
        const starId = Math.random() > 0.5 ? 'shootingStar1' : 'shootingStar2';
        const star = document.getElementById(starId);
        
        star.style.top = (Math.random() * 30) + '%';
        star.style.right = (Math.random() * 30) + '%';
        star.classList.remove('active');
        
        setTimeout(() => {
            star.classList.add('active');
        }, 100);
    }, 8000);
}

function initParticles() {
    const particlesContainer = document.getElementById('particles');
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 8 + 's';
        particle.style.animationDuration = (6 + Math.random() * 4) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Combo Popup
function showComboPopup(text) {
    const popup = document.createElement('div');
    popup.className = 'combo-popup';
    popup.textContent = text;
    gameContainer.appendChild(popup);
    
    setTimeout(() => popup.remove(), 1000);
}

// Screen Shake
function screenShake() {
    gameContainer.classList.add('shake');
    setTimeout(() => gameContainer.classList.remove('shake'), 400);
}

// Powerup UI Update
function updatePowerupUI() {
    Object.keys(powerups).forEach(key => {
        const icon = document.getElementById(key + 'Icon');
        const timer = document.getElementById(key + 'Timer');
        
        if (powerups[key].active) {
            icon.classList.add('active');
            timer.textContent = Math.ceil(powerups[key].duration / 1000);
        } else {
            icon.classList.remove('active');
            timer.textContent = '';
        }
    });
    
    // Update basket appearance
    playerBasket.classList.toggle('shielded', powerups.shield.active);
    playerBasket.classList.toggle('magnet-active', powerups.magnet.active);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    initBackgroundEffects();
    initParticles();
    
    // Display high score
    document.getElementById('highScoreValue').textContent = highScore;
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const container = document.getElementById('gameContainer');
    container.addEventListener('mousemove', handleMove);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    // Difficulty selection
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            difficulty = btn.dataset.diff;
            
            const config = CONFIG[difficulty];
            document.getElementById('targetScoreText').textContent = 
                `Durasi ${config.duration} detik | Target: ${config.targetScore} poin`;
        });
    });

    // Button Listeners
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('replayWinBtn').addEventListener('click', (e) => { e.stopPropagation(); restartGame(); });
    document.getElementById('replayLoseBtn').addEventListener('click', restartGame);
    document.getElementById('replayTimeUpBtn').addEventListener('click', restartGame);
    
    // Pause controls
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('resumeBtn').addEventListener('click', togglePause);
    document.getElementById('quitBtn').addEventListener('click', quitGame);

    // Envelope click
    envelopeWrapper.addEventListener('click', function() {
        if(!this.classList.contains('open')) {
            this.classList.add('open');
            clickHint.style.opacity = '0';
            playSound('win');
        }
    });
});

function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    if(!gameRunning) {
        playerX = canvas.width / 2 - PLAYER_WIDTH / 2;
        updatePlayerPosition();
    }
}

function handleMove(e) {
    if (!gameRunning || gamePaused) return;
    const rect = canvas.getBoundingClientRect();
    playerX = e.clientX - rect.left - PLAYER_WIDTH / 2;
    playerX = Math.max(0, Math.min(canvas.width - PLAYER_WIDTH, playerX));
    updatePlayerPosition();
}

function handleTouchMove(e) {
    if (!gameRunning || gamePaused) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    playerX = e.touches[0].clientX - rect.left - PLAYER_WIDTH / 2;
    playerX = Math.max(0, Math.min(canvas.width - PLAYER_WIDTH, playerX));
    updatePlayerPosition();
}

function updatePlayerPosition() {
    playerBasket.style.transform = `translateX(${playerX}px)`;
}

function startGame() {
    initAudio();
    
    // Hide all screens
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('winScreen').classList.add('hidden');
    document.getElementById('loseScreen').classList.add('hidden');
    document.getElementById('timeUpScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    
    envelopeWrapper.classList.remove('open');
    clickHint.style.opacity = '1';
    
    // Reset game state
    const config = CONFIG[difficulty];
    score = 0;
    timeLeft = config.duration;
    lives = 3;
    combo = 0;
    multiplier = 1;
    fallingObjects = [];
    effectParticles = [];
    trailParticles = [];
    spawnInterval = config.spawnRate;
    gameRunning = true;
    gamePaused = false;
    
    // Reset powerups
    Object.keys(powerups).forEach(key => {
        powerups[key] = { active: false, duration: 0 };
    });
    updatePowerupUI();
    
    timeBox.classList.remove('time-warning');
    livesBox.style.background = '';
    
    updateUI();
    
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!gameRunning || gamePaused) return;
        timeLeft--;
        updateUI();
        
        // Update powerup durations
        Object.keys(powerups).forEach(key => {
            if (powerups[key].active) {
                powerups[key].duration -= 1000;
                if (powerups[key].duration <= 0) {
                    powerups[key].active = false;
                    powerups[key].duration = 0;
                }
            }
        });
        updatePowerupUI();
        
        if (timeLeft <= 10) timeBox.classList.add('time-warning');
        if (timeLeft <= 0) endGame('timeup');
    }, 1000);

    lastSpawnTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function togglePause() {
    if (!gameRunning) return;
    
    gamePaused = !gamePaused;
    
    if (gamePaused) {
        document.getElementById('pauseScore').textContent = score;
        document.getElementById('pauseCombo').textContent = 'x' + multiplier;
        document.getElementById('pauseTime').textContent = timeLeft;
        document.getElementById('pauseScreen').classList.remove('hidden');
    } else {
        document.getElementById('pauseScreen').classList.add('hidden');
        lastSpawnTime = performance.now();
        requestAnimationFrame(gameLoop);
    }
}

function quitGame() {
    gameRunning = false;
    gamePaused = false;
    if (timerInterval) clearInterval(timerInterval);
    if (animationId) cancelAnimationFrame(animationId);
    
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
}

function restartGame() {
    startGame();
}

function updateUI() {
    scoreDisplay.textContent = score;
    timeDisplay.textContent = timeLeft;
    comboDisplay.textContent = 'x' + multiplier;
    livesDisplay.textContent = lives;
    
    // Visual feedback
    scoreBox.style.transform = 'scale(1.1)';
    setTimeout(() => scoreBox.style.transform = 'scale(1)', 100);
}

function spawnObject() {
    const types = [
        OBJECT_TYPES.STAR, OBJECT_TYPES.STAR, OBJECT_TYPES.STAR,
        OBJECT_TYPES.KETUPAT, OBJECT_TYPES.KETUPAT,
        OBJECT_TYPES.BOMB, OBJECT_TYPES.BOMB
    ];
    
    // Rare items (10% chance each)
    if (Math.random() < 0.08) types.push(OBJECT_TYPES.GOLDEN_STAR);
    if (Math.random() < 0.05) types.push(OBJECT_TYPES.GOLDEN_KETUPAT);
    
    // Power-ups (5% chance each)
    if (Math.random() < 0.04) types.push(OBJECT_TYPES.SHIELD);
    if (Math.random() < 0.04) types.push(OBJECT_TYPES.MAGNET);
    if (Math.random() < 0.04) types.push(OBJECT_TYPES.DOUBLE);
    if (Math.random() < 0.04) types.push(OBJECT_TYPES.SLOWMO);
    
    // Time bonus (3% chance)
    if (Math.random() < 0.03) types.push(OBJECT_TYPES.TIME_BONUS);
    
    const type = types[Math.floor(Math.random() * types.length)];
    const size = type.size + (Math.random() * 8 - 4);
    const config = CONFIG[difficulty];
    
    fallingObjects.push({
        x: Math.random() * (canvas.width - size),
        y: -size,
        size: size,
        speed: (3 + Math.random() * 2) * config.speedMult,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.08,
        type: type,
        trail: []
    });
}

function createCatchParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        effectParticles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: color,
            size: 3 + Math.random() * 4
        });
    }
}

let lastFrameTime = 0;

function gameLoop(timestamp) {
    if (!gameRunning || gamePaused) return;
    
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Spawn objects
    const effectiveSpawnInterval = powerups.slowmo.active ? spawnInterval * 1.5 : spawnInterval;
    if (timestamp - lastSpawnTime > effectiveSpawnInterval) {
        spawnObject();
        lastSpawnTime = timestamp;
        const config = CONFIG[difficulty];
        spawnInterval = Math.max(300, config.spawnRate - (config.duration - timeLeft) * 8);
    }

    const catchY = canvas.height - PLAYER_HEIGHT - 10;
    const catchXStart = playerX + 10;
    const catchXEnd = playerX + PLAYER_WIDTH - 10;

    // Update and draw objects
    for (let i = fallingObjects.length - 1; i >= 0; i--) {
        let obj = fallingObjects[i];
        
        // Apply slowmo effect
        const speedMult = powerups.slowmo.active ? 0.4 : 1;
        obj.y += obj.speed * speedMult;
        obj.rotation += obj.rotationSpeed * speedMult;

        // Magnet effect
        if (powerups.magnet.active && !obj.type.isBomb) {
            const centerX = playerX + PLAYER_WIDTH / 2;
            const objCenterX = obj.x + obj.size / 2;
            const diff = centerX - objCenterX;
            obj.x += diff * 0.08;
        }

        // Add trail
        if (obj.type.rare || obj.type.isPowerup) {
            obj.trail.push({ x: obj.x + obj.size/2, y: obj.y + obj.size/2, alpha: 1 });
            if (obj.trail.length > 10) obj.trail.shift();
        }

        // Check catch
        if (obj.y + obj.size > catchY && obj.y < catchY + PLAYER_HEIGHT &&
            obj.x + obj.size > catchXStart && obj.x < catchXEnd) {
            
            if (obj.type.isBomb) {
                // Bomb hit
                if (powerups.shield.active) {
                    // Shield blocks bomb
                    powerups.shield.active = false;
                    powerups.shield.duration = 0;
                    createCatchParticles(obj.x + obj.size/2, obj.y + obj.size/2, '#457b9d', 12);
                    playSound('powerup');
                } else {
                    lives--;
                    combo = 0;
                    multiplier = 1;
                    screenShake();
                    createCatchParticles(obj.x + obj.size/2, obj.y + obj.size/2, '#ff6b6b', 12);
                    playSound('bomb');
                    
                    livesBox.style.background = 'linear-gradient(135deg, #ff0000 0%, #aa0000 100%)';
                    setTimeout(() => livesBox.style.background = '', 200);
                    
                    if (lives <= 0) {
                        endGame('lives');
                        return;
                    }
                }
            } else if (obj.type.isPowerup) {
                // Power-up collected
                const pType = obj.type.powerupType;
                powerups[pType].active = true;
                powerups[pType].duration = 8000;
                createCatchParticles(obj.x + obj.size/2, obj.y + obj.size/2, obj.type.color, 12);
                playSound('powerup');
                updatePowerupUI();
            } else if (obj.type.isTimeBonus) {
                // Time bonus
                timeLeft += 5;
                createCatchParticles(obj.x + obj.size/2, obj.y + obj.size/2, '#ff9f1c', 12);
                playSound('powerup');
                showComboPopup('+5 DETIK!');
            } else {
                // Regular item
                combo++;
                if (combo >= 10) multiplier = 3;
                else if (combo >= 5) multiplier = 2;
                else multiplier = 1;
                
                const points = obj.type.points * multiplier * (powerups.double.active ? 2 : 1);
                score += points;
                
                createCatchParticles(obj.x + obj.size/2, obj.y + obj.size/2, obj.type.color, obj.type.rare ? 15 : 8);
                
                if (obj.type.rare) {
                    playSound('rare');
                    showComboPopup('+' + points + ' RARE!');
                } else {
                    playSound('catch');
                    if (combo === 5) showComboPopup('COMBO x2!');
                    if (combo === 10) showComboPopup('COMBO x3!');
                }
            }
            
            updateUI();
            fallingObjects.splice(i, 1);
            continue;
        }

        // Remove if off screen
        if (obj.y > canvas.height) {
            // Missed item breaks combo
            if (!obj.type.isBomb && !obj.type.isPowerup && !obj.type.isTimeBonus) {
                combo = 0;
                multiplier = 1;
                updateUI();
            }
            fallingObjects.splice(i, 1);
            continue;
        }

        drawObject(obj);
    }

    // Draw effect particles
    for (let i = effectParticles.length - 1; i >= 0; i--) {
        let p = effectParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.life -= 0.03;
        
        if (p.life <= 0) {
            effectParticles.splice(i, 1);
        } else {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    animationId = requestAnimationFrame(gameLoop);
}

function drawObject(obj) {
    // Draw trail for rare/powerup items
    if (obj.trail && obj.trail.length > 0) {
        for (let i = 0; i < obj.trail.length; i++) {
            const t = obj.trail[i];
            const alpha = (i / obj.trail.length) * 0.5;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = obj.type.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }

    ctx.save();
    ctx.translate(obj.x + obj.size / 2, obj.y + obj.size / 2);
    ctx.rotate(obj.rotation);

    const half = obj.size / 2;

    if (obj.type === OBJECT_TYPES.STAR) {
        drawStar(ctx, half, '#d4a843', '#fff');
    } else if (obj.type === OBJECT_TYPES.GOLDEN_STAR) {
        // Glow effect
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 20;
        drawStar(ctx, half, '#ffd700', '#fffbe6');
        ctx.shadowBlur = 0;
    } else if (obj.type === OBJECT_TYPES.KETUPAT) {
        drawKetupat(ctx, half, '#2d8a54', '#d4a843');
    } else if (obj.type === OBJECT_TYPES.GOLDEN_KETUPAT) {
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 25;
        drawKetupat(ctx, half, '#00cc66', '#00ff88');
        ctx.shadowBlur = 0;
    } else if (obj.type === OBJECT_TYPES.BOMB) {
        drawBomb(ctx, half);
    } else if (obj.type.isPowerup) {
        ctx.shadowColor = obj.type.color;
        ctx.shadowBlur = 15;
        drawPowerup(ctx, half, obj.type.color, obj.type.powerupType);
        ctx.shadowBlur = 0;
    } else if (obj.type === OBJECT_TYPES.TIME_BONUS) {
        ctx.shadowColor = '#ff9f1c';
        ctx.shadowBlur = 15;
        drawClock(ctx, half);
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

function drawStar(ctx, half, fill, stroke) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const tx = Math.cos(angle) * half;
        const ty = Math.sin(angle) * half;
        i === 0 ? ctx.moveTo(tx, ty) : ctx.lineTo(tx, ty);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function drawKetupat(ctx, half, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(0, -half);
    ctx.lineTo(half, 0);
    ctx.lineTo(0, half);
    ctx.lineTo(-half, 0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Weave pattern
    ctx.beginPath();
    ctx.moveTo(0, -half);
    ctx.lineTo(0, half);
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawBomb(ctx, half) {
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a2a';
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Fuse
    ctx.beginPath();
    ctx.moveTo(0, -half * 0.7);
    ctx.lineTo(0, -half);
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Spark
    const sparkSize = 3 + Math.sin(Date.now() / 100) * 2;
    ctx.beginPath();
    ctx.arc(0, -half, sparkSize, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6b35';
    ctx.fill();
}

function drawPowerup(ctx, half, color, type) {
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Icon
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#fff';
    
    if (type === 'shield') {
        ctx.beginPath();
        ctx.moveTo(0, -half * 0.5);
        ctx.lineTo(half * 0.5, -half * 0.2);
        ctx.lineTo(half * 0.5, half * 0.3);
        ctx.lineTo(0, half * 0.6);
        ctx.lineTo(-half * 0.5, half * 0.3);
        ctx.lineTo(-half * 0.5, -half * 0.2);
        ctx.closePath();
        ctx.stroke();
    } else if (type === 'magnet') {
        ctx.beginPath();
        ctx.arc(0, half * 0.2, half * 0.5, Math.PI, 0);
        ctx.moveTo(half * 0.5, half * 0.2);
        ctx.lineTo(half * 0.5, -half * 0.3);
        ctx.moveTo(-half * 0.5, half * 0.2);
        ctx.lineTo(-half * 0.5, -half * 0.3);
        ctx.stroke();
    } else if (type === 'double') {
        ctx.font = `bold ${half}px Poppins`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('2X', 0, 2);
    } else if (type === 'slowmo') {
        ctx.beginPath();
        ctx.arc(0, 0, half * 0.4, 0, Math.PI * 1.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -half * 0.4);
        ctx.lineTo(half * 0.2, -half * 0.2);
        ctx.lineTo(0, 0);
        ctx.fill();
    }
}

function drawClock(ctx, half) {
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9f1c';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Clock hands
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -half * 0.5);
    ctx.moveTo(0, 0);
    ctx.lineTo(half * 0.3, 0);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // +5 text
    ctx.font = `bold ${half * 0.5}px Poppins`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('+5', 0, half * 1.3);
}

function endGame(reason) {
    gameRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    if (animationId) cancelAnimationFrame(animationId);
    
    timeBox.classList.remove('time-warning');
    
    // Check high score
    const isNewHighScore = score > highScore;
    if (isNewHighScore) {
        highScore = score;
        localStorage.setItem('lebaranHighScore', highScore);
        document.getElementById('highScoreValue').textContent = highScore;
    }
    
    const config = CONFIG[difficulty];
    
    if (reason === 'lives') {
        document.getElementById('loseScore').textContent = score;
        document.getElementById('newHighscoreBadgeLose').classList.toggle('hidden', !isNewHighScore);
        document.getElementById('loseScreen').classList.remove('hidden');
        playSound('lose');
    } else if (reason === 'timeup') {
        if (score >= config.targetScore) {
            // Win condition
            document.getElementById('finalScore').textContent = score;
            document.getElementById('newHighscoreBadge').classList.toggle('hidden', !isNewHighScore);
            document.getElementById('winScreen').classList.remove('hidden');
        } else {
            // Time up but not enough score
            document.getElementById('timeUpScore').textContent = score;
            document.getElementById('newHighscoreBadgeTimeUp').classList.toggle('hidden', !isNewHighScore);
            document.getElementById('timeUpScreen').classList.remove('hidden');
            playSound('lose');
        }
    }
}