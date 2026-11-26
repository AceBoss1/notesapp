import { NextRequest, NextResponse } from "next/server";
import { checkReply } from "@/lib/content-checks-reply";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { refundPayment } from "@/lib/refunds";
import { MeetingError, startMeetingRoom, cancelMeeting, cancelSeat, createMeeting, getMeeting, lastMeeting, myMeetings, takeFreeSeat, upcomingMeetings, updateMeeting } from "@/lib/meetings-server";

export const dynamic = "force-dynamic";
const viewer = async (req: NextRequest) => (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null))?.uid ?? null;
const fail = (err: unknown, what: string) => {
  const cc = checkReply(err);
  if (cc) return cc;
  if (err instanceof MeetingError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Meetings (lib/meetings.ts). GET ?id= → one meeting · ?host=<username> → { meetings } (public, upcoming) · ?mine=1 → { booked, hosting } · ?last=1 → { meeting }: my latest, to start the next from
export async function GET(req: NextRequest) {
  try {
    const uid = await viewer(req);
    const q = req.nextUrl.searchParams;
    const db = getAdminDb();
    const noStore = { headers: { "Cache-Control": "no-store" } };
    if (q.get("id")) return NextResponse.json(await getMeeting(db, q.get("id")!, uid), noStore);
    if (q.get("host")) return NextResponse.json({ meetings: await upcomingMeetings(db, q.get("host")!.slice(0, 40)) }, noStore);
    if (q.get("last")) {
      if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
      return NextResponse.json({ meeting: await lastMeeting(db, uid) }, noStore);
    }
    if (q.get("mine")) {
      if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
      return NextResponse.json(await myMeetings(db, uid), noStore);
    }
    return NextResponse.json({ error: "Which meeting?" }, { status: 400 });
  } catch (err) { return fail(err, "Couldn't load the meeting"); }
}

// POST { action: create | update | cancel | seat | leave | room, … } (room: the host opens the #NotesApp meeting room) (signed in). A paid seat is bought through checkout (kind "meeting").
export async function POST(req: NextRequest) {
  try {
    const uid = await viewer(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "meetings", uid, 200, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    const id = String(b.id ?? "");
    if (b.action === "create") return NextResponse.json({ meeting: await createMeeting(db, uid, b) });
    if (b.action === "update") return NextResponse.json({ meeting: await updateMeeting(db, uid, id, b) });
    if (b.action === "cancel") { await cancelMeeting(db, uid, id, refundPayment); return NextResponse.json({ ok: true }); }
    if (b.action === "room") return NextResponse.json(await startMeetingRoom(db, uid, id));
    if (b.action === "seat") { await takeFreeSeat(db, uid, id); return NextResponse.json({ ok: true }); }
    if (b.action === "leave") return NextResponse.json(await cancelSeat(db, uid, id, refundPayment));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) { return fail(err, "Couldn't do that"); }
}
