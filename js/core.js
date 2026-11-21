// 주간 보고 생성기 핵심 로직 (화면 · 네트워크 없음 → node --test 로 그대로 검사한다)
// git log 읽기 → 주차 · 필터 → 주제 묶기(영역 사전) → 요약 · 검증 게이트 → 지난주 비교 → Markdown

export const VERSION = "1.0.0";

// ---------------------------------------------------------------- git log 읽기
// 지원 형식 (자동 인식)
//  custom : git log --format="@@%h|%ad|%an|%s" --date=short --name-only   (앱이 안내하는 명령)
//  default: git log [--stat | --name-only | --name-status | --numstat] [--date=…]  ("commit <sha>" 블록)
//  oneline: git log --oneline                                              (날짜 없음 → 지정한 날짜로)
const SKIP_SUBJ = /^(index on |On |WIP on |Merge )/;
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad2 = (n) => String(n).padStart(2, "0");

// 작성자 현지 날짜를 그대로 쓴다 (UTC 로 바꾸면 밤 커밋이 다음 날로 밀린다)
export function parseDate(s) {
  s = String(s || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(?:[A-Za-z]{3},?\s+)?([A-Za-z]{3})\s+(\d{1,2})\s+\d{1,2}:\d{2}(?::\d{2})?\s+(\d{4})/); // Mon Nov 10 14:22:01 2026 +0900
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${pad2(MONTHS[m[1].toLowerCase()])}-${pad2(m[2])}`;
  m = s.match(/^(?:[A-Za-z]{3},\s+)?(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/); // Mon, 10 Nov 2026 14:22:01 +0900 (rfc)
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad2(MONTHS[m[2].toLowerCase()])}-${pad2(m[1])}`;
  return null;
}

export function detectFormat(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return "empty";
  if (lines.some((l) => l.startsWith("@@"))) return "custom";
  if (lines.some((l) => /^commit [0-9a-f]{7,40}\b/.test(l))) return "default";
  const one = lines.filter((l) => /^(?:[*|\\/ ]+)?[0-9a-f]{7,40}\s+\S/.test(l)).length;
  if (one && one >= lines.length * 0.6) return "oneline";
  return "unknown";
}

