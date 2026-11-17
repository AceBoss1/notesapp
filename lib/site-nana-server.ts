import type { Firestore } from "firebase-admin/firestore";
import { effectiveTier, type UserProfile } from "./users";
import { canHaveSite, siteThemeOf } from "./site-themes";
import { siteSectionsOf } from "./site-settings";
import { siteDocOf, type SiteDoc } from "./site-kits";
import { bookingOf } from "./site-server";
import { memberTier, type Meter } from "./nana-meter";
import { gemModel, realDeps, runAi, type NanaDeps } from "./nana-server";
import { canSeeVisitDetail, dayList } from "./analytics";
import { ownerVisitRef } from "./visits-server";
import { reviewSite, type Review } from "./site-review";
import {
  DRAFT_TASK, SKIPPED, SiteNanaError, UNDO_DAYS, answeredCount, applyDraft, applyRewrite, canDraft, changesOf, cleanAnswer, cleanDraft, cleanRead,
  defaultReplace, draftContext, draftSystem, isPart, isQuestion, knownSomething, nextQuestion, parseJson, questionsFor, readContext, readSystem,
  redoTask, REDO_PARTS, sourceText, undoOpen,
  type Answers, type Can, type Draft, type Funnel, type Known, type NanaRead, type Part,
} from "./site-nana";

// Nana sets up your site, and Review my site (docs/SITE_NANA.md). Server only.
//   siteSetups/{uid}: { uid, answers, draft, before: { site, theme, sections, about }, beforeAt, updatedAt }
// Server-only in firestore.rules: the member reaches it through /api/site/nana. It holds facts about their business that they typed for
// their public site, so it isn't encrypted; it is deleted with the account. The site itself is still written only as lib/site-server.ts
// writes it (sites/{uid}, and siteTheme, siteSections and sitePages.about on users/{uid}).

const SETUPS = "siteSetups";
const NANA_PER_DAY = 30; // calls on our account a day for this feature, on top of the Nana allowance
type Before = { site: SiteDoc; theme: string; sections: ReturnType<typeof siteSectionsOf>; about: string };
type Stored = { answers: Answers; draft: Draft | null; before: Before | null; beforeAt?: string };

const ref = (db: Firestore, uid: string) => db.collection(SETUPS).doc(uid);
// Firestore refuses fields left undefined (an optional part of a site that was never set), so what is written goes through JSON first.
const plain = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
async function readSetup(db: Firestore, uid: string): Promise<Stored> {
  const d = (await ref(db, uid).get()).data() ?? {};
  return { answers: (d.answers ?? {}) as Answers, draft: (d.draft ?? null) as Draft | null, before: (d.before ?? null) as Before | null, beforeAt: d.beforeAt as string | undefined };
}
// Each field given replaces the stored one whole (mergeFields), so nothing of an older draft or answer set lingers inside a newer one.
const writeSetup = (db: Firestore, uid: string, s: Partial<Stored>, now: Date) => {
  const data = plain({ uid, ...s, updatedAt: now.toISOString() });
  return ref(db, uid).set(data, { mergeFields: Object.keys(data) });
};

