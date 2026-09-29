// Session times are wall-clock Africa/Lagos (WAT, UTC+1, no DST) —
// the platform's home market. Kept dependency-free so both server
// routes and client components can import it.
export const SESSION_TZ_OFFSET = "+01:00";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function sessionStart(date: string, slot: string): Date {
  return new Date(`${date}T${slot}:00${SESSION_TZ_OFFSET}`);
}

export function sessionEnd(date: string, slot: string, minutes: number): Date {
  return new Date(sessionStart(date, slot).getTime() + minutes * 60_000);
}

// "14:30" -> "2:30 PM"
export function formatSlot(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

// 0 = Sunday, computed from the date string itself (no local-tz drift).
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00${SESSION_TZ_OFFSET}`).getUTCDay();
}

export function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}

export type Availability = Record<string, string[]>; // "0".."6" -> ["09:00", ...]

export type PublisherSettings = {
  uid: string;
  username: string;
  session: {
    enabled: boolean;
    priceKobo: number;
    minutes: number;
    availability: Availability;
  };
  subscription: {
    enabled: boolean;
    priceKobo: number;
    planCode?: string;
  };
  updatedAt: string;
};

// Server enforces these; the UI mirrors them for friendlier errors.
export const LIMITS = {
  sessionMinKobo: 5_000 * 100,
  sessionMaxKobo: 500_000 * 100,
  subscriptionMinKobo: 1_000 * 100,
  subscriptionMaxKobo: 100_000 * 100,
  sessionMinutes: [15, 30, 45, 60, 90, 120],
  maxSlotsPerDay: 12,
};