// 파일 줄 판별: --name-only / --name-status / --numstat / --stat
function fileOf(raw) {
  const line = raw.trim();
  if (!line) return null;
  let m = line.match(/^(?:[ACDMRTUXB]\d*)\t(?:.*\t)?(.+)$/); // name-status (R100\told\tnew 는 새 이름)
  if (m) return m[1];
  m = line.match(/^(?:\d+|-)\t(?:\d+|-)\t(.+)$/); // numstat
  if (m) return m[1];
  m = raw.match(/^\s(.+?)\s+\|\s+(?:\d+|Bin)/); // --stat
  if (m) return m[1].trim().replace(/^\.\.\.\//, "");
  if (/^\d+ files? changed/.test(line)) return "";
  if (/^\s/.test(raw)) return null; // 들여쓴 줄 = 메시지
  if (/\s{2,}/.test(line) || line.length > 260) return null;
  return line;
}

export function parseGitLog(text, opt = {}) {
  const format = detectFormat(text);
  const out = { format, commits: [], errors: [], authors: [] };
  const lines = String(text).split(/\r?\n/);
  const err = (i, code, s) => { out.errors.push({ line: i + 1, code, text: String(s).slice(0, 120) }); };
  const push = (c) => {
    if (!c) return;
    c.subject = (c.subject || "").trim();
    if (!c.subject || c.merge || SKIP_SUBJ.test(c.subject)) return;
    c.files = c.files.filter(Boolean).map((f) => f.replace(/\\/g, "/"));
    out.commits.push(c);
  };

  if (format === "custom") {
    let cur = null;
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      if (line.startsWith("@@")) {
        push(cur);
        cur = null;
        const parts = line.slice(2).split("|");
        const [hash, dateRaw] = parts;
        const date = parseDate(dateRaw);
        if (!hash || !/^[0-9a-f]{4,40}$/i.test(hash.trim())) return err(i, "bad-hash", line);
        if (!date) return err(i, /ago/.test(dateRaw || "") ? "relative-date" : "bad-date", line);
        const author = parts.length >= 4 ? parts[2].trim() : "";
        const subject = (parts.length >= 4 ? parts.slice(3) : parts.slice(2)).join("|");
        cur = { hash: hash.trim(), date, author, subject, files: [] };
      } else if (cur) cur.files.push(line);
      else err(i, "before-header", line);
    });
    push(cur);
  } else if (format === "default") {
    let cur = null, inMsg = false, seen = 0;
    lines.forEach((raw, i) => {
      const line = raw.trim();
      const head = raw.match(/^commit ([0-9a-f]{7,40})\b/);
      if (head) {
        if (cur && !cur.date) err(cur.at, "no-date", "commit " + cur.hash);
        if (cur && cur.date) push(cur);
        cur = { hash: head[1].slice(0, 7), date: null, author: "", subject: "", files: [], at: i };
        inMsg = false; seen = 0;
        return;
      }
      if (!cur) { if (line) err(i, "before-header", line); return; }
      let m;
      if (!inMsg && (m = raw.match(/^Merge:\s/))) { cur.merge = true; return; }
      if (!inMsg && (m = raw.match(/^Author:\s*(.*?)\s*(?:<[^>]*>)?\s*$/))) { cur.author = m[1]; return; }
      if (!inMsg && (m = raw.match(/^(?:Author)?Date:\s*(.*)$/))) {
        cur.date = parseDate(m[1]);
        if (!cur.date) err(i, /ago/.test(m[1]) ? "relative-date" : "bad-date", line);
        return;
      }
      if (!inMsg && /^(Commit|CommitDate|Reflog|Notes)\b.*:/.test(raw)) return;
      if (!line) { if (cur.subject) inMsg = "body"; else inMsg = inMsg || "wait"; return; }
      if (/^ {4}/.test(raw) && inMsg !== "files") {
        if (!cur.subject) cur.subject = line;
        inMsg = inMsg === "body" ? "body" : "msg";
        seen++;
        return;
      }
      const f = fileOf(raw);
      if (f === null) { if (/^ {4}/.test(raw)) return; return err(i, "unknown-line", line); }
      inMsg = "files";
      if (f) cur.files.push(f);
    });
    if (cur && !cur.date) err(cur.at, "no-date", "commit " + cur.hash);
    if (cur && cur.date) push(cur);
    out.commits.forEach((c) => delete c.at);
  } else if (format === "oneline") {
    const date = opt.defaultDate || null;
    lines.forEach((raw, i) => {
      const line = raw.replace(/^[*|\\/ ]+/, "").trim();
      if (!line) return;
      const m = line.match(/^([0-9a-f]{7,40})\s+(?:\([^)]*\)\s+)?(.+)$/);
      if (!m) return err(i, "unknown-line", line);
      push({ hash: m[1].slice(0, 7), date, author: "", subject: m[2], files: [] });
    });
    if (!date) out.errors.unshift({ line: 0, code: "oneline-no-date", text: "" });
  } else if (format === "unknown") {
    const first = lines.findIndex((l) => l.trim());
    err(first, "unknown-format", lines[first] || "");
  }
  out.authors = [...new Set(out.commits.map((c) => c.author).filter(Boolean))].sort();
  return out;
}

