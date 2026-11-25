// 화면 · 저장 · 내보내기. 로직은 core.js, 문자열은 i18n.js
import * as W from "./core.js";
import { SAMPLES, DEFAULT_CONFIG } from "./sample.js";
import { build as buildDeck, buildTemplateSample, DEFAULT_STYLE } from "./deck.js";
import { fillTemplate } from "./template.js";
import { MODELS, generate, previewRequest } from "./llm.js";
import { t, setLang, getLang, applyStatic } from "./i18n.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const SH_MIN = 10, SH_RATE = 0.8; // 전환 기준: Shadow 기록 10건 이상 · 통과율 80% 이상
const CMD = `git log --no-merges --date=short --name-only --since="5 weeks ago" --format="@@%h|%ad|%an|%s"`;

// ---------------------------------------------------------------- 저장 (IndexedDB)
const DB = (() => {
  let p = null;
  const open = () => (p ||= new Promise((ok, fail) => {
    const r = indexedDB.open("weekly-report", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((ok, fail) => { const s = db.transaction("kv", mode).objectStore("kv"); const r = fn(s); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); }); };
  return { get: (k) => tx("readonly", (s) => s.get(k)), set: (k, v) => tx("readwrite", (s) => s.put(v, k)), del: (k) => tx("readwrite", (s) => s.delete(k)) };
})();

const freshWs = (lang) => ({
  v: 1, lang, reportLang: lang, source: "", commits: [], parse: null, filter: { authors: [], from: "", to: "" },
  project: "", author: "", cfg: clone(DEFAULT_CONFIG[lang]), weeks: {}, week: null, shadow: [], decision: "rule", history: [], cases: [],
  style: { ...DEFAULT_STYLE }, llm: { provider: "anthropic", model: MODELS[0].id, ollamaUrl: "http://localhost:11434", ollamaModel: "bonsai-2.5:27b", maskWords: [], preview: true, timeout: 600 },
  onelineDate: "", guideDone: false, groupBy: "section", savedAt: null,
});

const S = { ws: null, topics: [], sel: 0, apiKey: "", busy: false, abort: null, tpl: null, errors: [], skipPreview: false, pending: null, lastCompare: null };
const cur = () => S.topics[S.sel];
const RL = () => S.ws.reportLang;
const check = (tp) => W.validate({ title: tp.title, lines: tp.lines }, W.sourceOf(tp, RL()), RL());
const weekInfo = () => weeks().find((w) => w.id === S.ws.week);
const isSample = () => S.ws.source.startsWith("sample");
const filtered = () => W.filterCommits(S.ws.commits, S.ws.filter);
const weeks = () => W.weeksOf(filtered());

let saveTimer = null;
function save() {
  if (S.ws.week) S.ws.weeks[S.ws.week] = S.topics;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    S.ws.savedAt = new Date().toISOString();
    try { await DB.set("ws", S.ws); } catch (e) { logError(e); }
  }, 300);
}

