import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { effectiveTier } from "./effective-tier";
import { hotelSettings } from "./pricing";
import { notifyBell } from "./email";
import {
  BOARD_STATUSES, KITCHEN_STATUSES, STAFF_ROLES, addDays, addonOn, billOwed, branchLimit, canMove, checkDates, cleanDept, cleanEmail, cleanMenuItem, cleanPhone,
  cleanPolicy, cleanRoom, cleanTarget, departmentLimit, hasFeature, holdUntil, holdsRoom, hotelTierOf, img, isCode, isDay, isPin, isStaffRole, isUnitStatus,
  lagosToday, makeCode, minutesSince, monthReport, naira, orderNumber, para, priceLines, roleCan, roomsLeft, seesDept, slug, t, targetText,
  type AddonId, type Booking, type Department, type Feature, type HotelDoc, type HotelRole, type HotelTier, type MenuItem, type Order, type Permission,
  type Room, type StaffEntry, type Stay, type UnitStatus,
} from "./hotel";

// The Hotel kit on the server (docs/HOTEL_KIT.md; the rules are lib/hotel.ts). Every collection here is server-only in firestore.rules:
// pages talk to /api/hotel (staff) and /api/public/hotel (guests), which check who is acting on every call. Money is lib/hotel-pay-server.ts.
//
//   hotels/{id}            a hotel or branch: the owner's first is their uid; Grand branches are <uid>_<n>. Name, departments, policy,
//                          staff (uid → role and departments), add-ons (id → paid until), the WhatsApp number id, and the order counter
//   hotelRooms/{id}        a room type: name, price a night, room numbers (units) and, with Housekeeping, each room's state
//   hotelBookings/{id}     a booking: dates, guest, total, held | confirmed | checked_in | checked_out | expired | cancelled, holdUntil, code
//   hotelMenu/{id}         a dish or drink: department, price, sold out, and the Inventory item it takes stock from
//   hotelOrders/{id}       an order: department, room / table / pick-up, lines priced from the menu, status, how it is paid, code
//   hotelStays/{id}        a checked-in guest: the room, the room bill's code, what the room still owes, settled at checkout
//   hotelTills/{id}        a till: name, department, PIN hash, card-machine serial; hotelTillSessions/{token} an open till
//   hotelCashups/{id}      a till's end of day
//   hotelIssues/{id}       Housekeeping: maintenance jobs and lost and found
//   hotelChats/{id}        Nana's chats with guests (the website and WhatsApp), with her steps, for Conversations
//   hotelPayments/{id}     each settlement, keyed by provider and its reference, so one payment is never applied twice
//   hotelPosEvents/{id}    each card-machine event, keyed by the machine's transaction reference
//   hotelPulse/{id}        { rev, at } only: the one thing browsers may read, to know when to fetch the board again
export class HotelError extends Error { constructor(public status: number, message: string) { super(message); } }
const need = (ok: unknown, msg: string, status = 400): void => { if (!ok) throw new HotelError(status, msg); };
const iso = (d: Date) => d.toISOString();
export const newCode = () => makeCode((n) => randomBytes(n));

type Profile = { uid?: string; username?: string; displayName?: string; avatar?: string; role?: string; accountTier?: string; suspended?: boolean; accountKind?: string };
export const planOf = (p: Profile | undefined) => effectiveTier({ username: p?.username ?? "", role: (p?.role ?? "reader") as "reader", accountTier: (p?.accountTier ?? "standard") as "standard" });
export const tierOfProfile = (p: Profile | undefined): HotelTier | null => (!p || p.suspended === true ? null : hotelTierOf(planOf(p)));
export const hotelOf = (id: string, d: FirebaseFirestore.DocumentData | undefined) => (d ? ({ ...(d as HotelDoc), id }) : null);
export type HotelRec = HotelDoc & { id: string };

// The hotel's pulse: staff screens listen to this one small document and fetch again when it moves.
export const bumpPulse = (db: Firestore, hotelId: string, now = new Date()) => db.doc(`hotelPulse/${hotelId}`).set({ rev: FieldValue.increment(1), at: iso(now) }, { merge: true }).catch(() => {});

// ---- Who is acting ----
// The owner; an organisation admin of the owner's account (as a manager); or staff the owner gave a hotel role (Standard and up).
export async function roleAt(db: Firestore, actor: string, h: HotelRec, tier: HotelTier | null): Promise<HotelRole | null> {
  if (!actor || !tier) return null;
  if (actor === h.ownerUid) return "owner";
  if (!hasFeature(tier, "staffRoles")) return null;
  const s = h.staff?.[actor];
  if (s && isStaffRole(s.role)) return s.role;
  const m = (await db.doc(`orgMembers/${h.ownerUid}_${actor}`).get()).data();
  return m?.role === "admin" ? "manager" : null;
}
export type Ctx = { db: Firestore; actor: string; hotel: HotelRec; role: HotelRole; staff?: StaffEntry; tier: HotelTier; owner: Profile; now: Date };
export async function context(db: Firestore, actor: string, hotelId: string, now = new Date()): Promise<Ctx> {
  const h = hotelOf(hotelId, (await db.doc(`hotels/${String(hotelId).replace(/\//g, "")}`).get()).data());
  need(h, "Hotel not found.", 404);
  const owner = (await db.doc(`users/${h!.ownerUid}`).get()).data() as Profile | undefined;
  const tier = tierOfProfile(owner);
  need(tier, "The Hotel kit comes with Pro, Business and Enterprise.", 402);
  const role = await roleAt(db, actor, h!, tier);
  need(role, "You don't work at this hotel.", 403);
  return { db, actor, hotel: h!, role: role!, staff: h!.staff?.[actor], tier: tier!, owner: owner!, now };
}
const may = (c: Ctx, p: Permission) => need(roleCan(c.role, p), "Your role at this hotel can't do that.", 403);
const feature = (c: Ctx, f: Feature, what: string) => need(hasFeature(c.tier, f), `${what} comes with ${f === "branches" || f === "nana" || f === "conversations" || f === "reports" ? "Hotel Grand (Enterprise)" : "Hotel Standard (Business)"}.`, 402);

// The hotels this person can open: their own (and branches), and the ones they work at.
export async function myHotels(db: Firestore, uid: string): Promise<{ id: string; name: string; branch: string; role: HotelRole }[]> {
  const [own, staffed, admins] = await Promise.all([
    db.collection("hotels").where("ownerUid", "==", uid).get(),
    db.collection("hotels").where(`staffUids`, "array-contains", uid).get(),
    db.collection("orgMembers").where("memberUid", "==", uid).get().catch(() => null),
  ]);
  const out = new Map<string, { id: string; name: string; branch: string; role: HotelRole }>();
  for (const d of own.docs) out.set(d.id, { id: d.id, name: String(d.get("name")), branch: String(d.get("branch") ?? ""), role: "owner" });
  for (const d of staffed.docs) if (!out.has(d.id)) out.set(d.id, { id: d.id, name: String(d.get("name")), branch: String(d.get("branch") ?? ""), role: (d.get(`staff.${uid}.role`) as HotelRole) ?? "department" });
  for (const m of (admins?.docs ?? []).map((d) => d.data()).filter((m) => m.role === "admin")) {
    for (const d of (await db.collection("hotels").where("ownerUid", "==", String(m.orgUid)).get()).docs) if (!out.has(d.id)) out.set(d.id, { id: d.id, name: String(d.get("name")), branch: String(d.get("branch") ?? ""), role: "manager" });
  }
  return [...out.values()];
}

