import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, getUserEmail, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { CustodyEntry, StoreOrder, cleanText, isHolderType, isHttpsUrl, normalizePhone } from "@/lib/orders";
import { autoReleaseAt, confirmOrder, expireLinks, hashToken, holderUrl, newLinkToken } from "@/lib/orders-server";

export const dynamic = "force-dynamic";
const site = () => process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
class Fail extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// GET ?role=buying|selling → the signed-in member's orders, newest first.
export async function GET(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const role = req.nextUrl.searchParams.get("role") === "selling" ? "sellerUid" : "buyerUid";
    const snap = await getAdminDb().collection("storeOrders").where(role, "==", me.uid).get();
    const orders = snap.docs.map((d) => d.data() as StoreOrder).sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
    // The seller doesn't need the buyer's email; the buyer doesn't need the seller's anything private.
    return NextResponse.json({ orders: orders.map(({ buyerEmail, ...o }) => (role === "sellerUid" ? o : { ...o, address: { ...o.address, phone: o.address.phone } })) });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load orders");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "store-orders", me.uid, 60, 3600);
    if (limited) return limited;
    const body = await req.json();
    const db = getAdminDb();
    const ref = db.doc(`storeOrders/${String(body.reference)}`);
    const order = (await ref.get()).data() as StoreOrder | undefined;
    if (!order) throw new Fail("Order not found.", 404);
    const parcelRef = db.doc(`parcels/${order.parcelId}`);
    const now = new Date().toISOString();
    const isBuyer = order.buyerUid === me.uid;
    const isSeller = order.sellerUid === me.uid;
    const action = String(body.action);

    // ---- buyer ----
    if (action === "confirm" || action === "dispute") {
      if (!isBuyer) throw new Fail("Only the buyer can do that.", 403);
      if (action === "confirm") {
        if (!["dispatched", "delivered"].includes(order.status)) throw new Fail("You can confirm once the seller has sent it.", 409);
        await confirmOrder(order.reference, "buyer");
        return NextResponse.json({ ok: true });
      }
      if (!["paid", "dispatched", "delivered"].includes(order.status)) throw new Fail("This order can't be disputed now.", 409);
      const reason = cleanText(body.reason, 400);
      if (reason.length < 10) throw new Fail("Tell us what went wrong (at least a sentence).");
      const batch = db.batch();
      batch.update(ref, { status: "disputed", disputeReason: reason });
      batch.update(parcelRef, { status: "disputed" });
      batch.update(db.doc(`ledger/${order.reference}`), { status: "disputed" });
      await batch.commit();
      const to = await getUserEmail(order.sellerUid);
      if (to) await sendEmail({ to, subject: "A buyer reported a problem with an order", text: `The buyer of ${order.itemTitle} reported a problem: "${reason}". The money stays held while #NotesApp reviews it — please keep your tracking and any proof of delivery handy and reply to our email if we contact you.\n\n#NotesApp` }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    // ---- seller ----
    if (!isSeller) throw new Fail("Only the seller can do that.", 403);
    const open = ["paid", "dispatched"].includes(order.status);

    if (action === "set_courier") {
      if (!open) throw new Fail("This order can't be changed now.", 409);
      if (order.mode === "handoff") throw new Fail("This order is already tracked by hand-offs.", 409);
      const name = cleanText(body.name, 60);
      const trackingNumber = cleanText(body.trackingNumber, 60);
      const trackingUrl = String(body.trackingUrl || "").trim();
      if (!name || !trackingNumber) throw new Fail("Enter the courier's name and the tracking number.");
      if (trackingUrl && !isHttpsUrl(trackingUrl)) throw new Fail("The tracking link must start with https://");
      const courier = { name, trackingNumber, trackingUrl };
      const batch = db.batch();
      batch.update(ref, { status: "dispatched", mode: "courier", courier, ...(order.dispatchedAt ? {} : { dispatchedAt: now }) });
      batch.update(parcelRef, { status: "dispatched", mode: "courier", courier });
      await batch.commit();
      const to = order.buyerEmail;
      if (!order.dispatchedAt && to) await sendEmail({ to, subject: "Your #NotesApp order is on its way", text: `${order.itemTitle} was handed to ${name} (tracking ${trackingNumber}).\nFollow it with parcel ID ${order.parcelId} at ${site()}/track/${order.parcelId}, and confirm delivery at ${site()}/orders when it arrives.\n\n#NotesApp` }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    if (action === "add_custody") {
      if (!open) throw new Fail("This order can't be changed now.", 409);
      if (order.mode === "courier") throw new Fail("This order is tracked with a courier.", 409);
      if (!isHolderType(body.holderType) || body.holderType === "buyer" || body.holderType === "courier") throw new Fail("Choose who holds the parcel.");
      const holderName = cleanText(body.holderName, 60);
      const location = cleanText(body.location, 120);
      if (!holderName || !location) throw new Fail("Enter the holder's name and where the parcel is.");
      let holderPhone: string | undefined;
      if (String(body.holderPhone || "").trim()) {
        const p = normalizePhone(body.holderPhone);
        if (!p) throw new Fail("Enter a valid Nigerian phone number for the holder (e.g. 08012345678).");
        if (body.consent !== true) throw new Fail("Confirm the holder agrees to their phone number being shown to the buyer.");
        holderPhone = p;
      }
      const entry: CustodyEntry = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        holderType: body.holderType, holderName, ...(holderPhone ? { holderPhone } : {}), location, at: now, status: "confirmed", by: "seller",
      };
      const batch = db.batch();
      batch.update(ref, { status: "dispatched", mode: "handoff", ...(order.dispatchedAt ? {} : { dispatchedAt: now }) });
      batch.update(parcelRef, { status: "dispatched", mode: "handoff", custody: FieldValue.arrayUnion(entry) });
      await batch.commit();
      await expireLinks(order.parcelId).catch(() => {}); // the seller recording the next holder ends earlier holders' links
      if (!order.dispatchedAt && order.buyerEmail) await sendEmail({ to: order.buyerEmail, subject: "Your #NotesApp order is on its way", text: `${order.itemTitle} is with ${holderName} (${location}).\nFollow it with parcel ID ${order.parcelId} at ${site()}/track/${order.parcelId}, and confirm delivery at ${site()}/orders when it arrives.\n\n#NotesApp` }).catch(() => {});
      return NextResponse.json({ ok: true, entryId: entry.id });
    }

    if (action === "holder_link") {
      if (!open) throw new Fail("This order can't be changed now.", 409);
      const parcel = (await parcelRef.get()).data();
      const entry = (parcel?.custody as CustodyEntry[] | undefined)?.find((c) => c.id === body.entryId);
      if (!entry) throw new Fail("No such hand-off entry.", 404);
      const token = newLinkToken();
      await db.doc(`parcelLinks/${hashToken(token)}`).set({
        parcelId: order.parcelId, entryId: entry.id, active: true, createdAt: now, expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      });
      return NextResponse.json({ ok: true, url: holderUrl(token) });
    }

    if (action === "mark_delivered") {
      if (!["dispatched"].includes(order.status)) throw new Fail(order.status === "paid" ? "Dispatch it first." : "This order can't be changed now.", 409);
      const releaseAt = autoReleaseAt();
      const batch = db.batch();
      batch.update(ref, { status: "delivered", deliveredAt: now, autoReleaseAt: releaseAt });
      batch.update(parcelRef, { status: "delivered" });
      await batch.commit();
      if (order.buyerEmail) await sendEmail({ to: order.buyerEmail, subject: "Your #NotesApp order was marked delivered", text: `The seller marked ${order.itemTitle} as delivered. If it's with you, confirm at ${site()}/orders. If something's wrong, report it there within 7 days — after that the money is released to the seller automatically.\n\n#NotesApp` }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    throw new Fail("Unknown action.");
  } catch (err) {
    if (err instanceof Fail) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't update the order");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