// ---------------------------------------------------------------- 오류 기록 (로컬만)
function logError(e) {
  const rec = { at: new Date().toISOString(), msg: String(e?.message || e).slice(0, 300), stack: String(e?.stack || "").split("\n").slice(0, 4).join("\n") };
  S.errors.unshift(rec);
  S.errors = S.errors.slice(0, 100);
  DB.set("errors", S.errors).catch(() => {});
  toast(t("toast.err", { m: rec.msg }), true);
}
window.addEventListener("error", (e) => logError(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => logError(e.reason));

let toastTimer = null;
function toast(msg, bad = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast show" + (bad ? " bad" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "toast"; }, 4200);
}

// ---------------------------------------------------------------- 데이터 흐름
// 내 데이터를 다시 불러오면 커밋을 해시로 합치고 편집한 주차는 그대로 둔다 (매주 새 로그를 넣어도 지난주 메모가 남음)
function loadCommits(res, source, cfg) {
  const merge = source === "user" && S.ws.source === "user";
  let added = res.commits.length;
  if (merge) {
    const have = new Set(S.ws.commits.map((c) => c.hash));
    const fresh = res.commits.filter((c) => !have.has(c.hash));
    added = fresh.length;
    S.ws.commits = S.ws.commits.concat(fresh);
  } else {
    S.ws.commits = res.commits;
    S.ws.weeks = {};
    S.ws.filter = { authors: [], from: "", to: "" };
  }
  const authors = [...new Set(S.ws.commits.map((c) => c.author).filter(Boolean))].sort();
  S.ws.parse = { format: res.format, errors: res.errors.slice(0, 50), errorCount: res.errors.length, authors, read: res.commits.length, added, merged: merge };
  S.ws.source = source;
  S.ws.week = null; S.topics = []; // 이전 데이터의 주제가 같은 주차 ID 로 섞이지 않게
  if (cfg) {
    S.ws.cfg = clone({ rules: cfg.rules, fallback: cfg.fallback, order: cfg.order, equipment: cfg.equipment, issue: cfg.issue });
    S.ws.project = cfg.project; S.ws.author = cfg.author;
  }
  const ws = weeks();
  selectWeek(ws.length ? ws[ws.length - 1].id : null);
  renderAll();
}

function openSample(lang) {
  const sm = SAMPLES[lang];
  S.ws.reportLang = lang;
  loadCommits(W.parseGitLog(sm.log), "sample-" + lang, sm.config);
}

// 주차 열기: 저장한 주제가 있으면 그대로 + 새로 들어온 커밋만 덧붙임, 없으면 새로 묶기
function selectWeek(id) {
  if (S.ws.week && S.topics.length) S.ws.weeks[S.ws.week] = S.topics;
  S.ws.week = id;
  S.topics = id ? buildWeek(id) : [];
  S.sel = 0;
  if (id) save();
}

function buildWeek(id) {
  const wc = filtered().filter((c) => W.isoWeek(c.date).id === id);
  const saved = S.ws.weeks[id];
  if (saved) {
    const have = new Set(saved.flatMap((x) => x.commits.map((c) => c.hash)));
    const extra = wc.filter((c) => !have.has(c.hash));
    return saved.concat(extra.length ? W.groupTopics(extra, S.ws.cfg).map((x) => prep(x, id)) : []);
  }
  const ts = W.groupTopics(wc, S.ws.cfg).map((x) => prep(x, id));
  const prev = prevWeekTopics(id);
  if (prev) W.carryMemos(prev, ts);
  ts.forEach((x) => { if (x.carried && x.how === "rule") applyRule(x); });
  return ts;
}

function prep(tp, wid) {
  const sm = isSample() && SAMPLES[S.ws.source.slice(7)];
  const m = sm && sm.memos[wid + "|" + tp.key];
  if (m) {
    Object.assign(tp, { why: m.why, status: m.status, title: m.title, lines: [...m.lines], steps: [...m.steps], how: "example" });
    tp.example = { title: m.title, lines: m.lines, steps: m.steps };
    tp.recorded = m.llm;
  } else {
    applyRule(tp);
    tp.steps = W.defaultSteps(tp.what);
  }
  tp.log = [];
  return tp;
}

function applyRule(tp, how = "rule") {
  const r = W.ruleSummary(tp, RL());
  tp.title = r.title; tp.lines = r.lines; tp.how = how;
}

function prevWeekTopics(id) {
  const ws = weeks(), i = ws.findIndex((w) => w.id === id);
  if (i <= 0) return null;
  const pid = ws[i - 1].id;
  if (S.ws.weeks[pid]) return S.ws.weeks[pid];
  const pc = filtered().filter((c) => W.isoWeek(c.date).id === pid);
  return W.groupTopics(pc, S.ws.cfg).map((x) => prep(x, pid)); // 아직 열지 않은 주차는 비교용으로만 만든다
}

// ---------------------------------------------------------------- 렌더링
function renderAll() {
  applyStatic();
  $("#lang-btn").textContent = t("nav.lang");
  $("#guide").hidden = S.ws.guideDone;
  $("#cmd").textContent = CMD;
  $("#ws-project").value = S.ws.project || "";
  $("#ws-author").value = S.ws.author || "";
  $("#oneline-date").value = S.ws.onelineDate || "";
  renderSource();
  renderTopics();
  renderEditor();
  renderCompare();
  renderVerify();
  renderExport();
}

function renderSource() {
  const p = S.ws.parse;
  const box = $("#parse-result");
  if (!p) { box.innerHTML = ""; }
  else {
    const fmt = t("fmt." + p.format);
    box.innerHTML = `<p class="${S.ws.commits.length ? "" : "warn"}">${esc(S.ws.commits.length ? t("src.result", { format: fmt, n: S.ws.commits.length, a: p.authors.length }) : t("src.noCommits"))}${p.merged ? ` <small>${esc(t("src.merged", { r: p.read, n: p.added }))}</small>` : ""}</p>` +
      (p.errorCount ? `<details class="errs" ${S.ws.commits.length ? "" : "open"}><summary>${esc(t("src.errors", { n: p.errorCount }))}</summary><ul>${p.errors.map((e) =>
        `<li>${e.line ? `<b>${esc(t("src.err.line", { line: e.line }))}</b> ` : ""}${esc(t("err." + e.code))}${e.text ? ` <code>${esc(e.text)}</code>` : ""}</li>`).join("")}</ul></details>` : "");
  }
  // 필터
  const authors = p ? p.authors : [];
  $("#filter").hidden = !S.ws.commits.length;
  $("#f-authors").innerHTML = authors.length > 1 ? `<legend>${esc(t("filter.authors"))}</legend>` + authors.map((a) =>
    `<label class="check"><input type="checkbox" data-author="${esc(a)}" ${!S.ws.filter.authors.length || S.ws.filter.authors.includes(a) ? "checked" : ""}> ${esc(a)}</label>`).join("") : "";
  $("#f-from").value = S.ws.filter.from || "";
  $("#f-to").value = S.ws.filter.to || "";
  // 주차
  $("#weeks").innerHTML = weeks().map((w) => {
    const [a, b] = W.weekRange(w.year, w.week);
    return `<button type="button" class="chip-btn ${w.id === S.ws.week ? "on" : ""}" data-week="${esc(w.id)}" aria-pressed="${w.id === S.ws.week}">
      ${esc(t("weeks.chip", { w: w.week }))} <small>${a.slice(5).replace("-", "/")}~${b.slice(5).replace("-", "/")} · ${esc(t("weeks.commits", { n: w.count }))}${S.ws.weeks[w.id] ? " · " + esc(t("weeks.saved")) : ""}</small></button>`;
  }).join("");
  const w = weekInfo();
  $("#stats").textContent = w ? t("stats.week", { y: w.year, w: w.week, c: w.count, t: S.topics.length }) : "";
  $$("[data-src]").forEach((b) => { const on = b.dataset.src === S.tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
  $$("[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== S.tab; });
}

function topicState(tp) {
  if (tp.skip) return { cls: "skip", text: t("state.skip") };
  const bad = check(tp);
  return bad.length ? { cls: "bad", text: t("state.bad", { n: bad.length }) } : { cls: "ok", text: t("state.ok") };
}

function renderTopics() {
  $("#topic-list").innerHTML = S.topics.map((tp, i) => {
    const st = topicState(tp);
    return `<li class="${i === S.sel ? "on" : ""}">
      <input type="checkbox" class="merge-pick" data-merge="${esc(tp.id)}" aria-label="${esc(tp.key)}">
      <button type="button" class="topic ${tp.skip ? "is-skip" : ""}" data-topic="${i}" aria-current="${i === S.sel}">
        <span class="t-tag">${esc(tp.tag)}${tp.equipment?.length ? ` · ${esc(tp.equipment.join(", "))}` : ""}${tp.issues?.length ? ` · ${esc(tp.issues.join(", "))}` : ""}</span>
        <span class="t-key">${esc(tp.key)}</span>
        <span class="t-meta">${esc(t("topics.commits", { n: tp.commits.length }))} · ${esc(t("how." + tp.how))}${tp.carried ? " · " + esc(t("topics.carried")) : ""}${tp.llm ? " · LLM " + (tp.llm.issues.length ? "✕" : "✓") : ""}</span>
        <span class="state ${st.cls}">${esc(st.text)}</span>
      </button></li>`;
  }).join("") || `<li class="hint">${esc(t("topics.empty"))}</li>`;
}

function highlight(text, issues, lineNo) {
  let h = esc(text);
  for (const b of issues.filter((b) => W.isFactIssue(b) && (lineNo === undefined || b.line === lineNo))) {
    const tok = esc(b.token);
    const re = new RegExp(tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    h = h.replace(re, (m) => `<mark title="${esc(W.issueMsg(b, RL()))}">${m}</mark>`);
  }
  return h;
}

function issuesHtml(bad) {
  if (!bad.length) return `<p class="state ok">${esc(t("ed.pass"))}</p><small>${esc(t("ed.passHint"))}</small>`;
  const fact = bad.filter(W.isFactIssue), fmt = bad.filter((b) => !W.isFactIssue(b));
  return `<p class="state bad">${esc(t("ed.fail", { n: bad.length }))}</p>` +
    (fmt.length ? `<ul class="fmt">${fmt.map((b) => `<li>${esc(W.issueMsg(b, RL()))}</li>`).join("")}</ul>` : "") +
    (fact.length ? `<table class="blocked"><caption>${esc(t("ed.blocked"))}</caption><tbody>${fact.map((b) =>
      `<tr><th scope="row"><mark>${esc(b.token)}</mark></th><td>${esc(W.issueMsg(b, RL()))}<small>${esc(W.issueWhy(b, RL()))}</small></td></tr>`).join("")}</tbody></table>` : "");
}

function renderEditor() {
  const tp = cur();
  const ed = $("#editor");
  if (!tp) { ed.innerHTML = `<p class="hint">${esc(t("ed.pick"))}</p>`; return; }
  const others = S.topics.filter((x) => x !== tp);
  const L = tp.llm;
  ed.innerHTML = `
    <div class="panel-head">
      <h3 class="ed-title"><span class="t-tag">${esc(tp.tag)}</span>
        <label class="sr-only" for="f-key">${esc(t("ed.key"))}</label><input id="f-key" class="key-input" data-f="key" value="${esc(tp.key)}"></h3>
      <label class="check"><input type="checkbox" data-f="skip" ${tp.skip ? "checked" : ""}> ${esc(t("ed.skip"))}</label>
    </div>
    <p class="domain-line"><b>${esc(t("ed.domain"))}</b> ${tp.equipment?.length || tp.issues?.length
      ? [...(tp.equipment || []).map((x) => `<span class="pill eq">${esc(x)}</span>`), ...(tp.issues || []).map((x) => `<span class="pill is">${esc(x)}</span>`)].join(" ")
      : `<small>${esc(t("ed.domainNone"))}</small>`}</p>
    <details class="commits">
      <summary>${esc(t("ed.commits", { n: tp.commits.length }))}</summary>
      <ul>${tp.commits.map((c) => `<li>
        <label class="check"><input type="checkbox" data-split="${esc(c.hash)}"><code>${esc(c.hash)}</code></label> ${esc(c.date || "")} ${c.author ? `<i>${esc(c.author)}</i>` : ""} ${esc(c.subject)}
        ${c.files.length ? `<small>${c.files.map(esc).join(" · ")}</small>` : ""}
        ${others.length ? `<select data-move="${esc(c.hash)}" aria-label="${esc(t("ed.moveTo"))}"><option value="">${esc(t("ed.moveTo"))}</option>${others.map((o) => `<option value="${esc(o.id)}">${esc(o.key)}</option>`).join("")}</select>` : ""}
      </li>`).join("")}</ul>
      ${tp.commits.length > 1 ? `<button class="btn ghost sm" type="button" data-act="split">${esc(t("ed.split"))}</button>` : ""}
    </details>

    <div class="grid3">
      <div>
        <h4>${esc(t("ed.memo"))} <small>${esc(t("ed.memoHint"))}</small></h4>
        <label class="field">${esc(t("ed.why"))} <input data-f="why" value="${esc(tp.why)}" placeholder="${esc(t("ed.whyPh"))}"></label>
        <label class="field">${esc(t("ed.what"))} <textarea data-f="what" rows="3">${esc(tp.what)}</textarea></label>
        <label class="field">${esc(t("ed.status"))} <input data-f="status" value="${esc(tp.status)}" placeholder="${esc(W.defaultStatus(RL()))}">
          <small>${esc(t("ed.statusHint", { d: W.defaultStatus(RL()) }))}</small></label>
        <label class="field">${esc(t("ed.steps"))} <textarea data-f="steps" rows="3" placeholder="${esc(t("ed.stepsPh"))}">${esc((tp.steps || []).join("\n"))}</textarea></label>
      </div>
      <div>
        <h4>${esc(t("ed.decision"))} <small id="how">${esc(t("how." + tp.how))}</small></h4>
        <div class="gen-row">
          <button class="btn sm" type="button" data-act="gen-one">${esc(t("ed.genOne"))}</button>
          <button class="btn ghost sm" type="button" data-act="rule-one">${esc(t("ed.rule"))}</button>
          ${tp.example ? `<button class="btn ghost sm" type="button" data-act="example-one">${esc(t("ed.example"))}</button>` : ""}
        </div>
        <label class="field">${esc(t("ed.title"))} <span class="count" id="c-title"></span><input data-f="title" value="${esc(tp.title)}"></label>
        ${tp.lines.map((l, i) => `<label class="field">${esc(t("ed.line", { i: i + 1 }))} <span class="count" id="c-l${i}"></span><input data-f="line" data-i="${i}" value="${esc(l)}"></label>`).join("")}
        <div id="checks" class="checks" aria-live="polite"></div>
      </div>
      <div class="shadow-col">
        <h4>${esc(t("ed.shadow"))} <small>${esc(t("ed.shadowHint"))}</small></h4>
        ${L ? `<p class="meta">${esc(L.recorded ? t("ed.recorded") : t("ed.llmFrom", { model: L.model, at: new Date(L.at).toLocaleString() }))}</p>
          <p class="sh-title">${highlight(L.title, L.issues, 0)}</p>
          <ol class="sh-lines">${L.lines.map((l, i) => `<li>${highlight(l, L.issues, i + 1)}</li>`).join("")}</ol>
          <div class="checks">${issuesHtml(L.issues)}</div>
          <button class="btn sm" type="button" data-act="adopt" ${L.issues.length ? `disabled title="${esc(t("ed.adoptOff"))}"` : ""}>${esc(t("ed.adopt"))}</button>
          ${L.attempts?.length > 1 ? `<pre class="log">${esc(L.attempts.map((a) => `#${a.i} ${a.error ? a.error : a.issues.length ? a.issues.map((b) => W.issueMsg(b, RL())).join("; ") : "ok"}`).join("\n"))}</pre>` : ""}`
        : `<p class="hint">${esc(t("ed.noLlm"))}</p>`}
      </div>
    </div>

    <h4>${esc(t("ed.preview"))}</h4>
    <div id="preview" class="slide" role="img" aria-label="${esc(t("ed.preview"))}"></div>`;
  refreshLive();
}

function refreshLive() {
  const tp = cur();
  if (tp && $("#checks")) {
    const lim = W.LIMITS[RL()] || W.LIMITS.ko;
    $("#c-title").textContent = `${tp.title.length}/${lim.title}`;
    $("#c-title").classList.toggle("over", tp.title.length > lim.title);
    tp.lines.forEach((l, i) => { const c = $("#c-l" + i); c.textContent = `${l.length}/${lim.line}`; c.classList.toggle("over", l.length > lim.line); });
    $("#checks").innerHTML = issuesHtml(check(tp));
    $("#how").textContent = t("how." + tp.how);
    renderSlidePreview(tp, $("#preview"));
  }
  renderTopics();
  renderExport();
}

const px = (v, axis) => (v / (axis === "x" ? W.SLIDE.w : W.SLIDE.h) * 100).toFixed(3) + "%";
const pt = (n) => (n / 72 / W.SLIDE.w * 100).toFixed(3) + "cqw";
const box = (b) => `left:${px(b.x, "x")};top:${px(b.y, "y")};width:${px(b.w, "x")};${b.h ? `height:${px(b.h, "y")};` : ""}`;

function renderSlidePreview(tp, el) {
  const st = S.ws.style;
  const Lt = W.contentLayout(st.cards ? tp : { ...tp, steps: [] });
  const bs = W.badges(W.statusOf(tp, RL()));
  const w = weekInfo();
  const meta = [...(tp.equipment || []), ...(tp.issues || [])].join("  ·  ");
  el.style.setProperty("--accent", "#" + (/^#?[0-9a-f]{6}$/i.test(st.accent) ? st.accent.replace("#", "") : "C00000"));
  el.innerHTML = `
    <div class="s-title" style="${box(Lt.title)}font-size:${pt(22)}">${esc(tp.tag)} ${esc(tp.title)}</div>
    <div class="s-rule" style="${box(Lt.rule)}"></div>
    <ul class="s-body" style="${box(Lt.body)}font-size:${pt(14)}">${tp.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
    ${bs.map((b, i) => `<span class="s-badge ${b.filled ? "fill" : ""}" style="${box({ x: W.SLIDE.left + i * (Lt.badge.w + Lt.badge.gap), y: Lt.badgeY, w: Lt.badge.w, h: Lt.badge.h })}font-size:${pt(12)}">${esc(b.word)}</span>`).join("")}
    ${meta ? `<span class="s-meta" style="${box({ x: 8.0, y: Lt.badgeY, w: W.SLIDE.left + W.SLIDE.width - 8.0, h: Lt.badge.h })}font-size:${pt(12)}">${esc(meta)}</span>` : ""}
    ${Lt.cards.map((c, i) => `
      <div class="s-card" style="${box(c)}font-size:${pt(c.w < 2.2 ? 11 : 13)}">${esc(c.text)}</div>
      <span class="s-num" style="${box({ x: c.x + c.w / 2 - 0.22, y: c.y - 0.22, w: 0.44, h: 0.44 })}font-size:${pt(12)}">${i + 1}</span>
      ${c.last ? "" : `<span class="s-arrow" style="${box({ x: c.x + c.w + 0.08, y: c.y + c.h / 2 - 0.17, w: c.gap - 0.16, h: 0.34 })}"></span>`}`).join("")}
    <div class="s-foot" style="${box(Lt.foot)}font-size:${pt(9)}">${esc(st.footer || [S.ws.project, w ? (RL() === "en" ? `${w.year} W${w.week}` : `${w.year}년 ${w.week}주차`) : ""].filter(Boolean).join(" · "))}</div>
    ${tp.skip ? `<div class="s-skip">${esc(t("ed.skipped"))}</div>` : ""}`;
}

function compareData() {
  const prev = prevWeekTopics(S.ws.week);
  if (!prev) return null;
  const ws = weeks(), i = ws.findIndex((w) => w.id === S.ws.week);
  return { prevWeek: ws[i - 1], ...W.compareWeeks(prev, S.topics, RL()) };
}

function renderCompare() {
  const el = $("#compare");
  const c = S.ws.week && compareData();
  if (!c) { el.innerHTML = `<p class="hint">${esc(t("cmp.none"))}</p>`; }
  else {
    const col = (k, list, f) => `<div class="cmp-col"><h4>${esc(t("cmp." + k))} <span class="n">${list.length}</span></h4><ul>${list.map(f).join("") || "<li class='hint'>-</li>"}</ul></div>`;
    const carried = S.topics.filter((x) => x.carried).length;
    el.innerHTML = `<p class="hint">${esc(t("cmp.vs", { a: t("weeks.chip", { w: c.prevWeek.week }) }))}${carried ? " · " + esc(t("cmp.carried", { n: carried })) : ""}</p>
      <div class="cmp-grid">
        ${col("cont", c.continued, (x) => `<li><b>${esc(x.key)}</b>${x.doneNow ? ` <span class="pill done">${esc(t("cmp.doneNow"))}</span>` : ""}<small>${esc(x.before)} → ${esc(x.after)}</small></li>`)}
        ${col("fin", c.finished, (x) => `<li><b>${esc(x.key)}</b><small>${esc(x.before)}</small></li>`)}
        ${col("stal", c.stalled, (x) => `<li><b>${esc(x.key)}</b><small>${esc(x.before)}</small></li>`)}
        ${col("add", c.added, (x) => `<li><b>${esc(x.key)}</b><small>${esc(x.after)}</small></li>`)}
      </div>`;
  }
  const rows = W.domainRows(S.topics, RL());
  $("#domain").innerHTML = rows.length ? `<table class="tbl"><caption>${esc(t("dom.title"))}</caption><thead><tr><th scope="col">${esc(t("dom.id"))}</th><th scope="col">${esc(t("dom.topic"))}</th><th scope="col">${esc(t("dom.eq"))}</th><th scope="col">${esc(t("dom.st"))}</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td><span class="pill ${r.kind === "issue" ? "is" : "eq"}">${esc(r.id)}</span></td><td>${esc(r.key)}</td><td>${esc(r.equipment || "-")}</td><td>${esc(r.status)}</td></tr>`).join("")}</tbody></table>`
    : `<p class="hint">${esc(t("dom.none"))}</p>`;
}

function shadowStats() {
  const n = S.ws.shadow.length, p = S.ws.shadow.filter((x) => x.passed).length;
  return { n, p, b: n - p, rate: n ? p / n : 0 };
}

function renderVerify() {
  const sh = shadowStats();
  $("#cases").innerHTML = S.ws.cases.length ? S.ws.cases.map((c) => {
    const l = c.topics.filter((x) => x.llm).length, b = c.topics.filter((x) => x.llm && x.llm.issues.some(W.isFactIssue)).length;
    return `<li><b>${esc(c.label)}</b> <small>${esc(t("vf.caseRow", { w: c.week, t: c.topics.length, l, b }))}</small>
      <button class="btn ghost xs" type="button" data-case-view="${esc(c.id)}">${esc(t("vf.view"))}</button>
      <button class="btn ghost xs" type="button" data-case-del="${esc(c.id)}">${esc(t("vf.del"))}</button></li>`;
  }).join("") : `<li class="hint">${esc(t("vf.casesNone"))}</li>`;
  $("#last-cmp").textContent = S.lastCompare ? t("vf.lastCmp", S.lastCompare) : "";
  $("#sh-stats").textContent = sh.n ? t("vf.shStats", { n: sh.n, p: sh.p, b: sh.b, r: Math.round(sh.rate * 100) + "%" }) : t("vf.shNone");
  $("#sh-list").innerHTML = S.ws.shadow.filter((x) => !x.passed).slice(-30).reverse().map((x) =>
    `<li><code>${esc(x.week)}</code> <b>${esc(x.key)}</b> ${x.tokens.map((k) => `<mark>${esc(k)}</mark>`).join(" ")} <small>${esc(x.codes.join(", "))} · ${esc(x.model)}</small></li>`).join("");
  $("#vf-s4d").textContent = t("vf.s4d", { min: SH_MIN, rate: SH_RATE * 100 });
  $("#mode").textContent = t("vf.mode." + S.ws.decision);
  const ok = sh.n >= SH_MIN && sh.rate >= SH_RATE;
  const why = [sh.n < SH_MIN ? t("vf.whyMin", { n: sh.n, min: SH_MIN }) : "", sh.rate < SH_RATE && sh.n ? t("vf.whyRate", { r: Math.round(sh.rate * 100), rate: SH_RATE * 100 }) : ""].filter(Boolean).join(" · ");
  $("#switch").disabled = S.ws.decision === "llm" || !ok;
  $("#switch-why").textContent = S.ws.decision === "rule" && !ok ? t("vf.why", { why }) : "";
  $("#rollback").disabled = !S.ws.history.some((h) => h.snapshot);
  $("#hist").innerHTML = S.ws.history.length ? S.ws.history.slice().reverse().map((h) => `<li><small>${esc(new Date(h.at).toLocaleString())}</small> ${esc(h.text)}</li>`).join("") : `<li class="hint">${esc(t("vf.histNone"))}</li>`;
  $("#meter").value = Math.min(sh.n, SH_MIN);
  $("#meter").max = SH_MIN;
  $("#rate").value = sh.rate;
}

function renderExport() {
  const live = S.topics.filter((x) => !x.skip);
  const bad = live.filter((x) => check(x).length);
  const st = S.ws.style;
  const secs = W.sectionGroups(live, S.ws.cfg.order, S.ws.groupBy).length;
  const extra = (st.compare && S.ws.week && compareData() ? 1 : 0) + (st.domain && W.domainRows(live, RL()).length ? 1 : 0);
  $("#export-stats").innerHTML = live.length
    ? esc(t("ex.stats", { s: 2 + extra + (st.sections ? secs : 0) + live.length, t: live.length, p: live.length - bad.length })) + (bad.length ? ` · <b class="warn">${esc(t("ex.fail", { n: bad.length }))}</b>` : "")
    : esc(t("ex.none"));
  for (const id of ["ex-pptx", "ex-tpl", "ex-md", "ex-copy"]) $("#" + id).disabled = !live.length || S.busy;
  $("#ex-tpl").hidden = !S.tpl;
  $("#gen-all").disabled = !live.length || S.busy;
}

function syncRule(tp) {
  applyRule(tp);
  const ti = $('[data-f="title"]');
  if (ti) { ti.value = tp.title; $$('[data-f="line"]').forEach((el, i) => { el.value = tp.lines[i]; }); }
}

// ---------------------------------------------------------------- 편집 이벤트
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.ws) { S.ws[el.dataset.ws] = el.value; save(); if (el.dataset.ws === "project") refreshLive(); return; }
  const f = el.dataset?.f, tp = cur();
  if (!f || !tp) return;
  const v = el.value;
  if (f === "title") { tp.title = v; tp.how = "edited"; }
  else if (f === "line") { tp.lines[+el.dataset.i] = v; tp.how = "edited"; }
  else if (f === "steps") tp.steps = v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6);
  else if (f === "skip") tp.skip = el.checked;
  else tp[f] = v; // key / why / what / status
  if (["key", "why", "what", "status"].includes(f) && ["rule", "fallback"].includes(tp.how)) syncRule(tp); // 손대지 않은 규칙 요약은 메모를 따라간다
  save();
  refreshLive();
  if (f === "key" || f === "status" || f === "skip") renderCompare();
});

document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.move && el.value) {
    const tp = cur();
    if (W.moveCommit(S.topics, tp.id, el.dataset.move, el.value)) {
      S.topics.forEach((x) => W.regroupTopic(x, S.ws.cfg));
      S.sel = Math.min(S.sel, S.topics.length - 1);
      save(); renderAll();
    }
  } else if (el.dataset.author !== undefined) {
    const all = $$("[data-author]");
    const on = all.filter((x) => x.checked).map((x) => x.dataset.author);
    S.ws.filter.authors = on.length === all.length ? [] : on;
    refilter();
  } else if (el.id === "f-from" || el.id === "f-to") {
    S.ws.filter[el.id === "f-from" ? "from" : "to"] = el.value;
    refilter();
  } else if (el.id === "file-input" && el.files[0]) {
    readFile(el.files[0]);
    el.value = "";
  } else if (el.id === "tpl-input" && el.files[0]) {
    uploadTemplate(el.files[0]);
    el.value = "";
  } else if (el.id === "restore-input" && el.files[0]) {
    restore(el.files[0]);
    el.value = "";
  }
});

