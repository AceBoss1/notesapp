import { setting } from "@/lib/config";
// Server-only. Cloudflare Stream, used for the video lessons of view-only items and courses. Every video is uploaded with
// requireSignedURLs, so it can only be played with a short-lived token that /api/store/view/lesson hands to a buyer, and
// MP4 downloads are never enabled for them (only for Media videos whose creator allows downloads, below). Set CLOUDFLARE_STREAM_TOKEN (an API token with Stream:Edit); the account id is the same
// Cloudflare account as R2 (R2_ACCOUNT_ID) unless CLOUDFLARE_ACCOUNT_ID is set.
const accountId = () => setting("CLOUDFLARE_ACCOUNT_ID") || setting("R2_ACCOUNT_ID") || "";
export const streamConfigured = () => !!setting("CLOUDFLARE_STREAM_TOKEN") && !!accountId();
export { STREAM_MAX_BYTES } from "./stream-config";
export const STREAM_MAX_SECONDS = 4 * 3600;

// Cloudflare Stream refused a request. Kept apart from other errors so its message (e.g. "storage capacity" or a quota) is never
// mistaken for Firestore running out of its daily quota (lib/api-errors.ts), and so callers can say what really happened.
export class StreamError extends Error {
  constructor(readonly status: number, readonly code: number | undefined, detail: string) { super(`Cloudflare Stream: ${detail}`); this.name = "StreamError"; }
  // Stream's account storage is used up (or Stream isn't subscribed): uploads can't start until the owner adds capacity.
  get storageFull(): boolean { return /storage|capacity|quota|exceed|limit/i.test(this.message) || this.status === 402 || this.status === 413; }
}

async function cf<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId()}/stream${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${setting("CLOUDFLARE_STREAM_TOKEN")}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.success === false) throw new StreamError(res.status, j.errors?.[0]?.code, j.errors?.[0]?.message || `request failed (${res.status})`);
  return j.result as T;
}

// A one-time URL the seller's browser posts the video file to.
export function createDirectUpload(sellerUid: string, name: string) {
  return cf<{ uploadURL: string; uid: string }>("/direct_upload", {
    method: "POST",
    body: JSON.stringify({ maxDurationSeconds: STREAM_MAX_SECONDS, requireSignedURLs: true, creator: sellerUid, meta: { name } }),
  });
}

// Media videos (lib/media-server.ts): public playback, because Media posts are public (their audience is checked by our own API before a
// post is listed). Stream refuses an upload longer than the plan's longest Media video. `meta.purpose` tells them apart in /admin/stream.
// `watermarkUid`: the creator's watermark profile (lib/media-mark-server.ts), burned into the video as it arrives, so the only copy Stream
// keeps is the marked one (owner, 5 Nov 2026).
export function createPublicDirectUpload(creatorUid: string, maxSeconds: number, name: string, watermarkUid?: string) {
  return cf<{ uploadURL: string; uid: string }>("/direct_upload", {
    method: "POST",
    body: JSON.stringify({
      maxDurationSeconds: Math.max(1, Math.min(STREAM_MAX_SECONDS, Math.round(maxSeconds) + 1)), requireSignedURLs: false, creator: creatorUid, meta: { name, purpose: "media" },
      ...(watermarkUid ? { watermark: { uid: watermarkUid } } : {}),
    }),
  });
}

// ── The NotesApp mark and downloads of Media videos (lib/media-mark.ts) ──
// MP4 downloads of one video: switched on, read, switched off. Stream answers { default: { status, url, percentComplete } }.
export type StreamDownload = { status: "inprogress" | "ready" | "error"; url: string };
const dlOf = (r: { default?: { status?: string; url?: string } } | null | undefined): StreamDownload | null =>
  r?.default ? { status: r.default.status === "ready" ? "ready" : r.default.status === "error" ? "error" : "inprogress", url: String(r.default.url ?? "") } : null;
