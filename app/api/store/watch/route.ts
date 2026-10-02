import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// "Notify me when it's back": GET ?itemId= → am I watching? POST {itemId, watch} → start/stop.
// When the item is restocked the watchers get a bell notification (lib/orders-server.ts).
export async function GET(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ watching: false });
    const itemId = String(req.nextUrl.searchParams.get("itemId") || "");
    const snap = await getAdminDb().doc(`stockWatches/${itemId}_${me.uid}`).get();
    return NextResponse.json({ watching: snap.exists });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't check that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "stock-watch", me.uid, 30, 3600);
    if (limited) return limited;
    const { itemId, watch } = await req.json();
    const db = getAdminDb();
    const item = (await db.doc(`storeItems/${String(itemId)}`).get()).data();
    if (!item || item.sellable !== true) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    const ref = db.doc(`stockWatches/${String(itemId)}_${me.uid}`);
    if (watch === false) {
      await ref.delete();
      return NextResponse.json({ ok: true, watching: false });
    }
    if (Number(item.stock) > 0) return NextResponse.json({ error: "It's in stock right now." }, { status: 409 });
    await ref.set({ itemId: String(itemId), uid: me.uid, createdAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, watching: true });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't save that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
