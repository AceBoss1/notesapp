import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { SocialError, disconnect, isProvider } from "@/lib/social-server";
import { socialAuthed, socialFail } from "@/lib/social-api";

export const dynamic = "force-dynamic";

// POST { provider } → forgets the connection (the stored tokens are deleted; revoke the app on the network itself to be thorough).
export async function POST(req: NextRequest) {
  try {
    const me = await socialAuthed(req);
    const body = await req.json().catch(() => ({}));
    if (!isProvider(body.provider)) throw new SocialError(400, "Choose LinkedIn or X.");
    await disconnect(getAdminDb(), me.uid, body.provider);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return socialFail(err, "Couldn't disconnect");
  }
}
