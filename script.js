// ── ELEMENTS ──
const game         = document.getElementById("game");
const player       = document.getElementById("player");
const scoreEl      = document.getElementById("score");
const livesEl      = document.getElementById("lives");
const msgEl        = document.getElementById("message");
const startScreen  = document.getElementById("startScreen");
const shieldBadge  = document.getElementById("shieldBadge");
const comboDisplay = document.getElementById("comboDisplay");
const pCanvas      = document.getElementById("particleCanvas");
const pCtx         = pCanvas.getContext("2d");

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

function playSound(s) { s.currentTime = 0; s.play().catch(() => {}); }
function startFlamingoMusic() { flamingoSound.currentTime = 0; flamingoSound.play().catch(() => {}); }
function stopFlamingoMusic()  { flamingoSound.pause(); flamingoSound.currentTime = 0; }

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
let gameRunning    = false;
let panicMode      = false;
let isNight        = false;
let invincible     = false;
let shielded       = false;
let multiplier     = 1;
let multiplierTimer = null;
let spawnTimer;
let particles      = [];
let comboHideTimer = null;
let frameId;
let extraLifeAvailable = false; // tracks if extra-life heart is already on screen
let lastExtraLifeScore = 0;     // to avoid spamming extra-life hearts
let activeItems    = new Set(); // track items without DOM queries


const SW = () => window.innerWidth;
const SH = () => window.innerHeight;

// ── CANVAS RESIZE ──
function resizeCanvas() { pCanvas.width = SW(); pCanvas.height = SH(); }
resizeCanvas();
window.addEventListener("resize", resizeCanvas, { passive: true });

// ══════════════════════════════════
//  SPAWN PROBABILITY TABLE
//  Score-based, evaluated each spawn
// ══════════════════════════════════
//
//  Phase 1  (0–149):   50% flamingo, 46% Rama, 3% 2x, 1% shield
//  Phase 2  (150–399): 40% flamingo, 52% Rama, 5% 2x, 3% shield
//  Phase 3  (400–799): 32% flamingo, 58% Rama, 6% 2x, 4% shield
//  Phase 4  (800+):    25% flamingo, 63% Rama, 7% 2x, 5% shield
//
//  Extra-life heart: spawned manually when score ≥ 1000 & lives === 1.

function getSpawnWeights() {
    if (score < 150) return { flam: 0.50, multi: 0.03, shield: 0.01 };
    if (score < 400) return { flam: 0.40, multi: 0.05, shield: 0.03 };
    if (score < 800) return { flam: 0.32, multi: 0.06, shield: 0.04 };
    return              { flam: 0.25, multi: 0.07, shield: 0.05 };
}

// ── iOS detection — WebKit on iOS is more sensitive to particle overdraw ──
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// ══════════════════════════════════
//  PARTICLES
// ══════════════════════════════════
function spawnParticles(x, y, color, count = 12, type = "burst") {
    // Cap particle count on iOS/mobile to reduce GPU overdraw
    const mobileCap = isIOS ? 0.4 : (SW() < 500 ? 0.55 : 1);
    const cap = Math.max(3, Math.ceil(count * mobileCap));
    for (let i = 0; i < cap; i++) {
        const angle = (Math.PI * 2 / cap) * i + Math.random() * 0.4;
        const spd   = type === "burst" ? 3 + Math.random() * 5 : 1 + Math.random() * 3;
        particles.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - (type === "burst" ? 2 : 0),
            life: 1,
            decay: 0.028 + Math.random() * 0.025,
            size: type === "burst" ? 5 + Math.random() * 6 : 3 + Math.random() * 4,
            color,
            circle: Math.random() < 0.5
        });
    }
}

