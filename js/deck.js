// PPTX 생성 (PptxGenJS). 브라우저와 node 테스트가 같은 코드를 쓴다 — PptxGenJS 클래스는 호출하는 쪽이 넘긴다
import { weekRange, sectionGroups, contentLayout, badges, statusOf, SLIDE, domainRows } from "./core.js";

export const DEFAULT_STYLE = { accent: "C00000", font: "맑은 고딕", cover: "", footer: "", sections: true, cards: true, compare: true, domain: true };
const INK = "262626", GRAY = "7F7F7F", PALE = "F2F2F2", LINE = "BFBFBF";
const hex = (s, d) => (/^#?[0-9a-f]{6}$/i.test(String(s || "")) ? String(s).replace("#", "").toUpperCase() : d);

const TXT = {
  ko: { cover: "주간 업무 보고", end: "끝", cmp: "지난주 대비", cont: "이어진 일", fin: "끝난 일", stal: "이번 주 커밋 없음", add: "새 일",
    dom: "설비 · 현장 이슈 진척", id: "번호", topic: "주제", st: "상태", eq: "설비", week: (y, w) => `${y}년 ${w}주차`, none: "없음", common: "공통" },
  en: { cover: "Weekly status report", end: "End", cmp: "Compared with last week", cont: "Continued", fin: "Finished", stal: "No commits this week", add: "New",
    dom: "Equipment · field issues", id: "ID", topic: "Topic", st: "Status", eq: "Equipment", week: (y, w) => `${y} W${w}`, none: "none", common: "Common" },
};

// d: { topics (제외 뺀 목록), year, week, project, author, order, groupBy, compare, lang, style }
export function build(PptxGenJS, d) {
  const st = { ...DEFAULT_STYLE, ...(d.style || {}) };
  const lang = d.lang === "en" ? "en" : "ko";
  const L = TXT[lang];
  const RED = hex(st.accent, DEFAULT_STYLE.accent);
  const T = (o) => ({ fontFace: st.font || DEFAULT_STYLE.font, color: INK, margin: 0, ...o });
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = `${L.week(d.year, d.week)} ${st.cover || L.cover}`;
  const [a, b] = weekRange(d.year, d.week);
  const foot = st.footer || `${d.project || ""} · ${L.week(d.year, d.week)}`.replace(/^ · /, "");

  // 표지
  let s = pptx.addSlide();
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: 7.5, fill: { color: RED }, line: { color: RED } });
  s.addText(st.cover || L.cover, T({ x: 1.0, y: 2.3, w: 11, h: 1.0, fontSize: 40, bold: true }));
  s.addText(`${L.week(d.year, d.week)}  (${a} ~ ${b})`, T({ x: 1.0, y: 3.35, w: 11, h: 0.5, fontSize: 20, color: "595959" }));
  s.addText([d.project, d.author].filter(Boolean).join("  ·  "), T({ x: 1.0, y: 6.3, w: 11, h: 0.4, fontSize: 14, color: GRAY }));

  // 지난주 대비 (앞쪽에 한 장)
  if (st.compare && d.compare) {
    s = pptx.addSlide();
    head(s, L.cmp);
    const cols = [[L.cont, d.compare.continued, (x) => `${x.key}\n${x.before} → ${x.after}`], [L.fin, d.compare.finished, (x) => x.key],
      [L.stal, d.compare.stalled, (x) => x.key], [L.add, d.compare.added, (x) => x.key]];
    const w = (SLIDE.width - 0.3 * 3) / 4;
    cols.forEach(([name, list, f], i) => {
      const x = SLIDE.left + i * (w + 0.3);
      s.addText(`${name}  ${list.length}`, T({ x, y: 1.3, w, h: 0.45, fontSize: 15, bold: true, color: i === 0 || i === 3 ? RED : INK }));
      s.addShape(pptx.ShapeType.line, { x, y: 1.8, w, h: 0, line: { color: LINE, width: 1 } });
      const body = list.length ? list.slice(0, 8).map((it) => ({ text: f(it), options: { bullet: { indent: 12 }, paraSpaceAfter: 6 } }))
        : [{ text: L.none, options: { color: GRAY } }];
      s.addText(body, T({ x, y: 1.95, w, h: 4.8, fontSize: 12, valign: "top", lineSpacingMultiple: 1.15 }));
    });
    s.addText(foot, T({ x: SLIDE.left, y: 7.0, w: SLIDE.width, h: 0.3, fontSize: 9, color: GRAY }));
  }

  // 설비 · 현장 이슈 진척 표
  const rows = domainRows(d.topics, lang);
  if (st.domain && rows.length) {
    s = pptx.addSlide();
    head(s, L.dom);
    const hdr = [L.id, L.topic, L.eq, L.st].map((t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: RED } } }));
    s.addTable([hdr, ...rows.slice(0, 14).map((r) => [r.id, r.key, r.equipment || "-", r.status])], {
      x: SLIDE.left, y: 1.3, w: SLIDE.width, colW: [1.6, 4.2, 1.9, 4.43], fontFace: st.font, fontSize: 12, color: INK,
      border: { type: "solid", color: LINE, pt: 0.75 }, rowH: 0.38, valign: "middle",
    });
    s.addText(foot, T({ x: SLIDE.left, y: 7.0, w: SLIDE.width, h: 0.3, fontSize: 9, color: GRAY }));
  }

  // 구역 간지 + 내지
  sectionGroups(d.topics, d.order, d.groupBy, L.common).forEach(([name, items], n) => {
    if (st.sections) {
      s = pptx.addSlide();
      s.addText(String(n + 1).padStart(2, "0"), T({ x: 1.0, y: 2.6, w: 3, h: 1.2, fontSize: 60, bold: true, color: RED }));
      s.addShape(pptx.ShapeType.line, { x: 1.0, y: 3.95, w: 11.3, h: 0, line: { color: INK, width: 1.5 } });
      s.addText(name, T({ x: 1.0, y: 4.15, w: 11, h: 0.8, fontSize: 32, bold: true }));
    }
    for (const t of items) content(t);
  });

  s = pptx.addSlide();
  s.addText(L.end, T({ x: 0, y: 3.2, w: 13.333, h: 1, fontSize: 28, bold: true, align: "center", color: GRAY }));
  return pptx;

  function head(sl, title) {
    sl.addText(title, T({ x: SLIDE.left, y: 0.38, w: SLIDE.width, h: 0.62, fontSize: 22, bold: true, valign: "middle" }));
    sl.addShape(pptx.ShapeType.line, { x: SLIDE.left, y: 1.06, w: SLIDE.width, h: 0, line: { color: INK, width: 1.25 } });
  }

  function content(t) {
    const Lt = contentLayout(st.cards ? t : { ...t, steps: [] });
    const sl = pptx.addSlide();
    sl.addText(`${t.tag} ${t.title}`, T({ ...Lt.title, fontSize: 22, bold: true, valign: "middle" }));
    sl.addShape(pptx.ShapeType.line, { x: Lt.rule.x, y: Lt.rule.y, w: Lt.rule.w, h: 0, line: { color: INK, width: 1.25 } });
    sl.addText(t.lines.map((l) => ({ text: l, options: { bullet: { indent: 18 }, paraSpaceBefore: 6 } })),
      T({ ...Lt.body, fontSize: 14, valign: "top", lineSpacingMultiple: 1.25 }));
    badges(statusOf(t, lang)).forEach((bd, i) => {
      sl.addText(bd.word, T({
        shape: pptx.ShapeType.roundRect, rectRadius: 0.08,
        x: SLIDE.left + i * (Lt.badge.w + Lt.badge.gap), y: Lt.badgeY, w: Lt.badge.w, h: Lt.badge.h,
        fill: { color: bd.filled ? RED : "FFFFFF" }, line: { color: RED, width: 1.25 },
        color: bd.filled ? "FFFFFF" : RED, fontSize: 12, bold: true, align: "center", valign: "middle",
      }));
    });
    const meta = [...(t.equipment || []), ...(t.issues || [])].join("  ·  ");
    if (meta) sl.addText(meta, T({ x: 8.0, y: Lt.badgeY, w: SLIDE.left + SLIDE.width - 8.0, h: Lt.badge.h, fontSize: 12, color: GRAY, align: "right", valign: "middle" }));
    Lt.cards.forEach((c, i) => {
      sl.addText(c.text, T({
        shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x: c.x, y: c.y, w: c.w, h: c.h,
        fill: { color: PALE }, line: { color: LINE, width: 0.75 },
        fontSize: c.w < 2.2 ? 11 : 13, align: "center", valign: "middle", margin: [18, 6, 6, 6],
      }));
      sl.addText(String(i + 1), T({
        shape: pptx.ShapeType.ellipse, x: c.x + c.w / 2 - 0.22, y: c.y - 0.22, w: 0.44, h: 0.44,
        fill: { color: RED }, line: { color: RED }, color: "FFFFFF", fontSize: 12, bold: true, align: "center", valign: "middle",
      }));
      if (!c.last) sl.addShape(pptx.ShapeType.chevron, { x: c.x + c.w + 0.08, y: c.y + c.h / 2 - 0.17, w: c.gap - 0.16, h: 0.34, fill: { color: RED }, line: { color: RED } });
    });
    sl.addText(foot, T({ ...Lt.foot, fontSize: 9, color: GRAY }));
  }
}

