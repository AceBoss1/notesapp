"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import type { CreatorMedia, Studio } from "./media-server";
import { MEDIA_LIVE } from "./media-rules";

// Calls /api/media as whoever is signed in (or nobody: Media pages are public).
export async function mediaApi<T>(path: string, init: { method?: string; body?: unknown; signedIn?: boolean } = {}): Promise<T> {
  const u = auth.currentUser;
  if (init.signedIn && !u) throw new Error("Sign in first.");
  const res = await fetch(path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", ...(u ? { Authorization: `Bearer ${await u.getIdToken()}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data as T;
}

// A creator's Media, loaded once the sign-in state is known (so followers-only and teen posts can be shown to the right people).
// undefined while loading, null when it can't be shown.
export function useCreatorMedia(username: string | undefined, on = true): { data: CreatorMedia | null | undefined; reload: () => void } {
  const [data, setData] = useState<CreatorMedia | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, () => setReady(true)), []);
  useEffect(() => {
    if (!username || !on || !MEDIA_LIVE || !ready) return;
    let live = true;
    mediaApi<CreatorMedia>(`/api/media/u/${encodeURIComponent(username)}`).then((d) => { if (live) setData(d); }, () => { if (live) setData(null); });
    return () => { live = false; };
  }, [username, on, ready, tick]);
  return { data, reload: () => setTick((t) => t + 1) };
}

export const loadStudio = () => mediaApi<Studio>("/api/media/studio", { signedIn: true });

// A watermarked picture, saved to the device (the server stamps it; the original is never sent).
export async function downloadMediaPicture(postId: string, index: number): Promise<void> {
  const u = auth.currentUser;
  const res = await fetch(`/api/media/posts/${encodeURIComponent(postId)}/download?i=${index}`, { headers: u ? { Authorization: `Bearer ${await u.getIdToken()}` } : {} });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't download it.");
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "notesapp-picture.jpg";
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Sends a video straight to Cloudflare Stream (a form post to the one-time address), reporting progress from 0 to 1.
export function sendToStream(uploadURL: string, file: File, onProgress: (f: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", uploadURL);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error("The video upload failed. Try again.")));
    x.onerror = () => reject(new Error("The video upload failed. Check your connection and try again."));
    const form = new FormData();
    form.append("file", file);
    x.send(form);
  });
}

// A video file's length in seconds, read by the browser before uploading (the server and Stream check it again).
export function videoLength(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { const d = v.duration; URL.revokeObjectURL(v.src); Number.isFinite(d) ? resolve(d) : reject(new Error("We couldn't read the video's length.")); };
    v.onerror = () => reject(new Error("That video can't be read. Try an MP4."));
    v.src = URL.createObjectURL(file);
  });
}
