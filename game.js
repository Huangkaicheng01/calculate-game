(() => {
    const TOTAL = 5, PASS_NEED = 4, POINT_PER_PASS = 1;
    const MINUTES_PER_POINT = 6, MAX_TABLET_MINUTES = 30;
    const MAX_LEVELS = 6, COLLECTION_MIN = 3;
    const STORAGE_KEY = "math-adventure-v8";
    const IDB_NAME = "hermes-collection", IDB_VERSION = 1;

    const EMAILJS_PUBLIC_KEY = "hhj6Imrb-moKG6fI4";
    const EMAILJS_SERVICE_ID = "service_tp6h1sf";
    const EMAILJS_TEMPLATE_ID = "template_920jcfo";
    const RECIPIENT = "ronald.huang@aigens.com";

    const TYPE_LABELS = {
        "mul-2x1": "两位数 × 一位数 · 填空",
        "mul-2x2": "两位数 × 两位数 · 填空",
        "div-3x1": "三位数 ÷ 一位数 · 填空",
        "div-3x2": "三位数 ÷ 两位数 · 填空",
        science: "科学常识 · 选择题", english: "英语单词 · 选择题",
        collection: "📻 好词好句收集 · 发送给爸爸",
    };

    let LEVELS = [], SCIENCE_BANK = [], ENGLISH_BANK = [];

    const $ = (id) => document.getElementById(id);
    const mapScreen = $("map-screen"), quizScreen = $("quiz-screen");
    const resultScreen = $("result-screen"), collectionScreen = $("collection-screen");
    const levelList = $("level-list"), brandTitle = $("brand-title");
    const questionEl = $("question"), optionsEl = $("options");
    const answerForm = $("answer-form"), answerInput = $("answer-input");
    const feedbackEl = $("feedback"), progressText = $("progress-text");
    const progressFill = $("progress-fill"), resultTitle = $("result-title");
    const resultDetail = $("result-detail"), resultReward = $("result-reward");
    const resultPoints = $("result-points"), resultMinutes = $("result-minutes");
    const nextBtn = $("next-btn"), retryBtn = $("retry-btn"), homeBtn = $("home-btn");
    const resetBtn = $("reset-btn"), statPoints = $("stat-points"), statMinutes = $("stat-minutes");
    const sendEmailBtn = $("send-email-btn"), emailSendStatus = $("email-send-status");
    const todayDateEl = $("today-date"), quizBackBtn = $("quiz-back-btn");
    const introEl = document.querySelector("#map-screen .intro");
    const canvas = $("fireworks"), ctx = canvas.getContext("2d");

    const collectionSubmitBtn = $("collection-submit-btn"), collectionBackBtn = $("collection-back-btn");
    const collectionEmailArea = $("email-send-collection");
    const sendEmailCollectionBtn = $("send-email-collection-btn");
    const collectionEmailStatus = $("collection-email-status");

    let state = loadState();
    let levelIndex = 0, levelType = "", questions = [];
    let qIndex = 0, correctCount = 0, locked = false;
    let particles = [], animId = null, ready = false, idb = null;

    // ============ IndexedDB ============

    async function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = (e) => {
                if (!e.target.result.objectStoreNames.contains("items"))
                    e.target.result.createObjectStore("items", { keyPath: "id", autoIncrement: true });
            };
            req.onsuccess = (e) => { idb = e.target.result; resolve(idb); };
            req.onerror = () => reject(req.error);
        });
    }

    const idbAdd = (blob, type) => new Promise((resolve, reject) => {
        const tx = idb.transaction("items", "readwrite");
        const req = tx.objectStore("items").add({ blob, type, ts: Date.now() });
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    const idbGetAll = () => new Promise((resolve, reject) => {
        const req = idb.transaction("items", "readonly").objectStore("items").getAll();
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    const idbDelete = (id) => new Promise((resolve, reject) => {
        const req = idb.transaction("items", "readwrite").objectStore("items").delete(id);
        req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
    const idbClearAll = () => new Promise((resolve, reject) => {
        const req = idb.transaction("items", "readwrite").objectStore("items").clear();
        req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });

    // ============ Email ============

    function todayKey() {
        const d = new Date();
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }

    function formatDateCN(key) {
        const p = key.split("-");
        return p[0] + "年" + p[1] + "月" + p[2] + "日";
    }

    function initEmailJS() {
        if (window.emailjs) try { window.emailjs.init(EMAILJS_PUBLIC_KEY); return true; } catch {} return false;
    }

    const blobToDataURL = (blob) => new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
    });

    // Resize image blob to max 400px before encoding (EmailJS free tier ~50KB limit)
    function resizeImageBlob(blob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                URL.revokeObjectURL(url);
                const MAX = 400;
                let w = img.width, h = img.height;
                if (w <= MAX && h <= MAX) { resolve(blob); return; }
                const ratio = Math.min(MAX / w, MAX / h);
                w = Math.round(w * ratio); h = Math.round(h * ratio);
                const canvas = document.createElement("canvas");
                canvas.width = w; canvas.height = h;
                canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                canvas.toBlob((b) => resolve(b || blob), "image/jpeg", 0.7);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
            img.src = url;
        });
    }

    async function sendReport() {
        const tk = todayKey();
        if (state.lastSubmitDate === tk) {
            emailSendStatus.textContent = "今天已发送过结果，明天可以再发送。";
            emailSendStatus.className = "email-status error";
            return;
        }

        sendEmailBtn.disabled = true; sendEmailBtn.textContent = "发送中...";
        emailSendStatus.textContent = ""; emailSendStatus.className = "email-status";

        if (!initEmailJS()) {
            emailSendStatus.textContent = "EmailJS 未加载，请刷新页面重试";
            emailSendStatus.className = "email-status error";
            sendEmailBtn.disabled = false; sendEmailBtn.textContent = "📧 提交结果到爸爸邮箱";
            return;
        }

        try {
            const results = state.levelResults || {}, dateCN = formatDateCN(tk);
            let qc = 0, qt = 0;
            let quizRows = "";

            for (let i = 0; i < LEVELS.length; i++) {
                const r = results[i];
                if (!r) { quizRows += '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#999">' + LEVELS[i].name + '</td><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#999">未完成</td><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#999">—</td></tr>'; continue; }
                const icon = r.passed ? "✅" : "❌";
                if (r.type === "collection") {
                    quizRows += '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee">' + LEVELS[i].name + '</td><td style="padding:8px 12px;border-bottom:1px solid #eee">' + icon + ' 收集 ' + (r.itemCount || 0) + ' 条好词好句</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;color:#3aad7a">通关</td></tr>';
                } else {
                    const p = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
                    quizRows += '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee">' + LEVELS[i].name + '</td><td style="padding:8px 12px;border-bottom:1px solid #eee">' + icon + ' ' + r.correct + '/' + r.total + ' 正确（' + p + '%）</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;color:' + (r.passed ? '#3aad7a' : '#e85d4c') + '">' + (r.passed ? '通关' : '未通过') + '</td></tr>';
                    qc += r.correct; qt += r.total;
                }
            }

            const quizPct = qt > 0 ? Math.round((qc / qt) * 100) : 0;
            const scoreColor = state.points >= 6 ? "#3aad7a" : state.points >= 3 ? "#ffb347" : "#e85d4c";

            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

<tr><td style="background:linear-gradient(135deg,#e85d4c,#ff8fab);padding:28px 32px;text-align:center">
    <h1 style="margin:0;color:#fff;font-size:24px">🎓 学科闯关赛</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px">${dateCN} · 闯关报告</p>
</td></tr>

<tr><td style="padding:24px 32px">
    <h2 style="margin:0 0 16px;font-size:18px;color:#1f3a4d">📊 各关成绩</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#f8f9fa;font-weight:bold;color:#555">
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e85d4c">关卡</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e85d4c">成绩</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e85d4c;width:60px">结果</th>
        </tr></thead>
        <tbody>${quizRows}</tbody>
    </table>

    <div style="margin-top:20px;padding:16px;background:#f8f9fa;border-radius:12px;text-align:center">
        <p style="margin:0 0 8px;font-size:14px;color:#555">前 5 关总正确率</p>
        <p style="margin:0;font-size:32px;font-weight:800;color:${scoreColor}">${quizPct}%</p>
        <p style="margin:4px 0 0;font-size:13px;color:#888">${qc}/${qt} 题正确</p>
    </div>

    <div style="margin-top:16px;display:flex;gap:12px">
        <div style="flex:1;padding:14px;background:#fff8f0;border-radius:12px;text-align:center">
            <p style="margin:0;font-size:12px;color:#888">最终得分</p>
            <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#e85d4c">${state.points} 分</p>
        </div>
        <div style="flex:1;padding:14px;background:#e7f8ef;border-radius:12px;text-align:center">
            <p style="margin:0;font-size:12px;color:#888">平板时间</p>
            <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#3aad7a">${tabletMinutes()} 分钟</p>
        </div>
    </div>
</td></tr>

<tr><td style="padding:16px 32px 24px;text-align:center">
    <p style="margin:0;font-size:12px;color:#aaa">由 学科闯关赛 自动生成 · ${dateCN}</p>
</td></tr>

</table></td></tr></table></body></html>`;

            const allItems = await idbGetAll();
            const images = allItems.filter((i) => i.type === "image");
            const audios = allItems.filter((i) => i.type === "audio");

            const photos = [];
            for (let i = 0; i < Math.min(images.length, 5); i++)
                try { const resized = await resizeImageBlob(images[i].blob); photos.push(await blobToDataURL(resized)); } catch {}

            const params = {
                to_email: RECIPIENT,
                subject: "学科闯关赛 — " + dateCN,
                message: html,
                quiz_accuracy: quizPct + "%",
                total_score: String(state.points),
                tablet_minutes: String(tabletMinutes()),
                photo_count: String(images.length),
                audio_count: String(audios.length),
            };
            for (let i = 0; i < photos.length; i++) params["photo_" + (i + 1)] = photos[i];
            // Audio as File objects — EmailJS needs a name to recognize as attachment
            for (let i = 0; i < Math.min(audios.length, 5); i++) {
                const b = audios[i].blob;
                const ext = b.type.includes("webm") ? "webm" : b.type.includes("mp4") ? "m4a" : "ogg";
                params["audio_" + (i + 1)] = new File([b], "录音_" + (i + 1) + "." + ext, { type: b.type });
            }

            const resp = await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
            if (resp.status === 200) {
                state.lastSubmitDate = tk;
                saveState();
                updateSendBtn();
                const msg = "已发送到 " + RECIPIENT + " 📬";
                emailSendStatus.textContent = msg; emailSendStatus.className = "email-status success";
                sendEmailBtn.textContent = "✅ 今日已发送";
                // Also update collection screen status if visible
                collectionEmailStatus.textContent = msg; collectionEmailStatus.className = "email-status success";
                sendEmailCollectionBtn.textContent = "✅ 今日已发送"; sendEmailCollectionBtn.disabled = true;
            } else throw new Error("Status " + resp.status);
        } catch (err) {
            console.error("Email:", err);
            const msg = "发送失败：" + (err.message || "请检查网络");
            emailSendStatus.textContent = msg; emailSendStatus.className = "email-status error";
            sendEmailBtn.disabled = false; sendEmailBtn.textContent = "📧 重试发送";
            collectionEmailStatus.textContent = msg; collectionEmailStatus.className = "email-status error";
            sendEmailCollectionBtn.disabled = false; sendEmailCollectionBtn.textContent = "📧 重试发送";
        }
    }

    function updateSendBtn() {
        const alreadySent = state.lastSubmitDate === todayKey();
        sendEmailBtn.disabled = alreadySent;
        sendEmailBtn.textContent = alreadySent ? "✅ 今日已发送" : "📧 提交结果到爸爸邮箱";
        emailSendStatus.textContent = "";
        emailSendStatus.className = "email-status";
    }

    // ============ State ============

    function defaultState() {
        return { points: 0, cleared: {}, levelResults: {}, lastSubmitDate: "" };
    }

    function loadState() {
        try {
            const r = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (!r) return defaultState();
            return {
                points: Number(r.points) || 0,
                cleared: typeof r.cleared === "object" ? r.cleared : {},
                levelResults: typeof r.levelResults === "object" ? r.levelResults : {},
                lastSubmitDate: typeof r.lastSubmitDate === "string" ? r.lastSubmitDate : "",
            };
        } catch { return defaultState(); }
    }

    function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

    function tabletMinutes() { return Math.min(state.points * MINUTES_PER_POINT, MAX_TABLET_MINUTES); }

    function updateStatsBar() {
        statPoints.textContent = String(state.points);
        statMinutes.textContent = tabletMinutes() + " 分钟";
    }

    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) { const j = rand(0, i); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
    }

    function loadQuestionFiles() {
        const d = window.QUESTION_DATA || {};
        LEVELS = (d.levels || []).slice(0, MAX_LEVELS);
        SCIENCE_BANK = d.science || []; ENGLISH_BANK = d.english || [];
        if (!LEVELS.length) throw Error("levels.js empty");
        if (!SCIENCE_BANK.length || !ENGLISH_BANK.length) throw Error("question banks empty");
    }

    // ============ Quiz ============

    function makeMathQuestion(type) {
        if (type === "mul-2x1") { const a = rand(12, 99), b = rand(2, 9); return { kind: "fill", prompt: a + " × " + b + " = ?", answer: a * b, key: a + "x" + b }; }
        if (type === "mul-2x2") { const a = rand(12, 99), b = rand(12, 99); return { kind: "fill", prompt: a + " × " + b + " = ?", answer: a * b, key: a + "x" + b }; }
        if (type === "div-3x1") { const b = rand(2, 9), ans = rand(12, 99), a = b * ans; if (a < 100 || a > 999) return null; return { kind: "fill", prompt: a + " ÷ " + b + " = ?", answer: ans, key: a + "÷" + b }; }
        const b = rand(11, 28), ans = rand(4, 35), a = b * ans;
        if (a < 100 || a > 999) return null;
        return { kind: "fill", prompt: a + " ÷ " + b + " = ?", answer: ans, key: a + "÷" + b };
    }

    function pickFromBank(bank) {
        const it = bank[rand(0, bank.length - 1)];
        return { kind: "choice", prompt: it.prompt, answer: it.answer, options: shuffle([...it.options]), key: it.prompt };
    }

    function makeQuestions(type) {
        const list = [], used = new Set(); let g = 0;
        while (list.length < TOTAL && g < 400) {
            g++;
            const q = type === "science" ? pickFromBank(SCIENCE_BANK)
                    : type === "english" ? pickFromBank(ENGLISH_BANK)
                    : makeMathQuestion(type);
            if (!q || used.has(q.key)) continue;
            used.add(q.key); list.push(q);
        }
        return list;
    }

    function showScreen(screen) {
        [mapScreen, quizScreen, resultScreen, collectionScreen].forEach((el) => el.classList.add("hidden"));
        screen.classList.remove("hidden");
    }

    function renderMap() {
        brandTitle.textContent = "学科闯关赛";
        todayDateEl.textContent = formatDateCN(todayKey());
        updateStatsBar();
        levelList.innerHTML = "";

        LEVELS.forEach((level, i) => {
            const cleared = Boolean(state.cleared[i]);
            const btn = document.createElement("button");
            btn.type = "button"; btn.className = "level-btn";
            if (cleared) btn.classList.add("cleared");
            if (!cleared) btn.classList.add("current");
            btn.disabled = cleared;
            let status = cleared ? " · 已通关" : " · 可挑战";
            if (cleared && state.levelResults[i]) {
                const r = state.levelResults[i];
                status = r.type === "collection"
                    ? " · 收集 " + (r.itemCount || 0) + " 条 · 已通关"
                    : " · " + (r.correct || 0) + "/" + (r.total || TOTAL) + " · 已通关";
            }
            btn.innerHTML = '<span class="level-num">' + (i + 1) + '</span><span class="level-info">' +
                '<span class="mode-name">' + level.name + '</span>' +
                '<span class="mode-desc">' + (TYPE_LABELS[level.type] || level.type) + status + '</span></span>';
            if (!cleared) btn.addEventListener("click", () => startLevel(i));
            levelList.appendChild(btn);
        });

        if (introEl && ready)
            introEl.textContent = "科学 " + SCIENCE_BANK.length + " 题、英语 " + ENGLISH_BANK.length + " 题。所有关卡自由选择。";
        showScreen(mapScreen);
    }

    function updateProgress() {
        progressText.textContent = "第 " + (qIndex + 1) + " / " + TOTAL + " 题";
        progressFill.style.width = ((qIndex + 1) / TOTAL * 100) + "%";
    }

    function renderQuestion() {
        locked = false; feedbackEl.textContent = ""; feedbackEl.className = "feedback";
        const q = questions[qIndex];
        questionEl.textContent = q.prompt;
        questionEl.classList.toggle("long", q.kind === "choice" || q.prompt.length > 18);
        questionEl.style.animation = "none"; void questionEl.offsetWidth; questionEl.style.animation = "";
        updateProgress(); optionsEl.innerHTML = "";

        if (q.kind === "fill") {
            optionsEl.classList.add("hidden"); answerForm.classList.remove("hidden");
            answerInput.value = ""; answerInput.disabled = false;
            answerInput.classList.remove("correct", "wrong");
            answerForm.querySelector("button").disabled = false;
            answerInput.focus(); return;
        }
        answerForm.classList.add("hidden"); optionsEl.classList.remove("hidden");
        q.options.forEach((opt) => {
            const btn = document.createElement("button");
            btn.type = "button"; btn.className = "option"; btn.textContent = String(opt);
            btn.addEventListener("click", () => onAnswer(opt));
            optionsEl.appendChild(btn);
        });
    }

    function answersMatch(choice, answer) {
        return (typeof answer === "number") ? Number(choice) === answer : String(choice) === String(answer);
    }

    function onAnswer(choice) {
        if (locked) return; locked = true;
        const q = questions[qIndex], correct = answersMatch(choice, q.answer);

        if (q.kind === "choice") {
            [...optionsEl.querySelectorAll(".option")].forEach((b) => {
                b.disabled = true;
                if (answersMatch(b.textContent, q.answer)) b.classList.add("correct");
                else if (answersMatch(b.textContent, choice) && !correct) b.classList.add("wrong");
            });
        } else {
            answerInput.disabled = true;
            answerForm.querySelector("button").disabled = true;
            answerInput.classList.add(correct ? "correct" : "wrong");
        }
        if (correct) { correctCount++; feedbackEl.textContent = "你真棒！"; feedbackEl.className = "feedback good"; burstFireworks(); }
        else { feedbackEl.textContent = "再接再厉！答案是 " + q.answer; feedbackEl.className = "feedback bad"; }
        setTimeout(() => { qIndex++; qIndex >= TOTAL ? finishLevel() : renderQuestion(); }, correct ? 1600 : 1400);
    }

    function showResultScreen() {
        resultPoints.textContent = String(state.points);
        resultMinutes.textContent = tabletMinutes() + " 分钟";

        const allCleared = Object.keys(state.cleared).length === LEVELS.length - 1;
        // Email button only when all 6 levels cleared
        const emailArea = document.querySelector(".email-send-area");
        emailArea.classList.toggle("hidden", !allCleared);
        if (allCleared) updateSendBtn();

        const hasNext = LEVELS.some((_, i) => i > levelIndex && !state.cleared[i]);
        nextBtn.classList.toggle("hidden", !hasNext);
        retryBtn.classList.toggle("hidden", true);
        homeBtn.classList.remove("hidden");

        showScreen(resultScreen);
    }

    function finishLevel() {
        const passed = correctCount >= PASS_NEED;
        resultTitle.textContent = passed ? "本关通过！" : "未得分";
        resultDetail.textContent = "本关答对 " + correctCount + " / " + TOTAL + " 题";

        if (!state.levelResults) state.levelResults = {};
        state.levelResults[levelIndex] = {
            type: LEVELS[levelIndex].type, correct: correctCount, total: TOTAL, passed: passed,
        };

        if (passed) {
            state.points += POINT_PER_PASS; state.cleared[levelIndex] = true;
            saveState(); updateStatsBar();
            resultReward.innerHTML = '<p class="reward-gain">+' + POINT_PER_PASS + ' 分</p>' +
                '<p class="reward-time">兑换平板时间 +' + MINUTES_PER_POINT + ' 分钟</p>';
            burstFireworks(true);

            if (Object.keys(state.cleared).length === LEVELS.length) {
                resultTitle.textContent = "🎉 全部通关！";
                resultReward.innerHTML += '<p class="reward-final">累计 ' + state.points + ' 分 · 平板 ' + tabletMinutes() + ' 分钟</p>';
            }
        } else {
            resultReward.innerHTML = '<p class="reward-fail">答对不足 ' + PASS_NEED + ' 题，不能得分</p>' +
                '<p class="reward-note">再试一次，争取通关！</p>';
        }

        // Snake game easter egg after level 2 (index 1)
        if (passed && levelIndex === 1) {
            startSnakeGame(() => showResultScreen());
        } else {
            showResultScreen();
        }
    }

    // ============ Collection ============

    function startCollection() {
        collectionEmailArea.classList.add("hidden");
        collectionEmailStatus.textContent = ""; collectionEmailStatus.className = "email-status";
        showScreen(collectionScreen);
    }

    function submitCollection() {
        collectionEmailArea.classList.remove("hidden");
        sendEmailCollectionBtn.disabled = false;
        sendEmailCollectionBtn.textContent = "📧 发送报告到邮箱";
        collectionEmailStatus.textContent = "";
        collectionEmailStatus.className = "email-status";
    }

    // ============ Main Flow ============

    function startLevel(index) {
        if (!ready || state.cleared[index]) return;
        levelIndex = index; levelType = LEVELS[index].type; brandTitle.textContent = LEVELS[index].name;
        if (levelType === "collection") { startCollection(); return; }
        questions = makeQuestions(levelType); qIndex = 0; correctCount = 0;
        showScreen(quizScreen); renderQuestion();
    }

    // ============ Snake Game ============

    const snakeOverlay = document.getElementById("snake-overlay");
    const snakeCanvas = document.getElementById("snake-canvas");
    const snakeCtx = snakeCanvas.getContext("2d");
    const snakeScore = document.getElementById("snake-score");
    const snakeMsg = document.getElementById("snake-msg");
    const snakeSkip = document.getElementById("snake-skip");
    const snakeRestart = document.getElementById("snake-restart");
    const GRID = 15, CELL = 20;
    let snake = [], snakeFood = [], snakeDir = [0, 1], snakeNextDir = [0, 1];
    let snakeTimer = null, snakeGameScore = 0, snakeActive = false, snakeStarted = false;
    let snakeOnDone = null, snakeLimitless = false, snakeRestarts = 0;

    function snakeRandFood() {
        let f;
        do { f = [rand(0, GRID - 1), rand(0, GRID - 1)]; }
        while (snake.some(([x, y]) => x === f[0] && y === f[1]));
        return f;
    }

    function snakeDraw() {
        snakeCtx.clearRect(0, 0, GRID * CELL, GRID * CELL);
        // Food
        snakeCtx.fillStyle = "#ff6b6b";
        snakeCtx.fillRect(snakeFood[0] * CELL, snakeFood[1] * CELL, CELL - 1, CELL - 1);
        // Snake
        snake.forEach(([x, y], i) => {
            snakeCtx.fillStyle = i === 0 ? "#5fd4a8" : "#3aad7a";
            snakeCtx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        });
    }

    function snakeTick() {
        snakeDir = snakeNextDir;
        const head = snake[0];
        const nx = head[0] + snakeDir[0], ny = head[1] + snakeDir[1];

        // Wall or self collision
        if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID || snake.some(([x, y]) => x === nx && y === ny)) {
            snakeGameOver();
            return;
        }

        snake.unshift([nx, ny]);
        if (nx === snakeFood[0] && ny === snakeFood[1]) {
            snakeGameScore++;
            snakeScore.textContent = "得分：" + snakeGameScore;
            snakeFood = snakeRandFood();
        } else {
            snake.pop();
        }
        snakeDraw();
    }

    function snakeGameOver() {
        clearInterval(snakeTimer); snakeTimer = null;
        snakeActive = false; snakeStarted = false;
        snakeMsg.textContent = "游戏结束！得分：" + snakeGameScore + " 🐍";
        snakeMsg.style.color = "#e85d4c";
        snakeSkip.classList.remove("hidden");

        if (!snakeLimitless && snakeRestarts < 2 && snakeOnDone) {
            snakeRestart.classList.remove("hidden");
            snakeRestart.textContent = "🔄 重新开始（还可玩 " + (2 - snakeRestarts) + " 次）";
        } else if (snakeLimitless) {
            snakeRestart.classList.remove("hidden");
            snakeRestart.textContent = "🔄 重新开始";
        } else {
            snakeRestart.classList.add("hidden");
        }
    }

    function snakeEnd() {
        clearInterval(snakeTimer); snakeTimer = null;
        snakeActive = false; snakeStarted = false;
        snakeOverlay.classList.add("hidden");
        if (snakeOnDone) { const cb = snakeOnDone; snakeOnDone = null; cb(); }
    }

    function snakeKeyHandler(e) {
        if (!snakeActive) return;
        const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
        if (d && (d[0] !== -snakeDir[0] || d[1] !== -snakeDir[1])) {
            snakeNextDir = d;
            e.preventDefault();
        }
    }

    function snakeCountdown(count, cb) {
        snakeMsg.textContent = count + "...";
        snakeMsg.style.color = "#e85d4c";
        if (count > 1) setTimeout(() => snakeCountdown(count - 1, cb), 800);
        else setTimeout(cb, 600);
    }

    function snakeGameInit() {
        snake = [[7, 7], [6, 7], [5, 7]];
        snakeDir = [1, 0]; snakeNextDir = [1, 0];
        snakeGameScore = 0; snakeActive = false; snakeStarted = false;
        snakeFood = snakeRandFood();
        snakeScore.textContent = "得分：0";
        snakeMsg.style.color = "#e85d4c";
    }

    function startSnakeGame(onDone, limitless) {
        snakeOnDone = onDone; snakeLimitless = !!limitless;
        if (!snakeLimitless && !snakeRestarts) snakeRestarts = 0;
        snakeGameInit();
        // Welcome phase: only show message, hide everything else
        snakeMsg.textContent = "是不是做题辛苦啦，来玩一局游戏放松放松你的小脑袋先~~";
        snakeMsg.style.color = "#c94436";
        snakeMsg.style.fontSize = "1.3rem";
        snakeCanvas.classList.add("hidden");
        snakeScore.classList.add("hidden");
        document.querySelector(".snake-controls").classList.add("hidden");
        snakeSkip.classList.add("hidden");
        snakeRestart.classList.add("hidden");
        snakeOverlay.classList.remove("hidden");
        // After 3s → show game + countdown
        setTimeout(() => {
            snakeMsg.textContent = "3...";
            snakeMsg.style.color = "#e85d4c";
            snakeMsg.style.fontSize = "";
            snakeCanvas.classList.remove("hidden");
            snakeScore.classList.remove("hidden");
            document.querySelector(".snake-controls").classList.remove("hidden");
            snakeSkip.classList.remove("hidden");
            snakeDraw();
            snakeCountdown(3, () => {
                snakeActive = true; snakeStarted = true;
                snakeMsg.textContent = "开始！";
                snakeMsg.style.color = "#3aad7a";
                snakeTimer = setInterval(snakeTick, 300);
            });
        });
    }

    // Debug mode: 5 rapid clicks on score area → clear first 5 levels, leave level 6 playable
    let debugClicks = 0, debugTimer = null;
    statPoints.parentElement.addEventListener("click", () => {
        debugClicks++;
        clearTimeout(debugTimer);
        if (debugClicks >= 5) {
            debugClicks = 0;
            // Clear first 5 levels, leave level 6 (collection) clickable
            for (let i = 0; i < LEVELS.length - 1; i++) {
                state.cleared[i] = true;
                state.levelResults[i] = { type: LEVELS[i].type, correct: 5, total: 5, passed: true };
            }
            state.points = 5;
            saveState(); updateStatsBar(); renderMap();
        } else {
            debugTimer = setTimeout(() => { debugClicks = 0; }, 800);
        }
    });

    // Direction button handlers
    document.querySelectorAll(".snake-dir").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (!snakeActive) return;
            const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[btn.dataset.dir];
            if (d && (d[0] !== -snakeDir[0] || d[1] !== -snakeDir[1])) snakeNextDir = d;
        });
    });

    snakeSkip.addEventListener("click", snakeEnd);

    snakeRestart.addEventListener("click", () => {
        snakeRestarts++;
        snakeGameInit();
        // Welcome phase
        snakeMsg.textContent = "是不是做题辛苦啦，来玩一局游戏放松放松你的小脑袋先~~";
        snakeMsg.style.color = "#c94436";
        snakeMsg.style.fontSize = "1.3rem";
        snakeCanvas.classList.add("hidden");
        snakeScore.classList.add("hidden");
        document.querySelector(".snake-controls").classList.add("hidden");
        snakeSkip.classList.add("hidden");
        snakeRestart.classList.add("hidden");
        snakeOverlay.classList.remove("hidden");
        setTimeout(() => {
            snakeMsg.textContent = "3...";
            snakeMsg.style.color = "#e85d4c";
            snakeMsg.style.fontSize = "";
            snakeCanvas.classList.remove("hidden");
            snakeScore.classList.remove("hidden");
            document.querySelector(".snake-controls").classList.remove("hidden");
            snakeSkip.classList.remove("hidden");
            snakeDraw();
            snakeCountdown(3, () => {
                snakeActive = true; snakeStarted = true;
                snakeMsg.textContent = "开始！";
                snakeMsg.style.color = "#3aad7a";
                snakeTimer = setInterval(snakeTick, 300);
            });
        });
    });

    // Title triple-click easter egg
    let titleClicks = 0, titleTimer = null;
    brandTitle.addEventListener("click", () => {
        titleClicks++;
        clearTimeout(titleTimer);
        if (titleClicks >= 3) {
            titleClicks = 0;
            snakeRestarts = 0;
            startSnakeGame(null, true);
        } else {
            titleTimer = setTimeout(() => { titleClicks = 0; }, 800);
        }
    });

    // Always-on keydown listener (only processes when snakeActive)
    document.addEventListener("keydown", snakeKeyHandler);

    // ============ Fireworks ============

    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

    function burstFireworks(big) {
        const n = big ? 5 : 3;
        for (let i = 0; i < n; i++) spawnBurst(canvas.width * (0.25 + Math.random() * 0.5), canvas.height * (0.2 + Math.random() * 0.35), big ? 55 : 40);
        if (!animId) loopFireworks();
    }

    function spawnBurst(x, y, n) {
        const colors = ["#e85d4c", "#ffb347", "#ffe066", "#5fd4a8", "#7ec8e3", "#ff8fab", "#fff8f0"];
        for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 * i) / n + Math.random() * 0.2, s = 2 + Math.random() * 5;
            particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, decay: 0.012 + Math.random() * 0.012, color: colors[rand(0, colors.length - 1)], size: 2 + Math.random() * 3 });
        }
    }

    function loopFireworks() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles = particles.filter((p) => p.life > 0);
        for (const p of particles) {
            p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= p.decay;
            ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        animId = particles.length ? requestAnimationFrame(loopFireworks) : (ctx.clearRect(0, 0, canvas.width, canvas.height), null);
    }

    // ============ Events ============

    resizeCanvas(); window.addEventListener("resize", resizeCanvas);

    answerForm.addEventListener("submit", (e) => {
        e.preventDefault(); if (locked) return;
        const v = answerInput.value.trim();
        if (!v) { feedbackEl.textContent = "请先填入答案"; feedbackEl.className = "feedback bad"; return; }
        onAnswer(Number(v));
    });

    nextBtn.addEventListener("click", () => {
        const next = LEVELS.findIndex((_, i) => i > levelIndex && !state.cleared[i]);
        next !== -1 ? startLevel(next) : renderMap();
    });

    retryBtn.addEventListener("click", () => { state.cleared[levelIndex] ? renderMap() : startLevel(levelIndex); });
    homeBtn.addEventListener("click", renderMap);
    quizBackBtn.addEventListener("click", renderMap);
    sendEmailBtn.addEventListener("click", sendReport);

    resetBtn.addEventListener("click", async () => {
        if (!confirm("确定清空进度和得分，重新开始？")) return;
        state = defaultState(); saveState();
        try { await idbClearAll(); } catch {}
        renderMap();
    });

    collectionSubmitBtn.addEventListener("click", submitCollection);
    collectionBackBtn.addEventListener("click", renderMap);
    sendEmailCollectionBtn.addEventListener("click", sendReport);

    // ============ Init ============

    async function init() {
        // Register service worker for PWA
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("service-worker.js").catch(() => {});
        }
        try { await openDB(); } catch (e) { console.warn("IndexedDB:", e); }
        try {
            loadQuestionFiles(); ready = true;
            if (introEl) introEl.textContent = "科学 " + SCIENCE_BANK.length + " 题、英语 " + ENGLISH_BANK.length + " 题。所有关卡自由选择。";
            renderMap();
        } catch (err) {
            console.error(err);
            if (introEl) introEl.textContent = "题库加载失败：请确认已引入 levels.js、science.js、english.js。";
        }
    }

    init();
})();