async function owner(db: Firestore, uid: string): Promise<{ p: UserProfile; tier: string }> {
  const p = (await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined;
  if (!p) throw new SiteNanaError("Profile not found.", 404);
  if (!canHaveSite(p)) throw new SiteNanaError("Your own site comes with Free Basic and above.", 403);
  return { p, tier: effectiveTier(p) };
}

// What is on their account already: shop items for sale (title and price), booking hours, name and bio.
async function knownOf(db: Firestore, uid: string, p: UserProfile): Promise<{ known: Known; can: Can }> {
  const [items, booking] = await Promise.all([db.collection("storeItems").where("ownerUid", "==", uid).get(), bookingOf(db, uid)]);
  const shop = items.docs.map((d) => d.data()).filter((d) => d.sellable !== false && d.title).slice(0, 40).map((d) => ({ title: String(d.title).slice(0, 80), priceKobo: Number(d.priceKobo) || 0 }));
  const sections = siteSectionsOf(p);
  return {
    known: { name: String(p.displayName ?? "").slice(0, 80), bio: String(p.bio ?? "").slice(0, 400), shop, bookingHours: booking.offered ? booking.hours : "" },
    can: { book: booking.offered, shop: sections.shop && shop.length > 0 },
  };
}

async function current(db: Firestore, uid: string, p: UserProfile) {
  const site = siteDocOf((await db.doc(`sites/${uid}`).get()).data());
  return { site, theme: siteThemeOf(p), about: p.sitePages?.about ?? "", sections: siteSectionsOf(p) };
}

// Everything the setup screens need.
export async function setupView(db: Firestore, uid: string, now = new Date()) {
  const { p, tier } = await owner(db, uid);
  const [s, { known, can }, cur] = await Promise.all([readSetup(db, uid), knownOf(db, uid, p), current(db, uid, p)]);
  const qs = questionsFor(known);
  return {
    tier, questions: qs, answers: s.answers, next: nextQuestion(qs, s.answers), answered: answeredCount(qs, s.answers), canDraft: canDraft(s.answers),
    known: knownSomething(known) ? { shop: known.shop.length, bookingHours: known.bookingHours } : null, can,
    draft: s.draft, changes: s.draft ? changesOf(cur, s.draft) : [], replace: defaultReplace(cur),
    current: { site: cur.site, theme: cur.theme, about: cur.about, username: p.username },
    undo: undoOpen(s.beforeAt, now) ? { at: s.beforeAt!, days: UNDO_DAYS } : null,
  };
}

// An answer, or a skip. Answers are kept as they come, so the interview can stop and carry on later.
export async function answerQuestion(db: Firestore, uid: string, b: Record<string, unknown>, now = new Date()) {
  const { p } = await owner(db, uid);
  if (!isQuestion(b.q)) throw new SiteNanaError("Unknown question.");
  const { known } = await knownOf(db, uid, p);
  if (!questionsFor(known).some((q) => q.id === b.q)) throw new SiteNanaError("Unknown question.");
  const s = await readSetup(db, uid);
  const answers: Answers = { ...s.answers, [b.q]: b.skip === true ? SKIPPED : cleanAnswer(b.text) };
  await writeSetup(db, uid, { answers }, now);
  return setupView(db, uid, now);
}

export async function restartSetup(db: Firestore, uid: string, now = new Date()) {
  await owner(db, uid);
  await writeSetup(db, uid, { answers: {}, draft: null }, now);
  return setupView(db, uid, now);
}

async function askNana(db: Firestore, uid: string, deps: NanaDeps, system: string, messages: { role: "user" | "assistant"; content: string }[], maxTokens: number): Promise<{ text: string; notice?: string }> {
  const meter: Meter = { uid, tier: await memberTier(db, uid), gem: "pearl", effort: "low" };
  const ran = await runAi(db, deps, deps.now(), uid, { system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }], messages, maxTokens, model: gemModel("pearl"), effort: "low" }, NANA_PER_DAY, meter);
  if (!ran.completion || ran.completion.refused || !ran.completion.text.trim()) {
    throw new SiteNanaError(`${ran.notice ?? "Nana can't do this just now."} Your answers are saved: try again later, or pick a kit yourself.`, 503);
  }
  return { text: ran.completion.text, ...(ran.notice ? { notice: ran.notice } : {}) };
}

// Nana chooses the kit, look and buttons and drafts the words: one call, from the member's answers.
export async function makeDraft(db: Firestore, uid: string, deps: NanaDeps = realDeps()) {
  const now = deps.now();
  const { p, tier } = await owner(db, uid);
  const s = await readSetup(db, uid);
  if (!canDraft(s.answers)) throw new SiteNanaError("Tell Nana what you do, and answer at least one more question, first.", 409);
  const { known, can } = await knownOf(db, uid, p);
  const qs = questionsFor(known);
  const ctx = draftContext(qs, s.answers, known, tier, can);
  const got = await askNana(db, uid, deps, draftSystem(tier), [{ role: "user", content: `${ctx}\n\n${DRAFT_TASK}` }], 3000);
  const draft = cleanDraft(parseJson(got.text), { tier, can, source: sourceText(s.answers, known), now, facts: true });
  await writeSetup(db, uid, { draft }, now);
  return { ...(await setupView(db, uid, now)), ...(got.notice ? { notice: got.notice } : {}) };
}

