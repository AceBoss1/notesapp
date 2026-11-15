import { setting } from "@/lib/config";
import { AiDown, aiCandidates, chargePlatform, gemModel, realDeps, type NanaDeps, type SystemBlock } from "./nana-server";
import { memberTier, meterCharge, meterCheck, nanaStatus, type Meter } from "./nana-meter";
import { BooksError, catalog, type Ctx } from "./books-server";
import { can, cleanText } from "./books";
import { liteConfigured, liteCount, liveLite, type LiteCall } from "./nana-lite-server";
import { NANA_SYSTEM, NANA_TEXT_MAX, cleanDrafts, nanaPrompt, readReply, standInEntries, type Draft, type NanaCustomer, type NanaItem } from "./books-nana";

// Nana entries on the server (docs/BUSINESS-BOOKS.md, step 7; the rules are lib/books-nana.ts). POST /api/books { action: "nana", text }.
//
// Who pays: the books' owner. Their own connected AI account first (never metered), else #NotesApp's Pearl, paid from the owner's Nana
// allowance and then their Nana credit through the same meter as Nana's writing help (lib/nana-meter.ts meterCheck / meterCharge). A
// cashier typing for the shop uses the shop's allowance, not their own. One entry is about 1,500 tokens in and 200 out, well under ₦1.
// Out of allowance (and credit): a clear message, and typing the entry yourself always works.
// Nana Lite (docs/NANA_LITE.md) comes before Pearl when it's switched on: our own small model, so it doesn't touch the owner's allowance.
// Its reply goes through the same checks (readReply, cleanDrafts); if it can't be read or finds nothing, or Nana Lite is busy, Pearl
// answers instead. Skipped when the shop's catalogue makes the prompt too long for a small model's window.
// What Pearl sees: the item names, SKUs and prices, and customers' first names. Never balances, costs or profit.
// Nothing is saved here: the drafts go back to the page, and the seller saves each one like a typed entry.
// In development and screenshots with no AI key, the stand-in reader (lib/books-nana.ts standInEntries) answers instead; never on the live
// site, where NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST is never set (as course covers do).
const standInAllowed = () => !!setting("NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST");
const PER_SHOP_DAILY = 200; // Nana entries a day per shop on our account (on top of the allowance), so a stuck page can't run up calls
const whenText = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });

const LITE_PER_SHOP_DAILY = 300; // Nana Lite entries a day per shop
const LITE_PROMPT_MAX = 9_000; // characters of system + prompt (about 2,600 tokens), leaving room for the reply in a 4,096-token window

export type NanaEntriesResult = { drafts: Draft[]; via: "own" | "lite" | "platform" | "standin"; note?: string; dropped?: number };

