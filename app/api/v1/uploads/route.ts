import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fail, v1 } from "@/lib/api-v1";
import { getR2Client, R2_BUCKET, r2PublicUrl } from "@/lib/r2";
import { apiUploadKey, checkApiUpload } from "@/lib/upload-rules";

export const dynamic = "force-dynamic";

const EXPIRES_IN = 300;

// A one-time presigned URL for uploading an image to the account's media
// folder on R2 — for partners whose posts need images (featured image,
// pictures in the Markdown). Same rules as the editor's /api/upload:
// images only, 10 MB max. The caller PUTs the bytes to `upload_url` with
// the same Content-Type (and length) it declared, then uses `public_url`.
// Open to every account the v1() check lets in (API access on, Enterprise plan).
export const POST = v1("write:posts", async (req, { uid }) => {
  const checked = checkApiUpload(await req.json().catch(() => null));
  if (!checked.ok) throw fail(400, "invalid_request", checked.message);
  const { filename, contentType, size } = checked.req;

  const key = apiUploadKey(uid, filename, Date.now());
  const upload_url = await getSignedUrl(
    getR2Client(),
    // ContentLength is signed into the URL: R2 rejects a body of any other length.
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: EXPIRES_IN }
  );
  return NextResponse.json(
    { upload_url, public_url: r2PublicUrl(key), key, method: "PUT", headers: { "Content-Type": contentType }, expires_in: EXPIRES_IN },
    { status: 201 }
  );
});
