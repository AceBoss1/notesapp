import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { authed, fail } from "@/lib/moments-api";
import { MessageError } from "@/lib/messages-server";
import { endCall, iceServers, startCall } from "@/lib/calls-server";
import { CALLS_LIVE } from "@/lib/moments-rules";

export const dynamic = "force-dynamic";

// GET → { iceServers } for connecting a call.
// POST { action: "start", toUid, kind: "audio" | "video" } → { id, cid, iceServers } | { action: "end", id, reason: "ended" | "declined" | "missed" | "failed" }
export async function GET(req: NextRequest) {
  try {
    if (!CALLS_LIVE) throw new MessageError(404, "Not found.");
    await authed(req, "messages");
    return NextResponse.json({ iceServers: await iceServers() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't prepare the call");
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!CALLS_LIVE) throw new MessageError(404, "Not found.");
    const body = await req.json().catch(() => ({}));
    // Starting a call needs a verified email (like sending a message); ending, declining or missing one never does.
    const me = await authed(req, "messages", body.action === "start");
    const db = getAdminDb();
    if (body.action === "start") {
      const limited = rateLimit(req, "call-start", me.uid, 30, 3600);
      if (limited) return limited;
      const r = await startCall(db, me.uid, body.toUid, body.kind);
      return NextResponse.json({ ...r, iceServers: await iceServers() });
    }
    if (body.action === "end") return NextResponse.json(await endCall(db, me.uid, body.id, body.reason));
    throw new MessageError(400, "Unknown action.");
  } catch (err) {
    return fail(err, "Couldn't place the call");
  }
}
