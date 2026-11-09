import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isGlobalRef } from "@/lib/global-pay";
import { fulfilGlobal, liveDeps } from "@/lib/global-pay-server";
import { isValidStripeSignature } from "@/lib/stripe";
import { SITE_URL } from "@/lib/host";

// Stripe → Developers → Webhooks → https://<site>/api/stripe/webhook, event checkout.session.completed (and
// checkout.session.async_payment_succeeded). Finishes a global subscription for a reader who closed the tab before coming back.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!isValidStripeSignature(raw, req.headers.get("stripe-signature"))) return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  try {
    const ev = JSON.parse(raw);
    if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
      const ref = String(ev.data?.object?.client_reference_id ?? "");
      if (isGlobalRef(ref)) {
        const db = getAdminDb();
        const p = (await db.doc(`globalPayments/${ref}`).get()).data();
        if (p && !p.providerRef) await db.doc(`globalPayments/${ref}`).update({ providerRef: String(ev.data.object.id) });
        await fulfilGlobal(db, ref, liveDeps(SITE_URL).confirm).catch((e) => console.error("stripe fulfil", ref, e));
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("stripe webhook failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
