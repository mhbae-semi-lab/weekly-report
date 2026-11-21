// 매뉴얼용 PPTX 예시 만들기: 합성 46주차로 기본 양식 덱 + 자리표시자 양식 채우기 결과를 만든다
//   node docs/manual/make_pptx_shots.mjs <출력 폴더>
// 슬라이드 그림(PptxCover · PptxCompare · PptxDomain · PptxContent · PptxTemplate)은 PowerPoint 로 PNG 로 내보냈다:
//   $pp = New-Object -ComObject PowerPoint.Application; $p = $pp.Presentations.Open("<폴더>\deck.pptx", $true, $false, $false)
//   $p.Slides(1).Export("<폴더>\deck-1.png", "PNG", 1280, 720); ...; $p.Close(); $pp.Quit()
import fs from "node:fs";
import vm from "node:vm";

const R = new URL("../../", import.meta.url);
const W = await import(new URL("js/core.js", R));
const { build, buildTemplateSample } = await import(new URL("js/deck.js", R));
const { fillTemplate } = await import(new URL("js/template.js", R));
const { SAMPLES } = await import(new URL("js/sample.js", R));
const ctx = { console, setTimeout, clearTimeout, TextEncoder, TextDecoder, atob, btoa };
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("vendor/pptxgen.bundle.js", R), "utf8"), ctx);

const out = process.argv[2] || ".";
const S = SAMPLES.ko, r = W.parseGitLog(S.log);
const wk = (id) => W.groupTopics(r.commits.filter((c) => W.isoWeek(c.date).id === id), S.config).map((t) => {
  const m = S.memos[id + "|" + t.key];
  return Object.assign(t, m ? { why: m.why, status: m.status, title: m.title, lines: m.lines, steps: m.steps } : W.ruleSummary(t));
});
const prev = wk("2026-45"), cur = wk("2026-46").filter((t) => S.memos["2026-46|" + t.key]);
const p = build(ctx.PptxGenJS, { topics: cur, year: 2026, week: 46, project: "SpotCheck", author: "검사 SW 파트 홍길동", order: S.config.order, compare: W.compareWeeks(prev, cur), lang: "ko" });
fs.writeFileSync(out + "/deck.pptx", Buffer.from(await p.write({ outputType: "uint8array" })));
const tpl = await buildTemplateSample(ctx.PptxGenJS).write({ outputType: "uint8array" });
const vars = { project: "SpotCheck", cover: "주간 보고", week: "2026년 46주차", range: "2026-11-09 ~ 2026-11-15", author: "홍길동", date: "2026-11-16", footer: "SpotCheck" };
const { zip } = await fillTemplate(ctx.JSZip, tpl, { vars, topics: cur.map((t) => ({ ...t, status: W.statusOf(t) })) });
fs.writeFileSync(out + "/filled.pptx", Buffer.from(await zip.generateAsync({ type: "uint8array" })));
console.log("ok", cur.length, "topics");
