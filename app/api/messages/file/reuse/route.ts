import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { authed, fail, momentDeps } from "@/lib/moments-api";
import { reuseOwnMedia } from "@/lib/chat-media-server";
import { copyToPublic, privateFilesConfigured } from "@/lib/private-files";
import { MessageError } from "@/lib/messages-server";
import { r2PublicUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

// POST { cid, mid, i, to: "moment" | "avatar", durationSec? } → { moment } or { url }: one of your own chat photos or videos as a
// moment, or a photo as your profile picture (the browser then saves it to your profile, as Edit profile does). See lib/chat-media-server.ts.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const me = await authed(req, body.to === "moment" ? "moments" : "messages", true);
    const limited = await rateLimit(req, "chat-media-reuse", me.uid, 20, 600);
    if (limited) return limited;
    if (!privateFilesConfigured()) throw new MessageError(503, "Files aren't available right now.");
    return NextResponse.json(await reuseOwnMedia(getAdminDb(), me, body, { copy: copyToPublic, publicUrl: r2PublicUrl, moments: momentDeps }));
  } catch (err) {
    return fail(err, "Couldn't use that file");
  }
}
