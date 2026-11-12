// Calling a member's own AI: Gemini, Groq, Anthropic and any OpenAI-compatible API (lib/ai-connect.ts keeps the keys).
//
// Adapted from Shortlist (github.com/vicintel/shortlist-engine, src/providers/*.js and the rate limiter in src/util.js).
// MIT License. Copyright (c) 2026 Victor Dickson. Permission is hereby granted, free of charge, to any person obtaining a copy of this
// software and associated documentation files (the "Software"), to deal in the Software without restriction, subject to the conditions
// in the full notice in THIRD_PARTY_NOTICES at the root of this repository. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
//
// Everything that touches the network takes `fetch` (and `sleep`) as arguments, so the tests never reach a real provider.

export const AI_PROVIDERS = ["gemini", "groq", "anthropic", "openai"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];
export const isAiProvider = (p: unknown): p is AiProvider => typeof p === "string" && (AI_PROVIDERS as readonly string[]).includes(p);

type Info = { label: string; free: boolean; blurb: string; keyHint: string; keyUrl: string; model: string; rpm: number; format: RegExp };
// rpm: requests a minute we allow ourselves. Free tiers are limited per minute, so their calls are spaced out to stay inside the limit;
// a paid key isn't paced. The models are the providers' own cheap, fast ones.
export const PROVIDER_INFO: Record<AiProvider, Info> = {
  gemini: { label: "Gemini", free: true, blurb: "Google AI Studio key, no card. Slower: we pace it to stay inside the free limit.", keyHint: "AIza…", keyUrl: "https://aistudio.google.com/app/apikey", model: "gemini-3.5-flash-lite", rpm: 12, format: /^[A-Za-z0-9_\-]{30,120}$/ },
  groq: { label: "Groq", free: true, blurb: "Llama, generous free tier", keyHint: "gsk_…", keyUrl: "https://console.groq.com/keys", model: "llama-3.3-70b-versatile", rpm: 25, format: /^gsk_[A-Za-z0-9]{20,200}$/ },
  anthropic: { label: "Claude (Anthropic)", free: false, blurb: "Best reasons. A paid account: you set its spending limit.", keyHint: "sk-ant-…", keyUrl: "https://console.anthropic.com/settings/keys", model: "claude-haiku-5-5", rpm: 0, format: /^sk-ant-[A-Za-z0-9_\-]{20,300}$/ },
  openai: { label: "OpenAI or any compatible API", free: false, blurb: "OpenRouter, a reachable Ollama via its URL, and others", keyHint: "Your key", keyUrl: "https://platform.openai.com/api-keys", model: "gpt-4o-mini", rpm: 0, format: /^[A-Za-z0-9_\-.:]{8,300}$/ },
};
export const OPENAI_BASE = "https://api.openai.com/v1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GROQ_BASE = "https://api.groq.com/openai/v1";
const ANTHROPIC_BASE = "https://api.anthropic.com";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export type Sleep = (ms: number) => Promise<void>;
export const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class ProviderError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}

// A free-tier OpenAI-compatible endpoint (OpenRouter's ":free" models) is paced like Groq.
export function rpmFor(provider: AiProvider, baseUrl = "", model = ""): number {
  if (provider === "openai") return /openrouter\.ai/i.test(baseUrl) && /:free$/i.test(model) ? 15 : 0;
  return PROVIDER_INFO[provider].rpm;
}

// Minimum-interval pacing, shared by every call to the same account in this server instance (Shortlist's rateLimiter). `clock` and
// `sleep` are injected so a test can check the spacing without waiting.
const pacers = new Map<string, { next: number }>();
export function pacer(id: string, rpm: number, sleep: Sleep = realSleep, clock: () => number = Date.now) {
  const interval = rpm > 0 ? 60_000 / rpm : 0;
  return async function throttle(): Promise<number> {
    if (!interval) return 0;
    const st = pacers.get(id) ?? { next: 0 };
    pacers.set(id, st);
    const now = clock();
    const at = Math.max(now, st.next);
    st.next = at + interval;
    if (at > now) await sleep(at - now);
    return at - now;
  };
}
export const resetPacers = () => pacers.clear();

const withTimeout = (ms: number): AbortSignal | undefined => (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(ms) : undefined);

async function errorText(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  let msg = "";
  try { const j = JSON.parse(body); msg = j?.error?.message || j?.error?.type || j?.message || (typeof j?.error === "string" ? j.error : ""); } catch { msg = body.slice(0, 160); }
  return `${res.status}${msg ? ` ${String(msg).replace(/\s+/g, " ").trim().slice(0, 160)}` : ` ${res.statusText || ""}`.trimEnd()}`;
}

// ---- checking a key: a free call that only lists models ----