// ---------------------------------------------------------------- 주차 · 필터
export function isoWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day); // 그 주의 목요일
  const year = dt.getUTCFullYear();
  const week = Math.ceil(((dt - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7);
  return { year, week, id: year + "-" + pad2(week) };
}

export function weekRange(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  const f = (x) => x.toISOString().slice(0, 10);
  return [f(mon), f(sun)];
}

export function weeksOf(commits) {
  const m = new Map();
  for (const c of commits) {
    if (!c.date) continue;
    const w = isoWeek(c.date);
    const e = m.get(w.id) || { ...w, count: 0 };
    e.count++;
    m.set(w.id, e);
  }
  return [...m.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

// f: { authors: [] (빈 배열 = 전체), from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
export function filterCommits(commits, f = {}) {
  const au = f.authors && f.authors.length ? new Set(f.authors) : null;
  return commits.filter((c) =>
    (!au || au.has(c.author)) && (!f.from || !c.date || c.date >= f.from) && (!f.to || !c.date || c.date <= f.to));
}

// ---------------------------------------------------------------- 영역 사전 (모듈 · 설비 · 현장 이슈)
// cfg.rules: [{ match: [경로 접두어], words: [제목 단어], tag, section }]  → 모듈(구역)
// cfg.equipment / cfg.issue: 정규식 문자열 → 설비 번호 · 현장 이슈 번호
const GENERIC_TAGS = ["feat", "fix", "add", "update", "refactor", "기능", "수정", "추가"];

export function compileDict(cfg) {
  const re = (s) => { try { return s ? new RegExp(s, "giu") : null; } catch { return null; } };
  return { equip: re(cfg.equipment), issue: re(cfg.issue) };
}

export function checkDict(cfg) {
  const errs = [];
  if (!Array.isArray(cfg.rules)) errs.push("rules");
  else cfg.rules.forEach((r, i) => { if (!Array.isArray(r.match) || !r.tag || !r.section) errs.push("rules[" + i + "]"); });
  if (!cfg.fallback || !cfg.fallback.tag || !cfg.fallback.section) errs.push("fallback");
  for (const k of ["equipment", "issue"]) {
    if (cfg[k]) { try { new RegExp(cfg[k], "u"); } catch (e) { errs.push(k + ": " + e.message); } }
  }
  return errs;
}

const findAll = (re, s) => (re ? [...String(s).matchAll(re)].map((m) => m[0].replace(/\s+/g, " ")) : []);
const uniq = (a) => [...new Set(a)];

export function topicKey(subj, issueRe) {
  let s = String(subj);
  if (issueRe) s = s.replace(issueRe, " ").replace(/\(\s*\)|\[\s*\]/g, " ").replace(/\s{2,}/g, " ").trim();
  let m = s.match(/^\[([^\]]+)\]\s*:?\s*(.*)$/);
  if (m) {
    if (!GENERIC_TAGS.includes(m[1].toLowerCase())) return m[1].trim();
    s = m[2] || s;
  }
  // Conventional Commits 접두어 (fix: / feat(ui): …) 는 주제 이름에서 뺀다
  s = s.replace(/^(feat|fix|add|update|refactor|chore|docs|style|test|perf|build|ci)(\([^)]*\))?!?:\s*/i, "") || s;
  m = s.match(/^(.+?)\s+Phase\s*\d+/i);
  if (m) return m[1].trim();
  return s.split(/\s*(?:\(| - | — )/)[0].trim().slice(0, 40) || String(subj).slice(0, 40);
}

export function areaOf(cfg, files, subjects = []) {
  const cnt = new Map();
  const bump = (r, n) => { const k = r.tag + "\u0000" + r.section; cnt.set(k, (cnt.get(k) || 0) + n); };
  for (const f of files) {
    const r = cfg.rules.find((r) => r.match.some((p) => p && f.startsWith(p)));
    if (r) bump(r, 1);
  }
  if (!cnt.size) { // 파일 목록이 없으면 제목 단어로
    const text = subjects.join(" ").toLowerCase();
    for (const r of cfg.rules) for (const w of r.words || []) if (w && text.includes(w.toLowerCase())) bump(r, 1);
  }
  let best = null, n = 0;
  for (const [k, v] of cnt) if (v > n) { best = k; n = v; } // 동률이면 규칙 순서가 앞선 영역
  if (!best) return { tag: cfg.fallback.tag, section: cfg.fallback.section };
  const [tag, section] = best.split("\u0000");
  return { tag, section };
}

let seq = 0;
export const newId = (p = "t") => p + Date.now().toString(36) + (seq++).toString(36);

export function makeTopic(key, commits, cfg) {
  const dict = compileDict(cfg);
  const subjects = commits.map((c) => c.subject);
  const { tag, section } = areaOf(cfg, commits.flatMap((c) => c.files), subjects);
  return {
    id: newId(), key, tag, section, skip: false,
    equipment: uniq(subjects.flatMap((s) => findAll(dict.equip, s))),
    issues: uniq(subjects.flatMap((s) => findAll(dict.issue, s))),
    why: "", what: subjects.join("\n"), status: "",
    commits, steps: [], title: "", lines: ["", "", ""], how: "", llm: null,
  };
}

// 같은 주제 이름이거나 같은 현장 이슈 번호를 가진 커밋은 한 주제로 묶는다
export function groupTopics(commits, cfg) {
  const dict = compileDict(cfg);
  const groups = []; // { key, issues:Set, cms }
  for (const c of commits) {
    const key = topicKey(c.subject, dict.issue);
    const iss = findAll(dict.issue, c.subject);
    let g = groups.find((g) => g.key === key) || groups.find((g) => iss.some((x) => g.issues.has(x)));
    if (!g) groups.push((g = { key, issues: new Set(), cms: [] }));
    iss.forEach((x) => g.issues.add(x));
    g.cms.push(c);
  }
  return groups.map((g) => makeTopic(g.key, g.cms, cfg));
}

export function regroupTopic(t, cfg) {
  const n = makeTopic(t.key, t.commits, cfg);
  Object.assign(t, { tag: n.tag, section: n.section, equipment: n.equipment, issues: n.issues });
  return t;
}

// groupBy: "section"(모듈) | "equipment"(설비) — 설비가 없는 주제는 noEquip 이름으로
export function sectionGroups(items, order = [], groupBy = "section", noEquip = "공통") {
  const secs = new Map();
  for (const it of items) {
    const names = groupBy === "equipment" ? (it.equipment && it.equipment.length ? [it.equipment[0]] : [noEquip]) : [it.section];
    for (const s of names) {
      if (!secs.has(s)) secs.set(s, []);
      secs.get(s).push(it);
    }
  }
  const idx = (s) => (order.includes(s) ? order.indexOf(s) : 99);
  return [...secs].sort((a, b) => idx(a[0]) - idx(b[0]) || b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1));
}

// ---------------------------------------------------------------- 편집 (커밋 이동 · 합치기 · 나누기)
export function moveCommit(topics, fromId, hash, toId) {
  const a = topics.find((t) => t.id === fromId), b = topics.find((t) => t.id === toId);
  if (!a || !b || a === b) return false;
  const i = a.commits.findIndex((c) => c.hash === hash);
  if (i < 0) return false;
  b.commits.push(...a.commits.splice(i, 1));
  for (const t of [a, b]) t.what = t.commits.map((c) => c.subject).join("\n");
  if (!a.commits.length) topics.splice(topics.indexOf(a), 1);
  return true;
}

export function mergeTopics(topics, ids, cfg) {
  const list = ids.map((id) => topics.find((t) => t.id === id)).filter(Boolean);
  if (list.length < 2) return null;
  const [head, ...rest] = list;
  for (const t of rest) {
    head.commits.push(...t.commits);
    if (t.why && !head.why.includes(t.why)) head.why = [head.why, t.why].filter(Boolean).join(" · ");
    topics.splice(topics.indexOf(t), 1);
  }
  head.what = head.commits.map((c) => c.subject).join("\n");
  regroupTopic(head, cfg);
  return head;
}

export function splitTopic(topics, id, hashes, cfg, key) {
  const t = topics.find((x) => x.id === id);
  if (!t) return null;
  const take = t.commits.filter((c) => hashes.includes(c.hash));
  if (!take.length || take.length === t.commits.length) return null;
  t.commits = t.commits.filter((c) => !hashes.includes(c.hash));
  t.what = t.commits.map((c) => c.subject).join("\n");
  regroupTopic(t, cfg);
  const n = makeTopic(key || topicKey(take[0].subject, compileDict(cfg).issue), take, cfg);
  topics.splice(topics.indexOf(t) + 1, 0, n);
  return n;
}

// ---------------------------------------------------------------- 요약 · 검증 게이트
const DEFAULT_STATUS = { ko: "예정: 검증", en: "Next: verify" };
export const statusOf = (t, lang = "ko") => (t.status || "").trim() || DEFAULT_STATUS[lang] || DEFAULT_STATUS.ko;
export const defaultStatus = (lang = "ko") => DEFAULT_STATUS[lang] || DEFAULT_STATUS.ko;
// 검증의 근거 = 주제 이름 · 메모(왜 · 무엇을 · 상태). 커밋 파일 경로는 넣지 않는다
export const sourceOf = (t, lang) => [t.key, t.why, t.what, statusOf(t, lang)].join(" ");

// 숫자: 천 단위 쉼표 · 앞자리 0 을 맞춘 뒤 문자열로 비교 (1.5 는 1 과 5 가 있어도 따로 본다)
const NUM_RE = /\d+(?:[.,]\d+)*/g;
const normNum = (s) => {
  s = s.replace(/,(?=\d{3}(?!\d))/g, "");
  return /^\d+$/.test(s) ? String(Number(s)) : s;
};
export const numsOf = (s) => new Set((String(s).match(NUM_RE) || []).map(normNum));

// 한국어 · 영어 수량 표현 (숫자 없이 쓰는 지어낸 수치). "한 번" 같은 관용구는 일부러 뺐다
const KO_NUMWORD = /(?<![가-힣])(?:두|세|네|다섯|여섯|일곱|여덟|아홉|열|수십|수백|수천|수만|몇십|몇백)\s?(?:배|개|건|번|회|명|대|종|가지|초|분|시간|일|주|달|개월|년|퍼센트|프로)|절반|반감/g;
const EN_NUMWORD = /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozens?|hundreds?|thousands?|millions?|twice|double[ds]?|triple[ds]?|half|halve[ds]?|halving)\b/gi;
// 상태어: 입력에 없으면 진행 상태를 지어낸 것으로 본다
export const STATUS_WORDS = {
  ko: ["완료", "확인", "적용", "검증", "해결", "반영", "배포", "승인"],
  en: ["done", "completed", "complete", "finished", "resolved", "verified", "validated", "confirmed", "deployed", "released", "shipped"],
};
// 효과어: 성과 · 장비 지표 주장 (수율 · 가동률 · UPH 등 장비 쪽 효과 단어 포함)
export const EFFECT_WORDS = {
  ko: ["효율", "향상", "강화", "증대", "정확도", "안정성", "최적화", "편의", "단축", "절감", "감소", "증가", "대폭", "획기적", "극대화", "최소화",
    "생산성", "성능", "수율", "가동률", "다운타임", "택트", "처리량", "불량률", "빨라", "빠르게", "신속"],
  en: ["faster", "speed up", "sped up", "speedup", "boost", "enhanc", "optimi", "efficien", "accura", "stabil", "stable", "reduc", "increas", "decreas",
    "yield", "throughput", "uptime", "productiv", "downtime", "significant", "dramatic", "performance", "robust", "seamless", "uph", "takt", "mtbf"],
};
const hasWord = (text, w) => (/^[a-z ]+$/i.test(w) ? new RegExp("\\b" + w, "i").test(text) : text.includes(w));

