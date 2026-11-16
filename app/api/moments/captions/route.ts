import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { captionPiece, captionsOn } from "@/lib/moments-captions-server";
import { CAPTION_CHUNK_MAX_BYTES, MOMENT_TIDY_LIVE } from "@/lib/moments-tidy";
import { MomentError } from "@/lib/moments-server";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Captions for moments (lib/moments-captions-server.ts).
//   GET                          → { tidy, captions }: whether trimming and captions are switched on
//   POST ?lang=en|pcm (audio/wav) → { words: [{ w, s, e, u? }] }: one piece of sound (up to 45 seconds), written down. The sound isn't kept.
export async function GET(req: NextRequest) {
  try {
    await authed(req, "moments");
    return NextResponse.json({ tidy: MOMENT_TIDY_LIVE, captions: captionsOn() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) { return fail(err, "Couldn't check captions"); }
}

export async function POST(req: NextRequest) {
  try {
    const me = await authed(req, "moments", true);
    const limited = await rateLimit(req, "moment-captions", me.uid, 40, 600);
    if (limited) return limited;
    if (Number(req.headers.get("content-length") ?? 0) > CAPTION_CHUNK_MAX_BYTES) throw new MomentError(413, "That piece of sound is too long.");
    const wav = new Uint8Array(await req.arrayBuffer());
    return NextResponse.json(await captionPiece(getAdminDb(), me.uid, wav, req.nextUrl.searchParams.get("lang")), { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) { return fail(err, "Couldn't write the captions"); }
}
