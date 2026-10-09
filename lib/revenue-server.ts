import type { Firestore } from "firebase-admin/firestore";
import { computeRevenue, type RevenueReport } from "./revenue";

// Reads payments, ledger, boosts and renewal charges once and caches the raw data for 2 minutes, so flipping the date range on a page
// (or opening the money ledger) doesn't re-read everything from Firestore. Shared by /admin/revenue and the team hub's money ledger so
// both show the same platform revenue.
let raw: { at: number; data: Parameters<typeof computeRevenue>[0] } | null = null;

export async function loadRevenue(db: Firestore, days: number): Promise<{ report: RevenueReport; asOf: string }> {
  if (!raw || Date.now() - raw.at > 120_000) {
    const [pay, led, boosts, charges, adRev, adSh] = await Promise.all([
      db.collection("payments").get(),
      db.collection("ledger").get(),
      db.collection("boosts").get(),
      db.collection("tierCharges").get(),
      db.collection("adRevenue").get(),
      db.collection("adShareStatements").get(),
    ]);
    raw = {
      at: Date.now(),
      data: {
        days: 30,
        payments: pay.docs.map((d) => {
          const p = d.data();
          return { reference: d.id, kind: p.kind, status: p.status, amountKobo: p.amountKobo, paidAt: p.paidAt, createdAt: p.createdAt };
        }),
        commissionByRef: Object.fromEntries(led.docs.map((d) => [d.id, Number(d.data().commissionKobo) || 0])),
        boostRefundByRef: Object.fromEntries(boosts.docs.map((d) => [d.id, Number(d.data().refundedKobo) || 0])),
        adRevenue: adRev.docs.map((d) => ({ month: String(d.data().month), amountKobo: Number(d.data().amountKobo) || 0 })),
        adShares: adSh.docs.map((d) => ({ month: String(d.data().month), shareKobo: Number(d.data().shareKobo) || 0, status: String(d.data().status) })),
        charges: charges.docs.map((d) => {
          const c = d.data();
          return { reference: d.id, kind: c.kind, amountKobo: Number(c.amountKobo) || 0, at: c.at };
        }),
      },
    };
  }
  return { report: computeRevenue({ ...raw.data, days }), asOf: new Date(raw.at).toISOString() };
}
