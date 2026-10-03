import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const FLOW = ["preordered", "printed", "shipped", "delivered"] as const;

// Admin-only: move a merch pre-order along preordered → printed → shipped →
// delivered. Refunded orders are handled from /admin/payments.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    await verifyAdminRequest(idToken);
    const { reference, status, courier, trackingNumber } = await req.json();
    if (typeof reference !== "string" || !FLOW.includes(status)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    // Optional courier details, only meaningful when marking shipped.
    const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 80) : "");
    const courierName = status === "shipped" ? clean(courier) : "";
    const tracking = status === "shipped" ? clean(trackingNumber) : "";
    const ref = getAdminDb().doc(`merchOrders/${reference}`);
    const order = (await ref.get()).data();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status === "refunded") return NextResponse.json({ error: "This order was refunded." }, { status: 409 });
    // A repeated click must not re-send the buyer's email.
    if (order.status === status) return NextResponse.json({ ok: true });
    await ref.update({
      status,
      [`${status}At`]: new Date().toISOString(),
      ...(courierName ? { courier: courierName } : {}),
      ...(tracking ? { trackingNumber: tracking } : {}),
    });

    // Tell the buyer at every step (the pre-order confirmation covers "preordered").
    if (order.email) {
      const what = `${order.quantity} × ${order.itemName}${order.size ? ` (${order.size})` : ""}`;
      const where = `${order.address?.city}, ${order.address?.state}`;
      const msg: Record<string, { subject: string; text: string }> = {
        printed: {
          subject: "Your #NotesApp merch has been printed",
          text: `Good news — your ${what} has been printed and is being prepared for delivery to ${where}. We'll email you again when it ships. (Refunds are no longer available once an order is printed.)\nReference: ${order.reference}`,
        },
        shipped: {
          subject: "Your #NotesApp merch is on its way",
          text: `Your ${what} is on its way to ${where}.${courierName || tracking ? `\nCourier: ${[courierName, tracking].filter(Boolean).join(" · ")}` : ""}\nReference: ${order.reference}`,
        },
        delivered: {
          subject: "Your #NotesApp merch was delivered",
          text: `Your ${what} has been marked delivered to ${where}. If anything isn't right, reply via the Contact page on the site and quote your reference.\nReference: ${order.reference}`,
        },
      };
      const m = msg[status];
      if (m) await sendEmail({ to: order.email, subject: m.subject, text: `${m.text}\n\n#NotesApp` }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't update the order");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
