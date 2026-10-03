import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { computeTraction, summaryText, tractionCsv } from "@/lib/traction";

export const dynamic = "force-dynamic";

// Admin-only platform numbers for decks and applications (counts only — no personal data leaves).
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    const db = getAdminDb();
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
    const t = computeTraction({
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
    return NextResponse.json({ traction: t, summary: summaryText(t), csv: tractionCsv(t) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't build the snapshot");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
