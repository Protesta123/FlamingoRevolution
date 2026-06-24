// ── ELEMENTS ──
const game       = document.getElementById("game");
const player     = document.getElementById("player");
const scoreEl    = document.getElementById("score");
const livesEl    = document.getElementById("lives");
const msgEl      = document.getElementById("message");
const startScreen= document.getElementById("startScreen");

// ── SOUNDS ──
const collectSound  = new Audio("sounds/collect.mp3");
const hitSound      = new Audio("sounds/hit.mp3");
const levelSound    = new Audio("sounds/levelup.mp3");
const victorySound  = new Audio("sounds/victory.mp3");
const wavesSound    = new Audio("sounds/waves.mp3");
const flamingoSound = new Audio("sounds/flamingo.mp3");

collectSound.volume  = 0.4;
hitSound.volume      = 0.5;
levelSound.volume    = 0.6;
victorySound.volume  = 0.7;
wavesSound.volume    = 0.35;
wavesSound.loop      = true;
flamingoSound.volume = 0.6;
flamingoSound.loop   = true;

function playSound(sound) {
    sound.currentTime = 0;
    sound.play().catch(() => {});
}

function startFlamingoMusic() {
    flamingoSound.currentTime = 0;
    flamingoSound.play().catch(() => {});
}

function stopFlamingoMusic() {
    flamingoSound.pause();
    flamingoSound.currentTime = 0;
}

// Play flamingo music on page load (start screen)
// Browsers block autoplay until user interaction — so we try on first touch/click
let flamingoStarted = false;
function tryStartFlamingo() {
    if (flamingoStarted) return;
    flamingoStarted = true;
    startFlamingoMusic();
}
document.addEventListener("touchstart", tryStartFlamingo, { once: true });
document.addEventListener("mousedown",  tryStartFlamingo, { once: true });

// ── STATE ──
let playerX, score, lives, combo, level, speed;
let gameRunning     = false;
let panicMode       = false;
let isNight         = false;
let invincible      = false;
let shielded        = false;
let multiplier      = 1;
let multiplierTimer = null;
let spawnTimer;

const SW = () => window.innerWidth;
const SH = () => window.innerHeight;

