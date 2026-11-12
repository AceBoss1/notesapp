// The Hotel kit (docs/HOTEL_KIT.md; owner, 12 Nov 2026): a hotel's website, rooms and bookings with holds, menus and orders from every
// department, payment online or at the counter, a live staff board, a kitchen screen, tills with cash-up, the room bill, Nana ordering,
// and the add-ons. Pure and client-safe: the rules, the shapes and the sums. The server side is lib/hotel-server.ts (everything but money),
// lib/hotel-pay-server.ts (every payment), lib/hotel-nana-server.ts (Nana ordering) and lib/hotel-pos-server.ts (card machines, WhatsApp).
//
// Tiers ride on the plans we already sell (no new subscription): Starter = Pro, Standard = Business, Grand = Enterprise. The add-on prices,
// the department and branch limits, the hold time and the late time are Admin settings (lib/pricing.ts hotel), passed in here.

export type HotelTier = "starter" | "standard" | "grand";
export const TIER_INFO: Record<HotelTier, { name: string; emoji: string; plan: string }> = {
  starter: { name: "Hotel Starter", emoji: "🛎", plan: "pro" },
  standard: { name: "Hotel Standard", emoji: "🏨", plan: "business" },
  grand: { name: "Hotel Grand", emoji: "🏰", plan: "enterprise" },
};
export function hotelTierOf(plan: string): HotelTier | null {
  return plan === "enterprise" ? "grand" : plan === "business" ? "standard" : plan === "pro" ? "starter" : null;
}
const RANK: Record<HotelTier, number> = { starter: 1, standard: 2, grand: 3 };
// What each part needs. Starter has the site, rooms, booking, one department's menu and orders, online payment, bells and books.
export const FEATURE_TIER = {
  departments: "standard", board: "standard", kitchen: "standard", tills: "standard", inventory: "standard", roomBill: "standard", staffRoles: "standard",
  branches: "grand", nana: "grand", conversations: "grand", reports: "grand",
} as const satisfies Record<string, HotelTier>;
export type Feature = keyof typeof FEATURE_TIER;
export const hasFeature = (tier: HotelTier | null, f: Feature) => !!tier && RANK[tier] >= RANK[FEATURE_TIER[f]];
export const departmentLimit = (tier: HotelTier | null, max: number) => (!tier ? 0 : hasFeature(tier, "departments") ? Math.max(2, max) : 1);
export const branchLimit = (tier: HotelTier | null, max: number) => (hasFeature(tier, "branches") ? Math.max(1, max) : 1);

// ---- Add-ons (any tier, monthly) ----
export const ADDONS = [
  { id: "whatsapp", name: "WhatsApp ordering", emoji: "💬", blurb: "Nana takes orders and bookings on the hotel's own WhatsApp Business number.", priceKey: "whatsappMonthlyKobo" },
  { id: "account", name: "Account number per order", emoji: "🏦", blurb: "Each order or booking gets its own bank account number, and turns paid by itself when the money lands.", priceKey: "accountMonthlyKobo" },
  { id: "cardMachine", name: "Card-machine link", emoji: "💳", blurb: "A till sends the exact amount to the counter's Moniepoint machine, and the sale settles from the machine's answer.", priceKey: "cardMachineMonthlyKobo" },
  { id: "housekeeping", name: "Housekeeping", emoji: "🧹", blurb: "Rooms dirty, cleaning or ready; maintenance jobs; lost and found.", priceKey: "housekeepingMonthlyKobo" },
] as const;
export type AddonId = (typeof ADDONS)[number]["id"];
export const isAddon = (v: unknown): v is AddonId => ADDONS.some((a) => a.id === v);
export const addonOn = (addons: Partial<Record<AddonId, string>> | undefined, id: AddonId, now: Date) => !!addons?.[id] && Date.parse(addons[id]!) > now.getTime();
// A paid month runs on from what's left, so paying early loses nothing.
export const addonUntil = (current: string | undefined, now: Date) => new Date(Math.max(now.getTime(), current ? Date.parse(current) || 0 : 0) + 31 * 86_400_000).toISOString();

