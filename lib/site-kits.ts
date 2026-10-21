// Sites (docs/SITES.md, phases 2 and 3): the content sections a member's site can switch on beyond Journals, Shop, Courses and Track, what each needs,
// the colour set, and the kits (one-tap starting points by type of member). Pure: checked on the server (lib/site-server.ts), drawn by
// components/site/SiteBlocks.tsx, edited on /profile/site.
//
// Stored in sites/{uid} (public to read, written only by the server): { kit, palette: { id, custom? }, blocks: { hero, info, services, … },
// order: BlockId[], updatedAt }. The look stays users/{uid}.siteTheme and the four page sections users/{uid}.siteSections.
import { formatSlot } from "./booking-time";
import { HEX_RE, isBackground, isPalette, meetsTier, type PaletteId, type SiteBackground, type SiteThemeId } from "./site-themes";
import { placeCoords } from "./places";

// ── Sections and what they need ──
// The page sections (users/{uid}.siteSections) and what each needs (owner's decisions, 20 Oct 2026).
export const SECTION_MIN_TIER: Record<"journals" | "shop" | "courses" | "track", string> = { journals: "basic", shop: "pro", courses: "basic", track: "business" };
export const BLOCKS = [
  { id: "hero", name: "Top banner", blurb: "A headline, a line about what you do, a picture, and your main button (Book now, Order on WhatsApp, Call us…).", minTier: "basic" },
  { id: "info", name: "Hours and contacts strip", blurb: "Opening hours, WhatsApp, phone and where to find you, in a strip under the banner.", minTier: "basic" },
  { id: "services", name: "Services and prices", blurb: "What you offer and what it costs: a price list.", minTier: "basic" },
  { id: "gallery", name: "Gallery", blurb: "Pictures of your work, your place or your moments.", minTier: "basic" },
  { id: "testimonials", name: "Testimonials", blurb: "What your customers or students say about you.", minTier: "basic" },
  { id: "team", name: "Team", blurb: "The people behind your business, with their roles.", minTier: "basic" },
  { id: "faq", name: "Questions and answers", blurb: "The questions people ask you most, answered once.", minTier: "basic" },
  // The academic sections (phase 3), open from Free Basic (owner, 20 Oct 2026).
  { id: "publications", name: "Publications", blurb: "Your papers, books and chapters, by year, with links.", minTier: "basic" },
  { id: "awards", name: "Awards", blurb: "Prizes, grants, fellowships and honours.", minTier: "basic" },
  { id: "talks", name: "Talks", blurb: "Where you've spoken, on a globe, with the event and a link.", minTier: "basic" },
  { id: "news", name: "In the news", blurb: "Articles, interviews and features about you or your work.", minTier: "basic" },
] as const;
export type BlockId = (typeof BLOCKS)[number]["id"];
export const isBlockId = (v: unknown): v is BlockId => BLOCKS.some((b) => b.id === v);
export const blockAllowed = (id: BlockId, tier: string) => meetsTier(tier, BLOCKS.find((b) => b.id === id)!.minTier);

// ── Content ──
export const BUTTON_KINDS = [
  { id: "book", label: "Book now", needs: "" },
  { id: "whatsapp", label: "Order on WhatsApp", needs: "Your WhatsApp number" },
  { id: "call", label: "Call us", needs: "Your phone number" },
  { id: "shop", label: "Shop now", needs: "" },
  { id: "contact", label: "Contact us", needs: "" },
  { id: "link", label: "Learn more", needs: "A web address (https://…)" },
] as const;
export type ButtonKind = (typeof BUTTON_KINDS)[number]["id"];
export type SiteButton = { kind: ButtonKind; label: string; value: string };
export type Hero = { on: boolean; headline: string; subline: string; image: string; button: SiteButton | null; second: SiteButton | null };
// bookingHours: show the opening hours of their booking calendar instead of typed hours (owner, 21 Oct 2026). Either way, when their
// sessions are on, the hours card opens the booking card.
export type Info = { on: boolean; hours: string; bookingHours: boolean; whatsapp: string; phone: string; address: string; mapUrl: string };
export type ServiceItem = { name: string; price: string; note: string };
export type Picture = { image: string; caption: string };
export type Testimonial = { quote: string; name: string; role: string };
export type Person = { name: string; role: string; photo: string };
export type Qa = { q: string; a: string };
export type Publication = { title: string; authors: string; venue: string; year: string; url: string; note: string };
export type Award = { title: string; by: string; year: string; note: string };
// lat/lng: from the place's name (lib/places.ts) or typed in; without them the talk is listed but has no dot on the globe.
export type Talk = { title: string; event: string; place: string; year: string; url: string; lat: number | null; lng: number | null };
export type NewsItem = { title: string; outlet: string; year: string; url: string };
export type Blocks = {
  hero: Hero; info: Info;
  services: { on: boolean; items: ServiceItem[] }; gallery: { on: boolean; items: Picture[] };
  testimonials: { on: boolean; items: Testimonial[] }; team: { on: boolean; items: Person[] }; faq: { on: boolean; items: Qa[] };
  publications: { on: boolean; items: Publication[] }; awards: { on: boolean; items: Award[] };
  talks: { on: boolean; items: Talk[] }; news: { on: boolean; items: NewsItem[] };
};
export type SitePalette = { id: PaletteId; custom?: string; bg?: SiteBackground };
// bookBelowPosts: a booking card under every post on the site (owner, 21 Oct 2026).
export type SiteDoc = { kit: string; palette: SitePalette; blocks: Blocks; order: BlockId[]; bookBelowPosts: boolean; updatedAt?: string };

