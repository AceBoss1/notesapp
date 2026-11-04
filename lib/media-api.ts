import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getAdminDb, verifySignedInRequest } from "./firebase-admin";
import { R2_BUCKET, deleteMediaObject, getR2Client, r2PublicUrl } from "./r2";
import {
  copyWithWatermark, createPublicDirectUpload, createWatermarkProfile, deleteDownloads, deleteVideo, deleteWatermarkProfile, downloadToken, enableDownloads, getDownloads,
  getVideo, streamConfigured,
} from "./stream";
import { renderVideoMark } from "./media-watermark";
import { MediaError, type MediaDeps } from "./media-server";
import { MEDIA_LIVE } from "./media-rules";
import { effectiveTier, type AccountTier } from "./users";
import { friendlyMessage } from "./api-errors";
import { setting } from "@/lib/config";

// Shared by the /api/media routes: the real bucket and Cloudflare Stream, who is calling, and our errors as responses.
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
    remove: deleteMediaObject,
    mediaBase: setting("NEXT_PUBLIC_R2_PUBLIC_URL") ?? "",
    stream: {
      configured: streamConfigured(),
      create: createPublicDirectUpload,
      get: async (uid) => {
        const v = await getVideo(uid);
        return v ? { readyToStream: v.readyToStream, duration: v.duration, size: v.size, state: v.status?.state } : null;
      },
      remove: deleteVideo,
    },
    // Watermarked video downloads (lib/media-video-dl-server.ts): only with Stream set up.
    ...(streamConfigured() ? {
      videoDl: {
        enable: enableDownloads, status: getDownloads, disable: deleteDownloads, copy: copyWithWatermark,
        get: async (uid: string) => {
          const v = await getVideo(uid);
          return v ? { readyToStream: v.readyToStream, size: v.size, state: v.status?.state } : null;
        },
        remove: deleteVideo, watermark: createWatermarkProfile, dropWatermark: deleteWatermarkProfile, mark: renderVideoMark, token: downloadToken,
      },
    } : {}),
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
  if (err instanceof Error && /Missing auth token|verifyIdToken|ID token/i.test(err.message)) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
