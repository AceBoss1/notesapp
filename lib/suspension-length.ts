// How long a suspension lasts. The admin picks one when suspending (Users page, or "Suspend" on a report); "until" is stored on
// suspensions/{uid} and the scheduler lifts it when the time comes (liftExpiredSuspensions). "indefinite" stays until an admin lifts it.
export const SUSPENSION_LENGTHS = [
  { id: "1d", label: "1 day", days: 1 },
  { id: "3d", label: "3 days", days: 3 },
  { id: "1w", label: "1 week", days: 7 },
  { id: "2w", label: "2 weeks", days: 14 },
  { id: "1m", label: "1 month", days: 30 },
  { id: "3m", label: "3 months", days: 90 },
  { id: "6m", label: "6 months", days: 180 },
  { id: "1y", label: "1 year", days: 365 },
  { id: "indefinite", label: "Until I lift it", days: 0 },
] as const;
export type SuspensionLength = (typeof SUSPENSION_LENGTHS)[number]["id"];

export const isSuspensionLength = (v: unknown): v is SuspensionLength => SUSPENSION_LENGTHS.some((l) => l.id === v);

// The end time (ISO) for a chosen length, or undefined when it has no end.
export function suspensionEnd(length: unknown, now = new Date()): string | undefined {
  const l = SUSPENSION_LENGTHS.find((x) => x.id === length);
  return l && l.days ? new Date(now.getTime() + l.days * 86_400_000).toISOString() : undefined;
}

export const describeUntil = (until?: string) => (until ? `until ${new Date(until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : "until we lift it");
