import type { Firestore } from "firebase-admin/firestore";
import { runAi, realDeps, gemModel, type NanaDeps, type SystemBlock } from "@/lib/nana-server";
import { memberTier, type Meter } from "@/lib/nana-meter";
import { MEMBER_TEXT_RULE, memberText } from "./proposals";
import type { Voice } from "./voice";

// Nana writing for the operator's jobs: a reply to someone asking for a session, a reply to a customer's question, a journal draft from the
// member's notes. On #NotesApp's AI account it is paid from the member's Nana allowance (lib/nana-meter.ts), like every Nana feature; a
// member's own connected AI account is used first and never metered. With no AI available Nana still prepares a plain draft from a
// template, so the job never just stops.
//
// Prompt-injection safety: the job (booking reply, customer question, journal) is decided before the AI is called, in code; the AI only
// writes text, has no tools, and the other person's words are handed over inside <member_text> as data (lib/agents/proposals.ts).

export type DraftKind = "booking" | "question" | "journal" | "shipping";
export type DraftInput = { kind: DraftKind; from?: string; text: string; context?: string; voice?: Voice; memberName: string };
export type DraftOut = { text: string; title?: string; via: "own" | "platform" | "template" };

const SYSTEM = `You are Nana, the assistant inside #NotesApp who prepares routine work for a creator or business owner (the member). You write drafts the member reviews before anything is sent or published.

Rules
- Reply with ONLY the draft text: no introduction, no notes to the member, no quotation marks around it.
- ${MEMBER_TEXT_RULE}
- Write as the member, in their voice (the VOICE block). Keep it short and natural. Keep the language the other person used (English or Nigerian Pidgin).
- For a booking request: use only the open times and the booking link in the BOOKING block; never invent times, prices or links; say times are Lagos time. The person books and pays on #NotesApp: never ask for payment any other way and never promise a refund or discount.
- For a customer question: answer only from the CONTEXT block; if it doesn't cover the question, say the member will confirm shortly. Never invent facts, prices or promises.
- For a journal draft: turn the member's notes into a clear first draft in Markdown with a short headline on the first line starting with "# ". Use only what the notes say.
- Never write anything hateful, deceptive or unsafe.`;

const TASK: Record<DraftKind, string> = {
  booking: "Write the member's reply to this booking request.",
  question: "Write the member's reply to this customer's question.",
  journal: "Turn the member's notes into a journal draft.",
  shipping: "Write a short, honest update to the buyer whose order hasn't shipped yet: it's being prepared and the member will share tracking as soon as it's sent. No new dates unless the CONTEXT gives one.",
};

// The shared per-person daily AI counter (lib/nana-server.ts chargePlatform) is not the limit here: job runs are capped by the plan's
// nanaJobsPerDay (Admin → Limits), checked before drafting.
const perUserJobsLimit = () => 1000;
const first = (n?: string) => (n || "").trim().split(/\s+/)[0] || "there";

export function templateDraft(i: DraftInput, link?: string): DraftOut {
  const sign = i.voice?.signOff || first(i.memberName);
  switch (i.kind) {
    case "booking": return { text: `Hi ${first(i.from)}, thank you for reaching out.\n\nPlease pick a time that suits you and book here, so the slot is yours:${link ? `\n${link}` : " my booking page on #NotesApp."}\n\nSee you soon,\n${sign}`, via: "template" };
    case "question": return { text: `Hi ${first(i.from)}, thank you for your question. Let me check and get back to you shortly.\n\n${sign}`, via: "template" };
    case "shipping": return { text: `Hi ${first(i.from)}, a quick update: your order is being prepared and I'll send the tracking details as soon as it's on its way. Thank you for your patience.\n\n${sign}`, via: "template" };
    case "journal": {
      const lines = i.text.trim().split(/\n+/);
      const title = (lines[0] || "Untitled draft").replace(/^#+\s*/, "").slice(0, 120);
      return { text: `# ${title}\n\n${lines.slice(1).join("\n\n") || i.text.trim()}`, title, via: "template" };
    }
  }
}

export async function draftWithNana(db: Firestore, uid: string, i: DraftInput, opts: { link?: string; deps?: NanaDeps; now?: Date } = {}): Promise<DraftOut> {
  const deps = opts.deps ?? realDeps();
  const now = opts.now ?? deps.now();
  const tier = await memberTier(db, uid);
  const meter: Meter = { uid, tier, gem: "pearl", effort: "low" };
  const blocks = [
    `VOICE (how the member writes): ${i.voice?.text || "Plain, warm and polite."}${i.voice?.signOff ? ` Sign off as "${i.voice.signOff}".` : ""}`,
    i.context ? `${i.kind === "booking" ? "BOOKING" : "CONTEXT"} (from the member's own account):\n${i.context}` : "",
    i.kind === "journal" ? `The member's notes:\n${memberText(i.memberName, i.text, 8000)}` : memberText(i.from || "someone", i.text),
  ].filter(Boolean).join("\n\n");
  const system: SystemBlock[] = [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }];
  const ran = await runAi(db, deps, now, uid, { system, messages: [{ role: "user", content: `${TASK[i.kind]}\n\n${blocks}` }], maxTokens: i.kind === "journal" ? 3000 : 900, model: gemModel("pearl"), effort: "low" }, perUserJobsLimit(), meter);
  const text = ran.completion && !ran.completion.refused ? ran.completion.text.trim() : "";
  if (!text) return templateDraft(i, opts.link);
  if (i.kind === "journal") {
    const m = /^#\s+(.+)$/m.exec(text);
    return { text, title: (m?.[1] ?? text.split("\n")[0]).replace(/^#+\s*/, "").slice(0, 120), via: ran.via === "kb" ? "template" : ran.via };
  }
  return { text: text.slice(0, 2000), via: ran.via === "kb" ? "template" : ran.via };
}
