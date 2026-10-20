// Analytics for members (docs/SITES.md, phase 1): what they earned, their orders and customers, their best sellers and stock, bookings,
// and visits. Pure: lib/analytics-server.ts reads the data, this adds it up, the page draws it. Money is in kobo.
//
// Who sees what (owner's decision, 20 Oct 2026): everyone the last 7 days; Pro also 30 and 90 days, the Customers tab and the download;
// Business and Enterprise also visits by page and where visitors came from.

export type Tier = "standard" | "basic" | "pro" | "business" | "enterprise";
export const RANGE_DAYS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];
const PRO_UP = ["pro", "business", "enterprise"];
const BUSINESS_UP = ["business", "enterprise"];
export const rangesFor = (tier: string): RangeDays[] => (PRO_UP.includes(tier) ? [...RANGE_DAYS] : [7]);
export const canSeeCustomers = (tier: string) => PRO_UP.includes(tier);
export const canDownload = (tier: string) => PRO_UP.includes(tier);
export const canSeeVisitDetail = (tier: string) => BUSINESS_UP.includes(tier);
export const isRange = (n: unknown): n is RangeDays => RANGE_DAYS.includes(Number(n) as RangeDays);

// A physical item with this many left (or fewer), still on sale, is "running low".
export const LOW_STOCK = 3;

