
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const endCard = document.getElementById('end-card');
const endMessage = document.getElementById('end-message');
const retryBtn = document.getElementById('retry-btn');

// Game Constants
const GRID_SIZE = 50;
const COLS = 11;
const ROWS = 13;
const LOGICAL_WIDTH = COLS * GRID_SIZE;
const LOGICAL_HEIGHT = ROWS * GRID_SIZE;

// Game State
let gameState = 'playing';
let score = 0;
let animationId;
let lastTime = 0;

// Entities
let player;
let obstacles = [];
let floats = [];

// Trendyol Colors
const COLOR_PRIMARY = '#F27A1A';
const COLOR_BG = '#333333';
const COLOR_ROAD = '#444444';
const COLOR_WATER = '#64B5F6'; // Blue-ish for water/canal
const COLOR_SAFE = '#666666'; // Sidewalk

// Images / Sprites (Procedural)
// We will draw them using canvas primitives

// Key Input
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

// Touch Input
let touchStartX = 0;
let touchStartY = 0;

function init() {
    resize();
    resetGame();
    setupInput();
    requestAnimationFrame(loop);
}

function resize() {
    const scale = Math.min(window.innerWidth / LOGICAL_WIDTH, window.innerHeight / LOGICAL_HEIGHT);
    canvas.width = LOGICAL_WIDTH * scale;
    canvas.height = LOGICAL_HEIGHT * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0); // Use setTransform to reset and scale
}

window.addEventListener('resize', resize);

function resetGame() {
    gameState = 'playing';
    endCard.style.display = 'none';
    score = 0;
    updateScore();

    player = {
        x: Math.floor(COLS / 2),
        y: ROWS - 1, // Start at bottom
        width: 0.8,
        height: 0.8,
        color: '#ffffff',
        safe: true
    };

    initLevel();
    lastTime = performance.now();
}

function initLevel() {
    obstacles = [];
    floats = [];

    // Layout:
    // 0: Top Banner / UI buffer
    // 1: Goal (Home)
    // 2-5: Water (Canal)
    // 6: Safe (Median)
    // 7-11: Road (Traffic)
    // 12: Start (Sidewalk)

    // Road - Faster/More Traffic
    createLane(11, 'car', -2, 3);
    createLane(10, 'truck', 2.5, 2, 2);
    createLane(9, 'car', -3.5, 3);
    createLane(8, 'truck', 1.5, 2, 2);
    createLane(7, 'car', -4, 2); // Fast lane

    // Water - Logs/Boats
    createLane(5, 'log', 2, 3, 2);
    createLane(4, 'log', -2.5, 2, 3);
    createLane(3, 'log', 3, 3, 2);
    createLane(2, 'log', -1.5, 3, 2);
}

function createLane(row, type, speed, count, width = 1) {
    const spacing = COLS / count;
    for (let i = 0; i < count; i++) {
        let x = (i * spacing) + (Math.random() * 2);
        if (type === 'car' || type === 'truck') {
            obstacles.push({
                x: x,
                y: row,
                w: width,
                h: 0.8,
                speed: speed,
                type: type,
                color: type === 'car' ? '#E53935' : '#1E88E5'
            });
        } else {
            floats.push({
                x: x,
                y: row,
                w: width,
                h: 0.8,
                speed: speed,
                type: type,
                color: '#8D6E63' // Log color
            });
        }
    }
}

function setupInput() {
    window.addEventListener('keydown', e => {
        if (gameState !== 'playing') return;
        switch(e.key) {
            case 'ArrowUp': movePlayer(0, -1); break;
            case 'ArrowDown': movePlayer(0, 1); break;
            case 'ArrowLeft': movePlayer(-1, 0); break;
            case 'ArrowRight': movePlayer(1, 0); break;
        }
    });

    canvas.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].clientX; // Use clientX/Y to handle scaling better if needed, but relative usually fine
        touchStartY = e.changedTouches[0].clientY;
        e.preventDefault(); // Prevent scrolling
    }, {passive: false});

    canvas.addEventListener('touchend', e => {
        if (gameState !== 'playing') return;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
        e.preventDefault();
    }, {passive: false});

    retryBtn.addEventListener('click', () => {
        resetGame();
    });
}

function handleSwipe(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Tap detection (minimal movement)
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        movePlayer(0, -1); // Tap to move forward
        return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 20) {
            if (dx > 0) movePlayer(1, 0);
            else movePlayer(-1, 0);
        }
    } else {
        if (Math.abs(dy) > 20) {
            if (dy > 0) movePlayer(0, 1);
            else movePlayer(0, -1);
        }
    }
}

function movePlayer(dx, dy) {
    const nextX = Math.round(player.x) + dx; // Snap to grid on input
    const nextY = Math.round(player.y) + dy;

    // Bounds check
    if (nextX < 0 || nextX >= COLS) return;
    if (nextY < 1 || nextY > ROWS - 1) {
        // Allow moving to Goal (Row 1)
        if (nextY === 1) {
            player.x = nextX;
            player.y = nextY;
            gameWin();
            return;
        }
        // Don't allow moving past start or goal area (except winning)
         if (nextY > ROWS - 1) return;
    }

    player.x = nextX;
    player.y = nextY;
}

function update(dt) {
    if (gameState !== 'playing') return;

    // Update Obstacles
    obstacles.forEach(obs => {
        obs.x += obs.speed * dt;
        if (obs.speed > 0 && obs.x > COLS) obs.x = -obs.w;
        if (obs.speed < 0 && obs.x < -obs.w) obs.x = COLS;
    });

    // Update Floats
    floats.forEach(f => {
        f.x += f.speed * dt;
        if (f.speed > 0 && f.x > COLS) f.x = -f.w;
        if (f.speed < 0 && f.x < -f.w) f.x = COLS;
    });

    // Player collision & Float logic
    checkCollisions(dt);

    // Keep player in bounds if floating pushed them
    if (player.x < 0) player.x = 0;
    if (player.x >= COLS - 1 + 0.2) player.x = COLS - 1;
}