// ---- Departments ----
export const DEPT_KINDS = [
  { id: "restaurant", label: "Restaurant", emoji: "🍽" }, { id: "grill", label: "Grill", emoji: "🔥" }, { id: "bakery", label: "Bakery", emoji: "🥐" },
  { id: "bar", label: "Bar", emoji: "🍸" }, { id: "lounge", label: "Lounge", emoji: "🍹" }, { id: "kitchen", label: "Kitchen", emoji: "🍳" },
  { id: "front_desk", label: "Front desk", emoji: "🛎" }, { id: "other", label: "Other", emoji: "🏷" },
] as const;
export type DeptKind = (typeof DEPT_KINDS)[number]["id"];
export type Department = { id: string; name: string; kind: DeptKind; prefix: string; open: boolean };
export const deptEmoji = (k: string) => DEPT_KINDS.find((d) => d.id === k)?.emoji ?? "🏷";

// ---- Staff roles (Standard and up; Starter has only the owner) ----
export const STAFF_ROLES = [
  { id: "manager", label: "Manager", blurb: "Everything at this hotel, except money settings and add-ons." },
  { id: "front_desk", label: "Front desk", blurb: "Bookings, check-in and check-out, the room bill and every order." },
  { id: "department", label: "Department", blurb: "Their department's orders: the staff board and the kitchen screen." },
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number]["id"];
export const isStaffRole = (v: unknown): v is StaffRole => STAFF_ROLES.some((r) => r.id === v);
export type StaffEntry = { role: StaffRole; depts: string[]; name: string };
export type HotelRole = "owner" | StaffRole;
// What a role may do. Money settings, add-ons and staff are the owner's.
export const ROLE_CAN = {
  settings: ["owner", "manager"], money: ["owner"], bookings: ["owner", "manager", "front_desk"], orders: ["owner", "manager", "front_desk", "department"],
  tills: ["owner", "manager"], stays: ["owner", "manager", "front_desk"], housekeeping: ["owner", "manager", "front_desk"], reports: ["owner", "manager"], chats: ["owner", "manager"],
} as const satisfies Record<string, HotelRole[]>;
export type Permission = keyof typeof ROLE_CAN;
export const roleCan = (role: HotelRole | null, p: Permission) => !!role && (ROLE_CAN[p] as readonly string[]).includes(role);
// A department role sees only its own departments; everyone else sees every department.
export const seesDept = (role: HotelRole | null, staff: StaffEntry | undefined, deptId: string) => !!role && (role !== "department" || !!staff?.depts.includes(deptId));

// ---- Cleaning what people send ----
export const t = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export const para = (v: unknown, max: number) => String(v ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
export const img = (v: unknown) => { const s = t(v, 600); return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : ""; };
export const MAX_KOBO = 100_000_000 * 100; // ₦100 million: a typo guard on any one price
export const cleanKobo = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= MAX_KOBO ? n : -1; };
export const cleanPhone = (v: unknown) => t(v, 30).replace(/[^\d+]/g, "").slice(0, 16);
export const cleanEmail = (v: unknown) => { const e = t(v, 160).toLowerCase(); return /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/.test(e) ? e : ""; };
export const slug = (v: unknown, max = 24) => t(v, 60).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max);
export const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
export const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const prefixOf = (name: string) => (name.replace(/[^A-Za-z]/g, "").charAt(0) || "O").toUpperCase();