function updateParticles() {
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    if (particles.length === 0) return;

    // Update physics for all particles first
    for (const p of particles) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.18;
        p.life -= p.decay;
    }
    particles = particles.filter(p => p.life > 0);
    if (particles.length === 0) return;

    // Draw rects
    for (const p of particles) {
        if (p.circle) continue;
        pCtx.globalAlpha = p.life;
        pCtx.fillStyle = p.color;
        const half = p.size / 2;
        pCtx.fillRect((p.x - half) | 0, (p.y - half) | 0, p.size, p.size);
    }

    // Draw circles — batch by colour to reduce fillStyle switches
    let lastColor = "";
    let inPath = false;
    for (const p of particles) {
        if (!p.circle) continue;
        if (p.color !== lastColor) {
            if (inPath) pCtx.fill();
            pCtx.beginPath();
            pCtx.fillStyle = p.color;
            lastColor = p.color;
            inPath = true;
        }
        pCtx.globalAlpha = p.life;
        pCtx.moveTo((p.x | 0) + p.size / 2, p.y | 0);
        pCtx.arc(p.x | 0, p.y | 0, p.size / 2, 0, Math.PI * 2);
    }
    if (inPath) pCtx.fill();
    pCtx.globalAlpha = 1;
}

// ── SCREEN FLASH ── (reuse single element to avoid layout thrashing)
let _flashEl = null;
let _flashAnim = null;
function screenFlash(color, opacity = 0.28) {
    if (!_flashEl) {
        _flashEl = document.createElement("div");
        _flashEl.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:998;opacity:0;";
        game.appendChild(_flashEl);
    }
    if (_flashAnim) { _flashAnim.cancel(); }
    _flashEl.style.background = color;
    _flashAnim = _flashEl.animate([{ opacity }, { opacity: 0 }], { duration: 320, easing: "ease-out" });
    _flashAnim.onfinish = () => { _flashEl.style.opacity = "0"; _flashAnim = null; };
}

// ══════════════════════════════════
//  START GAME
// ══════════════════════════════════
function startGame() {
    stopFlamingoMusic();
    if (wavesSound.paused) { wavesSound.currentTime = 0; wavesSound.play().catch(() => {}); }
    [collectSound, hitSound, levelSound, victorySound].forEach(s => {
        s.load(); s.play().then(() => { s.pause(); s.currentTime = 0; }).catch(() => {});
    });

    // Loading screen
    startScreen.innerHTML = `
        <img src="images/ramahunting.png" id="heroImg" alt="">
        <div id="startContent" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;width:100%;padding:24px 20px;">
            <div id="loadTitle" style="font-size:clamp(1.1rem,4vw,1.6rem);font-weight:900;color:white;text-shadow:0 2px 16px rgba(255,64,129,0.6);text-align:center;">
                🦩 Mobilizing flamingos...
            </div>
            <div style="width:min(90%,360px);height:18px;background:rgba(0,0,0,0.4);border-radius:999px;overflow:hidden;border:1.5px solid rgba(255,255,255,0.12);">
                <div id="loadBar" style="height:100%;width:0%;background:linear-gradient(90deg,#ff4081,#ff9ac8);border-radius:999px;box-shadow:0 0 14px rgba(255,64,129,0.7);transition:width 0.3s ease;"></div>
            </div>
            <div id="loadLabel" style="font-size:13px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,0.6);text-align:center;">0%</div>
        </div>`;

    const messages = [
        "🦩 Mobilizing flamingos...",
        "🌊 Checking the lagoon...",
        "🚨 Edi Rama spotted nearby...",
        "🛡️ Arming the revolution...",
        "🦩 Almost ready..."
    ];

    const loadBar  = document.getElementById("loadBar");
    const loadLabel = document.getElementById("loadLabel");
    const titleEl  = document.getElementById("loadTitle");
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
            if (progress >= 100) { loadLabel.innerText = "Let's go! 🦩"; setTimeout(launch, 700); }
            else setTimeout(nextCheckpoint, 150 + Math.random() * 400);
        });
    }
    nextCheckpoint();

    function launch() {
        score      = 0;
        lives      = 3;
        combo      = 0;
        level      = 1;
        speed      = 4;
        multiplier = 1;
        shielded   = false;
        invincible = false;
        isNight    = false;
        panicMode  = false;
        gameRunning = true;
        particles  = [];
        extraLifeAvailable = false;
        lastExtraLifeScore = 0;
        activeItems.clear();

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
        shieldBadge.classList.remove("active");
        comboDisplay.classList.remove("visible");
        comboDisplay.innerText = "";
        player.style.filter = "drop-shadow(0 0 12px #ff7ac8)";

        playerX = SW() / 2;
        updatePlayer();

        startScreen.style.display = "none";
        document.querySelectorAll(".item").forEach(i => i.remove());
        clearTimeout(spawnTimer);
        if (frameId) cancelAnimationFrame(frameId);

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
    msgEl.style.transform = "translateX(-50%) scale(1.1)";
    setTimeout(() => msgEl.style.transform = "translateX(-50%) scale(1)", 130);
    msgTimeout = setTimeout(() => { msgEl.innerText = ""; }, 1900);
}

