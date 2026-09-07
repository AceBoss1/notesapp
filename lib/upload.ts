import { auth } from "./firebase";

// Replaces lib/cloudinary.ts. Two-step flow: ask app/api/upload for a
// presigned URL (server verifies the caller is an admin), then PUT
// the file straight to R2 from the browser — matches the R2 bucket
// this project now owns independently, not Precheks' shared
// Cloudinary account.
export async function uploadToR2(file: File): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to upload a file.");
  }
  const idToken = await user.getIdToken();

  const presignRes = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.error || "Couldn't get an upload URL.");
  }

  const { uploadUrl, publicUrl } = await presignRes.json();

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error("Upload to storage failed.");
  }

  return publicUrl as string;
}
