import type { Firestore } from "firebase-admin/firestore";
import type { ToolResult } from "./protocol";
import { SITE_URL } from "@/lib/host";
import { WEEKDAYS, formatNaira, formatSlot, weekdayOf, type PublisherSettings } from "@/lib/booking-time";
import { slotLockId } from "@/lib/paystack";
import { addDays, lagosDate } from "@/lib/team";
import { getMarket } from "@/lib/shop-directory";
import { getAcademy } from "@/lib/courses-server";
import { ttlCache } from "@/lib/ttl-cache";
import { topicLabel, topicsOf } from "@/lib/topics";
import { fold } from "@/lib/chat-tools";

// The tools of the NotesApp MCP server, phase 1: everything reads, nothing changes.
//   Anyone: find creators, journals, store items and courses; a creator's public profile, open session times and booking link.
//   A member with their own API key (Console → API; the key's scopes apply): their profile, posts, bookings, orders and earnings,
//   through the same /api/v1 code the REST API uses.
// Booking, buying and paying always happen on #NotesApp: the tools hand back links. Text members wrote is labelled as such.
export { MEMBER_TEXT, TOOLS } from "./catalog";
import { MEMBER_TEXT } from "./catalog";
const LIMIT_MAX = 20;
const limitOf = (v: unknown, d = 10) => Math.min(LIMIT_MAX, Math.max(1, Math.round(Number(v)) || d));
const str = (v: unknown, n = 120) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const matches = (q: string, ...hay: unknown[]) => !q || hay.some((h) => typeof h === "string" && fold(h).includes(q));
const site = () => SITE_URL;
export class ToolError extends Error {}

// ---- public data, cached for 10 minutes per server ----
type Creator = { uid: string; username: string; name: string; bio: string; job: string; industry: string; workplace: string; avatar: string; isOrg: boolean; social: Record<string, string> };
type Bookable = { minutes: number; priceKobo: number };
export type PublicData = { creators: () => Promise<Creator[]>; bookable: () => Promise<Map<string, Bookable>>; journals: () => Promise<FirebaseFirestore.DocumentData[]> };

export function publicData(db: Firestore): PublicData {
  return {
    creators: ttlCache(600_000, async () => (await db.collection("users").select("username", "displayName", "bio", "jobTitle", "industry", "workplace", "avatar", "accountKind", "suspended", "social").get()).docs
      .map((d) => ({ d: d.data(), uid: d.id }))
      .filter(({ d }) => d.username && d.suspended !== true)
      .map(({ d, uid }) => ({ uid, username: String(d.username), name: String(d.displayName ?? d.username), bio: String(d.bio ?? ""), job: String(d.jobTitle ?? ""), industry: String(d.industry ?? ""), workplace: String(d.workplace ?? ""), avatar: String(d.avatar ?? ""), isOrg: d.accountKind === "organisation", social: (d.social as Record<string, string>) ?? {} }))),
    // Who takes paid sessions: their session is on and they can be paid (a payout account). Only the yes/no leaves this file.
    bookable: ttlCache(600_000, async () => {
      const [settings, payouts] = await Promise.all([db.collection("publisherSettings").where("session.enabled", "==", true).get(), db.collection("payoutAccounts").select("recipientCode").get()]);
      const paid = new Set(payouts.docs.filter((d) => d.data().recipientCode).map((d) => d.id));
      return new Map(settings.docs.filter((d) => paid.has(d.id)).map((d) => [d.id, { minutes: Number(d.data().session?.minutes) || 0, priceKobo: Number(d.data().session?.priceKobo) || 0 }]));
    }),
    journals: ttlCache(600_000, async () => (await db.collection("notes").where("status", "==", "published").select("title", "slug", "author", "authorUsername", "date", "topics", "categories", "tags", "premium", "content", "featured_image").get()).docs
      .map((d) => d.data()).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))),
  };
}
let shared: { db: Firestore; data: PublicData } | null = null;
const dataFor = (db: Firestore) => (shared?.db === db ? shared.data : (shared = { db, data: publicData(db) }).data);

const excerpt = (md: string, n = 220) => {
  const t = String(md ?? "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_`~]+/g, "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, "")}…` : t;
};
const bookingUrl = (username: string, date?: string, time?: string) => `${site()}/u/${username}${date ? `?date=${date}${time ? `&time=${time}` : ""}` : ""}#book`;