export async function enableDownloads(uid: string): Promise<StreamDownload> {
  const d = dlOf(await cf<{ default?: { status?: string; url?: string } }>(`/${encodeURIComponent(uid)}/downloads`, { method: "POST" }));
  if (!d) throw new Error("Cloudflare Stream didn't start the download file.");
  return d;
}
export async function getDownloads(uid: string): Promise<StreamDownload | null> {
  try { return dlOf(await cf<{ default?: { status?: string; url?: string } }>(`/${encodeURIComponent(uid)}/downloads`)); } catch { return null; }
}
export async function deleteDownloads(uid: string): Promise<void> {
  await cf(`/${encodeURIComponent(uid)}/downloads`, { method: "DELETE" }).catch(() => {});
}
// A copy of a video from a link, with a watermark profile burned in (the re-marking of videos posted before the mark, lib/media-mark-backfill.ts).
// `signed`: the copy plays only with a token, as the video it replaces did (replays); Media videos play publicly.
export function copyWithWatermark(o: { url: string; watermarkUid: string; creatorUid: string; name: string; signed: boolean; purpose: string }) {
  return cf<{ uid: string }>("/copy", {
    method: "POST",
    body: JSON.stringify({ url: o.url, watermark: { uid: o.watermarkUid }, creator: o.creatorUid, requireSignedURLs: o.signed, meta: { name: o.name, purpose: o.purpose } }),
  });
}
// A watermark profile from a PNG (transparent background), with how see-through it is, its size, padding and corner.
export async function createWatermarkProfile(o: { png: Buffer; name: string; opacity: number; padding: number; scale: number; position: string }): Promise<{ uid: string }> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(o.png)], { type: "image/png" }), "mark.png");
  form.append("name", o.name);
  form.append("opacity", String(o.opacity));
  form.append("padding", String(o.padding));
  form.append("scale", String(o.scale));
  form.append("position", o.position);
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId()}/stream/watermarks`, {
    method: "POST", headers: { Authorization: `Bearer ${setting("CLOUDFLARE_STREAM_TOKEN")}` }, body: form,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.success === false) throw new Error(j.errors?.[0]?.message || `Cloudflare Stream watermark failed (${res.status})`);
  return { uid: String(j.result?.uid ?? "") };
}
export async function deleteWatermarkProfile(uid: string): Promise<void> {
  await cf(`/watermarks/${encodeURIComponent(uid)}`, { method: "DELETE" }).catch(() => {});
}
// A token that lets its holder download the video for `seconds` (the copy's MP4 address carries it in place of the video id).
export async function downloadToken(uid: string, seconds = 3600): Promise<string> {
  const r = await cf<{ token: string }>(`/${encodeURIComponent(uid)}/token`, {
    method: "POST",
    body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds, downloadable: true }),
  });
  return r.token;
}
// A video made from a file Cloudflare fetches itself (a replay copied from the private bucket through a short-lived signed link), with
// the same signed-playback rule as every other video here. `watermarkUid`: the host's watermark profile (a video replay carries the mark).
export function copyFromUrl(url: string, creator: string, name: string, watermarkUid?: string) {
  return cf<{ uid: string }>("/copy", {
    method: "POST",
    body: JSON.stringify({ url, requireSignedURLs: true, creator, meta: { name }, ...(watermarkUid ? { watermark: { uid: watermarkUid } } : {}) }),
  });
}

export type StreamVideo = { uid: string; readyToStream: boolean; duration?: number; size?: number; status?: { state?: string }; input?: { width?: number; height?: number }; requireSignedURLs?: boolean };
export async function getVideo(uid: string): Promise<StreamVideo | null> {
  try {
    return await cf<StreamVideo>(`/${encodeURIComponent(uid)}`);
  } catch {
    return null;
  }
}

export async function deleteVideo(uid: string): Promise<void> {
  await cf(`/${encodeURIComponent(uid)}`, { method: "DELETE" }).catch(() => {});
}

// A playback token good for `seconds`; the player URL carries it in place of the video id.
export async function playbackToken(uid: string, seconds = 4 * 3600): Promise<string> {
  const r = await cf<{ token: string }>(`/${encodeURIComponent(uid)}/token`, {
    method: "POST",
    body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds, downloadable: false }),
  });
  return r.token;
}
export const playerUrl = (token: string) => `https://iframe.videodelivery.net/${token}`;

// For /status: does the Stream API answer for our token? Asks for the account's storage usage (one small object, however many
// videos there are). On failure the reason goes to the server log so a bad token, wrong account id or missing Stream
// subscription can be told apart.
export async function pingStream(): Promise<boolean> {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId()}/stream/storage-usage`, {
      headers: { Authorization: `Bearer ${setting("CLOUDFLARE_STREAM_TOKEN")}` },
      cache: "no-store",
    });
    if (res.ok) return true;
    const j = await res.json().catch(() => ({}));
    console.warn("[status] Cloudflare Stream storage-usage failed:", res.status, j?.errors?.[0]?.code, j?.errors?.[0]?.message);
    // Some tokens can list videos but not read usage: any successful Stream call proves the service answers.
    const list = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId()}/stream`, { headers: { Authorization: `Bearer ${setting("CLOUDFLARE_STREAM_TOKEN")}` }, cache: "no-store" });
    if (!list.ok) console.warn("[status] Cloudflare Stream list failed:", list.status);
    return list.ok;
  } catch (e) {
    console.warn("[status] Cloudflare Stream check failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

// ---- Admin diagnostics and clean-up ----
export type StreamVideoRow = { uid: string; created?: string; creator?: string; duration?: number; size?: number; name?: string };

// What Cloudflare says to a storage-usage request, in full, for the admin "Test connection" button.
export async function streamDiagnostics() {
  const acct = accountId();
  const out = { tokenSet: !!setting("CLOUDFLARE_STREAM_TOKEN"), accountIdEnding: acct ? `…${acct.slice(-4)}` : "", ok: false, status: 0, code: "", message: "" };
  if (!out.tokenSet || !acct) {
    out.message = !out.tokenSet ? "CLOUDFLARE_STREAM_TOKEN isn't set on the server." : "No Cloudflare account id (R2_ACCOUNT_ID / CLOUDFLARE_ACCOUNT_ID) is set.";
    return out;
  }
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/stream/storage-usage`, { headers: { Authorization: `Bearer ${setting("CLOUDFLARE_STREAM_TOKEN")}` }, cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    out.status = res.status;
    out.ok = res.ok;
    out.code = String(j?.errors?.[0]?.code ?? "");
    out.message = res.ok ? `Connected. ${j?.result?.videoCount ?? "?"} video(s), ${j?.result?.totalStorageMinutes ?? "?"} minutes stored.` : String(j?.errors?.[0]?.message ?? "Cloudflare refused the request.");
  } catch (e) {
    out.message = e instanceof Error ? e.message : "The request failed.";
  }
  return out;
}

// Every video in the account (Stream returns them newest first; an account this size fits in one response).
export async function listVideos(): Promise<StreamVideoRow[]> {
  const rows = await cf<{ uid: string; created?: string; creator?: string; duration?: number; size?: number; meta?: { name?: string } }[]>("");
  return rows.map((v) => ({ uid: v.uid, created: v.created, creator: v.creator, duration: v.duration, size: v.size, name: v.meta?.name }));
}