export type Policy = { checkIn: string; checkOut: string; cancellation: string; payAtDesk: boolean; lateMinutes: number | null };
export type HotelDoc = {
  ownerUid: string; name: string; branch: string; city: string; address: string; phone: string; about: string;
  departments: Department[]; policy: Policy; staff: Record<string, StaffEntry>;
  addons?: Partial<Record<AddonId, string>>; whatsappNumberId?: string; orderSeq?: number; createdAt?: string; updatedAt?: string;
};
export function cleanPolicy(v: unknown): Policy {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const late = Math.floor(Number(o.lateMinutes));
  return {
    checkIn: isTime(o.checkIn) ? o.checkIn : "14:00", checkOut: isTime(o.checkOut) ? o.checkOut : "12:00",
    cancellation: para(o.cancellation, 600) || "Free cancellation up to 24 hours before check-in. After that, the first night is kept.",
    payAtDesk: o.payAtDesk === true, lateMinutes: late >= 5 && late <= 240 ? late : null,
  };
}
export function cleanDept(v: unknown, taken: string[] = []): Department | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const name = t(o.name, 40);
  if (!name) return null;
  const kind = DEPT_KINDS.some((k) => k.id === o.kind) ? (o.kind as DeptKind) : "restaurant";
  let id = slug(o.id || name, 20) || "dept";
  if (!o.id) { const base = id; let n = 2; while (taken.includes(id)) id = `${base}-${n++}`; }
  return { id, name, kind, prefix: t(o.prefix, 2).toUpperCase().replace(/[^A-Z]/g, "") || prefixOf(name), open: o.open !== false };
}

// ---- Rooms ----
export type Room = { id?: string; hotelId: string; name: string; blurb: string; priceKobo: number; units: string[]; image: string; order: number; on: boolean; unitStatus?: Record<string, UnitStatus> };
export const UNIT_STATUSES = [{ id: "ready", label: "Ready" }, { id: "dirty", label: "Dirty" }, { id: "cleaning", label: "Cleaning" }, { id: "maintenance", label: "Maintenance" }] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number]["id"];
export const isUnitStatus = (v: unknown): v is UnitStatus => UNIT_STATUSES.some((s) => s.id === v);
// Room numbers ("201, 202, 203"), or a count ("3") when the hotel doesn't number them.
export function cleanUnits(v: unknown): string[] {
  if (typeof v === "number" || (typeof v === "string" && /^\s*\d{1,3}\s*$/.test(v) && Number(v) <= 200)) {
    const n = Math.min(200, Math.max(0, Math.floor(Number(v))));
    return Array.from({ length: n }, (_, i) => String(i + 1));
  }
  const list = (Array.isArray(v) ? v : String(v ?? "").split(/[,;\n]/)).map((x) => t(x, 12).replace(/[^\w\- ]/g, "")).filter(Boolean);
  return [...new Set(list)].slice(0, 200);
}
export function cleanRoom(v: unknown, hotelId: string): Room | string {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const name = t(o.name, 60);
  if (!name) return "Give the room type a name, like Deluxe double.";
  const priceKobo = cleanKobo(o.priceKobo);
  if (priceKobo <= 0) return "Enter the price for one night.";
  const units = cleanUnits(o.units);
  if (!units.length) return "Enter the room numbers, or how many rooms of this type there are.";
  return { hotelId, name, blurb: t(o.blurb, 160), priceKobo, units, image: img(o.image), order: Math.max(0, Math.min(999, Math.floor(Number(o.order) || 0))), on: o.on !== false };
}

// ---- Menus ----
export type MenuItem = { id?: string; hotelId: string; deptId: string; name: string; note: string; priceKobo: number; group: string; image: string; soldOut: boolean; stockItemId: string; order: number };
export function cleanMenuItem(v: unknown, hotelId: string, depts: string[]): MenuItem | string {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const name = t(o.name, 60);
  if (!name) return "Give the dish or drink a name.";
  if (!depts.includes(String(o.deptId))) return "Choose which department sells it.";
  const priceKobo = cleanKobo(o.priceKobo);
  if (priceKobo <= 0) return "Enter its price.";
  const stockItemId = t(o.stockItemId, 60).replace(/[^\w-]/g, "");
  return { hotelId, deptId: String(o.deptId), name, note: t(o.note, 120), priceKobo, group: t(o.group, 30), image: img(o.image), soldOut: o.soldOut === true, stockItemId, order: Math.max(0, Math.min(999, Math.floor(Number(o.order) || 0))) };
}

