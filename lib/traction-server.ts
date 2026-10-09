import type { Firestore } from "firebase-admin/firestore";
import { computeTraction, type Traction } from "./traction";

// Reads the collections the platform numbers are counted from, and counts them. Shared by /admin/traction and the team hub.
export async function gatherTraction(db: Firestore): Promise<Traction> {
  const [users, items, payments, ledger, bookings, orders, digital, merch, boosts, ads] = await Promise.all([
    db.collection("users").get(),
    db.collection("storeItems").get(),
    db.collection("payments").get(),
    db.collection("ledger").get(),
    db.collection("bookings").get(),
    db.collection("storeOrders").get(),
    db.collection("digitalPurchases").count().get(),
    db.collection("merchOrders").get(),
    db.collection("boosts").count().get(),
    db.collection("adCampaigns").get(),
  ]);
  return computeTraction({
    users: users.docs.map((d) => d.data() as never),
    storeItems: items.docs.map((d) => d.data() as never),
    payments: payments.docs.map((d) => d.data() as never),
    ledger: ledger.docs.map((d) => d.data() as never),
    bookings: bookings.docs.map((d) => d.data() as never),
    storeOrders: orders.docs.map((d) => d.data() as never),
    digitalPurchases: digital.data().count,
    merchOrders: merch.docs.map((d) => d.data() as never),
    boosts: boosts.data().count,
    adCampaigns: ads.docs.map((d) => d.data() as never),
  });
}
