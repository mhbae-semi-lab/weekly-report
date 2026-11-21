// 사용자 PPTX 양식 채우기 (JSZip). 양식 안의 {{자리표시자}} 를 채우고, 내지(내용 슬라이드)는 주제 수만큼 복제한다.
//  표지 · 기타 슬라이드: {{project}} {{cover}} {{week}} {{range}} {{author}} {{date}} {{footer}}
//  내지 (첫 번째로 {{title}} 이나 {{line1}} 이 있는 슬라이드): {{tag}} {{title}} {{line1}} {{line2}} {{line3}}
//        {{status}} {{steps}} {{section}} {{equipment}} {{issues}} + 위의 표지 자리표시자
// XML 은 문자열로 다룬다 (DOMParser 가 없는 node 테스트에서도 같은 코드가 돈다).

export const COVER_TOKENS = ["project", "cover", "week", "range", "author", "date", "footer"];
export const TOPIC_TOKENS = ["tag", "title", "line1", "line2", "line3", "status", "steps", "section", "equipment", "issues"];
const SLIDE_CT = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TOKEN = /\{\{\s*([a-z0-9]+)\s*\}\}/gi;

// PowerPoint 는 맞춤법 검사 등으로 한 단어를 여러 run 으로 쪼갠다 → 자리표시자가 있는 문단은 run 을 하나로 합친다
export function mergeRuns(xml) {
  return xml.replace(/<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g, (p) => {
    const ts = [...p.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)];
    if (ts.length < 2) return p;
    const all = ts.map((m) => m[1]).join("");
    if (!all.includes("{{")) return p;
    let i = 0;
    return p.replace(/(<a:t(?:\s[^>]*)?>)([^<]*)(<\/a:t>)/g, (_, a, __, c) => a + (i++ === 0 ? all : "") + c);
  });
}

export const tokensIn = (xml) => [...mergeRuns(xml).matchAll(TOKEN)].map((m) => m[1].toLowerCase());
const fill = (xml, vars) => mergeRuns(xml).replace(TOKEN, (m, k) => (k.toLowerCase() in vars ? esc(vars[k.toLowerCase()]) : m));

export function topicVars(t) {
  return {
    tag: t.tag, title: t.title, line1: t.lines[0], line2: t.lines[1], line3: t.lines[2], status: t.status || "",
    steps: (t.steps || []).join(" → "), section: t.section, equipment: (t.equipment || []).join(", "), issues: (t.issues || []).join(", "),
  };
}

// d: { vars: {project, cover, week, range, author, date, footer}, topics: [...] } → { zip, info }
export async function fillTemplate(JSZip, input, d) {
  const zip = await JSZip.loadAsync(input);
  const read = async (p) => { const f = zip.file(p); if (!f) throw new Error("missing:" + p); return f.async("string"); };
  const presP = "ppt/presentation.xml", relsP = "ppt/_rels/presentation.xml.rels", ctP = "[Content_Types].xml";
  let pres = await read(presP), rels = await read(relsP), ct = await read(ctP);

  const target = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = (m[0].match(/\bId="([^"]+)"/) || [])[1], tg = (m[0].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && tg) target[id] = tg;
  }
  const order = [...pres.matchAll(/<p:sldId\b[^>]*\/>/g)].map((m) => ({
    tag: m[0], id: +(m[0].match(/\bid="(\d+)"/) || [])[1], rid: (m[0].match(/\br:id="([^"]+)"/) || [])[1],
  }));
  const slides = order.map((o) => ({ ...o, path: "ppt/" + String(target[o.rid] || "").replace(/^\/?ppt\//, "").replace(/^\.\//, "") }));
  if (!slides.length) throw new Error("no-slides");

  const xmls = await Promise.all(slides.map((s) => read(s.path)));
  const tIdx = xmls.findIndex((x) => { const t = tokensIn(x); return t.includes("title") || t.includes("line1"); });
  if (tIdx < 0) throw new Error("no-content-token");
  if (!d.topics.length) throw new Error("no-topics");

  const known = new Set([...COVER_TOKENS, ...TOPIC_TOKENS]);
  const unknown = new Set(xmls.flatMap(tokensIn).filter((k) => !known.has(k)));

  // 표지 · 기타 슬라이드
  xmls.forEach((x, i) => { if (i !== tIdx) zip.file(slides[i].path, fill(x, d.vars)); });

  // 내지: 첫 주제는 양식 슬라이드 자리에, 나머지는 복제
  const tpl = slides[tIdx], tplXml = xmls[tIdx];
  const tplRelsP = tpl.path.replace(/slides\/(slide[^/]+\.xml)$/, "slides/_rels/$1.rels");
  const tplRels = zip.file(tplRelsP) ? (await zip.file(tplRelsP).async("string")).replace(/<Relationship\b[^>]*notesSlide[^>]*\/>/g, "") : null;
  zip.file(tpl.path, fill(tplXml, { ...d.vars, ...topicVars(d.topics[0]) }));

  let maxNum = Math.max(0, ...Object.keys(zip.files).map((f) => +(f.match(/^ppt\/slides\/slide(\d+)\.xml$/) || [])[1] || 0));
  let maxId = Math.max(255, ...order.map((o) => o.id));
  let after = tpl.tag, added = "";
  d.topics.slice(1).forEach((t, k) => {
    const num = ++maxNum, rid = "rIdWr" + (k + 1), path = `ppt/slides/slide${num}.xml`;
    zip.file(path, fill(tplXml, { ...d.vars, ...topicVars(t) }));
    if (tplRels) zip.file(`ppt/slides/_rels/slide${num}.xml.rels`, tplRels);
    ct = ct.replace("</Types>", `<Override PartName="/${path}" ContentType="${SLIDE_CT}"/></Types>`);
    rels = rels.replace("</Relationships>",
      `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${num}.xml"/></Relationships>`);
    added += `<p:sldId id="${++maxId}" r:id="${rid}"/>`;
  });
  pres = pres.replace(after, after + added);
  zip.file(presP, pres);
  zip.file(relsP, rels);
  zip.file(ctP, ct);
  return { zip, info: { slides: slides.length + d.topics.length - 1, contentSlide: tIdx + 1, unknown: [...unknown] } };
}
