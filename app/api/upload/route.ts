import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, R2_BUCKET, r2PublicUrl } from "@/lib/r2";
import { verifyPublisherRequest, verifyAvatarUploadRequest, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ALLOWED_TYPES, maxUploadBytes } from "@/lib/upload-rules";

// Presigned-URL pattern, not a proxy upload: the browser asks this
// route for a one-time signed URL, then PUTs the file bytes directly
// to R2 itself — the file never passes through this server. Keeps
// Next.js's own request body size limits and server bandwidth out of
// the picture entirely, which matters once video uploads exist (see
// README's video-upload roadmap note).
//
// Admin-only, same allowlist as firestore.rules' isAdmin() — this
// mirrors NoteForm.tsx being admin-only today. If publishing ever
// opens to staff/volunteer (see README), this check needs to move
// from a hardcoded email allowlist to whatever that migration lands
// on, not just be loosened in place.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.replace(/^Bearer\s+/i, "");
    const { filename, contentType, purpose, size } = await req.json();
    const isAvatar = purpose === "avatar";
    const isAd = purpose === "ad"; // advertiser creative: any verified member, image only, small
    const isMoment = purpose === "moment"; // a moment's picture: same rules as an ad creative, in the member's own folder
    const uid = isAd || isMoment
      ? await (async () => {
          const me = await verifySignedInRequest(idToken);
          if (!me.emailVerified) throw new Error("Verify your email first");
          return verifyAvatarUploadRequest(idToken);
        })()
      : isAvatar
        ? await verifyAvatarUploadRequest(idToken)
        : await verifyPublisherRequest(idToken);
    const limited = rateLimit(req, "upload", uid, 30, 600);
    if (limited) return limited;
    if (!filename || !contentType) {
      return NextResponse.json({ error: "filename and contentType are required" }, { status: 400 });
    }
    const kind = ALLOWED_TYPES[contentType];
    if (!kind) {
      return NextResponse.json({ error: "Unsupported file type. Use JPEG, PNG, WebP, GIF or AVIF images." }, { status: 400 });
    }
    // Post videos have their own route (/api/video: length, weekly quota, verification). This one is images only.
    if (kind !== "image") {
      return NextResponse.json({ error: "Videos are uploaded from the post editor." }, { status: 400 });
    }
    if ((isAvatar || isAd || isMoment) && kind !== "image") {
      return NextResponse.json({ error: "Avatars must be images" }, { status: 400 });
    }
    if (!Number.isInteger(size) || size <= 0 || size > maxUploadBytes(kind, isAvatar || isAd || isMoment)) {
      return NextResponse.json({ error: "File is too large." }, { status: 413 });
    }

    const key = `${isAd ? `ads/${uid}` : isMoment ? `moments/${uid}` : isAvatar ? `avatars/${uid}` : "journals"}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
      // Signed into the URL: R2 rejects a body of any other length.
      ContentLength: size,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 });

    return NextResponse.json({ uploadUrl, publicUrl: r2PublicUrl(key), key });
  } catch (err) {
    console.error("Upload URL generation failed:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    const status = /R2 is not configured|NEXT_PUBLIC_R2|FIREBASE_SERVICE_ACCOUNT/.test(message) ? 500 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