function refilter() {
  const ws = weeks();
  if (!ws.some((w) => w.id === S.ws.week)) { S.topics = []; S.ws.week = null; }
  selectWeek(S.ws.week || (ws.length ? ws[ws.length - 1].id : null));
  save(); renderAll();
}

// 주제 목록: 위아래 화살표로 이동
$("#topic-list").addEventListener("keydown", (e) => {
  if (!["ArrowDown", "ArrowUp"].includes(e.key) || !e.target.dataset.topic) return;
  e.preventDefault();
  S.sel = Math.max(0, Math.min(S.topics.length - 1, S.sel + (e.key === "ArrowDown" ? 1 : -1)));
  renderTopics(); renderEditor();
  $(`[data-topic="${S.sel}"]`)?.focus();
});

document.addEventListener("click", async (e) => {
  const b = e.target.closest("button, [data-act]");
  if (!b) return;
  const d = b.dataset;
  if (d.week) { selectWeek(d.week); renderAll(); return; }
  if (d.topic) { S.sel = +d.topic; renderTopics(); renderEditor(); return; }
  if (d.src) { S.tab = d.src; renderSource(); return; }
  if (d.sample) { openSample(d.sample); return; }
  if (d.stab) { $$("[data-stab]").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); }); $$("[data-spane]").forEach((p) => { p.hidden = p.dataset.spane !== d.stab; }); return; }
  if (d.caseView) return viewCase(d.caseView);
  if (d.caseDel) { S.ws.cases = S.ws.cases.filter((c) => c.id !== d.caseDel); save(); renderVerify(); return; }
  const tp = cur();
  switch (d.act || b.id) {
    case "rule-one": applyRule(tp); save(); return renderEditor();
    case "example-one": Object.assign(tp, { title: tp.example.title, lines: [...tp.example.lines], steps: [...tp.example.steps], how: "example" }); save(); return renderEditor();
    case "adopt": if (tp.llm && !tp.llm.issues.length) { Object.assign(tp, { title: tp.llm.title, lines: [...tp.llm.lines], how: "llm" }); save(); renderEditor(); } return;
    case "gen-one": return generateTopics([tp]);
    case "gen-all": return generateTopics(S.topics.filter((x) => !x.skip));
    case "llm-cancel": S.abort?.abort(); return;
    case "split": {
      const hs = $$("[data-split]:checked").map((x) => x.dataset.split);
      const n = W.splitTopic(S.topics, tp.id, hs, S.ws.cfg);
      if (n) { applyRule(n); n.steps = W.defaultSteps(n.what); n.log = []; S.sel = S.topics.indexOf(n); save(); renderAll(); }
      return;
    }
    case "merge": {
      const ids = $$(".merge-pick:checked").map((x) => x.dataset.merge);
      const h = W.mergeTopics(S.topics, ids, S.ws.cfg);
      if (h) { if (h.how === "rule") applyRule(h); S.sel = S.topics.indexOf(h); save(); renderAll(); }
      return;
    }
    case "regroup":
      if (!confirm(t("topics.regroupConfirm"))) return;
      delete S.ws.weeks[S.ws.week]; S.topics = []; selectWeek(S.ws.week); renderAll(); return;
    case "paste-load": return loadText($("#paste-text").value);
    case "copy-cmd": await navigator.clipboard.writeText(CMD); toast(t("ex.copied")); return;
    case "gh-load": return loadGithub();
    case "guide-close": S.ws.guideDone = true; save(); $("#guide").hidden = true; return;
    case "lang-btn": setLang(getLang() === "ko" ? "en" : "ko"); S.ws.lang = getLang(); save(); renderAll(); return;
    case "theme-btn": {
      const now = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = now === "dark" ? "light" : "dark";
      try { localStorage.setItem("wr-theme", document.documentElement.dataset.theme); } catch { /* 저장 못 해도 동작 */ }
      return;
    }
    case "open-help": return $("#help").showModal();
    case "open-settings": case "open-dict": return openSettings(d.act === "open-dict" || b.id === "open-dict" ? "dict" : "llm");
    case "settings-save": return saveSettings();
    case "dict-reset": { const D = DEFAULT_CONFIG[$("#s-reportLang").value]; $("#s-rules").value = JSON.stringify({ rules: D.rules, fallback: D.fallback, order: D.order }, null, 2); $("#s-equipment").value = D.equipment; $("#s-issue").value = D.issue; return; }
    case "cmp-apply": return applyPending();
    case "replay": return replayRecorded();
    case "case-save": return saveCase();
    case "sh-clear": S.ws.shadow = []; save(); return renderVerify();
    case "switch": return switchDecision("llm");
    case "rollback": return rollback();
    case "ex-pptx": return exportPptx(false);
    case "ex-tpl": return exportPptx(true);
    case "ex-md": return exportMd(false);
    case "ex-copy": return exportMd(true);
    case "tpl-del": S.tpl = null; await DB.del("template"); renderTplInfo(); renderExport(); return;
    case "tpl-sample": return downloadTemplateSample();
    case "backup": return download(new Blob([JSON.stringify({ app: "weekly-report", ...S.ws }, null, 1)], { type: "application/json" }), `weekly-report-backup-${new Date().toISOString().slice(0, 10)}.json`);
    case "reset":
      if (!confirm(t("set.resetConfirm"))) return;
      await DB.del("ws"); await DB.del("template"); await DB.del("errors");
      S.ws = freshWs(getLang()); S.topics = []; S.tpl = null; S.errors = []; $("#settings").close(); renderAll(); return;
    case "err-dl": return download(new Blob([JSON.stringify(S.errors, null, 1)], { type: "application/json" }), "weekly-report-errors.json");
    case "err-clear": S.errors = []; await DB.set("errors", []); renderErrors(); return;
  }
});