// ── SPAWN LOOP ──
function spawnLoop() {
    if (!gameRunning) return;
    spawnObject();
    // spawn rate: starts ~480ms, floors at 110ms around score 1200
    const spawnRate = Math.max(110, 480 - Math.floor(score / 2.8));
    spawnTimer = setTimeout(spawnLoop, spawnRate);
}

function getRamaSize() { return Math.min(130, Math.max(60, Math.round(SW() * 0.13))); }
function getFlamSize() { return Math.min(70,  Math.max(40, Math.round(SW() * 0.11))); }

function spawnObject() {
    const div = document.createElement("div");
    div.className = "item";

    const w = getSpawnWeights();
    const roll = Math.random();

    // Extra-life heart: only spawn if score ≥ 1000, lives === 1, not already on screen
    const shouldSpawnHeart = lives === 1
        && !extraLifeAvailable
        && score >= lastExtraLifeScore + 300; // cooldown: every 300pts if still on 1 life

    if (shouldSpawnHeart && roll < 0.06) {
        // Force a heart instead of whatever we rolled
        div.dataset.good = "extralife";
        div.innerText = "💗";
        div.style.fontSize = getFlamSize() + "px";
        extraLifeAvailable = true;
        lastExtraLifeScore = score;
    } else if (roll < w.shield) {
        div.dataset.good = "shield";
        div.innerText = "🛡️";
        div.style.fontSize = getFlamSize() + "px";
    } else if (roll < w.shield + w.multi) {
        div.dataset.good = "multi";
        div.innerText = "⚡";
        div.style.fontSize = getFlamSize() + "px";
    } else if (roll < w.shield + w.multi + w.flam) {
        div.dataset.good = "true";
        div.innerText = (Math.random() < 0.08) ? "✨🦩" : "🦩";
        div.style.fontSize = getFlamSize() + "px";
    } else {
        div.dataset.good = "false";
        const ramaSize = getRamaSize();
        const size = isNight ? Math.min(ramaSize * 1.35, 170) : ramaSize;
        div.innerHTML = `<img src="images/EdiRama.png" class="rama-img" style="width:${Math.round(size)}px;">`;
    }

    const itemW = getFlamSize();
    div.style.left = (10 + Math.random() * (SW() - itemW - 20)) + "px";
    div.style.top  = "-80px";

    // Night: Ramas drift sinusoidally
    if (isNight && div.dataset.good === "false") {
        div.dataset.sineOffset  = Math.random() * Math.PI * 2;
        div.dataset.sineOriginX = parseFloat(div.style.left);
    }

    game.appendChild(div);
    activeItems.add(div);
}

// ── GAME LOOP ──
// Cache player size constants — measured once, not every frame
const PLAYER_W = 80;  // approximate half-width of player emoji in px
const PLAYER_H = 80;  // approximate half-height

