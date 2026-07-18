const CACHE = "calc-game-v1";
const FILES = [
    "/calculate-game/",
    "/calculate-game/index.html",
    "/calculate-game/game.js",
    "/calculate-game/style.css",
    "/calculate-game/questions/levels.js",
    "/calculate-game/questions/science.js",
    "/calculate-game/questions/english.js",
    "/calculate-game/manifest.json",
    "https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Nunito:wght@600;800&display=swap",
    "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"
];

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener("fetch", (e) => {
    e.respondWith(
        caches.match(e.request).then((r) => r || fetch(e.request))
    );
});