// ---------------------------------------------------------------- 불러오기
function loadText(text, defaultDate) {
  const res = W.parseGitLog(text, { defaultDate: defaultDate || S.ws.onelineDate || null });
  S.ws.reportLang = S.ws.reportLang || getLang();
  if (isSample() || !S.ws.source) Object.assign(S.ws, { cfg: clone(DEFAULT_CONFIG[S.ws.reportLang]), project: "", author: "" }); // 예시 → 내 데이터
  loadCommits(res, "user", null);
  if (!res.commits.length) toast(t("src.noCommits"), true);
}

async function readFile(f) {
  const buf = await f.arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buf);
  if (text.includes("�")) { try { text = new TextDecoder("euc-kr").decode(buf); } catch { /* 그대로 */ } } // 사내 PC 의 EUC-KR 저장본
  $("#paste-text").value = text.length > 200000 ? text.slice(0, 2000) + "\n…" : text;
  loadText(text);
}

const drop = $("#drop");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) readFile(f); });
// 탭 어디에 놓아도 받는다
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => { if (!drop.contains(e.target)) { e.preventDefault(); const f = e.dataTransfer?.files[0]; if (f && /\.(txt|log|out)$/i.test(f.name)) { S.tab = "file"; readFile(f); } } });

async function loadGithub() {
  const repo = $("#gh-repo").value.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
  const msg = $("#gh-msg");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { msg.textContent = t("gh.e.repo"); return; }
  const q = new URLSearchParams({ per_page: "100" });
  if ($("#gh-since").value) q.set("since", $("#gh-since").value + "T00:00:00Z");
  if ($("#gh-until").value) q.set("until", $("#gh-until").value + "T23:59:59Z");
  if ($("#gh-author").value.trim()) q.set("author", $("#gh-author").value.trim());
  const api = (p) => fetch("https://api.github.com/repos/" + repo + p, { headers: { accept: "application/vnd.github+json" } });
  const commits = [];
  let left = "?";
  try {
    for (let page = 1; page <= 3; page++) {
      msg.textContent = t("gh.loading", { n: commits.length });
      const r = await api("/commits?" + q + "&page=" + page);
      left = r.headers.get("x-ratelimit-remaining") ?? left;
      if (r.status === 404) throw new Error(t("gh.e.404"));
      if (r.status === 403 || r.status === 429) throw new Error(t("gh.e.403"));
      if (!r.ok) throw new Error("GitHub " + r.status);
      const list = await r.json();
      for (const c of list) {
        if ((c.parents || []).length > 1) continue;
        const date = W.parseDate(c.commit.author?.date || "");
        commits.push({ hash: c.sha.slice(0, 7), sha: c.sha, date, author: c.commit.author?.name || c.author?.login || "", subject: c.commit.message.split("\n")[0], files: [] });
      }
      if (list.length < 100) break;
    }
    if ($("#gh-files").checked) {
      for (const c of commits.slice(0, 30)) {
        msg.textContent = t("gh.loading", { n: c.hash });
        const r = await api("/commits/" + c.sha);
        left = r.headers.get("x-ratelimit-remaining") ?? left;
        if (!r.ok) break;
        c.files = ((await r.json()).files || []).map((f) => f.filename);
      }
    }
  } catch (e) { msg.textContent = e.message; return; }
  commits.forEach((c) => delete c.sha);
  msg.textContent = t("gh.left", { n: left });
  if (isSample() || !S.ws.source) Object.assign(S.ws, { cfg: clone(DEFAULT_CONFIG[S.ws.reportLang]), project: "", author: "" }); // 예시 → 내 데이터
  loadCommits({ format: "github", commits: commits.filter((c) => c.date), errors: [], authors: [...new Set(commits.map((c) => c.author).filter(Boolean))].sort() }, "user", null);
  if (!S.ws.project) { S.ws.project = repo.split("/")[1]; $("#ws-project").value = S.ws.project; }
}

