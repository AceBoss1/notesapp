import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { GlobalPayError } from "@/lib/global-pay";
import { liveDeps, payOut, recordConversion, refundGlobal, setRates, treasury } from "@/lib/global-pay-server";
import { SITE_URL } from "@/lib/host";

export const dynamic = "force-dynamic";
const token = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin → Treasury (Finance): the pool in each currency, what's owed and due, suggested conversions, exchange rates, payouts, refunds.
export async function GET(req: NextRequest) {
  try { await verifyAdminRequest(token(req), ["finance"]); } catch { return NextResponse.json({ error: "Finance only." }, { status: 403 }); }
  const db = getAdminDb();
  const recent = await db.collection("globalPayments").orderBy("createdAt", "desc").limit(50).get();
  return NextResponse.json({ ...(await treasury(db)), payments: recent.docs.map((d) => { const p = d.data(); return { reference: p.reference, publisherUsername: p.publisherUsername, tier: p.tier, payCurrency: p.payCurrency, payMinor: p.payMinor, homeCurrency: p.homeCurrency, earningMinor: p.earningMinor, provider: p.provider, status: p.status, createdAt: p.createdAt }; }) });
}

// POST { action: "rates" | "conversion" | "payout" | "refund", … }
export async function POST(req: NextRequest) {
  let by: string;
  try { by = await verifyAdminRequest(token(req), ["finance"]); } catch { return NextResponse.json({ error: "Finance only." }, { status: 403 }); }
  const db = getAdminDb();
  try {
    const b = await req.json();
    const deps = liveDeps(SITE_URL);
    if (b.action === "rates") return NextResponse.json({ rates: await setRates(db, by, b) });
    if (b.action === "conversion") return NextResponse.json(await recordConversion(db, by, b));
    if (b.action === "payout") return NextResponse.json(await payOut(db, by, { publisherUid: String(b.publisherUid ?? ""), currency: String(b.currency ?? ""), via: b.via === "flutterwave" ? "flutterwave" : "recorded", externalRef: b.externalRef }, { transfer: deps.transfer }));
    if (b.action === "refund") return NextResponse.json(await refundGlobal(db, String(b.reference ?? ""), { refund: deps.refund }));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    if (e instanceof GlobalPayError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("treasury failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong." }, { status: 500 });
  }
}
