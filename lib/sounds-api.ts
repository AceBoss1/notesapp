import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAdminDb, verifySignedInRequest } from "./firebase-admin";
import { getR2Client, R2_BUCKET, r2PublicUrl } from "./r2";
import { friendlyMessage } from "./api-errors";
import { SoundError, type SoundDeps } from "./sounds-server";

// The routes' side of NotesApp Sounds (lib/sounds-server.ts): our bucket, who's asking, and errors as responses.
export function soundDeps(): SoundDeps {
  const r2 = getR2Client();
  return {
    publicUrl: r2PublicUrl,
    presign: (key, contentType, size) => getSignedUrl(r2, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType, ContentLength: size }), { expiresIn: 900 }),
    head: async (key) => { try { return { size: Number((await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))).ContentLength || 0) }; } catch { return null; } },
    readStart: async (key) => (await (await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: "bytes=0-31" }))).Body?.transformToByteArray()) ?? new Uint8Array(),
    remove: async (key) => { await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })); },
  };
}
export const publicOnly = { publicUrl: r2PublicUrl };

export type SoundCaller = { uid: string; username: string; emailVerified: boolean };
// Signed in (or null when no token / a bad one).
export async function soundViewer(req: NextRequest): Promise<SoundCaller | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const me = await verifySignedInRequest(token);
    const u = (await getAdminDb().doc(`users/${me.uid}`).get()).data();
    if (!u || u.suspended === true) return null;
    return { uid: me.uid, username: String(u.username ?? ""), emailVerified: !!me.emailVerified };
  } catch { return null; }
}
export async function soundCaller(req: NextRequest, write = false): Promise<SoundCaller> {
  const me = await soundViewer(req);
  if (!me) throw new SoundError(401, "Sign in first.");
  if (write && !me.emailVerified) throw new SoundError(403, "Verify your email first: open the link we sent to your inbox.");
  return me;
}
export function soundFail(err: unknown, fallback: string): NextResponse {
  if (err instanceof SoundError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
