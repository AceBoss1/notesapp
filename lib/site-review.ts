// Review my site (docs/SITE_NANA.md): what is stopping visitors from booking, buying or getting in touch, most important first, each with
// the place on Your site that fixes it. Pure rules over what the member's site already has, so it costs nothing and uses no Nana.
import { BLOCKS, blockAllowed, kitOf, resolveButton, type BlockId, type SiteButton, type SiteDoc } from "./site-kits";

export type ReviewInput = {
  site: SiteDoc;
  theme: string;
  tier: string;
  sections: { journals: boolean; shop: boolean; courses: boolean; track: boolean };
  pages: { about: string; contact: string };
  shopItems: number; // items for sale in their shop
  bookingOn: boolean; // their booking calendar takes sessions
};
// Where a fix is made on /profile/site: the anchors of its steps (and the hero editor, the hours strip, the services list).
export type FixAt = "kit" | "look" | "show" | "content" | "pages" | "shop" | "booking";
export type Weight = "high" | "mid" | "low";
export type Finding = { id: string; weight: Weight; title: string; why: string; fix: { label: string; at: FixAt }; nana?: boolean };
export type Review = { findings: Finding[]; fine: string[] };

const RANK: Record<Weight, number> = { high: 0, mid: 1, low: 2 };
const blockName = (id: BlockId) => BLOCKS.find((b) => b.id === id)!.name;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Where a button would take a visitor that has nothing behind it: Book with the calendar off, Shop with nothing to buy, Call with no number.
function deadEnd(b: SiteButton | null, x: ReviewInput): string {
  if (!b) return "";
  if (b.kind === "book" && !x.bookingOn) return `“${b.label}” opens your booking calendar, but you aren't taking bookings.`;
  if (b.kind === "shop" && (!x.sections.shop || x.shopItems === 0)) return `“${b.label}” opens your shop, but there's nothing in it to buy.`;
  if (b.kind === "call" && !resolveButton(b, x.site.blocks.info)) return `“${b.label}” has no phone number to call.`;
  if (b.kind === "contact" && !x.pages.contact.trim() && !x.site.blocks.info.email && !x.site.blocks.info.phone && !x.site.blocks.info.whatsapp) return `“${b.label}” leads to a Contact page with nothing on it.`;
  if (b.kind === "services" && !(x.site.blocks.services.on && x.site.blocks.services.items.length)) return `“${b.label}” scrolls to a price list you haven't filled in.`;
  return "";
}

