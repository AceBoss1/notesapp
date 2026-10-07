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
export const MOMENT_VIDEO_MAX_SECONDS = 90;
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