export const LIMITS = { ko: { title: 40, line: 80 }, en: { title: 60, line: 110 } };

// 결과: 문제 목록 [{ code, token?, line? }] — 빈 배열이면 통과
export function validate(out, src, lang = "ko") {
  const bad = [];
  const lim = LIMITS[lang] || LIMITS.ko;
  const lines = out && out.lines;
  if (!Array.isArray(lines) || lines.length !== 3 || lines.some((l) => !String(l).trim())) return [{ code: "lines" }];
  const title = String(out.title || "").trim();
  if (!title) bad.push({ code: "title-empty" });
  else if (title.length > lim.title) bad.push({ code: "title-long", n: title.length, max: lim.title });
  else if (title.endsWith(".")) bad.push({ code: "title-period" });
  lines.forEach((l, i) => {
    l = String(l);
    if (l.length > lim.line) bad.push({ code: "line-long", line: i + 1, n: l.length, max: lim.line });
    if (l.trimEnd().endsWith(".")) bad.push({ code: "line-period", line: i + 1 });
    if (/입력 필요|details needed/.test(l)) bad.push({ code: "line-placeholder", line: i + 1 });
    if (lang === "ko") {
      const letters = l.match(/[A-Za-z가-힣]/g) || [];
      const ko = l.match(/[가-힣]/g) || [];
      if (letters.length && ko.length / letters.length < 0.15) bad.push({ code: "line-hangul", line: i + 1 });
    }
  });
  const parts = [title, ...lines.map(String)];
  const where = (pred) => { const i = parts.findIndex(pred); return i; }; // 0 = 제목, 1~3 = 줄
  const srcText = String(src);
  const srcNums = numsOf(srcText);
  const seen = new Set();
  const add = (code, token, i) => { const k = code + token; if (!seen.has(k)) { seen.add(k); bad.push({ code, token, line: i }); } };
  parts.forEach((p, i) => {
    for (const n of p.match(NUM_RE) || []) if (!srcNums.has(normNum(n))) add("num", n, i);
    for (const re of [KO_NUMWORD, EN_NUMWORD]) {
      for (const m of p.matchAll(re)) {
        const w = m[0];
        if (!srcText.toLowerCase().includes(w.toLowerCase().replace(/\s/g, "")) && !srcText.toLowerCase().includes(w.toLowerCase())) add("numword", w, i);
      }
    }
  });
  const full = parts.join(" ");
  for (const [code, dict] of [["status", STATUS_WORDS], ["effect", EFFECT_WORDS]]) {
    for (const w of dict.ko.concat(dict.en)) {
      if (hasWord(full, w) && !hasWord(srcText, w)) add(code, w, where((p) => hasWord(p, w)));
    }
  }
  return bad;
}

