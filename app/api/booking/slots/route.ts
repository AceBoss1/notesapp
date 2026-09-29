import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { loadPublisher } from "@/lib/publishers";
import { bookingId } from "@/lib/paystack";
import { weekdayOf } from "@/lib/booking-time";

// Public: which slots can be booked on a given date, and at what price.
export async function GET(req: NextRequest) {
  try {
    const username = req.nextUrl.searchParams.get("username") || "";
    const date = req.nextUrl.searchParams.get("date") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    const pub = await loadPublisher(username);
    const s = pub.settings?.session;
    if (!s?.enabled || !pub.hasPayoutAccount) return NextResponse.json({ bookable: false, slots: [] });

    const candidates = s.availability[String(weekdayOf(date))] || [];
    const db = getAdminDb();
    const taken = await Promise.all(
      candidates.map((slot) => db.doc(`bookings/${bookingId(username, date, slot)}`).get())
    );
    const slots = candidates.filter((_, i) => !taken[i].exists);
    return NextResponse.json({ bookable: true, slots, priceKobo: s.priceKobo, minutes: s.minutes });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 404 });
  }
}
