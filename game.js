(() => {
    const TOTAL = 5;
    const MODE_LABELS = {
        table: "九九乘法表",
        "two-digit": "二位数 × 一位数",
        division: "除法练习",
    };

    const startScreen = document.getElementById("start-screen");
    const quizScreen = document.getElementById("quiz-screen");
    const resultScreen = document.getElementById("result-screen");
    const restartBtn = document.getElementById("restart-btn");
    const homeBtn = document.getElementById("home-btn");
    const brandTitle = document.getElementById("brand-title");
    const questionEl = document.getElementById("question");
    const optionsEl = document.getElementById("options");
    const answerForm = document.getElementById("answer-form");
    const answerInput = document.getElementById("answer-input");
    const feedbackEl = document.getElementById("feedback");
    const progressText = document.getElementById("progress-text");
    const progressFill = document.getElementById("progress-fill");
    const resultScore = document.getElementById("result-score");
    const resultMsg = document.getElementById("result-msg");
    const canvas = document.getElementById("fireworks");
    const ctx = canvas.getContext("2d");

    let mode = "table";
    let questions = [];
    let index = 0;
    let score = 0;
    let locked = false;
    let particles = [];
    let animId = null;

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

    function makeQuestions() {
        const list = [];
        const used = new Set();
        while (list.length < TOTAL) {
            let a;
            let b;
            let answer;
            let op = "×";
            let key;

            if (mode === "division") {
                b = rand(2, 9);
                answer = rand(2, 9);
                a = b * answer;
                op = "÷";
                key = `${a}÷${b}`;
            } else if (mode === "two-digit") {
                a = rand(10, 99);
                b = rand(1, 9);
                answer = a * b;
                key = `${a}x${b}`;
            } else {
                a = rand(1, 9);
                b = rand(1, 9);
                answer = a * b;
                key = `${a}x${b}`;
            }

            if (used.has(key)) continue;
            used.add(key);
            const item = { a, b, answer, op };
            if (mode === "table") {
                const options = new Set([answer]);
                while (options.size < 4) {
                    const wrong = Math.max(1, answer + rand(-8, 8));
                    if (wrong !== answer) options.add(wrong);
                }
                item.options = shuffle([...options]);
            }
            list.push(item);
        }
        return list;
    }

    function showScreen(screen) {
        [startScreen, quizScreen, resultScreen].forEach((el) => el.classList.add("hidden"));
        screen.classList.remove("hidden");
    }

    function updateProgress() {
        progressText.textContent = `第 ${index + 1} / ${TOTAL} 题`;
        progressFill.style.width = `${((index + 1) / TOTAL) * 100}%`;
    }

    function renderQuestion() {
        locked = false;
        feedbackEl.textContent = "";
        feedbackEl.className = "feedback";
        const q = questions[index];
        questionEl.textContent = `${q.a} ${q.op} ${q.b} = ?`;
        questionEl.style.animation = "none";
        void questionEl.offsetWidth;
        questionEl.style.animation = "";
        updateProgress();
        optionsEl.innerHTML = "";

        if (mode === "two-digit" || mode === "division") {
            optionsEl.classList.add("hidden");
            answerForm.classList.remove("hidden");
            answerInput.value = "";
            answerInput.disabled = false;
            answerInput.classList.remove("correct", "wrong");
            answerForm.querySelector("button").disabled = false;
            answerInput.focus();
        } else {
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
    }

    function onAnswer(choice) {
        if (locked) return;
        locked = true;
        const q = questions[index];
        const correct = Number(choice) === q.answer;

        if (mode === "table") {
            const buttons = [...optionsEl.querySelectorAll(".option")];
            buttons.forEach((b) => {
                b.disabled = true;
                if (Number(b.textContent) === q.answer) b.classList.add("correct");
                else if (Number(b.textContent) === Number(choice) && !correct) b.classList.add("wrong");
            });
        } else {
            answerInput.disabled = true;
            answerForm.querySelector("button").disabled = true;
            answerInput.classList.add(correct ? "correct" : "wrong");
        }

        if (correct) {
            score += 1;
            feedbackEl.textContent = "你真棒！";
            feedbackEl.className = "feedback good";
            burstFireworks();
        } else {
            feedbackEl.textContent = `再接再厉！答案是 ${q.answer}`;
            feedbackEl.className = "feedback bad";
        }

        setTimeout(() => {
            index += 1;
            if (index >= TOTAL) {
                finishGame();
            } else {
                renderQuestion();
            }
        }, correct ? 1600 : 1200);
    }

    function finishGame() {
        resultScore.textContent = `你答对了 ${score} / ${TOTAL} 题！`;
        if (score === TOTAL) {
            resultMsg.textContent = mode === "division" ? "满分！除法小高手！" : "满分！乘法小高手！";
            burstFireworks(true);
        } else if (score >= 3) {
            resultMsg.textContent = "表现不错，继续加油！";
        } else {
            resultMsg.textContent = "多练几遍，很快就会更熟练！";
        }
        showScreen(resultScreen);
    }

    function startGame(selectedMode) {
        mode = selectedMode;
        brandTitle.textContent = MODE_LABELS[mode];
        questions = makeQuestions();
        index = 0;
        score = 0;
        showScreen(quizScreen);
        renderQuestion();
    }

    function goHome() {
        brandTitle.textContent = "数学问答赛";
        showScreen(startScreen);
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
        if (particles.length) {
            animId = requestAnimationFrame(loopFireworks);
        } else {
            animId = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    document.querySelectorAll(".mode-btn").forEach((btn) => {
        btn.addEventListener("click", () => startGame(btn.dataset.mode));
    });

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

    restartBtn.addEventListener("click", () => startGame(mode));
    homeBtn.addEventListener("click", goHome);
})();