// ---- Dates and availability ----
const DAY = 86_400_000;
export const nightsBetween = (from: string, to: string) => (isDay(from) && isDay(to) ? Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) : 0);
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const MAX_NIGHTS = 60;
export const MAX_AHEAD_DAYS = 400;
// Today in Lagos (UTC+1, no daylight saving).
export const lagosToday = (now: Date) => new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);
export function checkDates(checkIn: unknown, checkOut: unknown, now: Date): { ok: true; nights: number } | { ok: false; error: string } {
  if (!isDay(checkIn) || !isDay(checkOut)) return { ok: false, error: "Choose your check-in and check-out dates." };
  const today = lagosToday(now);
  if (checkIn < today) return { ok: false, error: "Check-in can't be in the past." };
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) return { ok: false, error: "Check-out must be after check-in." };
  if (nights > MAX_NIGHTS) return { ok: false, error: "For a stay that long, contact the hotel." };
  if (nightsBetween(today, checkIn) > MAX_AHEAD_DAYS) return { ok: false, error: "That's too far ahead to book online." };
  return { ok: true, nights };
}

export type BookingStatus = "held" | "confirmed" | "checked_in" | "checked_out" | "expired" | "cancelled";
export type PayMethod = "online" | "transfer" | "desk";
export type LateMoney = { amountKobo: number; provider: string; ref: string; at: string; state: "open" | "rebooked" | "refunded" | "refund_requested" };
export type Booking = {
  id?: string; hotelId: string; ownerUid: string; roomId: string; roomName: string; checkIn: string; checkOut: string; nights: number; guests: number;
  guestName: string; email: string; phone: string; unitPriceKobo: number; totalKobo: number; status: BookingStatus; payMethod: PayMethod;
  holdUntil: string; code: string; createdAt: string; paidAt?: string; paidVia?: string; paymentRef?: string; unit?: string; stayId?: string; late?: LateMoney; uid?: string;
};
// A booking keeps its room while it is confirmed or checked in, or held and its hold hasn't run out. An expired hold frees the room at
// once, before the sweep marks it expired.
export const holdsRoom = (b: Pick<Booking, "status" | "holdUntil">, now: Date) =>
  b.status === "confirmed" || b.status === "checked_in" || (b.status === "held" && Date.parse(b.holdUntil) > now.getTime());
