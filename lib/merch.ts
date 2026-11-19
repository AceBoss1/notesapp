// Official #NotesApp merch — sold in pre-order batches through Paystack
// (flat Nigeria delivery, manual fulfilment). Each item can carry any of
// the brand's core or seasonal logos, matching /brand's wardrobe.

export type MerchShape = "tshirt" | "cap" | "mug" | "stanley" | "mousepad" | "coffeecup" | "laptopbag";

export type MerchItem = {
  id: string;
  name: string;
  shape: MerchShape; // drawn mockup used until a real photo is supplied
  // Drop a plain product photo at /public/images/merch/<id>.webp and set
  // `photo` to "/images/merch/<id>.webp" — the logo is overlaid at `print`.
  photo?: string;
  // Where the logo sits on the mockup/photo, as % of the square image box.
  print: { left: number; top: number; size: number };
  priceKobo: number;
  sizes?: string[];
};

const TEE_SIZES = ["S", "M", "L", "XL", "XXL"];

export const MERCH_ITEMS: MerchItem[] = [
  { id: "tshirt", name: "T-Shirt", shape: "tshirt", print: { left: 35, top: 34, size: 30 }, priceKobo: 12_000_00, sizes: TEE_SIZES },
  { id: "cap", name: "Cap", shape: "cap", print: { left: 38, top: 42, size: 24 }, priceKobo: 8_000_00 },
  { id: "mug", name: "Mug", shape: "mug", print: { left: 37, top: 44, size: 26 }, priceKobo: 6_500_00 },
  { id: "stanley", name: "Stanley-Style Cup", shape: "stanley", print: { left: 39, top: 42, size: 22 }, priceKobo: 18_000_00 },
  { id: "mousepad", name: "Mouse Pad", shape: "mousepad", print: { left: 39, top: 42, size: 22 }, priceKobo: 5_000_00 },
  { id: "coffeecup", name: "Coffee Cup", shape: "coffeecup", print: { left: 38, top: 46, size: 24 }, priceKobo: 6_000_00 },
  { id: "laptopbag", name: "Laptop Bag", shape: "laptopbag", print: { left: 38, top: 42, size: 24 }, priceKobo: 25_000_00 },
];

export const getMerchItem = (id: string) => MERCH_ITEMS.find((i) => i.id === id);

// Pre-order batches: people pay now, we print after the batch closes. Set in Admin → Merch (docs/MERCH_3D.md): these are the built-in
// defaults, overwritten in place by applyMerch() when the saved settings load (lib/pricing.ts), like plan prices. Dates are Lagos time.
// opensOn: the first day to order ("" = open now until it closes).
export const MERCH_BATCH = {
  id: "batch-1",
  label: "Batch 1",
  opensOn: "",
  closesOn: "2026-11-15", // last day to order, inclusive
  deliveryNote: "Printed after the batch closes; delivered within about 3 weeks of closing.",
};
const MERCH_FEES = { deliveryKobo: 3_000_00 }; // flat delivery fee, Nigeria only
export const merchDeliveryKobo = () => MERCH_FEES.deliveryKobo;
export const MERCH_MAX_QTY = 10;

export function merchBatchOpen(now = Date.now()): boolean {
  if (MERCH_BATCH.opensOn && now < new Date(`${MERCH_BATCH.opensOn}T00:00:00+01:00`).getTime()) return false;
  return now <= new Date(`${MERCH_BATCH.closesOn}T23:59:59+01:00`).getTime();
}
// "open" (taking orders), "soon" (dates set, not open yet) or "closed" (the last batch has ended and no new one is set).
export function merchBatchState(now = Date.now()): "open" | "soon" | "closed" {
  if (merchBatchOpen(now)) return "open";
  return MERCH_BATCH.opensOn && now < new Date(`${MERCH_BATCH.opensOn}T00:00:00+01:00`).getTime() ? "soon" : "closed";
}

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

export type DeliveryAddress = { fullName: string; phone: string; street: string; city: string; state: string };

