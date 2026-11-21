import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as W from "../js/core.js";
import { SAMPLES, DEFAULT_CONFIG } from "../js/sample.js";

const file = (n) => fs.readFileSync(new URL("../samples/" + n, import.meta.url), "utf8");

test("custom 형식: 4주 · 작성자 · 파일", () => {
  const r = W.parseGitLog(SAMPLES.ko.log);
  assert.equal(r.format, "custom");
  assert.equal(r.commits.length, 29);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.authors, ["김철수", "홍길동"]);
  assert.deepEqual(W.weeksOf(r.commits).map((w) => w.id), ["2026-43", "2026-44", "2026-45", "2026-46"]);
  assert.deepEqual(r.commits[0].files, ["src/Report/CsvExporter.cs", "src/Report/ResultTable.cs"]);
});

test("기본 git log (--name-only · --stat) 자동 인식", () => {
  for (const n of ["git-log-name-only.txt", "git-log-stat.txt"]) {
    const r = W.parseGitLog(file(n));
    assert.equal(r.format, "default", n);
    assert.deepEqual(r.errors, [], n);
    assert.equal(r.commits.length, 15, n);
    const c = r.commits.find((c) => c.hash === "f4f1e24");
    assert.equal(c.date, "2026-11-10");
    assert.equal(c.author, "홍길동");
    assert.match(c.subject, /^오토 포커스 탐색 Phase 4/);
    assert.deepEqual(c.files, ["src/Vision/Focus/FocusConfig.cs", "src/Vision/Focus/AutoFocus.cs", "src/UI/SettingsView.xaml"]);
  }
});

test("--name-status · --numstat · Merge 건너뜀 · ISO 날짜", () => {
  const txt = `commit 1111111aaaaaaa
Merge: 2222222 3333333
Author: A <a@example.com>
Date:   2026-11-10 10:00:00 +0900

    Merge branch 'x'

commit 4444444bbbbbbb
Author: A <a@example.com>
Date:   2026-11-11T23:50:00+09:00

    [Stage] fix homing

M\tsrc/Motion/Home.cs
R100\tsrc/old.cs\tsrc/new.cs

commit 5555555ccccccc
Author: B <b@example.com>
Date:   Wed, 12 Nov 2026 08:00:00 +0900

    numstat commit

3\t1\tsrc/a.cs
-\t-\tassets/logo.png
`;
  const r = W.parseGitLog(txt);
  assert.deepEqual(r.errors, []);
  assert.equal(r.commits.length, 2);
  assert.equal(r.commits[0].date, "2026-11-11"); // 작성자 현지 날짜 유지 (UTC 로 바꾸지 않음)
  assert.deepEqual(r.commits[0].files, ["src/Motion/Home.cs", "src/new.cs"]);
  assert.equal(r.commits[1].date, "2026-11-12");
  assert.deepEqual(r.commits[1].files, ["src/a.cs", "assets/logo.png"]);
});

test("--oneline: 날짜가 없으면 지정한 날짜를 쓰고 안내한다", () => {
  const a = W.parseGitLog(file("git-log-oneline.txt"));
  assert.equal(a.format, "oneline");
  assert.equal(a.errors[0].code, "oneline-no-date");
  const b = W.parseGitLog(file("git-log-oneline.txt"), { defaultDate: "2026-11-16" });
  assert.deepEqual(b.errors, []);
  assert.equal(b.commits.length, 15);
  assert.equal(b.commits[0].subject, "README 설치 방법 갱신"); // (HEAD -> main) 장식 제거
});

test("깨진 파일: 몇 번째 줄인지와 이유", () => {
  const r = W.parseGitLog(file("broken.txt"));
  assert.equal(r.commits.length, 2);
  assert.deepEqual(r.errors.map((e) => [e.line, e.code]), [[3, "bad-hash"], [4, "bad-date"], [5, "relative-date"]]);
  assert.equal(W.parseGitLog("아무 글자\n그냥 메모").errors[0].code, "unknown-format");
  assert.equal(W.parseGitLog("").format, "empty");
});

