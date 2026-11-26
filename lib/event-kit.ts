// Discover events, calendars, themes and where things happen (docs/EVENTS_DISCOVER.md; owner approved 26 Nov 2026: "Decisions approved,
// build with your recommendations", "should support physical and virtual", "Should we have event kit/theme too"). Pure.
//
// Shared by events, meetings and sessions: the categories, the themes an event page or calendar can wear, the cities and regions in
// Discover, and where something happens (in person, online or both).

// ── Categories ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const EVENT_CATEGORIES = [
  { id: "faith", label: "Faith", icon: "⛪" },
  { id: "business", label: "Business & careers", icon: "💼" },
  { id: "tech", label: "Tech", icon: "💻" },
  { id: "education", label: "Education", icon: "🎓" },
  { id: "food", label: "Food & drink", icon: "🍲" },
  { id: "arts", label: "Arts & culture", icon: "🎨" },
  { id: "fitness", label: "Fitness & running", icon: "🏃" },
  { id: "wellness", label: "Health & wellness", icon: "🧘" },
  { id: "family", label: "Family & kids", icon: "👪" },
  { id: "music", label: "Music & nightlife", icon: "🎶" },
  { id: "networking", label: "Networking", icon: "🤝" },
  { id: "community", label: "Community & causes", icon: "🌍" },
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number]["id"];
export const isCategory = (v: unknown): v is EventCategory => EVENT_CATEGORIES.some((c) => c.id === v);
export const categoryOf = (id: unknown) => EVENT_CATEGORIES.find((c) => c.id === id) ?? null;

// ── Themes (the event kit) ─────────────────────────────────────────────────────────────────────────────────────────────────────
// A theme colours an event page or a calendar: the cover when there's no picture, the accent on buttons, and an optional African pattern.
// The pattern is the #NotesApp African pattern already used behind chats and on empty covers (public/images/patterns/).
export const EVENT_THEMES = [
  { id: "maroon", label: "Maroon", from: "#4E0119", to: "#A6093D", accent: "#7A0328", ink: "#ffffff" },
  { id: "midnight", label: "Midnight", from: "#111111", to: "#3A3A3A", accent: "#111111", ink: "#ffffff" },
  { id: "forest", label: "Forest", from: "#0F5132", to: "#2FA37A", accent: "#17694A", ink: "#ffffff" },
  { id: "indigo", label: "Adire indigo", from: "#1D2B6B", to: "#4B6BDC", accent: "#1D2B6B", ink: "#ffffff" },
  { id: "violet", label: "Violet", from: "#6B2FD6", to: "#A77BF0", accent: "#6B2FD6", ink: "#ffffff" },
  { id: "sunset", label: "Sunset", from: "#C2410C", to: "#F59E0B", accent: "#C2410C", ink: "#ffffff" },
  { id: "kente", label: "Kente gold", from: "#8A5A00", to: "#E0A82E", accent: "#8A5A00", ink: "#ffffff" },
  { id: "paper", label: "Paper", from: "#F3ECE7", to: "#FBF6F2", accent: "#7A0328", ink: "#1A1210" },
] as const;
export type EventThemeId = (typeof EVENT_THEMES)[number]["id"];
export type EventTheme = (typeof EVENT_THEMES)[number];
export const EVENT_PATTERNS = ["none", "africa"] as const; // the African pattern (public/images/patterns/africa-day.svg)
export type EventPattern = (typeof EVENT_PATTERNS)[number];
export const isTheme = (v: unknown): v is EventThemeId => EVENT_THEMES.some((t) => t.id === v);
export const themeOf = (id: unknown): EventTheme => EVENT_THEMES.find((t) => t.id === id) ?? EVENT_THEMES[0];
// The theme a host's events start with: a stable pick from their id, so a calendar without a chosen theme still looks like itself.
export function defaultTheme(seed: string): EventThemeId {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EVENT_THEMES[h % (EVENT_THEMES.length - 1)].id; // never "paper" by default
}
export type ThemeChoice = { theme: EventThemeId; pattern: EventPattern };
export function cleanTheme(v: { theme?: unknown; pattern?: unknown } | undefined, seed: string): ThemeChoice {
  return { theme: isTheme(v?.theme) ? v!.theme : defaultTheme(seed), pattern: (EVENT_PATTERNS as readonly string[]).includes(String(v?.pattern)) ? (v!.pattern as EventPattern) : "none" };
}
// CSS for a cover with no picture.
export const coverStyle = (t: ThemeChoice) => ({
  background: `${t.pattern === "africa" ? "url(/images/patterns/africa-night.svg) center/220px repeat, " : ""}linear-gradient(135deg, ${themeOf(t.theme).from}, ${themeOf(t.theme).to})`,
  color: themeOf(t.theme).ink,
});

