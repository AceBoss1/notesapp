import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "./r2";

// Server-only. Digital products live in a SEPARATE R2 bucket (R2_PRIVATE_BUCKET) that is never
// exposed through a public domain, so a file can only be reached through a short-lived signed URL
// that /api/store/download hands to someone who has paid. The public media bucket must not be used:
// anything in it is world-readable by URL.
export const privateBucket = () => process.env.R2_PRIVATE_BUCKET || "";
export const privateFilesConfigured = () => !!privateBucket() && !!process.env.R2_ACCOUNT_ID && !!process.env.R2_ACCESS_KEY_ID;

// Plain documents, media and archives — no executables or scripts (the list lives in the client-safe config).
export { DIGITAL_EXTENSIONS, DIGITAL_MAX_BYTES } from "./private-files-config";

export const extOf = (name: string) => (name.split(".").pop() || "").toLowerCase();
export const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(-120) || "file";
export const digitalKey = (itemId: string, filename: string) => `digital/${itemId}/${Date.now()}-${safeFileName(filename)}`;

export function presignUpload(key: string, contentType: string, size: number) {
  return getSignedUrl(getR2Client(), new PutObjectCommand({ Bucket: privateBucket(), Key: key, ContentType: contentType, ContentLength: size }), { expiresIn: 600 });
}

// One minute is plenty to start the download; the browser keeps going after the URL expires.
export function presignDownload(key: string, filename: string) {
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: privateBucket(), Key: key, ResponseContentDisposition: `attachment; filename="${safeFileName(filename)}"` }),
    { expiresIn: 60 }
  );
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  try {
    const r = await getR2Client().send(new HeadObjectCommand({ Bucket: privateBucket(), Key: key }));
    return { size: Number(r.ContentLength || 0) };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: privateBucket(), Key: key })).catch(() => {});
}
