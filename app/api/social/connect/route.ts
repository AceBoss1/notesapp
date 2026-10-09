import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { SocialError, isProvider, safeReturn, startConnect } from "@/lib/social-server";
import { socialAuthed, socialFail } from "@/lib/social-api";

export const dynamic = "force-dynamic";

// POST { provider: "linkedin" | "x", host?, path? } → { url }: send the browser there to sign in to that network and allow posting.
// `host` and `path` say where to land afterwards (one of our own hosts only).
export async function POST(req: NextRequest) {
  try {
    const me = await socialAuthed(req, true);
    const limited = rateLimit(req, "social-connect", me.uid, 10, 600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    if (!isProvider(body.provider)) throw new SocialError(400, "Choose LinkedIn or X.");
    return NextResponse.json(await startConnect(getAdminDb(), me.uid, body.provider, safeReturn(body.host, body.path)));
  } catch (err) {
    return socialFail(err, "Couldn't start the connection");
  }
}
