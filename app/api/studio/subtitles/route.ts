import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { captionPiece, speechReady } from "@/lib/moments-captions-server";
import { CAPTION_CHUNK_MAX_BYTES } from "@/lib/moments-tidy";
import { MomentError } from "@/lib/moments-server";
import type { RoomDoc } from "@/lib/rooms";
import { maySay, studioOf } from "@/lib/studio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Automatic subtitles in Notes Live Studio (docs/STUDIO_SUBTITLES.md): a few seconds of one speaker's own microphone in, the words
// out. Only for someone who is on stage in a live whose editor has subtitles on, and who hasn't turned their own off. The sound isn't
// kept. The speaker's screen then posts the line to the room ({ action: "studio", op: "say" } on /api/community/rooms).
//   GET  ?room=<id>                      → { ready }: whether the speech service is set up
//   POST ?room=<id>&lang=en|pcm (audio/wav) → { text }
const noStore = { headers: { "Cache-Control": "private, no-store" } };
const fail = (err: unknown) => {
  if (err instanceof MomentError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, "Couldn't write the subtitles");
  return NextResponse.json({ error: f.message }, { status: f.status });
};

export async function GET() {
  return NextResponse.json({ ready: speechReady() }, noStore);
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) throw new MomentError(401, "Sign in first.");
    const limited = await rateLimit(req, "studio-subs", me.uid, 400, 600);
    if (limited) return limited;
    if (Number(req.headers.get("content-length") ?? 0) > CAPTION_CHUNK_MAX_BYTES) throw new MomentError(413, "That piece of sound is too long.");
    const db = getAdminDb();
    const r = (await db.doc(`communityRooms/${req.nextUrl.searchParams.get("room") ?? ""}`).get()).data() as RoomDoc | undefined;
    if (!r || r.status !== "live") throw new MomentError(410, "The room has ended.");
    const no = maySay(studioOf(r), [r.hostUid, ...r.speakers], r.micMuted, me.uid);
    if (no) throw new MomentError(403, no);
    const wav = new Uint8Array(await req.arrayBuffer());
    const { words } = await captionPiece(db, me.uid, wav, req.nextUrl.searchParams.get("lang"), undefined, undefined, speechReady(), "live");
    return NextResponse.json({ text: words.map((w) => w.w).join(" ") }, noStore);
  } catch (err) { return fail(err); }
}