export type CheckOpts = { baseUrl?: string; fetch?: Fetch };
export async function checkProviderKey(provider: AiProvider, apiKey: string, o: CheckOpts = {}): Promise<void> {
  const f = o.fetch ?? (fetch as Fetch);
  const req: { url: string; headers: Record<string, string> } =
    provider === "gemini" ? { url: `${GEMINI_BASE}/models?pageSize=1`, headers: { "x-goog-api-key": apiKey } }
    : provider === "groq" ? { url: `${GROQ_BASE}/models`, headers: { authorization: `Bearer ${apiKey}` } }
    : provider === "anthropic" ? { url: `${ANTHROPIC_BASE}/v1/models?limit=1`, headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } }
    : { url: `${(o.baseUrl || OPENAI_BASE).replace(/\/+$/, "")}/models`, headers: { authorization: `Bearer ${apiKey}` } };
  let res: Response;
  try { res = await f(req.url, { headers: { accept: "application/json", ...req.headers }, signal: withTimeout(15_000) }); }
  catch { throw new ProviderError("I couldn't reach it just now. Please try again in a moment.", 502); }
  if (res.ok) return;
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new ProviderError(`${PROVIDER_INFO[provider].label} didn't accept that key. Check you copied all of it, and that it hasn't been deleted.`, 400);
  if (res.status === 404 && provider === "openai") throw new ProviderError("That address didn't answer like an OpenAI-compatible API. It usually ends in /v1.", 400);
  throw new ProviderError(`I couldn't check the key just now (${await errorText(res)}). Please try again in a moment.`, 502);
}

// ---- asking for JSON ----

export type Account = { provider: AiProvider; apiKey: string; baseUrl?: string; model?: string };
export type Usage = { calls: number; waitedMs: number };
export type CompleteOpts = { fetch?: Fetch; sleep?: Sleep; clock?: () => number; maxTokens?: number; timeoutMs?: number; usage?: Usage };

// The first JSON object in a reply, even when a model wraps it in prose or a code fence.
export function parseJsonObject(text: string): Record<string, unknown> {
  const t = String(text ?? "").replace(/^```(?:json)?\s*|\s*```\s*$/g, "").trim();
  try { const v = JSON.parse(t); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch { /* look inside */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { const v = JSON.parse(t.slice(a, b + 1)); if (v && typeof v === "object") return v; } catch { /* below */ } }
  throw new ProviderError("the AI's answer wasn't the JSON we asked for");
}

export const modelOf = (a: Account) => (a.model || "").trim() || PROVIDER_INFO[a.provider].model;

// One request; a free tier's 429 or a 5xx is tried once more after a pause. Anything else throws a ProviderError carrying the provider's
// own words ("429 quota exceeded"), which the shortlist shows as it is.
export async function completeJson(acct: Account, system: string, user: string, o: CompleteOpts = {}): Promise<Record<string, unknown>> {
  const f = o.fetch ?? (fetch as Fetch);
  const sleep = o.sleep ?? realSleep;
  const model = modelOf(acct);
  const throttle = pacer(`${acct.provider}:${acct.apiKey.slice(-6)}`, rpmFor(acct.provider, acct.baseUrl, model), sleep, o.clock);
  const max = o.maxTokens ?? 1500;
  let req: { url: string; headers: Record<string, string>; body: unknown; read: (j: Record<string, unknown>) => string };
  if (acct.provider === "gemini") {
    req = {
      url: `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, headers: { "x-goog-api-key": acct.apiKey },
      body: { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: max } },
      read: (j) => {
        const c = (j.candidates as { content?: { parts?: { text?: string }[] }; finishReason?: string }[] | undefined)?.[0];
        if (!c) throw new ProviderError("no answer came back");
        if (c.finishReason && c.finishReason !== "STOP") throw new ProviderError(`the answer stopped early (${c.finishReason})`);
        return (c.content?.parts ?? []).map((p) => p.text ?? "").join("");
      },
    };
  } else if (acct.provider === "anthropic") {
    req = {
      url: `${ANTHROPIC_BASE}/v1/messages`, headers: { "x-api-key": acct.apiKey, "anthropic-version": "2023-06-01" },
      body: { model, max_tokens: max, system, messages: [{ role: "user", content: user }] },
      read: (j) => ((j.content as { type: string; text?: string }[] | undefined) ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join(""),
    };
  } else {
    const base = acct.provider === "groq" ? GROQ_BASE : (acct.baseUrl || OPENAI_BASE).replace(/\/+$/, "");
    req = {
      url: `${base}/chat/completions`, headers: { authorization: `Bearer ${acct.apiKey}` },
      body: { model, temperature: 0.2, max_tokens: max, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] },
      read: (j) => String((j.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content ?? ""),
    };
  }
  for (let attempt = 0; ; attempt++) {
    const waited = await throttle();
    if (o.usage) { o.usage.calls++; o.usage.waitedMs += waited; }
    let res: Response;
    try {
      res = await f(req.url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", ...req.headers }, body: JSON.stringify(req.body), signal: withTimeout(o.timeoutMs ?? 60_000) });
    } catch (e) {
      const why = e instanceof Error && e.name === "TimeoutError" ? "it took too long to answer" : "it couldn't be reached";
      throw new ProviderError(why);
    }
    if ((res.status === 429 || res.status >= 500) && attempt === 0) { await sleep(PROVIDER_INFO[acct.provider].free ? 4_000 : 1_500); continue; }
    if (!res.ok) throw new ProviderError(await errorText(res), res.status);
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return parseJsonObject(req.read(j));
  }
}

// Which AI Nana Jobs uses. The member's own choice when it's connected; otherwise a connected free one (Gemini, then Groq). A paid AI
// (Anthropic, or an OpenAI-compatible API) is never picked unless the member chose it.
export function pickProvider(connected: AiProvider[], chosen: unknown): AiProvider | null {
  if (isAiProvider(chosen) && connected.includes(chosen)) return chosen;
  for (const p of AI_PROVIDERS) if (PROVIDER_INFO[p].free && connected.includes(p)) return p;
  return null;
}