// ---------------------------------------------------------------- LLM (Shadow)
function llmCfg() { return { ...S.ws.llm, apiKey: S.apiKey }; }

function recordShadow(tp, res) {
  const fact = res.issues.filter(W.isFactIssue);
  S.ws.shadow.push({ at: new Date().toISOString(), week: S.ws.week, key: tp.key, model: res.model, passed: !res.issues.length,
    codes: [...new Set(res.issues.map((b) => b.code))], tokens: fact.map((b) => b.token).slice(0, 8) });
  if (S.ws.shadow.length > 500) S.ws.shadow = S.ws.shadow.slice(-500);
}

// 결정 방식에 따라 채택: rule = 사람이 채택 버튼으로만, llm = 통과하면 자동 채택 · 실패하면 규칙 요약
function decide(tp) {
  if (S.ws.decision !== "llm" || !tp.llm || tp.how === "edited") return;
  if (!["llm", "fallback"].includes(tp.how)) tp.prev = { title: tp.title, lines: [...tp.lines], how: tp.how }; // 되돌리기용
  if (!tp.llm.issues.length) Object.assign(tp, { title: tp.llm.title, lines: [...tp.llm.lines], how: "llm" });
  else applyRule(tp, "fallback");
}

async function generateTopics(list) {
  const cfg = llmCfg();
  if (cfg.provider === "anthropic" && !cfg.apiKey) { openSettings("llm"); $("#settings-err").textContent = t("llm.needKey"); return; }
  if (cfg.preview && !S.skipPreview) {
    const ok = await confirmSend(list.length, previewRequest(cfg, list[0], RL()));
    if (!ok) return;
  }
  S.busy = true; S.abort = new AbortController();
  renderExport();
  const bar = $("#llm-bar");
  bar.hidden = false;
  let p = 0, bl = 0, n = 0;
  try {
    for (const [i, tp] of list.entries()) {
      $("#llm-msg").textContent = t("llm.running", { i: i + 1, n: list.length });
      try {
        const res = await generate(cfg, tp, RL(), S.abort.signal, (m) => t("llm.retry", { m }));
        tp.llm = { ...res, at: Date.now() };
        recordShadow(tp, res);
        decide(tp);
        n++; res.issues.length ? bl++ : p++;
      } catch (e) {
        if (e.code === "abort") { toast(t("llm.canceled")); break; }
        toast(t("llm.e." + e.code, { m: e.message }), true);
        if (e.fatal) break;
      }
      save();
      if (tp === cur()) renderEditor(); else renderTopics();
    }
  } finally {
    S.busy = false; S.abort = null; bar.hidden = true;
    if (n) toast(t("llm.done", { n, p, b: bl }));
    renderExport(); renderVerify();
  }
}