// Shared by the checkout form (friendly errors) and the server (enforcement).
export function validateAddress(a: Partial<DeliveryAddress> | undefined): string | null {
  if (!a) return "Enter a delivery address.";
  const fullName = String(a.fullName ?? "").trim();
  const phone = String(a.phone ?? "").replace(/[\s-]/g, "");
  const street = String(a.street ?? "").trim();
  const city = String(a.city ?? "").trim();
  if (fullName.length < 2 || fullName.length > 80) return "Enter the recipient's full name.";
  if (!/^(\+234|0)\d{10}$/.test(phone)) return "Enter a valid Nigerian phone number (e.g. 08012345678).";
  if (street.length < 5 || street.length > 200) return "Enter the street address.";
  if (city.length < 2 || city.length > 80) return "Enter the city or town.";
  if (!NIGERIAN_STATES.includes(String(a.state ?? ""))) return "Choose a state.";
  return null;
}

export type LogoOption = {
  id: string;
  label: string;
  image: string;
};

export const LOGO_OPTIONS: LogoOption[] = [
  { id: "core", label: "Core Mark", image: "/images/brand/notesapp-icon.webp" },
  { id: "valentines", label: "Valentine's Day", image: "/images/seasonal/valentines.webp" },
  { id: "eid-al-fitr", label: "Eid al-Fitr", image: "/images/seasonal/eid-al-fitr.webp" },
  { id: "eid-al-adha", label: "Eid al-Adha", image: "/images/seasonal/eid-al-adha.webp" },
  { id: "igbo-new-yam", label: "Igbo New Yam Festival", image: "/images/seasonal/igbo-new-yam-festival.webp" },
  { id: "eyo", label: "Lagos Eyo Festival", image: "/images/seasonal/lagos-eyo-festival.webp" },
  { id: "calabar", label: "Calabar Carnival", image: "/images/seasonal/calabar-carnival.webp" },
  { id: "argungu", label: "Argungu Fishing Festival", image: "/images/seasonal/arugungu-fishing-festival.webp" },
  { id: "christmas", label: "Christmas", image: "/images/seasonal/christmas.webp" },
];

// A pre-order as stored in merchOrders/{reference}. Written only by the server
// (payment confirmation + /api/admin/merch); the owner and admins can read it.
export type MerchOrderStatus = "preordered" | "printed" | "shipped" | "delivered" | "refunded";
export type MerchOrder = {
  reference: string;
  // Merch in 3D (v0.186.0): what was chosen. Older orders have none of these.
  product?: string; // "item:tshirt" or "design:black-drip"
  colour?: string; colourName?: string; place?: MerchPlace; backName?: string; designId?: string; pattern?: MerchPatternId; patternName?: string;
  parcelId?: string; // set at checkout (older orders get one on their first status change)
  uid: string;
  email: string;
  itemName: string;
  logoLabel: string;
  size?: string;
  quantity: number;
  amountKobo: number;
  status: MerchOrderStatus;
  batchId: string;
  createdAt: string;
  printedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  address: { fullName: string; phone: string; street: string; city: string; state: string };
  source?: "campus"; // a free campus reward (lib/campus-server.ts decideClaim): ₦0, no payment to refund
  campusClaimId?: string;
};

export const MERCH_STEPS: { status: Exclude<MerchOrderStatus, "refunded">; label: string; at: "createdAt" | "printedAt" | "shippedAt" | "deliveredAt" }[] = [
  { status: "preordered", label: "Pre-ordered", at: "createdAt" },
  { status: "printed", label: "Printed", at: "printedAt" },
  { status: "shipped", label: "Shipped", at: "shippedAt" },
  { status: "delivered", label: "Delivered", at: "deliveredAt" },
];

// ── Merch in 3D (docs/MERCH_3D.md; owner approved 19 Nov 2026) ────────────────────────────────────────────────────────────────
// Colours a blank item can come in. Admin → Merch chooses which colours each item offers; the list itself is fixed here.
export const MERCH_COLOURS = [
  { id: "black", name: "Black", hex: "#1d1b1c" },
  { id: "white", name: "White", hex: "#f4f1ec" },
  { id: "crimson", name: "Crimson", hex: "#8a0a33" },
  { id: "navy", name: "Navy", hex: "#1f2d4f" },
  { id: "sand", name: "Sand", hex: "#d8c3a0" },
  { id: "grey", name: "Grey", hex: "#8b8d90" },
] as const;
export type MerchColourId = (typeof MERCH_COLOURS)[number]["id"];
export const colourOf = (id: unknown) => MERCH_COLOURS.find((c) => c.id === id) ?? null;

