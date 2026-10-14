import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { endCall, ringTokenOk } from "@/lib/calls-server";
import type { CallDoc } from "@/lib/calls";

export const dynamic = "force-dynamic";

// For the service worker (public/sw.js), which has no sign-in: GET ?id&token → { ringing } (keep ringing or stop); POST { id, token }
// declines the call from the notification. The token comes in the call's push, so only the callee's devices have it.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "", token = req.nextUrl.searchParams.get("token");
  if (!/^[0-9]+_[0-9a-f]{10}$/.test(id) || !ringTokenOk(id, token)) return NextResponse.json({ ringing: false });
  const c = (await getAdminDb().doc(`calls/${id}`).get()).data() as CallDoc | undefined;
  return NextResponse.json({ ringing: c?.status === "ringing" }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!/^[0-9]+_[0-9a-f]{10}$/.test(id) || !ringTokenOk(id, body.token)) return NextResponse.json({ ok: false }, { status: 403 });
  const db = getAdminDb();
  const c = (await db.doc(`calls/${id}`).get()).data() as CallDoc | undefined;
  if (!c || c.status !== "ringing") return NextResponse.json({ ok: true });
  await endCall(db, c.calleeUid, id, "declined").catch(() => {});
  return NextResponse.json({ ok: true });
}
