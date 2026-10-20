import type { Firestore } from "firebase-admin/firestore";
import { ownerVisitRef } from "./visits-server";
import { effectiveTier, type UserProfile } from "./users";
import { canActForSeller } from "./orders-server";
import { deliveredByAd } from "./ads-server";
import {
  buildReport, dayList, isRange, rangesFor, type BookingRow, type CheckoutRow, type ItemRow, type LedgerRow, type OrderRow, type PromoRow,
  type RangeDays, type Report, type VisitDay,
} from "./analytics";

// Member analytics (lib/analytics.ts): the reads behind the Analytics page.
// The daily visit rollup each view adds to is in lib/visits-server.ts.

export class AnalyticsError extends Error { constructor(public status: number, message: string) { super(message); } }

// The accounts a member can see analytics for: their own, and the organisations whose store they run (canActForSeller).
export async function accountsFor(db: Firestore, uid: string): Promise<{ uid: string; username: string; name: string }[]> {
  const out: { uid: string; username: string; name: string }[] = [];
  const me = (await db.doc(`users/${uid}`).get()).data();
  if (me) out.push({ uid, username: String(me.username ?? ""), name: String(me.displayName ?? "You") });
  const mem = await db.collection("orgMembers").where("memberUid", "==", uid).get();
  for (const m of mem.docs) {
    const org = String(m.data().orgUid ?? "");
    if (org && m.data().store === true && (await canActForSeller(uid, org))) {
      const o = (await db.doc(`users/${org}`).get()).data();
      if (o) out.push({ uid: org, username: String(o.username ?? ""), name: String(o.displayName ?? "Organisation") });
    }
  }
  return out;
}

// owner == X and time >= since, with the composite index (firestore.indexes.json); before that index is built, the member's documents are
// read with the owner alone and filtered here, so the page works the day it ships.
async function ranged(db: Firestore, col: string, owner: string, uid: string, time: string, since: string) {
  try {
    return (await db.collection(col).where(owner, "==", uid).where(time, ">=", since).get()).docs;
  } catch (e) {
    if ((e as { code?: number }).code !== 9) throw e; // 9 = FAILED_PRECONDITION: the index isn't built yet
    return (await db.collection(col).where(owner, "==", uid).get()).docs.filter((d) => String(d.data()[time] ?? "") >= since);
  }
}

const num = (v: unknown) => Number(v) || 0;
const str = (v: unknown) => String(v ?? "");

