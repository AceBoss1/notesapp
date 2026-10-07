import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAdminDb, verifyPublisherRequest } from "@/lib/firebase-admin";
import { getR2Client, R2_BUCKET, r2PublicUrl } from "@/lib/r2";
import { rateLimit } from "@/lib/rate-limit";
import { friendlyMessage } from "@/lib/api-errors";
import { effectiveTier } from "@/lib/users";
import { VideoError, finishVideoUpload, startVideoUpload } from "@/lib/video-server";
import { MomentError, startMomentVideo } from "@/lib/moments-server";
import { MOMENTS_LIVE } from "@/lib/moments-rules";
import { verifyAvatarUploadRequest, verifySignedInRequest } from "@/lib/firebase-admin";

async function momentUploader(token: string | undefined): Promise<string> {
  const me = await verifySignedInRequest(token);
  if (!me.emailVerified) throw new Error("Verify your email first");
  return verifyAvatarUploadRequest(token);
}

export const dynamic = "force-dynamic";

// POST { action: "start", size, contentType, durationSec }  → { id, key, uploadUrl, publicUrl }
// POST { action: "finish", id }                             → { ok, key, publicUrl }
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const body = await req.json().catch(() => ({}));
    // A moment's video: any verified, non-suspended member (see lib/moments-server.ts); post videos stay publisher-only.
    const isMoment = body.purpose === "moment";
    if (isMoment && !MOMENTS_LIVE) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const uid = isMoment ? await momentUploader(token) : await verifyPublisherRequest(token);
    const limited = rateLimit(req, "video", uid, 20, 600);
    if (limited) return limited;
    const db = getAdminDb();
    const r2 = getR2Client();

    if (body.action === "start" && isMoment) {
      const mu = (await db.doc(`users/${uid}`).get()).data();
      const out = await startMomentVideo(
        db, uid, effectiveTier({ username: mu?.username ?? "", role: mu?.role ?? "reader", accountTier: mu?.accountTier ?? "standard" }),
        { size: Number(body.size), contentType: String(body.contentType || ""), durationSec: Number(body.durationSec) },
        (key, contentType, size) => getSignedUrl(r2, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType, ContentLength: size }), { expiresIn: 900 })
      );
      return NextResponse.json({ ...out, publicUrl: r2PublicUrl(out.key) });
    }

    if (body.action === "start") {
      const user = (await db.doc(`users/${uid}`).get()).data();
      const tier = effectiveTier({ username: user?.username ?? "", role: user?.role ?? "reader", accountTier: user?.accountTier ?? "standard" });
      const out = await startVideoUpload(
        db, uid, tier,
        { size: Number(body.size), contentType: String(body.contentType || ""), durationSec: Number(body.durationSec) },
        // Long window: a 100 MB upload on a slow mobile connection can take a while to begin. The body length is signed in.
        (key, contentType, size) => getSignedUrl(r2, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType, ContentLength: size }), { expiresIn: 900 })
      );
      return NextResponse.json({ ...out, publicUrl: r2PublicUrl(out.key) });
    }

    if (body.action === "finish") {
      const out = await finishVideoUpload(db, uid, String(body.id || ""), {
        head: async (key) => {
          try {
            const r = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
            return { size: Number(r.ContentLength || 0) };
          } catch {
            return null;
          }
        },
        readStart: async (key) => {
          const r = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: "bytes=0-31" }));
          return (await r.Body?.transformToByteArray()) ?? new Uint8Array();
        },
        remove: async (key) => {
          await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        },
      });
      return NextResponse.json({ ok: true, key: out.key, publicUrl: r2PublicUrl(out.key) });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    if (err instanceof VideoError || err instanceof MomentError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't process the video");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
