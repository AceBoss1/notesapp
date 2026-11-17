import type { Fetch } from "./ai-providers";
import { AVATAR_MODEL, AVATAR_PROMPT, AVATAR_SIZE, AvatarError, type AvatarProvider, type PhotoType } from "./avatar-maker";

// The image models behind Nana's avatar maker (lib/avatar-maker.ts). One function per provider: a photo and the prompt in, a picture
// out. `fetch` is injected, so the tests never reach a provider. Neither has been run against a real key yet (17 Nov 2026): the owner
// asked for the build to be provider-neutral and adds a key later (docs/AVATAR_MAKER.md "Before it opens").
// account: the Cloudflare account (provider cloudflare only).
export type AvatarConfig = { provider: AvatarProvider; key: string; model: string; account?: string };
export type Photo = { bytes: Buffer; type: PhotoType };

const FAILED = "The picture couldn't be made just now. Please try again in a moment.";
const SPENT = "Nana has made all the pictures it can for today. Please try again tomorrow.";
const DECLINED = "Nana couldn't draw from that photo. Try a clear photo of just you.";
const TIMEOUT_MS = 110_000;
const b64 = (v: unknown): Buffer | null => (typeof v === "string" && v.length > 100 ? Buffer.from(v, "base64") : null);

async function readJson(res: Response, who: string): Promise<Record<string, unknown>> {
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return j;
  const msg = String((j.error as { message?: unknown } | undefined)?.message ?? "").slice(0, 200);
  console.error(`[avatar] ${who} answered ${res.status}`, msg);
  // A photo the provider's own rules turn away is the member's to change; anything else is ours.
  if (res.status === 400 && /safety|policy|moderation|not allowed|blocked/i.test(msg)) throw new AvatarError(DECLINED, 422);
  // Cloudflare's free daily allowance (neurons) used up, or a provider's own quota: tomorrow, not a fault.
  if (res.status === 429 || /neuron|daily free alloc|quota|rate limit/i.test(msg)) throw new AvatarError(SPENT, 429);
  throw new AvatarError(FAILED, 502);
}

// OpenAI: the image edits endpoint takes the photo and the prompt as a form and answers with the picture as base64.
async function openai(f: Fetch, c: AvatarConfig, p: Photo, prompt: string): Promise<Buffer> {
  const form = new FormData();
  form.set("model", c.model);
  form.set("prompt", prompt);
  form.set("size", `${AVATAR_SIZE}x${AVATAR_SIZE}`);
  form.set("image", new Blob([new Uint8Array(p.bytes)], { type: p.type }), `photo.${p.type.split("/")[1]}`);
  const res = await f("https://api.openai.com/v1/images/edits", { method: "POST", headers: { authorization: `Bearer ${c.key}` }, body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const j = await readJson(res, "OpenAI");
  const out = b64((Array.isArray(j.data) ? (j.data[0] as { b64_json?: unknown } | undefined) : undefined)?.b64_json);
  if (!out) throw new AvatarError(DECLINED, 422);
  return out;
}

// Google: generateContent with the photo inline; the picture comes back as an inline part beside any words.
async function gemini(f: Fetch, c: AvatarConfig, p: Photo, prompt: string): Promise<Buffer> {
  const res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": c.key, "content-type": "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: p.type, data: p.bytes.toString("base64") } }] }] }),
  });
  const j = await readJson(res, "Google");
  type Part = { inlineData?: { data?: unknown }; inline_data?: { data?: unknown } };
  const parts = ((Array.isArray(j.candidates) ? (j.candidates[0] as { content?: { parts?: Part[] } } | undefined) : undefined)?.content?.parts ?? []) as Part[];
  for (const part of parts) { const out = b64(part.inlineData?.data ?? part.inline_data?.data); if (out) return out; }
  throw new AvatarError(DECLINED, 422);
}

// prompt: what to draw (the avatar maker's illustration by default; the portrait studio sends its own, lib/nana-portrait.ts).
// Cloudflare Workers AI (FLUX.2): a form with the prompt and the photo as the reference picture, to
// POST /accounts/{account}/ai/run/{model}. The answer is { result: { image: base64 } } (or the bare { image }, or the picture itself).
// Cloudflare's errors come as { errors: [{ code, message }] }.
async function cloudflare(f: Fetch, c: AvatarConfig, p: Photo, prompt: string): Promise<Buffer> {
  if (!c.account) throw new AvatarError(FAILED, 502);
  const form = new FormData();
  form.set("prompt", prompt);
  form.set("input_image_0", new Blob([new Uint8Array(p.bytes)], { type: p.type }), `photo.${p.type.split("/")[1]}`);
  form.set("width", String(AVATAR_SIZE));
  form.set("height", String(AVATAR_SIZE));
  // The model is written as Cloudflare names it (@cf/…, a literal @); it comes from our own settings, so it is only checked, not encoded.
  if (!/^@?[\w.-]+(\/[\w.-]+)*$/.test(c.model) || c.model.split("/").some((seg) => /^\.+$/.test(seg))) throw new AvatarError(FAILED, 502);
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(c.account)}/ai/run/${c.model}`;
  const res = await f(url, { method: "POST", headers: { authorization: `Bearer ${c.key}` }, body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.ok && /^image\//.test(res.headers.get("content-type") ?? "")) return Buffer.from(await res.arrayBuffer());
  const j = (await res.json().catch(() => ({}))) as { result?: { image?: unknown }; image?: unknown; errors?: { message?: unknown }[] };
  if (!res.ok || (j as { success?: unknown }).success === false) {
    const msg = String(j.errors?.[0]?.message ?? "").slice(0, 200);
    console.error(`[avatar] Cloudflare answered ${res.status}`, msg);
    if (/neuron|daily free alloc|quota|rate limit|capacity/i.test(msg) || res.status === 429) throw new AvatarError(SPENT, 429);
    if (/nsfw|safety|policy|not allowed|blocked/i.test(msg)) throw new AvatarError(DECLINED, 422);
    throw new AvatarError(FAILED, 502);
  }
  const out = b64(j.result?.image ?? j.image);
  if (!out) throw new AvatarError(DECLINED, 422);
  return out;
}

export async function drawAvatar(f: Fetch, c: AvatarConfig, p: Photo, prompt: string = AVATAR_PROMPT): Promise<Buffer> {
  try {
    const draw = c.provider === "openai" ? openai : c.provider === "cloudflare" ? cloudflare : gemini;
    return await draw(f, { ...c, model: c.model || AVATAR_MODEL[c.provider] }, p, prompt);
  } catch (e) {
    if (e instanceof AvatarError) throw e;
    console.error("[avatar] the image model couldn't be reached", e instanceof Error ? e.message : e);
    throw new AvatarError(FAILED, 502);
  }
}