// Section is switched on but would show nothing (lib/site-kits.ts visibleBlocks hides it, so the member thinks it's there and it isn't).
function emptyOn(x: ReviewInput): BlockId[] {
  const b = x.site.blocks;
  const has: Partial<Record<BlockId, boolean>> = {
    gallery: b.gallery.items.length > 0, testimonials: b.testimonials.items.length > 0, team: b.team.items.length > 0, faq: b.faq.items.length > 0,
    publications: b.publications.items.length > 0, awards: b.awards.items.length > 0, talks: b.talks.items.length > 0, news: b.news.items.length > 0,
  };
  return (Object.keys(has) as BlockId[]).filter((id) => b[id].on && blockAllowed(id, x.tier) && !has[id]);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function reviewSite(x: ReviewInput): Review {
  const out: Finding[] = [];
  const fine: string[] = [];
  const b = x.site.blocks;
  const hero = b.hero;
  const kit = kitOf(x.site.kit);

  // 1. The banner and its main button: the first thing a visitor sees, and the way to act.
  const main = hero.on ? resolveButton(hero.button, b.info) : null;
  if (!hero.on || !(hero.headline || hero.subline || hero.image)) {
    out.push({ id: "no-banner", weight: "high", title: "There's no banner at the top", why: "Visitors land on your site without being told what you do or what to do next.", fix: { label: "Fill in the top banner", at: "content" }, nana: true });
  } else if (!main) {
    out.push({ id: "no-button", weight: "high", title: "There's no button at the top", why: "A visitor has to scroll to find how to book, buy or reach you.", fix: { label: "Add a main button", at: "content" } });
  } else fine.push("main button");
  for (const [n, btn] of [[1, hero.on ? hero.button : null], [2, hero.on ? hero.second : null]] as const) {
    const why = deadEnd(btn, x);
    if (why) out.push({ id: `dead-button-${n}`, weight: "high", title: "A button leads nowhere", why, fix: { label: btn?.kind === "book" ? "Turn on bookings" : btn?.kind === "shop" ? "Add something to your shop" : "Change the button", at: btn?.kind === "book" ? "booking" : btn?.kind === "shop" ? "shop" : "content" } });
  }

  // 2. Words a kit put there that the member never changed: they describe someone else's business.
  if (kit && hero.on && hero.headline && same(hero.headline, kit.starter.headline)) {
    out.push({ id: "starter-banner", weight: "mid", title: "Your banner still has the kit's sample words", why: `“${kit.starter.headline}” was written for every ${kit.name.split(":")[0].toLowerCase()} site, not for yours.`, fix: { label: "Write your own headline", at: "content" }, nana: true });
  }
  const sample = kit?.starter.services ?? [];
  const sampleLeft = b.services.on ? b.services.items.filter((s) => sample.some((k) => same(k.name, s.name) && same(k.price, s.price))).length : 0;
  if (sampleLeft > 0) {
    out.push({ id: "starter-prices", weight: "high", title: `${plural(sampleLeft, "price")} on your list ${sampleLeft === 1 ? "is" : "are"} the kit's sample`, why: "Visitors will expect to pay them. Put in your own prices, or take those lines off.", fix: { label: "Check your prices", at: "content" } });
  }

  // 3. Prices: people leave to ask, and many don't come back.
  const svc = b.services.on ? b.services.items : [];
  const unpriced = svc.filter((s) => !s.price.trim()).length;
  if (svc.length && unpriced) {
    out.push({ id: "no-prices", weight: unpriced * 2 >= svc.length ? "high" : "mid", title: `${unpriced} of ${plural(svc.length, "item")} on your price list ${unpriced === 1 ? "has" : "have"} no price`, why: "People leave to ask, and many don't come back. If it depends, say “From ₦…”.", fix: { label: "Add prices", at: "content" } });
  } else if (svc.length) fine.push("prices");

  // 4. A look built around a photo, with no photo.
  const photoLook = x.theme === "luxe" || hero.style === "photo";
  if (photoLook && hero.on && !hero.image && !x.site.cover) {
    out.push({ id: "no-photo", weight: "mid", title: "Your banner has no photo", why: x.theme === "luxe" ? "The Luxe look is built around one: without it the top of your site is a plain block of colour." : "Your banner is set to a full photo, but there isn't one.", fix: { label: "Add a photo", at: "content" } });
  }

  // 5. How to reach them.
  const i = b.info;
  const reach = !!(i.phone || i.whatsapp || i.email || x.pages.contact.trim());
  if (!reach) out.push({ id: "no-contact", weight: "mid", title: "There's no way to reach you", why: "No phone, WhatsApp, email or Contact page: a visitor with a question has nowhere to ask it.", fix: { label: "Fill in hours and contacts", at: "content" } });
  else fine.push("contacts");
  const sells = svc.length > 0 || (x.sections.shop && x.shopItems > 0) || x.bookingOn;
  if (sells && !(i.on && (i.hours || (i.bookingHours && x.bookingOn) || i.address))) {
    out.push({ id: "no-hours", weight: "mid", title: "No opening hours or address", why: "Customers want to know when you're open and where to find you before they order or book.", fix: { label: "Fill in hours and contacts", at: "content" } });
  }

  // 6. The pages and the sections switched on with nothing in them.
  if (!x.pages.about.trim()) out.push({ id: "no-about", weight: "low", title: "Your About page is empty", why: "People like to know who they are buying from.", fix: { label: "Write it", at: "pages" }, nana: true });
  else fine.push("About page");
  for (const id of emptyOn(x)) out.push({ id: `empty-${id}`, weight: "low", title: `${blockName(id)} is switched on but empty`, why: "It doesn't show on your site until it has something in it.", fix: { label: `Fill in ${blockName(id)}`, at: "content" } });
  if (b.gallery.items.length) fine.push("gallery");
  if (b.faq.items.length) fine.push("questions");
  if (x.sections.shop && x.shopItems > 0) fine.push("shop");
  if (x.site.kit) fine.push("kit and look");

  out.sort((a, c) => RANK[a.weight] - RANK[c.weight]);
  return { findings: out, fine };
}

// "5 things are holding visitors back" / "Nothing is holding visitors back".
export const reviewTitle = (n: number) => (n === 0 ? "Nothing is holding visitors back" : `${n === 1 ? "1 thing is" : `${n} things are`} holding visitors back`);
