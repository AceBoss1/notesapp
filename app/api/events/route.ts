import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { CommunityError } from "@/lib/community-server";
import { EventError, cancelEvent, createEvent, getEvent, rsvp, updateEvent, upcoming } from "@/lib/events-server";

export const dynamic = "force-dynamic";
const viewer = async (req: NextRequest) => (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null))?.uid ?? null;
const fail = (err: unknown, what: string) => {
  if (err instanceof EventError || err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// GET ?id= → one event · GET ?state=&city=&cid=&host=&mine=1 → { events } (lib/events-server.ts)
export async function GET(req: NextRequest) {
  try {
    const uid = await viewer(req);
    const q = req.nextUrl.searchParams;
    const db = getAdminDb();
    if (q.get("id")) return NextResponse.json(await getEvent(db, q.get("id")!, uid), { headers: { "Cache-Control": "no-store" } });
    const events = await upcoming(db, { state: q.get("state") ?? undefined, city: q.get("city") ?? undefined, cid: q.get("cid") ?? undefined, host: q.get("host") ?? undefined, mine: q.get("mine") === "1" }, uid);
    return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load events");
  }
}

// POST { action: create | update | cancel | rsvp, … } (signed in)
export async function POST(req: NextRequest) {
  try {
    const uid = await viewer(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "events", uid, 300, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    if (b.action === "create") return NextResponse.json({ event: await createEvent(db, uid, b) });
    if (b.action === "update") return NextResponse.json({ event: await updateEvent(db, uid, String(b.id), b) });
    if (b.action === "cancel") { await cancelEvent(db, uid, String(b.id)); return NextResponse.json({ ok: true }); }
    if (b.action === "rsvp") return NextResponse.json(await rsvp(db, uid, String(b.id), b.status));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't do that");
  }
}
