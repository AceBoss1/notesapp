// "Share to Moments" and "Share to Journals" (owner, 1 Nov 2026: "Also add to share options: 1. Share to moments 2. Share to journals").
// Pure and client-safe: what can be shared, the card that stands for it, and what each share puts on the page.
//   - Share to Moments: a moment (kind "link") carrying the item's card: title, cover, its link, and "by @creator". It follows every
//     Moments rule (24/48/72 hours, the owner's audience, teen mode, the daily limit); see shareToMoment in lib/moments-server.ts.
//   - Share to Journals: a new journal draft that quotes the item (title as a link, cover, "Shared from @creator"), for the member to add
//     their thoughts and publish when they choose. Never published by itself.
// The card is always built on the server from the item as it is now (lib/share-targets-server.ts): drafts, private and members-only
// things, revoked certificates and ended coupons have no card, so they can't be shared this way.

export const SHARE_KINDS = ["journal", "course", "certificate", "coupon", "post", "item", "service", "event"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];
export const isShareKind = (v: unknown): v is ShareKind => SHARE_KINDS.includes(v as ShareKind);

// What a share button points at: the kind and its id (a coupon's id is "<seller>/<CODE>").
export type ShareRef = { kind: ShareKind; id: string };

// The link card, as shown in a moment and quoted in a journal draft.
export type ShareCard = {
  kind: ShareKind;
  id: string;
  title: string;
  path: string; // on #NotesApp, starting with "/"
  image?: string; // the cover: https or a path on the site
  creatorUsername?: string; // credited as "@creator"
  creatorName?: string;
  label: string; // "Journal", "Course", …
  price?: string; // shop items and services: "₦15,000" (a session also says how long)
};