export const LIMITS = { services: 40, gallery: 24, testimonials: 12, team: 24, faq: 20, publications: 200, awards: 60, talks: 80, news: 60 } as const;
const t = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const para = (v: unknown, max: number) => String(v ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
// Pictures come from our own uploads (lib/upload.ts) or any https address; nothing else (no javascript:, data: or http:).
const img = (v: unknown) => { const s = t(v, 600); return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : ""; };
const digits = (v: unknown) => t(v, 30).replace(/[^\d+]/g, "").slice(0, 16);
const link = (v: unknown) => { const s = t(v, 500); return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : ""; };
// A year (or "2024–2025", "Forthcoming"): kept short; the four digits are what lists sort by.
const year = (v: unknown) => t(v, 20);
const coord = (v: unknown, max: number) => { const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN; return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 100) / 100 : null; };
// Where a talk was: typed coordinates win, else the place's name if we know it.
function talkCoords(x: Record<string, unknown>, place: string): { lat: number | null; lng: number | null } {
  const lat = coord(x.lat, 90), lng = coord(x.lng, 180);
  if (lat !== null && lng !== null) return { lat, lng };
  const c = placeCoords(place);
  return c ? { lat: c[0], lng: c[1] } : { lat: null, lng: null };
}

export function cleanButton(v: unknown): SiteButton | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const kind = BUTTON_KINDS.find((k) => k.id === o.kind);
  if (!kind) return null;
  const label = t(o.label, 30) || kind.label;
  let value = "";
  if (kind.id === "whatsapp" || kind.id === "call") value = digits(o.value);
  else if (kind.id === "link") { const u = t(o.value, 400); value = /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ""; }
  // A WhatsApp or Call button may leave its number empty: it then uses the number in the hours and contacts strip (resolveButton).
  if (kind.id === "link" && !value) return null;
  return { kind: kind.id, label, value };
}

export const emptyBlocks = (): Blocks => ({
  hero: { on: false, headline: "", subline: "", image: "", button: null, second: null },
  info: { on: false, hours: "", bookingHours: false, whatsapp: "", phone: "", address: "", mapUrl: "" },
  services: { on: false, items: [] }, gallery: { on: false, items: [] }, testimonials: { on: false, items: [] }, team: { on: false, items: [] }, faq: { on: false, items: [] },
  publications: { on: false, items: [] }, awards: { on: false, items: [] }, talks: { on: false, items: [] }, news: { on: false, items: [] },
});
const list = <T,>(v: unknown, max: number, each: (x: Record<string, unknown>) => T | null): T[] =>
  (Array.isArray(v) ? v : []).slice(0, max * 4).map((x) => (x && typeof x === "object" ? each(x as Record<string, unknown>) : null)).filter((x): x is T => x !== null).slice(0, max);

