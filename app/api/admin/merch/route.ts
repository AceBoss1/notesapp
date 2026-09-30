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
    const { reference, status } = await req.json();
    if (typeof reference !== "string" || !FLOW.includes(status)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const ref = getAdminDb().doc(`merchOrders/${reference}`);
    const order = (await ref.get()).data();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status === "refunded") return NextResponse.json({ error: "This order was refunded." }, { status: 409 });
    await ref.update({ status, [`${status}At`]: new Date().toISOString() });

    if (status === "shipped" && order.email) {
      await sendEmail({
        to: order.email,
        subject: "Your #NotesApp merch is on its way",
        text: `Your ${order.quantity} × ${order.itemName} is on its way to ${order.address?.city}, ${order.address?.state}. Reference: ${order.reference}\n\n#NotesApp`,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't update the order");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
