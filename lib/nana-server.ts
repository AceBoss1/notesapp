import Anthropic from "@anthropic-ai/sdk";
import type { Firestore } from "firebase-admin/firestore";
import { getArticles } from "./kb-server";
import { sanitizeLinks } from "./kb";
import {
  NANA_HISTORY_MAX, NANA_TRANSCRIPT_MAX, NANA_USER_MAX, NanaError, cleanVisitor, parseReply, type NanaMsg,
} from "./nana";
import { buildSystem, knownPaths, visitorBlock } from "./nana-prompt";

// The server side of Nana AI. A chat is stateless on the wire (the page sends the conversation each turn); we keep a transcript in the
// server-only collection `nanaChats` so staff can see what people ask, fill gaps in the knowledge base and follow up when someone wants a
// person. Cost is bounded by rate limits (in the route), short messages, a short history, and a daily cap (NANA_DAILY_LIMIT).

export { nanaConfigured } from "./nana-config";
// Claude Opus 5.5 is the default; set NANA_MODEL (for example claude-haiku-5-5 or claude-sonnet-5-5) to trade some quality for cost.
export const nanaModel = () => (process.env.NANA_MODEL || "").trim() || "claude-opus-5-5";
const dailyLimit = () => Math.max(1, Number(process.env.NANA_DAILY_LIMIT) || 1500);

type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
export type Completion = { text: string; refused: boolean };
export type NanaDeps = {
  complete: (system: SystemBlock[], messages: NanaMsg[]) => Promise<Completion>;
  now: () => Date;
};

let client: Anthropic | null = null;
const realComplete: NanaDeps["complete"] = async (system, messages) => {
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 }); // key from ANTHROPIC_API_KEY
  try {
    const res = await client.beta.messages.create({
      model: nanaModel(),
      max_tokens: 2000, // thinking counts toward this as well as the reply
      system,
      messages,
      output_config: { effort: "low" }, // a support answer should be quick; thinking depth is the speed and cost control on this model
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // if a safety classifier declines, the API re-runs the request on another model
    });
    if (res.stop_reason === "refusal") return { text: "", refused: true };
    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    return { text, refused: false };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500)) throw new NanaError("I'm a bit busy right now. Please try again in a minute, or use the contact page and the team will help.", 503);
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error("[nana] the AI key was rejected");
      throw new NanaError("Nana isn't available right now. Please use the contact page.", 503);
    }
    console.error("[nana] model call failed", err instanceof Error ? err.message : err);
    throw new NanaError("Something went wrong on my side. Please try again, or use the contact page.", 502);
  }
};
const realDeps = (): NanaDeps => ({ complete: realComplete, now: () => new Date() });

export type ChatInput = {
  chatId?: unknown; name?: unknown; email?: unknown; messages?: unknown; page?: unknown;
  signedIn?: { uid: string; name: string; email: string } | null; // from the verified sign-in, never from the request body
};
export type ChatResult = { reply: string; chatId: string; handoff: boolean; gap: boolean };

function cleanMessages(raw: unknown): NanaMsg[] {
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

// One turn of the conversation.
export async function chat(db: Firestore, input: ChatInput, deps: NanaDeps = realDeps()): Promise<ChatResult> {
  const now = deps.now();
  const who = input.signedIn
    ? { name: input.signedIn.name || "there", email: input.signedIn.email, uid: input.signedIn.uid }
    : { ...cleanVisitor({ name: input.name, email: input.email }), uid: undefined as string | undefined };
  const messages = cleanMessages(input.messages);

  // The daily cap: a counter per Lagos-day, bumped in a transaction.
  const day = new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);
  const usage = db.collection("nanaUsage").doc(day);
  const over = await db.runTransaction(async (t) => {
    const n = ((await t.get(usage)).data()?.count as number | undefined) ?? 0;
    if (n >= dailyLimit()) return true;
    t.set(usage, { count: n + 1, day }, { merge: true });
    return false;
  });
  if (over) throw new NanaError("I've answered a lot of questions today and need a rest. Please use the contact page and the team will get back to you.", 503);

  const articles = await getArticles(db, now.getTime());
  const page = typeof input.page === "string" && /^\/[A-Za-z0-9\-._~/]{0,120}$/.test(input.page) ? input.page : undefined;
  const system: SystemBlock[] = [
    { type: "text", text: buildSystem(articles), cache_control: { type: "ephemeral" } },
    { type: "text", text: visitorBlock({ name: who.name, signedIn: !!who.uid, page }) },
  ];
  const out = await deps.complete(system, messages);
  const parsed = parseReply(out.refused || !out.text ? "I'm sorry, I can't help with that one. The team can, though: please use the contact page. [[GAP]]" : out.text);
  const reply = sanitizeLinks(parsed.text, knownPaths(articles)) || "Sorry, I didn't catch that. Could you say it another way?";

  // Save the transcript (the same chat continues when the page sends back its id and it belongs to this person).
  const asked = String(messages[messages.length - 1].content);
  const asId = typeof input.chatId === "string" && /^[A-Za-z0-9]{10,40}$/.test(input.chatId) ? input.chatId : null;
  const prev = asId ? (await db.collection("nanaChats").doc(asId).get()).data() : undefined;
  const mine = prev && ((who.uid && prev.uid === who.uid) || (!who.uid && !prev.uid && prev.email === who.email));
  // Someone else's chat id (or an unknown one) never overwrites a chat: it starts a fresh one.
  const ref = asId && (mine || !prev) ? db.collection("nanaChats").doc(asId) : db.collection("nanaChats").doc();
  const base = mine ? prev! : { startedAt: now.toISOString(), name: who.name, email: who.email, ...(who.uid ? { uid: who.uid } : {}), handoff: false, gap: false, count: 0, transcript: [] as unknown[] };
  const chatDoc = ref.id;
  const transcript = [...((base.transcript as { role: string; text: string; at: string }[]) ?? []), { role: "user", text: asked, at: now.toISOString() }, { role: "assistant", text: reply, at: now.toISOString() }].slice(-NANA_TRANSCRIPT_MAX);
  const firstHandoff = parsed.handoff && !base.handoff;
  await ref.set({
    ...base, name: who.name, email: who.email, lastAt: now.toISOString(), count: (Number(base.count) || 0) + 1, transcript,
    handoff: !!base.handoff || parsed.handoff, gap: !!base.gap || parsed.gap, ...(page ? { page } : {}),
    ...(parsed.gap ? { lastGapQuestion: asked.slice(0, 300) } : {}),
  });
  // Someone asked for a person: it lands in the Leads inbox the support team already works from.
  if (firstHandoff) {
    await db.collection("leads").add({
      name: who.name, email: who.email, category: "support", status: "new", createdAt: now.toISOString(),
      message: `From a Nana AI chat. They asked for a person, or Nana thought a person should follow up.\n\nTheir last message: ${asked.slice(0, 500)}\n\nThe whole chat is under Admin → Help & Nana → Chats (chat ${chatDoc}).`,
    });
  }
  return { reply, chatId: chatDoc, handoff: parsed.handoff, gap: parsed.gap };
}
