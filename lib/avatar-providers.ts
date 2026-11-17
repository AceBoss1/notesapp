import type { Fetch } from "./ai-providers";
import { AVATAR_MODEL, AVATAR_PROMPT, AVATAR_SIZE, AvatarError, type AvatarProvider, type PhotoType } from "./avatar-maker";

// The image models behind Nana's avatar maker (lib/avatar-maker.ts). One function per provider: a photo and the prompt in, a picture
// out. `fetch` is injected, so the tests never reach a provider. Neither has been run against a real key yet (17 Nov 2026): the owner
// asked for the build to be provider-neutral and adds a key later (docs/AVATAR_MAKER.md "Before it opens").
export type AvatarConfig = { provider: AvatarProvider; key: string; model: string };
export type Photo = { bytes: Buffer; type: PhotoType };

const FAILED = "The picture couldn't be made just now. Please try again in a moment.";
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
export async function drawAvatar(f: Fetch, c: AvatarConfig, p: Photo, prompt: string = AVATAR_PROMPT): Promise<Buffer> {
  try {
    return await (c.provider === "openai" ? openai : gemini)(f, { ...c, model: c.model || AVATAR_MODEL[c.provider] }, p, prompt);
  } catch (e) {
    if (e instanceof AvatarError) throw e;
    console.error("[avatar] the image model couldn't be reached", e instanceof Error ? e.message : e);
    throw new AvatarError(FAILED, 502);
  }
}