// The owner's custom shirts (19 Nov 2026): printed all over, ₦10,000 each, a name on the back ₦1,500 more. The picture is the front;
// the back is drawn in the shirt's main colour (`base`), with the name in `ink`, until a back design is supplied.
export type MerchDesign = { id: string; name: string; image: string; base: string; ink: string; sleeves: string };
export const MERCH_DESIGNS: MerchDesign[] = [
  { id: "maroon-splash", name: "Maroon Splash", image: "/images/merch/designs/maroon-splash.webp", base: "#4a0a1f", ink: "#ffffff", sleeves: "#ffffff" },
  { id: "black-drip", name: "Black Drip", image: "/images/merch/designs/black-drip.webp", base: "#0b0a0b", ink: "#ffffff", sleeves: "#0b0a0b" },
  { id: "ivory-drip", name: "Ivory Drip", image: "/images/merch/designs/ivory-drip.webp", base: "#f3e6dc", ink: "#8a0a33", sleeves: "#8a0a33" },
  { id: "maroon-stripes", name: "Maroon Stripes", image: "/images/merch/designs/maroon-stripes.webp", base: "#4a0a1f", ink: "#ffffff", sleeves: "#ffffff" },
];
export const getMerchDesign = (id: unknown) => MERCH_DESIGNS.find((d) => d.id === id);

// The owner's two #NotesApp pattern backgrounds (19 Nov 2026; their Moda canvas "notesapp Merch Pattern Backgrounds"). Mugs, cups, the
// Stanley cup, the laptop bag and the mouse pad take one all over, with the logo on top; a shirt takes one on its back, with no logo
// there and the name on top if one is chosen. The tall picture is for shirt backs, the wide one for everything else.
export const MERCH_PATTERNS = [
  { id: "maroon", name: "Maroon pattern", tall: "/images/merch/patterns/maroon-tall.webp", wide: "/images/merch/patterns/maroon-wide.webp", base: "#4a0a1f", ink: "#ffffff" },
  { id: "light", name: "Light pattern", tall: "/images/merch/patterns/light-tall.webp", wide: "/images/merch/patterns/light-wide.webp", base: "#f6ece6", ink: "#6b1230" },
] as const;
export type MerchPattern = (typeof MERCH_PATTERNS)[number];
export type MerchPatternId = MerchPattern["id"];
export const patternOf = (id: unknown): MerchPattern | null => MERCH_PATTERNS.find((p) => p.id === id) ?? null;
const PATTERN_ALL_OVER: MerchShape[] = ["mug", "coffeecup", "stanley", "laptopbag", "mousepad"];
// Where a pattern goes on a product: all over, on the back (shirts), or nowhere (the cap).
export function patternWhere(p: { kind: "item"; item: MerchItem } | { kind: "design" }): "all" | "back" | null {
  if (p.kind === "design" || p.item.shape === "tshirt") return "back";
  return PATTERN_ALL_OVER.includes(p.item.shape) ? "all" : null;
}

// Where a logo can go on each item. The T-shirt: the front, small on the chest, or the front and a large one on the back (extra).
// Mugs and coffee cups: the front, or wrapped all round (extra). Everything else: the front.
export type MerchPlace = "front" | "chest" | "both" | "wrap";
export const PLACE_NAME: Record<MerchPlace, string> = { front: "Front", chest: "Chest, small", both: "Front and back", wrap: "Wrapped all round" };
export const placesFor = (shape: MerchShape): MerchPlace[] => (shape === "tshirt" ? ["front", "chest", "both"] : shape === "mug" || shape === "coffeecup" ? ["front", "wrap"] : ["front"]);
// Shirts (the T-shirt and every custom design) can have a name on the back, and come in sizes.
export const SHIRT_SIZES = TEE_SIZES;
export const NAME_MAX = 12;

