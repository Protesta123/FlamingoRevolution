const game = document.getElementById("game");
const player = document.getElementById("player");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const msgEl = document.getElementById("message");
const startScreen = document.getElementById("startScreen");
const collectSound = new Audio("sounds/collect.mp3");
const hitSound = new Audio("sounds/hit.mp3");
const levelSound = new Audio("sounds/levelup.mp3");
const victorySound = new Audio("sounds/victory.mp3");
const wavesSound = new Audio("sounds/waves.mp3");

collectSound.volume = 0.4;
hitSound.volume = 0.5;
levelSound.volume = 0.6;
victorySound.volume = 0.7;
wavesSound.volume = 0.35;
wavesSound.loop = true;

function playSound(sound){
    sound.currentTime = 0;

    sound.play().catch(function(err){
        console.log("Audio error:", err);
    });
}

let playerX = window.innerWidth / 2;
let score = 0;
let lives = 3;
let combo = 0;
let level = 1;
let gameRunning = false;
let speed = 6;
let panicMode = false;
let isNight = false;
let spawnTimer;

const SW = () => window.innerWidth;
const SH = () => window.innerHeight;

function startGame() {
    if (wavesSound.paused) {

    wavesSound.currentTime = 0;

    wavesSound.play().catch(err => {
        console.log(err);
    });
}

    collectSound.load();
    hitSound.load();
    levelSound.load();
    victorySound.load();

    collectSound.currentTime = 0;
    collectSound.play()
        .then(() => {
            collectSound.pause();
            collectSound.currentTime = 0;
        })
        .catch(err => console.log(err));

    startScreen.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:20px; width:min(90vw, 400px);">
            <div id="loadTitle" style="font-size:clamp(1.4rem,5vw,2rem); font-weight:900; letter-spacing:-1px; text-shadow:0 3px 0 rgba(0,0,0,0.3);">
                🦩 Mobilizing flamingos...
            </div>
            <div style="width:100%; height:22px; background:rgba(0,0,0,0.35); border-radius:999px; overflow:hidden; border:2px solid rgba(255,255,255,0.15);">
                <div id="loadBar" style="height:100%; width:0%; background:linear-gradient(90deg,#ff4081,#ff7ab3); border-radius:999px; transition:width 0.3s ease; box-shadow:0 0 12px rgba(255,64,129,0.6);"></div>
            </div>
            <div id="loadLabel" style="font-size:14px; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,0.6); text-transform:uppercase;">0%</div>
        </div>
    `;

    const messages = [
        "🦩 Mobilizing flamingos...",
        "🌊 Checking the lagoon...",
        "🚨 Edi Rama spotted nearby...",
        "💪 Revolution loading...",
        "🦩 Almost ready..."
    ];

    const loadBar = document.getElementById("loadBar");
    const loadLabel = document.getElementById("loadLabel");
    const titleEl = document.getElementById("loadTitle");

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
            const msgIndex = Math.min(Math.floor((progress / 100) * messages.length), messages.length - 1);
            titleEl.innerText = messages[msgIndex];
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
    score = 0;
        lives = 3;
        combo = 0;
        level = 1;
        speed = 6;
        gameRunning = true;
        isNight = false;
        document.querySelector(".mountains-bg").style.filter =
"brightness(1)";

document.querySelector(".grass").style.filter =
"brightness(1)";
        document
    .getElementById("nightOverlay")
    .classList.remove("active");

game.style.background =
"linear-gradient(to bottom,#4ec0ca,#70d0da,#c9eaf5,#dff5ff)";

        scoreEl.innerText = score;
        livesEl.innerText = "❤️❤️❤️";
        msgEl.innerText = "";

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

function showMessage(text) {
    msgEl.innerText = text;
    setTimeout(() => { msgEl.innerText = ""; }, 1500);
}

function spawnLoop() {
    if (!gameRunning) return;
    spawnObject();
    // starts at 600ms, bottoms out at 120ms — spawns get relentless fast
    const spawnRate = Math.max(120, 600 - Math.floor(score / 1.8));
    spawnTimer = setTimeout(spawnLoop, spawnRate);
}

function getRamaSize() {
    const base = Math.round(SW() * 0.13);
    return Math.min(130, Math.max(60, base));
}

function getFlamSize() {
    const base = Math.round(SW() * 0.11);
    return Math.min(70, Math.max(40, base));
}

function spawnObject() {
    const div = document.createElement("div");
    div.className = "item";

    // Starts at 55% Rama, maxes at 88% — immediately threatening
    const obstacleChance = Math.min(0.88, 0.55 + score / 700);
    const isGood = Math.random() > obstacleChance;

    div.dataset.good = isGood ? "true" : "false";

    const flamSize = getFlamSize();
    const ramaSize = getRamaSize();

    if (isGood) {
        if (Math.random() < 0.07) {
            div.innerText = "✨🦩";
        } else {
            div.innerText = "🦩";
        }
        div.style.fontSize = flamSize + "px";
    } else {
        // Rama grows after score 300
        const size = score >= 300
            ? Math.min(ramaSize * 1.35, 170)
            : ramaSize;
        div.innerHTML = `<img src="images/EdiRama.png" class="rama-img" style="width:${Math.round(size)}px;">`;
    }

    const itemW = isGood ? flamSize : getRamaSize();
    const maxX = SW() - itemW - 10;
    div.style.left = (10 + Math.random() * maxX) + "px";
    div.style.top = "-80px";

    game.appendChild(div);
}

function gameLoop() {
    if (!gameRunning) return;

    document.querySelectorAll(".item").forEach(function(item) {
        let y = parseFloat(item.style.top);
        y += speed;
        item.style.top = y + "px";

        const itemRect = item.getBoundingClientRect();
        const playerRect = player.getBoundingClientRect();

        const hit =
            itemRect.left + 8 < playerRect.right - 8 &&
            itemRect.right - 8 > playerRect.left + 8 &&
            itemRect.top + 8 < playerRect.bottom - 8 &&
            itemRect.bottom - 8 > playerRect.top + 8;

        if (hit) {
            if (item.dataset.good === "true") collectItem(item);
            else loseLife();
            item.remove();
        }

        if (y > SH() + 80) item.remove();
    });

    requestAnimationFrame(gameLoop);
}

function collectItem(item) {
    const isGolden = item.innerText.includes("✨");
    score += isGolden ? 50 : 10;
    playSound(collectSound);
    combo++;

    if (combo === 5) {
        score += 30;
        combo = 0;
        showMessage("🔥 COMBO x5! +30");
    } else if (combo === 10) {
        score += 80;
        combo = 0;
        showMessage("💥 MEGA COMBO! +80");
    }

    scoreEl.innerText = score;
    updateDayNight();

    // Level up every 120 points, speed jumps hard
    const newLevel = Math.floor(score / 120) + 1;
    if (newLevel > level) {
        level = newLevel;
        speed += 1.6;
       playSound(levelSound);
        showMessage("🚨 PROTEST LEVEL " + level);
    }

    if (score > 0 && score % 250 === 0) moneyStorm();
    if (score >= 800) victory();
}
function updateDayNight(){

    if(score >= 250 && !isNight){

        isNight = true;

        document
            .getElementById("nightOverlay")
            .classList.add("active");
            document.querySelector(".mountains-bg").style.filter =
"brightness(0.45)";

document.querySelector(".grass").style.filter =
"brightness(0.7)";

        document.querySelectorAll(".cloud").forEach(cloud => {
            cloud.style.opacity = "0.4";
        });

        const sun = document.querySelector(".sun");

        if(sun){
            sun.style.background =
            "radial-gradient(circle,#f5f5f5 30%,#d6d6d6 70%,transparent 100%)";
        }

        showMessage("🌙 NIGHT HAS FALLEN!");
    }
}

function startPanicMode() {
    if (panicMode) return;
    panicMode = true;
    game.classList.add("shake");
    game.style.background = "#ffb3b3";
    speed += 2;
    showMessage("💥 PANIC MODE!");
    setTimeout(() => {
        speed -= 2;
        panicMode = false;
        game.style.background = "";
        game.classList.remove("shake");
    }, 3000);
}

function loseLife() {
    playSound(hitSound);
    lives--;
    startPanicMode();
    combo = 0;
    livesEl.innerText = "❤️".repeat(lives);
    if (lives <= 0) gameOver();
    else showMessage("💥 Ouch!");
}

function victory() {
    wavesSound.pause();
wavesSound.currentTime = 0;
    playSound(victorySound);
    gameRunning = false;
    clearTimeout(spawnTimer);
    startScreen.style.display = "flex";
    startScreen.innerHTML = `
        <div style="font-size:clamp(2rem,7vw,4rem); font-weight:900; letter-spacing:-2px; margin-bottom:12px; text-shadow:0 3px 0 rgba(0,0,0,0.4); text-align:center;">
            🦩 REVOLUTION WON!
        </div>
        <div style="font-size:clamp(1rem,4vw,1.3rem); color:rgba(255,255,255,0.75); margin-bottom:32px; letter-spacing:1px; text-align:center;">
            You saved the flamingos of Sazan Island!
        </div>
        <div style="display:flex; gap:16px; margin-bottom:32px; justify-content:center;">
            <div style="text-align:center; background:rgba(0,0,0,0.4); border:1.5px solid rgba(255,255,255,0.15); border-radius:20px; padding:16px 30px; backdrop-filter:blur(12px);">
                <div style="font-size:11px; font-weight:800; letter-spacing:2px; color:rgba(255,255,255,0.5); text-transform:uppercase; margin-bottom:6px;">Final Score</div>
                <div style="font-size:48px; font-weight:900; color:white; line-height:1; letter-spacing:-2px;">${score}</div>
            </div>
        </div>
        <button onclick="location.reload()">🦩 Play Again</button>
    `;
}

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
            div.style.top = "-80px";
            game.appendChild(div);
        }, i * 100);
    }
}

function gameOver() {
    wavesSound.pause();
wavesSound.currentTime = 0;
    gameRunning = false;
    clearTimeout(spawnTimer);

    const best = Number(localStorage.getItem("bestScore")) || 0;
    if (score > best) localStorage.setItem("bestScore", score);
    const bestFinal = Number(localStorage.getItem("bestScore"));
    const isNewBest = score > 0 && score >= bestFinal;

    startScreen.style.display = "flex";
    startScreen.innerHTML = `
        <div style="position:absolute; inset:0;
            background-image:url('images/edi.png');
            background-size:cover; background-position:center top;
            filter:brightness(0.45) saturate(1.3);
            transform:scale(1.04); z-index:0;"></div>

        <div style="position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; width:100%; padding:0 20px;">
            <div style="font-size:clamp(1.8rem,7vw,4.5rem); font-weight:900; letter-spacing:-2px; margin-bottom:6px;
                text-shadow:0 3px 0 rgba(0,0,0,0.5), 0 8px 30px rgba(0,0,0,0.5); line-height:1.1; text-align:center;">
                💰 Sazan was invaded!
            </div>
            <div style="font-size:clamp(11px,3vw,13px); color:rgba(255,255,255,0.55); margin-bottom:28px;
                letter-spacing:3px; text-transform:uppercase; font-weight:700;">
                by Edi Rama himself
            </div>
            <div style="display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap; justify-content:center;">
                <div style="text-align:center; background:rgba(0,0,0,0.5);
                    border:1.5px solid rgba(255,255,255,0.15); border-radius:20px;
                    padding:clamp(12px,4vw,18px) clamp(20px,6vw,36px);
                    backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); min-width:120px;">
                    <div style="font-size:11px; font-weight:800; letter-spacing:2px; color:rgba(255,255,255,0.5); text-transform:uppercase; margin-bottom:8px;">Your Score</div>
                    <div style="font-size:clamp(36px,10vw,52px); font-weight:900; color:white; line-height:1; letter-spacing:-2px;">${score}</div>
                </div>
                <div style="text-align:center; background:rgba(0,0,0,0.5);
                    border:1.5px solid rgba(255,215,0,0.3); border-radius:20px;
                    padding:clamp(12px,4vw,18px) clamp(20px,6vw,36px);
                    backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); min-width:120px;">
                    <div style="font-size:11px; font-weight:800; letter-spacing:2px; color:rgba(255,215,0,0.6); text-transform:uppercase; margin-bottom:8px;">🏆 Best</div>
                    <div style="font-size:clamp(36px,10vw,52px); font-weight:900; color:#ffd700; line-height:1; letter-spacing:-2px;">${bestFinal}</div>
                </div>
            </div>
            ${isNewBest ? `<div style="margin-bottom:20px; background:linear-gradient(135deg,#ffd700,#ffaa00); color:#7a4a00; font-size:13px; font-weight:900; padding:8px 20px; border-radius:999px; box-shadow:0 4px 0 #b87a00; letter-spacing:1px;">🏆 NEW PERSONAL BEST!</div>` : ""}
            <button onclick="location.reload()">🦩 Start New Revolution</button>
        </div>
    `;
}

function updatePlayer() {
    player.style.left = playerX + "px";
    player.style.transform = "translateX(-50%)";
}

document.addEventListener("touchmove", function(e) {
    if (!gameRunning) return;
    e.preventDefault();
    playerX = e.touches[0].clientX;
    const max = SW() - 40;
    if (playerX < 20) playerX = 20;
    if (playerX > max) playerX = max;
    updatePlayer();
}, { passive: false });

document.addEventListener("mousemove", function(e) {
    if (!gameRunning) return;
    if (e.buttons !== 1) return;
    playerX = e.clientX;
    const max = SW() - 40;
    if (playerX < 20) playerX = 20;
    if (playerX > max) playerX = max;
    updatePlayer();
});

updatePlayer();