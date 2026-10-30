// Discount codes (docs/REFERRALS.md, step 1): one set of rules for #NotesApp's own offers and for every publisher's products.
// Pure: no database here, so the checkout (app/api/paystack/initialize), the "check a code" preview and the tests share it.
// A code belongs to an owner: "notesapp" for #NotesApp's products, or a publisher's uid for theirs, so a publisher's code can
// only ever take money off that publisher's own price.

// What a code can apply to. A publisher's codes cover their own products; #NotesApp's codes cover #NotesApp's.
export const PUBLISHER_TARGETS = ["store", "digital", "course", "booking"] as const;
export const NOTESAPP_TARGETS = ["boost", "nana_credit", "merch", "logistics_addon", "inventory_addon"] as const;
export type PublisherTarget = (typeof PUBLISHER_TARGETS)[number];
export type NotesAppTarget = (typeof NOTESAPP_TARGETS)[number];
export type DiscountTarget = PublisherTarget | NotesAppTarget;

export const TARGET_LABEL: Record<DiscountTarget, string> = {
  store: "Shop items (delivered)",
  digital: "Downloads",
  course: "Courses",
  booking: "Booked sessions",
  boost: "Boosts",
  nana_credit: "Nana credit",
  merch: "Merch",
  logistics_addon: "Logistics add-on",
  inventory_addon: "Inventory add-on",
};

export const NOTESAPP_OWNER = "notesapp";
export const isNotesAppTarget = (t: string): t is NotesAppTarget => (NOTESAPP_TARGETS as readonly string[]).includes(t);
export const isPublisherTarget = (t: string): t is PublisherTarget => (PUBLISHER_TARGETS as readonly string[]).includes(t);

export type DiscountCode = {
  id: string; // "<owner>_<CODE>"
  owner: string; // "notesapp" or the publisher's uid
  code: string; // as typed by buyers, upper case
  kind: "percent" | "amount";
  percent?: number; // 1–90
  amountKobo?: number; // whole naira, ₦100 or more
  targets: DiscountTarget[];
  itemIds?: string[]; // only these items or courses (empty: all of the owner's products in the targets)
  maxUses?: number | null; // in all (null: no limit)
  perBuyer: number; // uses by one member (1 by default)
  startsAt?: string | null;
  endsAt?: string | null;
  minOrderKobo?: number | null;
  firstOrderOnly?: boolean; // only a member who hasn't paid this owner before
  active: boolean;
  uses: number;
  discountGivenKobo: number; // money taken off so far
  revenueKobo: number; // what buyers paid with it so far
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

// A buyer's payment, card or wallet, never goes below this: Paystack won't charge less, and a code shouldn't make things free.
export const MIN_PAYABLE_KOBO = 100 * 100;
export const MAX_PERCENT = 90;
export const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,19}$/;

export const normalizeCode = (s: unknown): string => String(s ?? "").trim().toUpperCase().replace(/\s+/g, "");
export const codeId = (owner: string, code: string) => `${owner}_${normalizeCode(code)}`;

export class DiscountError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// What an owner sends to create or change a code, checked. Throws DiscountError with a message the owner can act on.
export type CodeInput = Pick<DiscountCode, "code" | "kind" | "percent" | "amountKobo" | "targets" | "itemIds" | "maxUses" | "perBuyer" | "startsAt" | "endsAt" | "minOrderKobo" | "firstOrderOnly" | "active">;
export function cleanCodeInput(raw: Record<string, unknown>, ownerIsNotesApp: boolean): CodeInput {
  const code = normalizeCode(raw.code);
  if (!CODE_RE.test(code)) throw new DiscountError(400, "A code is 3 to 20 letters, numbers or dashes, starting with a letter or number.");
  const kind = raw.kind === "amount" ? "amount" : raw.kind === "percent" ? "percent" : null;
  if (!kind) throw new DiscountError(400, "Choose a percentage or an amount off.");
  let percent: number | undefined, amountKobo: number | undefined;
  if (kind === "percent") {
    percent = Number(raw.percent);
    if (!Number.isInteger(percent) || percent < 1 || percent > MAX_PERCENT) throw new DiscountError(400, `A percentage is a whole number from 1 to ${MAX_PERCENT}.`);
  } else {
    amountKobo = Number(raw.amountKobo);
    if (!Number.isInteger(amountKobo) || amountKobo < 100 * 100 || amountKobo % 100 !== 0 || amountKobo > 5_000_000 * 100) throw new DiscountError(400, "An amount off is whole naira, from ₦100.");
  }
  const allowed: readonly string[] = ownerIsNotesApp ? NOTESAPP_TARGETS : PUBLISHER_TARGETS;
  const targets = Array.from(new Set(Array.isArray(raw.targets) ? raw.targets.map(String) : [])).filter((t) => allowed.includes(t)) as DiscountTarget[];
  if (!targets.length) throw new DiscountError(400, "Choose what the code works on.");
  const itemIds = Array.from(new Set(Array.isArray(raw.itemIds) ? raw.itemIds.map(String).filter((s) => /^[A-Za-z0-9_-]{1,64}$/.test(s)) : [])).slice(0, 50);
  const whole = (v: unknown, min: number, max: number, what: string): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new DiscountError(400, `${what} must be a whole number from ${min} to ${max.toLocaleString("en-NG")}.`);
    return n;
  };
  const maxUses = whole(raw.maxUses, 1, 1_000_000, "Total uses");
  const perBuyer = whole(raw.perBuyer, 1, 100, "Uses per member") ?? 1;
  const minOrderKobo = raw.minOrderKobo === null || raw.minOrderKobo === undefined || raw.minOrderKobo === "" ? null : whole(raw.minOrderKobo, 100, 10_000_000 * 100, "The minimum order (in kobo)");
  const date = (v: unknown, what: string): string | null => {
    if (v === null || v === undefined || v === "") return null;
    const t = new Date(String(v));
    if (Number.isNaN(t.getTime())) throw new DiscountError(400, `${what} isn't a date.`);
    return t.toISOString();
  };
  const startsAt = date(raw.startsAt, "The start");
  const endsAt = date(raw.endsAt, "The end");
  if (startsAt && endsAt && endsAt <= startsAt) throw new DiscountError(400, "The end must be after the start.");
  return {
    code, kind, ...(percent !== undefined ? { percent } : {}), ...(amountKobo !== undefined ? { amountKobo } : {}),
    targets, itemIds, maxUses, perBuyer, startsAt, endsAt, minOrderKobo, firstOrderOnly: raw.firstOrderOnly === true, active: raw.active !== false,
  };
}