// `asked` is the range the member picked; a range their plan doesn't include falls back to 7 days.
export async function gatherReport(db: Firestore, viewerUid: string, accountUid: string, asked: number, now = new Date()): Promise<{ report: Report; tier: string }> {
  if (accountUid !== viewerUid && !(await canActForSeller(viewerUid, accountUid))) throw new AnalyticsError(403, "You can't see this account's analytics.");
  const p = (await db.doc(`users/${accountUid}`).get()).data() as UserProfile | undefined;
  if (!p) throw new AnalyticsError(404, "Account not found.");
  const tier = effectiveTier(p);
  const days: RangeDays = isRange(asked) && rangesFor(tier).includes(asked) ? asked : 7;
  // This period and the one before it, for the change.
  const since = dayList(now, days * 2)[0];
  const customersToo = ["pro", "business", "enterprise"].includes(tier);
  const [ledger, orders, checkouts, items, bookings, boosts, ads] = await Promise.all([
    ranged(db, "ledger", "publisherUid", accountUid, "createdAt", since),
    // Customers are counted over every order, so Pro and above read them all.
    customersToo ? db.collection("storeOrders").where("sellerUid", "==", accountUid).get().then((s) => s.docs) : ranged(db, "storeOrders", "sellerUid", accountUid, "paidAt", since),
    ranged(db, "payments", "publisherUid", accountUid, "createdAt", since),
    db.collection("storeItems").where("ownerUid", "==", accountUid).get().then((s) => s.docs),
    ranged(db, "bookings", "publisherUid", accountUid, "createdAt", since),
    db.collection("boosts").where("publisherUid", "==", accountUid).get().then((s) => s.docs),
    db.collection("adCampaigns").where("uid", "==", accountUid).get().then((s) => s.docs),
  ]);
  const stats = items.length ? await db.getAll(...items.map((d) => db.doc(`storeStats/${d.id}`))) : [];
  const views = new Map(stats.map((s) => [s.id, num(s.data()?.views)]));
  const visitDocs = await db.getAll(...dayList(now, days * 2).map((d) => ownerVisitRef(db, accountUid, d)));

  const inputs = {
    ledger: ledger.map((d): LedgerRow => ({ id: d.id, kind: str(d.data().kind), grossKobo: num(d.data().grossKobo), netKobo: num(d.data().netKobo), status: str(d.data().status), createdAt: str(d.data().createdAt) })),
    orders: orders.map((d): OrderRow => {
      const o = d.data(), a = (o.address ?? {}) as Record<string, unknown>;
      return {
        id: d.id, itemId: str(o.itemId), itemTitle: str(o.itemTitle), quantity: num(o.quantity) || 1, unitKobo: num(o.unitKobo), deliveryKobo: num(o.deliveryKobo),
        amountKobo: num(o.amountKobo), status: str(o.status), paidAt: str(o.paidAt), buyerUid: str(o.buyerUid), buyerEmail: str(o.buyerEmail),
        name: str(a.fullName), phone: str(a.phone), city: str(a.city), state: str(a.state),
      };
    }),
    checkouts: checkouts.filter((d) => ["store", "digital"].includes(str(d.data().kind))).map((d): CheckoutRow => ({ status: str(d.data().status), createdAt: str(d.data().createdAt) })),
    items: items.map((d): ItemRow => ({
      id: d.id, title: str(d.data().title), kind: str(d.data().kind) || "physical", stock: num(d.data().stock), sellable: d.data().sellable !== false,
      views: views.get(d.id) ?? 0, priceKobo: num(d.data().priceKobo),
    })),
    bookings: bookings.map((d): BookingRow => ({ status: str(d.data().status), amountKobo: num(d.data().amountKobo), createdAt: str(d.data().createdAt), startsAt: str(d.data().startsAt) })),
    visits: visitDocs.filter((d) => d.exists).map((d): VisitDay => ({ day: str(d.data()!.day), count: num(d.data()!.count), pages: d.data()!.pages ?? {}, src: d.data()!.src ?? {} })),
    promos: [] as PromoRow[],
  };
  const adStats = ads.length ? await deliveredByAd(ads.map((d) => d.id)).catch(() => ({} as Record<string, { impressions: number; clicks: number }>)) : {};
  inputs.promos = [
    ...boosts.map((d): PromoRow => ({
      id: d.id, type: "boost", label: str(d.data().title || "Boost"), spentKobo: num(d.data().amountKobo) - num(d.data().refundedKobo),
      impressions: num(d.data().impressionsDelivered), clicks: num(d.data().clicks) + num(d.data().digestClicks), status: str(d.data().status),
    })),
    ...ads.filter((d) => d.data().paidAt).map((d): PromoRow => ({
      id: d.id, type: "advert", label: str(d.data().creative?.title || d.data().packageName || "Advert"), spentKobo: num(d.data().amountKobo) - num(d.data().refundedKobo),
      impressions: adStats[d.id]?.impressions ?? 0, clicks: adStats[d.id]?.clicks ?? 0, status: str(d.data().status),
    })),
  ].sort((a, b) => b.spentKobo - a.spentKobo);

  const report = buildReport(inputs, { days, tier, now });
  // Page names for "visits by page": the account's own journals, items and courses, and their profile.
  if (report.pages?.length) {
    const titles = new Map<string, string>([[`profile:${p.username}`, "Your profile and site home"]]);
    for (const d of items) titles.set(`item:${d.id}`, str(d.data().title));
    const noteIds = report.pages.filter((x) => x.key.startsWith("note:")).map((x) => x.key.slice(5));
    const courseIds = report.pages.filter((x) => x.key.startsWith("course:")).map((x) => x.key.slice(7));
    const docs = [...noteIds.map((id) => db.doc(`notes/${id}`)), ...courseIds.map((id) => db.doc(`courses/${id}`))];
    if (docs.length) for (const s of await db.getAll(...docs)) titles.set(`${s.ref.parent.id === "notes" ? "note" : "course"}:${s.id}`, str(s.data()?.title) || "Untitled");
    report.pages = report.pages.map((x) => ({ ...x, label: titles.get(x.key) ?? x.key }));
  }
  return { report, tier };
}
