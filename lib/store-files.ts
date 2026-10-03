import { User } from "firebase/auth";

// Browser side of attaching a file to a digital item: get a signed URL, PUT the bytes straight to
// the private bucket, then tell the server to confirm and record it (see /api/store/file-upload
// and /api/store/files).
export async function attachDigitalFile(user: User, itemId: string, file: File, onProgress?: (msg: string) => void): Promise<{ fileName: string; fileSize: number }> {
  const auth = { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` };
  onProgress?.("Preparing upload…");
  const prep = await fetch("/api/store/file-upload", { method: "POST", headers: auth, body: JSON.stringify({ itemId, filename: file.name, contentType: file.type || "application/octet-stream", size: file.size }) });
  const pj = await prep.json();
  if (!prep.ok) throw new Error(pj.error || "Couldn't start the upload.");
  onProgress?.("Uploading the file…");
  const put = await fetch(pj.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  if (!put.ok) throw new Error("The upload failed. Check your connection and try again.");
  onProgress?.("Finishing…");
  const done = await fetch("/api/store/files", { method: "POST", headers: auth, body: JSON.stringify({ itemId, key: pj.key, filename: file.name, size: file.size }) });
  const dj = await done.json();
  if (!done.ok) throw new Error(dj.error || "Couldn't save the file.");
  return { fileName: dj.fileName, fileSize: dj.fileSize };
}

export const fmtSize = (bytes?: number) => (!bytes ? "" : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
