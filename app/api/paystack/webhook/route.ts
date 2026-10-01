import { NextRequest, NextResponse } from "next/server";
import { isValidWebhookSignature } from "@/lib/paystack";
import { fulfillPayment, fulfillRenewal, markSubscriptionCancelled } from "@/lib/payments";
import { getAdminDb } from "@/lib/firebase-admin";
import { fulfillTierRenewal, markTierCancelled } from "@/lib/tier-billing";

// Backup for buyers who pay but close the tab, plus recurring
// subscription charges, cancellations and payout (transfer) results.
// Paystack → Settings → API Keys & Webhooks → Webhook URL:
//   https://<site>/api/paystack/webhook
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!isValidWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  try {
    const { event, data } = JSON.parse(raw);
    const db = getAdminDb();

    if (event === "charge.success" && data?.reference) {
      const ours = await db.doc(`payments/${data.reference}`).get();
      if (ours.exists) await fulfillPayment(data.reference);
      else if (!(await fulfillTierRenewal(data))) await fulfillRenewal(data); // recurring plan charge
    } else if (
      (event === "subscription.disable" || event === "subscription.not_renew") &&
      data?.plan?.plan_code && data?.customer?.email
    ) {
      await markSubscriptionCancelled(data.plan.plan_code, data.customer.email);
      await markTierCancelled(data.plan.plan_code, data.customer.email);
    } else if (event === "transfer.success" || event === "transfer.failed" || event === "transfer.reversed") {
      // Our transfer references are `payout_<payment reference>`.
      const ref = String(data?.reference || "").replace(/^payout_/, "");
      if (ref) {
        const l = db.doc(`ledger/${ref}`);
        if ((await l.get()).exists) {
          await l.update(
            event === "transfer.success"
              ? { status: "paid_out" }
              : { status: "held", failureReason: `Transfer ${event.split(".")[1]}: ${data?.reason || "see Paystack"}` }
          );
          // Ad-share payouts mirror their result onto the publisher's statement.
          if (event === "transfer.success" && ref.startsWith("adshare_")) {
            await db.doc(`adShareStatements/${ref.slice("adshare_".length)}`).update({ status: "paid" }).catch(() => {});
          }
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Paystack webhook failed:", err);
    // Non-2xx makes Paystack retry, which is what we want for transient errors.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
