import { reportError } from "./monitoring";
import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getAdminDb, verifySignedInRequest } from "./firebase-admin";
import { R2_BUCKET, getR2Client, r2PublicUrl } from "./r2";
import {
  copyWithWatermark, createPublicDirectUpload, createWatermarkProfile, deleteDownloads, deleteVideo, deleteWatermarkProfile, downloadToken, enableDownloads, getDownloads,
  getVideo, StreamError, streamConfigured,
} from "./stream";
import { markPicture, renderVideoMark } from "./media-watermark";
import { MediaError, type MediaDeps } from "./media-server";
import { MEDIA_LIVE } from "./media-rules";
import { effectiveTier, type AccountTier } from "./users";
import { friendlyMessage } from "./api-errors";
import { setting } from "@/lib/config";

// Shared by the /api/media routes (and the other marked uploads, the re-marking job and replays): the real bucket and Cloudflare Stream,
// who is calling, and our errors as responses.
async function bodyBytes(key: string, range?: string): Promise<Buffer> {
  const r = await getR2Client().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, ...(range ? { Range: range } : {}) }));
  return Buffer.from(await r.Body!.transformToByteArray());
}
export function mediaDeps(): MediaDeps {
  return {
    publicUrl: r2PublicUrl,
    head: async (key) => {
      try {
        const h = await getR2Client().send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        return { size: Number(h.ContentLength ?? 0) };
      } catch { return null; }
    },
    readStart: (key) => bodyBytes(key, "bytes=0-31"),
    read: (key) => bodyBytes(key),
    // A marked picture: cached for a year (its key is new, and never changes).
    write: async (key, bytes, type, cacheControl = "public, max-age=31536000, immutable") => { await getR2Client().send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: bytes, ContentType: type, CacheControl: cacheControl })); },
    // Unlike the account-deletion helper, a failed delete is reported: the marking steps keep the clean key until it is really gone.
    remove: async (key) => { await getR2Client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })); },
    markPicture: (bytes, username, s, o) => markPicture(bytes, username, s, o),
    mediaBase: setting("NEXT_PUBLIC_R2_PUBLIC_URL") ?? "",
    stream: {
      configured: streamConfigured(),
      create: createPublicDirectUpload,
      get: async (uid) => {
        const v = await getVideo(uid);
        return v ? { readyToStream: v.readyToStream, duration: v.duration, size: v.size, state: v.status?.state, width: v.input?.width, height: v.input?.height } : null;
      },
      remove: deleteVideo,
      downloads: { enable: enableDownloads, status: getDownloads, disable: deleteDownloads },
      copy: copyWithWatermark,
      token: downloadToken,
      watermark: createWatermarkProfile,
      dropWatermark: deleteWatermarkProfile,
      markPng: renderVideoMark,
    },
  };
}
export type MediaCaller = { uid: string; username: string; tier: AccountTier };

// A signed-in, non-suspended member; posting also needs a verified email (docs/MEDIA.md, "Who can post").
export async function mediaCaller(req: NextRequest, write = false): Promise<MediaCaller> {
  if (!MEDIA_LIVE) throw new MediaError(404, "Not found.");
  const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  if (write && !me.emailVerified) throw new MediaError(403, "Verify your email first: open the link we sent to your inbox (check spam), or tap Resend link in the yellow bar at the top of the page.");
  const u = (await getAdminDb().doc(`users/${me.uid}`).get()).data();
  if (!u || u.suspended === true) throw new MediaError(403, "Your account can't do that right now.");
  return { uid: me.uid, username: String(u.username ?? ""), tier: effectiveTier({ username: String(u.username ?? ""), role: u.role ?? "reader", accountTier: u.accountTier ?? "standard" }) };
}

// Whoever is looking, if signed in (Media pages are public; teen and followers-only posts need to know who it is).
export async function mediaViewer(req: NextRequest): Promise<{ uid: string; username: string } | null> {
  if (!MEDIA_LIVE) throw new MediaError(404, "Not found.");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const me = await verifySignedInRequest(token);
    const u = (await getAdminDb().doc(`users/${me.uid}`).get()).data();
    return { uid: me.uid, username: String(u?.username ?? "") };
  } catch { return null; }
}

export function mediaFail(err: unknown, fallback: string): NextResponse {
  if (err instanceof MediaError) return NextResponse.json({ error: err.message }, { status: err.status });
  // Cloudflare Stream refused: say so plainly (pictures still work) and log it for /admin/errors, which alerts the team.
  if (err instanceof StreamError) {
    void reportError(err, { source: "server", route: fallback });
    const msg = err.storageFull
      ? "Videos can't be uploaded right now: our video storage is full. We've been alerted. You haven't been charged, and pictures still work."
      : "Our video service didn't accept the upload. Please try again in a few minutes. You haven't been charged.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
  if (err instanceof Error && /Missing auth token|verifyIdToken|ID token/i.test(err.message)) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
