import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { CommunityError } from "@/lib/community-server";
import { iceServers } from "@/lib/calls-server";
import { isLocalHost } from "@/lib/host";
import { GUEST_COOKIE, GUEST_PASS_MS } from "@/lib/live-guests";
import { checkGuestPass, issueGuestPass } from "@/lib/live-guest-pass";
import { guestBeat, guestConverted, guestJoin, guestKey, guestLeave, guestRelay, guestView } from "@/lib/live-guests-server";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store, private" };

// Watching a live without an account (lib/live-guests-server.ts, docs/GUEST_LIVES.md). No sign-in; limited by the visitor's address.
//   GET ?id=                                → what a guest sees: the live, why they can't watch (if so), the stage, the chat, the count
//   POST { action: "join", id }             → a guest pass (a signed, http-only cookie) and a seat → { iceServers }
//   POST { action: "beat" | "leave", id }   · { action: "relay", id, op: "pull" | "answer" | "close", … } (receive only)
//   POST { action: "converted", id }        → signed in: counts the guest who just joined or signed in from this live, once
const fail = (err: unknown) => {
  if (err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
  const f = friendlyMessage(err, "Couldn't open the live");
  return NextResponse.json({ error: f.message }, { status: f.status, headers: NO_STORE });
};
const cookieOpts = (req: NextRequest, maxAge: number) => ({ httpOnly: true, secure: !isLocalHost(req.nextUrl.hostname), sameSite: "lax" as const, path: "/api/lives/watch", maxAge });

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "guest-live-view", clientIp(req), 120, 60);
    if (limited) return limited;
    return NextResponse.json(await guestView(getAdminDb(), req.nextUrl.searchParams.get("id")), { headers: NO_STORE });
  } catch (err) { return fail(err); }
}

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ip = clientIp(req);
    const key = guestKey();
    if (!key) throw new CommunityError(503, "Watching without an account isn't available right now. Sign in to watch.");
    const now = new Date();
    const db = getAdminDb();
    const gid = checkGuestPass(key, req.cookies.get(GUEST_COOKIE)?.value, now.getTime());
    switch (b.action) {
      case "join": {
        const limited = await rateLimit(req, "guest-live-join", ip, 30, 600);
        if (limited) return limited;
        const pass = gid ? null : issueGuestPass(key, now.getTime());
        await guestJoin(db, b.id, gid ?? pass!.id, now);
        const res = NextResponse.json({ iceServers: await iceServers() }, { headers: NO_STORE });
        if (pass) res.cookies.set(GUEST_COOKIE, pass.pass, cookieOpts(req, Math.floor(GUEST_PASS_MS / 1000)));
        return res;
      }
      case "beat": {
        const limited = await rateLimit(req, "guest-live-beat", ip, 30, 60);
        if (limited) return limited;
        if (!gid) throw new CommunityError(401, "Open the live again.");
        return NextResponse.json(await guestBeat(db, b.id, gid, now), { headers: NO_STORE });
      }
      case "leave": {
        if (gid) await guestLeave(db, b.id, gid).catch(() => {});
        return NextResponse.json({ ok: true }, { headers: NO_STORE });
      }
      case "relay": {
        const limited = await rateLimit(req, "guest-live-relay", ip, 120, 60);
        if (limited) return limited;
        if (!gid) throw new CommunityError(401, "Open the live again.");
        return NextResponse.json(await guestRelay(db, b.id, gid, b), { headers: NO_STORE });
      }
      case "converted": {
        const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
        if (!me || !gid) return NextResponse.json({ counted: false }, { headers: NO_STORE });
        const out = await guestConverted(db, b.id, gid, me.uid, now);
        const res = NextResponse.json(out, { headers: NO_STORE });
        res.cookies.set(GUEST_COOKIE, "", cookieOpts(req, 0)); // they have an account now: the pass is done with
        return res;
      }
      default: throw new CommunityError(400, "Unknown action.");
    }
  } catch (err) { return fail(err); }
}
