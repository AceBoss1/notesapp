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
    priceKobo: number; // minor units of `currency` (kobo for naira)
    minutes: number;
    availability: Availability;
    currency?: string; // the publisher's own currency when it isn't naira (lib/global-sales.ts)
    // Where sessions happen (docs/EVENTS_DISCOVER.md): in person (the address, shown once booked), online (a #NotesApp call at the
    // booked time, or the publisher's own link) or hybrid: the client chooses at booking. Missing on older settings: not said.
    where?: import("./event-kit").Where;
  };
  // enabled/priceKobo/planCode: Premium, kept for older readers. tiers: Premium, VIP and VVIP (lib/fans.ts tierOffers).
  subscription: {
    enabled: boolean;
    priceKobo: number;
    planCode?: string;
    tiers?: Partial<Record<"premium" | "vip" | "vvip", { enabled: boolean; priceKobo: number; planCode?: string }>>;
  };
  // The creator hid their Top fans list (badges still show; lib/fans-server.ts).
  fansHidden?: boolean;
  // Gifts are on by default once a payout account exists; publishers can switch them off.
  gifts?: { enabled: boolean };
  // Set by the payout-account route once a verified bank account exists,
  // so the browser can tell whether this publisher can be paid (the
  // payout account itself is private).
  payoutReady?: boolean;
  updatedAt: string;
};

// Server enforces these; the UI mirrors them for friendlier errors.
export const LIMITS = {
  sessionMinKobo: 5_000 * 100,
  sessionMaxKobo: 500_000 * 100,
  subscriptionMinKobo: 1_000 * 100,
  subscriptionMaxKobo: 100_000 * 100,
  sessionMinutes: [15, 30, 45, 60, 90, 120],
  maxSlotsPerDay: 30, // every half-hour start the editor offers (06:00–20:30)
};

// ── Where a session happens ──────────────────────────────────────────────────────────────────────────────────────────────────
// What a booked session carries: the way it was booked (in person or online) and the details for it. `link` only for the two of them.
export type SessionMode = "in_person" | "online";
export type SessionPlace = { mode: SessionMode; place?: string; city?: string; state?: string; online?: "notesapp" | "link"; link?: string };
// The modes a client can choose from: both for hybrid, else the one; none when the publisher hasn't said.
export const sessionModes = (w?: import("./event-kit").Where): SessionMode[] => (!w ? [] : w.format === "hybrid" ? ["in_person", "online"] : [w.format === "online" ? "online" : "in_person"]);
// The details of a booking, fixed at checkout. null when the mode chosen isn't offered.
export function sessionPlace(w: import("./event-kit").Where | undefined, chosen: unknown): SessionPlace | null | undefined {
  if (!w) return undefined;
  const modes = sessionModes(w);
  const mode = (modes.includes(chosen as SessionMode) ? chosen : modes.length === 1 ? modes[0] : null) as SessionMode | null;
  if (!mode) return null;
  return mode === "in_person"
    ? { mode, place: w.place, ...(w.city ? { city: w.city } : {}), ...(w.state ? { state: w.state } : {}) }
    : { mode, online: w.online === "link" ? "link" : "notesapp", ...(w.online === "link" && w.link ? { link: w.link } : {}) };
}
export function sessionPlaceText(p?: SessionPlace): string {
  if (!p) return "";
  if (p.mode === "in_person") return `In person: ${[p.place, p.city, p.state].filter(Boolean).join(", ")}`;
  return p.online === "link" ? `Online: ${p.link ?? "the link is on your booking"}` : "Online: a call on #NotesApp at the booked time (open Messages, or your booking)";
}
