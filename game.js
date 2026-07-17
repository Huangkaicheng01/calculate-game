(() => {
    const TOTAL = 5;
    const PASS_NEED = 4;
    const POINT_PER_PASS = 1;
    const MINUTES_PER_POINT = 6;
    const MAX_TABLET_MINUTES = 30;
    const MAX_LEVELS = 5;
    const STORAGE_KEY = "math-adventure-v3";

    const TYPE_LABELS = {
        "mul-2x1": "两位数 × 一位数 · 填空",
        "mul-2x2": "两位数 × 两位数 · 填空",
        "div-3x1": "三位数 ÷ 一位数 · 填空",
        "div-3x2": "三位数 ÷ 两位数 · 填空",
        science: "科学常识 · 选择题",
        english: "英语单词 · 选择题",
    };

    let LEVELS = [];
    let SCIENCE_BANK = [];
    let ENGLISH_BANK = [];

    const mapScreen = document.getElementById("map-screen");
    const quizScreen = document.getElementById("quiz-screen");
    const resultScreen = document.getElementById("result-screen");
    const levelList = document.getElementById("level-list");
    const brandTitle = document.getElementById("brand-title");
    const questionEl = document.getElementById("question");
    const optionsEl = document.getElementById("options");
    const answerForm = document.getElementById("answer-form");
    const answerInput = document.getElementById("answer-input");
    const feedbackEl = document.getElementById("feedback");
    const progressText = document.getElementById("progress-text");
    const progressFill = document.getElementById("progress-fill");
    const resultTitle = document.getElementById("result-title");
    const resultDetail = document.getElementById("result-detail");
    const resultReward = document.getElementById("result-reward");
    const resultPoints = document.getElementById("result-points");
    const resultMinutes = document.getElementById("result-minutes");
    const nextBtn = document.getElementById("next-btn");
    const retryBtn = document.getElementById("retry-btn");
    const homeBtn = document.getElementById("home-btn");
    const resetBtn = document.getElementById("reset-btn");
    const statPoints = document.getElementById("stat-points");
    const statMinutes = document.getElementById("stat-minutes");
    const introEl = document.querySelector("#map-screen .intro");
    const canvas = document.getElementById("fireworks");
    const ctx = canvas.getContext("2d");

    let state = loadState();
    let levelIndex = 0;
    let levelType = "mul-2x2";
    let questions = [];
    let qIndex = 0;
    let correctCount = 0;
    let locked = false;
    let particles = [];
    let animId = null;
    let ready = false;

    function defaultState() {
        return { unlocked: 0, points: 0, cleared: {} };
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultState();
            const parsed = JSON.parse(raw);
            return {
                unlocked: Number(parsed.unlocked) || 0,
                points: Number(parsed.points) || 0,
                cleared: parsed.cleared && typeof parsed.cleared === "object" ? parsed.cleared : {},
            };
        } catch {
            return defaultState();
        }
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function tabletMinutes() {
        return Math.min(state.points * MINUTES_PER_POINT, MAX_TABLET_MINUTES);
    }

    function updateStatsBar() {
        statPoints.textContent = String(state.points);
        statMinutes.textContent = `${tabletMinutes()} 分钟`;
    }

    function rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function loadQuestionFiles() {
        const data = window.QUESTION_DATA || {};

        LEVELS = (data.levels || []).slice(0, MAX_LEVELS);
        SCIENCE_BANK = data.science || [];
        ENGLISH_BANK = data.english || [];

        if (!LEVELS.length) throw new Error("levels.js 里还没有关卡");
        if (!SCIENCE_BANK.length) throw new Error("science.js 里还没有题目");
        if (!ENGLISH_BANK.length) throw new Error("english.js 里还没有题目");

        if (state.unlocked > LEVELS.length - 1) {
            state.unlocked = LEVELS.length - 1;
            saveState();
        }
    }

    function makeMathQuestion(type) {
        if (type === "mul-2x1") {
            const a = rand(12, 99);
            const b = rand(2, 9);
            return {
                kind: "fill",
                prompt: `${a} × ${b} = ?`,
                answer: a * b,
                key: `${a}x${b}`,
            };
        }

        if (type === "mul-2x2") {
            const a = rand(12, 99);
            const b = rand(12, 99);
            return {
                kind: "fill",
                prompt: `${a} × ${b} = ?`,
                answer: a * b,
                key: `${a}x${b}`,
            };
        }

        if (type === "div-3x1") {
            const b = rand(2, 9);
            const answer = rand(12, 99);
            const a = b * answer;
            if (a < 100 || a > 999) return null;
            return {
                kind: "fill",
                prompt: `${a} ÷ ${b} = ?`,
                answer,
                key: `${a}÷${b}`,
            };
        }

        const b = rand(11, 28);
        const answer = rand(4, 35);
        const a = b * answer;
        if (a < 100 || a > 999) return null;
        return {
            kind: "fill",
            prompt: `${a} ÷ ${b} = ?`,
            answer,
            key: `${a}÷${b}`,
        };
    }

    function pickFromBank(bank) {
        const item = bank[rand(0, bank.length - 1)];
        return {
            kind: "choice",
            prompt: item.prompt,
            answer: item.answer,
            options: shuffle([...item.options]),
            key: item.prompt,
        };
    }

    function makeQuestions(type) {
        const list = [];
        const used = new Set();
        let guard = 0;
        while (list.length < TOTAL && guard < 400) {
            guard += 1;
            let q;
            if (type === "science") q = pickFromBank(SCIENCE_BANK);
            else if (type === "english") q = pickFromBank(ENGLISH_BANK);
            else q = makeMathQuestion(type);

            if (!q || used.has(q.key)) continue;
            used.add(q.key);
            list.push(q);
        }
        return list;
    }

    function showScreen(screen) {
        [mapScreen, quizScreen, resultScreen].forEach((el) => el.classList.add("hidden"));
        screen.classList.remove("hidden");
    }

    function renderMap() {
        brandTitle.textContent = "学科闯关赛";
        updateStatsBar();
        levelList.innerHTML = "";

        const allCleared = Object.keys(state.cleared).length === LEVELS.length;

        LEVELS.forEach((level, i) => {
            const lockedLevel = i > state.unlocked;
            const cleared = Boolean(state.cleared[i]);
            const playable = !lockedLevel && !cleared;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "level-btn";
            if (lockedLevel) btn.classList.add("locked");
            if (cleared) btn.classList.add("cleared");
            if (i === state.unlocked && !cleared) btn.classList.add("current");
            btn.disabled = !playable;
            let status = " · 可挑战";
            if (cleared) status = " · 已通关（不可再答）";
            else if (lockedLevel) status = " · 未解锁";
            btn.innerHTML = `
                <span class="level-num">${i + 1}</span>
                <span class="level-info">
                    <span class="mode-name">${level.name}</span>
                    <span class="mode-desc">${TYPE_LABELS[level.type] || level.type}${status}</span>
                </span>
            `;
            if (playable) btn.addEventListener("click", () => startLevel(i));
            levelList.appendChild(btn);
        });

        if (introEl && ready) {
            introEl.textContent = allCleared
                ? `全部通关！得分 ${state.points}，平板 ${tabletMinutes()} 分钟。已完成关卡不能再答，可点「重新开始闯关」清空进度。`
                : `共 ${LEVELS.length} 关。科学 ${SCIENCE_BANK.length} 题、英语 ${ENGLISH_BANK.length} 题。通关后的关卡不能再重新答题。`;
        }

        showScreen(mapScreen);
    }

    function updateProgress() {
        progressText.textContent = `第 ${qIndex + 1} / ${TOTAL} 题`;
        progressFill.style.width = `${((qIndex + 1) / TOTAL) * 100}%`;
    }

    function renderQuestion() {
        locked = false;
        feedbackEl.textContent = "";
        feedbackEl.className = "feedback";
        const q = questions[qIndex];
        questionEl.textContent = q.prompt;
        questionEl.classList.toggle("long", q.kind === "choice" || q.prompt.length > 18);
        questionEl.style.animation = "none";
        void questionEl.offsetWidth;
        questionEl.style.animation = "";
        updateProgress();
        optionsEl.innerHTML = "";

        if (q.kind === "fill") {
            optionsEl.classList.add("hidden");
            answerForm.classList.remove("hidden");
            answerInput.value = "";
            answerInput.disabled = false;
            answerInput.classList.remove("correct", "wrong");
            answerForm.querySelector("button").disabled = false;
            answerInput.focus();
            return;
        }

        answerForm.classList.add("hidden");
        optionsEl.classList.remove("hidden");
        q.options.forEach((opt) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "option";
            btn.textContent = String(opt);
            btn.addEventListener("click", () => onAnswer(opt));
            optionsEl.appendChild(btn);
        });
    }

    function answersMatch(choice, answer) {
        if (typeof answer === "number") return Number(choice) === answer;
        return String(choice) === String(answer);
    }

    function onAnswer(choice) {
        if (locked) return;
        locked = true;
        const q = questions[qIndex];
        const correct = answersMatch(choice, q.answer);

        if (q.kind === "choice") {
            const buttons = [...optionsEl.querySelectorAll(".option")];
            buttons.forEach((b) => {
                b.disabled = true;
                if (answersMatch(b.textContent, q.answer)) b.classList.add("correct");
                else if (answersMatch(b.textContent, choice) && !correct) b.classList.add("wrong");
            });
        } else {
            answerInput.disabled = true;
            answerForm.querySelector("button").disabled = true;
            answerInput.classList.add(correct ? "correct" : "wrong");
        }

        if (correct) {
            correctCount += 1;
            feedbackEl.textContent = "你真棒！";
            feedbackEl.className = "feedback good";
            burstFireworks();
        } else {
            feedbackEl.textContent = `再接再厉！答案是 ${q.answer}`;
            feedbackEl.className = "feedback bad";
        }

        setTimeout(() => {
            qIndex += 1;
            if (qIndex >= TOTAL) finishLevel();
            else renderQuestion();
        }, correct ? 1600 : 1400);
    }

    function finishLevel() {
        const passed = correctCount >= PASS_NEED;

        resultDetail.textContent = `本关答对 ${correctCount} / ${TOTAL} 题`;
        resultPoints.textContent = String(state.points);
        resultMinutes.textContent = `${tabletMinutes()} 分钟`;

        if (passed) {
            resultTitle.textContent = "本关通过！";
            state.points += POINT_PER_PASS;
            state.cleared[levelIndex] = true;
            if (levelIndex === state.unlocked && state.unlocked < LEVELS.length - 1) {
                state.unlocked += 1;
            }
            saveState();
            updateStatsBar();
            resultReward.innerHTML = `
                <p class="reward-gain">+${POINT_PER_PASS} 分</p>
                <p class="reward-time">兑换平板时间 +${MINUTES_PER_POINT} 分钟</p>
            `;
            burstFireworks(true);
            resultPoints.textContent = String(state.points);
            resultMinutes.textContent = `${tabletMinutes()} 分钟`;

            const hasNext = levelIndex < LEVELS.length - 1 && levelIndex + 1 <= state.unlocked && !state.cleared[levelIndex + 1];
            nextBtn.classList.toggle("hidden", !hasNext);
            retryBtn.classList.add("hidden");

            if (Object.keys(state.cleared).length === LEVELS.length) {
                resultTitle.textContent = "全部通关！";
                resultReward.innerHTML += `<p class="reward-final">累计 ${state.points} 分 · 平板 ${tabletMinutes()} 分钟。已完成关卡不可再答。</p>`;
                nextBtn.classList.add("hidden");
            }
        } else {
            resultTitle.textContent = "未得分";
            resultReward.innerHTML = `
                <p class="reward-fail">答对不足 ${PASS_NEED} 题，不能得分</p>
                <p class="reward-note">再试一次，争取通关！</p>
            `;
            nextBtn.classList.add("hidden");
            retryBtn.classList.remove("hidden");
        }

        showScreen(resultScreen);
    }

    function startLevel(index) {
        if (!ready || index > state.unlocked || state.cleared[index]) return;
        levelIndex = index;
        levelType = LEVELS[index].type;
        brandTitle.textContent = LEVELS[index].name;
        questions = makeQuestions(levelType);
        qIndex = 0;
        correctCount = 0;
        showScreen(quizScreen);
        renderQuestion();
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function burstFireworks(big = false) {
        const count = big ? 5 : 3;
        for (let i = 0; i < count; i++) {
            const x = canvas.width * (0.25 + Math.random() * 0.5);
            const y = canvas.height * (0.2 + Math.random() * 0.35);
            spawnBurst(x, y, big ? 55 : 40);
        }
        if (!animId) loopFireworks();
    }

    function spawnBurst(x, y, n) {
        const colors = ["#e85d4c", "#ffb347", "#ffe066", "#5fd4a8", "#7ec8e3", "#ff8fab", "#fff8f0"];
        for (let i = 0; i < n; i++) {
            const angle = (Math.PI * 2 * i) / n + Math.random() * 0.2;
            const speed = 2 + Math.random() * 5;
            particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.012 + Math.random() * 0.012,
                color: colors[rand(0, colors.length - 1)],
                size: 2 + Math.random() * 3,
            });
        }
    }

    function loopFireworks() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles = particles.filter((p) => p.life > 0);
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.06;
            p.life -= p.decay;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (particles.length) animId = requestAnimationFrame(loopFireworks);
        else {
            animId = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    answerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (locked) return;
        const value = answerInput.value.trim();
        if (value === "") {
            feedbackEl.textContent = "请先填入答案";
            feedbackEl.className = "feedback bad";
            answerInput.focus();
            return;
        }
        onAnswer(Number(value));
    });

    nextBtn.addEventListener("click", () => {
        const next = levelIndex + 1;
        if (next <= state.unlocked && next < LEVELS.length && !state.cleared[next]) startLevel(next);
        else renderMap();
    });

    retryBtn.addEventListener("click", () => {
        if (!state.cleared[levelIndex]) startLevel(levelIndex);
        else renderMap();
    });
    homeBtn.addEventListener("click", renderMap);

    resetBtn.addEventListener("click", () => {
        if (!confirm("确定要清空进度和得分，重新开始闯关吗？")) return;
        state = defaultState();
        saveState();
        renderMap();
    });

    try {
        loadQuestionFiles();
        ready = true;
        if (introEl) {
            introEl.textContent =
                `共 ${LEVELS.length} 关。科学 ${SCIENCE_BANK.length} 题、英语 ${ENGLISH_BANK.length} 题。通关后的关卡不能再重新答题。`;
        }
        renderMap();
    } catch (err) {
        console.error(err);
        if (introEl) {
            introEl.textContent =
                "题库加载失败：请确认 index.html 里已引入 questions 目录下的 levels.js、science.js、english.js。";
        }
    }
})();