const MSG = {
  ko: {
    lines: () => "요약이 3줄이 아님",
    "title-empty": () => "제목 없음",
    "title-long": (b) => `제목 ${b.max}자 초과 (${b.n}자)`,
    "title-period": () => "제목 끝에 마침표",
    "line-long": (b) => `${b.line}줄 ${b.max}자 초과 (${b.n}자)`,
    "line-period": (b) => `${b.line}줄 끝에 마침표`,
    "line-placeholder": (b) => `${b.line}줄 내용 비어 있음 (메모를 채우거나 직접 수정)`,
    "line-hangul": (b) => `${b.line}줄 한글 부족 (보고서 언어가 한국어)`,
    num: (b) => `입력에 없는 숫자 '${b.token}'`,
    numword: (b) => `입력에 없는 수량 표현 '${b.token}'`,
    status: (b) => `입력에 없는 상태어 '${b.token}'`,
    effect: (b) => `근거 없는 효과어 '${b.token}'`,
  },
  en: {
    lines: () => "Summary is not exactly 3 lines",
    "title-empty": () => "Title is empty",
    "title-long": (b) => `Title over ${b.max} chars (${b.n})`,
    "title-period": () => "Title ends with a period",
    "line-long": (b) => `Line ${b.line} over ${b.max} chars (${b.n})`,
    "line-period": (b) => `Line ${b.line} ends with a period`,
    "line-placeholder": (b) => `Line ${b.line} is empty (fill the memo or edit)`,
    "line-hangul": (b) => `Line ${b.line} has too little Korean (report language is Korean)`,
    num: (b) => `Number '${b.token}' is not in the input`,
    numword: (b) => `Quantity '${b.token}' is not in the input`,
    status: (b) => `Status word '${b.token}' is not in the input`,
    effect: (b) => `Unsupported effect word '${b.token}'`,
  },
};
const WHY = {
  ko: { num: "커밋 제목 · 메모 어디에도 이 숫자가 없습니다. 측정하지 않은 수치는 보고서에 쓰지 않습니다.",
    numword: "숫자를 글자로 쓴 수량입니다. 입력에 같은 표현이 없으면 지어낸 수치로 봅니다.",
    status: "진행 상태를 나타내는 말입니다. 메모 '상태'나 커밋에 있을 때만 씁니다.",
    effect: "성과 · 장비 지표(수율 · 가동률 등)를 주장하는 말입니다. 입력에 근거가 있을 때만 씁니다." },
  en: { num: "This number appears nowhere in the commit subjects or memo. Unmeasured figures stay out of the report.",
    numword: "A quantity written in words. Without the same phrase in the input it counts as made up.",
    status: "A progress-status word. Use it only when the memo status or a commit says so.",
    effect: "Claims an effect or equipment metric (yield, uptime …). Use it only with evidence in the input." },
};
export const issueMsg = (b, lang = "ko") => ((MSG[lang] || MSG.ko)[b.code] || (() => b.code))(b);
export const issueWhy = (b, lang = "ko") => (WHY[lang] || WHY.ko)[b.code] || "";
export const isFactIssue = (b) => ["num", "numword", "status", "effect"].includes(b.code);

