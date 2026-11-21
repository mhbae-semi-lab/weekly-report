// 완료 측정 ①: 합성 4주 세트에서 "지어낸 숫자 · 단어" 차단율 (검증 게이트 v0 → 현재)
//   node tests/measure.js            표 출력
//   node tests/measure.js --json F   결과를 JSON 파일로도 저장
// v0 = 이 저장소 첫 커밋(포트폴리오 데모)의 core.js validate. 같은 입력 · 같은 정답으로 비교한다.
import { createRequire } from "node:module";
import fs from "node:fs";
import * as W from "../js/core.js";
import { SAMPLES } from "../js/sample.js";

const V0 = createRequire(import.meta.url)("./fixtures/validate-v0.cjs");
const v0Blocks = (out, src) => V0.validate(out, src).some((m) => /^입력에 없는 숫자|^근거 없는 단어/.test(m));
const v1Blocks = (out, src, lang) => W.validate(out, src, lang).some(W.isFactIssue);

// 주입 패턴: [분류, 문구, 사실 토큰] — 토큰 중 하나라도 입력에 없으면 "지어낸" 변형으로 센다
const INJECT = {
  ko: [
    ["아라비아 숫자", "처리 시간 37% 단축", ["37", "단축"]],
    ["아라비아 숫자", "조회 속도 4배 개선", ["4"]],
    ["소수", "검사 시간 2.7초로 줄임", ["2.7"]],
    ["날짜", "11월 27일 현장 배포", ["11", "27", "배포"]],
    ["글자 수량", "탐색이 세 배 빨라짐", ["세 배", "빨라"]],
    ["글자 수량", "디스크 사용 절반으로 줄임", ["절반"]],
    ["글자 수량", "다운타임 수십 분 감소", ["수십 분", "감소"]],
    ["장비 지표", "수율 개선 기대", ["수율"]],
    ["장비 지표", "가동률 개선", ["가동률"]],
    ["효과어", "작업 시간 대폭 단축", ["대폭", "단축"]],
    ["상태어", "현장 적용 완료", ["적용", "완료"]],
  ],
  en: [
    ["아라비아 숫자", "cuts cycle time by 37%", ["37"]],
    ["소수", "3.5x faster search", ["3.5", "faster"]],
    ["글자 수량", "twice as fast", ["twice"]],
    ["글자 수량", "halves the downtime", ["halve"]],
    ["장비 지표", "improves yield", ["yield"]],
    ["장비 지표", "higher throughput on every tool", ["throughput"]],
    ["상태어", "deployed to all tools", ["deployed"]],
    ["상태어", "verified on site", ["verified"]],
  ],
};

const present = (src, tok) => src.toLowerCase().includes(tok.toLowerCase());

function topicsOf(lang) {
  const S = SAMPLES[lang], r = W.parseGitLog(S.log), out = [];
  for (const w of W.weeksOf(r.commits)) {
    for (const t of W.groupTopics(r.commits.filter((c) => W.isoWeek(c.date).id === w.id), S.config)) {
      const m = S.memos[w.id + "|" + t.key];
      if (!m) continue;
      Object.assign(t, { why: m.why, status: m.status });
      out.push({ week: w.id, t, m, src: W.sourceOf(t, lang) });
    }
  }
  return out;
}

export function measure() {
  const cats = new Map(); // 분류 → { n, v0, v1 }
  const bump = (cat, b0, b1) => { const c = cats.get(cat) || { n: 0, v0: 0, v1: 0 }; c.n++; c.v0 += b0; c.v1 += b1; cats.set(cat, c); };
  const clean = { n: 0, v0: 0, v1: 0 }, recorded = { fab: 0, v0: 0, v1: 0, clean: 0, v0fp: 0, v1fp: 0 };
  const misses = [];
  for (const lang of ["ko", "en"]) {
    for (const { t, m, src, week } of topicsOf(lang)) {
      // 사람이 쓴 예시 요약 = 통과해야 하는 문장
      clean.n++; clean.v0 += v0Blocks(m, src); clean.v1 += v1Blocks(m, src, lang);
      // 녹화한 합성 LLM 응답 (정답: 사실 문제 여부는 사람이 표시한 목록과 같다 — core.test.js 가 고정)
      const fab = W.validate(m.llm, src, lang).some(W.isFactIssue);
      if (fab) { recorded.fab++; recorded.v0 += v0Blocks(m.llm, src); recorded.v1 += 1; }
      else { recorded.clean++; recorded.v0fp += v0Blocks(m.llm, src); recorded.v1fp += v1Blocks(m.llm, src, lang); }
      // 주입 변형
      for (const [cat, phrase, toks] of INJECT[lang]) {
        if (toks.every((k) => present(src, k))) continue; // 입력에 근거가 있으면 지어낸 것이 아니다
        const out = { title: m.title, lines: [m.lines[0], m.lines[1] + " · " + phrase, m.lines[2]] };
        const b0 = v0Blocks(out, src), b1 = v1Blocks(out, src, lang);
        bump(`${lang} ${cat}`, b0, b1);
        if (!b1) misses.push(`${lang} ${week} ${t.key}: ${phrase}`);
      }
    }
  }
  const rows = [...cats].map(([cat, c]) => ({ cat, ...c }));
  const tot = rows.reduce((a, r) => ({ n: a.n + r.n, v0: a.v0 + r.v0, v1: a.v1 + r.v1 }), { n: 0, v0: 0, v1: 0 });
  return { rows, total: tot, clean, recorded, misses };
}

const pct = (a, n) => (n ? ((a / n) * 100).toFixed(1) + "%" : "-");
if (import.meta.main) {
  const r = measure();
  console.log("| 분류 | 변형 수 | v0 차단 | 현재 차단 |\n|---|---|---|---|");
  for (const x of r.rows) console.log(`| ${x.cat} | ${x.n} | ${x.v0} (${pct(x.v0, x.n)}) | ${x.v1} (${pct(x.v1, x.n)}) |`);
  console.log(`| **합계** | ${r.total.n} | ${r.total.v0} (${pct(r.total.v0, r.total.n)}) | ${r.total.v1} (${pct(r.total.v1, r.total.n)}) |`);
  console.log(`\n녹화 LLM 응답: 지어낸 ${r.recorded.fab}건 중 v0 ${r.recorded.v0} · 현재 ${r.recorded.v1} 차단, 정상 ${r.recorded.clean}건 중 잘못 차단 v0 ${r.recorded.v0fp} · 현재 ${r.recorded.v1fp}`);
  console.log(`사람이 쓴 예시 요약 ${r.clean.n}건 잘못 차단: v0 ${r.clean.v0} · 현재 ${r.clean.v1}`);
  if (r.misses.length) console.log("놓침:\n" + r.misses.join("\n"));
  const i = process.argv.indexOf("--json");
  if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(r, null, 2));
}
