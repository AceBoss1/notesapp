import { createHmac, timingSafeEqual } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "./firebase-admin";
import { sendEmail } from "./email";
import { APP_URL, CONTACT_EMAIL, SITE_URL } from "./host";
import { COMPANY_INFO } from "./site";
import { DEFAULT_AVATAR } from "./admin";
import { resolveAuthorUsername } from "./journals-directory";
import { topicsOf } from "./topics";
import { digestSubject, fillSlots, pickItems, pickStories, renderDigestHtml, renderDigestText, type DigestEmail, type DigestSponsored, type PoolItem, type PoolStory, type SlotCandidate } from "./digest";
import { loadActiveAds, lagosDay } from "./ads-server";
import { adConfig } from "./ad-config-server";
import { spotOn } from "./ad-config";
import { AD_FOOTER } from "./ads";
import { getMarket, type MarketItem } from "./shop-directory";
import { ACADEMY_LIVE, courseHref, priceLabel } from "./courses";
import { setting } from "@/lib/config";

// Server-only. The #NotesApp Weekly Digest (template in lib/digest.ts).
//
// When: every Sunday from 5 PM Lagos time, by the reminders cron (/api/cron/reminders, every ~15 min). Each run sends to the
// next DIGEST_PER_RUN members (default 40) and remembers where it stopped in digestRuns/{sunday}, so a big list goes out over
// several runs; a week's run stops 48 hours after it starts. Off until WEEKLY_DIGEST=on (Vercel), so it can be previewed first
// (Admin → POST /api/admin/digest).
// Who: members with a verified email who haven't turned it off (emailPrefs/{uid}.weeklyDigest === false, server-only), aren't
// suspended, and have at least one story to read. Every email has a one-click unsubscribe link and List-Unsubscribe headers.
// What: up to 10 journals published in the last 7 days, the most viewed on the reader's interests (users/{uid}.interests, the
// hashtags they choose) with people they follow mixed in, then the week's most viewed. Never their own. Then 4 from Notes
// Market and 4 from Notes Academy, the same way (weekMarket, weekCourses, pickItems). A section with nothing in it is left out.
// Sponsored: up to 3 slots (Admin → Ads), filled from active boosts and adverts with the digest spot (weekSponsors, fillSlots).
// Each email sent counts as one impression for what it carried (countSends), within each boost's daily cap and what was
// bought; clicks go through /api/digest/go, which counts them.
// Email quota: Resend's free plan allows 100 emails a day for everything (bookings, receipts …). Raise the plan before
// turning the digest on for more members than that, or keep DIGEST_PER_RUN low.

const WEEK_MS = 7 * 86_400_000;
const RUN_WINDOW_MS = 48 * 3_600_000;
const LAGOS_OFFSET_MS = 3_600_000; // UTC+1, no daylight saving
const NO_INBOX = new Set(["na-notesapp"]);

// On when an admin switched it on (Admin → Weekly digest, stored in digestConfig/main, server-only) or WEEKLY_DIGEST=on in Vercel.
export async function digestOn(db: Firestore): Promise<boolean> {
  if (setting("WEEKLY_DIGEST") === "on") return true;
  return (await db.doc("digestConfig/main").get().catch(() => null))?.data()?.on === true;
}
export async function setDigestOn(db: Firestore, on: boolean, byUid: string): Promise<void> {
  await db.doc("digestConfig/main").set({ on, byUid, at: new Date().toISOString() }, { merge: true });
}
// What Admin → Weekly digest shows.
export async function digestStatus(db: Firestore, now = new Date()) {
  const [cfg, last] = await Promise.all([db.doc("digestConfig/main").get(), db.doc(`digestRuns/${digestWeek(now).id}`).get()]);
  const week = digestWeek(now);
  const next = now.getTime() < week.startsAt + RUN_WINDOW_MS && !last.data()?.done ? week.startsAt : week.startsAt + WEEK_MS;
  return {
    on: setting("WEEKLY_DIGEST") === "on" || cfg.data()?.on === true,
    forcedByVercel: setting("WEEKLY_DIGEST") === "on",
    switchedBy: cfg.data()?.byUid ?? null, switchedAt: cfg.data()?.at ?? null,
    linkSecret: setting("EMAIL_LINK_SECRET") ? "EMAIL_LINK_SECRET" : setting("CRON_SECRET") ? "CRON_SECRET" : null,
    emailReady: !!setting("RESEND_API_KEY"), perRun: perRun(),
    thisWeek: { id: week.id, sent: Number(last.data()?.sent) || 0, done: last.data()?.done === true },
    nextSendAt: new Date(next).toISOString(),
  };
}
const perRun = () => Math.max(1, Math.min(500, Number(setting("DIGEST_PER_RUN")) || 40));