const cleanSubj = (s) => String(s).replace(/^\[[^\]]*\]\s*:?\s*/, "").slice(0, 78).replace(/[ .]+$/, "");

// 모델 없이 입력만으로 만드는 규칙 기반 요약 (입력 문구만 쓰므로 사실 검증을 통과한다. 문장은 거칠다)
export function ruleSummary(t, lang = "ko") {
  const what = t.what.split("\n").map((x) => x.trim()).filter(Boolean);
  const l1 = cleanSubj(t.why || what[0] || t.key);
  let l2 = cleanSubj(what.length > 1 ? what.slice(1).map(cleanSubj).join(" · ") : what[0] || t.key);
  const max = (LIMITS[lang] || LIMITS.ko).line - 2;
  if (l2.length > max) l2 = l2.slice(0, max - 1).replace(/\s*\S*$/, "") || l2.slice(0, max - 1);
  if (l2 === l1) l2 = lang === "en" ? "(details needed)" : "(세부 내용 입력 필요)";
  return { title: cleanSubj(t.key).slice(0, lang === "en" ? 50 : 25), lines: [l1, l2, cleanSubj(statusOf(t, lang))] };
}

export function defaultSteps(what) {
  const ls = what.split("\n").map((x) => x.replace(/^\[[^\]]*\]\s*:?\s*|^[①-⑩]\s*/, "").trim()).filter(Boolean);
  return ls.length >= 2 ? ls.slice(0, 6).map((x) => x.slice(0, 36)) : [];
}

// 상태 문자열에서 배지: 완료/해결/Done = 채움, 예정/확인/Next = 테두리
export function badges(status) {
  return [...String(status).matchAll(/(완료|해결|예정|확인|Done|Fixed|Next|Planned|Check)\s*:/gi)].map((m) => ({
    word: m[1], filled: /^(완료|해결|done|fixed)$/i.test(m[1]),
  }));
}
export const isDone = (status) => {
  const b = badges(status);
  return b.length > 0 && b.every((x) => x.filled);
};

export const SYSTEM = {
  ko: "주간업무보고 슬라이드 하나의 '제목 본문'과 '요약 3줄'을 쓴다. 입력에 적힌 사실만 쓴다.",
  en: "Write the title and a 3-line summary for one weekly status-report slide. Use only facts stated in the input.",
};