function confirmSend(n, text) {
  const dlg = $("#send");
  $("#send-sub").textContent = t("send.sub", { n });
  $("#send-text").textContent = text;
  $("#send-dont").checked = false;
  dlg.showModal();
  return new Promise((ok) => dlg.addEventListener("close", () => {
    if (dlg.returnValue === "ok" && $("#send-dont").checked) S.skipPreview = true;
    ok(dlg.returnValue === "ok");
  }, { once: true }));
}

// 녹화한 합성 응답 재생: 키 없이 Shadow · 검증 · 전환 기준을 확인한다 (4주 전체)
function replayRecorded() {
  if (!isSample()) { toast(t("vf.replayNeed"), true); return; }
  const sm = SAMPLES[S.ws.source.slice(7)];
  S.ws.weeks[S.ws.week] = S.topics;
  let n = 0, b = 0;
  for (const w of weeks()) {
    if (!S.ws.weeks[w.id]) S.ws.weeks[w.id] = buildWeek(w.id);
    for (const tp of S.ws.weeks[w.id]) {
      const m = sm.memos[w.id + "|" + tp.key];
      if (!m) continue;
      const issues = W.validate(m.llm, W.sourceOf(tp, RL()), RL());
      tp.llm = { title: m.llm.title, lines: [...m.llm.lines], issues, model: "recorded", recorded: true, at: Date.now(), attempts: [] };
      S.ws.shadow.push({ at: new Date().toISOString(), week: w.id, key: tp.key, model: "recorded", passed: !issues.length,
        codes: [...new Set(issues.map((x) => x.code))], tokens: issues.filter(W.isFactIssue).map((x) => x.token) });
      decide(tp);
      n++; if (issues.length) b++;
    }
  }
  S.topics = S.ws.weeks[S.ws.week];
  save(); renderAll();
  toast(t("vf.replayDone", { n, b }));
}

// ---------------------------------------------------------------- 재현 세트 · 비교 · 전환 · 롤백
function saveCase() {
  const label = $("#case-label").value.trim() || `${S.ws.week}`;
  S.ws.cases.push({ id: W.newId("c"), label, at: new Date().toISOString(), week: S.ws.week, reportLang: RL(), topics: clone(S.topics) });
  $("#case-label").value = "";
  save(); renderVerify();
}