function checkCollisions(dt) {
    const r = Math.round(player.y); // Current row

    // Water (Rows 2-5)
    if (r >= 2 && r <= 5) {
        let onFloat = false;
        let floatSpeed = 0;

        // Player hitbox (centered)
        const px = player.x + 0.5;

        floats.forEach(f => {
            if (r === f.y) {
                 // Check if player center is within float bounds
                 if (px >= f.x && px <= f.x + f.w) {
                     onFloat = true;
                     floatSpeed = f.speed;
                 }
            }
        });

        if (onFloat) {
            player.x += floatSpeed * dt;
        } else {
            // Check if we are really in the water lane (and not just transitioning)
            // For grid based movement, y is integer.
            gameOver();
        }
    }

    // Road (Rows 7-11)
    if (r >= 7 && r <= 11) {
        const pLeft = player.x + 0.1;
        const pRight = player.x + 0.9;

        obstacles.forEach(obs => {
             if (r === obs.y) {
                 const oLeft = obs.x;
                 const oRight = obs.x + obs.w;

                 // Overlap check
                 if (pLeft < oRight && pRight > oLeft) {
                     gameOver();
                 }
             }
        });
    }
}


function draw() {
    // Clear
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // --- Backgrounds ---

    // Goal (Row 1)
    ctx.fillStyle = '#C8E6C9'; // Light Green
    ctx.fillRect(0, 1 * GRID_SIZE, LOGICAL_WIDTH, GRID_SIZE);
    // Draw Goal Houses
    for(let i=0; i<COLS; i+=2) {
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(i * GRID_SIZE + 5, 1 * GRID_SIZE + 5, GRID_SIZE - 10, GRID_SIZE - 10);
    }

    // Water (Row 2-5)
    ctx.fillStyle = COLOR_WATER;
    ctx.fillRect(0, 2 * GRID_SIZE, LOGICAL_WIDTH, 4 * GRID_SIZE);

    // Safe Median (Row 6)
    ctx.fillStyle = COLOR_SAFE;
    ctx.fillRect(0, 6 * GRID_SIZE, LOGICAL_WIDTH, GRID_SIZE);

    // Road (Row 7-11)
    ctx.fillStyle = COLOR_ROAD;
    ctx.fillRect(0, 7 * GRID_SIZE, LOGICAL_WIDTH, 5 * GRID_SIZE);
    // Road Markings
    ctx.strokeStyle = '#FFFFFF';
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 2;
    for(let r=8; r<=11; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * GRID_SIZE);
        ctx.lineTo(LOGICAL_WIDTH, r * GRID_SIZE);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // Start (Row 12)
    ctx.fillStyle = COLOR_SAFE;
    ctx.fillRect(0, 12 * GRID_SIZE, LOGICAL_WIDTH, GRID_SIZE);


    // --- Entities ---

    // Floats
    floats.forEach(f => {
        ctx.fillStyle = f.color;
        // Draw as log with rounded ends
        drawRoundedRect(ctx, f.x * GRID_SIZE, f.y * GRID_SIZE + 5, f.w * GRID_SIZE, GRID_SIZE - 10, 5);
    });

    // Obstacles
    obstacles.forEach(obs => {
        ctx.fillStyle = obs.color;
        // Car body
        drawRoundedRect(ctx, obs.x * GRID_SIZE, obs.y * GRID_SIZE + 8, obs.w * GRID_SIZE, GRID_SIZE - 16, 5);
        // Roof
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        drawRoundedRect(ctx, obs.x * GRID_SIZE + 5, obs.y * GRID_SIZE + 12, obs.w * GRID_SIZE - 10, GRID_SIZE - 24, 2);
    });

    // Player
    drawPlayer();
}

function drawPlayer() {
    const x = player.x * GRID_SIZE;
    const y = player.y * GRID_SIZE;
    const size = GRID_SIZE;
    const padding = 5;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + size/2, y + size - 5, size/3, 5, 0, 0, Math.PI*2);
    ctx.fill();

    // Box Body
    ctx.fillStyle = COLOR_PRIMARY; // Trendyol Orange
    drawRoundedRect(ctx, x + padding, y + padding, size - padding*2, size - padding*2, 5);

    // Tape / Branding
    ctx.fillStyle = '#FFFFFF'; // White tape
    ctx.fillRect(x + size/2 - 3, y + padding, 6, size - padding*2);

    // Logo text (tiny)
    ctx.fillStyle = 'black';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TY', x + size/2, y + size/2 + 3);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

function loop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (dt < 0.1) { // Prevent huge jumps if tab was inactive
        update(dt);
    }
    draw();

    if (gameState === 'playing') {
        animationId = requestAnimationFrame(loop);
    }
}

function gameOver() {
    if (gameState !== 'playing') return;
    gameState = 'gameover';
    endMessage.innerText = "Teslimat Başarısız!";
    endMessage.style.color = '#F44336';
    endCard.style.display = 'flex';
}

function gameWin() {
    if (gameState !== 'playing') return;
    gameState = 'win';
    score += 100;
    updateScore();
    endMessage.innerText = "Teslimat Başarılı!";
    endMessage.style.color = COLOR_PRIMARY;
    endCard.style.display = 'flex';
}

function updateScore() {
    scoreEl.innerText = score;
}

// Start
init();