// ── Where a visitor came from ──
export const SOURCES = ["direct", "inside", "search", "whatsapp", "facebook", "instagram", "x", "linkedin", "tiktok", "youtube", "other"] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABEL: Record<Source, string> = {
  direct: "Direct or a saved link", inside: "Inside #NotesApp or your site", search: "Search engines", whatsapp: "WhatsApp", facebook: "Facebook",
  instagram: "Instagram", x: "X (Twitter)", linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube", other: "Other websites",
};
const BY_HOST: [RegExp, Source][] = [
  [/(^|\.)(google|bing|duckduckgo|yahoo|yandex|ecosia|brave)\./, "search"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, "x"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
];
const UTM: Record<string, Source> = { google: "search", bing: "search", whatsapp: "whatsapp", wa: "whatsapp", facebook: "facebook", fb: "facebook", instagram: "instagram", ig: "instagram", x: "x", twitter: "x", linkedin: "linkedin", tiktok: "tiktok", youtube: "youtube" };
// `ref` is the referring site's host name (the browser's document.referrer), `utm` a ?utm_source= tag, `ownHosts` our own addresses and the
// member's domain: a visit from there is someone moving around inside.
export function sourceOf(ref: unknown, utm: unknown, ownHosts: string[]): Source {
  const tag = String(utm ?? "").trim().toLowerCase();
  if (tag && UTM[tag]) return UTM[tag];
  const host = String(ref ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (!host) return "direct";
  if (!/^[a-z0-9.-]{1,253}$/.test(host)) return "other";
  if (ownHosts.some((h) => host === h || host.endsWith(`.${h}`))) return "inside";
  for (const [re, s] of BY_HOST) if (re.test(host)) return s;
  return "other";
}

// ── Inputs (as lib/analytics-server.ts reads them) ──
export type LedgerRow = { id: string; kind: string; grossKobo: number; netKobo: number; status: string; createdAt: string };
export type OrderRow = {
  id: string; itemId: string; itemTitle: string; quantity: number; unitKobo: number; deliveryKobo: number; amountKobo: number; status: string;
  paidAt: string; buyerUid: string; buyerEmail: string; name: string; phone: string; city: string; state: string;
};
export type CheckoutRow = { status: string; createdAt: string }; // store checkouts started (payments), paid or not
export type ItemRow = { id: string; title: string; kind: string; stock: number; sellable: boolean; views: number; priceKobo: number };
export type BookingRow = { status: string; amountKobo: number; createdAt: string; startsAt: string };
export type VisitDay = { day: string; count: number; pages: Record<string, number>; src: Record<string, number> };
export type PromoRow = { id: string; type: "boost" | "advert"; label: string; spentKobo: number; impressions: number; clicks: number; status: string };
export type Inputs = { ledger: LedgerRow[]; orders: OrderRow[]; checkouts: CheckoutRow[]; items: ItemRow[]; bookings: BookingRow[]; visits: VisitDay[]; promos: PromoRow[] };

export type Totals = { earnedKobo: number; salesKobo: number; ordersPaid: number; checkouts: number; avgOrderKobo: number; bookings: number; visits: number; refundedKobo: number };
export type Customer = { key: string; name: string; email: string; phone: string; place: string; orders: number; spentKobo: number; lastAt: string };
export type Report = {
  days: RangeDays; from: string; to: string; // the days counted, YYYY-MM-DD, inclusive
  totals: Totals; before: Totals; // this period and the one just before it, for the change
  series: { day: string; earnedKobo: number; orders: number; visits: number }[];
  byKind: { kind: string; netKobo: number }[];
  bestSellers: { itemId: string; title: string; sold: number; salesKobo: number }[];
  lowStock: { itemId: string; title: string; stock: number }[];
  items: { itemId: string; title: string; views: number; sold: number; salesKobo: number; stock: number; kind: string }[];
  orders: OrderRow[]; // this period, newest first
  customers: Customer[] | null; // Pro and above
  pages: { key: string; label: string; visits: number }[] | null; // Business and above ("note:<id>", "item:<id>", "profile:<username>", "course:<id>")
  sources: { source: Source; visits: number }[] | null; // Business and above
  promos: PromoRow[];
};

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
export function dayList(to: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(dayKey(new Date(to.getTime() - i * 86_400_000)));
  return out;
}
const inDays = (iso: string, from: string, to: string) => { const d = String(iso ?? "").slice(0, 10); return d >= from && d <= to; };
const PAID_ORDER = new Set(["paid", "dispatched", "delivered", "confirmed", "disputed"]);
const BOOKED = new Set(["confirmed", "cancelling"]);

function totalsFor(x: Inputs, from: string, to: string): Totals {
  const ledger = x.ledger.filter((l) => inDays(l.createdAt, from, to));
  const orders = x.orders.filter((o) => inDays(o.paidAt, from, to));
  const paid = orders.filter((o) => PAID_ORDER.has(o.status));
  const salesKobo = paid.reduce((s, o) => s + o.amountKobo, 0);
  return {
    earnedKobo: ledger.filter((l) => l.status !== "refunded").reduce((s, l) => s + l.netKobo, 0),
    salesKobo,
    ordersPaid: paid.length,
    checkouts: x.checkouts.filter((c) => inDays(c.createdAt, from, to)).length,
    avgOrderKobo: paid.length ? Math.round(salesKobo / paid.length / 100) * 100 : 0, // to the naira
    bookings: x.bookings.filter((b) => inDays(b.createdAt, from, to) && BOOKED.has(b.status)).length,
    visits: x.visits.filter((v) => v.day >= from && v.day <= to).reduce((s, v) => s + v.count, 0),
    refundedKobo: ledger.filter((l) => l.status === "refunded").reduce((s, l) => s + l.grossKobo, 0),
  };
}

// "+12%", "−3%", or "" when there's nothing to compare with.
export function change(now: number, before: number): string {
  if (!before) return "";
  const p = Math.round(((now - before) / before) * 100);
  return `${p >= 0 ? "+" : "−"}${Math.abs(p)}%`;
}

// Customers from every paid order (not just this period), most valuable first. A buyer is their account, or their email when there isn't one.
export function customersOf(orders: OrderRow[]): Customer[] {
  const by = new Map<string, Customer>();
  for (const o of orders) {
    if (!PAID_ORDER.has(o.status)) continue;
    const key = o.buyerUid || o.buyerEmail.toLowerCase();
    if (!key) continue;
    const c = by.get(key) ?? { key, name: o.name, email: o.buyerEmail, phone: o.phone, place: [o.city, o.state].filter(Boolean).join(", "), orders: 0, spentKobo: 0, lastAt: "" };
    c.orders += 1; c.spentKobo += o.amountKobo;
    if (o.paidAt > c.lastAt) { c.lastAt = o.paidAt; c.name = o.name || c.name; c.phone = o.phone || c.phone; c.place = [o.city, o.state].filter(Boolean).join(", ") || c.place; }
    by.set(key, c);
  }
  return [...by.values()].sort((a, b) => b.spentKobo - a.spentKobo || b.lastAt.localeCompare(a.lastAt));
}

export function buildReport(x: Inputs, opts: { days: RangeDays; tier: string; now: Date }): Report {
  const list = dayList(opts.now, opts.days);
  const from = list[0], to = list[list.length - 1];
  const prev = dayList(new Date(Date.parse(`${from}T12:00:00Z`) - 86_400_000), opts.days);
  const orders = x.orders.filter((o) => inDays(o.paidAt, from, to));
  const paid = orders.filter((o) => PAID_ORDER.has(o.status));
  const series = list.map((day) => ({
    day,
    earnedKobo: x.ledger.filter((l) => l.status !== "refunded" && l.createdAt.slice(0, 10) === day).reduce((s, l) => s + l.netKobo, 0),
    orders: paid.filter((o) => o.paidAt.slice(0, 10) === day).length,
    visits: x.visits.find((v) => v.day === day)?.count ?? 0,
  }));
  const kinds = new Map<string, number>();
  for (const l of x.ledger) if (inDays(l.createdAt, from, to) && l.status !== "refunded") kinds.set(l.kind, (kinds.get(l.kind) ?? 0) + l.netKobo);
  const sold = new Map<string, { title: string; sold: number; salesKobo: number }>();
  for (const o of paid) {
    const s = sold.get(o.itemId) ?? { title: o.itemTitle, sold: 0, salesKobo: 0 };
    s.sold += o.quantity; s.salesKobo += o.unitKobo * o.quantity;
    sold.set(o.itemId, s);
  }
  const visitIn = x.visits.filter((v) => v.day >= from && v.day <= to);
  const sum = (pick: (v: VisitDay) => Record<string, number>) => {
    const m = new Map<string, number>();
    for (const v of visitIn) for (const [k, n] of Object.entries(pick(v) ?? {})) m.set(k, (m.get(k) ?? 0) + (Number(n) || 0));
    return m;
  };
  const detail = canSeeVisitDetail(opts.tier);
  return {
    days: opts.days, from, to,
    totals: totalsFor(x, from, to), before: totalsFor(x, prev[0], prev[prev.length - 1]),
    series,
    byKind: [...kinds].map(([kind, netKobo]) => ({ kind, netKobo })).sort((a, b) => b.netKobo - a.netKobo),
    bestSellers: [...sold].map(([itemId, s]) => ({ itemId, ...s })).sort((a, b) => b.sold - a.sold || b.salesKobo - a.salesKobo).slice(0, 5),
    lowStock: x.items.filter((i) => i.kind !== "digital" && i.sellable && i.stock <= LOW_STOCK).map((i) => ({ itemId: i.id, title: i.title, stock: i.stock })).sort((a, b) => a.stock - b.stock),
    items: x.items.map((i) => ({ itemId: i.id, title: i.title, views: i.views, sold: sold.get(i.id)?.sold ?? 0, salesKobo: sold.get(i.id)?.salesKobo ?? 0, stock: i.stock, kind: i.kind }))
      .sort((a, b) => b.salesKobo - a.salesKobo || b.views - a.views),
    orders: [...orders].sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    customers: canSeeCustomers(opts.tier) ? customersOf(x.orders) : null,
    pages: detail ? [...sum((v) => v.pages)].map(([key, visits]) => ({ key, label: key, visits })).sort((a, b) => b.visits - a.visits).slice(0, 50) : null,
    sources: detail ? [...sum((v) => v.src)].filter(([k]) => (SOURCES as readonly string[]).includes(k)).map(([source, visits]) => ({ source: source as Source, visits })).sort((a, b) => b.visits - a.visits) : null,
    promos: x.promos,
  };
}

// The sales download (Pro and above): one line per order in the period.
export function salesCsv(r: Report): string {
  // Text a spreadsheet would run as a formula (a name starting with = + - @) is made plain with a leading apostrophe.
  const esc = (v: string | number) => { let s = String(v); if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const naira = (k: number) => (k / 100).toFixed(2);
  const head = ["Paid on", "Reference", "Item", "Quantity", "Item total (NGN)", "Delivery (NGN)", "Paid (NGN)", "Status", "Customer", "Email", "Phone", "City", "State"];
  const rows = r.orders.map((o) => [o.paidAt.slice(0, 16).replace("T", " "), o.id, o.itemTitle, o.quantity, naira(o.unitKobo * o.quantity), naira(o.deliveryKobo), naira(o.amountKobo), o.status, o.name, o.buyerEmail, o.phone, o.city, o.state]);
  return [head, ...rows].map((row) => row.map(esc).join(",")).join("\n");
}
