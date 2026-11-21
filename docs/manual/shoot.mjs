// 매뉴얼 스크린샷: 헤드리스 Edge/Chrome 을 DevTools 프로토콜로 움직여 합성 데이터 화면을 찍는다 (외부 패키지 없음)
//   python -m http.server 8732          (저장소 폴더에서, 다른 창)
//   node docs/manual/shoot.mjs [http://127.0.0.1:8732/]
// 결과: docs/manual/shots/<이름>.png (1440x900) + shots/rects.json (말풍선 좌표: 화면 픽셀 x0,y0,x1,y1)
// 새 프로필로 열기 때문에 IndexedDB 가 비어 있고, 첫 화면은 합성 예시 세트다.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "shots");
const URL0 = process.argv[2] || "http://127.0.0.1:8732/";
const PORT = 9333;
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
];
const exe = BROWSERS.find((p) => fs.existsSync(p));
if (!exe) throw new Error("Edge 나 Chrome 을 찾지 못했습니다");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "wr-shot-"));
const proc = spawn(exe, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run",
  "--hide-scrollbars", "--lang=ko-KR", "--window-size=1440,900", "about:blank"], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let page = null;
for (let i = 0; i < 50 && !page; i++) {
  await sleep(200);
  try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch { /* 아직 안 뜸 */ }
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((ok, fail) => {
  const id = ++seq;
  pending.set(id, (m) => (m.error ? fail(new Error(method + ": " + m.error.message)) : ok(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const js = async (body) => {
  const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const H = `const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const click = async (s) => { $(s).click(); await sleep(120); };`;
const run = (body) => js(H + body);

const rects = {};
// sel: { 이름: 선택자 } — 찍은 화면 기준 좌표를 기록한다
async function shot(name, sel = {}) {
  await sleep(250);
  await run(`$('#toast').className = 'toast'; window.scrollBy(0, 1); await sleep(50); window.scrollBy(0, -1);`); // 알림을 지우고, 고정 막대를 다시 그리게 한다
  await sleep(400);
  const r = await run(`const o = {}; for (const [k, s] of Object.entries(${JSON.stringify(sel)})) { const e = $(s); if (!e) continue;
    const b = e.getBoundingClientRect(); o[k] = [b.left, b.top, b.right, b.bottom].map(Math.round); } return o;`);
  const missing = Object.keys(sel).filter((k) => !r[k]);
  if (missing.length) console.warn(name, "선택자 없음:", missing.join(", "));
  rects[name] = r;
  const png = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(png.data, "base64"));
  console.log("shot", name);
}
const top = (s, dy = 70) => run(`const e = $(${JSON.stringify(s)}); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - ${dy});`);

fs.mkdirSync(OUT, { recursive: true });
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await send("Page.navigate", { url: URL0 });
await sleep(2500);

// 1. 첫 화면
await shot("Main", { guide: "#guide", tabs: ".source .src-tabs", sample: '.source [data-sample="ko"]', weeks: "#weeks", topics: ".topics", export: ".export" });
await run(`await click('[data-act="guide-close"]');`);

// 2. 내 git log: 깨진 파일 → 줄 번호와 이유
await run(`await click('[data-src="file"]'); $('#paste-text').value = await (await fetch('samples/broken.txt')).text(); let d = null; for (let i = 0; i < 20 && !d; i++) { if (i % 5 === 0) await click('[data-act="paste-load"]'); await sleep(150); d = $('#parse-result details'); } if (!d) throw new Error('불러오기 결과가 없습니다'); d.open = true;`);
await top(".source", 64);
await shot("Import", { drop: "#drop", cmd: ".cmd", paste: "#paste-text", result: "#parse-result" });

// 3. 예시 세트 → 편집기 (카세트 매핑: 설비 · 이슈 번호)
await run(`await click('[data-src="sample"]'); await click('.source [data-sample="ko"]'); await click('[data-topic="3"]'); $('details.commits').open = true;`);
await top(".work", 64);
await shot("Editor", { topics: ".topics", domain: ".domain-line", commits: "details.commits", memo: ".grid3 > div:nth-child(1)", decision: ".grid3 > div:nth-child(2)", shadow: ".shadow-col" });

// 4. 녹화 LLM 응답 재생 → Shadow 칸 (오토 포커스: 수율 · 향상 막힘)
await run(`await click('[data-act="replay"]'); await click('[data-topic="1"]');`);
await top("#editor .grid3", 70);
await shot("Shadow", { decision: ".grid3 > div:nth-child(2)", shadow: ".shadow-col", marks: ".shadow-col .sh-lines", blocked: ".shadow-col table.blocked", adopt: '.shadow-col [data-act="adopt"]' });

// 5. 미리보기 + 내보내기
await top("#preview", 120);
await shot("Preview", { preview: "#preview", stats: "#export-stats", buttons: ".export .row" });

// 6. 지난주 대비 · 설비/이슈 진척
await top("#h-cmp", 70);
await shot("Compare", { cmp: ".cmp-grid", cont: ".cmp-col:nth-child(1)", fin: ".cmp-col:nth-child(2)", add: ".cmp-col:nth-child(4)", domain: "#domain table" });

// 7. 현장 검증 절차 (재현 세트 저장 후)
await run(`$('#case-label').value = 'LLM 이 효과를 지어낸 주 (합성)'; await click('[data-act="case-save"]');`);
await top(".verify", 64);
await shot("Verify", { s1: ".vf-steps > li:nth-child(1)", s2: ".vf-steps > li:nth-child(2)", s3: ".vf-steps > li:nth-child(3)", s4: ".vf-steps > li:nth-child(4)" });

// 8. 설정: LLM
await run(`window.scrollTo(0, 0); await click('#open-settings'); await click('[data-stab="llm"]');`);
await shot("SettingsLLM", { provider: "#s-provider", key: "#s-key", model: "#s-model", ollama: "#s-ollamaUrl", mask: "#s-mask", preview: "#s-preview" });

// 9. 보낼 내용 미리보기 (가짜 테스트 키 — 보내기 전에 취소하므로 요청은 나가지 않는다)
await run(`$('#s-key').value = 'sk-ant-test-0000'; $('#s-mask').value = 'SpotCheck'; await click('#settings-save'); await click('[data-topic="3"]'); await click('[data-act="gen-one"]');`);
await shot("Send", { sub: "#send-sub", text: "#send-text", ok: '#send [value="ok"]' });
await run(`$('#send').close('cancel'); await sleep(100);`);

// 10. 설정: 영역 사전
await run(`await click('#open-settings'); await click('[data-stab="dict"]');`);
await shot("SettingsDict", { lang: "#s-reportLang", group: "#s-groupBy", equip: "#s-equipment", issue: "#s-issue", rules: "#s-rules" });

// 11. 바꾸기 전 비교 (설비 패턴에 이슈 번호까지 넣어 보기)
await run(`$('#s-equipment').value = '(?<!\\\\d)\\\\d{1,2}호기|\\\\bFI-\\\\d{3}\\\\b'; await click('#settings-save');`);
await shot("CompareDialog", { sum: "#cmp-sum", table: "#cmp-body table", diff: "#cmp-body td.diff", apply: '[data-act="cmp-apply"]' });
await run(`$('#cmp-dlg').close(); await sleep(100);`);

// 12. 설정: PPTX 양식
await run(`await click('#open-settings'); await click('[data-stab="style"]');`);
await shot("SettingsStyle", { accent: "#s-accent", toggles: '[data-spane="style"] .row', tpl: '[data-spane="style"] h3', tplRow: '[data-spane="style"] .row.tight' });
await run(`await click('[data-stab="data"]');`);
await shot("SettingsData", { backup: '[data-act="backup"]', reset: '[data-act="reset"]', errors: "#err-list" });
await run(`$('#settings').close(); await sleep(100);`);

// 13. 도움말
await run(`await click('#open-help');`);
await shot("Help", {});
await run(`$('#help').close(); await sleep(100);`);

// 14. 영어 화면 + 영어 검증 규칙
await run(`await click('#lang-btn'); await click('.source [data-sample="en"]'); await click('[data-act="sh-clear"]'); await click('[data-act="replay"]'); await click('[data-topic="0"]');`);
await top("#editor .grid3", 70);
await shot("English", { shadow: ".shadow-col", blocked: ".shadow-col table.blocked" });
await run(`await click('#lang-btn');`);

// 15. 다크 모드 · 모바일 폭
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
await run(`await click('.source [data-sample="ko"]'); await click('[data-act="replay"]'); await click('[data-topic="1"]');`);
await top("#editor .grid3", 70);
await shot("Dark", {});
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await run(`window.scrollTo(0, 0);`);
await shot("Mobile", {});

fs.writeFileSync(path.join(OUT, "rects.json"), JSON.stringify(rects, null, 1));
ws.close();
proc.kill();
await sleep(500);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* 브라우저가 아직 잡고 있으면 남겨 둔다 (임시 폴더) */ }
console.log("done", Object.keys(rects).length);
