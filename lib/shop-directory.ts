import { getAdminDb } from "./firebase-admin";
import { ttlCache } from "./ttl-cache";

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
  itemCount: number;
  images: string[]; // up to 3
  href: string; // their own domain when they have an active one, else /u/<username>/store
  boosted: boolean;
  newestAt: string;
  hiddenBy?: "owner" | "admin"; // only set (when switched off) for the admin view
};

async function build(includeHidden: boolean): Promise<DirectoryShop[]> {
  const db = getAdminDb();
  const [itemsSnap, boostsSnap, domainsSnap] = await Promise.all([
    db.collection("storeItems").where("sellable", "==", true).get(),
    db.collection("boosts").where("status", "==", "active").get(),
    db.collection("customDomains").where("status", "==", "active").get(),
  ]);

  const byOwner = new Map<string, FirebaseFirestore.DocumentData[]>();
  for (const d of itemsSnap.docs) {
    const i = d.data();
    const buyable = i.kind === "digital" ? !!i.fileName : Number(i.stock) > 0;
    if (!buyable || !i.ownerUid) continue;
    byOwner.set(i.ownerUid, [...(byOwner.get(i.ownerUid) || []), { ...i, id: d.id }]);
  }
  const now = Date.now();
  const boosted = new Set(
    boostsSnap.docs.map((b) => b.data()).filter((b) => b.itemId && new Date(b.endsAt).getTime() > now && b.impressionsDelivered < b.impressionsPurchased).map((b) => b.publisherUid as string)
  );
  const domainOf = new Map(domainsSnap.docs.map((d) => [d.data().uid as string, d.data().host as string]));

  const shops: DirectoryShop[] = [];
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
        itemCount: items.length,
        images: sorted.slice(0, 3).map((i) => String(i.images?.[0] || i.image || "")).filter(Boolean),
        href: host ? `https://${host}` : `/u/${u.username}/store`,
        boosted: boosted.has(uid),
        newestAt: String(sorted[0]?.createdAt || ""),
        ...(includeHidden && hiddenBy ? { hiddenBy } : {}),
      });
    })
  );
  return shops.sort((a, b) => Number(b.boosted) - Number(a.boosted) || b.newestAt.localeCompare(a.newestAt));
}

const listed = ttlCache(60_000, () => build(false));
export const getShopDirectory = async (): Promise<DirectoryShop[]> => listed().catch(() => []);
// Admin view: includes the shops that are switched off, flagged `hidden`.
export const getShopDirectoryForAdmin = () => build(true);
