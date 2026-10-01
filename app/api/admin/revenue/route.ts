import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { computeRevenue, RevenueReport } from "@/lib/revenue";

export const dynamic = "force-dynamic";

// Admin-only revenue report. Reads payments, ledger, boosts and renewal charges
// once and caches the raw data for 2 minutes, so flipping the date range on the
// page doesn't re-read everything from Firestore.
let raw: { at: number; data: Parameters<typeof computeRevenue>[0] } | null = null;

export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    const days = [7, 30, 90, 365, 0].includes(Number(req.nextUrl.searchParams.get("days"))) ? Number(req.nextUrl.searchParams.get("days")) : 30;

    if (!raw || Date.now() - raw.at > 120_000) {
      const db = getAdminDb();
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
    const report: RevenueReport = computeRevenue({ ...raw.data, days });
    return NextResponse.json({ report, asOf: new Date(raw.at).toISOString() });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load revenue");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
