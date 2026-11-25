// 오프라인용 service worker: 설치 때 앱 파일을 모두 받아 두고, 평소에는 네트워크 우선(받은 파일로 캐시 갱신),
// 네트워크가 안 되면 캐시로 응답한다. 다른 주소(LLM · GitHub) 요청은 가로채지 않는다.
const VERSION = "wr-1.0.1";
const FILES = [
  "./", "index.html", "privacy.html", "app.css", "manifest.webmanifest",
  "js/app.js", "js/core.js", "js/deck.js", "js/template.js", "js/sample.js", "js/i18n.js", "js/llm.js",
  "vendor/pptxgen.bundle.js", "vendor/anthropic-sdk.mjs",
  "vendor/fonts/Pretendard-Regular.subset.woff2", "vendor/fonts/Pretendard-SemiBold.subset.woff2", "vendor/fonts/Pretendard-Bold.subset.woff2",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
];
self.addEventListener("install", (e) => e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // no-cache: 매번 서버에 바뀌었는지 묻는다 (안 바뀌면 304 로 가볍게). 페이지 이동 요청은 init 을 붙일 수 없어 URL 로 다시 만든다
  e.respondWith(fetch(e.request.mode === "navigate" ? e.request.url : e.request, { cache: "no-cache" }).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(VERSION).then((x) => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