// "Try another" for the banner, the questions or the About page.
export async function redoPart(db: Firestore, uid: string, part: unknown, deps: NanaDeps = realDeps()) {
  const now = deps.now();
  if (!isPart(part) || !REDO_PARTS.includes(part)) throw new SiteNanaError("Nana can write another version of the banner, the questions or the About page.");
  const { p, tier } = await owner(db, uid);
  const s = await readSetup(db, uid);
  if (!s.draft) throw new SiteNanaError("Ask Nana for a draft first.", 409);
  const { known, can } = await knownOf(db, uid, p);
  const ctx = draftContext(questionsFor(known), s.answers, known, tier, can);
  const was = part === "hero" ? JSON.stringify(s.draft.hero) : part === "faq" ? JSON.stringify(s.draft.faq) : s.draft.about;
  const got = await askNana(db, uid, deps, draftSystem(tier), [{ role: "user", content: `${ctx}\n\nYour last version of "${part}" was: ${was}\n\n${redoTask(part)}` }], 1500);
  const fresh = cleanDraft({ ...s.draft, ...pick(parseJson(got.text), part) }, { tier, can, source: sourceText(s.answers, known), now, facts: true }, s.draft);
  // Only the part asked for changes; the facts check runs over Nana's words again, never over the member's own edits elsewhere.
  const draft: Draft = { ...s.draft, ...(part === "hero" ? { hero: fresh.hero } : part === "faq" ? { faq: fresh.faq } : { about: fresh.about }), keep: { ...s.draft.keep, [part]: true } };
  await writeSetup(db, uid, { draft }, now);
  return { ...(await setupView(db, uid, now)), ...(got.notice ? { notice: got.notice } : {}) };
}
const pick = (o: Record<string, unknown>, part: Part) => (o[part] === undefined ? {} : { [part]: o[part] });

// The member's own edits to the draft, and Keep or Skip on each part. Their words are theirs: no facts check, only the usual limits.
export async function editDraft(db: Firestore, uid: string, raw: unknown, now = new Date()) {
  const { p, tier } = await owner(db, uid);
  const s = await readSetup(db, uid);
  if (!s.draft) throw new SiteNanaError("Ask Nana for a draft first.", 409);
  const { known, can } = await knownOf(db, uid, p);
  const draft = cleanDraft(raw, { tier, can, source: sourceText(s.answers, known), now, facts: false }, s.draft);
  await writeSetup(db, uid, { draft: { ...draft, why: s.draft.why, wanted: s.draft.wanted } }, now);
  return setupView(db, uid, now);
}

// "Put it on my site": the site as it was is kept for 30 days, then the draft goes on. The draft is cleared; the answers stay.
export async function applySetup(db: Firestore, uid: string, replace: unknown, now = new Date()) {
  const { p, tier } = await owner(db, uid);
  const s = await readSetup(db, uid);
  if (!s.draft) throw new SiteNanaError("Ask Nana for a draft first.", 409);
  const cur = await current(db, uid, p);
  const r = (replace && typeof replace === "object" ? replace : {}) as Record<string, unknown>;
  const out = applyDraft(cur, s.draft, Object.fromEntries(Object.entries(r).filter(([k]) => isPart(k)).map(([k, v]) => [k, v === true])), tier);
  const before: Before = plain({ site: cur.site, theme: cur.theme, sections: cur.sections, about: cur.about });
  const batch = db.batch();
  batch.set(db.doc(`sites/${uid}`), plain({ ...out.site, uid, updatedAt: now.toISOString() }));
  batch.update(db.doc(`users/${uid}`), {
    siteTheme: out.theme, siteSections: out.sections,
    ...(out.about !== null ? { "sitePages.about": out.about, "sitePages.updatedAt": now.toISOString() } : {}),
  });
  batch.set(ref(db, uid), { uid, draft: null, before, beforeAt: now.toISOString(), updatedAt: now.toISOString() }, { merge: true });
  await batch.commit();
  return setupView(db, uid, now);
}

// "Put my old site back", within 30 days of the last time Nana's draft went on.
export async function putBack(db: Firestore, uid: string, now = new Date()) {
  await owner(db, uid);
  const s = await readSetup(db, uid);
  if (!s.before || !undoOpen(s.beforeAt, now)) throw new SiteNanaError(`There's nothing to put back: your site before Nana's draft is kept for ${UNDO_DAYS} days.`, 409);
  const b = s.before;
  const batch = db.batch();
  batch.set(db.doc(`sites/${uid}`), plain({ ...siteDocOf(b.site), uid, updatedAt: now.toISOString() }));
  batch.update(db.doc(`users/${uid}`), { siteTheme: b.theme, siteSections: b.sections, "sitePages.about": b.about, "sitePages.updatedAt": now.toISOString() });
  batch.set(ref(db, uid), { uid, before: null, beforeAt: null, updatedAt: now.toISOString() }, { merge: true });
  await batch.commit();
  return setupView(db, uid, now);
}

