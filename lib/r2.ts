import { S3Client } from "@aws-sdk/client-s3";

// R2 is S3-compatible, so the AWS SDK works against it unchanged —
// just point the endpoint at the Cloudflare account URL instead of
// AWS. Server-only: R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY must never
// reach the browser, which is why this is only ever imported from
// app/api/upload/route.ts, never from a "use client" file.
export function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY. See README."
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export const R2_BUCKET = process.env.R2_BUCKET_NAME || "notesapp-media";

// The public-facing URL prefix for a bucket key — either a custom
// domain mapped to the bucket (recommended: media.notesapp.name.ng)
// or Cloudflare's own pub-<hash>.r2.dev URL. Public on purpose — this
// one IS meant to reach the browser, since it's just how images/videos
// get displayed.
export function r2PublicUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_R2_PUBLIC_URL is not set. See README.");
  }
  return `${base.replace(/\/$/, "")}/${key}`;
}