function viewCase(id) {
  const c = S.ws.cases.find((x) => x.id === id);
  if (!c) return;
  $("#case-h").textContent = t("case.title", { l: c.label });
  $("#case-body").innerHTML = c.topics.map((tp) => {
    const issues = tp.llm ? W.validate(tp.llm, W.sourceOf(tp, RL()), RL()) : [];
    return `<section class="case-topic"><h4>${esc(tp.tag)} ${esc(tp.key)}</h4>
      <p><b>${esc(tp.title)}</b></p><ol>${tp.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ol>
      ${tp.llm ? `<p class="meta">${esc(t("ed.shadow"))}</p><ol>${tp.llm.lines.map((l, i) => `<li>${highlight(l, issues, i + 1)}</li>`).join("")}</ol>${issuesHtml(issues)}` : ""}</section>`;
  }).join("");
  $("#case").showModal();
}

function snapshot() { return clone({ cfg: S.ws.cfg, reportLang: S.ws.reportLang, groupBy: S.ws.groupBy, decision: S.ws.decision }); }

function switchDecision(to) {
  S.ws.history.push({ at: new Date().toISOString(), kind: "decision", text: t("hist.decision", { a: t("vf.mode." + S.ws.decision), b: t("vf.mode." + to) }), snapshot: snapshot() });
  S.ws.decision = to;
  if (to === "llm") for (const tp of S.topics) decide(tp);
  save(); renderAll();
}

function rollback() {
  const i = S.ws.history.map((h) => !!h.snapshot).lastIndexOf(true);
  if (i < 0) return;
  const h = S.ws.history[i];
  Object.assign(S.ws, clone(h.snapshot));
  for (const ts of Object.values(S.ws.weeks)) for (const tp of ts) {
    W.regroupTopic(tp, S.ws.cfg);
    if (S.ws.decision === "rule" && tp.prev && ["llm", "fallback"].includes(tp.how)) { Object.assign(tp, tp.prev); delete tp.prev; } // 자동 채택 전 요약으로
  }
  S.ws.history.splice(i, 1, { ...h, snapshot: null, text: h.text });
  S.ws.history.push({ at: new Date().toISOString(), kind: "rollback", text: t("hist.rollback", { what: h.text }) });
  S.topics = S.ws.weeks[S.ws.week] || S.topics;
  save(); renderAll();
}

