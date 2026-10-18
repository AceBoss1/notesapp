import Anthropic from "@anthropic-ai/sdk";
import type { Firestore } from "firebase-admin/firestore";
import { ownKey } from "./ai-connect";
import { getArticles } from "./kb-server";
import { internalArticles } from "./kb-articles";
import { sanitizeLinks, type KbArticle } from "./kb";
import {
  NANA_HISTORY_MAX, NANA_TRANSCRIPT_MAX, NANA_USER_MAX, NanaError, cleanVisitor, parseReply, type NanaMsg,
} from "./nana";
import { kbReply } from "./nana-kb";
import { STAFF_PAGES, buildSystem, knownPaths, visitorBlock } from "./nana-prompt";
import { setting } from "@/lib/config";
import type { Effort, Gem, Usage } from "./nana-gems";
import { EFFORT_INFO, pickEffort, pickGem } from "./nana-gems";
import { memberTier, meterCharge, meterCheck, type Meter } from "./nana-meter";
import { bankDays, bankGet, bankKey, bankPut, bankQuestion } from "./nana-bank";

// The server side of Nana AI. A chat is stateless on the wire (the page sends the conversation each turn); we keep a transcript in the
// server-only collection `nanaChats` so staff can see what people ask, fill gaps in the knowledge base and follow up when someone wants a
// person.
//
// Who pays for the AI, in order: the member's own connected AI account (lib/ai-connect.ts), then #NotesApp's key (ANTHROPIC_API_KEY, bounded
// by rate limits and a daily cap). With neither, or when the AI is unavailable, out of credit, or the key is rejected, Nana answers from the
// knowledge base alone (lib/nana-kb.ts), so the chat never just stops.

export { nanaConfigured } from "./nana-config";
// The model behind each gem (lib/nana-gems.ts). NANA_MODEL is Pearl, the one everyone uses (production: claude-haiku-5-5).
export const nanaModel = () => (setting("NANA_MODEL") || "").trim() || "claude-haiku-5-5";
export const gemModel = (g: Gem) => (g === "ruby" ? (setting("NANA_MODEL_RUBY") || "").trim() || "claude-opus-5-5" : g === "emerald" ? (setting("NANA_MODEL_EMERALD") || "").trim() || "claude-sonnet-5-5" : nanaModel());
const platformKey = () => (setting("ANTHROPIC_API_KEY") || "").trim();
const dailyLimit = () => Math.max(1, Number(setting("NANA_DAILY_LIMIT")) || 1500);

export type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
export type Completion = { text: string; refused: boolean; usage?: Usage };
// model and effort come from the gem and effort the member chose; without them it's Pearl, Quick.
export type CompleteArgs = { apiKey: string; system: SystemBlock[]; messages: NanaMsg[]; maxTokens: number; model?: string; effort?: Effort };
export type NanaDeps = { complete: (a: CompleteArgs) => Promise<Completion>; now: () => Date };

// The AI could not be used right now. `kind` says why, so a rejected key or an empty balance can be told apart from a short outage.
export class AiDown extends Error {
  constructor(readonly kind: "auth" | "billing" | "busy" | "other", message = "AI unavailable") {
    super(message);
  }
}

