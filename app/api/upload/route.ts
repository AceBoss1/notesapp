import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, R2_BUCKET, r2PublicUrl } from "@/lib/r2";
import { verifyAdminRequest } from "@/lib/firebase-admin";

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
    await verifyAdminRequest(idToken);

    const { filename, contentType } = await req.json();
    if (!filename || !contentType) {
      return NextResponse.json({ error: "filename and contentType are required" }, { status: 400 });
    }
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      return NextResponse.json({ error: "Only image/* and video/* uploads are allowed" }, { status: 400 });
    }

    const key = `journals/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 });

    return NextResponse.json({ uploadUrl, publicUrl: r2PublicUrl(key), key });
  } catch (err) {
    console.error("Upload URL generation failed:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