// 설정 변경 전 / 후 비교 (같은 주차 + 재현 세트)
function previewChange(next) {
  const rows = [];
  const area = (x) => `${x.section} · ${x.tag}`, dom = (x) => [...(x.equipment || []), ...(x.issues || [])].join(", ") || "-";
  const okTxt = (bad) => (bad.length ? t("ed.fail", { n: bad.length }) : t("ed.pass"));
  for (const tp of S.topics) {
    const after = W.makeTopic(tp.key, tp.commits, next.cfg);
    const b0 = W.validate(tp, W.sourceOf(tp, RL()), RL()), b1 = W.validate(tp, W.sourceOf(tp, next.reportLang), next.reportLang);
    rows.push({ key: tp.key, cells: [[area(tp), area(after)], [dom(tp), dom(after)], [okTxt(b0), okTxt(b1)]] });
  }
  const caseRows = [];
  for (const c of S.ws.cases) for (const tp of c.topics.filter((x) => x.llm)) {
    const b0 = W.validate(tp.llm, W.sourceOf(tp, RL()), RL()).filter(W.isFactIssue), b1 = W.validate(tp.llm, W.sourceOf(tp, next.reportLang), next.reportLang).filter(W.isFactIssue);
    caseRows.push({ key: `${c.label} · ${tp.key}`, cells: [[b0.map((x) => x.token).join(", ") || t("ed.pass"), b1.map((x) => x.token).join(", ") || t("ed.pass")]] });
  }
  const changed = (r) => r.cells.some(([a, b]) => a !== b);
  const total = rows.length + caseRows.length, c = rows.filter(changed).length + caseRows.filter(changed).length;
  const tr = (r) => `<tr class="${changed(r) ? "chg" : ""}"><th scope="row">${esc(r.key)}</th>${r.cells.map(([a, b]) => `<td>${esc(a)}</td><td class="${a !== b ? "diff" : ""}">${esc(b)}</td>`).join("")}</tr>`;
  $("#cmp-sum").textContent = c ? t("cmpdlg.changed", { c, n: total }) : t("cmpdlg.none");
  $("#cmp-body").innerHTML = `<table class="tbl cmp"><thead><tr><th scope="col" rowspan="2">${esc(t("cmpdlg.topic"))}</th>
      <th colspan="2">${esc(t("cmpdlg.area"))}</th><th colspan="2">${esc(t("cmpdlg.dom"))}</th><th colspan="2">${esc(t("cmpdlg.check"))}</th></tr>
      <tr>${[1, 2, 3].map(() => `<th scope="col">${esc(t("cmpdlg.before"))}</th><th scope="col">${esc(t("cmpdlg.after"))}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(tr).join("")}</tbody></table>` +
    (caseRows.length ? `<table class="tbl cmp"><caption>${esc(t("cmpdlg.cases"))}</caption><thead><tr><th scope="col">${esc(t("cmpdlg.topic"))}</th><th scope="col">${esc(t("cmpdlg.before"))}</th><th scope="col">${esc(t("cmpdlg.after"))}</th></tr></thead><tbody>${caseRows.map(tr).join("")}</tbody></table>` : "");
  S.pending = { next, c, n: total };
  $("#cmp-dlg").showModal();
}

function applyPending() {
  const p = S.pending;
  if (!p) return;
  S.ws.history.push({ at: new Date().toISOString(), kind: "settings", text: t("hist.settings", { n: p.c }), snapshot: snapshot() });
  Object.assign(S.ws, clone(p.next));
  for (const ts of Object.values(S.ws.weeks)) for (const tp of ts) W.regroupTopic(tp, S.ws.cfg);
  S.lastCompare = { c: p.c, n: p.n };
  S.pending = null;
  $("#cmp-dlg").close();
  save(); renderAll();
}

// ---------------------------------------------------------------- 설정
function openSettings(tab = "llm") {
  const L = S.ws.llm;
  $("#s-provider").value = L.provider;
  $("#s-key").value = S.apiKey;
  $("#s-model").innerHTML = MODELS.map((m) => `<option value="${m.id}" ${m.id === L.model ? "selected" : ""}>${esc(m.label)}</option>`).join("");
  $("#s-ollamaUrl").value = L.ollamaUrl; $("#s-ollamaModel").value = L.ollamaModel;
  $("#s-mask").value = (L.maskWords || []).join(", ");
  $("#s-preview").checked = L.preview; $("#s-timeout").value = L.timeout;
  $("#s-reportLang").value = S.ws.reportLang; $("#s-groupBy").value = S.ws.groupBy;
  $("#s-rules").value = JSON.stringify({ rules: S.ws.cfg.rules, fallback: S.ws.cfg.fallback, order: S.ws.cfg.order }, null, 2);
  $("#s-equipment").value = S.ws.cfg.equipment || ""; $("#s-issue").value = S.ws.cfg.issue || "";
  const st = S.ws.style;
  $("#s-accent").value = "#" + String(st.accent).replace("#", "");
  $("#s-font").value = st.font; $("#s-cover").value = st.cover; $("#s-footer").value = st.footer;
  for (const k of ["sections", "cards", "compare", "domain"]) $("#s-" + k).checked = st[k];
  $("#settings-err").textContent = "";
  $("#storage-info").textContent = t("set.storage", { t: S.ws.savedAt ? new Date(S.ws.savedAt).toLocaleString() : "-" });
  renderTplInfo(); renderErrors();
  $(`[data-stab="${tab}"]`).click();
  $("#settings").showModal();
}

function saveSettings() {
  let r;
  const err = $("#settings-err");
  try {
    r = JSON.parse($("#s-rules").value);
    const cfg = { rules: r.rules, fallback: r.fallback, order: r.order || [], equipment: $("#s-equipment").value.trim(), issue: $("#s-issue").value.trim() };
    const bad = W.checkDict(cfg);
    if (bad.length) throw new Error(bad.join(", "));
    r = cfg;
  } catch (e) { err.textContent = t("set.dictErr", { m: e.message }); $('[data-stab="dict"]').click(); return; }
  S.apiKey = $("#s-key").value.trim();
  Object.assign(S.ws.llm, {
    provider: $("#s-provider").value, model: $("#s-model").value, ollamaUrl: $("#s-ollamaUrl").value.trim(), ollamaModel: $("#s-ollamaModel").value.trim(),
    maskWords: $("#s-mask").value.split(",").map((s) => s.trim()).filter(Boolean), preview: $("#s-preview").checked, timeout: Math.max(5, +$("#s-timeout").value || 600),
  });
  Object.assign(S.ws.style, {
    accent: $("#s-accent").value.replace("#", "").toUpperCase(), font: $("#s-font").value.trim() || DEFAULT_STYLE.font, cover: $("#s-cover").value.trim(), footer: $("#s-footer").value.trim(),
    sections: $("#s-sections").checked, cards: $("#s-cards").checked, compare: $("#s-compare").checked, domain: $("#s-domain").checked,
  });
  $("#settings").close();
  const next = { cfg: { ...S.ws.cfg, ...r }, reportLang: $("#s-reportLang").value, groupBy: $("#s-groupBy").value };
  const now = { cfg: S.ws.cfg, reportLang: S.ws.reportLang, groupBy: S.ws.groupBy };
  save();
  if (JSON.stringify(next) !== JSON.stringify(now)) {
    if (S.topics.length || S.ws.cases.length) previewChange(next); // 바꾸기 전에 같은 데이터로 전 / 후 비교
    else { Object.assign(S.ws, next); save(); renderAll(); }
  } else renderAll();
}

async function uploadTemplate(f) {
  const buf = await f.arrayBuffer();
  S.tpl = { name: f.name, buf };
  await DB.set("template", S.tpl);
  renderTplInfo(); renderExport();
}

function renderTplInfo() {
  $("#tpl-info").textContent = S.tpl ? t("set.tplOk", { name: S.tpl.name, kb: Math.round(S.tpl.buf.byteLength / 1024) }) : t("set.tplNone");
  $("#tpl-del").hidden = !S.tpl;
}

function renderErrors() {
  $("#err-list").innerHTML = S.errors.length ? S.errors.slice(0, 20).map((e) => `<li><small>${esc(new Date(e.at).toLocaleString())}</small> ${esc(e.msg)}</li>`).join("") : `<li class="hint">${esc(t("set.errNone"))}</li>`;
}

async function restore(f) {
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== "weekly-report" || !Array.isArray(j.commits)) throw new Error("format");
    delete j.app;
    S.ws = { ...freshWs(j.lang || getLang()), ...j };
    S.topics = (S.ws.week && S.ws.weeks[S.ws.week]) || [];
    if (!S.topics.length && S.ws.week) selectWeek(S.ws.week);
    save(); $("#settings").close(); renderAll(); toast(t("toast.restored"));
  } catch (e) { toast(t("toast.restoreErr", { m: e.message }), true); }
}

// ---------------------------------------------------------------- 내보내기
let pptxLoading = null;
function loadPptx() {
  if (window.PptxGenJS) return Promise.resolve();
  return (pptxLoading ||= new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "vendor/pptxgen.bundle.js"; // PptxGenJS + JSZip (저장소 안)
    s.onload = ok; s.onerror = () => fail(new Error("vendor/pptxgen.bundle.js"));
    document.head.appendChild(s);
  }));
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function reportData() {
  const w = weekInfo();
  const live = S.topics.filter((x) => !x.skip);
  return { w, live, d: { topics: live, year: w.year, week: w.week, project: S.ws.project, author: S.ws.author, order: S.ws.cfg.order, groupBy: S.ws.groupBy, compare: compareData(), lang: RL(), style: S.ws.style } };
}

function okToExport(live) {
  const bad = live.filter((x) => check(x).length);
  return !bad.length || confirm(t("ex.confirm", { n: bad.length }));
}

async function exportPptx(useTpl) {
  const { w, live, d } = reportData();
  if (!okToExport(live)) return;
  if (useTpl && !S.tpl) { toast(t("ex.noTpl"), true); return; }
  const msg = $("#export-msg");
  msg.textContent = t("ex.making");
  try {
    await loadPptx();
    const file = RL() === "en" ? `weekly-report-${w.year}-W${w.week}.pptx` : `${w.year}년_${w.week}주차_업무보고.pptx`;
    if (useTpl) {
      const [a, b] = W.weekRange(w.year, w.week);
      const vars = { project: S.ws.project, cover: S.ws.style.cover || (RL() === "en" ? "Weekly status report" : "주간 업무 보고"), week: RL() === "en" ? `${w.year} W${w.week}` : `${w.year}년 ${w.week}주차`,
        range: `${a} ~ ${b}`, author: S.ws.author, date: new Date().toISOString().slice(0, 10), footer: S.ws.style.footer || S.ws.project };
      const { zip, info } = await fillTemplate(window.JSZip, S.tpl.buf, { vars, topics: live.map((x) => ({ ...x, status: W.statusOf(x, RL()) })) });
      download(await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }), file);
      msg.textContent = t("ex.saved", { f: file }) + (info.unknown.length ? " · " + t("ex.tplUnknown", { t: info.unknown.join(", ") }) : "");
    } else {
      await buildDeck(window.PptxGenJS, d).writeFile({ fileName: file });
      msg.textContent = t("ex.saved", { f: file });
    }
  } catch (e) {
    const k = "ex.tplErr." + e.message;
    msg.textContent = t("ex.err", { m: t(k) !== k ? t(k) : e.message });
  }
}

async function exportMd(toClipboard) {
  const { w, live, d } = reportData();
  if (!okToExport(live)) return;
  const md = W.toMarkdown({ ...d, topics: live });
  if (toClipboard) { await navigator.clipboard.writeText(md); $("#export-msg").textContent = t("ex.copied"); }
  else { const f = `weekly-report-${w.year}-W${w.week}.md`; download(new Blob([md], { type: "text/markdown" }), f); $("#export-msg").textContent = t("ex.saved", { f }); }
}

async function downloadTemplateSample() {
  await loadPptx();
  await buildTemplateSample(window.PptxGenJS).writeFile({ fileName: "weekly-report-template-sample.pptx" });
}

// ---------------------------------------------------------------- 시작
async function start() {
  let ws = null;
  try { ws = await DB.get("ws"); S.tpl = (await DB.get("template")) || null; S.errors = (await DB.get("errors")) || []; } catch (e) { console.warn(e); }
  const lang0 = ws?.lang || ((navigator.language || "ko").toLowerCase().startsWith("ko") ? "ko" : "en");
  setLang(lang0);
  S.ws = ws ? { ...freshWs(lang0), ...ws } : freshWs(lang0);
  S.tab = S.ws.source === "user" ? "file" : "sample";
  if (S.ws.week && S.ws.weeks[S.ws.week]) S.topics = S.ws.weeks[S.ws.week];
  else if (!ws) openSample(lang0 === "en" ? "en" : "ko"); // 첫 방문: 예시 세트로 시작
  else selectWeek(S.ws.week);
  renderAll();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
}
start();