// What Admin → Merch sets (a section of the pricing settings, lib/pricing.ts). Prices in kobo.
export type MerchSettings = {
  batch: { id: string; label: string; opensOn: string; closesOn: string; note: string };
  deliveryKobo: number;
  items: { id: string; priceKobo: number; on: boolean; colours: MerchColourId[] }[];
  designs: { id: string; priceKobo: number; on: boolean }[];
  extras: { backKobo: number; xxlKobo: number; wrapKobo: number; nameKobo: number; patternKobo: number };
};
const DEFAULT_COLOURS: Record<string, MerchColourId[]> = {
  tshirt: ["black", "white", "crimson", "navy", "sand"], cap: ["crimson", "black", "white"], mug: ["white", "black"], stanley: ["black", "white", "crimson"],
  mousepad: ["black", "crimson"], coffeecup: ["white", "black"], laptopbag: ["black", "navy"],
};
const ITEM_STATE: MerchSettings["items"] = MERCH_ITEMS.map((i) => ({ id: i.id, priceKobo: i.priceKobo, on: true, colours: [...(DEFAULT_COLOURS[i.id] ?? ["black"])] }));
const DESIGN_STATE: MerchSettings["designs"] = MERCH_DESIGNS.map((d) => ({ id: d.id, priceKobo: 10_000_00, on: true }));
// Extras: the back print, XXL and the mug wrap are placeholders until the owner sets them. The name on the back is the owner's ₦1,500
// (19 Nov 2026, down from ₦4,000); a pattern background costs nothing extra until the owner sets a price.
const EXTRAS: MerchSettings["extras"] = { backKobo: 2_500_00, xxlKobo: 1_000_00, wrapKobo: 1_000_00, nameKobo: 1_500_00, patternKobo: 0 };

export function currentMerch(): MerchSettings {
  return {
    batch: { id: MERCH_BATCH.id, label: MERCH_BATCH.label, opensOn: MERCH_BATCH.opensOn, closesOn: MERCH_BATCH.closesOn, note: MERCH_BATCH.deliveryNote },
    deliveryKobo: MERCH_FEES.deliveryKobo,
    items: ITEM_STATE.map((i) => ({ ...i, colours: [...i.colours] })), designs: DESIGN_STATE.map((d) => ({ ...d })), extras: { ...EXTRAS },
  };
}
export const DEFAULT_MERCH: MerchSettings = currentMerch();
// Writes saved settings into the live values everything reads (the store, checkout, the receipt, campus rewards).
export function applyMerch(c: MerchSettings): void {
  Object.assign(MERCH_BATCH, { id: c.batch.id, label: c.batch.label, opensOn: c.batch.opensOn, closesOn: c.batch.closesOn, deliveryNote: c.batch.note });
  MERCH_FEES.deliveryKobo = c.deliveryKobo;
  for (const x of c.items) { const s = ITEM_STATE.find((i) => i.id === x.id); const m = MERCH_ITEMS.find((i) => i.id === x.id); if (s) Object.assign(s, { priceKobo: x.priceKobo, on: x.on, colours: [...x.colours] }); if (m) m.priceKobo = x.priceKobo; }
  for (const x of c.designs) { const s = DESIGN_STATE.find((d) => d.id === x.id); if (s) Object.assign(s, x); }
  Object.assign(EXTRAS, c.extras);
}

