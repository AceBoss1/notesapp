import { getAdminDb } from "./firebase-admin";
import { ttlCache } from "./ttl-cache";
import { CATEGORY_TOPICS, categoryOf } from "./store-meta";
import { cleanTopics } from "./topics";

// The shops listed under "Individual Shops" on the Merch Store page: every publisher who can take an order right now.
// A shop is listed when it has at least one buyable item (a physical item in stock, or a download with its file
// attached), the owner has a payout account (checkout refuses orders without one), the account isn't suspended, and
// neither the owner (shopListed === false) nor an admin (shopHidden) has taken it off. Boosted shops come first, then the
// shops whose newest item is most recent. Founder shops are shown separately, above these.
export type DirectoryShop = {
  uid: string;
  username: string;
  displayName: string;
  avatar: string;
  isOrg?: boolean; // organisations get a rounded-square picture, people a circle
  itemCount: number;
  images: string[]; // up to 3
  href: string; // their own domain when they have an active one, else /u/<username>/store
  boosted: boolean;
  newestAt: string;
  hiddenBy?: "owner" | "admin"; // only set (when switched off) for the admin view
};

// One item in Notes Market (/shop): every buyable item of every listed shop, with its seller, visits and topics.
export type MarketItem = {
  id: string; title: string; price: string; image: string; kind: string; category: string; topics: string[]; createdAt: string;
  sellerUid: string; sellerUsername: string; sellerName: string; sellerAvatar: string; sellerIsOrg: boolean; href: string;
  views: number; viewsWeek: number; favs: number;
};

async function build(includeHidden: boolean): Promise<DirectoryShop[]> {
  return (await buildAll(includeHidden)).shops;
}
async function buildAll(includeHidden: boolean): Promise<{ shops: DirectoryShop[]; items: MarketItem[] }> {
  const db = getAdminDb();
  const [itemsSnap, boostsSnap, domainsSnap] = await Promise.all([
    db.collection("storeItems").where("sellable", "==", true).get(),
    db.collection("boosts").where("status", "==", "active").get(),
    db.collection("customDomains").where("status", "==", "active").get(),
  ]);

  const byOwner = new Map<string, FirebaseFirestore.DocumentData[]>();
  for (const d of itemsSnap.docs) {
    const i = d.data();
    const buyable = i.kind === "digital" ? !!i.fileName || Number(i.lessonCount) > 0 : Number(i.stock) > 0;
    if (!buyable || !i.ownerUid) continue;
    byOwner.set(i.ownerUid, [...(byOwner.get(i.ownerUid) || []), { ...i, id: d.id }]);
  }
  const now = Date.now();
  const boosted = new Set(
    boostsSnap.docs.map((b) => b.data()).filter((b) => b.itemId && new Date(b.endsAt).getTime() > now && b.impressionsDelivered < b.impressionsPurchased).map((b) => b.publisherUid as string)
  );
  const domainOf = new Map(domainsSnap.docs.map((d) => [d.data().uid as string, d.data().host as string]));

  const shops: DirectoryShop[] = [];
  const market: MarketItem[] = [];
  await Promise.all(
    [...byOwner.entries()].map(async ([uid, items]) => {
      const [userSnap, payoutSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`payoutAccounts/${uid}`).get()]);
      const u = userSnap.data();
      if (!u || u.suspended === true || !u.username) return;
      if (!(payoutSnap.exists && payoutSnap.data()?.recipientCode)) return;
      const hiddenBy = u.shopHidden === true ? ("admin" as const) : u.shopListed === false ? ("owner" as const) : undefined;
      if (hiddenBy && !includeHidden) return;
      const sorted = items.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      const host = domainOf.get(uid);
      shops.push({
        uid,
        username: u.username,
        displayName: u.displayName || u.username,
        avatar: u.avatar || "",
        isOrg: u.accountKind === "organisation",
        itemCount: items.length,
        images: sorted.slice(0, 3).map((i) => String(i.images?.[0] || i.image || "")).filter(Boolean),
        href: host ? `https://${host}` : `/u/${u.username}/store`,
        boosted: boosted.has(uid),
        newestAt: String(sorted[0]?.createdAt || ""),
        ...(includeHidden && hiddenBy ? { hiddenBy } : {}),
      });
      if (hiddenBy) return;
      for (const i of sorted) {
        const category = categoryOf(i);
        market.push({
          id: String(i.id), title: String(i.title ?? ""), price: String(i.price ?? ""), image: String(i.images?.[0] || i.image || ""), kind: String(i.kind ?? "physical"),
          category, topics: Array.isArray(i.topics) && i.topics.length ? cleanTopics(i.topics, 3) : CATEGORY_TOPICS[category], createdAt: String(i.createdAt ?? ""),
          sellerUid: uid, sellerUsername: String(u.username), sellerName: String(u.displayName || u.username), sellerAvatar: String(u.avatar ?? ""), sellerIsOrg: u.accountKind === "organisation",
          href: host ? `https://${host}/shop/${i.id}` : `/shop/${i.id}`, views: 0, viewsWeek: 0, favs: 0,
        });
      }
    })
  );
  // Visits and favourites: lifetime from storeStats, this week from the day buckets (lib/store-stats-server.ts recordView).
  if (market.length) {
    const stats = await db.getAll(...market.map((m) => db.doc(`storeStats/${m.id}`)));
    stats.forEach((st, i) => { market[i].views = Number(st.data()?.views) || 0; market[i].favs = Number(st.data()?.favs) || 0; });
    const week = await db.collection("pageViews").where("day", ">=", new Date(now - 7 * 86_400_000).toISOString().slice(0, 10)).get();
    const byId = new Map(market.map((m) => [m.id, m]));
    week.docs.forEach((d) => { const b = d.data(); if (b.kind === "item") { const m = byId.get(String(b.id)); if (m) m.viewsWeek += Number(b.count) || 0; } });
  }
  return { shops: shops.sort((a, b) => Number(b.boosted) - Number(a.boosted) || b.newestAt.localeCompare(a.newestAt)), items: market };
}

const everything = ttlCache(60_000, () => buildAll(false));
const listed = async () => (await everything()).shops;
// Notes Market (/shop, GET /api/public/market): every buyable item of the listed shops.
export const getMarket = async (): Promise<{ shops: DirectoryShop[]; items: MarketItem[] }> => everything().catch(() => ({ shops: [], items: [] }));
export const getShopDirectory = async (): Promise<DirectoryShop[]> => listed().catch(() => []);
// Admin view: includes the shops that are switched off, flagged `hidden`.
export const getShopDirectoryForAdmin = () => build(true);