export function prompt(t, lang = "ko", retryNote = "") {
  if (lang === "en") {
    return [
      "Rules:",
      "- Title under 50 characters, verb-first noun phrase (Add / Fix / Port / Refactor …), no bracket tag, no period",
      "- Exactly 3 lines. Line 1 what and why, line 2 how (concrete), line 3 current status",
      "- Each line under 100 characters, no labels like 'Goal:', no period, separate items with ' · ', flow with '→'",
      "- Do not write numbers, dates, measurements or effects (faster / improved yield / more stable) that are not in the input",
      "- Use status words (done / verified / deployed …) only when the input status says so",
      "", "[Input]", "Tag: " + t.tag, "Topic: " + t.key, "Why: " + (t.why || "(none)"), "What:", t.what,
      "Status: " + statusOf(t, lang), retryNote ? "\n" + retryNote : "",
    ].join("\n");
  }
  return [
    "규칙:",
    "- 제목 본문 25자 이내, 명사형 끝(개선/수정/추가/이식/개발/평가), 대괄호 태그와 마침표 없음",
    "- 요약 정확히 3줄. 1줄 무엇을 왜, 2줄 어떻게(구체 내용), 3줄 현재 상태",
    "- 한 줄 80자 이내, 라벨('목적:' 등) 없이 명사형으로, 마침표 없음, 구분은 ' · ', 흐름은 '→'",
    "- 입력에 없는 숫자·날짜·성능 수치·효과(효율/향상/단축/수율/정확도)를 쓰지 않는다. '세 배' '절반' 같은 글자 수량도 쓰지 않는다",
    "- 완료/확인/적용/검증/해결 같은 상태어는 입력 '상태'에 있을 때만, 그 의미 그대로 쓴다",
    "- 영어 기술 용어는 원문 그대로",
    "", "[입력]", "태그: " + t.tag, "주제: " + t.key, "왜: " + (t.why || "(없음)"), "무엇을:", t.what,
    "상태: " + statusOf(t, lang), retryNote ? "\n" + retryNote : "",
  ].join("\n");
}

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: { title: { type: "string" }, lines: { type: "array", items: { type: "string" } } },
  required: ["title", "lines"],
  additionalProperties: false,
};

// LLM 출력 정리: 앞의 [태그] 제거, 공백 정리
export const cleanLlm = (out) => ({
  title: String(out.title || "").replace(/^(\[[^\]]*\]\s*)+/, "").trim(),
  lines: (Array.isArray(out.lines) ? out.lines : []).map((s) => String(s).trim()),
});

// ---------------------------------------------------------------- 마스킹 (LLM 에 보내기 전)
// 메일 · IP · URL · Windows/UNC 경로 · 사용자 지정 단어를 [M1] 같은 자리표시자로 바꾼다
export function mask(text, words = []) {
  const map = [];
  const put = (s) => {
    let i = map.indexOf(s);
    if (i < 0) { map.push(s); i = map.length - 1; }
    return `[M${i + 1}]`;
  };
  let out = String(text);
  const ws = words.map((w) => String(w).trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  if (ws.length) out = out.replace(new RegExp(ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g"), put);
  out = out
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, put)
    .replace(/\bhttps?:\/\/[^\s)]+/g, put)
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, put)
    .replace(/(?:\b[A-Za-z]:\\|\\\\)[^\s]+/g, put);
  return { text: out, map };
}
export const unmask = (text, map) => String(text).replace(/\[M(\d+)\]/g, (m, n) => (map[n - 1] !== undefined ? map[n - 1] : m));

// ---------------------------------------------------------------- 지난주 비교 · 설비 · 이슈 진척
const norm = (s) => String(s).toLowerCase().replace(/[\s·\-_[\]()]/g, "");
const sameTopic = (a, b) => norm(a.key) === norm(b.key) || (a.issues || []).some((x) => (b.issues || []).includes(x));

// 이어진 일(지난주·이번주 모두) · 끝난 일(지난주에 완료 상태로 끝남) · 멈춘 일(완료 아님, 이번 주 커밋 없음) · 새 일
export function compareWeeks(prev, cur, lang = "ko") {
  const res = { continued: [], finished: [], stalled: [], added: [] };
  const P = (prev || []).filter((t) => !t.skip), C = (cur || []).filter((t) => !t.skip);
  for (const c of C) {
    const p = P.find((p) => sameTopic(p, c));
    if (p) res.continued.push({ key: c.key, id: c.id, before: statusOf(p, lang), after: statusOf(c, lang), doneNow: isDone(statusOf(c, lang)) && !isDone(statusOf(p, lang)) });
    else res.added.push({ key: c.key, id: c.id, after: statusOf(c, lang) });
  }
  for (const p of P) {
    if (C.some((c) => sameTopic(p, c))) continue;
    (isDone(statusOf(p, lang)) ? res.finished : res.stalled).push({ key: p.key, before: statusOf(p, lang) });
  }
  return res;
}

