import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAdminDb } from "@/lib/firebase-admin";
import { getR2Client, R2_BUCKET } from "@/lib/r2";
import { rateLimit } from "@/lib/rate-limit";
import { finishMomentAudio, startMomentAudio } from "@/lib/moments-server";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// A voice-over for a moment.
// POST { action: "start", size, contentType, durationSec } → { id, key, uploadUrl }
// POST { action: "finish", id }                            → { ok, key }
export async function POST(req: NextRequest) {
  try {
    const me = await authed(req, "moments", true);
    const limited = rateLimit(req, "moment-audio", me.uid, 20, 600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    const r2 = getR2Client();
    if (body.action === "start") {
      const out = await startMomentAudio(
        db, me.uid, { size: Number(body.size), contentType: String(body.contentType || ""), durationSec: Number(body.durationSec) },
        (key, contentType, size) => getSignedUrl(r2, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType, ContentLength: size }), { expiresIn: 300 })
      );
      return NextResponse.json(out);
    }
    if (body.action === "finish") {
      const out = await finishMomentAudio(db, me.uid, String(body.id || ""), {
        head: async (key) => {
          try { return { size: Number((await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))).ContentLength || 0) }; } catch { return null; }
        },
        readStart: async (key) => (await (await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: "bytes=0-31" }))).Body?.transformToByteArray()) ?? new Uint8Array(),
        remove: async (key) => { await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })); },
      });
      return NextResponse.json({ ok: true, ...out });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't process the recording");
  }
}