// Everything the checkout knows about this purchase.
export type CodeUse = {
  target: DiscountTarget;
  itemId?: string; // the shop item, download or course (bookings and #NotesApp products have none)
  itemIds?: string[]; // a basket: every item in it
  subtotalKobo: number; // the price the code works on (delivery is never discounted)
  extraKobo?: number; // what's paid on top and not discounted (delivery), so the total never drops under MIN_PAYABLE_KOBO
  now: Date;
  buyerUses: number; // how many times this member has used this code
  buyerHasPaidOwner: boolean; // for firstOrderOnly
};

// How much a code takes off, or why it can't be used. The reason is shown to the buyer as it is.
export function discountFor(c: DiscountCode, u: CodeUse): { ok: true; discountKobo: number } | { ok: false; reason: string } {
  if (!c.active) return { ok: false, reason: "That code isn't active." };
  if (c.startsAt && u.now < new Date(c.startsAt)) return { ok: false, reason: "That code isn't open yet." };
  if (c.endsAt && u.now >= new Date(c.endsAt)) return { ok: false, reason: "That code has ended." };
  if (!c.targets.includes(u.target)) return { ok: false, reason: "That code doesn't work on this." };
  if (c.itemIds?.length) {
    const ids = u.itemIds ?? (u.itemId ? [u.itemId] : []);
    if (!ids.some((id) => c.itemIds!.includes(id))) return { ok: false, reason: "That code doesn't work on this item." };
  }
  if (c.maxUses != null && c.uses >= c.maxUses) return { ok: false, reason: "That code has been used up." };
  if (u.buyerUses >= (c.perBuyer || 1)) return { ok: false, reason: c.perBuyer > 1 ? `You've used that code ${c.perBuyer} times already.` : "You've already used that code." };
  if (c.firstOrderOnly && u.buyerHasPaidOwner) return { ok: false, reason: "That code is for a first order." };
  if (c.minOrderKobo && u.subtotalKobo < c.minOrderKobo) return { ok: false, reason: `That code needs an order of ${naira(c.minOrderKobo)} or more.` };
  let off = c.kind === "percent" ? Math.floor((u.subtotalKobo * (c.percent ?? 0)) / 100 / 100) * 100 : c.amountKobo ?? 0;
  // Never below the smallest payment, never more than the price itself.
  const room = u.subtotalKobo + (u.extraKobo ?? 0) - MIN_PAYABLE_KOBO;
  off = Math.max(0, Math.min(off, u.subtotalKobo, room));
  if (off <= 0) return { ok: false, reason: "This is already at the lowest price a code can take it to." };
  return { ok: true, discountKobo: off };
}

// A basket's discount spread over its lines in proportion to each line's goods (whole kobo; what's left over goes on the first).
export function spreadDiscount(goodsKobo: number[], discountKobo: number): number[] {
  const total = goodsKobo.reduce((a, b) => a + b, 0);
  if (total <= 0 || discountKobo <= 0) return goodsKobo.map(() => 0);
  const parts = goodsKobo.map((g) => Math.floor((discountKobo * g) / total));
  parts[0] += discountKobo - parts.reduce((a, b) => a + b, 0);
  return parts;
}

export const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
export const describeCode = (c: Pick<DiscountCode, "kind" | "percent" | "amountKobo">) => (c.kind === "percent" ? `${c.percent}% off` : `${naira(c.amountKobo ?? 0)} off`);
