import type { Firestore } from "firebase-admin/firestore";
import { computeTraction, type Traction } from "./traction";
import { storedSnapshot } from "./stat-cache";

// How old the stored platform numbers may be before they're counted again (see lib/stat-cache.ts).
export const TRACTION_MAX_AGE_MS = 60 * 60_000;

// Reads the collections the platform numbers are counted from, and counts them. Each read asks only for the fields
// computeTraction uses, so less data travels (Firestore still bills one read per document, hence the snapshot below).
export async function gatherTraction(db: Firestore): Promise<Traction> {
  const [users, items, payments, ledger, bookings, orders, digital, merch, boosts, ads] = await Promise.all([
    db.collection("users").select("uid", "role", "accountTier", "accountKind", "createdAt", "goldBadge", "suspended").get(),
    db.collection("storeItems").select("ownerUid", "kind", "sellable").get(),
    db.collection("payments").select("kind", "status", "amountKobo", "uid", "paidAt", "createdAt").get(),
    db.collection("ledger").select("kind", "status", "netKobo", "commissionKobo").get(),
    db.collection("bookings").select("status", "startsAt").get(),
    db.collection("storeOrders").select("status").get(),
    db.collection("digitalPurchases").count().get(),
    db.collection("merchOrders").select("status").get(),
    db.collection("boosts").count().get(),
    db.collection("adCampaigns").select("status").get(),
  ]);
  return computeTraction({
    users: users.docs.map((d) => d.data() as never),
    storeItems: items.docs.map((d) => d.data() as never),
    payments: payments.docs.filter((d) => d.data().kind !== "store_cart").map((d) => d.data() as never), // a basket's money is in its orders
    ledger: ledger.docs.map((d) => d.data() as never),
    bookings: bookings.docs.map((d) => d.data() as never),
    storeOrders: orders.docs.map((d) => d.data() as never),
    digitalPurchases: digital.data().count,
    merchOrders: merch.docs.map((d) => d.data() as never),
    boosts: boosts.data().count,
    adCampaigns: ads.docs.map((d) => d.data() as never),
  });
}

// The platform numbers as last counted: rebuilt at most once an hour across every server instance, or now with fresh.
// Shared by /admin/traction and the team hub.
export async function storedTraction(db: Firestore, fresh = false): Promise<Traction> {
  return (await storedSnapshot(db, "traction", TRACTION_MAX_AGE_MS, () => gatherTraction(db), { fresh })).data;
}