// Everything a member can send for their sections, made safe and within the limits. Unknown parts are dropped.
export function cleanBlocks(v: unknown): Blocks {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, Record<string, unknown> | undefined>;
  const on = (x: Record<string, unknown> | undefined) => x?.on === true;
  const h = o.hero ?? {}, i = o.info ?? {};
  return {
    hero: { on: on(h), headline: t(h.headline, 90), subline: t(h.subline, 240), image: img(h.image), button: cleanButton(h.button), second: cleanButton(h.second) },
    info: { on: on(i), hours: t(i.hours, 120), bookingHours: i.bookingHours === true, whatsapp: digits(i.whatsapp), phone: digits(i.phone), address: t(i.address, 200), mapUrl: /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+)\S*$/i.test(t(i.mapUrl, 500)) ? t(i.mapUrl, 500) : "" },
    services: { on: on(o.services), items: list(o.services?.items, LIMITS.services, (x) => (t(x.name, 80) ? { name: t(x.name, 80), price: t(x.price, 40), note: t(x.note, 160) } : null)) },
    gallery: { on: on(o.gallery), items: list(o.gallery?.items, LIMITS.gallery, (x) => (img(x.image) ? { image: img(x.image), caption: t(x.caption, 120) } : null)) },
    testimonials: { on: on(o.testimonials), items: list(o.testimonials?.items, LIMITS.testimonials, (x) => (t(x.quote, 400) && t(x.name, 60) ? { quote: para(x.quote, 400), name: t(x.name, 60), role: t(x.role, 80) } : null)) },
    team: { on: on(o.team), items: list(o.team?.items, LIMITS.team, (x) => (t(x.name, 60) ? { name: t(x.name, 60), role: t(x.role, 80), photo: img(x.photo) } : null)) },
    faq: { on: on(o.faq), items: list(o.faq?.items, LIMITS.faq, (x) => (t(x.q, 160) && para(x.a, 800) ? { q: t(x.q, 160), a: para(x.a, 800) } : null)) },
    publications: { on: on(o.publications), items: list(o.publications?.items, LIMITS.publications, (x) => (t(x.title, 300) ? { title: t(x.title, 300), authors: t(x.authors, 600), venue: t(x.venue, 200), year: year(x.year), url: link(x.url), note: t(x.note, 120) } : null)) },
    awards: { on: on(o.awards), items: list(o.awards?.items, LIMITS.awards, (x) => (t(x.title, 200) ? { title: t(x.title, 200), by: t(x.by, 160), year: year(x.year), note: t(x.note, 200) } : null)) },
    talks: { on: on(o.talks), items: list(o.talks?.items, LIMITS.talks, (x) => { const place = t(x.place, 80); return t(x.title, 200) ? { title: t(x.title, 200), event: t(x.event, 160), place, year: year(x.year), url: link(x.url), ...talkCoords(x, place) } : null; }) },
    news: { on: on(o.news), items: list(o.news?.items, LIMITS.news, (x) => (t(x.title, 200) ? { title: t(x.title, 200), outlet: t(x.outlet, 100), year: year(x.year), url: link(x.url) } : null)) },
  };
}
export const DEFAULT_ORDER: BlockId[] = ["hero", "info", "services", "gallery", "testimonials", "team", "faq", "publications", "awards", "talks", "news"];
export function cleanOrder(v: unknown): BlockId[] {
  const seen = (Array.isArray(v) ? v : []).filter(isBlockId).filter((x, i, a) => a.indexOf(x) === i);
  return [...seen, ...DEFAULT_ORDER.filter((b) => !seen.includes(b))];
}
export function cleanPalette(v: unknown): SitePalette {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const id: PaletteId = isPalette(o.id) ? o.id : "crimson";
  return {
    id,
    ...(typeof o.custom === "string" && HEX_RE.test(o.custom) ? { custom: o.custom.toLowerCase() } : {}),
    ...(isBackground(o.bg) ? { bg: o.bg } : {}),
  };
}
export function siteDocOf(raw: unknown): SiteDoc {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { kit: t(o.kit, 30), palette: cleanPalette(o.palette), blocks: cleanBlocks(o.blocks), order: cleanOrder(o.order), bookBelowPosts: o.bookBelowPosts === true, updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined };
}
// What a visitor sees: only the sections switched on, with something in them, that the plan still covers (after a downgrade, a section waits
// switched off rather than vanishing from the settings).
export function visibleBlocks(d: SiteDoc, tier: string): BlockId[] {
  const b = d.blocks;
  const has: Record<BlockId, boolean> = {
    hero: b.hero.on && !!(b.hero.headline || b.hero.subline || b.hero.image), info: b.info.on && !!(b.info.hours || b.info.bookingHours || b.info.whatsapp || b.info.phone || b.info.address),
    services: b.services.on && b.services.items.length > 0, gallery: b.gallery.on && b.gallery.items.length > 0,
    testimonials: b.testimonials.on && b.testimonials.items.length > 0, team: b.team.on && b.team.items.length > 0, faq: b.faq.on && b.faq.items.length > 0,
    publications: b.publications.on && b.publications.items.length > 0, awards: b.awards.on && b.awards.items.length > 0,
    talks: b.talks.on && b.talks.items.length > 0, news: b.news.on && b.news.items.length > 0,
  };
  return d.order.filter((id) => has[id] && blockAllowed(id, tier));
}
// The opening hours of a member's booking calendar (publisherSettings session.availability: "0".."6" → ["09:00", …], Sunday first), in
// words: days with the same hours run together, Monday first ("Mon–Fri, 9:00 AM to 5:00 PM · Sat, 10:00 AM to 1:00 PM"). A day runs from its
// first time to the end of its last session.
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function bookingHoursText(availability: unknown, minutes: number): string {
  const a = (availability && typeof availability === "object" ? availability : {}) as Record<string, unknown>;
  const span = (d: number) => {
    const slots = (Array.isArray(a[String(d)]) ? (a[String(d)] as unknown[]) : []).filter((x): x is string => typeof x === "string" && /^\d{2}:\d{2}$/.test(x)).sort();
    if (!slots.length) return "";
    const [h, m] = slots[slots.length - 1].split(":").map(Number);
    const end = h * 60 + m + Math.max(15, Math.min(minutes || 60, 480));
    return `${formatSlot(slots[0])} to ${formatSlot(`${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`)}`;
  };
  const week = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ d, s: span(d) }));
  const runs: { from: number; to: number; s: string }[] = [];
  for (const { d, s } of week) {
    const last = runs[runs.length - 1];
    if (s && last && last.s === s && week.findIndex((w) => w.d === last.to) + 1 === week.findIndex((w) => w.d === d)) last.to = d;
    else if (s) runs.push({ from: d, to: d, s });
  }
  return runs.map((r) => `${DAY[r.from]}${r.to !== r.from ? `–${DAY[r.to]}` : ""}, ${r.s}`).join(" · ");
}
// Publications grouped by year, newest first ("Forthcoming" and other words before the years, no year last); each year keeps the member's order.
export function byYear<T extends { year: string }>(items: T[]): { year: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const x of items) { const y = x.year || ""; groups.set(y, [...(groups.get(y) ?? []), x]); }
  const num = (y: string) => { const m = y.match(/\d{4}/g); return m ? Number(m[m.length - 1]) : null; };
  return [...groups.entries()].sort(([a], [b]) => {
    if (!a || !b) return a ? -1 : b ? 1 : 0;
    const na = num(a), nb = num(b);
    if (na === null || nb === null) return na === null ? (nb === null ? 0 : -1) : 1;
    return nb - na;
  }).map(([year, items]) => ({ year, items }));
}
// A button as the visitor gets it: a WhatsApp or Call button without its own number takes the one in the strip; with neither, no button.
export function resolveButton(b: SiteButton | null, info: Info): SiteButton | null {
  if (!b) return null;
  if (b.kind === "whatsapp") { const v = b.value || info.whatsapp || info.phone; return v ? { ...b, value: v } : null; }
  if (b.kind === "call") { const v = b.value || info.phone || info.whatsapp; return v ? { ...b, value: v } : null; }
  if (b.kind === "link" && !b.value) return null;
  return b;
}
// Where a button goes on a member's site (base is "" on their domain, "/s/<username>" on the preview).
export function buttonHref(b: SiteButton, base: string, whatsappText = ""): string {
  if (b.kind === "book") return `${base || ""}/#book`;
  if (b.kind === "shop") return `${base}/shop`;
  if (b.kind === "contact") return `${base}/contact`;
  if (b.kind === "call") return `tel:${b.value}`;
  if (b.kind === "whatsapp") return `https://wa.me/${b.value.replace(/^\+/, "").replace(/^0/, "234")}${whatsappText ? `?text=${encodeURIComponent(whatsappText)}` : ""}`;
  return b.value;
}