test("영역 사전: 모듈 · 설비 · 현장 이슈, 이슈 번호로 묶기", () => {
  const S = SAMPLES.ko, r = W.parseGitLog(S.log);
  const wk = (id) => W.groupTopics(r.commits.filter((c) => W.isoWeek(c.date).id === id), S.config);
  const t43 = wk("2026-43").find((t) => t.key === "오토 포커스 탐색");
  assert.equal(t43.section, "비전");
  assert.deepEqual(t43.equipment, ["2호기"]);
  assert.deepEqual(t43.issues, ["FI-231"]);
  assert.equal(t43.commits.length, 2);
  const t46 = wk("2026-46");
  assert.equal(t46.length, 6);
  assert.deepEqual(t46.find((t) => t.key === "카세트 매핑").equipment, ["1호기"]);
  assert.equal(t46.find((t) => t.key === "카세트 매핑").section, "로더");
  // 다른 제목이라도 같은 이슈 번호면 한 주제
  const cfg = { ...DEFAULT_CONFIG.en, rules: DEFAULT_CONFIG.en.rules };
  const g = W.groupTopics([
    { hash: "a", date: "2026-11-10", subject: "Fix homing timeout PRJ-1042", files: [] },
    { hash: "b", date: "2026-11-11", subject: "Add homing log (PRJ-1042) on EQ-03", files: [] },
  ], cfg);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].issues, ["PRJ-1042"]);
  assert.deepEqual(g[0].equipment, ["EQ-03"]);
  assert.equal(g[0].section, "Motion"); // 파일 목록이 없으면 제목 단어(homing)로
  assert.deepEqual(W.checkDict({ ...cfg, issue: "([" }).length, 1);
});

test("검증 게이트: 예시 요약은 모두 통과, 녹화한 LLM 응답의 지어낸 숫자 · 단어는 막힘", () => {
  const expectBlocked = {
    ko: ["2026-43|오토 포커스 탐색", "2026-44|다크 테마", "2026-44|이력 검색", "2026-44|스테이지 원점 복귀", "2026-45|로그 정리",
      "2026-46|PDF 보고서", "2026-46|오토 포커스 탐색", "2026-46|레시피 파라미터 검사"],
    en: ["2026-45|Auto focus", "2026-45|Stage homing", "2026-46|Auto focus", "2026-46|Recipe check"],
  };
  for (const lang of ["ko", "en"]) {
    const S = SAMPLES[lang], r = W.parseGitLog(S.log), blocked = [];
    for (const w of W.weeksOf(r.commits)) {
      for (const t of W.groupTopics(r.commits.filter((c) => W.isoWeek(c.date).id === w.id), S.config)) {
        const m = S.memos[w.id + "|" + t.key];
        if (!m) continue;
        Object.assign(t, { why: m.why, status: m.status });
        const src = W.sourceOf(t, lang);
        assert.deepEqual(W.validate(m, src, lang), [], `${lang} 예시 ${w.id} ${t.key}`);
        const bad = W.validate(m.llm, src, lang);
        if (bad.length) { blocked.push(w.id + "|" + t.key); assert.ok(bad.every(W.isFactIssue), t.key); }
      }
    }
    assert.deepEqual(blocked, expectBlocked[lang], lang);
  }
});

test("검증 게이트: 숫자 표기 · 글자 수량 · 영어 규칙", () => {
  const src = "모델 3종 검증 · 1,200 장 · Phase 1 · 불량 상위 5개";
  const v = (line, lang = "ko") => W.validate({ title: "제목", lines: [line, "둘째 줄", "셋째 줄"] }, src, lang).map((b) => b.code + ":" + (b.token || ""));
  assert.deepEqual(v("모델 3종 · 1200 장 확인용"), ["status:확인"]);
  assert.deepEqual(v("1.5초로 줄임"), ["num:1.5"]); // 1 과 5 가 입력에 있어도 1.5 는 따로
  assert.deepEqual(v("탐색이 세 배 빨라짐"), ["numword:세 배", "effect:빨라"]);
  assert.deepEqual(v("디스크 사용 절반 수준"), ["numword:절반"]);
  assert.deepEqual(v("차세대 화면 구성"), []); // 앞이 한글이면 수량으로 보지 않음
  assert.deepEqual(v("수율 개선 기대"), ["effect:수율"]);
  assert.deepEqual(v("한 번에 묶음"), []); // 관용구
  const en = (l) => W.validate({ title: "Add retry", lines: [l, "second line", "third line"] }, "Retry homing on Tool 3", "en").map((b) => b.code + ":" + b.token);
  assert.deepEqual(en("Retry homing on Tool 3"), []);
  assert.deepEqual(en("Homing is twice as fast and verified"), ["numword:twice", "status:verified"]);
  assert.deepEqual(en("Higher throughput on Tool 3"), ["effect:throughput"]);
  // 형식 검사
  const f = (o, lang = "ko") => W.validate(o, "x", lang).map((b) => b.code);
  assert.deepEqual(f({ title: "t", lines: ["a", "b"] }), ["lines"]);
  assert.deepEqual(f({ title: "제목.", lines: ["가나다.", "가나다", "가".repeat(81)] }), ["title-period", "line-period", "line-long"]);
  assert.deepEqual(f({ title: "제목", lines: ["English only line", "가나다", "가나다"] }), ["line-hangul"]);
  assert.deepEqual(f({ title: "Title", lines: ["English only line", "b", "c"] }, "en"), []);
});

