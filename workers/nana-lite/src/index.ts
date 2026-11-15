// Nana Lite on Cloudflare (#NotesApp v0.176.0; docs/NANA_LITE.md). A Worker in front of three small open models, each served by
// llama.cpp's OpenAI-compatible server in its own Cloudflare Container (Dockerfile.phi, Dockerfile.qwen, Dockerfile.smol):
//   phi-3.5-mini-instruct   Phi-3.5-mini-instruct, 3.8B, MIT          (the default)
//   qwen2.5-1.5b-instruct   Qwen2.5-1.5B-Instruct, 1.5B, Apache-2.0
//   smollm2-1.7b-instruct   SmolLM2-1.7B-Instruct, 1.7B, Apache-2.0
// POST /v1/chat/completions with "Authorization: Bearer <NANA_LITE_KEY>" and the usual body; "model" picks the container. GET /health
// answers ok. Nothing a student types is logged: this Worker never logs request bodies, and observability is off.
import { Container, getContainer } from "@cloudflare/containers";

// Each model's container sleeps after 30 minutes without a request and wakes on the next one (the first answer after waking waits while
// the model loads, about 10 to 30 seconds).
class LiteModel extends Container {
  defaultPort = 8080;
  sleepAfter = "30m";
  enableInternet = false; // the model is in the image; it needs nothing from outside
}
export class PhiLite extends LiteModel {}
export class QwenLite extends LiteModel {}
export class SmolLite extends LiteModel {}

interface Env {
  PHI: DurableObjectNamespace<PhiLite>;
  QWEN: DurableObjectNamespace<QwenLite>;
  SMOL: DurableObjectNamespace<SmolLite>;
  NANA_LITE_KEY: string; // npx wrangler secret put NANA_LITE_KEY (the same value as NANA_LITE_KEY on Vercel)
}

export const MODELS = ["phi-3.5-mini-instruct", "qwen2.5-1.5b-instruct", "smollm2-1.7b-instruct"] as const;
const pick = (env: Env, model: string) => (model === "qwen2.5-1.5b-instruct" ? env.QWEN : model === "smollm2-1.7b-instruct" ? env.SMOL : env.PHI);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Constant-time comparison of the bearer key.
function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") return json({ ok: true, models: MODELS });
    if (url.pathname !== "/v1/chat/completions" || req.method !== "POST") return json({ error: "Not found" }, 404);
    if (!env.NANA_LITE_KEY) return json({ error: "Nana Lite isn't configured (NANA_LITE_KEY)." }, 503);
    const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!sameKey(key, env.NANA_LITE_KEY)) return json({ error: "Unauthorised" }, 401);
    const raw = await req.text();
    if (raw.length > 64_000) return json({ error: "Too large" }, 413);
    let body: { model?: unknown; [k: string]: unknown };
    try { body = JSON.parse(raw); } catch { return json({ error: "Bad JSON" }, 400); }
    const model = typeof body.model === "string" && (MODELS as readonly string[]).includes(body.model) ? body.model : MODELS[0];
    const container = getContainer(pick(env, model), "main");
    return container.fetch(new Request("http://container/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, model, stream: false }),
    }));
  },
};
