
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const endCard = document.getElementById('end-card');
const endTitle = document.getElementById('end-title');
const endDesc = document.getElementById('end-desc');
const ctaLink = document.getElementById('cta-link');
const retryBtn = document.getElementById('retry-btn');
const tapHint = document.getElementById('tap-hint');
const header = document.getElementById('header');

// Game Constants
const WIDTH = 320;
const HEIGHT = 480;
const COLS = 6; // Simplified grid
const ROWS = 8;
const GRID_W = WIDTH / COLS; // ~53.3px
const GRID_H = HEIGHT / ROWS; // 60px

// Game State
let gameState = 'start'; // start, playing, win, gameover
let lastTime = 0;

// Entities
var player;
let obstacles = [];
const goalImage = new Image();
goalImage.src = 'assets/goals.png';

// Trendyol Colors
const COLOR_PRIMARY = '#F27A1A';
const COLOR_BG = '#333333';
const COLOR_ROAD = '#444444';
const COLOR_SAFE = '#555555';

// Input
let touchStartX = 0;
let touchStartY = 0;

// Configs for goals (Top Row)
// We assume we display the left part of the image.
// Let's divide the top row into 3 zones corresponding to the visual icons.
// Zone 1 (Left): Price Drops
// Zone 2 (Center): Food
// Zone 3 (Right): Plus/Coupons
const DESTINATIONS = [
    { name: "Fırsatlar", url: "https://www.trendyol.com/butik/liste/1/kadin", desc: "Günün Fırsatları Seni Bekliyor!" },
    { name: "Yemek", url: "https://www.trendyol.com/yemek", desc: "Acıktın mı? Hemen Söyle!" },
    { name: "Ayrıcalıklar", url: "https://www.trendyol.com/trendyol-plus", desc: "Ayrıcalıkları Keşfet!" }
];

function init() {
    resetGame();
    setupInput();
    requestAnimationFrame(loop);
}

function resetGame() {
    gameState = 'start';
    endCard.style.display = 'none';
    tapHint.style.display = 'block';
    header.style.display = 'block';

    player = {
        x: 2, // Center-ish
        y: ROWS - 1,
        color: '#ffffff',
    };

    obstacles = [];
    // Just 2 simple lanes of traffic
    // Row 4 (Middle) - Moving Right
    createLane(4, 1.5, 2, 'car');
    // Row 5 (Lower Middle) - Moving Left
    createLane(5, -2, 2, 'car');

    // Row 2-3 are safe "buffer" zones to prepare for choice
}

function createLane(row, speed, count, type) {
    const spacing = COLS / count;
    for (let i = 0; i < count; i++) {
        obstacles.push({
            x: i * spacing,
            y: row,
            w: 1.2, // bit wider cars
            h: 0.7,
            speed: speed,
            color: speed > 0 ? '#E53935' : '#1E88E5' // Red/Blue
        });
    }
}

function setupInput() {
    // Touch
    canvas.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].clientX;
        touchStartY = e.changedTouches[0].clientY;
        if (gameState === 'start') {
            startGame();
        }
        e.preventDefault();
    }, {passive: false});

    canvas.addEventListener('touchend', e => {
        if (gameState !== 'playing') return;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        handleInput(touchStartX, touchStartY, touchEndX, touchEndY);
        e.preventDefault();
    }, {passive: false});

    // Mouse/Click for testing
    canvas.addEventListener('mousedown', e => {
        touchStartX = e.clientX;
        touchStartY = e.clientY;
        if (gameState === 'start') {
            startGame();
        }
    });

    canvas.addEventListener('mouseup', e => {
        if (gameState !== 'playing') return;
        const touchEndX = e.clientX;
        const touchEndY = e.clientY;
        handleInput(touchStartX, touchStartY, touchEndX, touchEndY);
    });

    // Keyboard for easy testing
    window.addEventListener('keydown', e => {
        if (gameState === 'start') {
            startGame();
            return;
        }
        if (gameState !== 'playing') return;

        switch(e.key) {
            case 'ArrowLeft': movePlayer(-1, 0); break;
            case 'ArrowRight': movePlayer(1, 0); break;
            case 'ArrowUp': movePlayer(0, -1); break;
            case 'ArrowDown': movePlayer(0, 1); break;
        }
    });

    retryBtn.addEventListener('click', () => {
        resetGame();
    });
}

function startGame() {
    gameState = 'playing';
    tapHint.style.display = 'none';
    lastTime = performance.now();
}

function handleInput(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // If movement is very small, treat as TAP
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        // Tap Zones
        // x1 is the click position
        // Determine relative to canvas width

        // We need to account for canvas scaling if any, but since we use exact px in CSS:
        // x1 is clientX.
        // We should really get bounding client rect if canvas isn't full screen or centered awkwardly.
        // But for this simplified environment (canvas is centered), let's use the touch coords directly
        // assuming they match reasonably well or just use window width.
        // Actually, let's look at where the canvas is.
        const rect = canvas.getBoundingClientRect();
        const tapX = x1 - rect.left;

        const third = rect.width / 3;

        if (tapX < third) {
            movePlayer(-1, 0); // Left
        } else if (tapX > 2 * third) {
            movePlayer(1, 0); // Right
        } else {
            movePlayer(0, -1); // Center -> Forward
        }
        return;
    }

    // Swipe Logic (Keep this for users who actually swipe)
    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal
        if (Math.abs(dx) > 20) {
            if (dx > 0) movePlayer(1, 0);
            else movePlayer(-1, 0);
        }
    } else {
        // Vertical
        if (Math.abs(dy) > 20) {
            if (dy > 0) movePlayer(0, 1);
            else movePlayer(0, -1);
        }
    }
}

