import { createHash } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { setting } from "@/lib/config";
import { gemRank, isGem, type Gem } from "./nana-gems";
import type { NanaMsg } from "./nana";

// Nana's answer bank: when someone opens a chat with a general question about #NotesApp ("How do I get paid?"), the answer is kept for a
// few days (NANA_BANK_DAYS, default 7) and the next person who asks the same thing gets it straight away, free: no AI call, nothing
// taken from their allowance, even when it has run out.
//
// Only general questions go in. The question must be the first in the chat (no earlier conversation to depend on), asked outside the
// team hub, short, and free of anything that looks personal: email addresses, links, @usernames, phone, order or reference numbers,
// or names. Such answers are written without the person's name or the page they're on, so they suit anyone. Answers are keyed by the
// question, whether the asker is signed in, and the help centre's current text, so editing a help article retires the old answers.
// An answer from a dearer gem is never replaced by a cheaper one, and a cheaper answer is never given to someone who chose a dearer gem.
//
//   nanaBank/{key} → { q, a, gem, member, hits, createdAt, expireAt }   (server only; set a Firestore TTL policy on expireAt)

export const bankDays = () => {
  const v = setting("NANA_BANK_DAYS");
  const n = v === undefined || v === "" ? 7 : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(90, n)) : 7;
};

// Words that may start with a capital without being someone's name.
const KNOWN = new Set(["i", "notesapp", "nana", "ai", "paystack", "paylony", "linkedin", "x", "twitter", "facebook", "instagram", "whatsapp", "tiktok", "youtube", "google", "apple", "android", "iphone", "pro", "business", "enterprise", "basic", "free", "standard", "pearl", "emerald", "ruby", "academy", "market", "journals", "journal", "mcp", "api", "nigeria", "naira", "lagos", "abuja", "boost", "gold", "verified", "pdf", "faq", "notes", "life", "how", "what", "why", "when", "where", "who", "which", "can", "do", "does", "is", "are", "will", "should", "could", "would", "hi", "hello", "hey", "please", "thanks", "ok", "okay"]);
const PERSONAL = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email
  /https?:\/\/|www\.|\.[a-z]{2,}\//i, // links
  /(^|\s)@[a-z0-9_.-]{2,}/i, // usernames
  /\d[\d\s-]{3,}\d/, // phone, order and reference numbers
  /\b[A-Z]{2,}-?\d{3,}\b/, // codes like NA-12345
];

// The normalised question, or null when this turn shouldn't use the bank.
export function bankQuestion(messages: NanaMsg[]): string | null {
  if (messages.length !== 1 || messages[0].role !== "user") return null;
  const q = String(messages[0].content).trim();
  if (q.length < 8 || q.length > 240 || q.split(/\s+/).length > 30) return null;
  if (PERSONAL.some((r) => r.test(q))) return null;
  if (/\b(this page|on here|this one|above|below)\b/i.test(q)) return null; // depends on where they are
  // A capitalised word mid-sentence that isn't one of ours is probably a name.
  const words = q.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^\p{L}'-]/gu, "");
    if (/^\p{Lu}/u.test(w) && !/[.!?]$/.test(words[i - 1]) && !KNOWN.has(w.toLowerCase())) return null;
  }
  const norm = q.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(hi|hello|hey|good (morning|afternoon|evening))( nana)?\s+/, "").replace(/^please\s+/, "").replace(/\s+(please|thanks|thank you)$/, "");
  return norm.length >= 6 ? norm : null;
}

export const bankKey = (question: string, member: boolean, helpCentre: string) =>
  createHash("sha256").update(`${member ? "m" : "v"}|${createHash("sha256").update(helpCentre).digest("hex")}|${question}`).digest("hex").slice(0, 40);

export async function bankGet(db: Firestore, key: string, gem: Gem, now: Date): Promise<string | null> {
  const ref = db.collection("nanaBank").doc(key);
  const d = (await ref.get()).data();
  const expires = d?.expireAt?.toDate?.() as Date | undefined;
  if (!d || typeof d.a !== "string" || !expires || expires <= now) return null;
  if (!isGem(d.gem) || gemRank(d.gem) < gemRank(gem)) return null;
  ref.update({ hits: FieldValue.increment(1), lastHitAt: now.toISOString() }).catch(() => {});
  return d.a;
}

export async function bankPut(db: Firestore, key: string, question: string, answer: string, gem: Gem, member: boolean, now: Date): Promise<void> {
  const days = bankDays();
  if (!days || !answer.trim()) return;
  const ref = db.collection("nanaBank").doc(key);
  await db.runTransaction(async (t) => {
    const d = (await t.get(ref)).data();
    const live = d && d.expireAt?.toDate?.() > now;
    if (live && isGem(d.gem) && gemRank(d.gem) > gemRank(gem)) return;
    t.set(ref, { q: question, a: answer, gem, member, hits: live ? d.hits ?? 0 : 0, createdAt: now.toISOString(), expireAt: new Date(now.getTime() + days * 86_400_000) });
  });
}

// For Admin → Maintenance: how big the bank is, the most asked, and a way to empty it.
export async function bankStats(db: Firestore, now: Date): Promise<{ answers: number; hits: number; top: { q: string; hits: number; gem: string }[] }> {
  const s = await db.collection("nanaBank").where("expireAt", ">", now).get();
  const rows = s.docs.map((d) => ({ q: String(d.data().q ?? ""), hits: Number(d.data().hits) || 0, gem: String(d.data().gem ?? "") }));
  return { answers: rows.length, hits: rows.reduce((a, r) => a + r.hits, 0), top: rows.sort((a, b) => b.hits - a.hits).slice(0, 10) };
}
export async function bankClear(db: Firestore): Promise<number> {
  let n = 0;
  for (;;) {
    const s = await db.collection("nanaBank").limit(400).get();
    if (s.empty) return n;
    const b = db.batch();
    s.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    n += s.size;
  }
}
