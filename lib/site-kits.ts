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
// The page sections (users/{uid}.siteSections) and what each needs (owner's decisions, 20 and 21 Oct 2026: Shop is open from Free Basic,
// which pays the higher store commission, lib/tiers.ts).
export const SECTION_MIN_TIER: Record<"journals" | "shop" | "courses" | "track", string> = { journals: "basic", shop: "basic", courses: "basic", track: "business" };
export const BLOCKS = [
  { id: "hero", name: "Top banner", blurb: "A headline, a line about what you do, a picture, and your main button (Book now, Shop now, Call us…).", minTier: "basic" },
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
  { id: "call", label: "Call us", needs: "Your phone number" },
  { id: "shop", label: "Shop now", needs: "" },
  { id: "contact", label: "Contact us", needs: "" },
  { id: "services", label: "Check our services", needs: "" },
  { id: "link", label: "Learn more", needs: "A web address (https://…)" },
] as const;
export type ButtonKind = (typeof BUTTON_KINDS)[number]["id"];
export type SiteButton = { kind: ButtonKind; label: string; value: string };
// style "photo": the picture fills the top of the page edge to edge, with the words over it (the beauty kits); otherwise words beside the
// picture. eyebrow: a small line above the headline ("Welcome to").
export type Hero = { on: boolean; headline: string; subline: string; image: string; button: SiteButton | null; second: SiteButton | null; style?: "photo"; eyebrow?: string };
// bookingHours: show the opening hours of their booking calendar instead of typed hours (owner, 21 Oct 2026). Either way, when their
// sessions are on, the hours card opens the booking card.
// The strip shows the email, never the phone number (owner, 22 Oct 2026); the phone is for Call buttons.
export type Info = { on: boolean; hours: string; bookingHours: boolean; whatsapp: string; phone: string; email?: string; address: string; mapUrl: string };
// minutes and group (the menu's tabs: Facials, Massages, Nails …) and a picture are optional; with them, services show as a menu of cards.
export type ServiceItem = { name: string; price: string; note: string; minutes?: number; group?: string; image?: string };
export type Picture = { image: string; caption: string };
export type Testimonial = { quote: string; name: string; role: string };
// username: tag them (their name links to their #NotesApp profile). Showing someone gives them no access: seats are Business and above.
export type Person = { name: string; role: string; photo: string; username?: string };
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
// orcid: the researcher's ORCID iD, and whether their new works are added to Publications daily (lib/publications-server.ts).
export type OrcidLink = { id: string; sync: boolean; lastSyncAt?: string };
// cover: a wide picture behind the profile header, on every look (owner, 21 Oct 2026).
// focus: what Home leads with (shown first and in full); "mix" (the default) gives a little of each.
export const SITE_FOCUS = [
  { id: "mix", label: "A mix of everything" }, { id: "shop", label: "My shop" }, { id: "services", label: "My services" }, { id: "courses", label: "My courses" }, { id: "notes", label: "My notes" },
] as const;
export type SiteFocus = (typeof SITE_FOCUS)[number]["id"];
export const cleanFocus = (v: unknown): SiteFocus => (SITE_FOCUS.some((f) => f.id === v) ? v as SiteFocus : "mix");
// community: the id of a community the member runs (lib/community.ts), linked to their site from "Your site" (owner, 22 Oct 2026: choosing the
// Churches and NGOs kit should open Community: start one there, or link the one they run). The site's menu then has a Community link.
export type SiteDoc = { kit: string; palette: SitePalette; blocks: Blocks; order: BlockId[]; bookBelowPosts: boolean; orcid: OrcidLink | null; cover: string; announce?: string; focus?: SiteFocus; community?: string; updatedAt?: string };
// The kits that open Community on "Your site" (start one, or link one you run).
export const COMMUNITY_KITS = ["church"];
export const cleanCommunityLink = (v: unknown) => { const s = String(v ?? ""); return /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(s) ? s : ""; };

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

// "Order on WhatsApp" buttons are gone: #NotesApp keeps orders and payments on the platform, where buyers are protected (owner, 21 Oct
// 2026). One saved before then becomes Contact us.
export function cleanButton(v: unknown): SiteButton | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.kind === "whatsapp") return { kind: "contact", label: "Contact us", value: "" };
  const kind = BUTTON_KINDS.find((k) => k.id === o.kind);
  if (!kind) return null;
  const label = t(o.label, 30) || kind.label;
  let value = "";
  if (kind.id === "call") value = digits(o.value);
  else if (kind.id === "link") { const u = t(o.value, 400); value = /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ""; }
  // A Call button may leave its number empty: it then uses the number in the hours and contacts strip (resolveButton).
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

