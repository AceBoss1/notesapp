import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, R2_BUCKET, r2PublicUrl } from "@/lib/r2";
import { getAdminDb, verifyAvatarUploadRequest, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { hasStaffPass } from "@/lib/staff-pass-server";
import { STUDIO_CLIP_MAX, STUDIO_CLIP_TYPES, STUDIO_CLOSED, STUDIO_FOLDER, STUDIO_FOR_EVERYONE } from "@/lib/studio";

export const dynamic = "force-dynamic";

// A clip for Notes Live Studio (lib/studio.ts): an intro, an outro, a video or a sound to play during a live. The browser asks for a
// one-time address and sends the file straight to our storage, into the member's own studio/ folder (like /api/upload does for
// pictures). Only a file from that folder can then be played in a live they edit (lib/rooms-server.ts studioStep).
// POST { filename, contentType, size } → { uploadUrl, publicUrl }
// Who: a signed-in member with a verified email, not suspended; while the team tests the studio, only team accounts on the staff pass.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const me = await verifySignedInRequest(idToken);
    if (!me.emailVerified) return NextResponse.json({ error: "Verify your email first." }, { status: 403 });
    const uid = await verifyAvatarUploadRequest(idToken);
    if (!STUDIO_FOR_EVERYONE && !(await hasStaffPass(getAdminDb(), uid))) return NextResponse.json({ error: STUDIO_CLOSED }, { status: 403 });
    const limited = await rateLimit(req, "studio-upload", uid, 20, 3600);
    if (limited) return limited;
    const { filename, contentType, size } = await req.json().catch(() => ({}));
    const type = STUDIO_CLIP_TYPES[String(contentType ?? "")];
    if (!type) return NextResponse.json({ error: "Use an MP4 or WebM video, or an MP3, M4A, WAV or OGG sound." }, { status: 400 });
    if (!Number.isInteger(size) || size <= 0 || size > STUDIO_CLIP_MAX[type.kind]) {
      return NextResponse.json({ error: `That file is too large (at most ${Math.round(STUDIO_CLIP_MAX[type.kind] / 1048576)} MB for a ${type.kind === "video" ? "video" : "sound"}).` }, { status: 413 });
    }
    const name = String(filename ?? "clip").replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) || "clip";
    const key = `${STUDIO_FOLDER}/${uid}/${Date.now()}-${name}.${type.ext}`;
    // The length is signed into the address: storage refuses a body of any other size.
    const uploadUrl = await getSignedUrl(getR2Client(), new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: String(contentType), ContentLength: size }), { expiresIn: 300 });
    return NextResponse.json({ uploadUrl, publicUrl: r2PublicUrl(key) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const status = /R2 is not configured|NEXT_PUBLIC_R2|FIREBASE_SERVICE_ACCOUNT/.test(message) ? 500 : 401;
    return NextResponse.json({ error: status === 500 ? "Uploads aren't set up right now." : message }, { status });
  }
}
