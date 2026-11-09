import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyPublisherRequest } from "@/lib/firebase-admin";
import { GlobalPayError } from "@/lib/global-pay";
import { myGlobal, saveGlobal, savePayoutAccount } from "@/lib/global-pay-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const token = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// A publisher's global subscriptions (lib/global-pay-server.ts): GET their home currency, prices, payout details (last 4 only) and what
// they're owed in each currency. POST { action: "settings", currency, acceptGlobal, tiers } or { action: "payout", currency, method,
// accountBank, accountNumber, accountName }.
export async function GET(req: NextRequest) {
  const uid = await verifyPublisherRequest(token(req)).catch(() => null);
  if (!uid) return NextResponse.json({ error: "Only publishing accounts." }, { status: 403 });
  return NextResponse.json(await myGlobal(getAdminDb(), uid));
}

export async function POST(req: NextRequest) {
  const uid = await verifyPublisherRequest(token(req)).catch(() => null);
  if (!uid) return NextResponse.json({ error: "Only publishing accounts." }, { status: 403 });
  const limited = await rateLimit(req, "pub-global", uid, 20, 3600);
  if (limited) return limited;
  try {
    const b = await req.json();
    const db = getAdminDb();
    if (b.action === "payout") return NextResponse.json({ payout: await savePayoutAccount(db, uid, b) });
    return NextResponse.json({ settings: await saveGlobal(db, uid, b) });
  } catch (e) {
    if (e instanceof GlobalPayError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("publisher global failed", e);
    return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  }
}