export const cleanCover = (v: unknown) => img(v);
// The announcement bar across the top of every page of the site ("Free delivery in Lagos this week"): one line, plain words, no links.
function cleanService(x: Record<string, unknown>): ServiceItem {
  const minutes = Math.floor(Number(x.minutes));
  return {
    name: t(x.name, 80), price: t(x.price, 40), note: t(x.note, 160),
    ...(minutes >= 5 && minutes <= 720 ? { minutes } : {}), ...(t(x.group, 40) ? { group: t(x.group, 40) } : {}), ...(img(x.image) ? { image: img(x.image) } : {}),
  };
}
// "1 hr 10 min", "45 min", "2 hr".
export const durationText = (m?: number) => (!m ? "" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}`);
export const cleanEmail = (v: unknown) => { const e = t(v, 120).toLowerCase(); return /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/.test(e) ? e : ""; };
export const ANNOUNCE_MAX = 90;
export const cleanAnnounce = (v: unknown) => t(v, ANNOUNCE_MAX);
// Everything a member can send for their sections, made safe and within the limits. Unknown parts are dropped.
export function cleanBlocks(v: unknown): Blocks {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, Record<string, unknown> | undefined>;
  const on = (x: Record<string, unknown> | undefined) => x?.on === true;
  const h = o.hero ?? {}, i = o.info ?? {};
  return {
    hero: { on: on(h), headline: t(h.headline, 90), subline: t(h.subline, 240), image: img(h.image), button: cleanButton(h.button), second: cleanButton(h.second), ...(h.style === "photo" ? { style: "photo" as const } : {}), ...(t(h.eyebrow, 40) ? { eyebrow: t(h.eyebrow, 40) } : {}) },
    info: { on: on(i), hours: t(i.hours, 120), bookingHours: i.bookingHours === true, whatsapp: digits(i.whatsapp), phone: digits(i.phone), ...(cleanEmail(i.email) ? { email: cleanEmail(i.email) } : {}), address: t(i.address, 200), mapUrl: /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+)\S*$/i.test(t(i.mapUrl, 500)) ? t(i.mapUrl, 500) : "" },
    services: { on: on(o.services), items: list(o.services?.items, LIMITS.services, (x) => (t(x.name, 80) ? cleanService(x) : null)) },
    gallery: { on: on(o.gallery), items: list(o.gallery?.items, LIMITS.gallery, (x) => (img(x.image) ? { image: img(x.image), caption: t(x.caption, 120) } : null)) },
    testimonials: { on: on(o.testimonials), items: list(o.testimonials?.items, LIMITS.testimonials, (x) => (t(x.quote, 400) && t(x.name, 60) ? { quote: para(x.quote, 400), name: t(x.name, 60), role: t(x.role, 80) } : null)) },
    team: { on: on(o.team), items: list(o.team?.items, LIMITS.team, (x) => { const u = t(x.username, 40).replace(/^@/, "").toLowerCase(); return t(x.name, 60) ? { name: t(x.name, 60), role: t(x.role, 80), photo: img(x.photo), ...(/^[a-z0-9_.]{2,30}$/.test(u) ? { username: u } : {}) } : null; }) },
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
const orcidOf = (v: unknown): OrcidLink | null => {
  const o = (v && typeof v === "object" ? v : null) as Record<string, unknown> | null;
  if (!o || typeof o.id !== "string" || !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(o.id)) return null;
  return { id: o.id, sync: o.sync === true, ...(typeof o.lastSyncAt === "string" ? { lastSyncAt: o.lastSyncAt } : {}) };
};
export function siteDocOf(raw: unknown): SiteDoc {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { kit: t(o.kit, 30), palette: cleanPalette(o.palette), blocks: cleanBlocks(o.blocks), order: cleanOrder(o.order), bookBelowPosts: o.bookBelowPosts === true, orcid: orcidOf(o.orcid), cover: img(o.cover), announce: cleanAnnounce(o.announce), focus: cleanFocus(o.focus), community: cleanCommunityLink(o.community), updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined };
}
// What a visitor sees: only the sections switched on, with something in them, that the plan still covers (after a downgrade, a section waits
// switched off rather than vanishing from the settings).
export function visibleBlocks(d: SiteDoc, tier: string): BlockId[] {
  const b = d.blocks;
  const has: Record<BlockId, boolean> = {
    hero: b.hero.on && !!(b.hero.headline || b.hero.subline || b.hero.image), info: b.info.on && !!(b.info.hours || b.info.bookingHours || b.info.whatsapp || b.info.email || b.info.address),
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
// A button as the visitor gets it: a Call button without its own number takes the one in the strip; with neither, no button.
export function resolveButton(b: SiteButton | null, info: Info): SiteButton | null {
  if (!b) return null;
  if (b.kind === "call") { const v = b.value || info.phone || info.whatsapp; return v ? { ...b, value: v } : null; }
  if (b.kind === "link" && !b.value) return null;
  return b;
}
// Where a button goes on a member's site (base is "" on their domain, "/s/<username>" on the preview).
export function buttonHref(b: SiteButton, base: string): string {
  if (b.kind === "book") return `${base || ""}/#book`;
  if (b.kind === "shop") return `${base}/shop`;
  if (b.kind === "contact") return `${base}/contact`;
  if (b.kind === "services") return `${base || ""}/#services`;
  if (b.kind === "call") return `tel:${b.value}`;
  return b.value;
}

// ── Kits ──
type Starter = { headline: string; subline: string; button: SiteButton; second?: SiteButton; services?: ServiceItem[]; faq?: Qa[]; hours?: string; heroStyle?: "photo"; eyebrow?: string };
export type Kit = {
  id: string; name: string; emoji: string; blurb: string; minTier: string; theme: SiteThemeId; palette: PaletteId;
  bestFor?: string; // who it suits, on its card in the kit picker
  sections: { journals: boolean; shop: boolean; courses: boolean; track: boolean }; blocks: BlockId[]; starter: Starter;
  // Kits that are flavours of one (Beauty and wellness: Spa, Massage, Hair, Nails) show as one card with a choice.
  family?: { id: string; name: string; flavour: string };
};
const btn = (kind: ButtonKind, label?: string): SiteButton => ({ kind, label: label ?? BUTTON_KINDS.find((k) => k.id === kind)!.label, value: "" });

