import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Admin-only view of recorded errors (newest first) and a way to clear one once it is dealt with.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), ["product"]);
    const snap = await getAdminDb().collection("errorLogs").orderBy("lastSeenAt", "desc").limit(100).get();
    return NextResponse.json({
      errors: snap.docs.map((d) => {
        const { expireAt, ...rest } = d.data();
        return { id: d.id, ...rest };
      }),
    });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load errors");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), ["product"]);
    const { action, id } = await req.json();
    if (action !== "clear" || typeof id !== "string" || !/^[a-f0-9]{20}$/.test(id)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await getAdminDb().doc(`errorLogs/${id}`).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't clear the error");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
