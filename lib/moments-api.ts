import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "./firebase-admin";
import { r2PublicUrl, deleteMediaObject } from "./r2";
import { MomentError, streamUidOf, type MomentDeps } from "./moments-server";
import { copyWithWatermark, createSignedDirectUpload, createWatermarkProfile, deleteVideo, deleteWatermarkProfile, getVideo, playbackToken, streamConfigured } from "./stream";
import { renderVideoMark } from "./media-watermark";
import { MessageError } from "./messages-server";
import { MESSAGES_LIVE, MOMENTS_LIVE } from "./moments-rules";
import { friendlyMessage } from "./api-errors";

// Shared by the Moments and Messages routes: checks the feature is switched on, the caller is signed in with a verified
// email and not suspended, and turns our own errors into responses.
// The files: the media bucket, and Cloudflare Stream for moment videos ("stream:<uid>" keys, lib/moments-server.ts). A moment's picture is
// given the NotesApp mark (lib/media-watermark.tsx) under a new key and the clean upload deleted.
export const momentDeps: MomentDeps = {
  publicUrl: r2PublicUrl,
  remove: async (key) => {
    const uid = streamUidOf(key);
    if (!uid) return deleteMediaObject(key);
    if (streamConfigured()) await deleteVideo(uid);
  },
  markImage: async (key, username) => {
    const [{ mediaDeps }, { getWatermarkSettings }, { markedKey }] = await Promise.all([import("./media-api"), import("./media-mark-server"), import("./media-server")]);
    const d = mediaDeps();
    const out = await d.markPicture(await d.read(key), username, await getWatermarkSettings(getAdminDb()));
    const to = markedKey(key, out.ext);
    await d.write(to, out.bytes, out.type);
    await d.remove(key);
    return to;
  },
  get stream() {
    return {
      configured: streamConfigured(),
      create: createSignedDirectUpload,
      copy: copyWithWatermark,
      get: async (uid: string) => { const v = await getVideo(uid); return v ? { readyToStream: v.readyToStream, state: v.status?.state } : null; },
      token: (uid: string, seconds: number) => playbackToken(uid, seconds),
      watermark: createWatermarkProfile, dropWatermark: deleteWatermarkProfile, markPng: renderVideoMark,
    };
  },
};

export type Caller = { uid: string; username: string };

export async function authed(req: NextRequest, feature: "moments" | "messages", write = false): Promise<Caller> {
  if (!(feature === "moments" ? MOMENTS_LIVE : MESSAGES_LIVE)) throw new MomentError(404, "Not found.");
  const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  if (write && !me.emailVerified) throw new MomentError(403, "Verify your email first: open the link we sent to your inbox (check spam), or tap Resend link in the yellow bar at the top of the page.");
  const user = (await getAdminDb().doc(`users/${me.uid}`).get()).data();
  if (!user || user.suspended === true) throw new MomentError(403, "Your account can't do that right now.");
  return { uid: me.uid, username: String(user.username ?? "") };
}

export function fail(err: unknown, fallback: string): NextResponse {
  if (err instanceof MomentError || err instanceof MessageError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof Error && /Missing auth token|verifyIdToken|ID token/i.test(err.message)) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