let frame = 0;
function gameLoop() {
    if (!gameRunning) return;
    frame++;
    updateParticles();

    // Player position from JS state — no DOM read needed
    const pCX = playerX;                          // centre x
    const pCY = SH() - 35 - PLAYER_H / 2;        // centre y (bottom: 35px)
    const slop  = SW() < 500 ? 14 : 10;

    for (const item of activeItems) {
        let y = parseFloat(item.dataset.y || item.style.top);
        y += speed;
        item.dataset.y = y;
        item.style.top = y + "px";

        if (isNight && item.dataset.good === "false" && item.dataset.sineOffset !== undefined) {
            const ox    = parseFloat(item.dataset.sineOriginX);
            const drift = Math.sin(frame * 0.055 + parseFloat(item.dataset.sineOffset)) * 30;
            item.style.left = Math.max(0, Math.min(SW() - getRamaSize(), ox + drift)) + "px";
        }

        // Collision via stored position — zero DOM reads
        const iX = parseFloat(item.style.left);
        const iSize = item.dataset.good === "false" ? getRamaSize() : getFlamSize();
        const iCX = iX + iSize / 2;
        const iCY = y + iSize / 2;

        const hit =
            Math.abs(iCX - pCX) < (iSize / 2 + PLAYER_W / 2 - slop) &&
            Math.abs(iCY - pCY) < (iSize / 2 + PLAYER_H / 2 - slop);

        if (hit) {
            const type = item.dataset.good;
            if      (type === "true")      collectFlamingo(item);
            else if (type === "shield")    collectShield(item);
            else if (type === "multi")     collectMulti(item);
            else if (type === "extralife") collectExtraLife(item);
            else                           handleRamaHit(item);
            activeItems.delete(item);
            item.remove();
        } else if (y > SH() + 80) {
            if (item.dataset.good === "extralife") extraLifeAvailable = false;
            activeItems.delete(item);
            item.remove();
        }
    }

    frameId = requestAnimationFrame(gameLoop);
}

// ══════════════════════════════════
//  COLLECT FLAMINGO
// ══════════════════════════════════
function collectFlamingo(item) {
    const isGolden = item.innerText.includes("✨");
    const pts = (isGolden ? 50 : 10) * multiplier;
    score += pts;
    playSound(collectSound);

    const rect = item.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;

    spawnParticles(cx, cy, isGolden ? "#ffd700" : "#ff7ac8", isGolden ? 14 : 7);
    if (isGolden) spawnParticles(cx, cy, "#fff8aa", 5);
    screenFlash(isGolden ? "rgba(255,215,0,0.22)" : "rgba(255,120,200,0.15)");

    spawnFloatingText("+" + pts, cx, cy, isGolden ? "#ffd700" : "#ff9fd8");

    combo++;
    updateComboDisplay();

    // Combo rewards — combo keeps climbing; resets only on miss/hit
    if (combo === 5) {
        const bonus = 25 * multiplier;
        score += bonus;
        showMessage("🔥 Combo ×5! +" + bonus);
        spawnParticles(cx, cy, "#ffa040", 8);
    } else if (combo === 10) {
        const bonus = 80 * multiplier;
        score += bonus;
        showMessage("💥 MEGA Combo ×10! +" + bonus);
        spawnParticles(cx, cy, "#ffd700", 16, "burst");
        spawnParticles(cx, cy, "#ff4081", 10, "burst");
        screenFlash("rgba(255,200,0,0.35)", 0.35);
    } else if (combo > 10 && combo % 5 === 0) {
        const bonus = 50 * multiplier;
        score += bonus;
        showMessage("🔥 Combo ×" + combo + "! +" + bonus);
        spawnParticles(cx, cy, "#ffd700", 10, "burst");
    }

    scoreEl.innerText = score;
    updateDayNight();
    updateLevel();
    if (score > 0 && score % 300 === 0) moneyStorm();
}

