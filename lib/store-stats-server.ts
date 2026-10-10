import type { Firestore } from "firebase-admin/firestore";

// Saved items (the heart) and the "what buyers check more" numbers. Saves are private per member (`storeFavorites/{uid}_{itemId}`);
// the totals are public (`storeStats/{itemId}` = { ownerUid, views, favs }). Both are written only here, in a transaction.
export class StoreStatsError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const sellable = (d: FirebaseFirestore.DocumentData | undefined) => !!d && d.sellable === true;

// Save the item, or take it off the saved list if it is already there. Returns the new state and the total.
export async function toggleFavorite(db: Firestore, uid: string, itemId: string, now = new Date()): Promise<{ saved: boolean; favs: number }> {
  if (!itemId || itemId.includes("/")) throw new StoreStatsError("Which item?");
  const itemRef = db.doc(`storeItems/${itemId}`), favRef = db.doc(`storeFavorites/${uid}_${itemId}`), statRef = db.doc(`storeStats/${itemId}`);
  return db.runTransaction(async (t) => {
    const [item, fav, stat] = await Promise.all([t.get(itemRef), t.get(favRef), t.get(statRef)]);
    if (!item.exists || !sellable(item.data())) throw new StoreStatsError("That item isn't for sale here.", 404);
    const ownerUid = String(item.data()!.ownerUid);
    const views = Number(stat.data()?.views) || 0;
    let favs = Number(stat.data()?.favs) || 0;
    if (fav.exists) {
      t.delete(favRef);
      favs = Math.max(0, favs - 1);
    } else {
      t.set(favRef, { uid, itemId, ownerUid, createdAt: now.toISOString() });
      favs += 1;
    }
    t.set(statRef, { ownerUid, views, favs });
    return { saved: !fav.exists, favs };
  });
}

// One more look at an item. The seller's own visits don't count. (The browser also sends at most one a day per item.)
export async function recordView(db: Firestore, itemId: string, viewerUid?: string): Promise<boolean> {
  if (!itemId || itemId.includes("/")) return false;
  const itemRef = db.doc(`storeItems/${itemId}`), statRef = db.doc(`storeStats/${itemId}`);
  return db.runTransaction(async (t) => {
    const [item, stat] = await Promise.all([t.get(itemRef), t.get(statRef)]);
    if (!item.exists || !sellable(item.data())) return false;
    const ownerUid = String(item.data()!.ownerUid);
    if (viewerUid && viewerUid === ownerUid) return false;
    t.set(statRef, { ownerUid, views: (Number(stat.data()?.views) || 0) + 1, favs: Number(stat.data()?.favs) || 0 });
    return true;
  });
}