// 지난주 주제의 '왜'를 이어받는다 (비어 있을 때만). 바뀐 주제 수를 돌려준다
export function carryMemos(prev, cur) {
  let n = 0;
  for (const c of cur) {
    if (c.why) continue;
    const p = (prev || []).find((p) => sameTopic(p, c) && p.why);
    if (p) { c.why = p.why; c.carried = true; n++; }
  }
  return n;
}

// 설비 · 현장 이슈별 진척 표
export function domainRows(topics, lang = "ko") {
  const rows = [];
  for (const t of topics.filter((t) => !t.skip)) {
    for (const id of t.issues || []) rows.push({ kind: "issue", id, key: t.key, status: statusOf(t, lang), equipment: (t.equipment || []).join(", ") });
  }
  for (const t of topics.filter((t) => !t.skip && !(t.issues || []).length)) {
    for (const id of t.equipment || []) rows.push({ kind: "equip", id, key: t.key, status: statusOf(t, lang), equipment: id });
  }
  return rows;
}

// ---------------------------------------------------------------- 슬라이드 배치 (미리보기와 PPT 가 같은 값)
export const SLIDE = { w: 13.333, h: 7.5, left: 0.6, width: 12.13 };
export function contentLayout(t) {
  const L = {
    title: { x: SLIDE.left, y: 0.38, w: SLIDE.width, h: 0.62 },
    rule: { x: SLIDE.left, y: 1.06, w: SLIDE.width },
    body: { x: SLIDE.left, y: 1.25, w: SLIDE.width, h: 1.55 },
    badgeY: 2.95, badge: { w: 0.95, h: 0.34, gap: 0.12 },
    cards: [],
    foot: { x: SLIDE.left, y: 7.0, w: SLIDE.width, h: 0.3 },
  };
  const steps = (t.steps || []).filter(Boolean).slice(0, 6);
  if (steps.length >= 2) {
    const n = steps.length, gap = 0.42, y = 4.05, h = 1.7;
    const w = (SLIDE.width - gap * (n - 1)) / n;
    L.cards = steps.map((s, i) => ({ text: s, x: SLIDE.left + i * (w + gap), y, w, h, last: i === n - 1, gap }));
  }
  return L;
}

// ---------------------------------------------------------------- Markdown
// r: { project, author, year, week, topics, order, groupBy, compare, lang, labels }
export function toMarkdown(r) {
  const L = r.lang === "en"
    ? { head: `Weekly report — ${r.year} W${r.week}`, cmp: "Compared with last week", cont: "Continued", fin: "Finished", stal: "No commits this week", add: "New", dom: "Equipment · field issues", st: "Status" }
    : { head: `${r.year}년 ${r.week}주차 주간 업무 보고`, cmp: "지난주 대비", cont: "이어진 일", fin: "끝난 일", stal: "이번 주 커밋 없음", add: "새 일", dom: "설비 · 현장 이슈 진척", st: "상태" };
  const [a, b] = weekRange(r.year, r.week);
  const out = [`# ${L.head}`, "", `${r.project || ""} · ${r.author || ""} · ${a} ~ ${b}`.replace(/^ · | · $/g, ""), ""];
  const live = r.topics.filter((t) => !t.skip);
  for (const [name, items] of sectionGroups(live, r.order, r.groupBy, r.lang === "en" ? "Common" : "공통")) {
    out.push(`## ${name}`, "");
    for (const t of items) {
      out.push(`### ${t.tag} ${t.title}`, ...t.lines.map((l) => `- ${l}`));
      const meta = [...(t.equipment || []), ...(t.issues || [])];
      if (meta.length) out.push(`- ${meta.join(" · ")}`);
      out.push("");
    }
  }
  if (r.compare) {
    const c = r.compare;
    out.push(`## ${L.cmp}`, "");
    const row = (label, list, f) => { if (list.length) out.push(`**${label}** (${list.length})`, ...list.map(f), ""); };
    row(L.cont, c.continued, (x) => `- ${x.key}: ${x.before} → ${x.after}`);
    row(L.fin, c.finished, (x) => `- ${x.key}: ${x.before}`);
    row(L.stal, c.stalled, (x) => `- ${x.key}: ${x.before}`);
    row(L.add, c.added, (x) => `- ${x.key}: ${x.after}`);
  }
  const rows = domainRows(live, r.lang);
  if (rows.length) {
    out.push(`## ${L.dom}`, "", `| ID | ${r.lang === "en" ? "Topic" : "주제"} | ${L.st} |`, "|---|---|---|");
    for (const x of rows) out.push(`| ${x.id} | ${x.key} | ${x.status} |`);
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