export async function nanaEntries(c: Ctx, raw: unknown, deps: NanaDeps = realDeps(), lite: LiteCall | null = liteConfigured() ? liveLite : null): Promise<NanaEntriesResult> {
  const text = cleanText(raw, NANA_TEXT_MAX + 1);
  if (!text) throw new BooksError(400, "Tell Nana what happened, like “Sold 3 bags of rice ₦45,000 to Mama Bisi on credit, due Friday”.");
  if (text.length > NANA_TEXT_MAX) throw new BooksError(400, `Keep it under ${NANA_TEXT_MAX} characters, a few entries at a time.`);
  const [cat, parties] = await Promise.all([catalog(c), c.db.collection("bookParties").where("ownerUid", "==", c.owner).where("kind", "==", "customer").get()]);
  const items: NanaItem[] = cat.map((x) => ({ ref: x.ref, title: x.title, sku: x.sku || undefined, priceKobo: x.priceKobo }));
  const customers: NanaCustomer[] = parties.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? "") })).filter((x) => x.name);
  const ctx = { today: c.today, items, customers };
  const finish = (rawEntries: unknown[], via: NanaEntriesResult["via"]): NanaEntriesResult => {
    let drafts = cleanDrafts(rawEntries, ctx);
    const all = drafts.length;
    // A cashier records sales and payments received only; anything else is left for the owner.
    drafts = drafts.filter((d) => can(c.role, d.kind));
    const dropped = all - drafts.length;
    const note = !all ? "Nana didn't find a sale, expense or payment in that. Try saying what was sold or paid, and how much." : dropped ? `${dropped} ${dropped === 1 ? "entry was" : "entries were"} left out: cashiers record sales and payments received.` : undefined;
    return { drafts, via, ...(note ? { note } : {}), ...(dropped ? { dropped } : {}) };
  };

  const now = deps.now();
  const candidates = await aiCandidates(c.db, c.owner);
  const content = nanaPrompt(text, c.today, items, customers);
  const useLite = !!lite && !candidates.some((x) => x.source === "own") && NANA_SYSTEM.length + content.length <= LITE_PROMPT_MAX;
  if (useLite && (await liteCount(c.db, `books_${c.owner}`, LITE_PER_SHOP_DAILY, now))) {
    try {
      const out = await lite!({ system: NANA_SYSTEM, user: content, maxTokens: 900, json: true, temperature: 0 });
      const entries = readReply(out.text);
      if (entries) {
        const r = finish(entries, "lite");
        if (r.drafts.length || r.dropped || !candidates.length) return r;
      }
    } catch (e) { console.error("[books-nana] Nana Lite", e instanceof Error ? e.message : e); }
    if (!candidates.length) throw new BooksError(503, "Nana couldn't read that one. Try saying it another way, or type the entry.");
  }
  if (!candidates.length) {
    if (standInAllowed()) return finish(standInEntries(text, c.today), "standin");
    throw new BooksError(503, "Nana isn't available right now. Type the entry yourself; it's always free.");
  }
  const meter: Meter = { uid: c.owner, tier: await memberTier(c.db, c.owner), gem: "pearl", effort: "low" };
  const system: SystemBlock[] = [{ type: "text", text: NANA_SYSTEM, cache_control: { type: "ephemeral" } }];
  let blocked = "", lastKind: AiDown["kind"] | null = null, limited = false;
  for (const cand of candidates) {
    if (cand.source === "platform") {
      const ok = await meterCheck(c.db, meter, now);
      if (!ok.ok) {
        const s = await nanaStatus(c.db, c.owner, now, meter.tier).catch(() => null);
        blocked = ok.reason === "ceiling" ? ok.notice : `${c.role === "owner" ? "Your" : "The shop's"} Nana allowance is used up${s ? `; it refreshes ${whenText(s.resetsAt)}` : ""}. Nana credit (on the Nana page) works straight away, and typing the entry yourself is always free.`;
        continue;
      }
      if (!(await chargePlatform(c.db, now, c.owner, PER_SHOP_DAILY))) { limited = true; continue; }
    }
    try {
      const out = await deps.complete({ apiKey: cand.apiKey, system, messages: [{ role: "user", content }], maxTokens: 1200, model: gemModel("pearl"), effort: "low" });
      if (cand.source === "platform") await meterCharge(c.db, meter, out.usage, now).catch((e) => console.error("[books-nana] metering failed", e instanceof Error ? e.message : e));
      const entries = out.refused ? null : readReply(out.text);
      if (!entries) throw new BooksError(422, "Nana couldn't read that one. Try saying it another way, or type the entry.");
      return finish(entries, cand.source);
    } catch (err) {
      if (!(err instanceof AiDown)) throw err;
      lastKind = err.kind;
    }
  }
  if (blocked && !lastKind) throw new BooksError(402, blocked, "nana_allowance");
  if (limited && !lastKind) throw new BooksError(429, "Nana has done a lot of entries for this shop today. Type the rest yourself, or try again tomorrow.", "nana_daily");
  throw new BooksError(503, lastKind === "auth" || lastKind === "billing" ? "The AI account didn't work just now (the key was rejected or has no credit). Check it on the Nana page, or type the entry." : "Nana is busy right now. Try again in a minute, or type the entry.");
}