function movePlayer(dx, dy) {
    if (gameState !== 'playing') return;

    const nextX = player.x + dx;
    const nextY = player.y + dy;

    if (nextX < 0 || nextX >= COLS) return;

    // Win Condition Check
    if (nextY <= 0) {
        // Reached the top (Row 0 is the goal image)
        finishGame(nextX);
        return;
    }

    if (nextY >= ROWS) return; // Can't go below bottom

    player.x = nextX;
    player.y = nextY;
}

function update(dt) {
    if (gameState !== 'playing') return;

    // Obstacles
    obstacles.forEach(obs => {
        obs.x += obs.speed * dt;
        if (obs.speed > 0 && obs.x > COLS) obs.x = -obs.w;
        if (obs.speed < 0 && obs.x < -obs.w) obs.x = COLS;

        // Collision (Simple AABB)
        // Player hitbox is smaller than cell
        const pX = player.x + 0.2;
        const pY = player.y + 0.2;
        const pW = 0.6;
        const pH = 0.6;

        const oX = obs.x;
        const oY = obs.y + 0.15;
        const oW = obs.w;
        const oH = obs.h;

        if (pX < oX + oW &&
            pX + pW > oX &&
            pY < oY + oH &&
            pY + pH > oY) {
            // Crash!
            // For this simple ad, maybe just reset player to start line or game over?
            // "Instant Restart" is better for ads than "Game Over" screen usually,
            // but let's do a quick shake or push back.
            // Let's push back to start.
            player.x = 2;
            player.y = ROWS - 1;
        }
    });
}

function finishGame(column) {
    gameState = 'win';

    // Determine which goal was hit
    // 6 Columns.
    // Col 0-1: Dest 0
    // Col 2-3: Dest 1
    // Col 4-5: Dest 2
    let destIndex = Math.floor(column / 2);
    if (destIndex > 2) destIndex = 2;

    const dest = DESTINATIONS[destIndex];

    endTitle.innerText = dest.name;
    endDesc.innerText = dest.desc;
    ctaLink.href = dest.url;
    ctaLink.innerText = dest.name + " Git";

    header.style.display = 'none';
    endCard.style.display = 'flex';
}

function draw() {
    // Clear
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 1. Draw Goal Image Area (Row 0 & 1) - Height = 2 * GRID_H = 120px
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, WIDTH, GRID_H * 1.5);

    if (goalImage.complete) {
        // Source Image Logic
        // We want to show the first ~3-4 icons.
        // Assuming image is ~1000px wide and has 10 icons.
        // We want first ~350px of source to map to 320px of canvas.
        // Let's blindly guess scale.
        // We want to fit height.

        // Let's calculate aspect ratio of the draw area: 320x90 (1.5 rows)
        // Draw the image such that icons are visible.
        // Source: 0, 0, sw, sh
        // Dest: 0, 0, WIDTH, GRID_H * 1.5

        // If we just draw the whole image compressed, icons are tiny.
        // Let's draw a cropped version: Left 40% of image.
        const sW = goalImage.width * 0.45;
        const sH = goalImage.height;

        ctx.drawImage(goalImage,
            0, 0, sW, sH, // Source crop
            0, 0, WIDTH, GRID_H * 1.5 // Dest
        );
    } else {
        // Fallback if image not loaded yet
        ctx.fillStyle = '#eee';
        ctx.fillRect(0, 0, WIDTH, GRID_H * 1.5);
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillText("FIRSATLAR   |   YEMEK   |   PLUS", WIDTH/2, 50);
    }

    // 2. Safe Zones
    // Row 2, 3, 6, 7
    // ctx.fillStyle = '#333';
    // ctx.fillRect(0, 2 * GRID_H, WIDTH, 6 * GRID_H);

    // 3. Road (Row 4-5)
    ctx.fillStyle = COLOR_ROAD;
    ctx.fillRect(0, 4 * GRID_H, WIDTH, 2 * GRID_H);

    // Road Markings
    ctx.strokeStyle = '#666';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, 5 * GRID_H);
    ctx.lineTo(WIDTH, 5 * GRID_H);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Start Zone (Row 7)
    ctx.fillStyle = COLOR_SAFE;
    ctx.fillRect(0, 7 * GRID_H, WIDTH, GRID_H);

    // Entities
    obstacles.forEach(obs => {
        ctx.fillStyle = obs.color;
        // Simple car shape
        const x = obs.x * GRID_W;
        const y = obs.y * GRID_H + 10;
        const w = obs.w * GRID_W;
        const h = GRID_H - 20;

        ctx.fillRect(x, y, w, h);
        // Roof
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
    });

    // Player
    const px = player.x * GRID_W + GRID_W/2;
    const py = player.y * GRID_H + GRID_H/2;
    const pSize = GRID_W * 0.6;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(px, py + pSize/2, pSize/2, 5, 0, 0, Math.PI*2);
    ctx.fill();

    // Body
    ctx.fillStyle = COLOR_PRIMARY;
    ctx.beginPath();
    ctx.arc(px, py, pSize/2, 0, Math.PI*2);
    ctx.fill();

    // Logo "TY"
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("TY", px, py);

    // Helper Text for Categories
    // Removed to keep UI clean, the icons are self explanatory.
}

function loop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(loop);
}

// Start
init();