// Beauty & wellness (owner, 21 Oct 2026): one kit in four flavours, each with its own starter menu. They open with a full photo (hero style
// "photo"), list services as a menu with durations and prices in tabs, and keep a Book your appointment tab on the side of every page.
// They replace the earlier "Massage and spa" (spa) and "Salons and beauty" (salon) kits; sites that used those keep working (kitOf).
function beautyKits(): Kit[] {
  const family = (flavour: string) => ({ id: "beauty", name: "Beauty and wellness", flavour });
  const book = btn("book", "Book your appointment");
  const base = { minTier: "pro", theme: "luxe" as const, family: undefined as Kit["family"] };
  const ask = { q: "How do I book?", a: "Pick a time on this page and pay online: your booking is confirmed straight away, with a reminder before it." };
  return [
    { ...base, id: "beauty-spa", name: "Beauty and wellness: Spa", emoji: "🧖", palette: "forest", family: family("Spa"),
      blurb: "Facials, massages, body treatments and packages on a menu with times and prices, a full photo up top, and booking on every page.",
      sections: { journals: false, shop: false, courses: false, track: false }, blocks: ["hero", "services", "info", "gallery", "testimonials", "faq"],
      starter: { heroStyle: "photo", eyebrow: "Welcome to", headline: "Breathe out. We'll take it from here.", subline: "Facials, massages and body treatments in a calm, clean space.", button: book, second: btn("services"),
        hours: "Mon–Sat, 9am to 7pm",
        services: [{ group: "Facials", name: "Essential facial", minutes: 45, price: "₦25,000", note: "" }, { group: "Facials", name: "Deep-cleansing facial", minutes: 70, price: "₦35,000", note: "" }, { group: "Massages", name: "Relaxation massage", minutes: 45, price: "₦30,000", note: "" }, { group: "Massages", name: "Hot stone massage", minutes: 60, price: "₦40,000", note: "" }, { group: "Body", name: "Body polish", minutes: 60, price: "₦35,000", note: "" }, { group: "Packages", name: "Half-day retreat", minutes: 180, price: "₦85,000", note: "Facial, massage and body polish" }],
        faq: [ask, { q: "What should I bring?", a: "Just yourself. We have robes, slippers and everything you need." }] } },
    { ...base, id: "beauty-massage", name: "Beauty and wellness: Massage", emoji: "💆", palette: "gold", family: family("Massage"),
      blurb: "Your massages on a menu with times and prices, home visits, your therapists, and booking on every page.",
      sections: { journals: false, shop: false, courses: false, track: false }, blocks: ["hero", "services", "info", "testimonials", "team", "faq"],
      starter: { heroStyle: "photo", eyebrow: "Welcome to", headline: "Let the tension go.", subline: "Swedish, deep tissue, hot stone and sports massage, at our studio or in your home.", button: book, second: btn("services"),
        hours: "Mon–Sun, 10am to 9pm",
        services: [{ group: "Massages", name: "Swedish massage", minutes: 60, price: "₦25,000", note: "" }, { group: "Massages", name: "Deep tissue massage", minutes: 60, price: "₦30,000", note: "" }, { group: "Massages", name: "Hot stone massage", minutes: 75, price: "₦38,000", note: "" }, { group: "Couples", name: "Couples massage", minutes: 60, price: "₦55,000", note: "" }, { group: "Home visits", name: "Massage at home", minutes: 90, price: "₦45,000", note: "We bring the table and oils" }],
        faq: [ask, { q: "Do you come to my home?", a: "Yes. Book a home visit and tell us your address; we bring everything." }] } },
    { ...base, id: "beauty-hair", name: "Beauty and wellness: Hair", emoji: "💇", palette: "royal", family: family("Hair"),
      blurb: "Braids, wigs, cuts and colour on a menu with times and prices, your work in pictures, your stylists, hair products, and booking.",
      sections: { journals: false, shop: true, courses: false, track: false }, blocks: ["hero", "services", "gallery", "team", "testimonials", "info", "faq"],
      starter: { heroStyle: "photo", eyebrow: "Welcome to", headline: "Hair that turns heads.", subline: "Braids, wigs, cuts, colour and treatments by stylists who listen.", button: book, second: btn("services"),
        hours: "Tue–Sun, 9am to 7pm",
        services: [{ group: "Braids", name: "Knotless braids (medium, waist length)", minutes: 300, price: "From ₦35,000", note: "" }, { group: "Braids", name: "Cornrows", minutes: 120, price: "From ₦12,000", note: "" }, { group: "Wigs", name: "Wig install", minutes: 90, price: "₦15,000", note: "" }, { group: "Wigs", name: "Wig revamp", minutes: 120, price: "₦18,000", note: "" }, { group: "Cuts and colour", name: "Cut and style", minutes: 45, price: "₦8,000", note: "" }, { group: "Cuts and colour", name: "Colour", minutes: 120, price: "From ₦25,000", note: "" }, { group: "Treatments", name: "Deep conditioning treatment", minutes: 60, price: "₦12,000", note: "" }],
        faq: [ask, { q: "Should I bring my own hair extensions?", a: "You can, or we can supply them: the price is shown when you book." }] } },
    { ...base, id: "beauty-nails", name: "Beauty and wellness: Nails", emoji: "💅", palette: "crimson", family: family("Nails"),
      blurb: "Manicures, pedicures, extensions and nail art on a menu with times and prices, your work in pictures, press-ons to buy, and booking.",
      sections: { journals: false, shop: true, courses: false, track: false }, blocks: ["hero", "services", "gallery", "testimonials", "info", "faq"],
      starter: { heroStyle: "photo", eyebrow: "Welcome to", headline: "Nails, done beautifully.", subline: "Gel, acrylic and press-ons, manicures and pedicures, in a clean and calm studio.", button: book, second: btn("services"),
        hours: "Mon–Sat, 9am to 8pm",
        services: [{ group: "Manicure", name: "Classic manicure", minutes: 30, price: "₦6,000", note: "" }, { group: "Manicure", name: "Gel polish", minutes: 45, price: "₦8,000", note: "" }, { group: "Extensions", name: "Acrylic full set", minutes: 90, price: "₦15,000", note: "" }, { group: "Extensions", name: "Gel-X full set", minutes: 90, price: "₦18,000", note: "" }, { group: "Pedicure", name: "Classic pedicure", minutes: 45, price: "₦8,000", note: "" }, { group: "Pedicure", name: "Jelly pedicure", minutes: 60, price: "₦15,000", note: "" }, { group: "Nail art", name: "Nail art (per set)", minutes: 15, price: "From ₦2,000", note: "" }],
        faq: [ask, { q: "How long do gel nails last?", a: "Two to three weeks with care. Come back for a refill or a soak-off." }] } },
  ];
}
// The kits that came before Beauty and wellness, for sites that still carry them.
const OLD_KITS: Record<string, string> = { spa: "beauty-spa", salon: "beauty-hair" };
export const KITS: Kit[] = [
  {
    id: "personal", name: "Personal and creators", emoji: "✍️", minTier: "basic", theme: "clean", palette: "crimson",
    bestFor: "Writers, creators, speakers, artists and anyone who wants a site of their own.",
    blurb: "For you as a person, a writer or a content creator: who you are, your journals, your work in pictures, what people say, and how to reach you.",
    sections: { journals: true, shop: false, courses: true, track: false }, blocks: ["hero", "gallery", "testimonials", "faq"],
    starter: { headline: "Hi, I'm glad you're here.", subline: "What I write about, what I make, and how to work with me.", button: btn("contact", "Get in touch"),
      faq: [{ q: "How can we work together?", a: "Tell me what you have in mind through my Contact page, and I'll get back to you." }] },
  },
  {
    // A personal kit too (Free Basic), in the Scholar look.
    id: "scholar", name: "Academics and researchers", emoji: "📚", minTier: "basic", theme: "scholar", palette: "ocean",
    bestFor: "Researchers, lecturers, PhD students and scientists.",
    blurb: "For researchers, lecturers and students: who you are and what you work on, your publications by year, awards, talks on a globe and news.",
    sections: { journals: true, shop: false, courses: true, track: false }, blocks: ["hero", "publications", "talks", "awards", "news"],
    starter: { headline: "Hello, and welcome.", subline: "What I research and teach, where I've published and spoken, and how to reach me.", button: btn("contact", "Get in touch") },
  },
  {
    id: "fashion", name: "Fashion: clothes, bags, shoes and jewellery", emoji: "👗", minTier: "pro", theme: "luxe", palette: "royal",
    bestFor: "Boutiques, designers, tailors, and bag, shoe and jewellery sellers.",
    blurb: "Your collection up front (clothes, bags, shoes, jewellery), prices and delivery, safe checkout, and pictures from your shoots.",
    sections: { journals: false, shop: true, courses: false, track: false }, blocks: ["hero", "gallery", "testimonials", "faq", "info"],
    starter: { heroStyle: "photo", eyebrow: "New collection", headline: "New styles, made to be worn.", subline: "Shop the latest pieces, delivered anywhere in Nigeria.", button: btn("shop"), second: btn("shop", "New arrivals"),
      hours: "Mon–Sat, 9am to 7pm",
      faq: [{ q: "Do you deliver outside my state?", a: "Yes. Delivery is worked out at checkout for your address." }, { q: "Can I return an item?", a: "Tell us within 48 hours of delivery and we'll sort it out." }] },
  },
  {
    id: "food", name: "Food and baking", emoji: "🍰", minTier: "pro", theme: "luxe", palette: "sunset",
    bestFor: "Bakers, caterers, small chops, restaurants, home cooks and drinks makers.",
    blurb: "Opens with a photo of your food, then your menu in tabs (cakes, small chops, meals, drinks) with prices and how far ahead to order, ordering and paying online, delivery or pick-up, and your hours.",
    sections: { journals: false, shop: true, courses: false, track: false }, blocks: ["hero", "services", "gallery", "info", "testimonials", "faq"],
    starter: { heroStyle: "photo", eyebrow: "Fresh from our kitchen", headline: "Freshly made, every day.", subline: "Cakes, small chops, trays and meals for birthdays, offices and owambe. Order ahead, pay online, and pick up or get it delivered.", button: btn("shop", "Order now"), second: btn("services", "See the menu"),
      hours: "Mon–Sat, 8am to 7pm · Sun, 12pm to 6pm",
      services: [
        { group: "Cakes", name: "Birthday cake (8 inch, 2 layers)", price: "From ₦25,000", note: "Order 2 days ahead" },
        { group: "Cakes", name: "Wedding cake (3 tiers)", price: "From ₦180,000", note: "Tasting on request" },
        { group: "Small chops", name: "Small chops pack (20 pieces)", price: "₦6,000", note: "Puff-puff, samosa, spring rolls, peppered chicken" },
        { group: "Small chops", name: "Party tray (100 pieces)", price: "₦45,000", note: "Order 3 days ahead" },
        { group: "Meals", name: "Jollof rice and chicken", price: "₦3,500", note: "" },
        { group: "Meals", name: "Soup bowl (2 litres)", price: "From ₦15,000", note: "Egusi, efo riro or ofe onugbu" },
        { group: "Drinks", name: "Zobo or chapman (1 litre)", price: "₦2,500", note: "" },
      ],
      faq: [
        { q: "How far ahead should I order?", a: "Two days for cakes, three for party trays and catering. Same-day orders are taken while we have stock." },
        { q: "Do you deliver?", a: "Yes. Delivery is worked out at checkout for your address, or pick up from us at no cost." },
        { q: "Can you cater for my event?", a: "Yes, from 30 guests. Tell us the date, the number of guests and the menu through our Contact page." },
        { q: "Can you work around allergies?", a: "Tell us when you order. We'll say honestly what we can make safely." },
      ] },
  },
  {
    id: "services", name: "Services and freelancers", emoji: "🛠️", minTier: "pro", theme: "clean", palette: "ocean",
    bestFor: "Consultants, designers, developers, writers, lawyers, accountants, coaches and other professionals.",
    blurb: "What you do and what it costs in tabs (consultations, projects, retainers) with how long each takes, booking a call and paying online, your past work, your team and what clients say.",
    sections: { journals: true, shop: false, courses: false, track: false }, blocks: ["hero", "services", "gallery", "testimonials", "team", "faq", "info"],
    starter: { headline: "Your work, done properly.", subline: "Clear prices, honest timelines and one person you can always reach. Book a call to get started.", button: btn("book", "Book a call"), second: btn("services", "See prices"),
      hours: "Mon–Fri, 9am to 5pm",
      services: [
        { group: "Consultations", name: "Discovery call", minutes: 30, price: "Free", note: "Online" },
        { group: "Consultations", name: "Consultation", minutes: 60, price: "₦15,000", note: "Online or in person" },
        { group: "Projects", name: "Starter project", price: "From ₦80,000", note: "Scope and timeline agreed in writing" },
        { group: "Projects", name: "Full project", price: "From ₦250,000", note: "Paid in stages" },
        { group: "Retainers", name: "Monthly retainer", price: "From ₦150,000 a month", note: "A set number of hours each month" },
      ],
      faq: [
        { q: "How do I book?", a: "Tap Book a call, pick a time and pay to confirm. You get a reminder before it." },
        { q: "How do payments work for projects?", a: "We agree the scope and price first, then you pay in stages as the work is delivered." },
        { q: "What if I need to cancel a call?", a: "See the cancellation policy on the booking card before you pay." },
      ] },
  },
  {
    id: "healthcare", name: "Healthcare and clinics", emoji: "🩺", minTier: "pro", theme: "clean", palette: "ocean",
    bestFor: "Clinics, hospitals, pharmacies, dentists, physiotherapists, labs and private doctors.",
    blurb: "Book an appointment first, then your services in tabs (consultations, tests, online and home visits) with times and fees, opening hours and where to find you, your doctors, and answers about HMOs and emergencies.",
    sections: { journals: true, shop: false, courses: false, track: false }, blocks: ["hero", "info", "services", "team", "faq", "testimonials"],
    starter: { headline: "Care you can count on.", subline: "Book an appointment online, see our services and fees, and find us easily. Walk-ins welcome when a doctor is free.", button: btn("book", "Book an appointment"), second: btn("call", "Call the clinic"),
      hours: "Mon–Fri, 8am to 6pm · Sat, 9am to 2pm",
      services: [
        { group: "Consultations", name: "General consultation", minutes: 20, price: "₦10,000", note: "" },
        { group: "Consultations", name: "Children's consultation", minutes: 20, price: "₦12,000", note: "" },
        { group: "Consultations", name: "Specialist consultation", minutes: 30, price: "From ₦20,000", note: "By referral or appointment" },
        { group: "Tests", name: "Full blood count", price: "₦6,000", note: "Results the same day" },
        { group: "Tests", name: "Malaria test", price: "₦3,000", note: "Results in 30 minutes" },
        { group: "Online and home", name: "Video consultation", minutes: 15, price: "₦7,000", note: "From anywhere" },
        { group: "Online and home", name: "Home visit", price: "From ₦25,000", note: "Within our area" },
      ],
      faq: [
        { q: "Do I need an appointment?", a: "Appointments are best; walk-ins are seen when a doctor is free." },
        { q: "Do you take HMOs?", a: "Yes. Ask us which HMOs we accept before your visit, and bring your HMO card." },
        { q: "What about emergencies?", a: "In an emergency, go straight to the nearest emergency unit or call 112. Don't wait for a booking." },
        { q: "How do I get my results?", a: "Most results are ready the same day; we'll tell you when and how you'll get yours." },
      ] },
  },
  // Phase 4 (owner, 21 Oct 2026): more kits by type of business, Pro like the others.
  ...beautyKits(),
  {
    id: "fitness", name: "Fitness trainers", emoji: "💪", minTier: "pro", theme: "luxe", palette: "sunset",
    bestFor: "Personal trainers, gyms, yoga and dance instructors, bootcamps and online coaches.",
    blurb: "Opens with a photo of you training, then sessions, plans and classes in tabs with times and prices, booking a session, your clients' results, your workouts and tips, and courses you sell.",
    sections: { journals: true, shop: false, courses: true, track: false }, blocks: ["hero", "services", "testimonials", "gallery", "info", "faq"],
    starter: { heroStyle: "photo", eyebrow: "Train with", headline: "Get stronger, one session at a time.", subline: "Personal training in person or online, with a plan made for your body and your goals.", button: btn("book", "Book a session"), second: btn("services", "See plans"),
      hours: "Mon–Sat, 5:30am to 8pm",
      services: [
        { group: "Training", name: "Personal training", minutes: 60, price: "₦15,000", note: "At the gym or your home" },
        { group: "Training", name: "Couples session", minutes: 60, price: "₦25,000", note: "" },
        { group: "Training", name: "Online coaching (a month)", price: "₦40,000", note: "Weekly plan and check-ins" },
        { group: "Plans", name: "12 sessions", price: "₦150,000", note: "With a nutrition guide" },
        { group: "Plans", name: "8-week body transformation", price: "₦280,000", note: "Training, meals and progress checks" },
        { group: "Classes", name: "Bootcamp class", minutes: 45, price: "₦5,000", note: "Saturdays" },
      ],
      faq: [
        { q: "I'm a beginner. Is that fine?", a: "Yes. We start where you are and build up safely." },
        { q: "What should I bring?", a: "Comfortable clothes, trainers, a towel and water." },
        { q: "I have an injury. Can I still train?", a: "Tell us before your first session; we'll adapt every exercise, or ask you to see a doctor first." },
      ] },
  },
  {
    id: "events", name: "Events and photography", emoji: "📸", minTier: "pro", theme: "luxe", palette: "charcoal",
    bestFor: "Photographers, videographers, event planners, decorators, DJs, MCs and makeup for events.",
    blurb: "Your best pictures first on a full photo, then packages in tabs (portraits, weddings, events) with times and prices, booking a date with a deposit, what clients say, and answers about delivery and travel.",
    sections: { journals: true, shop: false, courses: false, track: false }, blocks: ["hero", "gallery", "services", "testimonials", "faq", "info"],
    starter: { heroStyle: "photo", eyebrow: "Photography and events", headline: "Moments worth keeping.", subline: "Weddings, birthdays, corporate events and portraits, planned and captured beautifully.", button: btn("book", "Book a date"), second: btn("services", "See packages"),
      hours: "Mon–Sat, 9am to 6pm · Events any day",
      services: [
        { group: "Portraits", name: "Portrait session", minutes: 60, price: "₦40,000", note: "15 edited photos" },
        { group: "Portraits", name: "Birthday or family shoot", minutes: 120, price: "₦80,000", note: "30 edited photos, 2 outfits" },
        { group: "Weddings", name: "Traditional wedding coverage", price: "From ₦250,000", note: "Photo, full day" },
        { group: "Weddings", name: "White wedding, photo and video", price: "From ₦350,000", note: "With a highlight film" },
        { group: "Events", name: "Corporate event (half day)", price: "From ₦150,000", note: "Photo, same-week delivery" },
        { group: "Events", name: "Event planning and decor", price: "From ₦200,000", note: "Vendors, decor and coordination" },
      ],
      faq: [
        { q: "How do we hold our date?", a: "Book the date and pay the deposit; the rest is due a week before the event." },
        { q: "How soon do we get our pictures?", a: "Portraits in a week, events in two, weddings in about four." },
        { q: "Do you travel?", a: "Yes, anywhere in Nigeria. Travel and lodging outside our city are added to the quote." },
      ] },
  },
  {
    id: "electronics", name: "Electronics and mobile devices", emoji: "📱", minTier: "pro", theme: "clean", palette: "ocean",
    bestFor: "Phone and laptop shops, gadget stores, accessories sellers and repair centres.",
    blurb: "Your devices in the shop shown whole on white (new, UK-used or refurbished), repairs in tabs (phones, laptops) with times and prices, booking a repair, warranty answers and opening hours.",
    sections: { journals: false, shop: true, courses: false, track: false }, blocks: ["hero", "services", "info", "testimonials", "faq"],
    starter: { headline: "Genuine devices. Honest repairs.", subline: "Phones, laptops and accessories with warranty, and most repairs done while you wait.", button: btn("shop", "Shop devices"), second: btn("book", "Book a repair"),
      hours: "Mon–Sat, 9am to 7pm",
      services: [
        { group: "Phone repairs", name: "Screen replacement", minutes: 60, price: "From ₦25,000", note: "Same day" },
        { group: "Phone repairs", name: "Battery replacement", minutes: 30, price: "From ₦12,000", note: "" },
        { group: "Phone repairs", name: "Charging port", minutes: 45, price: "From ₦8,000", note: "" },
        { group: "Laptop repairs", name: "Keyboard replacement", price: "From ₦30,000", note: "1 to 2 days" },
        { group: "Laptop repairs", name: "Windows reinstall and data backup", minutes: 120, price: "₦15,000", note: "" },
        { group: "Trade-in", name: "Swap your old device", price: "Priced after we check it", note: "Bring it in" },
      ],
      faq: [
        { q: "Do your devices have a warranty?", a: "Yes. New devices carry the maker's warranty; UK-used and refurbished ones have our own, and repairs have 30 days." },
        { q: "Is it new or used?", a: "Every item in our shop says whether it's new, UK-used or refurbished." },
        { q: "What happens to my data during a repair?", a: "Back up first if you can. We never open your files, and we'll tell you before anything that could erase them." },
      ] },
  },
  {
    id: "motor", name: "Motor and motorcycle spare parts", emoji: "🔧", minTier: "pro", theme: "clean", palette: "charcoal",
    bestFor: "Spare parts dealers, mechanics, auto electricians, tyre shops and motorcycle workshops.",
    blurb: "Parts for cars and motorcycles shown whole on white, servicing and fitting in tabs with prices, asking for a part you can't see, delivery by waybill, and where to find you.",
    sections: { journals: false, shop: true, courses: false, track: false }, blocks: ["hero", "services", "info", "faq", "testimonials"],
    starter: { headline: "The right part, first time.", subline: "Genuine and quality spare parts for cars and motorcycles. Tell us your make, model and year and we'll find it.", button: btn("shop", "Shop parts"), second: btn("contact", "Ask for a part"),
      hours: "Mon–Sat, 8am to 6pm",
      services: [
        { group: "Servicing", name: "Oil change and service", minutes: 60, price: "From ₦15,000", note: "Oil and filter included" },
        { group: "Servicing", name: "Full service", price: "From ₦45,000", note: "Plugs, filters, fluids and checks" },
        { group: "Fitting", name: "Brake pads (fitted)", minutes: 60, price: "From ₦18,000", note: "" },
        { group: "Fitting", name: "Shock absorbers (pair, fitted)", price: "From ₦40,000", note: "" },
        { group: "Motorcycles", name: "Motorcycle service", minutes: 45, price: "From ₦8,000", note: "" },
      ],
      faq: [
        { q: "Can you find a part I can't see in the shop?", a: "Yes. Send us your vehicle's make, model and year (and a photo of the old part) from our Contact page." },
        { q: "Are your parts genuine?", a: "Each part says whether it's original, OEM or a quality aftermarket part." },
        { q: "Do you deliver outside our city?", a: "Yes. Delivery is worked out at checkout, by courier or waybill to the park nearest you." },
        { q: "What if it's the wrong part?", a: "Tell us within 48 hours, unused and in its packaging, and we'll swap it." },
      ] },
  },
  {
    id: "solar", name: "Solar and energy solutions", emoji: "☀️", minTier: "pro", theme: "clean", palette: "gold",
    bestFor: "Solar installers, inverter and battery sellers, and energy engineers.",
    blurb: "Your packages in tabs (homes, businesses) with what each can power and its price, products shown whole on white, booking a site visit, installations you've done, and answers about warranty and payment.",
    sections: { journals: true, shop: true, courses: false, track: false }, blocks: ["hero", "services", "gallery", "testimonials", "info", "faq"],
    starter: { headline: "Steady power, lower bills.", subline: "Solar panels, inverters and batteries for homes and businesses, installed properly and looked after.", button: btn("book", "Book a site visit"), second: btn("shop", "See products"),
      hours: "Mon–Sat, 8am to 6pm",
      services: [
        { group: "Homes", name: "Starter (1.5 kVA)", price: "From ₦650,000", note: "Lights, fans, TV, phones and a small fridge" },
        { group: "Homes", name: "Family (3.5 kVA)", price: "From ₦1,800,000", note: "Adds a freezer, pumping machine and more" },
        { group: "Businesses", name: "Shop or office (5 kVA)", price: "From ₦3,200,000", note: "Computers, POS, lights and a cooler" },
        { group: "Businesses", name: "Commercial (10 kVA and up)", price: "From ₦6,500,000", note: "Designed after a site visit" },
        { group: "Services", name: "Site visit and load check", minutes: 60, price: "₦15,000", note: "We size the system for you" },
        { group: "Services", name: "Maintenance visit", minutes: 90, price: "₦20,000", note: "Cleaning and battery check" },
      ],
      faq: [
        { q: "How long does installation take?", a: "Most homes are done in a day, after the site visit." },
        { q: "What warranty do I get?", a: "Panels, inverters and batteries carry the makers' warranties, and our installation has its own. Ask us for the details of your package." },
        { q: "Can I pay in parts?", a: "Ask us: we'll tell you the options for your package before you commit." },
      ] },
  },
  {
    id: "realestate", name: "Real estate", emoji: "🏠", minTier: "pro", theme: "luxe", palette: "forest",
    bestFor: "Estate agents, developers, property managers, shortlet hosts and land sellers.",
    blurb: "Opens with a photo of a property, then listings in tabs (to let, for sale, shortlet) with prices and locations, booking an inspection, your team, and answers about fees and title documents.",
    sections: { journals: true, shop: false, courses: false, track: false }, blocks: ["hero", "services", "gallery", "info", "team", "testimonials", "faq"],
    starter: { heroStyle: "photo", eyebrow: "Homes and land", headline: "Find your next home.", subline: "Verified properties to rent and buy, shortlets for your stay, and inspections at a time that suits you.", button: btn("book", "Book an inspection"), second: btn("services", "See listings"),
      hours: "Mon–Sat, 9am to 6pm",
      services: [
        { group: "To let", name: "2-bedroom flat, Lekki Phase 1", price: "₦4,500,000 a year", note: "Serviced, with parking" },
        { group: "To let", name: "Mini flat, Yaba", price: "₦1,800,000 a year", note: "" },
        { group: "For sale", name: "4-bedroom terrace, Ikate", price: "₦180,000,000", note: "Governor's consent" },
        { group: "For sale", name: "Land (600 sqm), Ibeju-Lekki", price: "₦18,000,000", note: "C of O" },
        { group: "Shortlet", name: "1-bedroom apartment, Victoria Island", price: "₦85,000 a night", note: "Wi-Fi, power and cleaning" },
        { group: "Services", name: "Property management", price: "10% of the rent", note: "Tenants, rent and repairs handled" },
      ],
      faq: [
        { q: "Do you charge for inspections?", a: "Tell us which property and we'll confirm any inspection fee before you come." },
        { q: "What fees will I pay?", a: "We'll tell you the agency, legal and caution fees in writing before you pay anything." },
        { q: "What title documents do your properties have?", a: "Each listing says: C of O, Governor's consent, deed of assignment or others. Your lawyer can check them before you buy." },
        { q: "I live abroad. Can I still buy?", a: "Yes. We do video inspections and work with your lawyer here." },
      ] },
  },
  {
    id: "school", name: "Schools and academies", emoji: "🎓", minTier: "business", theme: "clean", palette: "royal",
    bestFor: "Nursery, primary and secondary schools, tutorial centres, training academies and coding schools.",
    blurb: "Opens with a photo of your school, then your classes in tabs (nursery, primary, secondary, after-school) with ages, admissions and visits, your teachers, courses you teach online, news, and answers for parents.",
    sections: { journals: true, shop: false, courses: true, track: false }, blocks: ["hero", "services", "info", "team", "testimonials", "gallery", "faq"],
    starter: { heroStyle: "photo", eyebrow: "Admissions open", headline: "Learning for a brighter future.", subline: "A safe, caring school with small classes and teachers who know every learner by name.", button: btn("contact", "Apply now"), second: btn("book", "Book a visit"),
      hours: "Mon–Fri, 7:30am to 3pm · After-school to 5pm",
      services: [
        { group: "Nursery", name: "Creche and playgroup", price: "Fees on request", note: "6 months to 2 years" },
        { group: "Nursery", name: "Nursery 1 and 2", price: "Fees on request", note: "Ages 3 to 5" },
        { group: "Primary", name: "Primary 1 to 6", price: "Fees on request", note: "Ages 6 to 11" },
        { group: "Secondary", name: "JSS 1 to SSS 3", price: "Fees on request", note: "WAEC and NECO" },
        { group: "After school", name: "After-school club", price: "Fees on request", note: "Homework help until 5pm" },
        { group: "After school", name: "Holiday coding camp", price: "Fees on request", note: "Ages 8 to 16" },
      ],
      faq: [
        { q: "When do admissions open?", a: "Admissions are open all year. Book a visit, then the entrance assessment." },
        { q: "Is there an entrance exam?", a: "A short assessment in English and maths, so we place your child in the right class." },
        { q: "Do you run a school bus?", a: "Yes, on set routes. Ask us whether we cover your area." },
        { q: "What curriculum do you follow?", a: "The Nigerian curriculum, with extra reading, coding and the arts." },
      ] },
  },
  {
    id: "church", name: "Churches and NGOs", emoji: "🤝", minTier: "business", theme: "clean", palette: "forest",
    bestFor: "Churches, mosques, NGOs, foundations, associations and community groups.",
    blurb: "Opens with a photo of your people, then service and programme times in tabs, how to get involved, your team and pictures, and answers for first-time visitors. Opens Community too: start one for your members, or link the one you run; Giving comes later.",
    sections: { journals: true, shop: false, courses: false, track: false }, blocks: ["hero", "services", "info", "gallery", "team", "faq"],
    starter: { heroStyle: "photo", eyebrow: "Welcome to", headline: "Stronger communities, brighter futures.", subline: "Join us on Sunday, volunteer with us, or support the work we do in our city.", button: btn("contact", "Get involved"), second: btn("services", "Service times"),
      hours: "Sundays, 8am and 10:30am · Wednesdays, 6pm",
      services: [
        { group: "Sunday", name: "First service", price: "", note: "8am to 10am" },
        { group: "Sunday", name: "Second service", price: "", note: "10:30am to 12:30pm, with children's church" },
        { group: "Midweek", name: "Bible study", price: "", note: "Wednesdays, 6pm (in person and online)" },
        { group: "Fellowships", name: "Youth fellowship", price: "", note: "Saturdays, 4pm" },
        { group: "Fellowships", name: "Women's and men's fellowships", price: "", note: "First Saturday of the month" },
        { group: "Outreach", name: "Food bank", price: "", note: "Last Saturday of the month: volunteers welcome" },
      ],
      faq: [
        { q: "I'm visiting for the first time. What should I expect?", a: "A warm welcome, about two hours of worship and teaching, and someone to show you around. Come as you are." },
        { q: "Is there something for my children?", a: "Yes. Children's church runs during the second service, by age group." },
        { q: "How can I get involved?", a: "Join a fellowship, volunteer at an outreach, or tell us how you'd like to help through our Contact page." },
      ] },
  },
];
export const kitOf = (id: unknown) => KITS.find((k) => k.id === (typeof id === "string" && OLD_KITS[id] ? OLD_KITS[id] : id)) ?? null;
// A beauty and wellness site (any flavour, or the kits before them): the services menu and the side booking tab.
export const isBeautyKit = (id: string) => id.startsWith("beauty-") || id in OLD_KITS;
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
  if (s.heroStyle && !b.hero.style) b.hero.style = s.heroStyle;
  if (s.eyebrow && !b.hero.eyebrow) b.hero.eyebrow = s.eyebrow;
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