const overlaps = (aIn: string, aOut: string, bIn: string, bOut: string) => aIn < bOut && bIn < aOut;
// Rooms of a type still free for every night of [checkIn, checkOut): the busiest night decides.
export function roomsLeft(units: number, bookings: Pick<Booking, "status" | "holdUntil" | "checkIn" | "checkOut">[], checkIn: string, checkOut: string, now: Date): number {
  const live = bookings.filter((b) => holdsRoom(b, now) && overlaps(b.checkIn, b.checkOut, checkIn, checkOut));
  let worst = 0;
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) worst = Math.max(worst, live.filter((b) => b.checkIn <= d && d < b.checkOut).length);
  return Math.max(0, units - worst);
}
export const holdUntil = (now: Date, minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();
// Whether a free cancellation still applies: up to 24 hours before check-in (the hotel's policy words say what happens after).
export const freeCancel = (checkIn: string, checkInTime: string, now: Date) => Date.parse(`${checkIn}T${checkInTime}:00+01:00`) - now.getTime() >= DAY;

// ---- Orders ----
// pending → awaiting_payment → paid → preparing → ready → completed, or cancelled before payment. A checked-in guest's order on the room
// bill is on_bill (preparing next), and is settled with the bill at checkout. Only a payment sets paid: never the status API.
export const ORDER_STATUSES = ["pending", "awaiting_payment", "paid", "on_bill", "preparing", "ready", "completed", "cancelled", "expired"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "New", awaiting_payment: "Waiting for payment", paid: "Paid", on_bill: "On the room bill", preparing: "Cooking", ready: "Ready", completed: "Done", cancelled: "Cancelled", expired: "Expired",
};
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ["awaiting_payment", "cancelled"], awaiting_payment: ["cancelled"], paid: ["preparing", "ready", "completed"], on_bill: ["preparing", "ready", "completed"],
  preparing: ["ready"], ready: ["completed"], completed: [], cancelled: [], expired: [],
};
// What staff may move an order to. "paid" is never in the list: only lib/hotel-pay-server.ts sets it, from a verified payment.
export const canMove = (from: OrderStatus, to: unknown): to is OrderStatus => typeof to === "string" && to !== "paid" && (NEXT[from] ?? []).includes(to as OrderStatus);
export const KITCHEN_STATUSES: OrderStatus[] = ["paid", "on_bill", "preparing"];
export const BOARD_STATUSES: OrderStatus[] = ["paid", "on_bill", "preparing", "ready"];
export type TargetKind = "room" | "table" | "pickup";
export type Target = { kind: TargetKind; value: string };
export const TARGETS: { id: TargetKind; label: string; emoji: string }[] = [{ id: "room", label: "To my room", emoji: "🛏" }, { id: "table", label: "Table", emoji: "🪑" }, { id: "pickup", label: "Pick up", emoji: "🥡" }];
export function cleanTarget(v: unknown): Target | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  if (o.kind === "pickup") return { kind: "pickup", value: t(o.value, 40) };
  if (o.kind === "room" || o.kind === "table") { const value = t(o.value, 12).replace(/[^\w\- ]/g, ""); return value ? { kind: o.kind, value } : null; }
  return null;
}
export const targetText = (x: Target) => (x.kind === "room" ? `Room ${x.value}` : x.kind === "table" ? `Table ${x.value}` : "Pick-up");
export type OrderLine = { itemId: string; name: string; qty: number; unitKobo: number; stockItemId?: string };
export const MAX_ORDER_LINES = 30;
export const MAX_QTY = 50;
// The order's lines, priced from the menu (never from what the guest or the AI sent). Sold-out items and other departments' are refused.
export function priceLines(raw: unknown, menu: MenuItem[], deptId: string): { ok: true; lines: OrderLine[]; totalKobo: number } | { ok: false; error: string } {
  const want = (Array.isArray(raw) ? raw : []).slice(0, MAX_ORDER_LINES * 2);
  const merged = new Map<string, number>();
  for (const w of want) {
    const o = (w && typeof w === "object" ? w : {}) as Record<string, unknown>;
    const id = String(o.itemId ?? o.id ?? ""), qty = Math.floor(Number(o.qty ?? o.quantity));
    if (!id || !(qty > 0)) continue;
    merged.set(id, Math.min(MAX_QTY, (merged.get(id) ?? 0) + qty));
  }
  if (!merged.size) return { ok: false, error: "Choose at least one thing to order." };
  if (merged.size > MAX_ORDER_LINES) return { ok: false, error: "That's too many different things for one order." };
  const lines: OrderLine[] = [];
  for (const [id, qty] of merged) {
    const m = menu.find((x) => x.id === id);
    if (!m || m.deptId !== deptId) return { ok: false, error: "Something in your order isn't on this menu." };
    if (m.soldOut) return { ok: false, error: `${m.name} is sold out today.` };
    lines.push({ itemId: id, name: m.name, qty, unitKobo: m.priceKobo, ...(m.stockItemId ? { stockItemId: m.stockItemId } : {}) });
  }
  return { ok: true, lines, totalKobo: lines.reduce((n, l) => n + l.qty * l.unitKobo, 0) };
}
export type Order = {
  id?: string; hotelId: string; ownerUid: string; deptId: string; deptName: string; number: string; target: Target; lines: OrderLine[]; totalKobo: number;
  status: OrderStatus; payMethod: "online" | "transfer" | "room_bill" | "desk" | "till_cash" | "till_card" | "machine"; holdUntil?: string;
  guestName: string; phone: string; email: string; note: string; source: "site" | "nana" | "whatsapp" | "till" | "staff"; code: string;
  createdAt: string; paidAt?: string; paidVia?: string; paymentRef?: string; stayId?: string; tillId?: string; by?: string; machineRef?: string;
  billSettledAt?: string; readyAt?: string; doneAt?: string; late?: LateMoney; stockMovedAt?: string; chatId?: string;
};
export const orderNumber = (prefix: string, seq: number) => `#${prefix}-${100 + seq}`;
export const minutesSince = (iso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
// When a kitchen order started waiting: when it was paid or put on the bill.
export const waitingSince = (o: Pick<Order, "paidAt" | "createdAt">) => o.paidAt || o.createdAt;
export const isLate = (o: Pick<Order, "status" | "paidAt" | "createdAt">, lateMinutes: number, now: Date) => KITCHEN_STATUSES.includes(o.status) && minutesSince(waitingSince(o), now) > lateMinutes;
// What the kitchen screen says out loud for a new order ("New order, table four").
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
export const spoken = (x: Target) => (x.kind === "pickup" ? "New order, for pick-up" : `New order, ${x.kind} ${/^\d+$/.test(x.value) && Number(x.value) <= 12 ? WORDS[Number(x.value)] : x.value}`);

// ---- The room bill and stays ----
export type Stay = { id?: string; hotelId: string; ownerUid: string; bookingId: string; roomId: string; roomName: string; unit: string; guestName: string; code: string; open: boolean; checkedInAt: string; checkedOutAt?: string; roomDueKobo: number; settledKobo?: number; settledVia?: string; by?: string };
// What a guest owes at checkout: the room if it wasn't paid ahead, plus every order on the bill not yet settled.
export const billOwed = (roomDueKobo: number, orders: Pick<Order, "status" | "totalKobo" | "payMethod" | "billSettledAt">[]) =>
  roomDueKobo + orders.filter((o) => o.payMethod === "room_bill" && !o.billSettledAt && o.status !== "cancelled").reduce((n, o) => n + o.totalKobo, 0);

// ---- Tills and cash-up ----
export const COUNTER_METHODS = [{ id: "cash", label: "Cash" }, { id: "pos", label: "Card (machine)" }, { id: "transfer", label: "Transfer seen" }] as const;
export type CounterMethod = (typeof COUNTER_METHODS)[number]["id"];
export const isCounterMethod = (v: unknown): v is CounterMethod => COUNTER_METHODS.some((m) => m.id === v);
export const isPin = (v: unknown): v is string => typeof v === "string" && /^\d{4,6}$/.test(v);
export type CashUp = { cashKobo: number; cardKobo: number; transferKobo: number; machineKobo: number | null; countedKobo: number; cashGapKobo: number; cardGapKobo: number | null };
// End of day: the cash counted against the till's cash sales; the till's card sales against what the card machine says (when linked).
export function cashUp(sales: { method: string; totalKobo: number }[], countedKobo: number, machineKobo: number | null, floatKobo = 0): CashUp {
  const sum = (m: string[]) => sales.filter((s) => m.includes(s.method)).reduce((n, s) => n + s.totalKobo, 0);
  const cashKobo = sum(["cash"]), cardKobo = sum(["pos", "machine"]), transferKobo = sum(["transfer"]);
  return { cashKobo, cardKobo, transferKobo, machineKobo, countedKobo, cashGapKobo: countedKobo - floatKobo - cashKobo, cardGapKobo: machineKobo === null ? null : machineKobo - cardKobo };
}

// ---- Reports (Grand) ----
export type ReportRow = { hotelId: string; branch: string; deptId: string; dept: string; orders: number; ordersKobo: number };
export function monthReport(orders: Pick<Order, "hotelId" | "deptId" | "deptName" | "totalKobo" | "status" | "paidAt" | "billSettledAt" | "payMethod">[], bookings: Pick<Booking, "hotelId" | "totalKobo" | "status" | "paidAt">[], branches: Record<string, string>, month: string) {
  const inMonth = (iso?: string) => !!iso && iso.slice(0, 7) === month;
  const counted = (o: (typeof orders)[number]) => o.status !== "cancelled" && o.status !== "expired" && (inMonth(o.paidAt) || (o.payMethod === "room_bill" && inMonth(o.billSettledAt)));
  const rows = new Map<string, ReportRow>();
  for (const o of orders.filter(counted)) {
    const k = `${o.hotelId}|${o.deptId}`;
    const r = rows.get(k) ?? { hotelId: o.hotelId, branch: branches[o.hotelId] ?? "", deptId: o.deptId, dept: o.deptName, orders: 0, ordersKobo: 0 };
    r.orders++; r.ordersKobo += o.totalKobo; rows.set(k, r);
  }
  const rooms: Record<string, { bookings: number; kobo: number }> = {};
  for (const b of bookings.filter((b) => inMonth(b.paidAt) && b.status !== "cancelled" && b.status !== "expired")) {
    const r = (rooms[b.hotelId] ??= { bookings: 0, kobo: 0 }); r.bookings++; r.kobo += b.totalKobo;
  }
  const list = [...rows.values()].sort((a, b) => a.branch.localeCompare(b.branch) || b.ordersKobo - a.ordersKobo);
  const total = list.reduce((n, r) => n + r.ordersKobo, 0) + Object.values(rooms).reduce((n, r) => n + r.kobo, 0);
  return { rows: list, rooms, totalKobo: total };
}
export function reportCsv(r: ReturnType<typeof monthReport>, branches: Record<string, string>): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const out = ["Branch,Department,Orders,Takings (NGN)"];
  for (const x of r.rows) out.push([q(x.branch), q(x.dept), x.orders, (x.ordersKobo / 100).toFixed(2)].join(","));
  for (const [h, x] of Object.entries(r.rooms)) out.push([q(branches[h] ?? h), q("Rooms"), x.bookings, (x.kobo / 100).toFixed(2)].join(","));
  return out.join("\n");
}

