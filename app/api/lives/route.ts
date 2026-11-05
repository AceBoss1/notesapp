import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { CommunityError } from "@/lib/community-server";
import { iceServers } from "@/lib/calls-server";
import { liveVideoConfig } from "@/lib/rooms-server";
import {
  LiveEventError, cancelLiveEvent, createLiveEvent, enterPaidLive, hostLives, liveLobby, myLiveTickets, paidFigures, startPaidLive, upcomingLives,
} from "@/lib/live-tickets-server";

export const dynamic = "force-dynamic";
const viewer = async (req: NextRequest) => (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null))?.uid ?? null;
const fail = (err: unknown, what: string) => {
  if (err instanceof LiveEventError || err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Paid lives (lib/live-tickets.ts, lib/live-tickets-server.ts).
// GET ?figures=1 → { figures } (the late window, the discount cap, the no-show minutes and the commission share, from Admin)
// GET ?id= → the lobby (the live, the price band now and what this viewer would pay, their ticket) · GET → { upcoming, mine, hosting }
// POST { action: "create", title, description?, startsAt, earlyUntil, earlyNaira, normalNaira, lateNaira, audience, record, poster? }
//      { action: "start", id, stageMode?, mods? } (the host opens the room) → { roomId, mode, iceServers, video }
//      { action: "enter", id } (the door: a ticket holder gets the room) → { roomId } · { action: "cancel", id } (the host; everyone refunded)
// Buying a ticket is a checkout: POST /api/paystack/initialize { kind: "live_ticket", eventId }.
export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    if (q.get("figures")) return NextResponse.json({ figures: await paidFigures(db) }, { headers: { "Cache-Control": "public, s-maxage=60" } });
    const uid = await viewer(req);
    if (q.get("id")) return NextResponse.json(await liveLobby(db, q.get("id"), uid), { headers: { "Cache-Control": "no-store" } });
    const [upcoming, mine, hosting] = await Promise.all([upcomingLives(db), uid ? myLiveTickets(db, uid) : [], uid ? hostLives(db, uid) : []]);
    return NextResponse.json({ upcoming, mine, hosting }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load paid lives");
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await viewer(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "lives", uid, 120, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "create": return NextResponse.json({ event: await createLiveEvent(db, uid, b) });
      case "start": return NextResponse.json({ ...(await startPaidLive(db, uid, b.id, undefined, undefined, { stageMode: b.stageMode, mods: b.mods })), iceServers: await iceServers(), video: await liveVideoConfig(db) });
      case "enter": return NextResponse.json(await enterPaidLive(db, uid, b.id));
      case "cancel": return NextResponse.json(await cancelLiveEvent(db, uid, b.id));
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    return fail(err, "Couldn't do that");
  }
}