// 사용자 양식 예시: 자리표시자가 들어간 표지 1장 + 내지 1장 (내 양식을 만들 때 참고용)
export function buildTemplateSample(PptxGenJS) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const T = (o) => ({ fontFace: DEFAULT_STYLE.font, color: INK, margin: 0, ...o });
  let s = pptx.addSlide();
  s.background = { color: "F7F7F7" };
  s.addText("{{project}} {{cover}}", T({ x: 0.8, y: 2.4, w: 11.5, h: 1, fontSize: 36, bold: true }));
  s.addText("{{week}}  ({{range}})", T({ x: 0.8, y: 3.5, w: 11.5, h: 0.5, fontSize: 18, color: "595959" }));
  s.addText("{{author}}", T({ x: 0.8, y: 6.3, w: 11.5, h: 0.4, fontSize: 14, color: GRAY }));
  s = pptx.addSlide();
  s.addText("{{tag}} {{title}}", T({ x: 0.6, y: 0.4, w: 12.1, h: 0.6, fontSize: 22, bold: true }));
  s.addText("{{section}} · {{equipment}} {{issues}}", T({ x: 0.6, y: 1.05, w: 12.1, h: 0.35, fontSize: 11, color: GRAY }));
  s.addText([{ text: "{{line1}}", options: { bullet: true } }, { text: "{{line2}}", options: { bullet: true } }, { text: "{{line3}}", options: { bullet: true } }],
    T({ x: 0.6, y: 1.6, w: 12.1, h: 2, fontSize: 16, valign: "top", lineSpacingMultiple: 1.3 }));
  s.addText("{{status}}", T({ x: 0.6, y: 3.9, w: 12.1, h: 0.4, fontSize: 13, color: "C00000", bold: true }));
  s.addText("{{steps}}", T({ x: 0.6, y: 4.6, w: 12.1, h: 0.5, fontSize: 13, color: GRAY }));
  s.addText("{{footer}}", T({ x: 0.6, y: 7.0, w: 12.1, h: 0.3, fontSize: 9, color: GRAY }));
  return pptx;
}