// ── Where it happens: in person, online or both (events, meetings and sessions) ──────────────────────────────────────────────
// "notesapp" online means a #NotesApp video room (lives for events, group calls for meetings, calls for sessions); "link" means the
// host's own Zoom, Google Meet, Teams or other https link, shown to people with a ticket or a booking only.
export const FORMATS = [
  { id: "in_person", label: "In person", icon: "📍" },
  { id: "online", label: "Online", icon: "💻" },
  { id: "hybrid", label: "In person and online", icon: "📍💻" },
] as const;
export type Format = (typeof FORMATS)[number]["id"];
export const isFormat = (v: unknown): v is Format => FORMATS.some((f) => f.id === v);
export type OnlineVia = "notesapp" | "link";
export type Where = { format: Format; place: string; state: string; city: string; online: OnlineVia | ""; link: string };

const t = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
// What a host sends about where, made safe. Errors are words for the host.
export function cleanWhere(v: { format?: unknown; place?: unknown; state?: unknown; city?: unknown; online?: unknown; link?: unknown }, states: readonly string[]): { ok: true; where: Where } | { ok: false; error: string } {
  const format: Format = isFormat(v.format) ? v.format : "in_person";
  const place = t(v.place, 200), city = t(v.city, 60);
  const state = states.includes(String(v.state)) ? String(v.state) : "";
  const linkRaw = t(v.link, 500);
  const link = /^https:\/\/[^\s"'<>]+$/i.test(linkRaw) ? linkRaw : "";
  if (linkRaw && !link) return { ok: false, error: "The online link has to start with https://." };
  const online: OnlineVia | "" = format === "in_person" ? "" : v.online === "link" || (link && v.online !== "notesapp") ? "link" : "notesapp";
  if (format !== "online" && !place) return { ok: false, error: "Say where it is: the address or the venue." };
  if (online === "link" && !link) return { ok: false, error: "Add the online link (Zoom, Google Meet, Teams or any https link), or choose #NotesApp video." };
  return { ok: true, where: { format, place: format === "online" ? "" : place, state: format === "online" ? "" : state, city: format === "online" ? "" : city, online, link: online === "link" ? link : "" } };
}
// One line about where, for cards and reminders. The link itself is never in it (only ticket holders and bookers see that).
export function whereLine(w: Partial<Where>): string {
  const placeBit = [w.place, w.city].filter(Boolean).join(", ");
  const onlineBit = w.online === "notesapp" ? "Online on #NotesApp" : w.online === "link" ? "Online" : "";
  if (w.format === "online") return onlineBit || "Online";
  if (w.format === "hybrid") return [placeBit, onlineBit || "online"].filter(Boolean).join(" · ");
  return placeBit;
}

// ── Places in Discover ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const REGIONS = [
  { id: "nigeria", label: "Nigeria" },
  { id: "africa", label: "Rest of Africa" },
  { id: "diaspora", label: "Diaspora" },
  { id: "online", label: "Online" },
] as const;
export type Region = (typeof REGIONS)[number]["id"];
// Cities shown before they have events, with an icon; others appear once they have CITY_MIN upcoming public events.
export const KNOWN_CITIES: { city: string; region: Region; icon: string }[] = [
  { city: "Lagos", region: "nigeria", icon: "🌉" }, { city: "Abuja", region: "nigeria", icon: "🏛️" }, { city: "Port Harcourt", region: "nigeria", icon: "⚓" },
  { city: "Ibadan", region: "nigeria", icon: "🏙️" }, { city: "Enugu", region: "nigeria", icon: "⛰️" }, { city: "Kano", region: "nigeria", icon: "🕌" },
  { city: "Benin City", region: "nigeria", icon: "🌳" }, { city: "Accra", region: "africa", icon: "🌊" }, { city: "Nairobi", region: "africa", icon: "🦒" },
  { city: "Johannesburg", region: "africa", icon: "⛏️" }, { city: "Cape Town", region: "africa", icon: "🏔️" }, { city: "Kigali", region: "africa", icon: "🌄" },
  { city: "London", region: "diaspora", icon: "🎡" }, { city: "Houston", region: "diaspora", icon: "🚀" }, { city: "Toronto", region: "diaspora", icon: "🍁" },
  { city: "Atlanta", region: "diaspora", icon: "🍑" }, { city: "Dubai", region: "diaspora", icon: "🏙️" },
];
export const CITY_MIN = 3;
// An event's Discover place: its city (tidied) and the region; online-only events are in "online".
export function placeKey(w: Partial<Where> & { state?: string }): { region: Region; city: string } {
  if (w.format === "online") return { region: "online", city: "Online" };
  const raw = (w.city || "").trim();
  const known = KNOWN_CITIES.find((c) => c.city.toLowerCase() === raw.toLowerCase());
  if (known) return { region: known.region, city: known.city };
  if (w.state) return { region: "nigeria", city: w.state === "FCT" ? "Abuja" : raw ? titleCase(raw) : w.state };
  return { region: raw ? "diaspora" : "nigeria", city: raw ? titleCase(raw) : "" };
}
const titleCase = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