// ---- Setting up ----
export async function setupHotel(db: Firestore, uid: string, raw: Record<string, unknown>, now = new Date()): Promise<HotelRec> {
  const owner = (await db.doc(`users/${uid}`).get()).data() as Profile | undefined;
  need(tierOfProfile(owner), "The Hotel kit comes with Pro (Starter), Business (Standard) and Enterprise (Grand).", 402);
  const ref = db.doc(`hotels/${uid}`);
  const have = await ref.get();
  if (have.exists) return hotelOf(uid, have.data())!;
  const name = t(raw.name, 80) || owner?.displayName || "My hotel";
  const dept = cleanDept({ name: t(raw.department, 40) || "Restaurant", kind: "restaurant" })!;
  const doc: HotelDoc = { ownerUid: uid, name, branch: t(raw.branch, 60), city: t(raw.city, 60), address: t(raw.address, 160), phone: cleanPhone(raw.phone), about: para(raw.about, 600), departments: [dept], policy: cleanPolicy({}), staff: {}, orderSeq: 0, createdAt: iso(now), updatedAt: iso(now) };
  await ref.set({ ...doc, staffUids: [] });
  return { ...doc, id: uid };
}
export async function saveHotel(c: Ctx, raw: Record<string, unknown>): Promise<HotelRec> {
  may(c, "settings");
  const patch = {
    name: t(raw.name, 80) || c.hotel.name, branch: t(raw.branch, 60), city: t(raw.city, 60), address: t(raw.address, 160), phone: cleanPhone(raw.phone), about: para(raw.about, 600),
    policy: cleanPolicy({ ...c.hotel.policy, ...(raw.policy && typeof raw.policy === "object" ? raw.policy : {}) }), updatedAt: iso(c.now),
  };
  await c.db.doc(`hotels/${c.hotel.id}`).update(patch);
  return { ...c.hotel, ...patch };
}
export async function saveDepartments(c: Ctx, raw: unknown): Promise<Department[]> {
  may(c, "settings");
  const list: Department[] = [];
  for (const x of (Array.isArray(raw) ? raw : []).slice(0, 60)) { const d = cleanDept(x, list.map((l) => l.id)); if (d && !list.some((l) => l.id === d.id)) list.push(d); }
  need(list.length, "Keep at least one department.");
  const max = departmentLimit(c.tier, hotelSettings().departmentsMax);
  need(list.length <= max, c.tier === "starter" ? "Hotel Starter has one department. Several departments come with Hotel Standard (Business)." : "That's more departments than your plan allows.", 402);
  await c.db.doc(`hotels/${c.hotel.id}`).update({ departments: list, updatedAt: iso(c.now) });
  return list;
}
// Grand: another branch, with the same departments and policy to start from. The owner sees every branch in one view.
export async function addBranch(c: Ctx, raw: Record<string, unknown>): Promise<HotelRec> {
  need(c.role === "owner", "Only the owner adds branches.", 403);
  feature(c, "branches", "Several branches");
  const all = await c.db.collection("hotels").where("ownerUid", "==", c.hotel.ownerUid).get();
  need(all.size < branchLimit(c.tier, hotelSettings().branchesMax), "That's as many branches as your plan allows. Contact us for more.", 402);
  const n = all.docs.reduce((m, d) => Math.max(m, Number(d.id.split("_")[1]) || 1), 1) + 1;
  const id = `${c.hotel.ownerUid}_${n}`;
  const branch = t(raw.branch, 60);
  need(branch, "Name the branch, like Ikeja or Abuja.");
  const doc: HotelDoc = { ownerUid: c.hotel.ownerUid, name: t(raw.name, 80) || c.hotel.name, branch, city: t(raw.city, 60), address: t(raw.address, 160), phone: cleanPhone(raw.phone), about: c.hotel.about, departments: c.hotel.departments, policy: c.hotel.policy, staff: {}, orderSeq: 0, createdAt: iso(c.now), updatedAt: iso(c.now) };
  await c.db.doc(`hotels/${id}`).set({ ...doc, staffUids: [] });
  return { ...doc, id };
}

// ---- Staff (Standard and up): people already on the owner's team (organisation members, or Business books staff) ----
export async function teamOf(db: Firestore, ownerUid: string): Promise<{ uid: string; name: string; username: string }[]> {
  const [org, books] = await Promise.all([db.collection("orgMembers").where("orgUid", "==", ownerUid).get().catch(() => null), db.collection("bookStaff").where("ownerUid", "==", ownerUid).get().catch(() => null)]);
  const out = new Map<string, { uid: string; name: string; username: string }>();
  for (const m of org?.docs.map((d) => d.data()) ?? []) out.set(String(m.memberUid), { uid: String(m.memberUid), name: String(m.memberName ?? m.memberUsername ?? ""), username: String(m.memberUsername ?? "") });
  for (const m of books?.docs.map((d) => d.data()) ?? []) if (!out.has(String(m.uid))) out.set(String(m.uid), { uid: String(m.uid), name: String(m.name ?? m.username ?? ""), username: String(m.username ?? "") });
  return [...out.values()];
}
export async function setStaff(c: Ctx, uid: unknown, raw: { role?: unknown; depts?: unknown } | null): Promise<Record<string, StaffEntry>> {
  need(c.role === "owner", "Only the owner gives staff roles.", 403);
  feature(c, "staffRoles", "Staff roles");
  const who = String(uid ?? "");
  const staff = { ...(((await c.db.doc(`hotels/${c.hotel.id}`).get()).get("staff") as Record<string, StaffEntry> | undefined) ?? {}) };
  if (raw === null) delete staff[who];
  else {
    const member = (await teamOf(c.db, c.hotel.ownerUid)).find((m) => m.uid === who);
    need(member, "Add them to your team first (Organisation team, or staff on Business books).", 404);
    need(isStaffRole(raw.role), `Choose a role: ${STAFF_ROLES.map((r) => r.label).join(", ")}.`);
    const depts = (Array.isArray(raw.depts) ? raw.depts : []).map(String).filter((d) => c.hotel.departments.some((x) => x.id === d));
    need(raw.role !== "department" || depts.length, "Choose their department.");
    staff[who] = { role: raw.role as StaffEntry["role"], depts: raw.role === "department" ? depts : [], name: member!.name };
  }
  await c.db.doc(`hotels/${c.hotel.id}`).update({ staff, staffUids: Object.keys(staff), updatedAt: iso(c.now) });
  return staff;
}

// ---- Rooms ----
export const roomOf = (d: FirebaseFirestore.DocumentSnapshot): Room => ({ ...(d.data() as Room), id: d.id });
export async function roomsAt(db: Firestore, hotelId: string): Promise<Room[]> {
  return (await db.collection("hotelRooms").where("hotelId", "==", hotelId).get()).docs.map(roomOf).sort((a, b) => a.order - b.order || a.priceKobo - b.priceKobo);
}
export async function saveRoom(c: Ctx, raw: Record<string, unknown>): Promise<Room> {
  may(c, "settings");
  const r = cleanRoom(raw, c.hotel.id);
  need(typeof r !== "string", r as string);
  const room = r as Room;
  const id = String(raw.id ?? "");
  if (id) {
    const old = await c.db.doc(`hotelRooms/${id}`).get();
    need(old.exists && old.get("hotelId") === c.hotel.id, "Room not found.", 404);
    const keep = (old.get("unitStatus") ?? {}) as Record<string, UnitStatus>;
    await old.ref.update({ ...room, unitStatus: Object.fromEntries(room.units.map((u) => [u, keep[u] ?? "ready"])) });
    return { ...room, id };
  }
  need((await c.db.collection("hotelRooms").where("hotelId", "==", c.hotel.id).get()).size < 60, "That's as many room types as one hotel can list.");
  const ref = await c.db.collection("hotelRooms").add({ ...room, unitStatus: Object.fromEntries(room.units.map((u) => [u, "ready"])) });
  return { ...room, id: ref.id };
}

