// Server-only. Cloudflare Stream, used for the video lessons of view-only items and courses. Every video is uploaded with
// requireSignedURLs, so it can only be played with a short-lived token that /api/store/view/lesson hands to a buyer, and
// MP4 downloads are never enabled. Set CLOUDFLARE_STREAM_TOKEN (an API token with Stream:Edit); the account id is the same
// Cloudflare account as R2 (R2_ACCOUNT_ID) unless CLOUDFLARE_ACCOUNT_ID is set.
const accountId = () => process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || "";
export const streamConfigured = () => !!process.env.CLOUDFLARE_STREAM_TOKEN && !!accountId();
export { STREAM_MAX_BYTES } from "./stream-config";
export const STREAM_MAX_SECONDS = 4 * 3600;

async function cf<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId()}/stream${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_TOKEN}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.success === false) throw new Error(j.errors?.[0]?.message || `Cloudflare Stream request failed (${res.status})`);
  return j.result as T;
}

// A one-time URL the seller's browser posts the video file to.
export function createDirectUpload(sellerUid: string, name: string) {
  return cf<{ uploadURL: string; uid: string }>("/direct_upload", {
    method: "POST",
    body: JSON.stringify({ maxDurationSeconds: STREAM_MAX_SECONDS, requireSignedURLs: true, creator: sellerUid, meta: { name } }),
  });
}

export type StreamVideo = { uid: string; readyToStream: boolean; duration?: number; size?: number };
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
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_TOKEN}` },
      cache: "no-store",
    });
    if (res.ok) return true;
    const j = await res.json().catch(() => ({}));
    console.warn("[status] Cloudflare Stream check failed:", res.status, j?.errors?.[0]?.code, j?.errors?.[0]?.message);
    return false;
  } catch (e) {
    console.warn("[status] Cloudflare Stream check failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