export const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);
const realComplete: NanaDeps["complete"] = async ({ apiKey, system, messages, maxTokens, model: wanted, effort = "low" }) => {
  const client = new Anthropic({ apiKey, timeout: effort === "high" ? 110_000 : 45_000, maxRetries: 1 });
  try {
    const model = wanted || nanaModel();
    const res = await client.beta.messages.create({
      model,
      max_tokens: maxTokens, // thinking counts toward this as well as the reply
      system,
      messages,
      output_config: { effort }, // Quick for a support answer; Balanced and Thorough are for the plans that can choose them
      // If a safety classifier declines, the API re-runs the request on another model, but only on the models that offer it (not Haiku 5.5,
      // which declines outright and is Pearl).
      ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (res.stop_reason === "refusal") return { text: "", refused: true, usage: res.usage };
    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    return { text, refused: false, usage: res.usage };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new AiDown("auth", "the key was rejected");
    if (err instanceof Anthropic.APIError && err.status === 400 && /credit|billing|balance/i.test(err.message)) throw new AiDown("billing", "no credit left");
    if (err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500) || err instanceof Anthropic.APIConnectionError) throw new AiDown("busy", "busy");
    console.error("[nana] model call failed", err instanceof Error ? err.message : err);
    throw new AiDown("other");
  }
};
export const realDeps = (): NanaDeps => ({ complete: realComplete, now: () => new Date() });

// ---- who pays
export type AiSource = { source: "own" | "platform"; apiKey: string };
// The keys to try, in order: the member's own account first, then ours. Empty means the knowledge base answers.
export async function aiCandidates(db: Firestore, uid?: string): Promise<AiSource[]> {
  const out: AiSource[] = [];
  const own = uid ? await ownKey(db, uid) : null;
  if (own) out.push({ source: "own", apiKey: own });
  if (platformKey()) out.push({ source: "platform", apiKey: platformKey() });
  return out;
}

// #NotesApp's own AI is rationed: one counter for the whole day and, when we know who is asking, one for the person. A transaction keeps it exact.
export async function chargePlatform(db: Firestore, now: Date, uid: string | undefined, perUserLimit: number): Promise<boolean> {
  const day = new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);
  const all = db.collection("nanaUsage").doc(day);
  const mine = uid ? db.collection("nanaUsage").doc(`${day}_${uid}`) : null;
  return db.runTransaction(async (t) => {
    const [a, m] = await Promise.all([t.get(all), mine ? t.get(mine) : Promise.resolve(null)]);
    const n = (a.data()?.count as number | undefined) ?? 0, mn = (m?.data()?.count as number | undefined) ?? 0;
    if (n >= dailyLimit() || (mine && mn >= perUserLimit)) return false;
    t.set(all, { count: n + 1, day }, { merge: true });
    if (mine) t.set(mine, { count: mn + 1, day, uid }, { merge: true });
    return true;
  });
}

export type Via = "own" | "platform" | "kb" | "bank";
export type Ran = { completion: Completion; via: "own" | "platform"; notice?: string } | { completion: null; via: "kb"; notice?: string };

// Tries each AI source in turn; a null completion means none worked and the caller should fall back to the knowledge base.
// With a meter, calls on our account are paid from the member's allowance and then their Nana credit (lib/nana-meter.ts); a member
// with neither left gets the knowledge base and a notice saying why. Their own AI account is never metered.
export async function runAi(db: Firestore, deps: NanaDeps, now: Date, uid: string | undefined, req: Omit<CompleteArgs, "apiKey">, perUserLimit: number, meter?: Meter): Promise<Ran> {
  let notice: string | undefined;
  for (const c of await aiCandidates(db, uid)) {
    if (c.source === "platform" && meter) {
      const ok = await meterCheck(db, meter, now);
      if (!ok.ok) { notice = ok.notice; continue; }
    }
    if (c.source === "platform" && !(await chargePlatform(db, now, uid, perUserLimit))) continue; // today's allowance is used up
    try {
      const completion = await deps.complete({ ...req, apiKey: c.apiKey });
      if (c.source === "platform" && meter) await meterCharge(db, meter, completion.usage, now).catch((e) => console.error("[nana] metering failed", e instanceof Error ? e.message : e));
      return { completion, via: c.source, notice };
    } catch (err) {
      if (!(err instanceof AiDown)) throw err;
      if (c.source === "own") notice = err.kind === "billing" ? "Your connected AI account is out of credit, so I used the next best thing." : err.kind === "auth" ? "Your connected AI account didn't accept its key, so I used the next best thing. You can reconnect it on the Nana page." : undefined;
    }
  }
  return { completion: null, via: "kb", notice };
}

export type ChatInput = {
  chatId?: unknown; name?: unknown; email?: unknown; messages?: unknown; page?: unknown;
  signedIn?: { uid: string; name: string; email: string } | null; // from the verified sign-in, never from the request body
  hubContext?: string; // staff only: what the team hub knows about this person, built by the server after checking they are staff
  gem?: unknown; effort?: unknown; // what the member chose; brought down to what their plan allows (lib/nana-gems.ts)
};
export type ChatResult = { reply: string; chatId: string; handoff: boolean; gap: boolean; mode: "ai" | "kb"; via: Via; notice?: string; gem?: Gem; effort?: Effort };