// ── Discover ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type DiscoverEvent = {
  id: string; title: string; startsAt: string; category?: string; going: number; goingWeek?: number; pinned?: boolean;
  visibility: "public" | "members"; cancelled?: boolean; region: Region; city: string;
};
// Featured: upcoming public events in the city, pinned first, then the most Going in the last week, then the soonest.
export function featured<T extends DiscoverEvent>(list: T[], city: string, nowIso: string, n = 6): T[] {
  const live = list.filter((e) => e.visibility === "public" && !e.cancelled && e.startsAt >= nowIso && (!city || e.city.toLowerCase() === city.toLowerCase()));
  return live.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.goingWeek ?? 0) - (a.goingWeek ?? 0) || a.startsAt.localeCompare(b.startsAt)).slice(0, n);
}
export type Counts = { categories: Record<string, number>; cities: { region: Region; city: string; count: number }[] };
// Counts of upcoming public events by category and by city: the rollup Discover reads instead of every event.
export function countUpcoming(list: DiscoverEvent[], nowIso: string): Counts {
  const categories: Record<string, number> = {};
  const byCity = new Map<string, { region: Region; city: string; count: number }>();
  for (const e of list) {
    if (e.visibility !== "public" || e.cancelled || e.startsAt < nowIso) continue;
    if (e.category) categories[e.category] = (categories[e.category] ?? 0) + 1;
    if (!e.city) continue;
    const k = `${e.region}|${e.city.toLowerCase()}`;
    const c = byCity.get(k) ?? { region: e.region, city: e.city, count: 0 };
    c.count++; byCity.set(k, c);
  }
  return { categories, cities: [...byCity.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)) };
}
// The cities a region's tab shows: the known ones (with their counts, even 0) and any other city with at least CITY_MIN events.
export function citiesFor(region: Region, counts: Counts["cities"]): { city: string; count: number; icon: string }[] {
  const known = KNOWN_CITIES.filter((c) => c.region === region).map((c) => ({ city: c.city, icon: c.icon, count: counts.find((x) => x.region === region && x.city.toLowerCase() === c.city.toLowerCase())?.count ?? 0 }));
  const extra = counts.filter((x) => x.region === region && x.count >= CITY_MIN && !known.some((k) => k.city.toLowerCase() === x.city.toLowerCase())).map((x) => ({ city: x.city, count: x.count, icon: "📍" }));
  return [...known, ...extra].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
}
// "1.2k" for counts on cards.
export const shortCount = (n: number) => (n >= 1000 ? `${(Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, "")}k` : String(n));
