// LLM 호출: Anthropic(방문자 본인 키, 브라우저 직접) 또는 로컬 Ollama. 결과는 항상 core.validate 로 검증한다
import { SYSTEM, prompt, OUTPUT_SCHEMA, cleanLlm, mask, unmask, validate, sourceOf, issueMsg } from "./core.js";

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", fallbacks: true },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", fallbacks: true },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", fallbacks: false },
];

let sdk = null;
async function loadSdk() {
  if (!sdk) sdk = await import("../vendor/anthropic-sdk.mjs"); // 저장소 안에 둔 SDK 번들 (CDN 없음)
  return sdk;
}

export class LlmError extends Error {
  constructor(code, msg, fatal = false) { super(msg || code); this.code = code; this.fatal = fatal; }
}

function mapSdkError(e) {
  if (!sdk) return new LlmError("net", e.message);
  if (e instanceof sdk.APIUserAbortError) return new LlmError("abort", "", true);
  if (e instanceof sdk.APIConnectionTimeoutError) return new LlmError("timeout");
  if (e instanceof sdk.AuthenticationError) return new LlmError("auth", "", true);
  if (e instanceof sdk.PermissionDeniedError) return new LlmError("perm", "", true);
  if (e instanceof sdk.RateLimitError) return new LlmError("rate");
  if (e instanceof sdk.BadRequestError) return new LlmError("bad", e.message);
  if (e instanceof sdk.APIConnectionError) return new LlmError("net", e.message);
  if (e instanceof sdk.APIError) return new LlmError("bad", `${e.status ?? "?"} ${e.message}`);
  return new LlmError("net", e.message || String(e));
}

// stream:true 로 받아 조각을 모은다. stream:false 는 답을 다 만든 뒤에야 응답 헤더가 와서,
// 수 분 걸리는 모델(bonsai-2.5:27b)은 시간 제한 설정과 상관없이 응답 헤더 대기 제한(Node fetch 300초 등)에 먼저 끊긴다
async function readOllamaStream(res) {
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "", content = "", model = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += value;
    const lines = buf.split("\n");
    buf = done ? "" : lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      const j = JSON.parse(line);
      if (j.error) throw new LlmError("ollama", j.error, true);
      content += j.message?.content || "";
      model = j.model || model;
    }
    if (done) return { content, model };
  }
}

// cfg: { provider, apiKey, model, ollamaUrl, ollamaModel, timeout(초) }, signal: AbortSignal
async function callOnce(cfg, sys, user, signal) {
  if (cfg.provider === "ollama") {
    const tm = AbortSignal.timeout((cfg.timeout || 600) * 1000);
    try {
      const res = await fetch(String(cfg.ollamaUrl || "http://localhost:11434").replace(/\/$/, "") + "/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        signal: AbortSignal.any([signal, tm]),
        body: JSON.stringify({ model: cfg.ollamaModel || "bonsai-2.5:27b", stream: true, think: false, format: OUTPUT_SCHEMA, options: { temperature: 0 },
          messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
      });
      if (!res.ok) throw new LlmError("ollama", res.status + " " + (await res.text()).slice(0, 200), true);
      const j = await readOllamaStream(res);
      return { text: j.content, model: "ollama:" + (j.model || cfg.ollamaModel) };
    } catch (e) {
      if (e instanceof LlmError) throw e;
      if (signal.aborted) throw new LlmError("abort", "", true);
      if (tm.aborted) throw new LlmError("timeout");
      throw new LlmError("ollama", e.message, true);
    }
  }
  const { default: Anthropic } = await loadSdk();
  const m = MODELS.find((x) => x.id === cfg.model) || MODELS[0];
  const client = new Anthropic({ apiKey: cfg.apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 }); // 키는 메모리에만, 서버 없음
  const params = {
    model: m.id, max_tokens: 4000, system: sys,
    messages: [{ role: "user", content: user }],
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
  };
  const opt = { signal, timeout: (cfg.timeout || 600) * 1000 };
  let res;
  try {
    // Opus 5.5 · Sonnet 5.5: 안전 분류기가 거절하면 서버가 다른 모델로 이어서 처리 (Haiku 5.5 는 미지원)
    res = m.fallbacks
      ? await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }, opt)
      : await client.messages.create(params, opt);
  } catch (e) { throw mapSdkError(e); }
  if (res.stop_reason === "refusal") throw new LlmError("refusal");
  if (res.stop_reason === "max_tokens") throw new LlmError("cut");
  return { text: res.content.filter((b) => b.type === "text").map((b) => b.text).join(""), model: res.model };
}

// 생성 → 검증 → 실패하면 이유를 알려 1회 재시도. 결과: { title, lines, issues, model, attempts:[…] }
export async function generate(cfg, t, lang, signal, retryText) {
  const src = sourceOf(t, lang);
  const words = cfg.maskWords || [];
  const attempts = [];
  let note = "", last = null;
  for (let i = 1; i <= 2; i++) {
    const req = mask(prompt(t, lang, note), words);
    let out;
    try {
      const r = await callOnce(cfg, SYSTEM[lang] || SYSTEM.ko, req.text, signal);
      let j;
      try { j = JSON.parse(r.text); } catch { throw new LlmError("json"); }
      const c = cleanLlm(j);
      out = { title: unmask(c.title, req.map), lines: c.lines.map((l) => unmask(l, req.map)), model: r.model };
    } catch (e) {
      const err = e instanceof LlmError ? e : new LlmError("net", e.message);
      attempts.push({ i, error: err.code, msg: err.message });
      if (err.fatal) throw Object.assign(err, { attempts });
      continue;
    }
    const issues = validate(out, src, lang);
    attempts.push({ i, issues, title: out.title, lines: out.lines });
    last = { ...out, issues, attempts };
    if (!issues.length) return last;
    note = retryText(issues.map((b) => issueMsg(b, lang)).join("; "));
  }
  if (last) return last;
  const e = new LlmError(attempts.at(-1)?.error || "net", attempts.at(-1)?.msg);
  throw Object.assign(e, { attempts });
}

// 보내기 전 미리보기용: 첫 주제의 실제 요청 (가린 뒤)
export const previewRequest = (cfg, t, lang) => mask(prompt(t, lang), cfg.maskWords || []).text;
