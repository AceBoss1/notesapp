import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { notifyBell, sendEmail } from "@/lib/email";
import { FieldValue } from "firebase-admin/firestore";
import type { MerchOrder } from "@/lib/merch";
import { cleanText, isHolderType, isHttpsUrl, normalizePhone } from "@/lib/orders";
import { ensureMerchParcel, expireLinks, hashToken, holderUrl, newLinkToken, parcelStatusForMerch, sendMerchStatusEmail } from "@/lib/orders-server";

export const dynamic = "force-dynamic";

const FLOW = ["preordered", "printed", "shipped", "delivered"] as const;

// Admin-only: move a merch pre-order along preordered → printed → shipped →
// delivered. Refunded orders are handled from /admin/payments.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    await verifyAdminRequest(idToken, ["finance", "support"]);
    const body = await req.json();
    const { reference, status, courier, trackingNumber, trackingUrl, action } = body;
    if (typeof reference !== "string") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const db = getAdminDb();
    const ref = db.doc(`merchOrders/${reference}`);
    const order = (await ref.get()).data() as MerchOrder | undefined;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status === "refunded") return NextResponse.json({ error: "This order was refunded." }, { status: 409 });
    // Every merch order has a parcel (and so a public /track page); older orders get theirs here.
    const parcelId = await ensureMerchParcel(order);
    const parcelRef = db.doc(`parcels/${parcelId}`);
    const now = new Date().toISOString();

    // Record who is carrying the parcel (rider / bus / motor park / courier staff). Shown on
    // /track; a phone number is only stored with the holder's agreement.
    if (action === "add_custody") {
      if (!["printed", "shipped"].includes(order.status)) {
        return NextResponse.json({ error: "Mark the order printed before recording who holds it." }, { status: 409 });
      }
      const holderName = cleanText(body.holderName, 80);
      const location = cleanText(body.location, 120);
      const holderPhone = body.holderPhone ? normalizePhone(body.holderPhone) : null;
      if (!isHolderType(body.holderType) || body.holderType === "buyer") return NextResponse.json({ error: "Choose who holds it." }, { status: 400 });
      if (!holderName || !location) return NextResponse.json({ error: "Enter the holder's name and where the parcel is." }, { status: 400 });
      if (body.holderPhone && !holderPhone) return NextResponse.json({ error: "Use an 11-digit Nigerian number like 08012345678 (or +2348012345678)." }, { status: 400 });
      if (holderPhone && body.consent !== true) return NextResponse.json({ error: "Tick that the holder agrees to their number being shown to the buyer." }, { status: 400 });
      const entry = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        holderType: body.holderType, holderName, ...(holderPhone ? { holderPhone } : {}), location, at: now, status: "confirmed", by: "seller",
      };
      await parcelRef.update({ custody: FieldValue.arrayUnion(entry), ...(order.courier ? {} : { mode: "handoff" }) });
      await expireLinks(parcelId).catch(() => {}); // recording the next holder ends earlier holders' links
      await notifyBell({ uid: order.uid, type: "merch", linkHref: `/track/${parcelId}`, message: `Your order is now with ${holderName} (${location}).` });
      return NextResponse.json({ ok: true, entryId: entry.id });
    }

    // A private no-login link for the rider / driver / agent holding the parcel (same /p/<token>
    // page store sellers use): they can update the location, hand it on, or mark it delivered.
    if (action === "holder_link") {
      if (!["printed", "shipped"].includes(order.status)) {
        return NextResponse.json({ error: "This order isn't in transit." }, { status: 409 });
      }
      const parcel = (await parcelRef.get()).data() as { custody?: { id: string }[] } | undefined;
      if (!parcel?.custody?.some((c) => c.id === body.entryId)) return NextResponse.json({ error: "No such hand-off entry." }, { status: 404 });
      const token = newLinkToken();
      await db.doc(`parcelLinks/${hashToken(token)}`).set({
        parcelId, entryId: body.entryId, active: true, createdAt: now, expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      });
      return NextResponse.json({ ok: true, url: holderUrl(token) });
    }

    if (!FLOW.includes(status)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    // Optional courier details, only meaningful when marking shipped.
    const clean = (v: unknown) => cleanText(v, 80);
    const courierName = status === "shipped" ? clean(courier) : "";
    const tracking = status === "shipped" ? clean(trackingNumber) : "";
    const link = status === "shipped" && trackingUrl ? String(trackingUrl).trim() : "";
    if (link && !isHttpsUrl(link)) return NextResponse.json({ error: "The tracking link must start with https://" }, { status: 400 });
    // A repeated click must not re-send the buyer's email.
    if (order.status === status) return NextResponse.json({ ok: true });
    await ref.update({
      status,
      [`${status}At`]: now,
      ...(courierName ? { courier: courierName } : {}),
      ...(tracking ? { trackingNumber: tracking } : {}),
      ...(link ? { trackingUrl: link } : {}),
    });
    await parcelRef.update({
      status: parcelStatusForMerch(status),
      merchStatus: status,
      ...(courierName || tracking ? { mode: "courier", courier: { name: courierName || "Courier", trackingNumber: tracking, trackingUrl: link } } : {}),
    });

    // Tell the buyer at every step (the pre-order confirmation covers "preordered").
    if (status !== "preordered") await sendMerchStatusEmail(order, parcelId, status, { name: courierName, trackingNumber: tracking });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't update the order");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