// ── Kits ──
type Starter = { headline: string; subline: string; button: SiteButton; second?: SiteButton; services?: ServiceItem[]; faq?: Qa[]; hours?: string };
export type Kit = {
  id: string; name: string; emoji: string; blurb: string; minTier: string; theme: SiteThemeId; palette: PaletteId;
  sections: { journals: boolean; shop: boolean; courses: boolean; track: boolean }; blocks: BlockId[]; starter: Starter;
};
const btn = (kind: ButtonKind, label?: string): SiteButton => ({ kind, label: label ?? BUTTON_KINDS.find((k) => k.id === kind)!.label, value: "" });
export const KITS: Kit[] = [
  {
    id: "personal", name: "Personal and creators", emoji: "✍️", minTier: "basic", theme: "clean", palette: "crimson",
    blurb: "For you as a person, a writer or a content creator: who you are, your journals, your work in pictures, what people say, and how to reach you.",
    sections: { journals: true, shop: false, courses: true, track: false }, blocks: ["hero", "gallery", "testimonials", "faq"],
    starter: { headline: "Hi, I'm glad you're here.", subline: "What I write about, what I make, and how to work with me.", button: btn("contact", "Get in touch"),
      faq: [{ q: "How can we work together?", a: "Tell me what you have in mind through my Contact page, and I'll get back to you." }] },
  },
  {
    // A personal kit too (Free Basic), in the Scholar look.
    id: "scholar", name: "Academics and researchers", emoji: "📚", minTier: "basic", theme: "scholar", palette: "ocean",
    blurb: "For researchers, lecturers and students: who you are and what you work on, your publications by year, awards, talks on a globe and news.",
    sections: { journals: true, shop: false, courses: true, track: false }, blocks: ["hero", "publications", "talks", "awards", "news"],
    starter: { headline: "Hello, and welcome.", subline: "What I research and teach, where I've published and spoken, and how to reach me.", button: btn("contact", "Get in touch") },
  },
  {
    id: "fashion", name: "Fashion and accessories", emoji: "👗", minTier: "pro", theme: "clean", palette: "royal",
    blurb: "Your collection up front, prices and delivery, orders on WhatsApp, and pictures from your shoots.",
    sections: { journals: false, shop: true, courses: false, track: false }, blocks: ["hero", "info", "gallery", "testimonials", "faq"],
    starter: { headline: "New styles, made to be worn.", subline: "Shop the latest pieces, delivered anywhere in Nigeria.", button: btn("shop"), second: btn("whatsapp"),
      hours: "Mon–Sat, 9am to 7pm",
      faq: [{ q: "Do you deliver outside my state?", a: "Yes. Delivery is worked out at checkout for your address." }, { q: "Can I return an item?", a: "Tell us within 48 hours of delivery and we'll sort it out." }] },
  },
  {
    id: "food", name: "Food and baking", emoji: "🍰", minTier: "pro", theme: "clean", palette: "sunset",
    blurb: "Your menu with prices, opening hours, orders on WhatsApp, and pictures that make people hungry.",
    sections: { journals: false, shop: true, courses: false, track: false }, blocks: ["hero", "info", "services", "gallery", "testimonials"],
    starter: { headline: "Freshly made, every day.", subline: "Cakes, small chops and meals for every occasion. Order ahead and we'll have it ready.", button: btn("whatsapp", "Order on WhatsApp"), second: btn("call"),
      hours: "Mon–Sat, 8am to 6pm",
      services: [{ name: "Birthday cake (8 inch)", price: "₦25,000", note: "Order 2 days ahead" }, { name: "Small chops (per pack)", price: "₦6,000", note: "" }] },
  },
  {
    id: "services", name: "Services and freelancers", emoji: "🛠️", minTier: "pro", theme: "clean", palette: "ocean",
    blurb: "What you do and what it costs, how to book you, past work, and what clients say.",
    sections: { journals: true, shop: false, courses: false, track: false }, blocks: ["hero", "services", "gallery", "testimonials", "faq"],
    starter: { headline: "Your work, done properly.", subline: "Clear prices, on time, and easy to reach.", button: btn("book"), second: btn("whatsapp"),
      services: [{ name: "Consultation (1 hour)", price: "₦15,000", note: "Online or in person" }],
      faq: [{ q: "How do I book?", a: "Tap Book now, pick a time and pay to confirm." }] },
  },
  {
    id: "healthcare", name: "Healthcare and clinics", emoji: "🩺", minTier: "pro", theme: "clean", palette: "ocean",
    blurb: "Your services, how to book an appointment, opening hours and where to find you, and your team.",
    sections: { journals: true, shop: false, courses: false, track: false }, blocks: ["hero", "info", "services", "team", "faq"],
    starter: { headline: "Care you can count on.", subline: "Book an appointment, see our services and opening hours, and find us easily.", button: btn("book", "Book an appointment"), second: btn("call"),
      hours: "Mon–Fri, 8am to 5pm · Sat, 9am to 1pm",
      services: [{ name: "General consultation", price: "₦10,000", note: "" }, { name: "Lab tests", price: "From ₦5,000", note: "" }],
      faq: [{ q: "Do I need an appointment?", a: "Appointments are best; walk-ins are seen when a doctor is free." }] },
  },
  {
    id: "school", name: "Schools and academies", emoji: "🎓", minTier: "business", theme: "clean", palette: "royal",
    blurb: "What you teach, admissions, your courses, your teachers, news from the school and answers for parents.",
    sections: { journals: true, shop: false, courses: true, track: false }, blocks: ["hero", "info", "services", "team", "testimonials", "faq"],
    starter: { headline: "Learning for a brighter future.", subline: "A safe, caring school with teachers who know every learner by name.", button: btn("contact", "Apply now"), second: btn("call"),
      hours: "Mon–Fri, 7:30am to 3pm",
      services: [{ name: "Primary", price: "", note: "Classes 1 to 6" }, { name: "Secondary", price: "", note: "JSS 1 to SSS 3" }],
      faq: [{ q: "When do admissions open?", a: "Admissions are open all year; contact us to book a visit." }] },
  },
  {
    id: "church", name: "Churches and NGOs", emoji: "🤝", minTier: "business", theme: "clean", palette: "forest",
    blurb: "Who you are and what you do, service or programme times, news, your team and how to get involved. Community and Giving come later.",
    sections: { journals: true, shop: false, courses: false, track: false }, blocks: ["hero", "info", "gallery", "team", "faq"],
    starter: { headline: "Stronger communities, brighter futures.", subline: "Join us, volunteer, or support the work we do.", button: btn("contact", "Get involved"),
      hours: "Sundays, 8am and 10am · Wednesdays, 6pm",
      faq: [{ q: "How can I get involved?", a: "Reach us through the Contact page and tell us how you'd like to help." }] },
  },
];
export const kitOf = (id: unknown) => KITS.find((k) => k.id === id) ?? null;
export const kitAllowed = (k: Kit, tier: string) => meetsTier(tier, k.minTier);