// ---- Menus ----
export const menuOf = (d: FirebaseFirestore.DocumentSnapshot): MenuItem => ({ ...(d.data() as MenuItem), id: d.id });
export async function menuAt(db: Firestore, hotelId: string): Promise<MenuItem[]> {
  return (await db.collection("hotelMenu").where("hotelId", "==", hotelId).get()).docs.map(menuOf).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
export async function saveMenuItem(c: Ctx, raw: Record<string, unknown>): Promise<MenuItem> {
  may(c, "settings");
  const m = cleanMenuItem(raw, c.hotel.id, c.hotel.departments.map((d) => d.id));
  need(typeof m !== "string", m as string);
  const item = m as MenuItem;
  if (item.stockItemId) {
    feature(c, "inventory", "Taking stock from Inventory");
    const s = (await c.db.doc(`storeItems/${item.stockItemId}`).get()).data();
    need(s && s.ownerUid === c.hotel.ownerUid, "That Inventory item isn't yours.", 404);
  }
  const id = String(raw.id ?? "");
  if (id) {
    const old = await c.db.doc(`hotelMenu/${id}`).get();
    need(old.exists && old.get("hotelId") === c.hotel.id, "Item not found.", 404);
    await old.ref.set(item);
    return { ...item, id };
  }
  need((await c.db.collection("hotelMenu").where("hotelId", "==", c.hotel.id).get()).size < 600, "That's as many items as one hotel's menus can hold.");
  const ref = await c.db.collection("hotelMenu").add(item);
  return { ...item, id: ref.id };
}
// Sold out today (or back): the department's own staff can do this from the board.
export async function setSoldOut(c: Ctx, id: unknown, soldOut: boolean): Promise<void> {
  const d = await c.db.doc(`hotelMenu/${String(id)}`).get();
  need(d.exists && d.get("hotelId") === c.hotel.id, "Item not found.", 404);
  need(roleCan(c.role, "settings") || seesDept(c.role, c.staff, String(d.get("deptId"))), "That's another department's menu.", 403);
  await d.ref.update({ soldOut });
}
export async function removeMenuItem(c: Ctx, id: unknown): Promise<void> {
  may(c, "settings");
  const d = await c.db.doc(`hotelMenu/${String(id)}`).get();
  need(d.exists && d.get("hotelId") === c.hotel.id, "Item not found.", 404);
  await d.ref.delete();
}

// ---- The public side: the hotel as guests see it ----
// A hotel by its owner's username (and branch id for Grand). Never staff, PIN hashes, stock links or the order counter.
export async function hotelByUsername(db: Firestore, username: string, branch?: string): Promise<{ hotel: HotelRec; tier: HotelTier; owner: Profile } | null> {
  const u = (await db.collection("users").where("username", "==", String(username).toLowerCase()).limit(1).get()).docs[0];
  if (!u) return null;
  const owner = u.data() as Profile;
  const tier = tierOfProfile(owner);
  if (!tier) return null;
  const id = branch && new RegExp(`^${u.id}_\\d{1,3}$`).test(branch) ? branch : u.id;
  const h = hotelOf(id, (await db.doc(`hotels/${id}`).get()).data());
  return h && h.ownerUid === u.id ? { hotel: h, tier, owner } : null;
}
export async function hotelById(db: Firestore, id: string): Promise<{ hotel: HotelRec; tier: HotelTier; owner: Profile } | null> {
  const h = hotelOf(id, (await db.doc(`hotels/${String(id).replace(/\//g, "")}`).get()).data());
  if (!h) return null;
  const owner = (await db.doc(`users/${h.ownerUid}`).get()).data() as Profile | undefined;
  const tier = tierOfProfile(owner);
  return tier ? { hotel: h, tier, owner: owner! } : null;
}
export type PayOptions = { online: boolean; transfer: boolean; desk: boolean };
export function payOptionsFor(h: HotelRec, now: Date, providers: { paystack: boolean; paylony: boolean }): PayOptions {
  return { online: providers.paystack, transfer: providers.paylony && addonOn(h.addons, "account", now), desk: h.policy.payAtDesk };
}
export async function publicHotel(db: Firestore, found: { hotel: HotelRec; tier: HotelTier }, now: Date, providers: { paystack: boolean; paylony: boolean }) {
  const { hotel: h, tier } = found;
  const [rooms, menu, branches] = await Promise.all([roomsAt(db, h.id), menuAt(db, h.id), hasFeature(tier, "branches") ? db.collection("hotels").where("ownerUid", "==", h.ownerUid).get() : null]);
  const depts = h.departments.filter((d) => d.open).slice(0, departmentLimit(tier, hotelSettings().departmentsMax));
  return {
    id: h.id, name: h.name, branch: h.branch, city: h.city, address: h.address, phone: h.phone, about: h.about, tier,
    policy: { checkIn: h.policy.checkIn, checkOut: h.policy.checkOut, cancellation: h.policy.cancellation, payAtDesk: h.policy.payAtDesk },
    rooms: rooms.filter((r) => r.on).map((r) => ({ id: r.id!, name: r.name, blurb: r.blurb, priceKobo: r.priceKobo, image: r.image, count: r.units.length })),
    departments: depts.map((d) => ({ id: d.id, name: d.name, kind: d.kind })),
    menu: menu.filter((m) => depts.some((d) => d.id === m.deptId)).map((m) => ({ id: m.id!, deptId: m.deptId, name: m.name, note: m.note, priceKobo: m.priceKobo, group: m.group, image: m.image, soldOut: m.soldOut })),
    branches: (branches?.docs ?? []).map((d) => ({ id: d.id, branch: String(d.get("branch") ?? ""), city: String(d.get("city") ?? "") })),
    pay: payOptionsFor(h, now, providers),
    roomBill: hasFeature(tier, "roomBill"), nana: hasFeature(tier, "nana"), holdMinutes: hotelSettings().holdMinutes,
  };
}
async function bookingsFor(db: Firestore, roomId: string, from: string) {
  return (await db.collection("hotelBookings").where("roomId", "==", roomId).where("checkOut", ">", from).get()).docs.map((d) => d.data() as Booking);
}
export async function availability(db: Firestore, hotelId: string, checkIn: unknown, checkOut: unknown, now = new Date()) {
  const dates = checkDates(checkIn, checkOut, now);
  need(dates.ok, (dates as { error: string }).error);
  const rooms = (await roomsAt(db, hotelId)).filter((r) => r.on);
  const out = [];
  for (const r of rooms) out.push({ id: r.id!, name: r.name, priceKobo: r.priceKobo, nights: (dates as { nights: number }).nights, totalKobo: r.priceKobo * (dates as { nights: number }).nights, left: roomsLeft(r.units.length, await bookingsFor(db, r.id!, String(checkIn)), String(checkIn), String(checkOut), now) });
  return out;
}

// A booking starts held: the room is kept for the hold time (Admin) while the guest pays, then goes back on sale.
export async function createBooking(db: Firestore, hotelId: string, raw: Record<string, unknown>, now = new Date(), uid?: string): Promise<Booking> {
  const found = await hotelById(db, hotelId);
  need(found, "Hotel not found.", 404);
  const h = found!.hotel;
  const dates = checkDates(raw.checkIn, raw.checkOut, now);
  need(dates.ok, (dates as { error: string }).error);
  const guestName = t(raw.name, 80), email = cleanEmail(raw.email), phone = cleanPhone(raw.phone);
  need(guestName, "Enter the guest's name.");
  need(email, "Enter an email address for the booking and receipt.");
  need(phone.length >= 7, "Enter a phone number the hotel can call.");
  const guests = Math.max(1, Math.min(12, Math.floor(Number(raw.guests) || 1)));
  const payMethod = raw.pay === "transfer" ? "transfer" : raw.pay === "desk" ? "desk" : "online";
  need(payMethod !== "desk" || h.policy.payAtDesk, "This hotel takes payment online when you book.");
  const roomRef = db.doc(`hotelRooms/${String(raw.roomId ?? "x")}`);
  const ref = db.collection("hotelBookings").doc();
  const checkIn = String(raw.checkIn), checkOut = String(raw.checkOut), nights = (dates as { nights: number }).nights;
  const booking = await db.runTransaction(async (tx) => {
    const room = await tx.get(roomRef);
    need(room.exists && room.get("hotelId") === h.id && room.get("on") !== false, "That room isn't available.", 404);
    const r = room.data() as Room;
    const others = (await tx.get(db.collection("hotelBookings").where("roomId", "==", room.id).where("checkOut", ">", checkIn))).docs.map((d) => d.data() as Booking);
    need(roomsLeft(r.units.length, others, checkIn, checkOut, now) > 0, "Sorry, that room was just taken for those dates. Choose another.", 409);
    const b: Booking = {
      hotelId: h.id, ownerUid: h.ownerUid, roomId: room.id, roomName: r.name, checkIn, checkOut, nights, guests, guestName, email, phone, unitPriceKobo: r.priceKobo,
      totalKobo: r.priceKobo * nights, status: "held", payMethod, holdUntil: holdUntil(now, hotelSettings().holdMinutes), code: newCode(), createdAt: iso(now), ...(uid ? { uid } : {}),
    };
    tx.set(ref, b);
    return { ...b, id: ref.id };
  });
  await bumpPulse(db, h.id, now);
  return booking;
}

// An order from the website, Nana or WhatsApp: priced from the menu here, never from what was sent. Paid online or by transfer (it waits
// for the payment, held for the hold time), or put on a checked-in guest's room bill (Standard and up) with the bill's code.
export async function createOrder(db: Firestore, hotelId: string, raw: Record<string, unknown>, source: Order["source"], now = new Date()): Promise<Order> {
  const found = await hotelById(db, hotelId);
  need(found, "Hotel not found.", 404);
  const { hotel: h, tier } = found!;
  const dept = h.departments.find((d) => d.id === raw.deptId && d.open);
  const allowed = h.departments.filter((d) => d.open).slice(0, departmentLimit(tier, hotelSettings().departmentsMax));
  need(dept && allowed.some((d) => d.id === dept.id), "That department isn't taking orders.", 404);
  const target = cleanTarget(raw.target);
  need(target, "Say where it goes: your room number, your table, or pick-up.");
  const menu = (await db.collection("hotelMenu").where("hotelId", "==", h.id).where("deptId", "==", dept!.id).get()).docs.map(menuOf);
  const priced = priceLines(raw.lines, menu, dept!.id);
  need(priced.ok, (priced as { error: string }).error);
  const { lines, totalKobo } = priced as { lines: Order["lines"]; totalKobo: number };
  const guestName = t(raw.name, 80), phone = cleanPhone(raw.phone), email = cleanEmail(raw.email);
  const onBill = raw.pay === "room_bill";
  let stay: (Stay & { id: string }) | null = null;
  if (onBill) {
    need(hasFeature(tier, "roomBill"), "This hotel doesn't take room-bill orders online. Pay now instead.", 402);
    need(target!.kind === "room", "Room-bill orders go to your room.");
    const code = String(raw.stayCode ?? "").toUpperCase();
    need(isCode(code), "Enter the room-bill code from your check-in.");
    const s = (await db.collection("hotelStays").where("code", "==", code).limit(1).get()).docs[0];
    need(s && s.get("hotelId") === h.id && s.get("open") === true && String(s.get("unit")) === target!.value, "That room-bill code doesn't match an open stay in that room.", 403);
    stay = { ...(s.data() as Stay), id: s.id };
  } else need(guestName && phone.length >= 7, "Enter your name and phone number.");
  const payMethod: Order["payMethod"] = onBill ? "room_bill" : raw.pay === "transfer" ? "transfer" : "online";
  const ref = db.collection("hotelOrders").doc();
  const hotelRef = db.doc(`hotels/${h.id}`);
  const order = await db.runTransaction(async (tx) => {
    const seq = (Number((await tx.get(hotelRef)).get("orderSeq")) || 0) + 1;
    const o: Order = {
      hotelId: h.id, ownerUid: h.ownerUid, deptId: dept!.id, deptName: dept!.name, number: orderNumber(dept!.prefix, seq), target: target!, lines, totalKobo,
      status: onBill ? "on_bill" : "awaiting_payment", payMethod, ...(onBill ? { paidAt: iso(now) } : { holdUntil: holdUntil(now, hotelSettings().holdMinutes) }),
      guestName: stay?.guestName ?? guestName, phone, email, note: t(raw.note, 200), source, code: newCode(), createdAt: iso(now), ...(stay ? { stayId: stay.id } : {}),
      ...(typeof raw.chatId === "string" ? { chatId: raw.chatId.slice(0, 40) } : {}),
    };
    tx.update(hotelRef, { orderSeq: seq });
    tx.set(ref, o);
    return { ...o, id: ref.id };
  });
  await bumpPulse(db, h.id, now);
  if (onBill) await orderBells(db, h, order).catch(() => {});
  return order;
}
// A new order the kitchen should start: a bell to the owner and the department's staff.
export async function orderBells(db: Firestore, h: HotelRec, o: Order) {
  const to = [h.ownerUid, ...Object.entries(h.staff ?? {}).filter(([, s]) => s.role === "manager" || s.depts.includes(o.deptId)).map(([u]) => u)];
  const how = o.payMethod === "room_bill" ? "on the room bill" : `paid ${naira(o.totalKobo)}`;
  for (const uid of [...new Set(to)]) await notifyBell({ uid, type: "hotel", linkHref: `/profile/hotel/board?h=${h.id}`, message: `New order ${o.number} for ${o.deptName}: ${targetText(o.target)}, ${how}.` });
}
export async function bookingBells(db: Firestore, h: HotelRec, b: Booking) {
  const to = [h.ownerUid, ...Object.entries(h.staff ?? {}).filter(([, s]) => s.role === "manager" || s.role === "front_desk").map(([u]) => u)];
  for (const uid of [...new Set(to)]) await notifyBell({ uid, type: "hotel", linkHref: `/profile/hotel?h=${h.id}&tab=bookings`, message: `New booking: ${b.roomName}, ${b.checkIn} to ${b.checkOut}, for ${b.guestName}.` });
}

// What a guest's link shows (/hotel/<code>): their booking or order and where it stands. No other guest's details.
export async function guestView(db: Firestore, code: unknown, now = new Date()) {
  const c = String(code ?? "").toUpperCase();
  need(isCode(c), "That link isn't working.", 404);
  const [b, o, s] = await Promise.all([
    db.collection("hotelBookings").where("code", "==", c).limit(1).get(), db.collection("hotelOrders").where("code", "==", c).limit(1).get(), db.collection("hotelStays").where("code", "==", c).limit(1).get(),
  ]);
  if (b.docs[0]) {
    const x = b.docs[0].data() as Booking;
    const h = await hotelById(db, x.hotelId);
    return { kind: "booking" as const, id: b.docs[0].id, code: c, username: h?.owner.username ?? "", hotel: h?.hotel.name ?? "", hotelId: x.hotelId, status: x.status, room: x.roomName, checkIn: x.checkIn, checkOut: x.checkOut, nights: x.nights, totalKobo: x.totalKobo, payMethod: x.payMethod, holdUntil: x.holdUntil, held: x.status === "held" && Date.parse(x.holdUntil) > now.getTime(), late: !!x.late, policy: h?.hotel.policy.cancellation ?? "", checkInTime: h?.hotel.policy.checkIn ?? "", checkOutTime: h?.hotel.policy.checkOut ?? "" };
  }
  if (o.docs[0]) {
    const x = o.docs[0].data() as Order;
    const h = await hotelById(db, x.hotelId);
    return { kind: "order" as const, id: o.docs[0].id, code: c, username: h?.owner.username ?? "", hotel: h?.hotel.name ?? "", hotelId: x.hotelId, status: x.status, number: x.number, dept: x.deptName, target: targetText(x.target), lines: x.lines.map((l) => ({ name: l.name, qty: l.qty, unitKobo: l.unitKobo })), totalKobo: x.totalKobo, payMethod: x.payMethod, holdUntil: x.holdUntil ?? "", late: !!x.late };
  }
  if (s.docs[0]) {
    const x = s.docs[0].data() as Stay;
    const orders = (await db.collection("hotelOrders").where("stayId", "==", s.docs[0].id).get()).docs.map((d) => d.data() as Order);
    const h = await hotelById(db, x.hotelId);
    return { kind: "stay" as const, id: s.docs[0].id, code: c, username: h?.owner.username ?? "", roomBill: !!h && hasFeature(h.tier, "roomBill"), hotel: h?.hotel.name ?? "", hotelId: x.hotelId, open: x.open, room: x.roomName, unit: x.unit, guest: x.guestName, roomDueKobo: x.roomDueKobo, owedKobo: x.open ? billOwed(x.roomDueKobo, orders) : 0, orders: orders.filter((o) => o.status !== "cancelled").map((o) => ({ number: o.number, dept: o.deptName, totalKobo: o.totalKobo, status: o.status })) };
  }
  throw new HotelError(404, "That link isn't working.");
}

// ---- Staff: moving orders along ----
export async function moveOrder(c: Ctx, id: unknown, to: unknown): Promise<Order> {
  may(c, "orders");
  need(to !== "paid", "Only a payment the provider confirms can mark an order paid.", 403);
  const ref = c.db.doc(`hotelOrders/${String(id)}`);
  const o = await c.db.runTransaction(async (tx) => {
    const d = await tx.get(ref);
    need(d.exists && d.get("hotelId") === c.hotel.id, "Order not found.", 404);
    const o = d.data() as Order;
    need(seesDept(c.role, c.staff, o.deptId), "That's another department's order.", 403);
    need(canMove(o.status, to), `An order that is ${o.status.replace("_", " ")} can't move to ${String(to).replace("_", " ")}.`, 409);
    const patch: Partial<Order> = { status: to as Order["status"], ...(to === "ready" ? { readyAt: iso(c.now) } : {}), ...(to === "completed" ? { doneAt: iso(c.now) } : {}) };
    tx.update(ref, patch);
    return { ...o, ...patch, id: d.id };
  });
  await bumpPulse(c.db, c.hotel.id, c.now);
  return o;
}

// ---- The live staff board and the kitchen screen ----
const pubOrder = (o: Order & { id: string }, lateMinutes: number, now: Date) => ({
  id: o.id, number: o.number, deptId: o.deptId, deptName: o.deptName, target: targetText(o.target), targetKind: o.target.kind, targetValue: o.target.value, lines: o.lines.map((l) => ({ name: l.name, qty: l.qty })), totalKobo: o.totalKobo,
  status: o.status, payMethod: o.payMethod, note: o.note, guestName: o.guestName, createdAt: o.createdAt, paidAt: o.paidAt ?? "", minutes: minutesSince(o.paidAt || o.createdAt, now),
  late: KITCHEN_STATUSES.includes(o.status) && minutesSince(o.paidAt || o.createdAt, now) > lateMinutes, source: o.source,
});
export const lateMinutesOf = (h: HotelRec) => h.policy.lateMinutes ?? hotelSettings().lateMinutes;
async function liveOrders(c: Ctx) {
  const snap = await c.db.collection("hotelOrders").where("hotelId", "==", c.hotel.id).where("status", "in", BOARD_STATUSES).get();
  return snap.docs.map((d) => ({ ...(d.data() as Order), id: d.id })).filter((o) => seesDept(c.role, c.staff, o.deptId));
}
async function occupancy(db: Firestore, hotelId: string, now: Date) {
  const today = lagosToday(now);
  const [rooms, books] = await Promise.all([roomsAt(db, hotelId), db.collection("hotelBookings").where("hotelId", "==", hotelId).where("checkOut", ">", today).get()]);
  const total = rooms.filter((r) => r.on).reduce((n, r) => n + r.units.length, 0);
  const tonight = books.docs.map((d) => d.data() as Booking).filter((b) => holdsRoom(b, now) && b.checkIn <= today && today < b.checkOut).length;
  return { total, tonight, pct: total ? Math.round((tonight / total) * 100) : 0 };
}
async function takenToday(db: Firestore, hotelId: string, now: Date) {
  const start = new Date(Date.parse(`${lagosToday(now)}T00:00:00+01:00`)).toISOString();
  const [o, b] = await Promise.all([db.collection("hotelOrders").where("hotelId", "==", hotelId).where("paidAt", ">=", start).get(), db.collection("hotelBookings").where("hotelId", "==", hotelId).where("paidAt", ">=", start).get()]);
  const orders = o.docs.map((d) => d.data() as Order).filter((x) => x.payMethod !== "room_bill" && !x.late && x.status !== "cancelled" && x.status !== "expired");
  const books = b.docs.map((d) => d.data() as Booking).filter((x) => !x.late);
  return { kobo: orders.reduce((n, x) => n + x.totalKobo, 0) + books.reduce((n, x) => n + x.totalKobo, 0), orders, bookings: books };
}
export async function boardView(c: Ctx) {
  may(c, "orders");
  feature(c, "board", "The live staff board");
  const late = lateMinutesOf(c.hotel);
  const [orders, occ, today] = await Promise.all([liveOrders(c), roleCan(c.role, "bookings") ? occupancy(c.db, c.hotel.id, c.now) : null, roleCan(c.role, "reports") || c.role === "front_desk" ? takenToday(c.db, c.hotel.id, c.now) : null]);
  const feed = today ? [
    ...today.orders.map((o) => ({ at: o.paidAt ?? o.createdAt, text: `Just paid · ${naira(o.totalKobo)}${o.paidVia ? ` by ${o.paidVia}` : ""} · ${targetText(o.target)}` })),
    ...today.bookings.map((b) => ({ at: b.paidAt ?? b.createdAt, text: `Booking · ${b.roomName} ${b.checkIn.slice(5)} to ${b.checkOut.slice(5)} · ${naira(b.totalKobo)}` })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8) : [];
  return {
    hotel: { id: c.hotel.id, name: c.hotel.name, branch: c.hotel.branch }, role: c.role, lateMinutes: late,
    departments: c.hotel.departments.filter((d) => seesDept(c.role, c.staff, d.id)).map((d) => ({ id: d.id, name: d.name, kind: d.kind })),
    orders: orders.map((o) => pubOrder(o, late, c.now)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    occupancy: occ, takenKobo: today?.kobo ?? null, feed,
  };
}
export async function kitchenView(c: Ctx, deptId: unknown) {
  may(c, "orders");
  feature(c, "kitchen", "The kitchen screen");
  const dept = c.hotel.departments.find((d) => d.id === deptId) ?? c.hotel.departments.find((d) => seesDept(c.role, c.staff, d.id));
  need(dept && seesDept(c.role, c.staff, dept.id), "That's another department.", 403);
  const late = lateMinutesOf(c.hotel);
  const orders = (await liveOrders(c)).filter((o) => o.deptId === dept!.id && o.status !== "ready");
  return { hotelId: c.hotel.id, dept: { id: dept!.id, name: dept!.name }, departments: c.hotel.departments.filter((d) => seesDept(c.role, c.staff, d.id)).map((d) => ({ id: d.id, name: d.name })), lateMinutes: late, orders: orders.map((o) => pubOrder(o, late, c.now)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) };
}

// ---- Bookings, check-in and the room bill ----
export async function bookingsView(c: Ctx) {
  may(c, "bookings");
  const today = lagosToday(c.now);
  const [b, stays] = await Promise.all([
    c.db.collection("hotelBookings").where("hotelId", "==", c.hotel.id).where("checkOut", ">=", addDays(today, -1)).get(),
    c.db.collection("hotelStays").where("hotelId", "==", c.hotel.id).where("open", "==", true).get(),
  ]);
  const list = b.docs.map((d) => ({ ...(d.data() as Booking), id: d.id })).filter((x) => x.status !== "expired" || x.late).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const open = [];
  for (const s of stays.docs) {
    const x = { ...(s.data() as Stay), id: s.id };
    const orders = (await c.db.collection("hotelOrders").where("stayId", "==", s.id).get()).docs.map((d) => d.data() as Order);
    open.push({ ...x, owedKobo: billOwed(x.roomDueKobo, orders), orders: orders.filter((o) => o.payMethod === "room_bill" && o.status !== "cancelled").map((o) => ({ number: o.number, dept: o.deptName, totalKobo: o.totalKobo, settled: !!o.billSettledAt })) });
  }
  const late = [
    ...list.filter((x) => x.late?.state === "open").map((x) => ({ kind: "booking" as const, id: x.id, what: `${x.roomName}, ${x.checkIn} to ${x.checkOut}`, guest: x.guestName, amountKobo: x.late!.amountKobo, provider: x.late!.provider, at: x.late!.at })),
    ...(await c.db.collection("hotelOrders").where("hotelId", "==", c.hotel.id).where("late.state", "==", "open").get()).docs.map((d) => { const o = d.data() as Order; return { kind: "order" as const, id: d.id, what: `${o.number} (${o.deptName})`, guest: o.guestName, amountKobo: o.late!.amountKobo, provider: o.late!.provider, at: o.late!.at }; }),
  ];
  return { bookings: list, stays: open, late, policy: c.hotel.policy, roomBill: hasFeature(c.tier, "roomBill") };
}
export async function checkIn(c: Ctx, bookingId: unknown, unitRaw: unknown): Promise<Stay & { id: string }> {
  may(c, "stays");
  const bRef = c.db.doc(`hotelBookings/${String(bookingId)}`);
  const stayRef = c.db.collection("hotelStays").doc();
  const stay = await c.db.runTransaction(async (tx) => {
    const b = await tx.get(bRef);
    need(b.exists && b.get("hotelId") === c.hotel.id, "Booking not found.", 404);
    const x = b.data() as Booking;
    // Paying at the desk: the guest can be checked in while the hold lasts, and the room goes on the bill, settled at checkout.
    const deskHold = x.status === "held" && x.payMethod === "desk" && Date.parse(x.holdUntil) > c.now.getTime();
    need(x.status === "confirmed" || deskHold, x.status === "held" ? "This booking hasn't been paid yet." : `This booking is ${x.status.replace("_", " ")}.`, 409);
    const room = (await tx.get(c.db.doc(`hotelRooms/${x.roomId}`))).data() as Room | undefined;
    const unit = t(unitRaw, 12) || room?.units[0] || "";
    need(room?.units.includes(unit), "Choose one of this room type's room numbers.");
    const taken = (await tx.get(c.db.collection("hotelStays").where("hotelId", "==", c.hotel.id).where("open", "==", true))).docs.some((d) => d.get("roomId") === x.roomId && d.get("unit") === unit);
    need(!taken, `Room ${unit} has a guest in it.`, 409);
    // Paid at the desk on arrival: the room is on the bill, settled at checkout.
    const s: Stay = { hotelId: c.hotel.id, ownerUid: c.hotel.ownerUid, bookingId: b.id, roomId: x.roomId, roomName: x.roomName, unit, guestName: x.guestName, code: newCode(), open: true, checkedInAt: iso(c.now), roomDueKobo: x.status === "confirmed" ? 0 : x.totalKobo, by: c.actor };
    tx.update(bRef, { status: "checked_in", unit, stayId: stayRef.id, ...(x.status === "held" ? { holdUntil: x.checkOut } : {}) });
    tx.set(stayRef, s);
    return { ...s, id: stayRef.id };
  });
  await bumpPulse(c.db, c.hotel.id, c.now);
  return stay;
}
// Checkout: only once the room bill is settled (lib/hotel-pay-server.ts settleCounter, or the guest pays it online from their stay link).
// With Housekeeping, the room is marked dirty.
export async function checkOut(c: Ctx, stayId: unknown): Promise<void> {
  may(c, "stays");
  const ref = c.db.doc(`hotelStays/${String(stayId)}`);
  const s = await ref.get();
  need(s.exists && s.get("hotelId") === c.hotel.id && s.get("open") === true, "That stay isn't open.", 404);
  const x = s.data() as Stay;
  const orders = (await c.db.collection("hotelOrders").where("stayId", "==", s.id).get()).docs.map((d) => d.data() as Order);
  const owed = billOwed(x.roomDueKobo, orders);
  need(owed <= 0, `The room bill still has ${naira(owed)} to pay. Settle it first.`, 409);
  const batch = c.db.batch();
  batch.update(ref, { open: false, checkedOutAt: iso(c.now), outBy: c.actor });
  batch.update(c.db.doc(`hotelBookings/${x.bookingId}`), { status: "checked_out" });
  if (addonOn(c.hotel.addons, "housekeeping", c.now)) batch.update(c.db.doc(`hotelRooms/${x.roomId}`), { [`unitStatus.${x.unit}`]: "dirty" });
  await batch.commit();
  await bumpPulse(c.db, c.hotel.id, c.now);
}
export async function cancelBooking(c: Ctx, id: unknown): Promise<void> {
  may(c, "bookings");
  const ref = c.db.doc(`hotelBookings/${String(id)}`);
  await c.db.runTransaction(async (tx) => {
    const b = await tx.get(ref);
    need(b.exists && b.get("hotelId") === c.hotel.id, "Booking not found.", 404);
    need(["held", "confirmed"].includes(String(b.get("status"))), "Only a held or confirmed booking can be cancelled.", 409);
    tx.update(ref, { status: "cancelled", cancelledAt: iso(c.now), cancelledBy: c.actor });
  });
  await bumpPulse(c.db, c.hotel.id, c.now);
}

// ---- Tills (Standard and up): their own PIN, locked to one department ----
const hashPin = (pin: string, salt = randomBytes(12).toString("hex")) => `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
const pinMatches = (pin: string, stored: string) => { const [salt, hex] = String(stored).split(":"); if (!salt || !hex) return false; const a = scryptSync(pin, salt, 32), b = Buffer.from(hex, "hex"); return a.length === b.length && timingSafeEqual(a, b); };
export async function saveTill(c: Ctx, raw: Record<string, unknown>) {
  may(c, "tills");
  feature(c, "tills", "Tills");
  const name = t(raw.name, 40);
  need(name, "Name the till, like Lounge 1.");
  need(c.hotel.departments.some((d) => d.id === raw.deptId), "Choose the till's department.");
  const serial = t(raw.machineSerial, 40).toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const id = String(raw.id ?? "");
  const base = { hotelId: c.hotel.id, ownerUid: c.hotel.ownerUid, name, deptId: String(raw.deptId), machineSerial: serial, updatedAt: iso(c.now) };
  if (id) {
    const old = await c.db.doc(`hotelTills/${id}`).get();
    need(old.exists && old.get("hotelId") === c.hotel.id, "Till not found.", 404);
    need(raw.pin === undefined || raw.pin === "" || isPin(raw.pin), "A PIN is 4 to 6 digits.");
    await old.ref.update({ ...base, ...(isPin(raw.pin) ? { pinHash: hashPin(raw.pin), fails: 0 } : {}) });
    return { id, ...base };
  }
  need(isPin(raw.pin), "Give the till a PIN of 4 to 6 digits.");
  const ref = await c.db.collection("hotelTills").add({ ...base, pinHash: hashPin(String(raw.pin)), fails: 0, createdAt: iso(c.now) });
  return { id: ref.id, ...base };
}
export async function tillsView(c: Ctx) {
  may(c, "tills");
  const snap = await c.db.collection("hotelTills").where("hotelId", "==", c.hotel.id).get();
  return snap.docs.map((d) => ({ id: d.id, name: String(d.get("name")), deptId: String(d.get("deptId")), machineSerial: String(d.get("machineSerial") ?? "") }));
}
const SESSION_HOURS = 14;
const MAX_FAILS = 5;
// Opening a till on its device: the PIN, and who's at it. Five wrong PINs lock it for 15 minutes.
export async function openTill(db: Firestore, tillId: unknown, pin: unknown, cashier: unknown, now = new Date()) {
  const ref = db.doc(`hotelTills/${String(tillId ?? "x").replace(/\//g, "")}`);
  const d = await ref.get();
  need(d.exists, "Till not found.", 404);
  const lockedUntil = String(d.get("lockedUntil") ?? "");
  need(!lockedUntil || Date.parse(lockedUntil) < now.getTime(), "Too many wrong PINs. Wait 15 minutes, or ask the manager.", 429);
  if (!isPin(pin) || !pinMatches(pin, String(d.get("pinHash")))) {
    const fails = (Number(d.get("fails")) || 0) + 1;
    await ref.update({ fails: fails >= MAX_FAILS ? 0 : fails, ...(fails >= MAX_FAILS ? { lockedUntil: new Date(now.getTime() + 15 * 60_000).toISOString() } : {}) });
    throw new HotelError(403, "That PIN isn't right.");
  }
  const found = await hotelById(db, String(d.get("hotelId")));
  need(found && hasFeature(found.tier, "tills"), "Tills come with Hotel Standard (Business).", 402);
  const token = randomBytes(24).toString("hex");
  const who = t(cashier, 40) || "Cashier";
  await Promise.all([ref.update({ fails: 0, lockedUntil: "" }), db.doc(`hotelTillSessions/${token}`).set({ tillId: d.id, hotelId: d.get("hotelId"), cashier: who, openedAt: iso(now), until: new Date(now.getTime() + SESSION_HOURS * 3_600_000).toISOString() })]);
  const dept = found!.hotel.departments.find((x) => x.id === d.get("deptId"));
  return { token, till: { id: d.id, name: String(d.get("name")), dept: dept?.name ?? "", deptId: String(d.get("deptId")), machine: !!d.get("machineSerial") }, cashier: who };
}
export type TillCtx = { db: Firestore; token: string; till: { id: string; name: string; deptId: string; machineSerial: string }; cashier: string; hotel: HotelRec; tier: HotelTier; now: Date };
export async function tillContext(db: Firestore, token: unknown, now = new Date()): Promise<TillCtx> {
  need(typeof token === "string" && /^[a-f0-9]{48}$/.test(token), "Open the till with its PIN.", 401);
  const s = (await db.doc(`hotelTillSessions/${token}`).get()).data();
  need(s && Date.parse(String(s.until)) > now.getTime(), "The till has closed. Open it again with its PIN.", 401);
  const till = await db.doc(`hotelTills/${s!.tillId}`).get();
  const found = await hotelById(db, String(s!.hotelId));
  need(till.exists && found && hasFeature(found.tier, "tills"), "This till isn't available.", 404);
  return { db, token: token as string, till: { id: till.id, name: String(till.get("name")), deptId: String(till.get("deptId")), machineSerial: String(till.get("machineSerial") ?? "") }, cashier: String(s!.cashier), hotel: found!.hotel, tier: found!.tier, now };
}
export async function tillMenu(tc: TillCtx) {
  const items = (await tc.db.collection("hotelMenu").where("hotelId", "==", tc.hotel.id).where("deptId", "==", tc.till.deptId).get()).docs.map(menuOf);
  return items.map((m) => ({ id: m.id!, name: m.name, priceKobo: m.priceKobo, group: m.group, soldOut: m.soldOut }));
}
// A counter sale on the till: a new order, priced from the menu, for this department.
export async function tillOrder(tc: TillCtx, raw: Record<string, unknown>, payMethod: Order["payMethod"]): Promise<Order> {
  const dept = tc.hotel.departments.find((d) => d.id === tc.till.deptId);
  need(dept, "This till's department is gone. Ask the manager.", 404);
  const menu = (await tc.db.collection("hotelMenu").where("hotelId", "==", tc.hotel.id).where("deptId", "==", dept!.id).get()).docs.map(menuOf);
  const priced = priceLines(raw.lines, menu, dept!.id);
  need(priced.ok, (priced as { error: string }).error);
  const target = cleanTarget(raw.target) ?? { kind: "pickup" as const, value: "Counter" };
  const ref = tc.db.collection("hotelOrders").doc();
  const hotelRef = tc.db.doc(`hotels/${tc.hotel.id}`);
  return tc.db.runTransaction(async (tx) => {
    const seq = (Number((await tx.get(hotelRef)).get("orderSeq")) || 0) + 1;
    const o: Order = {
      hotelId: tc.hotel.id, ownerUid: tc.hotel.ownerUid, deptId: dept!.id, deptName: dept!.name, number: orderNumber(dept!.prefix, seq), target, lines: (priced as { lines: Order["lines"] }).lines,
      totalKobo: (priced as { totalKobo: number }).totalKobo, status: "awaiting_payment", payMethod, holdUntil: holdUntil(tc.now, payMethod === "machine" ? 3 : hotelSettings().holdMinutes),
      guestName: t(raw.customer, 60), phone: "", email: "", note: t(raw.note, 120), source: "till", code: newCode(), createdAt: iso(tc.now), tillId: tc.till.id, by: `${tc.till.name} · ${tc.cashier}`,
    };
    tx.update(hotelRef, { orderSeq: seq });
    tx.set(ref, o);
    return { ...o, id: ref.id };
  });
}
// The till's sales today, for the screen and the cash-up.
export async function tillDay(tc: TillCtx) {
  const start = new Date(Date.parse(`${lagosToday(tc.now)}T00:00:00+01:00`)).toISOString();
  const snap = await tc.db.collection("hotelOrders").where("tillId", "==", tc.till.id).where("createdAt", ">=", start).get();
  const sales = snap.docs.map((d) => ({ ...(d.data() as Order), id: d.id })).filter((o) => o.paidAt && o.status !== "cancelled" && o.status !== "expired" && !o.late);
  const methodOf = (o: Order) => (o.paidVia === "moniepoint" ? "machine" : o.paidVia ?? "cash");
  const machine = tc.till.machineSerial ? (await tc.db.collection("hotelPosEvents").where("terminalSerial", "==", tc.till.machineSerial).where("at", ">=", start).get()).docs.map((d) => d.data()).filter((e) => e.approved === true).reduce((n, e) => n + (Number(e.amountKobo) || 0), 0) : null;
  return { sales: sales.map((o) => ({ id: o.id, number: o.number, totalKobo: o.totalKobo, method: methodOf(o), at: o.paidAt! })), machineKobo: machine, start };
}

// ---- Housekeeping (add-on) ----
export async function setUnit(c: Ctx, roomId: unknown, unit: unknown, status: unknown) {
  may(c, "housekeeping");
  need(addonOn(c.hotel.addons, "housekeeping", c.now), "Housekeeping is an add-on. Add it from Plans and add-ons.", 402);
  need(isUnitStatus(status), "Choose ready, dirty, cleaning or maintenance.");
  const ref = c.db.doc(`hotelRooms/${String(roomId)}`);
  const d = await ref.get();
  need(d.exists && d.get("hotelId") === c.hotel.id && (d.get("units") as string[]).includes(String(unit)), "Room not found.", 404);
  await ref.update({ [`unitStatus.${String(unit)}`]: status });
}
export async function housekeepingView(c: Ctx) {
  may(c, "housekeeping");
  const [rooms, issues, stays] = await Promise.all([roomsAt(c.db, c.hotel.id), c.db.collection("hotelIssues").where("hotelId", "==", c.hotel.id).where("open", "==", true).get(), c.db.collection("hotelStays").where("hotelId", "==", c.hotel.id).where("open", "==", true).get()]);
  const occupied = new Set(stays.docs.map((d) => `${d.get("roomId")}|${d.get("unit")}`));
  return {
    on: addonOn(c.hotel.addons, "housekeeping", c.now),
    rooms: rooms.flatMap((r) => r.units.map((u) => ({ roomId: r.id!, room: r.name, unit: u, status: r.unitStatus?.[u] ?? "ready", occupied: occupied.has(`${r.id}|${u}`) }))),
    issues: issues.docs.map((d) => ({ id: d.id, ...(d.data() as { kind: string; text: string; unit: string; at: string }) })).sort((a, b) => b.at.localeCompare(a.at)),
  };
}
export async function addIssue(c: Ctx, raw: Record<string, unknown>) {
  may(c, "housekeeping");
  need(addonOn(c.hotel.addons, "housekeeping", c.now), "Housekeeping is an add-on. Add it from Plans and add-ons.", 402);
  const text = t(raw.text, 240);
  need(text, "Say what needs doing, or what was found.");
  const kind = raw.kind === "lost" ? "lost" : "maintenance";
  const ref = await c.db.collection("hotelIssues").add({ hotelId: c.hotel.id, kind, text, unit: t(raw.unit, 12), open: true, at: iso(c.now), by: c.actor });
  return { id: ref.id };
}
export async function closeIssue(c: Ctx, id: unknown) {
  may(c, "housekeeping");
  const d = await c.db.doc(`hotelIssues/${String(id)}`).get();
  need(d.exists && d.get("hotelId") === c.hotel.id, "Not found.", 404);
  await d.ref.update({ open: false, closedAt: iso(c.now), closedBy: c.actor });
}

// ---- Grand: one owner view, reports, Conversations ----
export async function ownerView(c: Ctx) {
  need(c.role === "owner" || c.role === "manager", "Only the owner and managers see every branch.", 403);
  const hotels = (await c.db.collection("hotels").where("ownerUid", "==", c.hotel.ownerUid).get()).docs.map((d) => hotelOf(d.id, d.data())!);
  const out = [];
  for (const h of hotels.slice(0, 50)) {
    const [occ, today, open] = await Promise.all([occupancy(c.db, h.id, c.now), takenToday(c.db, h.id, c.now), c.db.collection("hotelOrders").where("hotelId", "==", h.id).where("status", "in", BOARD_STATUSES).get()]);
    out.push({ id: h.id, name: h.name, branch: h.branch, city: h.city, occupancy: occ, takenKobo: today.kobo, openOrders: open.size });
  }
  return { branches: out, totalKobo: out.reduce((n, b) => n + b.takenKobo, 0) };
}
export async function reportView(c: Ctx, month: unknown) {
  may(c, "reports");
  feature(c, "reports", "Monthly reports");
  const m = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : lagosToday(c.now).slice(0, 7);
  const start = `${m}-01T00:00:00.000Z`, end = `${m}-31T23:59:59.999Z`;
  const owner = c.hotel.ownerUid;
  const [hotels, o, b, billed] = await Promise.all([
    c.db.collection("hotels").where("ownerUid", "==", owner).get(),
    c.db.collection("hotelOrders").where("ownerUid", "==", owner).where("paidAt", ">=", start).where("paidAt", "<=", end).get(),
    c.db.collection("hotelBookings").where("ownerUid", "==", owner).where("paidAt", ">=", start).where("paidAt", "<=", end).get(),
    c.db.collection("hotelOrders").where("ownerUid", "==", owner).where("billSettledAt", ">=", start).where("billSettledAt", "<=", end).get(),
  ]);
  const branches = Object.fromEntries(hotels.docs.map((d) => [d.id, String(d.get("branch") || d.get("name"))]));
  const orders = new Map([...o.docs, ...billed.docs].map((d) => [d.id, d.data() as Order]));
  const ok = (x: { late?: unknown }) => !x.late;
  return { month: m, branches, ...monthReport([...orders.values()].filter(ok), b.docs.map((d) => d.data() as Booking).filter(ok), branches, m) };
}
export async function chatsView(c: Ctx) {
  may(c, "chats");
  feature(c, "conversations", "Conversations");
  const snap = await c.db.collection("hotelChats").where("hotelId", "==", c.hotel.id).orderBy("at", "desc").limit(50).get().catch(async () => c.db.collection("hotelChats").where("hotelId", "==", c.hotel.id).get());
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as { channel: string; at: string; guest: string; messages: { role: string; text: string }[]; steps: { tool: string; input: string; result: string }[]; orderId?: string }) })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
}

// ---- Set it up for me: a request that reaches our team (Admin → Leads) ----
export async function requestSetup(db: Firestore, who: { uid: string | null; email: string | null }, raw: Record<string, unknown>, now = new Date()) {
  const name = t(raw.name, 80), email = cleanEmail(raw.email) || cleanEmail(who.email), hotel = t(raw.hotel, 80);
  need(name && email, "Enter your name and email address.");
  need(hotel, "Tell us the hotel's name.");
  const rooms = Math.max(0, Math.min(5000, Math.floor(Number(raw.rooms) || 0)));
  const message = [`Hotel: ${hotel}${t(raw.city, 60) ? `, ${t(raw.city, 60)}` : ""}`, rooms ? `Rooms: ${rooms}` : "", `Departments: ${t(raw.departments, 200) || "not said"}`, `Phone: ${cleanPhone(raw.phone) || "not given"}`, para(raw.note, 1000)].filter(Boolean).join("\n");
  const ref = db.collection("leads").doc();
  await ref.set({ name, email, category: "hotel-setup", message, status: "new", createdAt: iso(now), ...(who.uid ? { uid: who.uid } : {}) });
  if (who.uid) await notifyBell({ uid: who.uid, type: "hotel", linkHref: "/hotels", message: "We've got your Set it up for me request. Our team will be in touch to fill in your Hotel kit." }).catch(() => {});
  return { id: ref.id };
}

// ---- The sweep (the reminders job): holds that ran out are released; till card sales the machine never answered are cancelled ----
export async function sweepHolds(db: Firestore, now = new Date()): Promise<number> {
  const at = iso(now);
  let n = 0;
  const [b, o] = await Promise.all([db.collection("hotelBookings").where("status", "==", "held").where("holdUntil", "<=", at).limit(300).get(), db.collection("hotelOrders").where("status", "==", "awaiting_payment").where("holdUntil", "<=", at).limit(300).get()]);
  const touched = new Set<string>();
  for (const d of b.docs) {
    const ok = await db.runTransaction(async (tx) => { const x = await tx.get(d.ref); if (x.get("status") !== "held" || String(x.get("holdUntil")) > at) return false; tx.update(d.ref, { status: "expired", expiredAt: at }); return true; });
    if (ok) { n++; touched.add(String(d.get("hotelId"))); }
  }
  for (const d of o.docs) {
    const ok = await db.runTransaction(async (tx) => { const x = await tx.get(d.ref); if (x.get("status") !== "awaiting_payment" || String(x.get("holdUntil")) > at) return false; tx.update(d.ref, { status: "expired", expiredAt: at }); return true; });
    if (ok) { n++; touched.add(String(d.get("hotelId"))); }
  }
  for (const h of touched) await bumpPulse(db, h, now);
  return n;
}
export type { AddonId };
