import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { authed, fail } from "@/lib/moments-api";
import { MessageError } from "@/lib/messages-server";
import { iceServers } from "@/lib/calls-server";
import { beatGroupCall, joinGroupCall, leaveGroupCall, startGroupCall } from "@/lib/group-calls-server";
import { CALLS_LIVE } from "@/lib/moments-rules";

export const dynamic = "force-dynamic";

// Group calls in a group chat (lib/group-calls.ts):
// POST { action: "start", cid, kind } → { id, iceServers }   (joins the group's live call if there is one)
// POST { action: "join", id } → { others, iceServers } · { action: "beat", id } → { live } · { action: "leave", id } → { ended }
export async function POST(req: NextRequest) {
  try {
    if (!CALLS_LIVE) throw new MessageError(404, "Not found.");
    const body = await req.json().catch(() => ({}));
    const me = await authed(req, "messages", body.action === "start");
    const db = getAdminDb();
    if (body.action === "start") {
      const limited = await rateLimit(req, "group-call-start", me.uid, 20, 3600);
      if (limited) return limited;
      const r = await startGroupCall(db, me.uid, body.cid, body.kind);
      return NextResponse.json({ ...r, iceServers: await iceServers() });
    }
    if (body.action === "join") return NextResponse.json({ ...(await joinGroupCall(db, me.uid, body.id)), iceServers: await iceServers() });
    if (body.action === "beat") return NextResponse.json(await beatGroupCall(db, me.uid, body.id));
    if (body.action === "leave") return NextResponse.json(await leaveGroupCall(db, me.uid, body.id));
    throw new MessageError(400, "Unknown action.");
  } catch (err) {
    return fail(err, "Couldn't connect the group call");
  }
}
