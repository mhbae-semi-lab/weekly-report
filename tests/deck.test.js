import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as W from "../js/core.js";
import { build, buildTemplateSample } from "../js/deck.js";
import { fillTemplate, mergeRuns, tokensIn } from "../js/template.js";
import { SAMPLES } from "../js/sample.js";

// 브라우저와 같은 vendor 번들(PptxGenJS + JSZip)을 window 가 있는 vm 안에서 읽는다
export function loadVendor() {
  const src = fs.readFileSync(new URL("../vendor/pptxgen.bundle.js", import.meta.url), "utf8");
  const ctx = { console, setTimeout, clearTimeout, TextEncoder, TextDecoder, atob, btoa };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { PptxGenJS: ctx.PptxGenJS, JSZip: ctx.JSZip };
}
const { PptxGenJS, JSZip } = loadVendor();
const bytes = (pptx) => pptx.write({ outputType: "uint8array" }); // vm 안의 Uint8Array 그대로 (JSZip 이 같은 realm 형식만 읽음)
const slideCount = async (buf) => Object.keys((await JSZip.loadAsync(buf)).files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).length;

function week46() {
  const S = SAMPLES.ko, r = W.parseGitLog(S.log);
  const topics = W.groupTopics(r.commits.filter((c) => W.isoWeek(c.date).id === "2026-46"), S.config);
  for (const t of topics) {
    const m = S.memos["2026-46|" + t.key];
    Object.assign(t, m ? { why: m.why, status: m.status, title: m.title, lines: m.lines, steps: m.steps } : W.ruleSummary(t));
  }
  return { S, topics };
}

test("PPTX: 표지 · 지난주 대비 · 설비/이슈 · 구역 간지 · 내지 · 끝", async () => {
  const { S, topics } = week46();
  const compare = { continued: [{ key: "PDF 보고서", before: "a", after: "b" }], finished: [], stalled: [], added: [] };
  const pptx = build(PptxGenJS, { topics, year: 2026, week: 46, project: "SpotCheck", author: "홍길동", order: S.config.order, compare, lang: "ko" });
  const secs = W.sectionGroups(topics, S.config.order).length;
  const buf = await bytes(pptx);
  assert.equal(await slideCount(buf), 1 + 1 + 1 + secs + topics.length + 1);
  const zip = await JSZip.loadAsync(buf);
  const all = (await Promise.all(Object.keys(zip.files).filter((f) => /slides\/slide\d+\.xml$/.test(f)).map((f) => zip.file(f).async("string")))).join("");
  assert.match(all, /카세트 슬롯 이중 감지 알람 추가/);
  assert.match(all, /FI-245/);
  // 양식 설정: 간지 · 비교 · 표 끄기, 강조색
  const p2 = build(PptxGenJS, { topics, year: 2026, week: 46, order: S.config.order, compare, lang: "en",
    style: { sections: false, compare: false, domain: false, accent: "#1F6FEB" } });
  const b2 = await bytes(p2);
  assert.equal(await slideCount(b2), 1 + topics.length + 1);
  const z2 = await JSZip.loadAsync(b2);
  assert.match(await z2.file("ppt/slides/slide1.xml").async("string"), /1F6FEB/);
});

test("run 이 쪼개진 자리표시자를 합친다", () => {
  const xml = `<a:p><a:r><a:rPr lang="ko-KR"/><a:t>{{ti</a:t></a:r><a:r><a:rPr lang="en-US"/><a:t>tle}} 끝</a:t></a:r></a:p><a:p><a:r><a:t>그대로</a:t></a:r><a:r><a:t>둠</a:t></a:r></a:p>`;
  const m = mergeRuns(xml);
  assert.match(m, /<a:t>\{\{title\}\} 끝<\/a:t>/);
  assert.match(m, /<a:t>그대로<\/a:t>/);
  assert.deepEqual(tokensIn(xml), ["title"]);
});

test("사용자 양식 채우기: 내지를 주제 수만큼 복제하고 자리표시자를 채운다", async () => {
  const { topics } = week46();
  const tpl = await bytes(buildTemplateSample(PptxGenJS));
  const vars = { project: "SpotCheck", cover: "주간 보고", week: "2026년 46주차", range: "2026-11-09 ~ 2026-11-15", author: "홍길동 <A&B>", date: "2026-11-16", footer: "사내 배포 금지" };
  const { zip, info } = await fillTemplate(JSZip, tpl, { vars, topics });
  assert.equal(info.contentSlide, 2);
  assert.deepEqual(info.unknown, []);
  const out = await zip.generateAsync({ type: "uint8array" });
  const z = await JSZip.loadAsync(out);
  assert.equal(await slideCount(out), 1 + topics.length);
  const pres = await z.file("ppt/presentation.xml").async("string");
  assert.equal((pres.match(/<p:sldId /g) || []).length, 1 + topics.length);
  const ct = await z.file("[Content_Types].xml").async("string");
  const xs = await Promise.all(Object.keys(z.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).map((f) => z.file(f).async("string")));
  const joined = xs.join("");
  assert.ok(!/\{\{/.test(joined), "남은 자리표시자 없음");
  assert.match(joined, /홍길동 &lt;A&amp;B&gt;/); // XML 이스케이프
  for (const t of topics) assert.ok(joined.includes(t.title.replace(/&/g, "&amp;")), t.title);
  for (let i = 1; i <= 1 + topics.length; i++) assert.ok(ct.includes(`/ppt/slides/slide${i}.xml`), "content type " + i);
  await assert.rejects(fillTemplate(JSZip, await bytes(build(PptxGenJS, { topics, year: 2026, week: 46 })), { vars, topics }), /no-content-token/);
});