// ---- one-click unsubscribe links (signed, so nobody can turn it off for someone else) ----
const secret = () => setting("EMAIL_LINK_SECRET") || setting("CRON_SECRET") || "";
export function digestToken(uid: string): string {
  return createHmac("sha256", secret()).update(`weekly-digest:${uid}`).digest("base64url").slice(0, 32);
}
export function validDigestToken(uid: string, token: string): boolean {
  if (!secret() || !uid || !token) return false;
  const a = Buffer.from(digestToken(uid)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const unsubscribeUrl = (uid: string) => `${SITE_URL}/api/digest/unsubscribe?u=${encodeURIComponent(uid)}&t=${digestToken(uid)}`;
export const INTERESTS_PATH = "/interests";
export const EMAIL_SETTINGS_PATH = "/profile/account#email";

// ---- the member's choice ----
export async function digestWanted(db: Firestore, uid: string): Promise<boolean> {
  return (await db.doc(`emailPrefs/${uid}`).get()).data()?.weeklyDigest !== false;
}
export async function setDigestWanted(db: Firestore, uid: string, on: boolean, via: "settings" | "link" = "settings"): Promise<void> {
  await db.doc(`emailPrefs/${uid}`).set({ weeklyDigest: on, updatedAt: new Date().toISOString(), via }, { merge: true });
}

// ---- the week's stories ----
const abs = (u: unknown, fallback: string | null) => {
  const s = typeof u === "string" ? u.trim() : "";
  if (!s) return fallback;
  if (/^https:\/\//i.test(s)) return s;
  return s.startsWith("/") ? `${SITE_URL}${s}` : fallback;
};
// The opening of a journal as plain words, for the summary (longer than a card's, like Quora's).
function summaryOf(markdown: string, max = 230): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ").replace(/<[^>]+>/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>~]+/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).replace(/[,;:.\s]+$/, "")}…`;
}

export async function weekPool(db: Firestore, now = new Date()): Promise<PoolStory[]> {
  const since = new Date(now.getTime() - WEEK_MS).toISOString();
  const snap = await db.collection("notes").where("date", ">=", since).get(); // one field, no index needed
  const notes = snap.docs.map((d) => ({ id: d.id, n: d.data() })).filter(({ n }) => n.status === "published" && String(n.date ?? "") <= now.toISOString());
  // The 100 most viewed are enough to choose 10 from for anyone; count their comments.
  notes.sort((a, b) => (Number(b.n.viewCount) || 0) - (Number(a.n.viewCount) || 0) || (Number(b.n.likeCount) || 0) - (Number(a.n.likeCount) || 0));
  const top = notes.slice(0, 100);
  const comments = await Promise.all(top.map(({ id }) => db.collection(`notes/${id}/comments`).count().get().then((c) => c.data().count).catch(() => 0)));
  const writerUids = Array.from(new Set(top.map(({ n }) => String(n.writerUid ?? "")).filter(Boolean)));
  const writers = writerUids.length ? await db.getAll(...writerUids.map((u) => db.doc(`users/${u}`))) : [];
  const writer = new Map(writers.map((w) => [w.id, w.data()]));
  return top.map(({ id, n }, i) => {
    const words = String(n.content ?? "").split(/\s+/).filter(Boolean).length;
    const w = n.writerUid ? writer.get(String(n.writerUid)) : undefined;
    return {
      id, authorUid: String(n.authorUid ?? ""), authorUsername: String(n.authorUsername ?? resolveAuthorUsername(String(n.author ?? "")) ?? ""),
      tags: topicsOf(n), publishedAt: String(n.date ?? ""), // its topics (lib/topics.ts), matched against the reader's interests
      title: String(n.title ?? "Untitled"), summary: summaryOf(String(n.content ?? "")), href: `${SITE_URL}/journals/${String(n.slug ?? id)}`,
      image: abs(n.featured_image || n.videoPoster, null),
      // An organisation's post: "Ada in Precheks" (the team member who wrote it, in the organisation).
      writerName: w ? String(w.displayName ?? n.author ?? "") : String(n.author ?? ""), writerAvatar: abs(w ? w.avatar : n.author_avatar, `${SITE_URL}${DEFAULT_AVATAR}`)!,
      ...(w ? { inName: String(n.author ?? "") } : {}),
      readMinutes: Math.max(1, Math.round(words / 200)), likes: Number(n.likeCount) || 0, comments: comments[i], views: Number(n.viewCount) || 0, premium: n.premium === true,
    };
  });
}

// The Market section's pool, the same for everyone that week: the 40 most viewed items this week (all-time views when
// nothing was counted this week), with their topics and category, for pickItems to choose 4 per reader.
const POOL_ITEMS = 40;
export async function weekMarket(_db: Firestore, _now = new Date()): Promise<PoolItem[]> {
  const { items } = await getMarket();
  if (!items.length) return [];
  const week = items.some((i) => i.viewsWeek > 0);
  const heat = (i: MarketItem) => (week ? i.viewsWeek : i.views);
  return items.filter((i) => heat(i) > 0).sort((a, b) => heat(b) - heat(a)).slice(0, POOL_ITEMS).map((i) => ({
    id: i.id, title: i.title, href: i.href.startsWith("/") ? `${SITE_URL}${i.href}` : i.href, image: abs(i.image, null), price: i.price, by: i.sellerName,
    why: `${heat(i).toLocaleString("en-GB")} views ${week ? "this week" : "so far"}`, tags: [...(i.topics ?? []), i.category].filter(Boolean), heat: heat(i), ownerUid: i.sellerUid,
  }));
}

// The Academy section's pool: the 40 most viewed published courses this week (all-time views when nothing was counted this
// week), with their topics. Courses of suspended teachers are left out.
export async function weekCourses(db: Firestore, now = new Date()): Promise<PoolItem[]> {
  if (!ACADEMY_LIVE) return [];
  const snap = await db.collection("courses").where("status", "==", "published").get();
  if (snap.empty) return [];
  const since = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const views = await db.collection("pageViews").where("day", ">=", since(7).slice(0, 10)).get(); // one field, no index needed
  const week = new Map<string, number>();
  for (const d of views.docs) if (d.data().kind === "course") week.set(String(d.data().id), (week.get(String(d.data().id)) ?? 0) + (Number(d.data().count) || 0));
  const courses = snap.docs.map((d) => ({ id: d.id, c: d.data() }));
  const owners = await db.getAll(...Array.from(new Set(courses.map(({ c }) => String(c.ownerUid)))).map((u) => db.doc(`users/${u}`)));
  const ok = new Set(owners.filter((o) => o.exists && o.data()?.suspended !== true).map((o) => o.id));
  const name = new Map(owners.map((o) => [o.id, String(o.data()?.displayName || o.data()?.username || "")]));
  const anyWeek = courses.some(({ id }) => (week.get(id) ?? 0) > 0);
  const heat = (id: string, c: FirebaseFirestore.DocumentData) => (anyWeek ? week.get(id) ?? 0 : Number(c.viewCount) || 0);
  return courses.filter(({ id, c }) => ok.has(String(c.ownerUid)) && heat(id, c) > 0).sort((a, b) => heat(b.id, b.c) - heat(a.id, a.c)).slice(0, POOL_ITEMS).map(({ id, c }) => ({
    id, title: String(c.title ?? ""), href: `${SITE_URL}${courseHref(String(c.slug ?? id))}`, image: abs(c.cover, null), price: priceLabel(c), by: name.get(String(c.ownerUid)) || String(c.ownerName ?? ""),
    why: `${heat(id, c).toLocaleString("en-GB")} views ${anyWeek ? "this week" : "so far"}`, tags: Array.isArray(c.topics) ? c.topics.map(String) : [], heat: heat(id, c), ownerUid: String(c.ownerUid),
  }));
}

// ---- sponsored slots ----
// What can go in this week's sponsored slots: boosted journals and store items that can still be delivered (inside their
// window, impressions left, under today's cap), and active adverts with the digest spot (paid campaigns first). `left` is how
// many more emails each boost may count today. Nothing when Admin → Ads has the digest spot off or no slots.
export type Sponsors = { posts: SlotCandidate[]; items: SlotCandidate[]; ads: SlotCandidate[]; left: Map<string, number>; slots: number };
const boostDay = (d = new Date()) => d.toISOString().slice(0, 10); // the same day key /api/boosts/impression uses
export const digestGo = (kind: "b" | "a", id: string) => `${SITE_URL}/api/digest/go?${kind}=${encodeURIComponent(id)}`;
export async function weekSponsors(db: Firestore, now = new Date(), pool: PoolStory[] = []): Promise<Sponsors> {
  const cfg = await adConfig();
  const none: Sponsors = { posts: [], items: [], ads: [], left: new Map(), slots: 0 };
  if (cfg.digestSlots === 0 || !spotOn(cfg, "digest")) return none;
  const today = boostDay(now);
  const snap = await db.collection("boosts").where("status", "==", "active").get();
  const left = new Map<string, number>();
  const live = snap.docs.map((d) => ({ id: d.id, b: d.data() })).filter(({ id, b }) => {
    const n = Math.min((Number(b.impressionsPurchased) || 0) - (Number(b.impressionsDelivered) || 0), (Number(b.maxPerDay) || 0) - (Number(b.daily?.[today]) || 0));
    if (!(new Date(String(b.endsAt)).getTime() > now.getTime()) || n <= 0) return false;
    left.set(id, n);
    return true;
  });
  const { items: market } = await getMarket().catch(() => ({ items: [] as MarketItem[] }));
  const itemTags = new Map(market.map((i) => [i.id, [...(i.topics ?? []), i.category].filter(Boolean)]));
  const storyTags = new Map(pool.map((p) => [p.href, p.tags]));
  const posts: SlotCandidate[] = [], items: SlotCandidate[] = [];
  for (const { id, b } of live) {
    const target = b.itemId ? `${SITE_URL}/shop/${b.itemId}` : `${SITE_URL}/journals/${b.slug}`;
    const x: SlotCandidate = { kind: b.itemId ? "item" : "post", id, title: String(b.title ?? ""), image: abs(b.image, null), href: digestGo("b", id), label: `Promoted · ${String(b.author ?? "")}`, ownerUid: String(b.publisherUid ?? ""), target, tags: b.itemId ? itemTags.get(String(b.itemId)) ?? [] : storyTags.get(target) ?? [] };
    (b.itemId ? items : posts).push(x);
  }
  // The least delivered (for what was bought) first, as on the site.
  const share = (id: string) => { const b = live.find((l) => l.id === id)!.b; return (Number(b.impressionsDelivered) || 0) / Math.max(1, Number(b.impressionsPurchased) || 1); };
  posts.sort((a, b) => share(a.id) - share(b.id)); items.sort((a, b) => share(a.id) - share(b.id));
  const t = now.getTime();
  const ads: SlotCandidate[] = (await loadActiveAds())
    .filter((a) => a.placements?.includes("digest") && (!a.startsAt || new Date(a.startsAt).getTime() <= t) && (!a.endsAt || new Date(a.endsAt).getTime() >= t))
    .map((a) => ({ kind: "ad" as const, id: a.id, title: a.title, text: a.text || undefined, image: abs(a.image, null), href: digestGo("a", a.id), label: AD_FOOTER[a.provider ?? "notesapp"], paid: !!(a as { campaignId?: string }).campaignId }));
  return { posts, items, ads, left, slots: cfg.digestSlots };
}

// What this batch's emails carried: each email sent is one impression. Boosts: added to impressionsDelivered and today's
// count (never past what was bought; a boost that reaches it is completed). Adverts: added to adStats for the day, under the
// digest spot, so campaign budgets and reports include them.
export async function countSends(db: Firestore, sends: Map<string, number>, now = new Date()): Promise<void> {
  const today = boostDay(now), day = lagosDay(now);
  for (const [key, n] of sends) {
    const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    if (n <= 0) continue;
    if (kind === "ad") {
      const inc = FieldValue.increment(n);
      await db.doc(`adStats/${id}_${day}`).set({ adId: id, day, impressions: inc, byPlacement: { digest: { impressions: inc } } }, { merge: true }).catch(() => {});
      continue;
    }
    await db.runTransaction(async (t) => {
      const ref = db.doc(`boosts/${id}`);
      const b = (await t.get(ref)).data();
      if (!b || b.status !== "active") return;
      const room = Math.max(0, (Number(b.impressionsPurchased) || 0) - (Number(b.impressionsDelivered) || 0));
      const add = Math.min(n, room);
      if (add <= 0) return;
      const done = (Number(b.impressionsDelivered) || 0) + add >= (Number(b.impressionsPurchased) || 0);
      t.update(ref, {
        impressionsDelivered: FieldValue.increment(add), [`daily.${today}`]: FieldValue.increment(add), digestSends: FieldValue.increment(add),
        ...(done ? { status: "completed", completedAt: now.toISOString() } : {}),
      });
    }).catch(() => {});
  }
}

// ---- one member's email ----
// sponsors: this week's boosts and adverts (weekSponsors); the slots chosen are in the result's `sponsored`, and the boosts'
// `left` counts go down by one for each, so a batch never carries a boost past its daily cap.
export async function buildDigest(db: Firestore, uid: string, pool: PoolStory[], market: PoolItem[] = [], courses: PoolItem[] = [], sponsors?: Sponsors): Promise<DigestEmail | null> {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || u.suspended === true || !u.username || NO_INBOX.has(String(u.username))) return null;
  const follows = await db.collection("follows").where("followerUid", "==", uid).limit(500).get();
  const interests = Array.isArray(u.interests) ? u.interests.map(String) : [];
  const stories = pickStories(pool, { uid, follows: new Set(follows.docs.map((d) => String(d.data().username))), interests });
  if (!stories.length) return null;
  let sponsored: DigestSponsored[] = [];
  if (sponsors && sponsors.slots > 0) {
    const open = (x: SlotCandidate) => x.kind === "ad" || (sponsors.left.get(x.id) ?? 0) > 0;
    sponsored = fillSlots({ posts: sponsors.posts.filter(open), items: sponsors.items.filter(open), ads: sponsors.ads }, { uid, interests, storyHrefs: new Set(stories.map((s) => s.href)) }, sponsors.slots);
    for (const x of sponsored) if (x.kind !== "ad") sponsors.left.set(x.id, (sponsors.left.get(x.id) ?? 1) - 1);
  }
  return {
    reader: { name: String(u.displayName || u.username), username: String(u.username), avatar: abs(u.avatar, `${SITE_URL}${DEFAULT_AVATAR}`)! },
    stories, market: pickItems(market, { uid, interests }), courses: pickItems(courses, { uid, interests }), sponsored, site: SITE_URL, appUrl: `${APP_URL}/install`, unsubscribeUrl: unsubscribeUrl(uid), interestsUrl: `${SITE_URL}${INTERESTS_PATH}`, settingsUrl: `${SITE_URL}${EMAIL_SETTINGS_PATH}`,
    company: `${COMPANY_INFO.legalName} · RC ${COMPANY_INFO.rcNumber}`,
  };
}

export async function sendDigest(to: string, uid: string, d: DigestEmail): Promise<boolean> {
  const url = unsubscribeUrl(uid);
  return sendEmail({
    to, subject: digestSubject(d), text: renderDigestText(d), html: renderDigestHtml(d),
    // One-click unsubscribe in Gmail, Yahoo and Apple Mail (RFC 8058): they POST to the link.
    headers: { "List-Unsubscribe": `<${url}>, <mailto:${CONTACT_EMAIL}?subject=unsubscribe%20weekly%20digest>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
}

// ---- the weekly send (called by the reminders cron) ----
// The Sunday 5 PM Lagos time that starts the current week's digest, as a timestamp, and its id (2026-10-18).
export function digestWeek(now = new Date()): { startsAt: number; id: string } {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS);
  const sunday = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() - lagos.getUTCDay(), 17) - LAGOS_OFFSET_MS);
  const startsAt = sunday.getTime() > now.getTime() ? sunday.getTime() - WEEK_MS : sunday.getTime();
  return { startsAt, id: new Date(startsAt + LAGOS_OFFSET_MS).toISOString().slice(0, 10) };
}

export async function sendWeeklyDigests(db: Firestore, now = new Date()): Promise<number> {
  if (!secret() || !(await digestOn(db))) return 0;
  const week = digestWeek(now);
  if (now.getTime() - week.startsAt > RUN_WINDOW_MS) return 0;
  const runRef = db.doc(`digestRuns/${week.id}`);
  const run = (await runRef.get()).data() ?? {};
  if (run.done) return 0;
  // Each run claims the next batch (by member id) before sending, so two overlapping runs never email the same people.
  const batch = await db.runTransaction(async (t) => {
    const r = (await t.get(runRef)).data() ?? {};
    if (r.done) return null;
    let q = db.collection("users").orderBy(FieldPath.documentId()).limit(perRun());
    if (r.cursor) q = q.startAfter(String(r.cursor));
    const users = await t.get(q);
    t.set(runRef, { cursor: users.empty ? r.cursor ?? null : users.docs[users.docs.length - 1].id, done: users.size < perRun(), startedAt: r.startedAt ?? now.toISOString(), updatedAt: now.toISOString() }, { merge: true });
    return users.docs.map((d) => d.id);
  });
  if (!batch?.length) return 0;

  const pool = await weekPool(db, now);
  if (!pool.length) return 0;
  const [market, courses, sponsors] = await Promise.all([weekMarket(db, now).catch(() => []), weekCourses(db, now).catch(() => []), weekSponsors(db, now, pool).catch(() => undefined)]);
  const [prefs, auth] = await Promise.all([
    db.getAll(...batch.map((uid) => db.doc(`emailPrefs/${uid}`))),
    getAuth(getAdminApp()).getUsers(batch.map((uid) => ({ uid }))),
  ]);
  const optedOut = new Set(prefs.filter((p) => p.data()?.weeklyDigest === false).map((p) => p.id));
  const email = new Map(auth.users.filter((a) => a.email && a.emailVerified && !a.disabled).map((a) => [a.uid, a.email!]));
  let sent = 0;
  const sends = new Map<string, number>(); // "post:<boostId>" / "item:<boostId>" / "ad:<adId>" → emails sent carrying it
  for (const uid of batch) {
    const to = email.get(uid);
    if (!to || optedOut.has(uid)) continue;
    const d = await buildDigest(db, uid, pool, market, courses, sponsors).catch(() => null);
    if (!d) continue;
    if (await sendDigest(to, uid, d)) {
      sent++;
      for (const x of d.sponsored ?? []) sends.set(`${x.kind === "ad" ? "ad" : "boost"}:${x.id}`, (sends.get(`${x.kind === "ad" ? "ad" : "boost"}:${x.id}`) ?? 0) + 1);
    } else for (const x of d.sponsored ?? []) if (x.kind !== "ad" && sponsors) sponsors.left.set(x.id, (sponsors.left.get(x.id) ?? 0) + 1); // not sent: give it back
  }
  if (sent) await runRef.set({ sent: FieldValue.increment(sent) }, { merge: true }).catch(() => {});
  await countSends(db, sends, now);
  return sent;
}