// ---- Money in words ----
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const naira = (kobo: number) => `${kobo < 0 ? "-" : ""}₦${group(Math.floor(Math.abs(kobo) / 100))}${kobo % 100 ? `.${String(Math.abs(kobo % 100)).padStart(2, "0")}` : ""}`;

// ---- Nana: prices only from tool results ----
// Every money figure in Nana's reply must have come back from a tool in this conversation. A reply that states any other figure is
// replaced with the server's own words (lib/hotel-nana-server.ts).
export const moneyFigures = (s: string): number[] =>
  [...s.matchAll(/(?:₦|NGN\s?|N(?=\d))\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/gi)].map((m) => Math.round(Number(m[1].replace(/,/g, "")) * 100 + (m[2] ? Number(m[2].padEnd(2, "0")) : 0)));
export function pricesGrounded(reply: string, toolText: string): boolean {
  const allowed = new Set(moneyFigures(toolText));
  return moneyFigures(reply).every((k) => allowed.has(k));
}
// Account numbers likewise: ten digits in a reply must have come from a tool.
export const accountNumbers = (s: string) => [...s.matchAll(/\b\d{10}\b/g)].map((m) => m[0]);
export const accountsGrounded = (reply: string, toolText: string) => { const ok = new Set(accountNumbers(toolText)); return accountNumbers(reply).every((a) => ok.has(a)); };
export const NANA_LANGUAGES = ["English", "Nigerian Pidgin", "Yorùbá", "Igbo", "Hausa"] as const;

// Codes guests and staff read out: no 0, O, 1, I or L.
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const makeCode = (rand: (n: number) => Uint8Array | Buffer, n = 8) => Array.from(rand(n), (b) => ALPHA[b % ALPHA.length]).join("");
export const isCode = (v: unknown): v is string => typeof v === "string" && /^[A-HJ-KMNP-Z2-9]{6,10}$/.test(v);