export function cleanMessages(raw: unknown): NanaMsg[] {
  if (!Array.isArray(raw) || !raw.length) throw new NanaError("Type a message and I'll help.");
  const msgs: NanaMsg[] = [];
  for (const m of raw.slice(-NANA_HISTORY_MAX)) {
    const role = (m as NanaMsg)?.role, content = String((m as NanaMsg)?.content ?? "").replace(/\u0000/g, "").trim();
    if ((role !== "user" && role !== "assistant") || !content) continue;
    msgs.push({ role, content: content.slice(0, role === "user" ? NANA_USER_MAX : 4000) });
  }
  while (msgs.length && msgs[0].role !== "user") msgs.shift(); // the model needs to start with the person
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") throw new NanaError("Type a message and I'll help.");
  const last = (raw[raw.length - 1] as NanaMsg)?.content;
  if (String(last ?? "").length > NANA_USER_MAX) throw new NanaError(`Could you keep that under ${NANA_USER_MAX} characters? You can send it in parts.`);
  return msgs;
}

const perUserChatLimit = () => Math.max(1, Number(setting("NANA_CHAT_PER_USER_DAILY")) || 100);

// One turn of the conversation.
export async function chat(db: Firestore, input: ChatInput, deps: NanaDeps = realDeps()): Promise<ChatResult> {
  const now = deps.now();
  const who = input.signedIn
    ? { name: input.signedIn.name || "there", email: input.signedIn.email, uid: input.signedIn.uid }
    : { ...cleanVisitor({ name: input.name, email: input.email }), uid: undefined as string | undefined };
  const messages = cleanMessages(input.messages);
  const asked = String(messages[messages.length - 1].content);

  const articles: KbArticle[] = await getArticles(db, now.getTime());
  const page = typeof input.page === "string" && /^\/[A-Za-z0-9\-._~/]{0,120}$/.test(input.page) ? input.page : undefined;
  const staffKb = input.hubContext !== undefined ? internalArticles() : [];
  const hub = input.hubContext !== undefined;
  // Members choose a gem and effort within their plan; visitors and the team hub use Pearl, Quick. The hub is staff work, so it isn't
  // taken from anyone's allowance (the daily caps still apply).
  const tier = who.uid ? await memberTier(db, who.uid) : "standard";
  const gem = who.uid && !hub ? pickGem(tier, input.gem) : "pearl";
  const effort = who.uid && !hub ? pickEffort(tier, input.effort) : "low";
  const meter: Meter | undefined = hub ? undefined : { uid: who.uid, tier, gem, effort };
  const helpCentre = buildSystem(articles);
  // A general first question may already be in the answer bank (lib/nana-bank.ts); if not, it's answered without the person's name or
  // page so the answer suits the next person too.
  const bankQ = !hub && bankDays() > 0 ? bankQuestion(messages) : null;
  const key = bankQ ? bankKey(bankQ, !!who.uid, helpCentre) : null;
  const banked = key ? await bankGet(db, key, gem, now).catch(() => null) : null;
  const system: SystemBlock[] = [
    { type: "text", text: helpCentre, cache_control: { type: "ephemeral" } },
    ...(staffKb.length ? [{ type: "text" as const, text: `TEAM-ONLY KNOWLEDGE (you are talking with a #NotesApp staff member inside the team hub; use this for questions about the hub and admin tools, and never tell anyone else about it):\n\n${staffKb.map((a) => `### ${a.title}\nPage: ${a.slug}\n${a.body}`).join("\n\n")}`, cache_control: { type: "ephemeral" as const } }] : []),
    { type: "text", text: visitorBlock(key ? { name: "there", signedIn: !!who.uid } : { name: who.name, signedIn: !!who.uid, page }) + (input.hubContext ? `\n\n${input.hubContext}` : "") },
  ];

  const ran: Ran = banked
    ? { completion: { text: banked, refused: false }, via: "platform" }
    : await runAi(db, deps, now, who.uid, { system, messages, maxTokens: EFFORT_INFO[effort].chatTokens, model: gemModel(gem), effort }, perUserChatLimit(), meter);
  let parsed: { text: string; handoff: boolean; gap: boolean };
  let via: Via = banked ? "bank" : ran.via;
  if (ran.completion) {
    parsed = parseReply(ran.completion.refused || !ran.completion.text ? "I'm sorry, I can't help with that one. The team can, though: please use the contact page. [[GAP]]" : ran.completion.text);
  } else {
    const k = kbReply([...articles, ...staffKb], asked, who.name, messages);
    parsed = { text: k.text, handoff: k.handoff, gap: k.gap };
    via = "kb";
  }
  const paths = knownPaths(articles);
  if (staffKb.length) for (const p of STAFF_PAGES) paths.add(p); // inside the hub, Nana may link to the admin pages she explains
  const reply = sanitizeLinks(parsed.text, paths) || "Sorry, I didn't catch that. Could you say it another way?";
  // A fresh AI answer to a general question goes in the bank (not a refusal, a hand-off or a gap in the help centre).
  if (key && bankQ && !banked && ran.completion && !ran.completion.refused && ran.completion.text && !parsed.handoff && !parsed.gap) {
    await bankPut(db, key, bankQ, ran.completion.text, gem, !!who.uid, now).catch((e) => console.error("[nana] bank write failed", e instanceof Error ? e.message : e));
  }

  // Save the transcript (the same chat continues when the page sends back its id and it belongs to this person).
  const asId = typeof input.chatId === "string" && /^[A-Za-z0-9]{10,40}$/.test(input.chatId) ? input.chatId : null;
  const prev = asId ? (await db.collection("nanaChats").doc(asId).get()).data() : undefined;
  const mine = prev && ((who.uid && prev.uid === who.uid) || (!who.uid && !prev.uid && prev.email === who.email));
  // Someone else's chat id (or an unknown one) never overwrites a chat: it starts a fresh one.
  const ref = asId && (mine || !prev) ? db.collection("nanaChats").doc(asId) : db.collection("nanaChats").doc();
  const base = mine ? prev! : { startedAt: now.toISOString(), name: who.name, email: who.email, ...(who.uid ? { uid: who.uid } : {}), handoff: false, gap: false, count: 0, transcript: [] as unknown[] };
  const transcript = [...((base.transcript as { role: string; text: string; at: string }[]) ?? []), { role: "user", text: asked, at: now.toISOString() }, { role: "assistant", text: reply, at: now.toISOString() }].slice(-NANA_TRANSCRIPT_MAX);
  const firstHandoff = parsed.handoff && !base.handoff;
  await ref.set({
    ...base, name: who.name, email: who.email, lastAt: now.toISOString(), count: (Number(base.count) || 0) + 1, transcript,
    handoff: !!base.handoff || parsed.handoff, gap: !!base.gap || parsed.gap, lastVia: via, ...(page ? { page } : {}),
    ...(input.hubContext !== undefined ? { hub: true } : {}),
    ...(parsed.gap ? { lastGapQuestion: asked.slice(0, 300) } : {}),
  });
  // Someone asked for a person: it lands in the Leads inbox the support team already works from.
  if (firstHandoff) {
    await db.collection("leads").add({
      name: who.name, email: who.email, category: "support", status: "new", createdAt: now.toISOString(),
      message: `From a Nana AI chat. They asked for a person, or Nana thought a person should follow up.\n\nTheir last message: ${asked.slice(0, 500)}\n\nThe whole chat is under Admin → Help & Nana → Chats (chat ${ref.id}).`,
    });
  }
  const notice = banked ? "⚡ Instant answer from Nana's answer bank: free, nothing taken from your allowance." : ran.notice;
  return { reply, chatId: ref.id, handoff: parsed.handoff, gap: parsed.gap, mode: ran.completion ? "ai" : "kb", via, ...(notice ? { notice } : {}), ...(meter && who.uid ? { gem, effort } : {}) };
}