// How a shop shows its pictures, by kit: clothes and beauty (every flavour) as tall photos filling the tile; gadgets, parts and panels whole on
// white (product shots); food and everything else as square photos. Sorting and filtering are the same everywhere (sortItems).
export type ShopStyle = { ratio: "portrait" | "square"; fit: "cover" | "contain" };
// What the button on each card of a services menu says and where it goes, by kit: Book now (to the booking card, while sessions are on) for
// most; Order (to the shop) for food; Apply (to Contact) for schools; none for churches and NGOs, whose "menu" is their programme.
export type MenuAction = { label: string; to: "book" | "shop" | "contact" } | null;
export function menuActionOf(kit: string): MenuAction {
  if (kit === "food") return { label: "Order", to: "shop" };
  if (kit === "school") return { label: "Apply", to: "contact" };
  if (kit === "church") return null;
  return { label: "Book now", to: "book" };
}
export function shopStyleOf(kit: string): ShopStyle {
  if (kit === "fashion" || isBeautyKit(kit)) return { ratio: "portrait", fit: "cover" };
  if (kit === "electronics" || kit === "motor" || kit === "solar") return { ratio: "square", fit: "contain" };
  return { ratio: "square", fit: "cover" };
}
export const SHOP_SORTS = [
  { id: "new", label: "Newest" }, { id: "popular", label: "Most popular" }, { id: "low", label: "Price: low to high" }, { id: "high", label: "Price: high to low" }, { id: "az", label: "Name: A to Z" },
] as const;
export type ShopSort = (typeof SHOP_SORTS)[number]["id"];
export const isShopSort = (v: unknown): v is ShopSort => SHOP_SORTS.some((s) => s.id === v);
// Items in the order a visitor asked for, after a search (title, description and category). Items without a price in kobo go last
// when sorting by price; "popular" goes by views (`views`, by item id); "new" puts the most recently added first (createdAt, an ISO date or a Firestore time; undated ones last).
const addedAt = (v: unknown): number => (typeof v === "string" ? Date.parse(v) || 0 : v && typeof (v as { toMillis?: unknown }).toMillis === "function" ? (v as { toMillis: () => number }).toMillis() : 0);
// The shop's collection links (owner, 22 Oct 2026): the publisher's subcategories when they use any ("if sub categories are available
// for the publisher, it should use it first"), otherwise each item's own badge (the label on its picture). Spellings of one label count
// together ("Ocasion wear", "Occasion wear", "Occasion wears"); most used first, shown in their fullest spelling ("Occasion wear").
export const collectionKey = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "")
  .replace(/(ss|x|ch|sh)es$/, "$1").replace(/([^s])s$/, "$1") // one dress, two dresses; wear, wears
  .replace(/(.)\1+/g, "$1"); // "ocasion" and "occasion" are one label