function updateComboDisplay() {
    if (combo >= 3) {
        comboDisplay.innerText = "×" + combo + " Combo!";
        comboDisplay.classList.add("visible");
        clearTimeout(comboHideTimer);
        comboHideTimer = setTimeout(() => comboDisplay.classList.remove("visible"), 1400);
    } else {
        clearTimeout(comboHideTimer);
        comboDisplay.classList.remove("visible");
    }
}

// ══════════════════════════════════
//  COLLECT SHIELD  (persists until hit)
// ══════════════════════════════════
function collectShield(item) {
    shielded = true;
    playSound(collectSound);
    showMessage("🛡️ Shield active!");

    const rect = item.getBoundingClientRect();
    spawnParticles(rect.left + rect.width/2, rect.top + rect.height/2, "#00cfff", 9);
    screenFlash("rgba(0,207,255,0.2)");

    player.style.filter = "drop-shadow(0 0 14px #00cfff)";
    spawnFloatingText("🛡️", rect.left + rect.width/2, rect.top + rect.height/2, "#00cfff");
    shieldBadge.classList.add("active");
}

function removeShield() {
    shielded = false;
    shieldBadge.classList.remove("active");
    restorePlayerGlow();
}

// ══════════════════════════════════
//  COLLECT 2× MULTIPLIER
// ══════════════════════════════════
function collectMulti(item) {
    multiplier = 2;
    playSound(collectSound);
    showMessage("⚡ 2× Score active!");

    const rect = item.getBoundingClientRect();
    spawnParticles(rect.left + rect.width/2, rect.top + rect.height/2, "#ffd700", 9);
    screenFlash("rgba(255,215,0,0.2)");

    player.style.filter = "drop-shadow(0 0 14px #ffd700)";
    spawnFloatingText("⚡ 2×", rect.left + rect.width/2, rect.top + rect.height/2, "#ffd700");

    clearTimeout(multiplierTimer);
    multiplierTimer = setTimeout(() => {
        multiplier = 1;
        restorePlayerGlow();
        showMessage("⚡ 2× expired");
    }, 9000);
}

// ══════════════════════════════════
//  COLLECT EXTRA LIFE ❤️
// ══════════════════════════════════
function collectExtraLife(item) {
    extraLifeAvailable = false;
    lives = Math.min(lives + 1, 3);
    playSound(victorySound);
    showMessage("💗 Extra life!");

    const rect = item.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    spawnParticles(cx, cy, "#ff4081", 14, "burst");
    spawnParticles(cx, cy, "#ffb3d0", 8);
    screenFlash("rgba(255,64,129,0.3)", 0.3);

    livesEl.innerText = "❤️".repeat(lives);
    spawnFloatingText("💗 +1 LIFE", cx, cy, "#ff4081");
}

// ── RESTORE PLAYER GLOW ──
function restorePlayerGlow() {
    if (shielded) {
        player.style.filter = "drop-shadow(0 0 14px #00cfff)";
    } else if (multiplier > 1) {
        player.style.filter = "drop-shadow(0 0 14px #ffd700)";
    } else {
        player.style.filter = "drop-shadow(0 0 12px #ff7ac8)";
    }
}

// ── FLOATING TEXT ──
function spawnFloatingText(text, x, y, color) {
    const el = document.createElement("div");
    el.className = "float-text";
    el.innerText = text;
    el.style.cssText = `
        position:absolute;
        left:${typeof x === "number" ? x + "px" : x};
        top:${typeof y === "number" ? y + "px" : y};
        color:${color};font-size:16px;font-weight:900;
        pointer-events:none;z-index:999;
        text-shadow:0 2px 8px rgba(0,0,0,0.55);
        will-change:transform,opacity;
        transition:transform 0.75s ease,opacity 0.75s ease;opacity:1;
        transform:translateX(-50%) translateY(0);
    `;
    game.appendChild(el);
    requestAnimationFrame(() => {
        el.style.transform = "translateX(-50%) translateY(-65px)";
        el.style.opacity = "0";
    });
    setTimeout(() => el.remove(), 820);
}