export class MerchError extends Error { constructor(message: string, public status = 400) { super(message); } }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_KOBO = 1_000_000 * 100;
const koboOf = (v: unknown, what: string, min = 0) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > MAX_KOBO) throw new MerchError(`${what}: enter an amount in naira${min ? ` of at least ₦${min / 100}` : ""}, up to ₦1,000,000.`);
  return n;
};
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
// What an admin typed, checked. Items and designs not mentioned keep their defaults; unknown ones are dropped.
export function cleanMerch(input: unknown, d: MerchSettings = DEFAULT_MERCH): MerchSettings {
  const i = rec(input), b = rec(i.batch), e = rec(i.extras);
  const label = String(b.label ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  if (!id) throw new MerchError("Give the batch a name, like Batch 2.");
  const opensOn = String(b.opensOn ?? "").trim(), closesOn = String(b.closesOn ?? "").trim();
  if (opensOn && !DATE_RE.test(opensOn)) throw new MerchError("The batch's opening day isn't a date.");
  if (!DATE_RE.test(closesOn)) throw new MerchError("Choose the last day to order.");
  if (opensOn && opensOn > closesOn) throw new MerchError("The batch closes before it opens. Check the dates.");
  const items = d.items.map((def) => {
    const x = rec((Array.isArray(i.items) ? i.items : []).find((y) => rec(y).id === def.id));
    if (!Object.keys(x).length) return { ...def, colours: [...def.colours] };
    const name = MERCH_ITEMS.find((m) => m.id === def.id)!.name;
    const colours = (Array.isArray(x.colours) ? x.colours : []).filter((c): c is MerchColourId => !!colourOf(c)).filter((c, n, a) => a.indexOf(c) === n);
    if (!colours.length) throw new MerchError(`${name}: choose at least one colour.`);
    return { id: def.id, priceKobo: koboOf(x.priceKobo, `${name} price`, 100 * 100), on: x.on !== false, colours };
  });
  const designs = d.designs.map((def) => {
    const x = rec((Array.isArray(i.designs) ? i.designs : []).find((y) => rec(y).id === def.id));
    if (!Object.keys(x).length) return { ...def };
    return { id: def.id, priceKobo: koboOf(x.priceKobo, `${getMerchDesign(def.id)!.name} price`, 100 * 100), on: x.on !== false };
  });
  return {
    batch: { id, label, opensOn, closesOn, note: String(b.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || d.batch.note },
    deliveryKobo: koboOf(i.deliveryKobo, "Delivery"),
    items, designs,
    extras: { backKobo: koboOf(e.backKobo, "Front and back"), xxlKobo: koboOf(e.xxlKobo, "XXL"), wrapKobo: koboOf(e.wrapKobo, "Wrapped all round"), nameKobo: koboOf(e.nameKobo, "Name on the back"), patternKobo: koboOf(e.patternKobo ?? d.extras.patternKobo, "Pattern background") },
  };
}
export const itemSettings = (id: string) => ITEM_STATE.find((i) => i.id === id);
export const designSettings = (id: string) => DESIGN_STATE.find((d) => d.id === id);
export const merchExtras = () => ({ ...EXTRAS });

// ── A choice, and its price ───────────────────────────────────────────────────────────────────────────────────────────────────
// product: a blank item ("item:tshirt") or a custom design ("design:black-drip").
// pattern: one of the owner's two #NotesApp pattern backgrounds (19 Nov 2026), on the items that take one (patternFor).
export type MerchChoice = { product: string; colour?: string; logoId?: string; place?: MerchPlace; size?: string; name?: string; pattern?: string; quantity: number };
export type PriceLine = { label: string; kobo: number };
export type MerchQuote = { lines: PriceLine[]; eachKobo: number; quantity: number; subtotalKobo: number; deliveryKobo: number };
export type Resolved = ({ kind: "item"; item: MerchItem; colour: (typeof MERCH_COLOURS)[number]; logo: LogoOption; place: MerchPlace }
  | { kind: "design"; design: MerchDesign }) & { pattern: MerchPattern | null };
export const isShirt = (r: Resolved) => r.kind === "design" || r.item.shape === "tshirt";
export const productName = (r: Resolved) => (r.kind === "design" ? `Custom shirt: ${r.design.name}` : r.item.name);

// A printable name: capitals, numbers, spaces and . ' - only, up to 12 characters.
export function cleanBackName(v: unknown): string {
  const s = String(v ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!s) return "";
  if (s.length > NAME_MAX) throw new MerchError(`Keep the name to ${NAME_MAX} characters.`);
  if (!/^[A-Z0-9 .'-]+$/.test(s)) throw new MerchError("Use letters, numbers, spaces, full stops, apostrophes or hyphens in the name.");
  return s;
}

// Checks a choice against what is on offer now and works out its price, line by line. The store, the item page, checkout and the
// receipt all use this, so what a buyer sees is what they pay. Throws MerchError for a choice that isn't on offer.
export function quoteMerch(c: MerchChoice): { r: Resolved; quote: MerchQuote; size?: string; name: string } {
  const [kind, id] = String(c.product ?? "").split(":");
  const quantity = Number(c.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MERCH_MAX_QTY) throw new MerchError(`Choose a quantity from 1 to ${MERCH_MAX_QTY}.`);
  const ex = EXTRAS;
  let r: Resolved, base: number;
  if (kind === "design") {
    const design = getMerchDesign(id), s = designSettings(id ?? "");
    if (!design || !s?.on) throw new MerchError("That shirt isn't on offer.");
    r = { kind: "design", design, pattern: null }; base = s.priceKobo;
  } else if (kind === "item") {
    const item = getMerchItem(id ?? ""), s = itemSettings(id ?? "");
    if (!item || !s?.on) throw new MerchError("That item isn't on offer.");
    const colour = colourOf(c.colour ?? s.colours[0]);
    if (!colour || !s.colours.includes(colour.id)) throw new MerchError(`${item.name} doesn't come in that colour.`);
    const logo = LOGO_OPTIONS.find((l) => l.id === (c.logoId ?? LOGO_OPTIONS[0].id));
    if (!logo) throw new MerchError("Choose a logo.");
    const place = c.place ?? "front";
    if (!placesFor(item.shape).includes(place)) throw new MerchError(`${item.name} can't be printed there.`);
    r = { kind: "item", item, colour, logo, place, pattern: null }; base = s.priceKobo;
  } else throw new MerchError("Choose an item.");
  if (c.pattern) {
    const pat = patternOf(c.pattern), where = patternWhere(r);
    if (!pat || !where) throw new MerchError("That background isn't offered on this item.");
    // The back of a shirt with a pattern carries the pattern and the name only: no logo there.
    if (r.kind === "item" && r.place === "both") throw new MerchError("With a pattern on the back, choose Front or Chest for the logo.");
    r.pattern = pat;
  }
  const lines: PriceLine[] = [{ label: productName(r), kobo: base }];
  if (r.pattern && ex.patternKobo) lines.push({ label: `${r.pattern.name} ${patternWhere(r) === "back" ? "on the back" : "background"}`, kobo: ex.patternKobo });
  if (r.kind === "item" && r.place === "both") lines.push({ label: PLACE_NAME.both, kobo: ex.backKobo });
  if (r.kind === "item" && r.place === "wrap") lines.push({ label: PLACE_NAME.wrap, kobo: ex.wrapKobo });
  let size: string | undefined;
  if (isShirt(r)) {
    size = String(c.size ?? "");
    if (!SHIRT_SIZES.includes(size)) throw new MerchError("Choose a size.");
    if (size === "XXL" && ex.xxlKobo) lines.push({ label: "XXL", kobo: ex.xxlKobo });
  }
  const name = isShirt(r) ? cleanBackName(c.name) : "";
  if (name) lines.push({ label: `Name on the back: ${name}`, kobo: ex.nameKobo });
  const eachKobo = lines.reduce((n, l) => n + l.kobo, 0);
  return { r, size, name, quote: { lines, eachKobo, quantity, subtotalKobo: eachKobo * quantity, deliveryKobo: MERCH_FEES.deliveryKobo } };
}

// "Black · Core mark · Front and back" / "Maroon Splash · XL · Name: ADA".
export function choiceText(o: { colourName?: string; logoLabel?: string; place?: string; size?: string; backName?: string; patternName?: string }): string {
  return [o.patternName, o.colourName, o.logoLabel && `${o.logoLabel}`, o.place && o.place !== "front" ? PLACE_NAME[o.place as MerchPlace] ?? o.place : "", o.size, o.backName && `Name: ${o.backName}`].filter(Boolean).join(" · ");
}
// The print sheet's grouping: one row per identical piece.
export const printKey = (o: Pick<MerchOrder, "itemName" | "logoLabel" | "size"> & { colourName?: string; place?: string; backName?: string; patternName?: string }) =>
  [o.itemName, o.colourName ?? "", o.patternName ?? "", o.logoLabel, o.place ?? "front", o.size ?? "", o.backName ?? ""].join("|");

// What a paid order records (payments/{ref}.merch, then merchOrders/{ref}): checkout builds it from the quote, so the receipt, the
// admin list and the print sheet carry exactly what the buyer chose and the price lines they saw.
export function merchOrderInfo(q: ReturnType<typeof quoteMerch>, address: DeliveryAddress) {
  const { r, quote } = q;
  return {
    itemId: r.kind === "item" ? r.item.id : `design-${r.design.id}`, itemName: productName(r),
    logoId: r.kind === "item" ? r.logo.id : "design", logoLabel: r.kind === "item" ? r.logo.label : r.design.name,
    ...(q.size ? { size: q.size } : {}), quantity: quote.quantity, unitKobo: quote.eachKobo, deliveryKobo: quote.deliveryKobo,
    batchId: MERCH_BATCH.id, address,
    product: r.kind === "item" ? `item:${r.item.id}` : `design:${r.design.id}`,
    // A pattern all over an item replaces its colour, so no colour is recorded then.
    ...(r.kind === "item" ? { ...(r.pattern && patternWhere(r) === "all" ? {} : { colour: r.colour.id, colourName: r.colour.name }), place: r.place } : { designId: r.design.id }),
    ...(q.name ? { backName: q.name } : {}),
    ...(r.pattern ? { pattern: r.pattern.id, patternName: r.pattern.name } : {}),
    lines: quote.lines,
  };
}
