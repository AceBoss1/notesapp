import type { Firestore } from "firebase-admin/firestore";
import { computeRevenue, type RevenueReport } from "./revenue";

import { storedSnapshot } from "./stat-cache";

// How old a stored revenue report may be before it's built again (see lib/stat-cache.ts).
export const REVENUE_MAX_AGE_MS = 15 * 60_000;

// Reads payments, ledger, boosts, renewal charges and ad money (only the fields the report uses) and builds the report.
async function readRevenueInput(db: Firestore): Promise<Parameters<typeof computeRevenue>[0]> {
  const [pay, led, boosts, charges, adRev, adSh] = await Promise.all([
    db.collection("payments").select("kind", "status", "amountKobo", "paidAt", "createdAt").get(),
    db.collection("ledger").select("commissionKobo", "paymentReference").get(),
    db.collection("boosts").select("refundedKobo").get(),
    db.collection("tierCharges").select("kind", "amountKobo", "at").get(),
    db.collection("adRevenue").select("month", "amountKobo").get(),
    db.collection("adShareStatements").select("month", "shareKobo", "status").get(),
  ]);
  return {
    days: 30,
    payments: pay.docs.filter((d) => d.data().kind !== "store_cart").map((d) => { // a basket's money is in its orders
      const p = d.data();
      return { reference: d.id, kind: p.kind, status: p.status, amountKobo: p.amountKobo, paidAt: p.paidAt, createdAt: p.createdAt };
    }),
    // By payment: split entries (a co-author's share of a gift, a delivery partner's share of an order) add to their payment's total.
    commissionByRef: led.docs.reduce<Record<string, number>>((m, d) => { const r = String(d.data().paymentReference || d.id); m[r] = (m[r] ?? 0) + (Number(d.data().commissionKobo) || 0); return m; }, {}),
    boostRefundByRef: Object.fromEntries(boosts.docs.map((d) => [d.id, Number(d.data().refundedKobo) || 0])),
    adRevenue: adRev.docs.map((d) => ({ month: String(d.data().month), amountKobo: Number(d.data().amountKobo) || 0 })),
    adShares: adSh.docs.map((d) => ({ month: String(d.data().month), shareKobo: Number(d.data().shareKobo) || 0, status: String(d.data().status) })),
    charges: charges.docs.map((d) => {
      const c = d.data();
      return { reference: d.id, kind: c.kind, amountKobo: Number(c.amountKobo) || 0, at: c.at };
    }),
  };
}

// One stored report per date range (7, 30, 90, 365 days or all time), rebuilt at most every 15 minutes across every server
// instance, or now with fresh ("Refresh now"). A rebuild reads the collections once and refreshes every range together, so
// flipping the range afterwards costs one read. Shared by /admin/revenue and the team hub's money ledger.
export const REVENUE_RANGES = [7, 30, 90, 365, 0] as const;
export async function loadRevenue(db: Firestore, days: number, fresh = false): Promise<{ report: RevenueReport; asOf: string }> {
  const all = await storedSnapshot(db, "revenue", REVENUE_MAX_AGE_MS, async () => {
    const input = await readRevenueInput(db);
    return Object.fromEntries(REVENUE_RANGES.map((r) => [String(r), computeRevenue({ ...input, days: r })])) as Record<string, RevenueReport>;
  }, { fresh });
  return { report: all.data[String(days)] ?? all.data["30"], asOf: all.asOf };
}