// ── LEVEL UPDATE ──
function updateLevel() {
    // level every 100pts; speed jumps are stronger and taper less
    const newLevel = Math.floor(score / 100) + 1;
    if (newLevel > level) {
        level = newLevel;
        speed += Math.max(0.3, 0.7 - level * 0.02);
        playSound(levelSound);
        showMessage("🚨 Level " + level + (multiplier > 1 ? " ⚡" : ""));
    }
}

// ── DAY / NIGHT ──
function updateDayNight() {
    if (score >= 250 && !isNight) {
        isNight = true;
        document.getElementById("nightOverlay").classList.add("active");
        document.querySelector(".mountains-bg").style.filter = "brightness(0.4)";
        document.querySelector(".grass").style.filter        = "brightness(0.6)";
        document.querySelectorAll(".cloud").forEach(c => c.style.opacity = "0.3");
        const sun = document.querySelector(".sun");
        if (sun) sun.style.background = "radial-gradient(circle,#c8d8e8 30%,#8090a0 70%,transparent 100%)";
        showMessage("🌙 Night has fallen!");
    }
}

// ── PANIC MODE ──
function startPanicMode() {
    if (panicMode) return;
    panicMode = true;
    game.classList.add("shake");
    game.style.background = isNight ? "#1a0a0a" : "#ffb3b3";
    speed += 1.5;
    showMessage("💥 Panic mode!");
    screenFlash("rgba(255,0,0,0.35)", 0.35);
    const flash = document.createElement("div");
    flash.className = "hit-flash";
    game.appendChild(flash);
    setTimeout(() => flash.remove(), 350);
    setTimeout(() => {
        speed -= 1.5;
        panicMode = false;
        game.style.background = "";
        game.classList.remove("shake");
    }, 2800);
}

// ── HANDLE RAMA HIT ──
function handleRamaHit(item) {
    const rect = item.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;

    if (shielded) {
        removeShield();
        showMessage("🛡️ Shield absorbed the hit!");
        playSound(hitSound);
        combo = 0;
        updateComboDisplay();
        spawnParticles(cx, cy, "#00cfff", 12, "burst");
        spawnParticles(cx, cy, "#fff", 5);
        screenFlash("rgba(0,207,255,0.3)");
        return;
    }
    loseLife();
}

// ── LOSE LIFE ──
function loseLife() {
    if (invincible) return;

    lives--;
    combo = 0;
    updateComboDisplay();
    playSound(hitSound);
    startPanicMode();
    invincible = true;
    player.style.opacity = "0.4";

    const pRect = player.getBoundingClientRect();
    spawnParticles(pRect.left + pRect.width/2, pRect.top + pRect.height/2, "#ff4444", 12, "burst");

    let blinks = 0;
    const blinkInterval = setInterval(() => {
        blinks++;
        player.style.opacity = (blinks % 2 === 0) ? "1" : "0.4";
        if (blinks >= 10) {
            clearInterval(blinkInterval);
            player.style.opacity = "1";
            invincible = false;
        }
    }, 200);

    livesEl.innerText = "❤️".repeat(Math.max(0, lives));
    if (lives <= 0) gameOver();
    else showMessage("💥 Ouch! " + lives + " left");
}

// ── MONEY STORM ──
function moneyStorm() {
    showMessage("💰 Money storm!");
    const ramaSize = getRamaSize();
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            const div = document.createElement("div");
            div.className = "item";
            div.dataset.good = "false";
            div.innerHTML = `<img src="images/EdiRama.png" class="rama-img" style="width:${ramaSize}px;">`;
            div.style.left = Math.random() * (SW() - ramaSize - 10) + "px";
            div.style.top  = "-80px";
            game.appendChild(div);
            activeItems.add(div);
        }, i * 180);
    }
}