// Applying a kit: its look, colours, page sections and section order, and its starter words only where the member hasn't written anything,
// so applying a kit never wipes their work. Sections their plan doesn't cover stay off.
export function applyKitTo(d: SiteDoc, k: Kit, tier: string): { site: SiteDoc; theme: SiteThemeId; sections: Kit["sections"] } {
  const b = structuredClone(d.blocks);
  for (const id of DEFAULT_ORDER) b[id].on = k.blocks.includes(id) && blockAllowed(id, tier);
  const s = k.starter;
  if (!b.hero.headline) b.hero.headline = s.headline;
  if (!b.hero.subline) b.hero.subline = s.subline;
  if (!b.hero.button) b.hero.button = s.button;
  if (!b.hero.second && s.second) b.hero.second = s.second;
  if (!b.info.hours && s.hours) b.info.hours = s.hours;
  if (!b.services.items.length && s.services) b.services.items = s.services;
  if (!b.faq.items.length && s.faq) b.faq.items = s.faq;
  const order = [...k.blocks, ...DEFAULT_ORDER.filter((x) => !k.blocks.includes(x))];
  const sections = {
    journals: k.sections.journals && meetsTier(tier, SECTION_MIN_TIER.journals), shop: k.sections.shop && meetsTier(tier, SECTION_MIN_TIER.shop),
    courses: k.sections.courses && meetsTier(tier, SECTION_MIN_TIER.courses), track: k.sections.track && meetsTier(tier, SECTION_MIN_TIER.track),
  };
  if (!Object.values(sections).some(Boolean)) sections.journals = true;
  // The kit's colour set replaces a custom colour too (the member can pick it again after); their background choice stays.
  return { site: { ...d, kit: k.id, palette: { id: k.palette, ...(d.palette.bg ? { bg: d.palette.bg } : {}) }, blocks: b, order }, theme: k.theme, sections };
}
