import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { getShopDirectoryForAdmin } from "@/lib/shop-directory";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: the shops that can take orders (the Merch Store's candidates), with those switched off flagged.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    return NextResponse.json({ shops: await getShopDirectoryForAdmin() });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load shops");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

// { username, hidden } — hide a shop from the Merch Store page (or show it again). The shop itself keeps working.
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    const body = await req.json();
    const name = String(body.username || "").trim().toLowerCase().replace(/^@/, "");
    const db = getAdminDb();
    const uid = (await db.doc(`usernames/${name}`).get()).data()?.uid as string | undefined;
    if (!uid) return NextResponse.json({ error: `No member with the username @${name}.` }, { status: 404 });
    await db.doc(`users/${uid}`).update({ shopHidden: body.hidden === true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't update the shop");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