// ── Review my site ────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function reviewInputs(db: Firestore, uid: string) {
  const { p, tier } = await owner(db, uid);
  const [cur, { known }, booking] = await Promise.all([current(db, uid, p), knownOf(db, uid, p), bookingOf(db, uid)]);
  const review: Review = reviewSite({
    site: cur.site, theme: cur.theme, tier, sections: cur.sections, pages: { about: cur.about, contact: p.sitePages?.contact ?? "" },
    shopItems: known.shop.length, bookingOn: booking.offered,
  });
  return { p, tier, cur, review };
}

// The checklist: free for everyone with a site, no Nana.
export async function siteReview(db: Firestore, uid: string) {
  const { tier, review, p } = await reviewInputs(db, uid);
  return { tier, username: p.username, ...review };
}

// The last 30 days: visits (ownerViews), looks at shop items, paid orders and bookings. Visits by page on Business and above.
export async function funnelOf(db: Firestore, uid: string, tier: string, now: Date): Promise<Funnel> {
  const days = dayList(now, 30), since = `${days[0]}T00:00:00.000Z`;
  const [visitDocs, orders, bookings] = await Promise.all([
    db.getAll(...days.map((d) => ownerVisitRef(db, uid, d))),
    db.collection("storeOrders").where("sellerUid", "==", uid).where("paidAt", ">=", since).get(),
    db.collection("bookings").where("publisherUid", "==", uid).where("createdAt", ">=", since).get(),
  ]);
  let visits = 0, shopViews = 0;
  const pages = new Map<string, number>();
  for (const d of visitDocs) {
    const v = d.data();
    if (!v) continue;
    visits += Number(v.count) || 0;
    for (const [k, n] of Object.entries((v.pages ?? {}) as Record<string, number>)) {
      if (k.startsWith("item:")) shopViews += Number(n) || 0;
      pages.set(k, (pages.get(k) ?? 0) + (Number(n) || 0));
    }
  }
  const label = (k: string) => (k.startsWith("profile:") ? "Your site's home" : k.startsWith("item:") ? "A shop item" : k.startsWith("note:") ? "A journal" : k.startsWith("course:") ? "A course" : "Another page");
  const top = canSeeVisitDetail(tier) ? [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ label: label(k), visits: n })) : null;
  return { days: 30, visits, shopViews, orders: orders.docs.filter((d) => d.data().status !== "refunded").length, bookings: bookings.docs.filter((d) => d.data().status !== "cancelled").length, pages: top };
}

// Nana's read: rewrites of the banner lines and a few tips, from the site's public words, the checklist and the numbers. Nothing changes
// until the member accepts a rewrite.
export async function nanaRead(db: Firestore, uid: string, deps: NanaDeps = realDeps()): Promise<{ read: NanaRead; funnel: Funnel; notice?: string }> {
  const now = deps.now();
  const { tier, cur, review } = await reviewInputs(db, uid);
  const funnel = await funnelOf(db, uid, tier, now);
  const got = await askNana(db, uid, deps, readSystem(), [{ role: "user", content: readContext(cur.site, cur.about, review.findings.map((f) => f.title), funnel) }], 1200);
  return { read: cleanRead(parseJson(got.text), cur.site, cur.about), funnel, ...(got.notice ? { notice: got.notice } : {}) };
}

// "Use this" on a rewrite.
export async function useRewrite(db: Firestore, uid: string, field: unknown, text: unknown, now = new Date()) {
  if (field !== "headline" && field !== "subline") throw new SiteNanaError("Choose the headline or the line under it.");
  const { p } = await owner(db, uid);
  const cur = await current(db, uid, p);
  const site = applyRewrite(cur.site, field, String(text ?? ""));
  await db.doc(`sites/${uid}`).set(plain({ ...site, uid, updatedAt: now.toISOString() }));
  return { site };
}

export async function eraseSetup(db: Firestore, uid: string) { await ref(db, uid).delete(); }
