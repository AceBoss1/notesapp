// Moments: client-safe constants and helpers, shared by the composer, the viewer and the server.
// A moment is a short-lived image, video or text sitting on top of a member's profile picture. It disappears
// when its chosen duration ends; replies live on in direct messages (see lib/messages-server.ts).
import type { AccountTier } from "./users";

const flag = (v: string | undefined) => v === "true";

// Everything stays hidden until these are switched on (Vercel env vars, then redeploy).
export const MOMENTS_LIVE = flag(process.env.NEXT_PUBLIC_MOMENTS_LIVE);
// Moments need direct messages (replies go to the inbox), so turning moments on turns messages on too.
export const MESSAGES_LIVE = flag(process.env.NEXT_PUBLIC_MESSAGES_LIVE) || MOMENTS_LIVE;

export const MOMENT_HOURS = [24, 48, 72] as const;
export type MomentHours = (typeof MOMENT_HOURS)[number];
export const MOMENT_DEFAULT_HOURS: MomentHours = 24;
export const MOMENT_VIDEO_MAX_SECONDS = 90; // one moment
export const MOMENT_VIDEO_SOURCE_MAX_SECONDS = 600; // the longest video we'll cut into moments (up to 7 parts)
export const MOMENT_AUDIO_MAX_SECONDS = 90; // voice-over (not built yet)
export const MOMENT_TEXT_MAX = 280;
// Video moments per ISO week by plan, counted separately from post videos (same numbers, so Free Standard has none).
export const MOMENT_VIDEO_WEEKLY_LIMIT: Record<AccountTier, number> = { standard: 0, basic: 2, pro: 7, business: 14, enterprise: 30 };
export const MOMENT_DAILY_LIMIT = 10; // new moments per member per day (reshares don't count)
export const MOMENT_HINT = "Share your moment with your followers";

export type MomentKind = "image" | "video" | "text";
export const isMomentKind = (v: unknown): v is MomentKind => v === "image" || v === "video" || v === "text";
export const isMomentHours = (v: unknown): v is MomentHours => MOMENT_HOURS.includes(v as MomentHours);

export const momentExpiry = (createdAt: Date, hours: MomentHours) => new Date(createdAt.getTime() + hours * 3_600_000);
export const isMomentExpired = (expiresAt: string, now = new Date()) => new Date(expiresAt).getTime() <= now.getTime();

export function timeLeftLabel(expiresAt: string, now = new Date()): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.ceil(ms / 60_000))}m left`;
}

// Voice-over: a recording (made in the browser) played over a picture, a video or text. Up to 90 seconds.
export const AUDIO_TYPES: Record<string, "webm" | "m4a"> = { "audio/webm": "webm", "audio/mp4": "m4a" };
export const AUDIO_MAX_BYTES = 5 * 1024 * 1024;

// What the first bytes say it is: WebM (the EBML magic number) or MP4 audio (an `ftyp` box).
export function sniffAudio(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "audio/webm") return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (contentType === "audio/mp4") return String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === "ftyp";
  return false;
}

// Why someone reports a moment or a conversation.
export const REPORT_REASONS = ["spam", "harassment", "nudity", "violence", "scam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  spam: "Spam", harassment: "Harassment or hate", nudity: "Nudity or sexual content", violence: "Violence or threats", scam: "Scam or fraud", other: "Something else",
};
export const REPORT_NOTE_MAX = 500;
// The team looks at reports of nudity or violence within 24 hours; the rest as soon as they can.
export const URGENT_REASONS: ReportReason[] = ["nudity", "violence"];
export const REPORT_URGENT_HOURS = 24;
export const isReportReason = (v: unknown): v is ReportReason => REPORT_REASONS.includes(v as ReportReason);

// A video longer than 90 seconds becomes several moments, in order, each up to 90 seconds, using one of the plan's weekly video
// moments for each part. The file is uploaded once; each moment plays its own stretch of it (clipStart to clipEnd).
export const momentVideoParts = (durationSec: number) => (durationSec <= MOMENT_VIDEO_MAX_SECONDS + 1 ? 1 : Math.ceil(durationSec / MOMENT_VIDEO_MAX_SECONDS));

export type VideoClip = { start: number; end: number };
const tenth = (n: number) => Math.round(n * 10) / 10;
// With room for every part, the video is cut into equal parts (none longer than 90 seconds). With room for fewer, only the first
// 90 seconds of each of the parts there is room for are used, and the rest is left out.
export function momentVideoClips(durationSec: number, allowedParts: number): VideoClip[] {
  const needed = momentVideoParts(durationSec);
  const n = Math.max(1, Math.min(needed, Math.floor(allowedParts)));
  if (n >= needed) return Array.from({ length: n }, (_, i) => ({ start: tenth((i * durationSec) / n), end: i === n - 1 ? tenth(durationSec) : tenth(((i + 1) * durationSec) / n) }));
  return Array.from({ length: n }, (_, i) => ({ start: i * MOMENT_VIDEO_MAX_SECONDS, end: Math.min(tenth(durationSec), (i + 1) * MOMENT_VIDEO_MAX_SECONDS) }));
}
