import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, getUserEmail } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { CustodyEntry, HOLDER_LABEL, Parcel, StoreOrder, cleanText, isHolderType, normalizePhone } from "@/lib/orders";
import type { MerchOrder } from "@/lib/merch";
import { autoReleaseAt, expireLinks, hashToken, holderUrl, newLinkToken, sendMerchStatusEmail } from "@/lib/orders-server";

export const dynamic = "force-dynamic";
class Fail extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// No-login access for whoever is carrying a parcel (bike rider, bus driver, park agent…).
// The seller gives each holder a short link. It lets them update the location, hand the
// parcel on to the next holder, or mark it delivered — and it stops working the moment
// the next party confirms they have the parcel (or after 14 days).
async function load(token: string) {
  const db = getAdminDb();
  const lref = db.doc(`parcelLinks/${hashToken(token)}`);
  const link = (await lref.get()).data();
  if (!link) throw new Fail("This link isn't valid.", 404);
  if (!link.active || new Date(link.expiresAt).getTime() < Date.now()) throw new Fail("This link has expired — the parcel has moved on.", 410);
  const pref = db.doc(`parcels/${link.parcelId}`);
  const parcel = (await pref.get()).data() as Parcel | undefined;
  if (!parcel) throw new Fail("Parcel not found.", 404);
  const entry = parcel.custody.find((c) => c.id === link.entryId);
  if (!entry) throw new Fail("This link isn't valid.", 404);
  return { db, lref, link, pref, parcel, entry };
}

export async function GET(req: NextRequest) {
  try {
    const limited = rateLimit(req, "holder", clientIp(req), 40, 60);
    if (limited) return limited;
    const { parcel, entry } = await load(String(req.nextUrl.searchParams.get("token") || ""));
    const latest = [...parcel.custody].reverse().find((c) => c.status === "confirmed");
    return NextResponse.json({
      parcelId: parcel.parcelId,
      itemTitle: parcel.itemTitle,
      destination: `${parcel.city}, ${parcel.state}`,
      parcelStatus: parcel.status,
      entry: { id: entry.id, holderType: entry.holderType, holderName: entry.holderName, location: entry.location, status: entry.status },
      isLatest: !!latest && latest.id === entry.id,
    });
  } catch (err) {
    if (err instanceof Fail) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't load this link");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, "holder-post", clientIp(req), 30, 60);
    if (limited) return limited;
    const body = await req.json();
    const { db, pref, parcel, entry } = await load(String(body.token || ""));
    if (!["paid", "dispatched"].includes(parcel.status)) throw new Fail("This parcel is no longer in transit.", 409);
    const now = new Date().toISOString();
    const action = String(body.action);
    const entries = parcel.custody;
    const latest = [...entries].reverse().find((c) => c.status === "confirmed");

    // The next holder confirms they have it → earlier holders' links stop working.
    if (action === "confirm") {
      if (entry.status !== "pending") throw new Fail("You've already confirmed.", 409);
      const updated = entries.map((c) => (c.id === entry.id ? { ...c, status: "confirmed" as const, at: now } : c));
      // Official merch keeps its own stages (admin marks shipped); a holder confirming only updates the log.
      await pref.update({ custody: updated, ...(parcel.kind === "merch" ? {} : { status: "dispatched" }) });
      await expireLinks(parcel.parcelId, entry.id);
      return NextResponse.json({ ok: true });
    }

    if (entry.status !== "confirmed" || !latest || latest.id !== entry.id) throw new Fail("The parcel has already moved on from you.", 409);

    if (action === "update_location") {
      const location = cleanText(body.location, 120);
      if (!location) throw new Fail("Say where the parcel is now.");
      await pref.update({ custody: entries.map((c) => (c.id === entry.id ? { ...c, location, at: now } : c)) });
      return NextResponse.json({ ok: true });
    }

    if (action === "pass_on") {
      if (!isHolderType(body.holderType) || body.holderType === "buyer" || body.holderType === "courier") throw new Fail("Choose who is taking it next.");
      const holderName = cleanText(body.holderName, 60);
      const location = cleanText(body.location, 120);
      if (!holderName || !location) throw new Fail("Enter the next holder's name and where you're handing it over.");
      const p = normalizePhone(body.holderPhone);
      if (!p) throw new Fail("Enter the next holder's Nigerian phone number (e.g. 08012345678).");
      if (body.consent !== true) throw new Fail("Confirm they agree to their phone number being shown to the buyer.");
      const next: CustodyEntry = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        holderType: body.holderType, holderName, holderPhone: p, location, at: now, status: "pending", by: "holder",
      };
      const token = newLinkToken();
      const batch = db.batch();
      batch.update(pref, { custody: FieldValue.arrayUnion(next) });
      batch.set(db.doc(`parcelLinks/${hashToken(token)}`), { parcelId: parcel.parcelId, entryId: next.id, active: true, createdAt: now, expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString() });
      await batch.commit();
      // Tell the seller who it's with now (holders' links expire on confirmation).
      const order = (await db.doc(`storeOrders/${parcel.orderRef}`).get()).data() as StoreOrder | undefined;
      const to = order ? await getUserEmail(order.sellerUid) : null;
      if (to) await sendEmail({ to, subject: `Parcel ${parcel.parcelId} handed on`, text: `${entry.holderName} handed ${parcel.itemTitle} on to ${holderName} (${HOLDER_LABEL[body.holderType as keyof typeof HOLDER_LABEL]}) at ${location}. It shows as confirmed once ${holderName} opens their link and confirms.\n\n#NotesApp`, action: { label: "Track the parcel", url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng"}/track/${parcel.parcelId}` } }).catch(() => {});
      return NextResponse.json({ ok: true, nextUrl: holderUrl(token) });
    }

    if (action === "delivered" && parcel.kind === "merch") {
      // Official merch has no escrow: record the delivery and tell the buyer.
      const mref = db.doc(`merchOrders/${parcel.orderRef}`);
      const morder = (await mref.get()).data() as MerchOrder | undefined;
      if (!morder || !["printed", "shipped"].includes(morder.status)) throw new Fail("This parcel can't be marked delivered now.", 409);
      const batch = db.batch();
      batch.update(mref, { status: "delivered", deliveredAt: now, ...(morder.shippedAt ? {} : { shippedAt: now }) });
      batch.update(pref, { status: "delivered", merchStatus: "delivered" });
      await batch.commit();
      await expireLinks(parcel.parcelId);
      await sendMerchStatusEmail(morder, parcel.parcelId, "delivered");
      return NextResponse.json({ ok: true });
    }

    if (action === "delivered") {
      const order = (await db.doc(`storeOrders/${parcel.orderRef}`).get()).data() as StoreOrder | undefined;
      if (!order || order.status !== "dispatched") throw new Fail("This parcel can't be marked delivered now.", 409);
      const batch = db.batch();
      batch.update(db.doc(`storeOrders/${parcel.orderRef}`), { status: "delivered", deliveredAt: now, autoReleaseAt: autoReleaseAt() });
      batch.update(pref, { status: "delivered" });
      await batch.commit();
      await expireLinks(parcel.parcelId);
      if (order.buyerEmail) await sendEmail({ to: order.buyerEmail, subject: "Your #NotesApp order was marked delivered", text: `${parcel.itemTitle} was marked delivered by ${entry.holderName}. If it's with you, confirm at ${process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng"}/orders. If something's wrong, report it there within 7 days — after that the money is released to the seller automatically.\n\n#NotesApp`, action: { label: "Confirm or report", url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng"}/orders` } }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    throw new Fail("Unknown action.");
  } catch (err) {
    if (err instanceof Fail) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't update the parcel");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
