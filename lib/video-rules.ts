import type { AccountTier } from "./users";

// Post videos: client-safe constants and helpers, shared by the composer, the player and the server.
// There is no transcoding — we cap size and length instead, accept only formats every phone and browser plays,
// and check what was actually uploaded before a post may point at it (see lib/video-server.ts).
export const VIDEO_TYPES: Record<string, "mp4" | "webm"> = { "video/mp4": "mp4", "video/webm": "webm" };
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
export const VIDEO_MAX_SECONDS = 180; // 3 minutes
export const VIDEO_ACCEPT = "video/mp4,video/webm";

// Uploads per publisher per ISO week, by plan. One video per post.
export const VIDEO_WEEKLY_LIMIT: Record<AccountTier, number> = { standard: 0, basic: 2, pro: 7, business: 14, enterprise: 30 };

// The rules as shown to publishers (composer) — one place so the page copy and the checks can't drift.
export const VIDEO_RULES_TEXT = [
  `MP4 (H.264) or WebM, up to ${Math.round(VIDEO_MAX_BYTES / 1048576)} MB and ${VIDEO_MAX_SECONDS / 60} minutes, one video per post.`,
  "Only post video you made or have permission to use. Nothing unlawful, sexually explicit, graphically violent, hateful, harassing or misleading — we remove it and can suspend the account (Terms, section 2a).",
  "Videos can't be added to premium (subscribers-only) posts yet.",
];

export const videoPublicUrl = (key: string) => `${(process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(/\/$/, "")}/${key}`;

// ISO-8601 week of a date, e.g. "2026-W41" — the quota window.
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const fmtDuration = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
export const fmtBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(n >= 10 * 1048576 ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// What the first bytes of the file say it is. MP4: an `ftyp` box with a mainstream brand (QuickTime/HEVC-only
// brands are refused because they won't play in most browsers); WebM: the EBML magic number.
const MP4_BRANDS = ["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V "];
export function sniffVideo(b: Uint8Array): "mp4" | "webm" | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(b.slice(from, to)));
  if (b.length >= 12 && ascii(4, 8) === "ftyp" && MP4_BRANDS.includes(ascii(8, 12))) return "mp4";
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  return null;
}

// The video fields stored on a post (all optional — a post without video has none of them).
export type PostVideo = { videoId: string; videoKey: string; videoPoster?: string; videoDuration: number; videoSize: number };
