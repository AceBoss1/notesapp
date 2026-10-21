// Sites (docs/SITES.md, phase 2): the content sections a member's site can switch on beyond Journals, Shop, Courses and Track, what each needs,
// the colour set, and the kits (one-tap starting points by type of member). Pure: checked on the server (lib/site-server.ts), drawn by
// components/site/SiteBlocks.tsx, edited on /profile/site.
//
// Stored in sites/{uid} (public to read, written only by the server): { kit, palette: { id, custom? }, blocks: { hero, info, services, … },
// order: BlockId[], updatedAt }. The look stays users/{uid}.siteTheme and the four page sections users/{uid}.siteSections.
import { HEX_RE, isPalette, meetsTier, type PaletteId, type SiteThemeId } from "./site-themes";

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
export type Info = { on: boolean; hours: string; whatsapp: string; phone: string; address: string; mapUrl: string };
export type ServiceItem = { name: string; price: string; note: string };
export type Picture = { image: string; caption: string };
export type Testimonial = { quote: string; name: string; role: string };
export type Person = { name: string; role: string; photo: string };
export type Qa = { q: string; a: string };
export type Blocks = {
  hero: Hero; info: Info;
  services: { on: boolean; items: ServiceItem[] }; gallery: { on: boolean; items: Picture[] };
  testimonials: { on: boolean; items: Testimonial[] }; team: { on: boolean; items: Person[] }; faq: { on: boolean; items: Qa[] };
};
export type SiteDoc = { kit: string; palette: { id: PaletteId; custom?: string }; blocks: Blocks; order: BlockId[]; updatedAt?: string };

export const LIMITS = { services: 40, gallery: 24, testimonials: 12, team: 24, faq: 20 } as const;
const t = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const para = (v: unknown, max: number) => String(v ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
// Pictures come from our own uploads (lib/upload.ts) or any https address; nothing else (no javascript:, data: or http:).
const img = (v: unknown) => { const s = t(v, 600); return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : ""; };
const digits = (v: unknown) => t(v, 30).replace(/[^\d+]/g, "").slice(0, 16);

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
  info: { on: false, hours: "", whatsapp: "", phone: "", address: "", mapUrl: "" },
  services: { on: false, items: [] }, gallery: { on: false, items: [] }, testimonials: { on: false, items: [] }, team: { on: false, items: [] }, faq: { on: false, items: [] },
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
    info: { on: on(i), hours: t(i.hours, 120), whatsapp: digits(i.whatsapp), phone: digits(i.phone), address: t(i.address, 200), mapUrl: /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+)\S*$/i.test(t(i.mapUrl, 500)) ? t(i.mapUrl, 500) : "" },
    services: { on: on(o.services), items: list(o.services?.items, LIMITS.services, (x) => (t(x.name, 80) ? { name: t(x.name, 80), price: t(x.price, 40), note: t(x.note, 160) } : null)) },
    gallery: { on: on(o.gallery), items: list(o.gallery?.items, LIMITS.gallery, (x) => (img(x.image) ? { image: img(x.image), caption: t(x.caption, 120) } : null)) },
    testimonials: { on: on(o.testimonials), items: list(o.testimonials?.items, LIMITS.testimonials, (x) => (t(x.quote, 400) && t(x.name, 60) ? { quote: para(x.quote, 400), name: t(x.name, 60), role: t(x.role, 80) } : null)) },
    team: { on: on(o.team), items: list(o.team?.items, LIMITS.team, (x) => (t(x.name, 60) ? { name: t(x.name, 60), role: t(x.role, 80), photo: img(x.photo) } : null)) },
    faq: { on: on(o.faq), items: list(o.faq?.items, LIMITS.faq, (x) => (t(x.q, 160) && para(x.a, 800) ? { q: t(x.q, 160), a: para(x.a, 800) } : null)) },
  };
}
export const DEFAULT_ORDER: BlockId[] = ["hero", "info", "services", "gallery", "testimonials", "team", "faq"];
export function cleanOrder(v: unknown): BlockId[] {
  const seen = (Array.isArray(v) ? v : []).filter(isBlockId).filter((x, i, a) => a.indexOf(x) === i);
  return [...seen, ...DEFAULT_ORDER.filter((b) => !seen.includes(b))];
}
export function cleanPalette(v: unknown): { id: PaletteId; custom?: string } {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const id: PaletteId = isPalette(o.id) ? o.id : "crimson";
  return typeof o.custom === "string" && HEX_RE.test(o.custom) ? { id, custom: o.custom.toLowerCase() } : { id };
}
export function siteDocOf(raw: unknown): SiteDoc {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { kit: t(o.kit, 30), palette: cleanPalette(o.palette), blocks: cleanBlocks(o.blocks), order: cleanOrder(o.order), updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined };
}
// What a visitor sees: only the sections switched on, with something in them, that the plan still covers (after a downgrade, a section waits
// switched off rather than vanishing from the settings).
export function visibleBlocks(d: SiteDoc, tier: string): BlockId[] {
  const b = d.blocks;
  const has: Record<BlockId, boolean> = {
    hero: b.hero.on && !!(b.hero.headline || b.hero.subline || b.hero.image), info: b.info.on && !!(b.info.hours || b.info.whatsapp || b.info.phone || b.info.address),
    services: b.services.on && b.services.items.length > 0, gallery: b.gallery.on && b.gallery.items.length > 0,
    testimonials: b.testimonials.on && b.testimonials.items.length > 0, team: b.team.on && b.team.items.length > 0, faq: b.faq.on && b.faq.items.length > 0,
  };
  return d.order.filter((id) => has[id] && blockAllowed(id, tier));
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
  // The kit's colour set replaces a custom colour too (the member can pick it again after).
  return { site: { ...d, kit: k.id, palette: { id: k.palette }, blocks: b, order }, theme: k.theme, sections };
}
