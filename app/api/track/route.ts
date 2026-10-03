import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { Parcel, normalizeParcelId } from "@/lib/orders";
import { canActForSeller } from "@/lib/orders-server";

export const dynamic = "force-dynamic";

const LOCK_AFTER = 8; // wrong "last 4 digits" guesses per hour before this parcel's phone numbers lock
const WINDOW_MS = 3_600_000;

// Public parcel tracking: GET /api/track?id=NA-XXXXXXXX[&last4=1234]
// Anyone with the parcel ID sees where it is. Holders' phone numbers appear only for
// the buyer, the seller or an admin (signed in), or for someone who also gives the last
// 4 digits of the receiver's phone number.
export async function GET(req: NextRequest) {
  try {
    const limited = rateLimit(req, "track", clientIp(req), 40, 60);
    if (limited) return limited;
    const id = normalizeParcelId(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "That doesn't look like a parcel ID (it looks like NA-7K2M9QXD)." }, { status: 400 });
    const ref = getAdminDb().doc(`parcels/${id}`);
    const parcel = (await ref.get()).data() as Parcel | undefined;
    if (!parcel) return NextResponse.json({ error: "No parcel with that ID." }, { status: 404 });

    // Who is asking?
    let privileged = false;
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const d = await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null);
      if (d && (d.uid === parcel.buyerUid || d.admin === true || (await canActForSeller(d.uid, parcel.sellerUid)))) privileged = true;
    }
    let phonesUnlocked = privileged;
    let phoneError = "";
    const last4 = String(req.nextUrl.searchParams.get("last4") || "").replace(/\D/g, "");
    if (!privileged && last4) {
      const now = Date.now();
      if (parcel.lockedUntil && new Date(parcel.lockedUntil).getTime() > now) {
        phoneError = "Too many wrong tries — try again later.";
      } else if (last4.length === 4 && last4 === parcel.buyerPhoneLast4) {
        phonesUnlocked = true;
      } else {
        const w = parcel.failedLookups && now - new Date(parcel.failedLookups.windowStart).getTime() < WINDOW_MS ? parcel.failedLookups : { count: 0, windowStart: new Date().toISOString() };
        const count = w.count + 1;
        await ref.update({ failedLookups: { count, windowStart: w.windowStart }, ...(count >= LOCK_AFTER ? { lockedUntil: new Date(now + WINDOW_MS).toISOString() } : {}) });
        phoneError = "Those digits don't match the receiver's phone number.";
      }
    }

    return NextResponse.json({
      parcelId: parcel.parcelId,
      itemTitle: parcel.itemTitle,
      quantity: parcel.quantity,
      status: parcel.status,
      kind: parcel.kind ?? "store",
      merchStatus: parcel.merchStatus ?? null,
      seller: { name: parcel.sellerName, username: parcel.sellerUsername },
      destination: `${parcel.city}, ${parcel.state}`,
      mode: parcel.mode ?? null,
      courier: parcel.courier ?? null,
      custody: (parcel.custody || []).map((c) => ({
        id: c.id, holderType: c.holderType, holderName: c.holderName, location: c.location, at: c.at, status: c.status,
        ...(phonesUnlocked && c.holderPhone ? { holderPhone: c.holderPhone } : {}),
      })),
      hasPhones: (parcel.custody || []).some((c) => !!c.holderPhone),
      phonesUnlocked,
      phoneError,
    });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't look that up");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