export const SHARE_LABEL: Record<ShareKind, string> = { journal: "Journal", course: "Course", certificate: "Certificate", coupon: "Coupon", post: "Community post", item: "Shop item", service: "Service", event: "Event" };
export const SHARE_TITLE_MAX = 140;

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const safeImage = (v: unknown): string | undefined => {
  const s = String(v ?? "").trim();
  return s && s.length <= 1000 && (/^https:\/\/[^\s"'<>()]+$/i.test(s) || /^\/(?!\/)[^\s"'<>()]+$/.test(s)) ? s : undefined;
};
const handle = (v: unknown) => { const s = String(v ?? "").trim().replace(/^@/, ""); return /^[a-z0-9._-]{1,40}$/i.test(s) ? s : undefined; };
const ID = /^[A-Za-z0-9_-]{1,128}$/;

export function cleanShareRef(v: unknown): ShareRef | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  if (!isShareKind(o.kind)) return null;
  const id = String(o.id ?? "");
  if (o.kind === "coupon") { const [seller, code, extra] = id.split("/"); return handle(seller) && /^[A-Z0-9_-]{2,40}$/i.test(code ?? "") && extra === undefined ? { kind: "coupon", id: `${seller.toLowerCase()}/${code.toUpperCase()}` } : null; }
  // A service is "<username>" (their 1:1 sessions) or "<username>~<n>" (the n-th line of the services on their site).
  if (o.kind === "service") { const m = /^([a-z0-9._-]{1,40})(~(\d{1,2}))?$/i.exec(id); return m ? { kind: "service", id: `${m[1].toLowerCase()}${m[2] ?? ""}` } : null; }
  return ID.test(id) ? { kind: o.kind, id } : null;
}

// ---- Builders: from the stored item to its card, or null when it isn't something the public can see.

export function journalCard(id: string, n: { slug?: string; title?: string; status?: string; featured_image?: string; videoPoster?: string; authorUsername?: string; author?: string; writerUsername?: string } | undefined): ShareCard | null {
  if (!n || n.status !== "published" || !n.slug || !n.title) return null;
  return { kind: "journal", id, title: clean(n.title, SHARE_TITLE_MAX), path: `/journals/${n.slug}`, image: safeImage(n.featured_image || n.videoPoster), creatorUsername: handle(n.authorUsername), creatorName: clean(n.author, 80) || undefined, label: SHARE_LABEL.journal };
}

export function courseCard(id: string, c: { slug?: string; title?: string; status?: string; cover?: string; ownerUsername?: string; ownerName?: string } | undefined): ShareCard | null {
  if (!c || c.status !== "published" || !c.slug || !c.title) return null;
  return { kind: "course", id, title: clean(c.title, SHARE_TITLE_MAX), path: `/academy/${c.slug}`, image: safeImage(c.cover), creatorUsername: handle(c.ownerUsername), creatorName: clean(c.ownerName, 80) || undefined, label: SHARE_LABEL.course };
}

export function certificateCard(id: string, c: { learnerName?: string; courseTitle?: string; status?: string; revokedAt?: string } | undefined, learnerUsername?: string): ShareCard | null {
  if (!c || c.status !== "valid" || c.revokedAt || !c.courseTitle) return null;
  return { kind: "certificate", id, title: clean(`${c.learnerName ? `${c.learnerName}: ` : ""}${c.courseTitle}`, SHARE_TITLE_MAX), path: `/certificates/${id}`, image: `/certificates/${id}/image.png`, creatorUsername: handle(learnerUsername), creatorName: clean(c.learnerName, 80) || undefined, label: SHARE_LABEL.certificate };
}

export function couponCard(seller: string, code: string, c: { label?: string } | null | undefined): ShareCard | null {
  if (!c || !handle(seller)) return null;
  return { kind: "coupon", id: `${seller}/${code}`, title: clean(`${c.label || code} at @${seller}'s shop`, SHARE_TITLE_MAX), path: `/coupon/${seller}/${encodeURIComponent(code)}`, image: `/api/coupons/card?seller=${encodeURIComponent(seller)}&code=${encodeURIComponent(code)}`, creatorUsername: seller, label: SHARE_LABEL.coupon };
}

// A community post, only from a channel the public can read in a community anyone can find (isPublicPost and isDiscoverable in
// lib/community.ts, worked out by the caller on the community as it is now).
export function postCard(id: string, p: { cid?: string; text?: string; image?: string; authorUsername?: string; authorName?: string } | undefined, community: { name?: string } | undefined, isPublic: boolean): ShareCard | null {
  if (!p || !p.cid || !isPublic) return null;
  const words = clean(p.text, 100);
  const title = words ? (String(p.text ?? "").trim().length > 100 ? `${words}…` : words) : `A post in ${clean(community?.name, 60) || "a community"}`;
  return { kind: "post", id, title, path: `/c/${p.cid}#post-${id}`, image: safeImage(p.image), creatorUsername: handle(p.authorUsername), creatorName: clean(p.authorName, 80) || undefined, label: SHARE_LABEL.post };
}

// ---- Shop items, services and events (owner, 1 Nov 2026: "sharing to moments and journal should include shop items, services, courses").

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

// A store item sold through #NotesApp (physical or a download), whether in stock or not. Not: items that only link out (not sellable),
// a shop an admin switched off, or a suspended seller.
export function itemCard(id: string, i: { title?: string; sellable?: boolean; priceKobo?: number; image?: string; images?: string[]; kind?: string; access?: string } | undefined, seller: { username?: string; displayName?: string; suspended?: boolean; shopHidden?: boolean } | undefined): ShareCard | null {
  if (!i || i.sellable !== true || !i.title || !seller || seller.suspended === true || seller.shopHidden === true) return null;
  const label = i.kind === "digital" ? (i.access === "view" ? "Video and PDF lessons" : "Digital download") : SHARE_LABEL.item;
  return { kind: "item", id, title: clean(i.title, SHARE_TITLE_MAX), path: `/shop/${id}`, image: safeImage(i.image || i.images?.[0]), creatorUsername: handle(seller.username), creatorName: clean(seller.displayName, 80) || undefined, label, ...(typeof i.priceKobo === "number" && i.priceKobo > 0 ? { price: naira(i.priceKobo) } : {}) };
}

// A member's 1:1 sessions (switched on in Rates & payouts): the price and length from their settings.
export function sessionCard(username: string, owner: { displayName?: string; avatar?: string; suspended?: boolean } | undefined, session: { enabled?: boolean; priceKobo?: number; minutes?: number } | undefined): ShareCard | null {
  if (!owner || owner.suspended === true || !session || session.enabled !== true || !handle(username)) return null;
  const name = clean(owner.displayName, 80) || `@${username}`;
  const price = [typeof session.priceKobo === "number" && session.priceKobo > 0 ? naira(session.priceKobo) : "", session.minutes ? `${session.minutes} min` : ""].filter(Boolean).join(" · ");
  return { kind: "service", id: username, title: clean(`Book a 1:1 session with ${name}`, SHARE_TITLE_MAX), path: `/u/${username}#book`, image: safeImage(owner.avatar), creatorUsername: username, creatorName: clean(owner.displayName, 80) || undefined, label: SHARE_LABEL.service, ...(price ? { price } : {}) };
}

// One line of the "Services and prices" section on a member's site, while that section is switched on.
export function siteServiceCard(username: string, n: number, owner: { displayName?: string; suspended?: boolean } | undefined, services: { on?: boolean; items?: { name?: string; price?: string; note?: string; minutes?: number; image?: string }[] } | undefined): ShareCard | null {
  const x = services?.items?.[n];
  if (!owner || owner.suspended === true || services?.on !== true || !x?.name || !handle(username)) return null;
  const rawPrice = clean(x.price, 40);
  const price = [rawPrice && /^\d[\d,.]*$/.test(rawPrice) ? `₦${rawPrice}` : rawPrice, x.minutes ? `${x.minutes} min` : ""].filter(Boolean).join(" · ");
  return { kind: "service", id: `${username}~${n}`, title: clean(x.name, SHARE_TITLE_MAX), path: `/s/${username}#services`, image: safeImage(x.image), creatorUsername: username, creatorName: clean(owner.displayName, 80) || undefined, label: SHARE_LABEL.service, ...(price ? { price } : {}) };
}

// A public event that hasn't been cancelled (members-only events stay inside their community).
export function eventCard(id: string, e: { title?: string; visibility?: string; cancelled?: boolean; hostUsername?: string; hostName?: string; communityName?: string; startsAt?: string } | undefined): ShareCard | null {
  if (!e || e.visibility !== "public" || e.cancelled === true || !e.title) return null;
  const when = e.startsAt && !Number.isNaN(Date.parse(e.startsAt)) ? new Date(e.startsAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "";
  return { kind: "event", id, title: clean(e.title, SHARE_TITLE_MAX), path: `/events/${id}`, creatorUsername: handle(e.hostUsername), creatorName: clean(e.communityName || e.hostName, 80) || undefined, label: when ? `Event · ${when}` : SHARE_LABEL.event };
}

// ---- What each share makes.

export const absolute = (base: string, path: string) => (/^https?:\/\//i.test(path) ? path : `${base.replace(/\/$/, "")}${path}`);
const mdText = (s: string) => s.replace(/([\\`*_[\]<>#|])/g, "\\$1");

// "Shared from @creator" (or their name when they have no handle).
export const creditLine = (c: Pick<ShareCard, "creatorUsername" | "creatorName">) =>
  c.creatorUsername ? `Shared from @${c.creatorUsername}` : c.creatorName ? `Shared from ${c.creatorName}` : "Shared on #NotesApp";

// The start of a journal draft: a quoted "shared link" block (Markdown, so the journal page and editor show it as they are), then room
// for the member's own words. The title is left for them.
export function journalDraftFromCard(card: ShareCard, base: string): { content: string; status: "draft"; from: "share"; shared: ShareRef } {
  const url = absolute(base, card.path);
  const lines = [
    `> **${card.label}: [${mdText(card.title)}](${url})**${card.price ? ` · ${mdText(card.price)}` : ""}`,
    ...(card.image ? [">", `> ![${mdText(card.title)}](${absolute(base, card.image)})`] : []),
    ">",
    `> ${creditLine(card)}${card.creatorUsername && card.creatorName ? ` (${mdText(card.creatorName)})` : ""}`,
    "",
    "",
  ];
  return { content: lines.join("\n"), status: "draft", from: "share", shared: { kind: card.kind, id: card.id } };
}

// Where the buttons go when they can't act on the spot: a visitor (after signing in) and a member's own domain both land on /share,
// on #NotesApp, which finishes the job.
export function shareHref(to: "moment" | "journal", ref: ShareRef): string {
  return `/share?to=${to}&kind=${ref.kind}&id=${encodeURIComponent(ref.id)}`;
}
export function signInHref(to: "moment" | "journal", ref: ShareRef): string {
  return `/login?next=${encodeURIComponent(shareHref(to, ref))}`;
}
