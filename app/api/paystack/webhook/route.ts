import { NextRequest, NextResponse } from "next/server";
import { fulfillPayment, isValidWebhookSignature } from "@/lib/paystack";

// Backup for buyers who pay but close the tab before the redirect.
// Set in Paystack dashboard → Settings → API Keys & Webhooks →
// Webhook URL: https://<site>/api/paystack/webhook
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!isValidWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  try {
    const event = JSON.parse(raw);
    if (event.event === "charge.success" && event.data?.reference) {
      await fulfillPayment(event.data.reference);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Paystack webhook failed:", err);
    // Non-2xx makes Paystack retry, which is what we want for transient errors.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
