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
import { digestSubject, pickStories, renderDigestHtml, renderDigestText, type DigestEmail, type DigestItem, type PoolStory } from "./digest";
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
// What: up to 5 journals published in the last 7 days: people they follow first, then their interests (users/{uid}.interests,
// the hashtags they choose), then the week's most liked. Never their own. Then Notes Market (weekMarket: the two most viewed
// items this week and the two most bought in the last 30 days) and Notes Academy (weekCourses: the two most viewed courses
// this week and the two most enrolled in the last 30 days); a section with nothing in it is left out.
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
  // The 60 most liked are enough to choose 5 from for anyone; count their comments.
  notes.sort((a, b) => (Number(b.n.likeCount) || 0) - (Number(a.n.likeCount) || 0));
  const top = notes.slice(0, 60);
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

// The Market section, the same for everyone that week: the two most viewed items this week (all-time views when nothing was
// counted this week), then the two most bought in the last 30 days that aren't already there.
export async function weekMarket(db: Firestore, now = new Date()): Promise<DigestItem[]> {
  const { items } = await getMarket();
  if (!items.length) return [];
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [orders, digital] = await Promise.all([
    db.collection("storeOrders").where("paidAt", ">=", since).get(), // one field each, no index needed
    db.collection("digitalPurchases").where("createdAt", ">=", since).get(),
  ]);
  const sold = new Map<string, number>();
  for (const d of orders.docs) if (d.data().status !== "refunded") sold.set(String(d.data().itemId), (sold.get(String(d.data().itemId)) ?? 0) + (Number(d.data().quantity) || 1));
  for (const d of digital.docs) sold.set(String(d.data().itemId), (sold.get(String(d.data().itemId)) ?? 0) + 1);
  const week = items.some((i) => i.viewsWeek > 0);
  const heat = (i: MarketItem) => (week ? i.viewsWeek : i.views);
  const viewed = items.filter((i) => heat(i) > 0).sort((a, b) => heat(b) - heat(a)).slice(0, 2);
  const bought = items.filter((i) => (sold.get(i.id) ?? 0) > 0 && !viewed.includes(i)).sort((a, b) => (sold.get(b.id) ?? 0) - (sold.get(a.id) ?? 0)).slice(0, 2);
  const row = (i: MarketItem, why: string): DigestItem => ({ title: i.title, href: i.href.startsWith("/") ? `${SITE_URL}${i.href}` : i.href, image: abs(i.image, null), price: i.price, by: i.sellerName, why });
  return [
    ...viewed.map((i) => row(i, `${heat(i).toLocaleString("en-GB")} views ${week ? "this week" : "so far"}`)),
    ...bought.map((i) => row(i, `${sold.get(i.id)} bought in the last 30 days`)),
  ];
}

// The Academy section, the same for everyone that week: the two most viewed published courses this week, then the two with the
// most new learners in the last 30 days that aren't already there. Courses of suspended teachers are left out.
export async function weekCourses(db: Firestore, now = new Date()): Promise<DigestItem[]> {
  if (!ACADEMY_LIVE) return [];
  const snap = await db.collection("courses").where("status", "==", "published").get();
  if (snap.empty) return [];
  const since = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const [views, enrolled] = await Promise.all([
    db.collection("pageViews").where("day", ">=", since(7).slice(0, 10)).get(), // one field each, no index needed
    db.collection("enrolments").where("enrolledAt", ">=", since(30)).get(),
  ]);
  const week = new Map<string, number>(), joined = new Map<string, number>();
  for (const d of views.docs) if (d.data().kind === "course") week.set(String(d.data().id), (week.get(String(d.data().id)) ?? 0) + (Number(d.data().count) || 0));
  for (const d of enrolled.docs) joined.set(String(d.data().courseId), (joined.get(String(d.data().courseId)) ?? 0) + 1);
  const courses = snap.docs.map((d) => ({ id: d.id, c: d.data() }));
  const owners = await db.getAll(...Array.from(new Set(courses.map(({ c }) => String(c.ownerUid)))).map((u) => db.doc(`users/${u}`)));
  const ok = new Set(owners.filter((o) => o.exists && o.data()?.suspended !== true).map((o) => o.id));
  const live = courses.filter(({ c }) => ok.has(String(c.ownerUid)));
  const viewed = live.filter(({ id }) => (week.get(id) ?? 0) > 0).sort((a, b) => (week.get(b.id) ?? 0) - (week.get(a.id) ?? 0)).slice(0, 2);
  const popular = live.filter((x) => (joined.get(x.id) ?? 0) > 0 && !viewed.includes(x)).sort((a, b) => (joined.get(b.id) ?? 0) - (joined.get(a.id) ?? 0)).slice(0, 2);
  const name = new Map(owners.map((o) => [o.id, String(o.data()?.displayName || o.data()?.username || "")]));
  const row = ({ id, c }: { id: string; c: FirebaseFirestore.DocumentData }, why: string): DigestItem => ({
    title: String(c.title ?? ""), href: `${SITE_URL}${courseHref(String(c.slug ?? id))}`, image: abs(c.cover, null), price: priceLabel(c), by: name.get(String(c.ownerUid)) || String(c.ownerName ?? ""), why,
  });
  return [
    ...viewed.map((x) => row(x, `${(week.get(x.id) ?? 0).toLocaleString("en-GB")} views this week`)),
    ...popular.map((x) => row(x, `${joined.get(x.id)} enrolled in the last 30 days`)),
  ];
}

// ---- one member's email ----
export async function buildDigest(db: Firestore, uid: string, pool: PoolStory[], market: DigestItem[] = [], courses: DigestItem[] = []): Promise<DigestEmail | null> {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || u.suspended === true || !u.username || NO_INBOX.has(String(u.username))) return null;
  const follows = await db.collection("follows").where("followerUid", "==", uid).limit(500).get();
  const stories = pickStories(pool, { uid, follows: new Set(follows.docs.map((d) => String(d.data().username))), interests: Array.isArray(u.interests) ? u.interests.map(String) : [] });
  if (!stories.length) return null;
  return {
    reader: { name: String(u.displayName || u.username), username: String(u.username), avatar: abs(u.avatar, `${SITE_URL}${DEFAULT_AVATAR}`)! },
    stories, market, courses, site: SITE_URL, appUrl: `${APP_URL}/install`, unsubscribeUrl: unsubscribeUrl(uid), interestsUrl: `${SITE_URL}${INTERESTS_PATH}`, settingsUrl: `${SITE_URL}${EMAIL_SETTINGS_PATH}`,
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
  const [market, courses] = await Promise.all([weekMarket(db, now).catch(() => []), weekCourses(db, now).catch(() => [])]);
  const [prefs, auth] = await Promise.all([
    db.getAll(...batch.map((uid) => db.doc(`emailPrefs/${uid}`))),
    getAuth(getAdminApp()).getUsers(batch.map((uid) => ({ uid }))),
  ]);
  const optedOut = new Set(prefs.filter((p) => p.data()?.weeklyDigest === false).map((p) => p.id));
  const email = new Map(auth.users.filter((a) => a.email && a.emailVerified && !a.disabled).map((a) => [a.uid, a.email!]));
  let sent = 0;
  for (const uid of batch) {
    const to = email.get(uid);
    if (!to || optedOut.has(uid)) continue;
    const d = await buildDigest(db, uid, pool, market, courses).catch(() => null);
    if (d && (await sendDigest(to, uid, d))) sent++;
  }
  if (sent) await runRef.set({ sent: FieldValue.increment(sent) }, { merge: true }).catch(() => {});
  return sent;
}
