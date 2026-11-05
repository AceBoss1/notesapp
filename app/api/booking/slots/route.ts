import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb } from "@/lib/firebase-admin";
import { loadPublisher } from "@/lib/publishers";
import { slotLockId } from "@/lib/paystack";
import { weekdayOf } from "@/lib/booking-time";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getPpmOffer } from "@/lib/ppm-server";

// Public: which slots can be booked on a given date, and at what price.
// Reads request headers/query, so it must never be prerendered at build time.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "slots", clientIp(req), 60, 60);
  if (limited) return limited;
  try {
    const username = req.nextUrl.searchParams.get("username") || "";
    const date = req.nextUrl.searchParams.get("date") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    const pub = await loadPublisher(username);
    const s = pub.settings?.session;
    const db = getAdminDb();
    // ?ppm=1: the open times for a pay-per-minute session (lib/ppm.ts): the same weekly times and slot locks, offered while the
    // publisher's per-minute offer is on (their fixed-price sessions may be off).
    const ppm = req.nextUrl.searchParams.get("ppm") === "1";
    const open = ppm ? !!(await getPpmOffer(db, pub.uid))?.enabled : !!s?.enabled;
    if (!s || !open || !pub.hasPayoutAccount) return NextResponse.json({ bookable: false, slots: [] });

    const candidates = s.availability[String(weekdayOf(date))] || [];
    const taken = await Promise.all(
      candidates.map((slot) => db.doc(`slotLocks/${slotLockId(username, date, slot)}`).get())
    );
    const slots = candidates.filter((_, i) => !taken[i].exists);
    return NextResponse.json({ bookable: true, slots, priceKobo: s.priceKobo, minutes: s.minutes });
  } catch (err) {
    const f = friendlyMessage(err, "Failed");
    return NextResponse.json({ error: f.message }, { status: f.status === 503 ? 503 : 404 });
  }
}
