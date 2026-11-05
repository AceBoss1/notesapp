import { getFanSettings } from "./fans-server";
import type { Firestore } from "firebase-admin/firestore";
import { KbError, cleanArticle, type KbArticle } from "./kb";
import { builtInArticles, type KbLive } from "./kb-articles";
import { currentPricing } from "./pricing";
import { ensurePricing } from "./pricing-server";
import { getLimitOverrides } from "./limits-server";
import { getAgentSettings } from "./agents/config-server";
import { getRoomSettings, liveRoomFigures } from "./rooms-server";
import { paidLiveFigures } from "./rooms";
import { liveRecordingFigures } from "./live-recording-server";

// The knowledge base the Help centre and Nana AI read: the built-in articles plus whatever staff have written at Admin → Help & Nana.
// A staff article with the same slug as a built-in one replaces it (that is how staff correct or extend a built-in answer); unpublish or
// delete it to bring the built-in text back. Staff articles live in the server-only collection `kbArticles`.
const COL = "kbArticles";

type StaffDoc = { slug: string; title: string; category: KbArticle["category"]; body: string; published: boolean; updatedAt: string; updatedByEmail?: string };

let cache: { at: number; key: string; list: KbArticle[] } | null = null;
export const clearKbCache = () => { cache = null; };

export async function staffArticles(db: Firestore): Promise<(StaffDoc & { id: string })[]> {
  const snap = await db.collection(COL).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as StaffDoc) })).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

// The admin-set numbers the built-in articles quote: prices and rates (Admin → Pricing, applied to the live objects), the plan limits and
// the Nana and connected-agent settings (Admin → Limits). Each read is cached for half a minute or less, so this is cheap. A failed read
// keeps what is in force (or the defaults) rather than blanking the help.
export async function loadKbLive(db: Firestore): Promise<KbLive> {
  const [limits, agents, , rooms, recording, fans] = await Promise.all([
    getLimitOverrides(db).catch(() => undefined),
    getAgentSettings(db).catch(() => undefined),
    ensurePricing(db).catch(() => undefined),
    // Audio room sizes (Admin → Limits → Audio rooms): what a room opened now holds.
    liveRoomFigures(db).catch(() => undefined),
    // Live recording (Admin → Limits → Live recording): keep days, the longest recording, whether the recorder is set up.
    liveRecordingFigures(db).catch(() => undefined),
    // Subscription tiers and fans (Admin → Limits → Subscriptions and fans): the tier ranges and the VIP/VVIP commission shares.
    getFanSettings(db).catch(() => undefined),
  ]);
  // Paid lives (Admin → Limits → Audio rooms → Paid lives): the late window, the discount cap, the no-show minutes.
  const paid = await getRoomSettings(db).then(paidLiveFigures).catch(() => undefined);
  return { limits, agents, rooms, recording, fans, paid };
}

// Everything readers and Nana can see, cached for a minute, and built again at once when an admin's change alters a figure the articles
// quote (before, the help was built from whatever prices this server instance happened to hold, often the defaults, and never the limits).
export async function getArticles(db: Firestore, now = Date.now()): Promise<KbArticle[]> {
  const live = await loadKbLive(db);
  const key = JSON.stringify([currentPricing(), live]);
  if (cache && cache.key === key && now - cache.at < 60_000) return cache.list;
  const staff = (await staffArticles(db).catch(() => [])).filter((a) => a.published);
  const bySlug = new Map<string, KbArticle>(builtInArticles(live).map((a) => [a.slug, a]));
  for (const s of staff) bySlug.set(s.slug, { slug: s.slug, title: s.title, category: s.category, body: s.body, updatedAt: s.updatedAt, source: "staff" });
  const list = [...bySlug.values()];
  cache = { at: now, key, list };
  return list;
}

export async function getArticle(db: Firestore, slug: string): Promise<KbArticle | null> {
  return (await getArticles(db)).find((a) => a.slug === slug) ?? null;
}

// Staff: create or update (the slug is the document id). Replacing a built-in article just means saving one with its slug.
export async function saveArticle(db: Firestore, byEmail: string, input: { slug?: unknown; title?: unknown; category?: unknown; body?: unknown; published?: unknown }, now = new Date()) {
  const a = cleanArticle(input);
  await db.collection(COL).doc(a.slug).set({ ...a, published: input.published !== false, updatedAt: now.toISOString(), updatedByEmail: byEmail });
  clearKbCache();
  return a.slug;
}

export async function setPublished(db: Firestore, slug: string, published: boolean, byEmail: string, now = new Date()) {
  const ref = db.collection(COL).doc(slug);
  if (!(await ref.get()).exists) throw new KbError("That article wasn't found.", 404);
  await ref.update({ published, updatedAt: now.toISOString(), updatedByEmail: byEmail });
  clearKbCache();
}

export async function deleteArticle(db: Firestore, slug: string) {
  const ref = db.collection(COL).doc(slug);
  if (!(await ref.get()).exists) throw new KbError("That article wasn't found.", 404);
  await ref.delete();
  clearKbCache();
}
