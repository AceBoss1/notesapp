import { auth } from "./firebase";
import { uploadToR2 } from "./upload";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_TYPES, fmtBytes, type PostVideo } from "./video-rules";

// Browser side of post videos: check the file against the rules before sending anything, ask /api/video for a signed
// upload (with progress), have the server verify what arrived, and make a poster frame. Nothing is transcoded.
export type VideoMeta = { duration: number; width: number; height: number };

export function readVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = () => URL.revokeObjectURL(url);
    v.onloadedmetadata = () => {
      const meta = { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
      done();
      Number.isFinite(meta.duration) && meta.duration > 0 ? resolve(meta) : reject(new Error("We couldn't read that video's length."));
    };
    v.onerror = () => {
      done();
      reject(new Error("This browser can't play that file. Export it as an MP4 (H.264) or WebM and try again."));
    };
    v.src = url;
  });
}

// A JPEG still from near the start, uploaded like any other image. Best effort: no poster is fine.
async function makePoster(file: File, duration: number): Promise<string> {
  try {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.playsInline = true;
    v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res();
      v.onerror = () => rej(new Error("poster"));
    });
    v.currentTime = Math.min(1, duration / 2);
    await new Promise<void>((res) => (v.onseeked = () => res()));
    const scale = Math.min(1, 960 / (v.videoWidth || 960));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((v.videoWidth || 960) * scale);
    canvas.height = Math.round((v.videoHeight || 540) * scale);
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.8));
    if (!blob) return "";
    return await uploadToR2(new File([blob], "poster.jpg", { type: "image/jpeg" }), "journal");
  } catch {
    return "";
  }
}

function put(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The upload to storage failed. Try again.")));
    xhr.onerror = () => reject(new Error("The connection dropped during upload. Try again."));
    xhr.send(file);
  });
}

async function api(body: Record<string, unknown>) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to upload a video.");
  const res = await fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong with the video upload.");
  return data;
}

export type UploadedVideo = PostVideo & { url: string };

export async function uploadVideo(file: File, onStage: (stage: "checking" | "uploading" | "verifying" | "poster", pct?: number) => void): Promise<UploadedVideo> {
  if (!VIDEO_TYPES[file.type]) throw new Error("Use an MP4 (H.264) or WebM video.");
  if (file.size > VIDEO_MAX_BYTES) throw new Error(`That video is ${fmtBytes(file.size)} — the limit is ${fmtBytes(VIDEO_MAX_BYTES)}.`);
  onStage("checking");
  const meta = await readVideoMeta(file);
  if (meta.duration > VIDEO_MAX_SECONDS + 1) throw new Error(`That video is ${Math.ceil(meta.duration / 60)} minutes long — the limit is ${VIDEO_MAX_SECONDS / 60}.`);

  const start = await api({ action: "start", size: file.size, contentType: file.type, durationSec: meta.duration });
  onStage("uploading", 0);
  await put(start.uploadUrl, file, (pct) => onStage("uploading", pct));
  onStage("verifying");
  const done = await api({ action: "finish", id: start.id });
  onStage("poster");
  const poster = await makePoster(file, meta.duration);
  return { videoId: start.id, videoKey: done.key, videoDuration: Math.round(meta.duration), videoSize: file.size, ...(poster ? { videoPoster: poster } : {}), url: done.publicUrl };
}