test("규칙 기반 요약은 입력 문구만 써서 사실 검증을 통과한다", () => {
  for (const lang of ["ko", "en"]) {
    const S = SAMPLES[lang], r = W.parseGitLog(S.log);
    for (const t of W.groupTopics(r.commits, S.config)) {
      const bad = W.validate(W.ruleSummary(t, lang), W.sourceOf(t, lang), lang);
      assert.ok(!bad.some(W.isFactIssue), `${lang} ${t.key}: ${bad.map((b) => b.code)}`);
    }
  }
});

test("마스킹: 메일 · IP · URL · 경로 · 지정 단어 → 자리표시자, 되돌리기", () => {
  const s = "ACME Fab 2호기 10.0.3.15 에서 hong@example.com 이 \\\\fs01\\share\\log 확인 https://wiki.example.com/x ACME";
  const m = W.mask(s, ["ACME Fab", "ACME"]);
  assert.ok(!/ACME|10\.0\.3\.15|example\.com|fs01/.test(m.text), m.text);
  assert.match(m.text, /\[M1\] 2호기/);
  assert.equal(W.unmask(m.text, m.map), s);
});

test("지난주 비교 · 메모 이어받기 · 설비/이슈 표", () => {
  const mk = (key, status, issues = [], why = "") => ({ key, status, issues, why, skip: false });
  const prev = [mk("PDF 보고서", "완료: 일별 · 예정: 주간"), mk("로그 정리", "완료: 압축"), mk("영상 뷰어", "예정: 픽셀"), mk("원점 복귀", "확인: 중", ["FI-238"], "멈춤")];
  const cur = [mk("PDF 보고서", "완료: 주간"), mk("스테이지 원점 복귀 로그", "완료: 적용", ["FI-238"]), mk("카세트 매핑", "예정: 검증", ["FI-245"])];
  const c = W.compareWeeks(prev, cur);
  assert.deepEqual(c.continued.map((x) => [x.key, x.doneNow]), [["PDF 보고서", true], ["스테이지 원점 복귀 로그", true]]);
  assert.deepEqual(c.finished.map((x) => x.key), ["로그 정리"]);
  assert.deepEqual(c.stalled.map((x) => x.key), ["영상 뷰어"]);
  assert.deepEqual(c.added.map((x) => x.key), ["카세트 매핑"]);
  assert.equal(W.carryMemos(prev, cur), 1);
  assert.equal(cur[1].why, "멈춤");
  assert.deepEqual(W.domainRows(cur).map((r) => r.id), ["FI-238", "FI-245"]);
});

test("편집: 커밋 이동 · 합치기 · 나누기", () => {
  const S = SAMPLES.ko, r = W.parseGitLog(S.log);
  const ts = W.groupTopics(r.commits.filter((c) => W.isoWeek(c.date).id === "2026-43"), S.config);
  const [csv, af, build] = ts;
  assert.ok(W.moveCommit(ts, csv.id, "f6a2d34", build.id));
  assert.equal(csv.commits.length, 2);
  assert.match(build.what, /UTF-8 BOM/);
  const merged = W.mergeTopics(ts, [af.id, build.id], S.config);
  assert.equal(ts.length, 2);
  assert.equal(merged.commits.length, 5);
  const n = W.splitTopic(ts, merged.id, ["d93b071", "0b8e7a9"], S.config);
  assert.equal(n.key, "빌드 스크립트");
  assert.equal(ts.length, 3);
  assert.equal(n.section, "도구");
});

test("Markdown 내보내기", () => {
  const S = SAMPLES.ko, r = W.parseGitLog(S.log);
  const ts = W.groupTopics(r.commits.filter((c) => W.isoWeek(c.date).id === "2026-46"), S.config);
  ts.forEach((t) => Object.assign(t, W.ruleSummary(t)));
  const md = W.toMarkdown({ project: "SpotCheck", author: "홍길동", year: 2026, week: 46, topics: ts, order: S.config.order, compare: { continued: [], finished: [], stalled: [], added: [{ key: "카세트 매핑", after: "예정" }] } });
  assert.match(md, /^# 2026년 46주차 주간 업무 보고/);
  assert.match(md, /## 비전\n/);
  assert.match(md, /\| FI-245 \| 카세트 매핑 \|/);
  assert.match(md, /\*\*새 일\*\* \(1\)/);
});
