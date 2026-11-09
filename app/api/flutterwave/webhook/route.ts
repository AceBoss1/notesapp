import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isGlobalRef } from "@/lib/global-pay";
import { fulfilGlobal, liveDeps } from "@/lib/global-pay-server";
import { isValidFlutterwaveHash } from "@/lib/flutterwave";
import { SITE_URL } from "@/lib/host";

// Flutterwave → Settings → Webhooks → https://<site>/api/flutterwave/webhook, with the secret hash in FLUTTERWAVE_WEBHOOK_HASH.
// charge.completed finishes a global subscription (we confirm it with Flutterwave ourselves); transfer.completed is a payout's result.
export async function POST(req: NextRequest) {
  if (!isValidFlutterwaveHash(req.headers.get("verif-hash"))) return NextResponse.json({ error: "Bad hash" }, { status: 401 });
  try {
    const ev = await req.json();
    const db = getAdminDb();
    if (ev.event === "charge.completed") {
      const ref = String(ev.data?.tx_ref ?? "");
      if (isGlobalRef(ref)) await fulfilGlobal(db, ref, liveDeps(SITE_URL).confirm).catch((e) => console.error("flutterwave fulfil", ref, e));
    } else if (ev.event === "transfer.completed") {
      const id = String(ev.data?.reference ?? "");
      if (/^po_[A-Za-z0-9_]+$/.test(id) && (await db.doc(`treasuryPayouts/${id}`).get()).exists) {
        await db.doc(`treasuryPayouts/${id}`).update({ providerStatus: String(ev.data?.status ?? ""), providerNote: String(ev.data?.complete_message ?? "").slice(0, 200) });
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("flutterwave webhook failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
