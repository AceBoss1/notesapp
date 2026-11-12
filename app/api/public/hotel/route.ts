import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ensurePricing } from "@/lib/pricing-server";
import { fulfillPayment } from "@/lib/payments";
import { HotelError, availability, createBooking, createOrder, guestView, hotelById, hotelByUsername, publicHotel, requestSetup } from "@/lib/hotel-server";
import { providers, startPay } from "@/lib/hotel-pay-server";

// The Hotel kit for guests (no sign-in needed; on a hotel's own domain too, as /api/public passes through middleware.ts).
// GET ?u=<username>[&b=<branch id>] → the hotel, its rooms, departments and menus | ?code=<code> → a guest's booking, order or room bill
// POST { action }: rooms (h, checkIn, checkOut) | book (h, roomId, dates, name, email, phone, guests, pay) | order (h, deptId, lines, target,
//   name, phone, pay, stayCode) | pay (target, id, code, method, email) | check (code, ref) | setup (Set it up for me: a request to our team)
// Prices are always read here from the hotel's own records; nothing a page sends sets a price or marks anything paid.
export const dynamic = "force-dynamic";
const noStore = { headers: { "Cache-Control": "no-store" } };
const fail = (err: unknown, what: string) => {
  if (err instanceof HotelError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const l = await rateLimit(req, "hotel-public", clientIp(req), 300, 600);
    if (l) return l;
    const db = getAdminDb();
    await ensurePricing();
    if (sp.get("code")) return NextResponse.json(await guestView(db, sp.get("code")), noStore);
    const found = await hotelByUsername(db, String(sp.get("u") ?? ""), sp.get("b") ?? undefined);
    if (!found) return NextResponse.json({ error: "This hotel isn't on #NotesApp yet." }, { status: 404 });
    return NextResponse.json(await publicHotel(db, found, new Date(), providers()), noStore);
  } catch (err) {
    return fail(err, "Couldn't load the hotel");
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    await ensurePricing();
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    const limit = async (bucket: string, max: number, win: number) => { const x = await rateLimit(req, bucket, ip, max, win); if (x) throw new HotelError(429, "Too many tries. Wait a little and try again."); };
    switch (b.action) {
      case "rooms": await limit("hotel-rooms", 120, 600); return NextResponse.json({ rooms: await availability(db, String(b.h ?? ""), b.checkIn, b.checkOut) }, noStore);
      case "book": {
        await limit("hotel-book", 12, 3600);
        const x = await createBooking(db, String(b.h ?? ""), b, new Date(), me?.uid);
        return NextResponse.json({ id: x.id, code: x.code, totalKobo: x.totalKobo, holdUntil: x.holdUntil, payMethod: x.payMethod });
      }
      case "order": {
        await limit("hotel-order", 30, 3600);
        const o = await createOrder(db, String(b.h ?? ""), b, "site");
        return NextResponse.json({ id: o.id, code: o.code, number: o.number, totalKobo: o.totalKobo, status: o.status, holdUntil: o.holdUntil ?? null });
      }
      case "pay": await limit("hotel-pay", 20, 3600); return NextResponse.json(await startPay(db, b, me?.uid));
      case "check": {
        await limit("hotel-check", 120, 600);
        const ref = String(b.ref ?? "");
        const p = /^[A-Za-z0-9_-]{6,80}$/.test(ref) ? (await db.doc(`payments/${ref}`).get()).data() : null;
        // Only this guest's own payment: the code on the payment must match the link they're on.
        if (p && p.kind === "hotel" && p.hotel?.code === String(b.code ?? "").toUpperCase() && p.status === "pending") await fulfillPayment(ref).catch(() => null);
        return NextResponse.json(await guestView(db, b.code), noStore);
      }
      case "setup": {
        await limit("hotel-setup", 5, 3600);
        return NextResponse.json(await requestSetup(db, { uid: me?.uid ?? null, email: me?.email ?? null }, b));
      }
      case "hotel": {
        const found = await hotelById(db, String(b.h ?? ""));
        if (!found) throw new HotelError(404, "Hotel not found.");
        return NextResponse.json(await publicHotel(db, found, new Date(), providers()), noStore);
      }
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't do that");
  }
}
