import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { MessageError } from "@/lib/messages-server";
import { WalletError } from "@/lib/wallet-server";
import { iceServers } from "@/lib/calls-server";
import { CALLS_LIVE } from "@/lib/moments-rules";
import {
  PpmError, addPpmMinutes, beatPpm, bookPpm, cancelPpm, getPpmOffer, myPpmSessions, ppmFiguresLive, ppmOfferView, ppmSessionView, reportPpm, startPpmCall,
} from "@/lib/ppm-server";

export const dynamic = "force-dynamic";
const viewer = async (req: NextRequest) => (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null))?.uid ?? null;
const fail = (err: unknown, what: string) => {
  if (err instanceof PpmError || err instanceof WalletError || err instanceof MessageError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Pay-per-minute sessions (lib/ppm.ts, lib/ppm-server.ts).
// GET ?figures=1 → { figures } (the minimum and maximum minutes, the grace, the wait, the no-show minutes and the commission share, from Admin)
// GET ?username= → the publisher's offer as this viewer sees it (prices, who may book, whether they can) · GET ?offer=mine → my own offer
// GET ?id= → one session (with the server's meter) · GET → { booked, hosting }
// POST { action: "book", username, kind: "voice" | "video", minutes, date, slot } → { session } (the minutes' price is held from credit)
//      { action: "call", id } → { id, cid, kind, name, avatar, iceServers } (the session's call) · { action: "beat", id } → the session
//      { action: "add", id, minutes } (the viewer holds more) · { action: "cancel", id } (before the call) · { action: "report", id, reason }
// The publisher's prices are saved with Rates & payouts (POST /api/publisher/settings { ppm }).
export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    if (q.get("figures")) return NextResponse.json({ figures: await ppmFiguresLive(db) }, { headers: { "Cache-Control": "public, s-maxage=60" } });
    const uid = await viewer(req);
    if (q.get("username")) return NextResponse.json(await ppmOfferView(db, q.get("username"), uid), { headers: { "Cache-Control": "no-store" } });
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    if (q.get("offer") === "mine") return NextResponse.json({ offer: await getPpmOffer(db, uid), figures: await ppmFiguresLive(db) }, { headers: { "Cache-Control": "no-store" } });
    if (q.get("id")) return NextResponse.json(await ppmSessionView(db, uid, q.get("id")), { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(await myPpmSessions(db, uid), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load pay-per-minute sessions");
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await viewer(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const b = await req.json().catch(() => ({}));
    // Beats come every 15 seconds from each phone in a call: their own, roomier limit.
    const limited = b.action === "beat" ? await rateLimit(req, "ppm-beat", uid, 600, 3600) : await rateLimit(req, "ppm", uid, 120, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    switch (b.action) {
      case "book": return NextResponse.json({ session: await bookPpm(db, uid, b) });
      case "call": {
        if (!CALLS_LIVE) throw new PpmError(404, "Calls aren't switched on yet.");
        return NextResponse.json({ ...(await startPpmCall(db, uid, b.id)), iceServers: await iceServers() });
      }
      case "beat": return NextResponse.json(await beatPpm(db, uid, b.id));
      case "add": return NextResponse.json(await addPpmMinutes(db, uid, b.id, b.minutes));
      case "cancel": return NextResponse.json(await cancelPpm(db, uid, b.id));
      case "report": return NextResponse.json(await reportPpm(db, uid, b.id, b.reason));
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    return fail(err, "Couldn't do that");
  }
}
