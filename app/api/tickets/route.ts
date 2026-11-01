import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { EventError } from "@/lib/events-server";
import { checkIn, checkInStats, myTickets, setTicketTypes } from "@/lib/tickets-server";

export const dynamic = "force-dynamic";
const viewer = async (req: NextRequest) => (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null))?.uid ?? null;
const fail = (err: unknown, what: string) => {
  if (err instanceof EventError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};
const ok = (body: unknown) => NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });

// Paid event tickets (lib/tickets-server.ts). Buying is /api/paystack/initialize with kind "ticket".
//   GET                 → { tickets }: mine (GET ?event= → mine for that event)
//   GET ?checkin=<id>   → sold and checked-in counts (the organiser)
//   POST { action: "types", eventId, types } · { action: "checkin", eventId, code } (the organiser)
export async function GET(req: NextRequest) {
  try {
    const uid = await viewer(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const q = req.nextUrl.searchParams;
    if (q.get("checkin")) return ok(await checkInStats(getAdminDb(), uid, q.get("checkin")!));
    return ok({ tickets: await myTickets(getAdminDb(), uid, q.get("event") ?? undefined) });
  } catch (err) {
    return fail(err, "Couldn't load tickets");
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await viewer(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "tickets", uid, 2000, 3600); // a busy door checks many in
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (b.action === "types") return ok({ types: await setTicketTypes(db, uid, String(b.eventId ?? ""), b.types) });
    if (b.action === "checkin") return ok(await checkIn(db, uid, String(b.eventId ?? ""), String(b.code ?? "")));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't do that");
  }
}
