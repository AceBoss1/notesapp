import { auth } from "./firebase";
import { ALLOWED_TYPES, WEBP_QUALITY, fitWithin, looksLikeImage, maxUploadBytes, webpName, webpPlan, type UploadPurpose } from "./upload-rules";

// Replaces lib/cloudinary.ts. Two-step flow: ask app/api/upload for a
// presigned URL (server verifies the caller is an admin), then PUT
// the file straight to R2 from the browser — matches the R2 bucket
// this project now owns independently, not Precheks' shared
// Cloudinary account.
export async function uploadToR2(file: File, purpose: UploadPurpose = "journal"): Promise<string> {
  return (await uploadToR2WithKey(file, purpose)).publicUrl;
}

// Same upload, also returning the storage key (a moment stores the key, not the URL).
export async function uploadToR2WithKey(original: File, purpose: UploadPurpose = "journal"): Promise<{ publicUrl: string; key: string }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to upload a file.");
  }
  const kind = ALLOWED_TYPES[original.type];
  if (!kind) throw new Error("Unsupported file type. Use a JPEG, PNG, WebP, GIF or AVIF image.");
  if (kind === "image" && !(await looksLikeImage(original))) {
    throw new Error("That file isn't a valid image.");
  }
  const file = kind === "image" ? await asWebp(original, purpose) : original;
  if (file.size > maxUploadBytes(kind, purpose !== "journal")) {
    throw new Error(`File is too large (max ${Math.round(maxUploadBytes(kind, purpose !== "journal") / 1048576)} MB).`);
  }
  const idToken = await user.getIdToken();

  const presignRes = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ filename: file.name, contentType: file.type, purpose, size: file.size }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.error || "Couldn't get an upload URL.");
  }

  const { uploadUrl, publicUrl, key } = await presignRes.json();

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error("Upload to storage failed.");
  }

  return { publicUrl: publicUrl as string, key: key as string };
}

// A JPEG or PNG as WebP (lib/upload-rules.ts says which and how big), turned the right way up. Anything that goes wrong keeps the
// original: an upload never fails because of this. Chat photos use it too (components/messages/Thread.tsx).
export async function asWebp(file: File, purpose: UploadPurpose): Promise<File> {
  const plan = webpPlan(file.type, purpose);
  if (!plan || typeof createImageBitmap !== "function") return file;
  try {
    const img = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = fitWithin(img.width, img.height, plan.maxSide);
    const c = document.createElement("canvas");
    c.width = width; c.height = height;
    c.getContext("2d")!.drawImage(img, 0, 0, width, height);
    img.close();
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/webp", WEBP_QUALITY));
    // Older Safari makes a PNG when asked for WebP: keep the original then.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], webpName(file.name), { type: "image/webp" });
  } catch {
    return file;
  }
}
