import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { canActForSeller, notifyBackInStock } from "@/lib/orders-server";

export const dynamic = "force-dynamic";

// The seller (or a team member with store access) saved new stock: tell everyone who
// asked to be notified. The client calls this after a save that took stock above zero.
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const { itemId } = await req.json();
    const item = (await getAdminDb().doc(`storeItems/${String(itemId)}`).get()).data();
    if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    if (!(await canActForSeller(me.uid, item.ownerUid))) return NextResponse.json({ error: "Not your item." }, { status: 403 });
    const notified = await notifyBackInStock(String(itemId));
    return NextResponse.json({ ok: true, notified });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't send notifications");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
