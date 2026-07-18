(() => {
    const TOTAL = 5;
    const PASS_NEED = 4;
    const POINT_PER_PASS = 1;
    const MINUTES_PER_POINT = 6;
    const MAX_TABLET_MINUTES = 30;
    const MAX_LEVELS = 6;
    const COLLECTION_MIN = 3;
    const STORAGE_KEY = "math-adventure-v7";
    const IDB_NAME = "hermes-collection";
    const IDB_VERSION = 1;

    // EmailJS — pre-configured
    const EMAILJS_PUBLIC_KEY = "hhj6Imrb-moKG6fI4";
    const EMAILJS_SERVICE_ID = "service_tp6h1sf";
    const EMAILJS_TEMPLATE_ID = "template_920jcfo";
    const RECIPIENT = "ronald.huang@aigens.com";

    const TYPE_LABELS = {
        "mul-2x1": "两位数 × 一位数 · 填空",
        "mul-2x2": "两位数 × 两位数 · 填空",
        "div-3x1": "三位数 ÷ 一位数 · 填空",
        "div-3x2": "三位数 ÷ 两位数 · 填空",
        science: "科学常识 · 选择题",
        english: "英语单词 · 选择题",
        collection: "拍照或录音 · 好词好句",
    };

    let LEVELS = [];
    let SCIENCE_BANK = [];
    let ENGLISH_BANK = [];

    // DOM
    const mapScreen = document.getElementById("map-screen");
    const quizScreen = document.getElementById("quiz-screen");
    const resultScreen = document.getElementById("result-screen");
    const collectionScreen = document.getElementById("collection-screen");
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

    const resultActions = document.querySelector("#result-screen > .result-actions");
    const collectionResultActions = document.getElementById("collection-result-actions");
    const sendEmailBtn = document.getElementById("send-email-btn");
    const emailSendStatus = document.getElementById("email-send-status");
    const homeBtn2 = document.getElementById("home-btn-2");

    const cameraBtn = document.getElementById("camera-btn");
    const recordBtn = document.getElementById("record-btn");
    const recordBtnText = document.getElementById("record-btn-text");
    const cameraInput = document.getElementById("camera-input");
    const recordingStatus = document.getElementById("recording-status");
    const audioPreview = document.getElementById("audio-preview");
    const collectionList = document.getElementById("collection-list");
    const collectionFeedback = document.getElementById("collection-feedback");
    const collectionProgressText = document.getElementById("collection-progress-text");
    const collectionProgressFill = document.getElementById("collection-progress-fill");
    const collectionSubmitBtn = document.getElementById("collection-submit-btn");
    const collectionBackBtn = document.getElementById("collection-back-btn");

    let state = loadState();
    let levelIndex = 0;
    let levelType = "";
    let questions = [];
    let qIndex = 0;
    let correctCount = 0;
    let locked = false;
    let particles = [];
    let animId = null;
    let ready = false;
    let idb = null;
    let collectedItems = [];
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    // ============ IndexedDB ============

    async function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("items"))
                    db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
            };
            req.onsuccess = (e) => { idb = e.target.result; resolve(idb); };
            req.onerror = () => reject(req.error);
        });
    }

    function idbAdd(blob, type) {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction("items", "readwrite");
            const req = tx.objectStore("items").add({ blob, type, ts: Date.now() });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function idbGetAll() {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction("items", "readonly");
            const req = tx.objectStore("items").getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function idbDelete(id) {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction("items", "readwrite");
            const req = tx.objectStore("items").delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    function idbClearAll() {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction("items", "readwrite");
            const req = tx.objectStore("items").clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    // ============ Email ============

    function initEmailJS() {
        if (window.emailjs) {
            try { window.emailjs.init(EMAILJS_PUBLIC_KEY); return true; }
            catch (e) { console.warn("EmailJS init failed:", e); return false; }
        }
        return false;
    }

    function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async function sendFinalReport() {
        sendEmailBtn.disabled = true;
        sendEmailBtn.innerHTML = "发送中...";
        emailSendStatus.textContent = "";
        emailSendStatus.className = "email-status";

        if (!initEmailJS()) {
            emailSendStatus.textContent = "EmailJS 未加载，请检查网络后刷新页面重试";
            emailSendStatus.className = "email-status error";
            sendEmailBtn.disabled = false;
            sendEmailBtn.innerHTML = "📧 重试发送";
            return;
        }

        try {
            const results = state.levelResults || {};
            let lines = ["学科闯关赛 — 全部通关报告", "─────────────────────", ""];

            let quizCorrect = 0, quizTotal = 0;
            for (let i = 0; i < LEVELS.length; i++) {
                const r = results[i];
                if (!r) continue;
                if (r.type === "collection") {
                    lines.push(LEVELS[i].name + "：收集 " + (r.itemCount || 0) + " 条好词好句 → 通关 ✓");
                } else {
                    const pct = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
                    const status = r.passed ? "通关 ✓" : "未通过 ✗";
                    lines.push(LEVELS[i].name + "：" + r.correct + "/" + r.total + " 正确（" + pct + "%）→ " + status);
                    quizCorrect += r.correct;
                    quizTotal += r.total;
                }
            }

            lines.push("");
            const quizPct = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 0;
            lines.push("前 5 关总正确率：" + quizCorrect + "/" + quizTotal + "（" + quizPct + "%）");
            lines.push("最终得分：" + state.points + " 分 · 平板时间：" + tabletMinutes() + " 分钟");

            const summary = lines.join("\n");

            const allItems = await idbGetAll();
            const images = allItems.filter((i) => i.type === "image");
            const audios = allItems.filter((i) => i.type === "audio");

            const photoUrls = [];
            for (let i = 0; i < Math.min(images.length, 5); i++) {
                try { photoUrls.push(await blobToDataURL(images[i].blob)); }
                catch (e) { console.warn("Image conversion failed:", i, e); }
            }

            const params = {
                to_email: RECIPIENT,
                subject: "学科闯关赛 — 全部通关报告",
                message: summary,
                quiz_accuracy: quizPct + "%",
                total_score: String(state.points),
                tablet_minutes: String(tabletMinutes()),
                photo_count: String(images.length),
                audio_count: String(audios.length),
            };

            for (let i = 0; i < photoUrls.length; i++) params["photo_" + (i + 1)] = photoUrls[i];
            for (let i = 0; i < Math.min(audios.length, 3); i++) params["audio_" + (i + 1)] = audios[i].blob;

            const resp = await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
            if (resp.status === 200) {
                emailSendStatus.textContent = "报告已发送到 " + RECIPIENT + " 📬";
                emailSendStatus.className = "email-status success";
                sendEmailBtn.innerHTML = "✅ 已发送";
            } else {
                throw new Error("Status " + resp.status);
            }
        } catch (err) {
            console.error("Email error:", err);
            emailSendStatus.textContent = "发送失败：" + (err.message || "请检查网络后重试");
            emailSendStatus.className = "email-status error";
            sendEmailBtn.disabled = false;
            sendEmailBtn.innerHTML = "📧 重试发送";
        }
    }

    // ============ State ============

    function defaultState() {
        return { points: 0, cleared: {}, levelResults: {} };
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultState();
            const parsed = JSON.parse(raw);
            return {
                points: Number(parsed.points) || 0,
                cleared: typeof parsed.cleared === "object" ? parsed.cleared : {},
                levelResults: typeof parsed.levelResults === "object" ? parsed.levelResults : {},
            };
        } catch { return defaultState(); }
    }

    function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

    function tabletMinutes() {
        return Math.min(state.points * MINUTES_PER_POINT, MAX_TABLET_MINUTES);
    }

    function updateStatsBar() {
        statPoints.textContent = String(state.points);
        statMinutes.textContent = tabletMinutes() + " 分钟";
    }

    function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

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
        if (!LEVELS.length) throw new Error("levels.js empty");
        if (!SCIENCE_BANK.length || !ENGLISH_BANK.length)
            throw new Error("question banks empty");
    }

    // ============ Quiz ============

    function makeMathQuestion(type) {
        if (type === "mul-2x1") {
            const a = rand(12, 99), b = rand(2, 9);
            return { kind: "fill", prompt: a + " × " + b + " = ?", answer: a * b, key: a + "x" + b };
        }
        if (type === "mul-2x2") {
            const a = rand(12, 99), b = rand(12, 99);
            return { kind: "fill", prompt: a + " × " + b + " = ?", answer: a * b, key: a + "x" + b };
        }
        if (type === "div-3x1") {
            const b = rand(2, 9), ans = rand(12, 99), a = b * ans;
            if (a < 100 || a > 999) return null;
            return { kind: "fill", prompt: a + " ÷ " + b + " = ?", answer: ans, key: a + "÷" + b };
        }
        const b = rand(11, 28), ans = rand(4, 35), a = b * ans;
        if (a < 100 || a > 999) return null;
        return { kind: "fill", prompt: a + " ÷ " + b + " = ?", answer: ans, key: a + "÷" + b };
    }

    function pickFromBank(bank) {
        const item = bank[rand(0, bank.length - 1)];
        return { kind: "choice", prompt: item.prompt, answer: item.answer,
                 options: shuffle([...item.options]), key: item.prompt };
    }

    function makeQuestions(type) {
        const list = [], used = new Set();
        let g = 0;
        while (list.length < TOTAL && g < 400) {
            g++;
            let q = type === "science" ? pickFromBank(SCIENCE_BANK)
                  : type === "english" ? pickFromBank(ENGLISH_BANK)
                  : makeMathQuestion(type);
            if (!q || used.has(q.key)) continue;
            used.add(q.key);
            list.push(q);
        }
        return list;
    }

    function showScreen(screen) {
        [mapScreen, quizScreen, resultScreen, collectionScreen].forEach((el) => el.classList.add("hidden"));
        screen.classList.remove("hidden");
    }

    function renderMap() {
        brandTitle.textContent = "学科闯关赛";
        updateStatsBar();
        levelList.innerHTML = "";
        const allCleared = Object.keys(state.cleared).length === LEVELS.length;

        LEVELS.forEach((level, i) => {
            const cleared = Boolean(state.cleared[i]);
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "level-btn";
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
            btn.innerHTML = '<span class="level-num">' + (i + 1) + '</span>' +
                '<span class="level-info">' +
                    '<span class="mode-name">' + level.name + '</span>' +
                    '<span class="mode-desc">' + (TYPE_LABELS[level.type] || level.type) + status + '</span>' +
                '</span>';
            if (!cleared) btn.addEventListener("click", () => startLevel(i));
            levelList.appendChild(btn);
        });

        if (introEl && ready) {
            introEl.textContent = allCleared
                ? "🎉 全部通关！得分 " + state.points + "，平板 " + tabletMinutes() + " 分钟。可点「发送报告到邮箱」。"
                : "共 " + LEVELS.length + " 关。科学 " + SCIENCE_BANK.length + " 题、" +
                  "英语 " + ENGLISH_BANK.length + " 题。所有关卡自由选择。";
        }
        showScreen(mapScreen);
    }

    function updateProgress() {
        progressText.textContent = "第 " + (qIndex + 1) + " / " + TOTAL + " 题";
        progressFill.style.width = ((qIndex + 1) / TOTAL * 100) + "%";
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
        if (correct) {
            correctCount++;
            feedbackEl.textContent = "你真棒！";
            feedbackEl.className = "feedback good";
            burstFireworks();
        } else {
            feedbackEl.textContent = "再接再厉！答案是 " + q.answer;
            feedbackEl.className = "feedback bad";
        }
        setTimeout(() => {
            qIndex++;
            if (qIndex >= TOTAL) finishLevel();
            else renderQuestion();
        }, correct ? 1600 : 1400);
    }

    function showResultScreen() {
        resultPoints.textContent = String(state.points);
        resultMinutes.textContent = tabletMinutes() + " 分钟";

        const allCleared = Object.keys(state.cleared).length === LEVELS.length;
        resultActions.classList.add("hidden");
        collectionResultActions.classList.add("hidden");

        if (allCleared) {
            collectionResultActions.classList.remove("hidden");
            sendEmailBtn.disabled = false;
            sendEmailBtn.innerHTML = "📧 发送报告到邮箱";
            emailSendStatus.textContent = "";
            emailSendStatus.className = "email-status";
        } else {
            resultActions.classList.remove("hidden");
            const hasNext = LEVELS.some((_, i) => i > levelIndex && !state.cleared[i]);
            nextBtn.classList.toggle("hidden", !hasNext);
            retryBtn.classList.toggle("hidden", true);
            homeBtn.classList.remove("hidden");
        }
        showScreen(resultScreen);
    }

    function finishLevel() {
        const passed = correctCount >= PASS_NEED;
        resultTitle.textContent = passed ? "本关通过！" : "未得分";
        resultDetail.textContent = "本关答对 " + correctCount + " / " + TOTAL + " 题";

        if (!state.levelResults) state.levelResults = {};
        state.levelResults[levelIndex] = {
            type: LEVELS[levelIndex].type,
            correct: correctCount,
            total: TOTAL,
            passed: passed,
        };

        if (passed) {
            state.points += POINT_PER_PASS;
            state.cleared[levelIndex] = true;
            saveState();
            updateStatsBar();
            resultReward.innerHTML =
                '<p class="reward-gain">+' + POINT_PER_PASS + ' 分</p>' +
                '<p class="reward-time">兑换平板时间 +' + MINUTES_PER_POINT + ' 分钟</p>';
            burstFireworks(true);
        } else {
            resultReward.innerHTML =
                '<p class="reward-fail">答对不足 ' + PASS_NEED + ' 题，不能得分</p>' +
                '<p class="reward-note">再试一次，争取通关！</p>';
        }

        const allCleared = Object.keys(state.cleared).length === LEVELS.length;
        if (allCleared && passed) {
            resultTitle.textContent = "🎉 全部通关！";
            resultReward.innerHTML += '<p class="reward-final">累计 ' + state.points +
                ' 分 · 平板 ' + tabletMinutes() + ' 分钟</p>';
        }
        showResultScreen();
    }

    // ============ Collection ============

    async function startCollection() {
        collectedItems = [];
        isRecording = false;
        mediaRecorder = null;
        audioChunks = [];
        try {
            const all = await idbGetAll();
            all.forEach((item) => {
                collectedItems.push({
                    id: collectedItems.length, type: item.type,
                    data: URL.createObjectURL(item.blob), dbId: item.id,
                });
            });
        } catch {}
        renderCollection();
        showScreen(collectionScreen);
    }

    function updateCollectionProgress() {
        const n = collectedItems.length;
        collectionProgressText.textContent = "已收集 " + n + " / " + COLLECTION_MIN + " 条好词好句";
        collectionProgressFill.style.width = Math.min((n / COLLECTION_MIN) * 100, 100) + "%";
        collectionSubmitBtn.disabled = n < COLLECTION_MIN;
        collectionSubmitBtn.textContent = n >= COLLECTION_MIN
            ? "提交收集，领取 1 分！"
            : "提交收集（需至少 " + COLLECTION_MIN + " 条）";
    }

    function renderCollection() {
        collectionFeedback.textContent = "";
        collectionFeedback.className = "feedback";
        recordingStatus.textContent = "";
        audioPreview.classList.add("hidden");
        updateCollectionProgress();
        collectionList.innerHTML = "";

        collectedItems.forEach((item, i) => {
            const div = document.createElement("div");
            div.className = "collection-item";

            const num = document.createElement("span");
            num.className = "item-num";
            num.textContent = String(i + 1);
            div.appendChild(num);

            if (item.type === "image") {
                const img = document.createElement("img");
                img.className = "item-thumb";
                img.src = item.data;
                div.appendChild(img);
            } else {
                const audio = document.createElement("audio");
                audio.className = "item-audio";
                audio.controls = true;
                audio.src = item.data;
                div.appendChild(audio);
            }

            const del = document.createElement("button");
            del.className = "item-delete";
            del.textContent = "🗑️";
            del.addEventListener("click", async () => {
                if (item.dbId != null) { try { await idbDelete(item.dbId); } catch {} }
                URL.revokeObjectURL(item.data);
                collectedItems.splice(i, 1);
                renderCollection();
            });
            div.appendChild(del);
            collectionList.appendChild(div);
        });
    }

    function handleCameraClick() { cameraInput.click(); }

    async function handleCameraFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const dbId = await idbAdd(file, "image");
            collectedItems.push({
                id: collectedItems.length, type: "image",
                data: URL.createObjectURL(file), dbId,
            });
            renderCollection();
            collectionFeedback.textContent = "照片记录成功！";
            collectionFeedback.className = "feedback good";
        } catch {
            collectionFeedback.textContent = "保存失败，存储空间不足";
            collectionFeedback.className = "feedback bad";
        }
        cameraInput.value = "";
    }

    async function handleRecordClick() {
        if (isRecording) { stopRecording(); return; }
        if (!navigator.mediaDevices?.getUserMedia) {
            recordingStatus.textContent = "当前浏览器不支持录音";
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            const mt = getSupportedMimeType();
            mediaRecorder = new MediaRecorder(stream, { mimeType: mt });
            mediaRecorder.ondataavailable = (e) => { if (e.data.size) audioChunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunks, { type: mt });
                try {
                    const dbId = await idbAdd(blob, "audio");
                    collectedItems.push({
                        id: collectedItems.length, type: "audio",
                        data: URL.createObjectURL(blob), dbId,
                    });
                    renderCollection();
                    collectionFeedback.textContent = "录音保存成功！";
                    collectionFeedback.className = "feedback good";
                } catch {
                    collectionFeedback.textContent = "保存失败，存储空间不足";
                    collectionFeedback.className = "feedback bad";
                }
                stream.getTracks().forEach((t) => t.stop());
                recordingStatus.textContent = "";
            };
            mediaRecorder.start();
            isRecording = true;
            recordBtn.classList.add("recording");
            recordBtnText.textContent = "停止录音";
            recordingStatus.textContent = "🔴 正在录音中...";
        } catch {
            recordingStatus.textContent = "无法访问麦克风";
        }
    }

    function stopRecording() {
        if (mediaRecorder?.state === "recording") mediaRecorder.stop();
        isRecording = false;
        recordBtn.classList.remove("recording");
        recordBtnText.textContent = "开始录音";
    }

    function getSupportedMimeType() {
        for (const t of ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"])
            if (MediaRecorder.isTypeSupported(t)) return t;
        return "audio/webm";
    }

    async function submitCollection() {
        if (collectedItems.length < COLLECTION_MIN) return;

        state.points += POINT_PER_PASS;
        state.cleared[levelIndex] = true;
        if (!state.levelResults) state.levelResults = {};
        state.levelResults[levelIndex] = { type: "collection", itemCount: collectedItems.length, passed: true };
        saveState();
        updateStatsBar();

        resultTitle.textContent = "好词好句收集完成！";
        resultDetail.textContent = "共收集 " + collectedItems.length + " 条好词好句";
        resultReward.innerHTML =
            '<p class="reward-gain">+' + POINT_PER_PASS + ' 分</p>' +
            '<p class="reward-time">兑换平板时间 +' + MINUTES_PER_POINT + ' 分钟</p>';
        burstFireworks(true);

        const allCleared = Object.keys(state.cleared).length === LEVELS.length;
        if (allCleared) {
            resultTitle.textContent = "🎉 全部通关！";
            resultReward.innerHTML += '<p class="reward-final">累计 ' + state.points +
                ' 分 · 平板 ' + tabletMinutes() + ' 分钟</p>';
        }

        collectedItems.forEach((i) => URL.revokeObjectURL(i.data));
        collectedItems = [];
        isRecording = false;

        showResultScreen();
    }

    // ============ Main Flow ============

    function startLevel(index) {
        if (!ready || state.cleared[index]) return;
        levelIndex = index;
        levelType = LEVELS[index].type;
        brandTitle.textContent = LEVELS[index].name;

        if (levelType === "collection") { startCollection(); return; }
        questions = makeQuestions(levelType);
        qIndex = 0;
        correctCount = 0;
        showScreen(quizScreen);
        renderQuestion();
    }

    // ============ Fireworks ============

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function burstFireworks(big = false) {
        const count = big ? 5 : 3;
        for (let i = 0; i < count; i++)
            spawnBurst(canvas.width * (0.25 + Math.random() * 0.5),
                       canvas.height * (0.2 + Math.random() * 0.35), big ? 55 : 40);
        if (!animId) loopFireworks();
    }

    function spawnBurst(x, y, n) {
        const colors = ["#e85d4c", "#ffb347", "#ffe066", "#5fd4a8", "#7ec8e3", "#ff8fab", "#fff8f0"];
        for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
            const s = 2 + Math.random() * 5;
            particles.push({
                x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                life: 1, decay: 0.012 + Math.random() * 0.012,
                color: colors[rand(0, colors.length - 1)], size: 2 + Math.random() * 3,
            });
        }
    }

    function loopFireworks() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles = particles.filter((p) => p.life > 0);
        for (const p of particles) {
            p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= p.decay;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (particles.length) animId = requestAnimationFrame(loopFireworks);
        else { animId = null; ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }

    // ============ Events ============

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    answerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (locked) return;
        const v = answerInput.value.trim();
        if (!v) { feedbackEl.textContent = "请先填入答案"; feedbackEl.className = "feedback bad"; return; }
        onAnswer(Number(v));
    });

    nextBtn.addEventListener("click", () => {
        const next = LEVELS.findIndex((_, i) => i > levelIndex && !state.cleared[i]);
        if (next !== -1) startLevel(next); else renderMap();
    });

    retryBtn.addEventListener("click", () => {
        if (!state.cleared[levelIndex]) startLevel(levelIndex); else renderMap();
    });

    homeBtn.addEventListener("click", renderMap);
    homeBtn2.addEventListener("click", renderMap);
    sendEmailBtn.addEventListener("click", sendFinalReport);

    resetBtn.addEventListener("click", async () => {
        if (!confirm("确定清空进度和得分，重新开始？")) return;
        state = defaultState();
        saveState();
        try { await idbClearAll(); } catch {}
        renderMap();
    });

    cameraBtn.addEventListener("click", handleCameraClick);
    cameraInput.addEventListener("change", handleCameraFile);
    recordBtn.addEventListener("click", handleRecordClick);
    collectionSubmitBtn.addEventListener("click", submitCollection);
    collectionBackBtn.addEventListener("click", () => {
        if (isRecording) stopRecording();
        renderMap();
    });

    // ============ Init ============

    async function init() {
        try { await openDB(); } catch (e) { console.warn("IndexedDB unavailable:", e); }
        try {
            loadQuestionFiles();
            ready = true;
            if (introEl) {
                introEl.textContent = "共 " + LEVELS.length + " 关。科学 " + SCIENCE_BANK.length +
                    " 题、英语 " + ENGLISH_BANK.length + " 题。所有关卡自由选择。";
            }
            renderMap();
        } catch (err) {
            console.error(err);
            if (introEl) introEl.textContent = "题库加载失败：请确认已引入 levels.js、science.js、english.js。";
        }
    }

    init();
})();
