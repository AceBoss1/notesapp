import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { PaylonyWebhook, webhookAuthorised } from "@/lib/paylony";
import { reconcilePaylonyPayouts } from "@/lib/paylony-payouts";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Paylony → our server. Paylony dashboard → webhook URL: https://www.notesapp.name.ng/api/paylony/webhook, with the webhook key
// in PAYLONY_WEBHOOK_KEY (Paylony sends it as the Bearer token). Two events arrive here:
//   "collection" — money paid into one of our reserved (virtual) accounts
//   "payout"     — a transfer we sent through the API changed state (pending → success or failed)
// Every event is stored once, keyed by Paylony's `trx` (a repeat delivery is acknowledged and not stored again). Paylony only
// settles an instant-settlement collection when we answer with the plain text "success", so we answer that only after the
// event is safely stored. Crediting an order or paying out a seller from these events is added with the features that need them.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "paylony-webhook", clientIp(req), 120, 60);
  if (limited) return limited;
  if (!process.env.PAYLONY_WEBHOOK_KEY) return new NextResponse("not configured", { status: 503 });
  if (!webhookAuthorised(req.headers.get("authorization"))) return new NextResponse("unauthorised", { status: 401 });

  let event: PaylonyWebhook;
  try {
    event = await req.json();
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }
  const id = String(event.trx || event.reference || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!id || (event.event !== "collection" && event.event !== "payout")) return new NextResponse("bad request", { status: 400 });

  try {
    const ref = getAdminDb().doc(`paylonyEvents/${id}_${event.event}_${String(event.status ?? "")}`);
    // create() fails if this exact delivery (same transaction, event and status) is already stored.
    await ref.create({ ...event, receivedAt: new Date().toISOString(), handled: false, firstSeen: FieldValue.serverTimestamp() }).catch((e: { code?: number }) => {
      if (e?.code !== 6) throw e; // 6 = ALREADY_EXISTS: a repeat delivery, which is fine
    });
    // A payout changed state: settle the payouts we are waiting on by asking Paylony about each one by OUR reference (the webhook's
    // own reference is Paylony's, so we don't trust it to name the payout). Failures here are retried by the scheduled job.
    if (event.event === "payout") await reconcilePaylonyPayouts({ ageMs: 0 }).catch((e) => console.error("[paylony] reconcile failed", e));
    return new NextResponse("success", { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (err) {
    console.error("[paylony] couldn't store webhook", err);
    return new NextResponse("error", { status: 500 }); // Paylony retries up to 10 times
  }
}