// ── START GAME ──
function startGame() {
    // Stop start screen music
    stopFlamingoMusic();

    // Unlock game audio
    if (wavesSound.paused) {
        wavesSound.currentTime = 0;
        wavesSound.play().catch(() => {});
    }
    [collectSound, hitSound, levelSound, victorySound].forEach(s => {
        s.load();
        s.play().then(() => { s.pause(); s.currentTime = 0; }).catch(() => {});
    });

    startScreen.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:20px;width:min(90vw,400px);">
            <div id="loadTitle" style="font-size:clamp(1.4rem,5vw,2rem);font-weight:900;letter-spacing:-1px;text-shadow:0 3px 0 rgba(0,0,0,0.3);">
                🦩 Mobilizing flamingos...
            </div>
            <div style="width:100%;height:22px;background:rgba(0,0,0,0.35);border-radius:999px;overflow:hidden;border:2px solid rgba(255,255,255,0.15);">
                <div id="loadBar" style="height:100%;width:0%;background:linear-gradient(90deg,#ff4081,#ff7ab3);border-radius:999px;transition:width 0.3s ease;box-shadow:0 0 12px rgba(255,64,129,0.6);"></div>
            </div>
            <div id="loadLabel" style="font-size:14px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.6);text-transform:uppercase;">0%</div>
        </div>`;

    const messages = [
        "🦩 Mobilizing flamingos...",
        "🌊 Checking the lagoon...",
        "🚨 Edi Rama spotted nearby...",
        "🛡️ Arming the revolution...",
        "🦩 Almost ready..."
    ];

    const loadBar   = document.getElementById("loadBar");
    const loadLabel = document.getElementById("loadLabel");
    const titleEl   = document.getElementById("loadTitle");
    let progress = 0;
    const checkpoints = [18, 35, 52, 68, 80, 91, 100];
    let cpIndex = 0;

    function crawlTo(target, done) {
        const step = () => {
            if (progress >= target) { done(); return; }
            progress += Math.random() * 1.5 + 0.4;
            if (progress > target) progress = target;
            loadBar.style.width = progress + "%";
            loadLabel.innerText = Math.floor(progress) + "%";
            titleEl.innerText = messages[Math.min(Math.floor((progress / 100) * messages.length), messages.length - 1)];
            setTimeout(step, 40);
        };
        step();
    }

    function nextCheckpoint() {
        if (cpIndex >= checkpoints.length) return;
        const target = checkpoints[cpIndex++];
        crawlTo(target, () => {
            if (progress >= 100) {
                loadLabel.innerText = "Let's go! 🦩";
                setTimeout(launch, 700);
            } else {
                setTimeout(nextCheckpoint, 150 + Math.random() * 400);
            }
        });
    }
    nextCheckpoint();

    function launch() {
        score      = 0;
        lives      = 3;
        combo      = 0;
        level      = 1;
        speed      = 6;
        multiplier = 1;
        shielded   = false;
        invincible = false;
        isNight    = false;
        gameRunning= true;

        document.querySelector(".mountains-bg").style.filter = "brightness(1)";
        document.querySelector(".grass").style.filter        = "brightness(1)";
        document.getElementById("nightOverlay").classList.remove("active");
        document.querySelectorAll(".cloud").forEach(c => c.style.opacity = "0.88");
        const sun = document.querySelector(".sun");
        if (sun) sun.style.background = "radial-gradient(circle,#fff7a0 30%,#ffd84d 65%,transparent 100%)";

        game.style.background = "linear-gradient(to bottom,#4ec0ca,#70d0da,#c9eaf5,#dff5ff)";

        scoreEl.innerText = score;
        livesEl.innerText = "❤️❤️❤️";
        msgEl.innerText   = "";

        player.style.filter = "drop-shadow(0 0 8px #ff7ac8) drop-shadow(0 0 18px #ff7ac8) drop-shadow(0 0 30px #ff7ac8)";

        playerX = SW() / 2;
        updatePlayer();

        startScreen.style.display = "none";
        document.querySelectorAll(".item").forEach(i => i.remove());

        clearTimeout(spawnTimer);
        spawnLoop();
        gameLoop();
        showMessage("🦩 Save Sazan Island!");
    }
}

// ── MESSAGES ──
let msgTimeout;
function showMessage(text) {
    clearTimeout(msgTimeout);
    msgEl.innerText = text;
    msgEl.style.transform = "translateX(-50%) scale(1.15)";
    setTimeout(() => msgEl.style.transform = "translateX(-50%) scale(1)", 150);
    msgTimeout = setTimeout(() => { msgEl.innerText = ""; }, 1800);
}

// ── SPAWN ──
function spawnLoop() {
    if (!gameRunning) return;
    spawnObject();
    const spawnRate = Math.max(120, 600 - Math.floor(score / 1.8));
    spawnTimer = setTimeout(spawnLoop, spawnRate);
}

function getRamaSize() {
    return Math.min(130, Math.max(60, Math.round(SW() * 0.13)));
}
function getFlamSize() {
    return Math.min(70, Math.max(40, Math.round(SW() * 0.11)));
}

function spawnObject() {
    const div = document.createElement("div");
    div.className = "item";

    const obstacleChance = Math.min(0.85, 0.55 + score / 700);
    const roll = Math.random();
    const canPowerUp = score > 50;

    if (canPowerUp && roll < 0.04) {
        div.dataset.good = "shield";
        div.innerText = "🛡️";
        div.style.fontSize = getFlamSize() + "px";
    } else if (canPowerUp && roll < 0.07) {
        div.dataset.good = "multi";
        div.innerText = "⚡";
        div.style.fontSize = getFlamSize() + "px";
    } else if (roll < obstacleChance) {
        div.dataset.good = "false";
        const ramaSize = getRamaSize();
        const size = score >= 300 ? Math.min(ramaSize * 1.35, 170) : ramaSize;
        div.innerHTML = `<img src="images/EdiRama.png" class="rama-img" style="width:${Math.round(size)}px;">`;
    } else {
        div.dataset.good = "true";
        const flamSize = getFlamSize();
        div.innerText = (Math.random() < 0.07) ? "✨🦩" : "🦩";
        div.style.fontSize = flamSize + "px";
    }

    const itemW = getFlamSize();
    const maxX  = SW() - itemW - 10;
    div.style.left = (10 + Math.random() * maxX) + "px";
    div.style.top  = "-80px";

    if (isNight && div.dataset.good === "false") {
        div.dataset.sineOffset  = Math.random() * Math.PI * 2;
        div.dataset.sineOriginX = parseFloat(div.style.left);
    }

    game.appendChild(div);
}

// ── GAME LOOP ──
let frame = 0;
function gameLoop() {
    if (!gameRunning) return;
    frame++;

    document.querySelectorAll(".item").forEach(function(item) {
        let y = parseFloat(item.style.top);
        y += speed;
        item.style.top = y + "px";

        if (isNight && item.dataset.good === "false" && item.dataset.sineOffset !== undefined) {
            const originX = parseFloat(item.dataset.sineOriginX);
            const drift   = Math.sin(frame * 0.06 + parseFloat(item.dataset.sineOffset)) * 28;
            const newX    = Math.max(0, Math.min(SW() - getRamaSize(), originX + drift));
            item.style.left = newX + "px";
        }

        const iRect = item.getBoundingClientRect();
        const pRect = player.getBoundingClientRect();

        const hit =
            iRect.left + 8 < pRect.right  - 8 &&
            iRect.right- 8 > pRect.left   + 8 &&
            iRect.top  + 8 < pRect.bottom - 8 &&
            iRect.bottom-8 > pRect.top    + 8;

        if (hit) {
            const type = item.dataset.good;
            if      (type === "true")   collectItem(item);
            else if (type === "shield") collectShield(item);
            else if (type === "multi")  collectMulti(item);
            else                        loseLife();
            item.remove();
        }

        if (y > SH() + 80) item.remove();
    });

    requestAnimationFrame(gameLoop);
}

// ── COLLECT FLAMINGO ──
function collectItem(item) {
    const isGolden = item.innerText.includes("✨");
    const pts = (isGolden ? 50 : 10) * multiplier;
    score += pts;
    playSound(collectSound);
    spawnFloatingText("+" + pts, item.style.left, item.style.top, isGolden ? "#ffd700" : "#fff");

    combo++;
    if (combo === 5) {
        score += 30 * multiplier;
        showMessage("🔥 COMBO x5! +" + (30 * multiplier));
        combo = 0;
    } else if (combo === 10) {
        score += 100 * multiplier;
        showMessage("💥 MEGA COMBO x10! +" + (100 * multiplier));
        combo = 0;
    }

    scoreEl.innerText = score;
    updateDayNight();

    const newLevel = Math.floor(score / 120) + 1;
    if (newLevel > level) {
        level = newLevel;
        speed += 1.4;
        playSound(levelSound);
        showMessage("🚨 PROTEST LEVEL " + level + (multiplier > 1 ? " ⚡2x" : ""));
    }

    if (score > 0 && score % 250 === 0) moneyStorm();
    // endless mode — no victory
}

// ── POWER-UPS ──
function collectShield(item) {
    shielded = true;
    playSound(collectSound);
    showMessage("🛡️ SHIELD ACTIVE!");
    player.style.filter = "drop-shadow(0 0 10px #00cfff) drop-shadow(0 0 24px #00cfff) drop-shadow(0 0 40px #00cfff)";
    spawnFloatingText("🛡️ SHIELD", item.style.left, item.style.top, "#00cfff");
    setTimeout(() => {
        shielded = false;
        player.style.filter = "drop-shadow(0 0 8px #ff7ac8) drop-shadow(0 0 18px #ff7ac8) drop-shadow(0 0 30px #ff7ac8)";
        showMessage("🛡️ Shield gone!");
    }, 6000);
}

function collectMulti(item) {
    multiplier = 2;
    playSound(collectSound);
    showMessage("⚡ 2x SCORE ACTIVE!");
    player.style.filter = "drop-shadow(0 0 10px #ffd700) drop-shadow(0 0 24px #ffd700) drop-shadow(0 0 40px #ffd700)";
    spawnFloatingText("⚡ 2x!", item.style.left, item.style.top, "#ffd700");
    clearTimeout(multiplierTimer);
    multiplierTimer = setTimeout(() => {
        multiplier = 1;
        player.style.filter = "drop-shadow(0 0 8px #ff7ac8) drop-shadow(0 0 18px #ff7ac8) drop-shadow(0 0 30px #ff7ac8)";
        showMessage("⚡ 2x expired");
    }, 8000);
}

// ── FLOATING TEXT ──
function spawnFloatingText(text, x, y, color) {
    const el = document.createElement("div");
    el.innerText = text;
    el.style.cssText = `
        position:absolute;
        left:${x};
        top:${y};
        color:${color};
        font-size:22px;
        font-weight:900;
        pointer-events:none;
        z-index:999;
        text-shadow:0 2px 8px rgba(0,0,0,0.5);
        transition:top 0.8s ease, opacity 0.8s ease;
        opacity:1;
    `;
    game.appendChild(el);
    requestAnimationFrame(() => {
        el.style.top = (parseFloat(y) - 60) + "px";
        el.style.opacity = "0";
    });
    setTimeout(() => el.remove(), 900);
}

// ── DAY / NIGHT ──
function updateDayNight() {
    if (score >= 300 && !isNight) {
        isNight = true;
        document.getElementById("nightOverlay").classList.add("active");
        document.querySelector(".mountains-bg").style.filter = "brightness(0.4)";
        document.querySelector(".grass").style.filter        = "brightness(0.6)";
        document.querySelectorAll(".cloud").forEach(c => c.style.opacity = "0.3");
        const sun = document.querySelector(".sun");
        if (sun) sun.style.background = "radial-gradient(circle,#c8d8e8 30%,#8090a0 70%,transparent 100%)";
        showMessage("🌙 NIGHT HAS FALLEN!");
    }
}

// ── PANIC MODE ──
function startPanicMode() {
    if (panicMode) return;
    panicMode = true;
    game.classList.add("shake");
    game.style.background = isNight ? "#1a0a0a" : "#ffb3b3";
    speed += 2;
    showMessage("💥 PANIC MODE!");
    const flash = document.createElement("div");
    flash.className = "hit-flash";
    game.appendChild(flash);
    setTimeout(() => flash.remove(), 400);
    setTimeout(() => {
        speed    -= 2;
        panicMode = false;
        game.style.background = "";
        game.classList.remove("shake");
    }, 3000);
}

// ── LOSE LIFE ──
function loseLife() {
    if (invincible) return;
    if (shielded) {
        shielded = false;
        player.style.filter = "drop-shadow(0 0 8px #ff7ac8) drop-shadow(0 0 18px #ff7ac8) drop-shadow(0 0 30px #ff7ac8)";
        showMessage("🛡️ Shield absorbed the hit!");
        playSound(hitSound);
        return;
    }
    lives--;
    combo = 0;
    playSound(hitSound);
    startPanicMode();
    invincible = true;
    player.style.opacity = "0.4";
    let blinks = 0;
    const blinkInterval = setInterval(() => {
        player.style.opacity = player.style.opacity === "0.4" ? "1" : "0.4";
        if (++blinks >= 8) {
            clearInterval(blinkInterval);
            player.style.opacity = "1";
            invincible = false;
        }
    }, 250);
    livesEl.innerText = "❤️".repeat(Math.max(0, lives));
    if (lives <= 0) gameOver();
    else showMessage("💥 Ouch! " + lives + " left");
}

// ── MONEY STORM ──
function moneyStorm() {
    showMessage("💰 MONEY STORM!");
    const ramaSize = getRamaSize();
    for (let i = 0; i < 22; i++) {
        setTimeout(() => {
            const div = document.createElement("div");
            div.className = "item";
            div.dataset.good = "false";
            div.innerHTML = `<img src="images/EdiRama.png" class="rama-img" style="width:${ramaSize}px;">`;
            div.style.left = Math.random() * (SW() - ramaSize - 10) + "px";
            div.style.top  = "-80px";
            game.appendChild(div);
        }, i * 100);
    }
}

// ── GAME OVER ──
function gameOver() {
    wavesSound.pause(); wavesSound.currentTime = 0;
    gameRunning = false;
    clearTimeout(spawnTimer);

    // Restart start screen music
    startFlamingoMusic();

    const best = Number(localStorage.getItem("bestScore")) || 0;
    if (score > best) localStorage.setItem("bestScore", score);
    const bestFinal = Number(localStorage.getItem("bestScore"));
    const isNewBest = score > 0 && score >= bestFinal;

    startScreen.style.display = "flex";
    startScreen.innerHTML = `
        <div class="gameover-bg"></div>
        <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;width:100%;padding:0 20px;">
            <div style="font-size:clamp(1.8rem,7vw,4.5rem);font-weight:900;letter-spacing:-2px;margin-bottom:6px;
                text-shadow:0 3px 0 rgba(0,0,0,0.5),0 8px 30px rgba(0,0,0,0.5);line-height:1.1;text-align:center;">
                💰 Sazan was invaded!
            </div>
            <div style="font-size:clamp(11px,3vw,13px);color:rgba(255,255,255,0.55);margin-bottom:24px;
                letter-spacing:3px;text-transform:uppercase;font-weight:700;">
                by Edi Rama himself
            </div>
            <div style="display:flex;gap:12px;margin-bottom:22px;flex-wrap:wrap;justify-content:center;">
                <div style="text-align:center;background:rgba(0,0,0,0.5);
                    border:1.5px solid rgba(255,255,255,0.15);border-radius:20px;
                    padding:clamp(12px,4vw,18px) clamp(20px,6vw,36px);
                    backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);min-width:120px;">
                    <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:8px;">Your Score</div>
                    <div style="font-size:clamp(36px,10vw,52px);font-weight:900;color:white;line-height:1;letter-spacing:-2px;">${score}</div>
                </div>
                <div style="text-align:center;background:rgba(0,0,0,0.5);
                    border:1.5px solid rgba(255,215,0,0.3);border-radius:20px;
                    padding:clamp(12px,4vw,18px) clamp(20px,6vw,36px);
                    backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);min-width:120px;">
                    <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:rgba(255,215,0,0.6);text-transform:uppercase;margin-bottom:8px;">🏆 Best</div>
                    <div style="font-size:clamp(36px,10vw,52px);font-weight:900;color:#ffd700;line-height:1;letter-spacing:-2px;">${bestFinal}</div>
                </div>
            </div>
            ${isNewBest ? `<div style="margin-bottom:18px;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#7a4a00;font-size:13px;font-weight:900;padding:8px 20px;border-radius:999px;box-shadow:0 4px 0 #b87a00;letter-spacing:1px;">🏆 NEW PERSONAL BEST!</div>` : ""}
            <button onclick="location.reload()">🦩 Start New Revolution</button>
        </div>`;
}

// ── PLAYER MOVEMENT ──
function updatePlayer() {
    player.style.left = playerX + "px";
    player.style.transform = "translateX(-50%)";
}

document.addEventListener("touchmove", function(e) {
    if (!gameRunning) return;
    e.preventDefault();
    playerX = e.touches[0].clientX;
    const max = SW() - 40;
    if (playerX < 20)  playerX = 20;
    if (playerX > max) playerX = max;
    updatePlayer();
}, { passive: false });

document.addEventListener("mousemove", function(e) {
    if (!gameRunning) return;
    if (e.buttons !== 1) return;
    playerX = e.clientX;
    const max = SW() - 40;
    if (playerX < 20)  playerX = 20;
    if (playerX > max) playerX = max;
    updatePlayer();
});

updatePlayer();