export type CollectionSource = "subcategory" | "badge";
export const collectionSourceOf = (items: { subcategory?: string }[]): CollectionSource => (items.some((i) => i.subcategory?.trim()) ? "subcategory" : "badge");
export const collectionLabelOf = (i: { badge?: string; subcategory?: string }, from: CollectionSource) => ((from === "subcategory" ? i.subcategory : i.badge)?.trim() ?? "");
export function shopCollections(items: { badge?: string; subcategory?: string }[]): { key: string; label: string; n: number }[] {
  const from = collectionSourceOf(items);
  const groups = new Map<string, Map<string, number>>();
  for (const i of items) {
    const label = collectionLabelOf(i, from);
    const key = label && collectionKey(label);
    if (!key) continue;
    const g = groups.get(key) ?? new Map<string, number>();
    g.set(label, (g.get(label) ?? 0) + 1);
    groups.set(key, g);
  }
  return [...groups].map(([key, g]) => {
    // The fullest spelling (a typo usually drops a letter: "Ocasion"), singular ("wear", not "wears"), then the one used most.
    const full = (s: string) => s.replace(/s$/i, "").length;
    const spellings = [...g].sort((a, b) => full(b[0]) - full(a[0]) || b[1] - a[1]);
    return { key, label: spellings[0][0], n: [...g.values()].reduce((x, y) => x + y, 0) };
  }).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

export function sortItems<T extends { id?: string; title: string; subtitle?: string; category?: string; subcategory?: string; badge?: string; priceKobo?: number; createdAt?: unknown }>(items: T[], sort: ShopSort, search = "", views: Record<string, number> = {}): T[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const found = words.length ? items.filter((i) => { const hay = `${i.title} ${i.subtitle ?? ""} ${i.category ?? ""} ${i.subcategory ?? ""} ${i.badge ?? ""}`.toLowerCase(); return words.every((w) => hay.includes(w)); }) : [...items];
  const price = (i: T, missing: number) => (typeof i.priceKobo === "number" ? i.priceKobo : missing);
  if (sort === "low") return found.sort((a, b) => price(a, Infinity) - price(b, Infinity));
  if (sort === "high") return found.sort((a, b) => price(b, -Infinity) - price(a, -Infinity));
  if (sort === "az") return found.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "popular") return found.sort((a, b) => (views[b.id ?? ""] ?? 0) - (views[a.id ?? ""] ?? 0) || addedAt(b.createdAt) - addedAt(a.createdAt));
  return found.sort((a, b) => addedAt(b.createdAt) - addedAt(a.createdAt));
}
