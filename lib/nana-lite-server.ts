// Nana Lite on the server (lib/nana-lite.ts, docs/NANA_LITE.md): asks our own small-model server (OpenAI-compatible chat API) to explain
// an Exam Prep question a student is working on. Only questions the student may already see (free, or in a pack they have) can be
// explained. Nothing the student types is stored: we keep a per-day counter (for the daily limit) and the daily total (prepStats).
import type { Firestore } from "firebase-admin/firestore";
import { createHash } from "crypto";
import { setting } from "./config";
import { OPTION_KEYS, toStudent, type OptionKey, type Question } from "./exam-prep";
import { PrepError, bump, hasAccess } from "./exam-prep-server";
import { DEFAULT_LITE_MODEL, LITE_DAILY_PER_STUDENT, LITE_MAX_TOKENS, resolveLiteModel, cleanFollowUp, explainPrompt, isLiteLang, liteSystem, type LiteLang } from "./nana-lite";

export type LiteCall = (a: { system: string; user: string; maxTokens: number }) => Promise<{ text: string; ms: number }>;

export const liteConfigured = () => !!setting("NANA_LITE_URL");
export function liteModel(): string {
  return resolveLiteModel(setting("NANA_LITE_MODEL") || "") ?? DEFAULT_LITE_MODEL;
}

// The real call: POST {base}/v1/chat/completions. 25 seconds at most (a small model on a CPU server answers in a few).
export const liveLite: LiteCall = async ({ system, user, maxTokens }) => {
  const base = (setting("NANA_LITE_URL") || "").replace(/\/+$/, "");
  if (!base) throw new PrepError("Nana Lite isn't switched on yet.", 503);
  const key = setting("NANA_LITE_KEY");
  const started = Date.now();
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model: liteModel(), messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: maxTokens, temperature: 0.3 }),
    signal: AbortSignal.timeout(25_000),
  }).catch(() => null);
  if (!res || !res.ok) throw new PrepError("Nana Lite is busy right now. Read the explanation, and try again in a minute.", 503);
  const j = await res.json().catch(() => ({}));
  const text = String(j?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new PrepError("Nana Lite didn't answer. Try again in a minute.", 503);
  return { text, ms: Date.now() - started };
};

const day = (now: Date) => now.toISOString().slice(0, 10);
// The daily-limit key: the account, or a hash of the device's address when signed out (never the address itself).
export const limitKey = (uid: string | null, ip: string) => (uid ? `u_${uid}` : `ip_${createHash("sha256").update(ip).digest("hex").slice(0, 24)}`);

export async function explain(
  db: Firestore,
  who: { uid: string | null; ip: string },
  input: { questionId?: unknown; chosen?: unknown; followUp?: unknown; lang?: unknown },
  call: LiteCall = liveLite,
  now = new Date(),
): Promise<{ text: string; model: string }> {
  const qid = String(input.questionId ?? "").replace(/\//g, "");
  if (!qid) throw new PrepError("Which question?");
  const q = (await db.doc(`prepQuestions/${qid}`).get()).data() as Question | undefined;
  if (!q || q.status !== "published") throw new PrepError("That question isn't available.", 404);
  if (q.access === "pack" && !(await hasAccess(db, who.uid, q.exam, now))) throw new PrepError("This question is in the full pack. Get the pack to ask Nana Lite about it.", 403);
  const chosen = OPTION_KEYS.includes(input.chosen as OptionKey) ? (input.chosen as OptionKey) : null;
  const lang: LiteLang = isLiteLang(input.lang) ? input.lang : "en";
  const followUp = cleanFollowUp(input.followUp);
  // The daily limit, counted before the call so a flood can't run up the server.
  const ref = db.doc(`prepLiteDaily/${limitKey(who.uid, who.ip)}_${day(now)}`);
  const used = await db.runTransaction(async (t) => {
    const n = Number((await t.get(ref)).data()?.n ?? 0);
    if (n >= LITE_DAILY_PER_STUDENT) return -1;
    t.set(ref, { n: n + 1, day: day(now), expireAt: new Date(now.getTime() + 2 * 86_400_000) }, { merge: true });
    return n + 1;
  });
  if (used < 0) throw new PrepError(`You've asked Nana Lite ${LITE_DAILY_PER_STUDENT} times today. Come back tomorrow, or read the explanations.`, 429);
  const out = await call({ system: liteSystem(lang), user: explainPrompt(toStudent(q), chosen, followUp), maxTokens: LITE_MAX_TOKENS });
  await bump(db, "liteAsks", 1, now);
  return { text: out.text.slice(0, 1500), model: liteModel() };
}

