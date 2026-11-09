import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isGlobalRef } from "@/lib/global-pay";
import { fulfilGlobal, liveDeps } from "@/lib/global-pay-server";
import { SITE_URL } from "@/lib/host";

export const dynamic = "force-dynamic";

// Where Stripe, Flutterwave and Paystack send the reader back (?ref=gp_…). We ask the provider ourselves (never trust the address), then
// open the creator's page. If it isn't confirmed yet, the webhook finishes it.
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  if (!isGlobalRef(ref)) return NextResponse.redirect(`${SITE_URL}/`);
  const db = getAdminDb();
  const p = (await db.doc(`globalPayments/${ref}`).get()).data();
  if (!p) return NextResponse.redirect(`${SITE_URL}/`);
  const to = `${SITE_URL}/u/${encodeURIComponent(String(p.publisherUsername))}`;
  try {
    const done = await fulfilGlobal(db, ref, liveDeps(SITE_URL).confirm);
    return NextResponse.redirect(`${to}?subscribed=${done.status === "paid" ? "1" : "pending"}`);
  } catch {
    return NextResponse.redirect(`${to}?subscribed=pending`);
  }
}