async function creatorByUsername(db: Firestore, raw: unknown): Promise<Creator> {
  const username = str(raw, 40).replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,39}$/.test(username)) throw new ToolError("Give a #NotesApp username, like ada.");
  const c = (await dataFor(db).creators()).find((x) => x.username.toLowerCase() === username);
  if (!c) throw new ToolError(`No #NotesApp creator called @${username}.`);
  return c;
}

// Open times: the creator's weekly availability minus what is already booked, from tomorrow (the booking card's first day).
export async function openSlots(db: Firestore, username: string, uid: string, from: string, days: number) {
  const s = ((await db.doc(`publisherSettings/${uid}`).get()).data() as PublisherSettings | undefined)?.session;
  if (!s?.enabled) return [];
  const out: { date: string; day: string; time: string; label: string; booking_url: string }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const cands = s.availability[String(weekdayOf(date))] || [];
    if (!cands.length) continue;
    const taken = await db.getAll(...cands.map((slot) => db.doc(`slotLocks/${slotLockId(username, date, slot)}`)));
    cands.forEach((slot, k) => { if (!taken[k].exists) out.push({ date, day: WEEKDAYS[weekdayOf(date)], time: slot, label: `${WEEKDAYS[weekdayOf(date)]} ${date}, ${formatSlot(slot)} WAT`, booking_url: bookingUrl(username, date, slot) }); });
  }
  return out;
}