// ── GAME OVER ──
function gameOver() {
    wavesSound.pause(); wavesSound.currentTime = 0;
    gameRunning = false;
    clearTimeout(spawnTimer);
    if (frameId) cancelAnimationFrame(frameId);
    particles = [];
    activeItems.clear();
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    startFlamingoMusic();

    const prev = Number(localStorage.getItem("bestScore")) || 0;
    if (score > prev) localStorage.setItem("bestScore", score);
    const best = Number(localStorage.getItem("bestScore"));
    const isNewBest = score > 0 && score >= best;

    startScreen.style.display = "flex";
    startScreen.innerHTML = `
        <img src="images/ramahunting.png" id="heroImg" alt="">
        <div id="startContent" style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;width:100%;">
            <div style="font-size:clamp(2rem,7vw,4rem);font-weight:900;letter-spacing:-2px;margin-bottom:6px;
                background:linear-gradient(135deg,#ffffff 20%,#ffc8dd 60%,#ff7ab3 100%);
                -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
                filter:drop-shadow(0 2px 20px rgba(255,64,129,0.5));line-height:1.1;text-align:center;">
                💰 Sazan was invaded!
            </div>
            <div style="font-size:clamp(10px,2.5vw,13px);color:rgba(255,255,255,0.5);margin-bottom:22px;
                letter-spacing:3px;text-transform:uppercase;font-weight:700;">
                by Edi Rama himself
            </div>
            <div style="display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap;justify-content:center;">
                <div style="text-align:center;background:rgba(0,0,0,0.5);border:1.5px solid rgba(255,255,255,0.14);
                    border-radius:20px;padding:14px 28px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);min-width:120px;">
                    <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,0.45);text-transform:uppercase;margin-bottom:8px;">Your Score</div>
                    <div style="font-size:clamp(30px,8vw,46px);font-weight:900;color:white;line-height:1;letter-spacing:-2px;">${score}</div>
                </div>
                <div style="text-align:center;background:rgba(0,0,0,0.5);border:1.5px solid rgba(255,215,0,0.28);
                    border-radius:20px;padding:14px 28px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);min-width:120px;">
                    <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:rgba(255,215,0,0.55);text-transform:uppercase;margin-bottom:8px;">🏆 Best</div>
                    <div style="font-size:clamp(30px,8vw,46px);font-weight:900;color:#ffd700;line-height:1;letter-spacing:-2px;">${best}</div>
                </div>
            </div>
            ${isNewBest ? `<div style="margin-bottom:16px;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#7a4a00;font-size:13px;font-weight:900;padding:9px 22px;border-radius:999px;box-shadow:0 4px 0 #b87a00;letter-spacing:1px;">🏆 New personal best!</div>` : ""}
            <button onclick="location.reload()">🦩 Start New Revolution</button>
        </div>`;
}

// ── PLAYER MOVEMENT ──
function updatePlayer() {
    // Use transform only — avoids triggering layout on `left` change
    player.style.transform = `translateX(calc(${playerX}px - 50%))`;
}

document.addEventListener("touchmove", e => {
    if (!gameRunning) return;
    e.preventDefault();
    playerX = Math.min(Math.max(e.touches[0].clientX, 20), SW() - 40);
    updatePlayer();
}, { passive: false });

document.addEventListener("touchstart", e => {
    if (!gameRunning) return;
    playerX = Math.min(Math.max(e.touches[0].clientX, 20), SW() - 40);
    updatePlayer();
}, { passive: true });

document.addEventListener("mousemove", e => {
    if (!gameRunning || e.buttons !== 1) return;
    playerX = Math.min(Math.max(e.clientX, 20), SW() - 40);
    updatePlayer();
});

updatePlayer();