import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { byNewest, paginate, rowsOf, v1 } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// Sessions booked with you. Client contact details are not exposed through the API.
export const GET = v1("read:bookings", async (req, { uid }) => {
  const status = req.nextUrl.searchParams.get("status");
  const snap = await getAdminDb().collection("bookings").where("publisherUid", "==", uid).limit(1000).get();
  const rows = rowsOf(snap)
    .filter((b) => !status || b.status === status)
    .sort(byNewest("createdAt"));
  const page = paginate(req, rows);
  return NextResponse.json({
    data: page.data.map((b) => ({ id: b.id, date: b.date, slot: b.slot, minutes: b.minutes, starts_at: b.startsAt, status: b.status, amount_kobo: b.amountKobo, created_at: b.createdAt })),
    next_cursor: page.next_cursor,
  });
});