export async function publicTool(db: Firestore, name: string, a: Record<string, unknown>, now = new Date()): Promise<ToolResult> {
  const data = dataFor(db);
  const q = fold(str(a.query).replace(/^@/, ""));
  const limit = limitOf(a.limit);
  switch (name) {
    case "search_creators": {
      const [all, bookable] = await Promise.all([data.creators(), data.bookable()]);
      const rows = all.filter((c) => matches(q, c.name, c.username, c.job, c.industry, c.workplace, c.bio) && (!a.bookable || bookable.has(c.uid)))
        .sort((x, y) => Number(bookable.has(y.uid)) - Number(bookable.has(x.uid)))
        .slice(0, limit)
        .map((c) => ({ username: c.username, name: c.name, headline: [c.job, c.workplace].filter(Boolean).join(" at ") || c.industry, bio: excerpt(c.bio, 160), organisation: c.isOrg, takes_bookings: bookable.has(c.uid), profile_url: `${site()}/u/${c.username}` }));
      return { data: { note: MEMBER_TEXT, count: rows.length, creators: rows } };
    }
    case "get_creator": {
      const c = await creatorByUsername(db, a.username);
      const [bookable, journals] = await Promise.all([data.bookable(), data.journals()]);
      const b = bookable.get(c.uid);
      const latest = journals.filter((n) => String(n.authorUsername ?? "").toLowerCase() === c.username.toLowerCase()).slice(0, 5).map((n) => ({ title: n.title, url: `${site()}/journals/${n.slug}`, date: n.date }));
      return { data: { note: MEMBER_TEXT, username: c.username, name: c.name, headline: [c.job, c.workplace].filter(Boolean).join(" at "), industry: c.industry, bio: c.bio.slice(0, 1000), organisation: c.isOrg, avatar: c.avatar, links: c.social, profile_url: `${site()}/u/${c.username}`, sessions: b ? { minutes: b.minutes, price: formatNaira(b.priceKobo), price_kobo: b.priceKobo, booking_url: bookingUrl(c.username) } : null, latest_journals: latest } };
    }
    case "get_open_slots": {
      const c = await creatorByUsername(db, a.username);
      const b = (await data.bookable()).get(c.uid);
      if (!b) return { data: { username: c.username, takes_bookings: false, slots: [], message: `@${c.username} doesn't take paid sessions on #NotesApp right now.` } };
      const tomorrow = addDays(lagosDate(now), 1);
      const from = /^\d{4}-\d{2}-\d{2}$/.test(str(a.from)) && str(a.from) > tomorrow ? str(a.from) : tomorrow;
      if (from > addDays(tomorrow, 90)) throw new ToolError("Look at most 90 days ahead.");
      const days = Math.min(14, Math.max(1, Math.round(Number(a.days)) || 7));
      const slots = await openSlots(db, c.username, c.uid, from, days);
      return { data: { username: c.username, minutes: b.minutes, price: formatNaira(b.priceKobo), price_kobo: b.priceKobo, timezone: "Africa/Lagos (WAT, UTC+1)", from, days, slots, booking_url: bookingUrl(c.username), how_to_book: "Open a booking_url: the person signs in, picks the time and pays on #NotesApp. Agents can't book or pay." } };
    }
    case "get_booking_link": {
      const c = await creatorByUsername(db, a.username);
      const b = (await data.bookable()).get(c.uid);
      if (!b) return { data: { username: c.username, takes_bookings: false, message: `@${c.username} doesn't take paid sessions on #NotesApp right now.`, profile_url: `${site()}/u/${c.username}` } };
      const date = /^\d{4}-\d{2}-\d{2}$/.test(str(a.date)) ? str(a.date) : undefined;
      const time = date && /^\d{2}:\d{2}$/.test(str(a.time)) ? str(a.time) : undefined;
      return { data: { username: c.username, booking_url: bookingUrl(c.username, date, time), minutes: b.minutes, price: formatNaira(b.priceKobo), note: "The person signs in, confirms the time and pays on #NotesApp." } };
    }
    case "search_store": {
      const kind = a.kind === "digital" ? "digital" : a.kind === "physical" ? "physical" : "";
      const rows = (await getMarket()).items
        .filter((i) => matches(q, i.title, i.category, i.sellerName, i.sellerUsername, ...i.topics) && (!kind || (kind === "digital" ? i.kind === "digital" : i.kind !== "digital")))
        .sort((x, y) => (y.viewsWeek ?? 0) - (x.viewsWeek ?? 0))
        .slice(0, limit)
        .map((i) => ({ title: i.title, price: i.price, kind: i.kind === "digital" ? "digital" : "physical", category: i.category, seller: i.sellerName, seller_username: i.sellerUsername, image: i.image, url: i.href.startsWith("http") ? i.href : `${site()}${i.href}` }));
      return { data: { note: MEMBER_TEXT, count: rows.length, items: rows, how_to_buy: "Open the item's url: the buyer pays on #NotesApp." } };
    }
    case "search_journals": {
      const topic = fold(str(a.topic, 40).replace(/^#/, ""));
      const rows = (await data.journals())
        .filter((n) => (!topic || topicsOf(n).some((t) => fold(t) === topic || fold(topicLabel(t)) === topic)) && matches(q, n.title, n.author, n.authorUsername, excerpt(n.content, 600)))
        .slice(0, limit)
        .map((n) => ({ title: n.title, author: n.author, author_username: n.authorUsername ?? null, date: n.date, topics: topicsOf(n), members_only: !!n.premium, excerpt: n.premium ? "" : excerpt(n.content), url: `${site()}/journals/${n.slug}` }));
      return { data: { note: MEMBER_TEXT, count: rows.length, journals: rows } };
    }
    case "search_courses": {
      const rows = (await getAcademy())
        .filter((c) => matches(q, c.title, c.summary, c.ownerName, c.ownerUsername, ...c.topics))
        .slice(0, limit)
        .map((c) => ({ title: c.title, summary: excerpt(c.summary, 220), teacher: c.ownerName, teacher_username: c.ownerUsername, lessons: c.lessonCount, minutes: c.minutes, free: !(c.priceKobo > 0), price: c.priceKobo > 0 ? `₦${Math.round(c.priceKobo / 100).toLocaleString("en-GB")}` : "Free", level: c.level || undefined, topics: c.topics, url: `${site()}/academy/${c.slug}` }));
      return { data: { note: MEMBER_TEXT, count: rows.length, courses: rows } };
    }
  }
  throw new ToolError(`Unknown tool: ${name}.`);
}

// The member tools, through /api/v1 with the caller's own key (its checks, scopes, rate limits and answers, unchanged).
export const MEMBER_ROUTES: Record<string, { path: string; query: (a: Record<string, unknown>) => Record<string, string> }> = {
  my_profile: { path: "/api/v1/me", query: () => ({}) },
  my_posts: { path: "/api/v1/posts", query: (a) => ({ ...(a.status === "draft" || a.status === "published" ? { status: a.status } : {}), limit: String(limitOf(a.limit)) }) },
  my_bookings: { path: "/api/v1/bookings", query: (a) => ({ ...(str(a.status, 20) ? { status: str(a.status, 20) } : {}), limit: String(limitOf(a.limit)) }) },
  my_orders: { path: "/api/v1/orders", query: (a) => ({ ...(a.kind === "digital" ? { kind: "digital" } : {}), ...(str(a.status, 20) ? { status: str(a.status, 20) } : {}), limit: String(limitOf(a.limit)) }) },
  my_earnings: { path: "/api/v1/earnings", query: (a) => ({ limit: String(limitOf(a.limit)) }) },
};
