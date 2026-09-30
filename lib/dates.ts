// Notes come from several sources with different date formats: ISO
// strings (composer), RFC-2822 strings ("Thu, 08 May 2025 03:17:27
// +0000" — the seeded/Precheks notes) and occasionally Firestore
// Timestamps. Sorting those as raw strings puts old RFC-2822 notes
// AHEAD of new ISO ones ("T…" < digits < weekday letters), so every
// "newest first" list must compare parsed times instead.
export function toMillis(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  const v = value as { toMillis?: () => number; seconds?: number };
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  return 0;
}

export function sortNewestFirst<T extends { date: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => toMillis(b.date) - toMillis(a.date));
}
