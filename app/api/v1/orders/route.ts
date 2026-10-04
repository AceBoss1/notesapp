import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { byNewest, paginate, rowsOf, v1 } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// Store orders for your physical items (?kind=digital lists download sales). Buyer names, phone numbers and
// street addresses are not exposed; you get the city and state to plan delivery.
export const GET = v1("read:orders", async (req, { uid }) => {
  const db = getAdminDb();
  if (req.nextUrl.searchParams.get("kind") === "digital") {
    const snap = await db.collection("digitalPurchases").where("sellerUid", "==", uid).limit(1000).get();
    const rows = rowsOf(snap).sort(byNewest("createdAt"));
    const page = paginate(req, rows);
    return NextResponse.json({
      data: page.data.map((o) => ({ id: o.id, item_id: o.itemId, item_title: o.itemTitle, amount_kobo: o.amountKobo, downloads: o.downloads ?? 0, created_at: o.createdAt })),
      next_cursor: page.next_cursor,
    });
  }
  const status = req.nextUrl.searchParams.get("status");
  const snap = await db.collection("storeOrders").where("sellerUid", "==", uid).limit(1000).get();
  const rows = rowsOf(snap)
    .filter((o) => !status || o.status === status)
    .sort(byNewest("paidAt"));
  const page = paginate(req, rows);
  return NextResponse.json({
    data: page.data.map((o) => ({
      id: o.id, item_id: o.itemId, item_title: o.itemTitle, quantity: o.quantity, unit_kobo: o.unitKobo, delivery_kobo: o.deliveryKobo,
      amount_kobo: o.amountKobo, commission_kobo: o.commissionKobo, status: o.status, parcel_id: o.parcelId,
      ship_to: { city: o.address?.city ?? "", state: o.address?.state ?? "" }, paid_at: o.paidAt,
    })),
    next_cursor: page.next_cursor,
  });
});
