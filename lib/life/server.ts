import type { Firestore } from "firebase-admin/firestore";
const COMING_CITY_IDS = ["lagos", "port_harcourt"];
import {
  CITY, DEALS, FOOD, FOOD_MODES, GAME_DAY_MS, GAME_HOUR_MS, HOTEL_OF, ITEM, JOB, MONTH_DAYS, NEGOTIATE_CHANCE, ORDER_MAX_ITEMS, RECIPE, RENT_NAIRA,
  SHIFT_MS, START_NAIRA, STARTER_ITEMS, TRANSPORT_OF, bestOwned, cookingSkill, fmtN, jobBlocker, netWorth, shiftPay, FUEL_NAIRA, RESIDENTS, nepaAt, type FoodMode,
  swimSkill, hotelCheckout, lodged, worldTime, DW_COURSE, DW_CLASS_HOURS, DW_CLASS_MS, DW_CLASS_EFFECT, dwOpen, giveawayOn, giveawayEligible, giveawayWeek, giveawayPrize, GIVEAWAY, OUTLET, OUTLET_AREAS, OUTLET_BACKUP, STAFF_PERKS, isStaff, itemPrice, hotelPrice, outletBlocker, outletPrice, outletTakings, shiftExtra, type Outlet, type OutletArea,
  ERRAND, STREET_OF, BARBER_STREET_MS, errandBlocker, worldDay, MARKET_SHOPS, CONVOY, convoyAt, convoyNextFor, lifeDay, RESTROOM, restroomBoost, LUX_COURSE, LUX_CLASS_HOURS, LUX_CLASS_EFFECT,
} from "./catalog";

// Server-only. Notes Life money and ownership: lifePlayers/{uid} (the player, read by the owner, written only here) and lifeTx/{id}
// (their Notesville Naira statement). Every price comes from lib/life/catalog.ts, never from the browser; earnings are time-checked.

export class LifeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type Deal = { who: string; from: string; ask: string; cost: number; pay: number; hours: number; state: "offered" | "active"; offeredAt: number; dueAt?: number };
export type LifePlayer = {
  uid: string; username: string; name: string; avatar: string; city: string; startedAt: number;
  naira: number; owned: string[]; cooks: number; reputation: number; dealsDone: number; shifts: number; chefShifts: number; itelShifts: number; hotelShifts: number;
  outlets: Outlet[]; swimLessons: number; swims: number; gymSessions: number; cityNotify: string[];
  certs: string[]; dwCourses: Record<string, number>; dwClassAt: number; techShifts: number; giveawayWeek: number; // Digital Witch: certificates, classes done per course enrolled, last class, tech shifts, last giveaway week
  hotelUntil: number; // a Candellux suite: yours till this checkout time (11 AM game time), 0 when you have none
  errand: { id: string; endsAt: number; pay: number } | null; errandDay: number; errandsDone: string[]; errands: number; convoyAt: number; lastSwimAt: number; lastVipAt: number; luxShifts: number; luxCourses: Record<string, number>; luxCerts: string[]; luxClassAt: number; // LUXNAS: shifts, academy classes per course, certificates, last class; // last swim (pool or lesson) and last VIP bar visit, for the restrooms; // convoyAt: when Emerald's convoy last gave you a gift. Errands: the one running, today's (game day) done list, all done

  jobId: string | null; shift: { jobId: string; startedAt: number; endsAt: number; pay: number } | null;
  deal: Deal | null; lastDealAt: number; rentMonths: number; rentOwed: number; barberUntil: number; gymUntil: number;
  netWorth: number; updatedAt: number; createdAt: number;
  referredBy: string | null; referralPaid: boolean; invitesDone: number;
};
type Line = { amount: number; label: string; kind: string };

const ref = (db: Firestore, uid: string) => db.doc(`lifePlayers/${uid}`);
const num = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
function outletsOf(v: unknown): Outlet[] {
  if (!Array.isArray(v)) return [];
  return v.filter((o) => o && OUTLET(String(o.kind))).map((o) => ({ kind: o.kind, area: o.area === "garki" ? "garki" : "wuse", openedAt: num(o.openedAt), lastCollectAt: num(o.lastCollectAt), earned: num(o.earned), backup: o.backup === true }));
}

function fromDoc(uid: string, d: FirebaseFirestore.DocumentData | undefined, profile: { username: string; name: string; avatar: string }, now: number): { p: LifePlayer; fresh: boolean } {
  // A player who bought Notesville Naira before ever playing has a doc with only `naira`: they start now, with that on top.
  const fresh = !d || !num(d.startedAt);
  const owned = Array.isArray(d?.owned) ? (d!.owned as string[]).filter((i) => !!ITEM(i)) : [];
  for (const s of STARTER_ITEMS) if (!owned.includes(s)) owned.push(s);
  const p: LifePlayer = {
    uid, username: profile.username, name: profile.name, avatar: profile.avatar, city: String(d?.city ?? CITY.id),
    startedAt: fresh ? now : num(d!.startedAt), naira: fresh ? START_NAIRA + num(d?.naira) : num(d!.naira), owned,
    cooks: num(d?.cooks), reputation: num(d?.reputation), dealsDone: num(d?.dealsDone), shifts: num(d?.shifts), chefShifts: num(d?.chefShifts),
    itelShifts: num(d?.itelShifts), hotelShifts: num(d?.hotelShifts), outlets: outletsOf(d?.outlets),
    swimLessons: num(d?.swimLessons), swims: num(d?.swims), gymSessions: num(d?.gymSessions),
    certs: Array.isArray(d?.certs) ? (d!.certs as string[]).filter((c) => !!DW_COURSE(c)) : [],
    dwCourses: Object.fromEntries(Object.entries((d?.dwCourses ?? {}) as Record<string, unknown>).filter(([k]) => !!DW_COURSE(k)).map(([k, v]) => [k, num(v)])),
    dwClassAt: num(d?.dwClassAt), techShifts: num(d?.techShifts), giveawayWeek: num(d?.giveawayWeek, -1), hotelUntil: num(d?.hotelUntil),
    errand: d?.errand && ERRAND(String(d.errand.id)) ? { id: String(d.errand.id), endsAt: num(d.errand.endsAt), pay: num(d.errand.pay) } : null, errandDay: num(d?.errandDay, -1), errandsDone: Array.isArray(d?.errandsDone) ? (d!.errandsDone as unknown[]).map(String).filter((x) => !!ERRAND(x)) : [], errands: num(d?.errands), convoyAt: num(d?.convoyAt), lastSwimAt: num(d?.lastSwimAt), lastVipAt: num(d?.lastVipAt), luxShifts: num(d?.luxShifts), luxClassAt: num(d?.luxClassAt),
    luxCourses: Object.fromEntries(Object.entries((d?.luxCourses ?? {}) as Record<string, unknown>).filter(([k]) => !!LUX_COURSE(k)).map(([k, v]) => [k, num(v)])), luxCerts: Array.isArray(d?.luxCerts) ? (d!.luxCerts as unknown[]).map(String).filter((c) => !!LUX_COURSE(c)) : [],
    cityNotify: Array.isArray(d?.cityNotify) ? (d!.cityNotify as string[]).filter((c) => COMING_CITY_IDS.includes(c)) : [],
    jobId: typeof d?.jobId === "string" ? d.jobId : null, shift: d?.shift ?? null, deal: d?.deal ?? null, lastDealAt: num(d?.lastDealAt, now),
    rentMonths: num(d?.rentMonths), rentOwed: num(d?.rentOwed), barberUntil: num(d?.barberUntil), gymUntil: num(d?.gymUntil),
    netWorth: 0, updatedAt: now, createdAt: fresh ? now : num(d?.createdAt, now),
    referredBy: typeof d?.referredBy === "string" ? d.referredBy : null, referralPaid: d?.referralPaid === true, invitesDone: num(d?.invitesDone),
  };
  return { p, fresh };
}

// Rent: N$ 60,000 every 30 game days (24 real hours) from the day you started, paid automatically while you can; what you can't pay is owed.
function settleRent(p: LifePlayer, now: number, lines: Line[]) {
  const due = Math.floor((now - p.startedAt) / (MONTH_DAYS * GAME_DAY_MS));
  while (p.rentMonths < due && p.naira >= RENT_NAIRA) { p.naira -= RENT_NAIRA; p.rentMonths += 1; lines.push({ amount: -RENT_NAIRA, label: `Rent, month ${p.rentMonths}`, kind: "rent" }); }
  p.rentOwed = Math.max(0, due - p.rentMonths) * RENT_NAIRA;
}

export function view(p: LifePlayer, now = Date.now()) {
  return { ...p, cooking: cookingSkill(p.cooks), swimming: swimSkill(p.swimLessons, p.swims), serverNow: now };
}

async function profileOf(db: Firestore, uid: string) {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || !u.username) throw new LifeError(403, "Finish setting up your NotesApp profile first.");
  if (u.suspended === true) throw new LifeError(403, "Your account can't play right now.");
  return { username: String(u.username), name: String(u.displayName ?? u.username), avatar: String(u.avatar ?? "") };
}

// Reads the player (creating them on first play), settles rent, runs `fn`, and writes the player and their statement lines together.
export async function mutate<T>(db: Firestore, uid: string, fn: (p: LifePlayer, lines: Line[], now: number) => T, now = Date.now(), invitedBy?: string | null): Promise<{ player: LifePlayer; result: T }> {
  const profile = await profileOf(db, uid);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref(db, uid));
    const { p, fresh } = fromDoc(uid, snap.data(), profile, now);
    const lines: Line[] = [];
    if (fresh) lines.push({ amount: START_NAIRA, label: "Welcome to Notes Life", kind: "start" });
    // Who invited you is recorded only when you first start (and never yourself).
    if (fresh && invitedBy && invitedBy !== uid && !p.referredBy) p.referredBy = invitedBy;
    settleRent(p, now, lines);
    const result = fn(p, lines, now);
    settleRent(p, now, lines); // money that just came in pays rent that was owed
    p.netWorth = netWorth(p.naira, p.owned, p.outlets);
    p.updatedAt = now;
    t.set(ref(db, uid), p);
    lines.forEach((l, i) => t.set(db.doc(`lifeTx/${uid}_${now}_${i}`), { uid, ...l, at: now }));
    return { player: p, result };
  });
}

const debit = (p: LifePlayer, lines: Line[], amount: number, label: string, kind: string) => {
  if (!Number.isInteger(amount) || amount < 0) throw new LifeError(400, "That price isn't right.");
  if (p.naira < amount) throw new LifeError(402, `Not enough Notesville Naira: this costs ${fmtN(amount)} and you have ${fmtN(p.naira)}.`);
  if (amount > 0) { p.naira -= amount; lines.push({ amount: -amount, label, kind }); }
};
const credit = (p: LifePlayer, lines: Line[], amount: number, label: string, kind: string) => { p.naira += amount; lines.push({ amount, label, kind }); };

export type Action =
  | { action: "buy"; item: string }
  | { action: "food"; mode: FoodMode; items: { id: string; qty: number }[] }
  | { action: "travel"; mode: string; to: string }
  | { action: "cook"; recipe: string }
  | { action: "hotel"; service: string }
  | { action: "job_apply"; job: string }
  | { action: "job_quit" }
  | { action: "shift_start"; needsLow: boolean }
  | { action: "shift_finish" }
  | { action: "shift_cancel" }
  | { action: "deal_ring" }
  | { action: "deal_answer"; answer: "accept" | "negotiate" | "decline" }
  | { action: "deal_collect" }
  | { action: "fuel"; litres: number }
  | { action: "outlet_open"; outlet: string; area?: string }
  | { action: "outlet_collect"; outlet?: string }
  | { action: "outlet_backup"; outlet: string }
  | { action: "city_notify"; city: string }
  | { action: "dw_enroll"; course: string }
  | { action: "dw_class"; course: string }
  | { action: "dw_giveaway" }
  | { action: "errand_start"; errand: string }
  | { action: "errand_finish" }
  | { action: "errand_cancel" }
  | { action: "street"; service: string }
  | { action: "convoy_gift" }
  | { action: "restroom"; at: string }
  | { action: "lux_enroll"; course: string }
  | { action: "lux_class"; course: string };

export async function act(db: Firestore, uid: string, a: Action, now = Date.now(), rand: () => number = Math.random) {
  return mutate(db, uid, (p, lines) => {
    switch (a.action) {
      case "buy": {
        const it = ITEM(String(a.item));
        if (!it || it.starter) throw new LifeError(400, "That isn't for sale.");
        if (it.soon) throw new LifeError(409, `${it.name} is coming soon.`);
        if (p.owned.includes(it.id)) throw new LifeError(409, "You already own that.");
        if (it.needs && !p.owned.includes(it.needs)) throw new LifeError(409, `Get the ${ITEM(it.needs)?.name ?? "base item"} first: this plugs into it.`);
        const staff = it.brand === "itel" && isStaff(p.jobId, "itel");
        const price = itemPrice(it, p.jobId);
        debit(p, lines, price, staff ? `${it.name} (itel staff price)` : it.name, "buy");
        p.owned.push(it.id);
        return { message: `${it.name} is yours${staff ? ` at the staff price, ${fmtN(price)}` : ""}.`, price };
      }
      case "food": {
        const mode = FOOD_MODES[a.mode];
        if (!mode) throw new LifeError(400, "Choose delivery, takeaway or dine-in.");
        const items = Array.isArray(a.items) ? a.items : [];
        const qty = items.reduce((n, i) => n + Math.max(0, Math.floor(Number(i.qty) || 0)), 0);
        if (!qty || qty > ORDER_MAX_ITEMS) throw new LifeError(400, `Order 1 to ${ORDER_MAX_ITEMS} items.`);
        let total = mode.fee, hunger = 0;
        for (const i of items) { const f = FOOD(String(i.id)); const q = Math.max(0, Math.floor(Number(i.qty) || 0)); if (!f) throw new LifeError(400, "That isn't on the menu."); total += f.price * q; hunger += f.hunger * q; }
        debit(p, lines, total, `Chef Adams · ${mode.label.toLowerCase()}`, "food");
        return { hunger: Math.min(100, hunger), minutes: mode.minutes, fun: mode.fun, social: mode.social, total };
      }
      case "travel": {
        const tr = TRANSPORT_OF(String(a.mode));
        if (!tr) throw new LifeError(400, "Choose how to get there.");
        if (tr.needs && !p.owned.includes(tr.needs)) throw new LifeError(403, `You don't have ${tr.name.replace(/^Your /, "a ")} yet.`);
        debit(p, lines, tr.price, `${tr.name} to ${String(a.to || "town")}`, "travel");
        return { minutes: tr.minutes, energy: tr.energy };
      }
      case "cook": {
        const r = RECIPE(String(a.recipe));
        if (!r) throw new LifeError(400, "Choose a recipe.");
        if (!p.owned.includes("cooker")) throw new LifeError(403, "Buy a small cooker first (Shop → Kitchen).");
        debit(p, lines, r.cost, `Ingredients: ${r.name}`, "food");
        p.cooks += 1;
        return { minutes: r.minutes, plates: r.plates, hunger: r.hunger, skill: cookingSkill(p.cooks) };
      }
      case "hotel": {
        const h = HOTEL_OF(String(a.service));
        if (!h || h.soon) throw new LifeError(400, "That isn't open yet.");
        if (h.id === "suite" && lodged(p.hotelUntil, now)) throw new LifeError(409, `Your suite is yours till ${worldTime(p.hotelUntil).label} checkout. Go up to your room.`);
        const half = isStaff(p.jobId, "candellux") && STAFF_PERKS.hotelHalf.includes(h.id);
        debit(p, lines, hotelPrice(h, p.jobId), `Candellux · ${h.name}${half ? " (staff, half price)" : ""}`, "hotel");
        if (h.boost === "barber") p.barberUntil = now + GAME_DAY_MS;
        if (h.boost === "gym") { p.gymUntil = now + GAME_DAY_MS; p.gymSessions += 1; }
        if (h.id === "lesson") p.swimLessons += 1;
        if (h.id === "pool") p.swims += 1;
        if (h.id === "pool" || h.id === "lesson") p.lastSwimAt = now;
        if (h.id === "vipbar") p.lastVipAt = now;
        if (h.id === "suite") p.hotelUntil = hotelCheckout(now);
        // staying at the hotel: the restaurant sends food up as room service, and it fills you up
        if (h.id === "restaurant" && lodged(p.hotelUntil, now)) return { minutes: h.minutes, effect: { fun: 10 }, set: { hunger: 100 }, boost: null, roomService: true };
        return { minutes: h.minutes, effect: h.effect, set: h.set ?? null, boost: h.boost ?? null, checkout: h.id === "suite" ? p.hotelUntil : null };
      }
      case "job_apply": {
        const j = JOB(String(a.job));
        if (!j) throw new LifeError(400, "That job doesn't exist.");
        if (p.shift) throw new LifeError(409, "Finish your shift first.");
        const block = jobBlocker(j, { owned: p.owned, cooking: cookingSkill(p.cooks), chefShifts: p.chefShifts, itelShifts: p.itelShifts, hotelShifts: p.hotelShifts, luxShifts: p.luxShifts, luxCerts: p.luxCerts, reputation: p.reputation, fit: p.gymUntil > now, swim: swimSkill(p.swimLessons, p.swims), gymSessions: p.gymSessions, certs: p.certs });
        if (block) throw new LifeError(403, block);
        p.jobId = j.id;
        return { message: `You're hired: ${j.title}, ${j.employer.split(" · ")[0]}.` };
      }
      case "job_quit": {
        if (p.shift) throw new LifeError(409, "Finish your shift first.");
        p.jobId = null;
        return { message: "You've left your job." };
      }
      case "fuel": {
        const gen = ["gen_big", "gen_small"].map(ITEM).find((g) => g && p.owned.includes(g.id));
        if (!gen) throw new LifeError(409, "You don't have a generator.");
        const litres = Math.floor(Number(a.litres));
        if (!Number.isInteger(litres) || litres < 1 || litres > (gen.tank ?? 5)) throw new LifeError(400, `Buy 1 to ${gen.tank ?? 5} litres (your tank's size).`);
        debit(p, lines, litres * FUEL_NAIRA, `Petrol: ${litres} L`, "fuel");
        return { litres, tank: gen.tank ?? 5 };
      }
      case "shift_start": {
        const j = p.jobId ? JOB(p.jobId) : undefined;
        if (!j) throw new LifeError(409, "Get a job first (Phone → Jobs).");
        if (p.shift) throw new LifeError(409, "You're already on a shift.");
        if (p.errand) throw new LifeError(409, "Finish your errand first.");
        // NEPA: the old desktop needs power. A laptop runs on its own battery; a Power GO or a generator keeps the desktop going.
        const backup = ["power_go", "power_tank", "gen_small", "gen_big", "home_kit"].some((i) => p.owned.includes(i));
        if (j.place === "home" && nepaAt(now).out && !backup && !p.owned.includes("pc_laptop") && !p.owned.includes("pc_aio"))
          throw new LifeError(409, "NEPA has taken light and your old desktop needs power. Get a Power GO Pro or Power Tank at itel Energy, or a generator, or wait for light.");
        p.shift = { jobId: j.id, startedAt: now, endsAt: now + SHIFT_MS, pay: shiftPay(j, p.owned, !!a.needsLow) };
        return { endsAt: p.shift.endsAt, pay: p.shift.pay };
      }
      case "shift_finish": {
        if (!p.shift) throw new LifeError(409, "You're not on a shift.");
        if (now < p.shift.endsAt - 3_000) throw new LifeError(409, "The shift isn't over yet.");
        const j = JOB(p.shift.jobId);
        credit(p, lines, p.shift.pay, `Shift: ${j?.title ?? "work"}`, "pay");
        const extra = j ? shiftExtra(j, rand) : 0;
        if (extra > 0) credit(p, lines, extra, `${j!.extra!.label}: ${j!.title}`, "pay");
        p.shifts += 1;
        if (j?.brand === "chef_adams") p.chefShifts += 1;
        if (j?.brand === "itel") p.itelShifts += 1;
        if (j?.brand === "candellux") p.hotelShifts += 1;
        if (j?.brand === "luxnas") p.luxShifts += 1;
        if (j?.tech) p.techShifts += 1;
        const pay = p.shift.pay + extra;
        p.shift = null;
        // A finished shift is when an invite counts: lib/life/referral.ts pays the Bonus Credits after this (once; a friend whose email
        // wasn't verified at their first shift gets it after a later one).
        return { pay, extra, extraLabel: j?.extra?.label ?? null, meal: j?.meal ?? 0, firstShift: p.shifts === 1, referral: p.referredBy && !p.referralPaid ? p.referredBy : null };
      }
      case "shift_cancel": {
        p.shift = null;
        return { message: "Shift stopped. No pay for a shift you didn't finish." };
      }
      case "deal_ring": {
        if (p.deal) return { deal: p.deal };
        const phone = bestOwned(p.owned, "phone");
        const every = (phone?.dealEveryHours ?? 8) * GAME_HOUR_MS;
        if (now - p.lastDealAt < every) return { deal: null, nextAt: p.lastDealAt + every };
        const tpl = DEALS[Math.floor(rand() * DEALS.length) % DEALS.length];
        const k = (phone?.dealBoost ?? 1) * (1 + 0.05 * Math.floor(p.reputation));
        p.deal = { ...tpl, cost: Math.round(tpl.cost * (phone?.dealBoost ?? 1)), pay: Math.round(tpl.pay * k), state: "offered", offeredAt: now };
        return { deal: p.deal };
      }
      case "deal_answer": {
        if (!p.deal || p.deal.state !== "offered") throw new LifeError(409, "There's no call waiting.");
        if (a.answer === "decline") { p.deal = null; p.lastDealAt = now; return { message: "You let that one go." }; }
        if (a.answer === "negotiate") {
          const chance = NEGOTIATE_CHANCE + (p.barberUntil > now ? 0.1 : 0);
          if (rand() >= chance) { const who = p.deal.who; p.deal = null; p.lastDealAt = now; return { message: `${who} said no and hung up.`, lost: true }; }
          p.deal.pay = Math.round(p.deal.pay * 1.1);
        }
        debit(p, lines, p.deal.cost, `Deal with ${p.deal.who}: goods`, "deal");
        p.deal.state = "active";
        p.deal.dueAt = now + p.deal.hours * GAME_HOUR_MS;
        return { deal: p.deal, message: a.answer === "negotiate" ? `${p.deal.who} agreed to ${fmtN(p.deal.pay)}.` : "Deal on." };
      }
      case "deal_collect": {
        if (!p.deal || p.deal.state !== "active") throw new LifeError(409, "No deal to deliver.");
        if (now < (p.deal.dueAt ?? 0) - 3_000) throw new LifeError(409, "It isn't ready yet.");
        credit(p, lines, p.deal.pay, `Deal with ${p.deal.who}`, "deal");
        p.reputation = Math.min(5, p.reputation + 0.5);
        p.dealsDone += 1;
        const pay = p.deal.pay;
        p.deal = null;
        p.lastDealAt = now;
        return { pay };
      }
      case "outlet_open": {
        const t = OUTLET(String(a.outlet));
        if (!t) throw new LifeError(400, "Choose an outlet.");
        const area: OutletArea = a.area === "garki" ? "garki" : "wuse";
        const block = outletBlocker(t, p, now);
        if (block) throw new LifeError(403, block);
        const price = outletPrice(t, area);
        debit(p, lines, price, `${t.name}, ${OUTLET_AREAS[area].name}`, "outlet");
        p.outlets.push({ kind: t.id, area, openedAt: now, lastCollectAt: now, earned: 0, backup: false });
        return { message: `Your ${t.name} in ${OUTLET_AREAS[area].name} is open. Residents run it while you're away.` };
      }
      case "outlet_collect": {
        let total = 0;
        for (const o of p.outlets) {
          if (a.outlet && o.kind !== a.outlet) continue;
          const { takings } = outletTakings(o, now);
          if (takings > 0) credit(p, lines, takings, `Takings: ${OUTLET(o.kind)!.name}`, "outlet");
          o.earned += takings; o.lastCollectAt = now; total += takings;
        }
        if (a.outlet && !p.outlets.some((o) => o.kind === a.outlet)) throw new LifeError(404, "You don't own that outlet.");
        return { total };
      }
      case "outlet_backup": {
        const o = p.outlets.find((x) => x.kind === a.outlet);
        if (!o) throw new LifeError(404, "You don't own that outlet.");
        if (o.backup) throw new LifeError(409, "It already has backup power.");
        // Takings so far are collected first, so the backup counts only from now.
        const { takings } = outletTakings(o, now);
        if (takings > 0) { credit(p, lines, takings, `Takings: ${OUTLET(o.kind)!.name}`, "outlet"); o.earned += takings; }
        o.lastCollectAt = now;
        debit(p, lines, OUTLET_BACKUP.price, `Backup power: ${OUTLET(o.kind)!.short}`, "outlet");
        o.backup = true;
        return { message: "Backup power fitted: it sells through every blackout now.", total: takings };
      }
      // ---- Digital Witch: pay for a course, take its classes (one every 2 game hours, 9 AM to 6 PM), get certified ----
      case "dw_enroll": {
        const c = DW_COURSE(String(a.course));
        if (!c) throw new LifeError(400, "Choose a course.");
        if (p.certs.includes(c.id)) throw new LifeError(409, `You're already Digital Witch certified in ${c.name}.`);
        if (c.id in p.dwCourses) throw new LifeError(409, `You're already on the ${c.name} course.`);
        debit(p, lines, c.price, `Digital Witch · ${c.name} course`, "dw");
        p.dwCourses = { ...p.dwCourses, [c.id]: 0 };
        return { message: `You're enrolled: ${c.name}, ${c.classes} classes at the hub.` };
      }
      case "dw_class": {
        const c = DW_COURSE(String(a.course));
        if (!c) throw new LifeError(400, "Choose a course.");
        if (p.certs.includes(c.id)) throw new LifeError(409, `You're already certified in ${c.name}.`);
        if (!(c.id in p.dwCourses)) throw new LifeError(403, `Pay for the ${c.name} course first.`);
        if (!dwOpen(now)) throw new LifeError(409, "Classes run from 9 AM to 6 PM. Come back in the morning.");
        if (now < p.dwClassAt + DW_CLASS_MS - 3_000) throw new LifeError(409, "You're in a class already. One class at a time.");
        const done = (p.dwCourses[c.id] ?? 0) + 1;
        p.dwCourses = { ...p.dwCourses, [c.id]: done };
        p.dwClassAt = now;
        const cert = done >= c.classes;
        if (cert) p.certs = [...p.certs, c.id];
        return { minutes: DW_CLASS_HOURS * 60, effect: DW_CLASS_EFFECT, done, of: c.classes, cert };
      }
      case "dw_giveaway": {
        if (!giveawayOn(now)) throw new LifeError(409, "Cynthia's graduate giveaway is on Saturday nights, 7 PM to 11 PM, at the Candellux VIP bar.");
        if (!giveawayEligible(p.certs, p.techShifts)) throw new LifeError(403, `The giveaway is for Digital Witch graduates who are doing well: a certificate and ${GIVEAWAY.needTechShifts} tech shifts (you have ${p.certs.length ? "a certificate" : "no certificate"} and ${p.techShifts} tech shift${p.techShifts === 1 ? "" : "s"}).`);
        const week = giveawayWeek(now);
        if (p.giveawayWeek === week) throw new LifeError(409, "You've been to this week's giveaway. Come back next Saturday.");
        p.giveawayWeek = week;
        const prize = giveawayPrize(rand());
        if (prize > 0) credit(p, lines, prize, "Cynthia Okeh's graduate giveaway (Digital Witch)", "giveaway");
        return { prize };
      }
      // ---- Wuse Market Street: errands (paid when done, each once a game day) and the stalls ----
      case "errand_start": {
        const e = ERRAND(String(a.errand));
        if (!e) throw new LifeError(400, "That errand doesn't exist.");
        if (p.shift) throw new LifeError(409, "Finish your shift first.");
        if (p.errand) throw new LifeError(409, "Finish the errand you're on first.");
        const day = worldDay(now);
        if (p.errandDay !== day) { p.errandDay = day; p.errandsDone = []; }
        const block = errandBlocker(e, { done: p.errandsDone, reputation: p.reputation }, now);
        if (block) throw new LifeError(409, block);
        p.errand = { id: e.id, endsAt: now + e.minutes * GAME_HOUR_MS / 60, pay: e.pay };
        return { endsAt: p.errand.endsAt, minutes: e.minutes };
      }
      case "errand_finish": {
        if (!p.errand) throw new LifeError(409, "You're not on an errand.");
        if (now < p.errand.endsAt - 3_000) throw new LifeError(409, "The errand isn't done yet.");
        const e = ERRAND(p.errand.id)!;
        const day = worldDay(now);
        if (p.errandDay !== day) { p.errandDay = day; p.errandsDone = []; }
        if (p.errand.pay > 0) credit(p, lines, p.errand.pay, `Errand: ${e.title}`, "pay");
        if (e.reputation) p.reputation = Math.min(5, Math.round((p.reputation + e.reputation) * 10) / 10);
        if (!p.errandsDone.includes(e.id)) p.errandsDone.push(e.id);
        p.errands += 1;
        const pay = p.errand.pay;
        p.errand = null;
        return { pay, reputation: e.reputation ?? 0, title: e.title, who: e.who ?? null };
      }
      case "errand_cancel": {
        p.errand = null;
        return { message: "Errand stopped. No pay for an errand you didn't finish." };
      }
      case "street": {
        const x = STREET_OF(String(a.service));
        if (!x) throw new LifeError(400, "That isn't sold here.");
        if (x.hours && !(worldTime(now).hour >= x.hours[0] && worldTime(now).hour < x.hours[1])) throw new LifeError(409, `${MARKET_SHOPS[x.spot].name} is closed now.`);
        debit(p, lines, x.price, `${MARKET_SHOPS[x.spot].name} · ${x.name}`, "food");
        if (x.barber) p.barberUntil = Math.max(p.barberUntil, now + BARBER_STREET_MS);
        return { minutes: x.minutes, effect: x.effect };
      }
      case "convoy_gift": {
        if (!convoyAt(now).on) throw new LifeError(409, "Emerald's convoy isn't at the Wuse bus stand right now.");
        const next = convoyNextFor(p.convoyAt);
        if (now < next) throw new LifeError(409, `Emerald already gave you a gift. He gives each person once every ${CONVOY.everyDays} game days: you can be lucky again from day ${lifeDay(p.startedAt, next)}.`);
        p.convoyAt = now;
        credit(p, lines, CONVOY.gift, "Gift from Emerald Ezurukam at the Wuse bus stand", "gift");
        return { gift: CONVOY.gift };
      }
      case "restroom": {
        const r = RESTROOM(String(a.at));
        if (!r) throw new LifeError(400, "There's no restroom like that.");
        const b = restroomBoost(r, p, now);
        if ("blocked" in b) throw new LifeError(403, b.blocked);
        debit(p, lines, b.price, `Wuse Market · ${r.name}`, "food");
        return { need: b.need, pct: b.pct };
      }
      // ---- LUXNAS Academy: pay once for a course, then a class at a time at the LUXNAS shop (9 AM to 6 PM); the last class certifies ----
      case "lux_enroll": {
        const c = LUX_COURSE(String(a.course));
        if (!c) throw new LifeError(400, "Choose a course.");
        if (p.luxCerts.includes(c.id)) throw new LifeError(409, `You're already LUXNAS certified in ${c.name}.`);
        if (c.id in p.luxCourses) throw new LifeError(409, `You're already on the ${c.name} course.`);
        debit(p, lines, c.price, `LUXNAS Academy · ${c.name}`, "dw");
        p.luxCourses = { ...p.luxCourses, [c.id]: 0 };
        return { message: `You're enrolled: ${c.name}, ${c.classes} classes at LUXNAS, Wuse Market.` };
      }
      case "lux_class": {
        const c = LUX_COURSE(String(a.course));
        if (!c) throw new LifeError(400, "Choose a course.");
        if (p.luxCerts.includes(c.id)) throw new LifeError(409, `You're already certified in ${c.name}.`);
        if (!(c.id in p.luxCourses)) throw new LifeError(403, `Pay for the ${c.name} course first.`);
        if (!dwOpen(now)) throw new LifeError(409, "LUXNAS Academy classes run from 9 AM to 6 PM.");
        if (now < p.luxClassAt + LUX_CLASS_HOURS * GAME_HOUR_MS - 3_000) throw new LifeError(409, "You're in a class already. One class at a time.");
        const done = (p.luxCourses[c.id] ?? 0) + 1;
        p.luxCourses = { ...p.luxCourses, [c.id]: done };
        p.luxClassAt = now;
        const cert = done >= c.classes;
        if (cert) p.luxCerts = [...p.luxCerts, c.id];
        return { minutes: LUX_CLASS_HOURS * 60, effect: LUX_CLASS_EFFECT, done, of: c.classes, cert };
      }
      case "city_notify": {
        const c = String(a.city);
        if (!COMING_CITY_IDS.includes(c)) throw new LifeError(400, "That city isn't coming yet.");
        if (!p.cityNotify.includes(c)) p.cityNotify.push(c);
        return { message: "We'll tell you when it opens." };
      }
      default:
        throw new LifeError(400, "Unknown action.");
    }
  }, now);
}

// The Billionaires List: the top players by net worth (Notesville Naira plus what they own), and where you stand.
// The Billionaires List: real players, and (unless realOnly) the residents with a fortune, marked npc so the screen shows 🤖.
// `rank` counts everyone shown; `realRank` counts real players only.
// Child profiles (kids mode) are never on anyone's list; a child sees only the residents and themselves (`kidView`).
export async function richList(db: Firestore, uid: string, limit = 20, realOnly = false, kidView = false) {
  const top = kidView ? { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] } : await db.collection("lifePlayers").orderBy("netWorth", "desc").limit(limit + 10).get();
  const me = (await ref(db, uid).get()).data();
  let realRank: number | null = null;
  if (me && !kidView) realRank = (await db.collection("lifePlayers").where("netWorth", ">", num(me.netWorth)).count().get()).data().count + 1;
  type Row = { rank: number; uid: string; username: string; name: string; avatar: string; city: string; netWorth: number; owned: string[]; npc?: { role: string; area: string; icons: string; story?: string } };
  const real: Row[] = top.docs.filter((d) => !d.id.startsWith("kid_")).slice(0, limit).map((d) => { const x = d.data(); return { rank: 0, uid: d.id, username: String(x.username ?? ""), name: String(x.name ?? ""), avatar: String(x.avatar ?? ""), city: String(x.city ?? CITY.id), netWorth: num(x.netWorth), owned: (x.owned as string[] | undefined)?.filter((i) => (ITEM(i)?.price ?? 0) >= 100_000) ?? [] }; });
  const npcs: Row[] = realOnly ? [] : RESIDENTS.filter((r) => r.netWorth).map((r) => ({ rank: 0, uid: `npc:${r.id}`, username: "", name: r.name, avatar: r.photo ?? "", city: CITY.id, netWorth: r.netWorth!, owned: [], npc: { role: r.role, area: r.area, icons: r.owned ?? "", ...(r.story ? { story: r.story } : {}) } }));
  if (kidView && me) real.push({ rank: 0, uid, username: "", name: String(me.name ?? "You"), avatar: "", city: String(me.city ?? CITY.id), netWorth: num(me.netWorth), owned: [] });
  const rows = [...real, ...npcs].sort((a, b) => b.netWorth - a.netWorth).slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
  const npcAbove = me ? npcs.filter((n) => n.netWorth > num(me.netWorth)).length : 0;
  return { rows, me: me ? { rank: realRank === null ? null : realRank + npcAbove, realRank, netWorth: num(me.netWorth) } : null };
}

// The friends who joined Notes Life from your invite link, newest first, and whether the bonus was paid.
export type InviteRow = { uid: string; username: string; name: string; avatar: string; joinedAt: number; status: "paid" | "shift" | "verify" | "limit" };
export async function invites(db: Firestore, uid: string): Promise<{ invites: InviteRow[]; paid: number }> {
  const snap = await db.collection("lifePlayers").where("referredBy", "==", uid).limit(200).get();
  const rows: InviteRow[] = snap.docs.map((d) => {
    const x = d.data();
    const status: InviteRow["status"] = x.referralPaid === true ? (x.referralNote ? "limit" : "paid") : num(x.shifts) > 0 ? "verify" : "shift";
    return { uid: d.id, username: String(x.username ?? ""), name: String(x.name ?? x.username ?? ""), avatar: String(x.avatar ?? ""), joinedAt: num(x.startedAt), status };
  }).sort((a, b) => b.joinedAt - a.joinedAt);
  return { invites: rows.slice(0, 100), paid: rows.filter((r) => r.status === "paid").length };
}

// Friends in the game: people on NotesApp you follow who follow you back, and whether they play.
export async function friends(db: Firestore, uid: string) {
  const me = (await db.doc(`users/${uid}`).get()).data();
  const myName = String(me?.username ?? "");
  if (!myName) return { friends: [] };
  const [following, followers] = await Promise.all([
    db.collection("follows").where("followerUid", "==", uid).limit(400).get(),
    db.collection("follows").where("username", "==", myName).limit(400).get(),
  ]);
  const iFollow = new Set(following.docs.map((d) => String(d.data().username)));
  const uids = Array.from(new Set(followers.docs.map((d) => String(d.data().followerUid)).filter((u) => u && u !== uid && u !== "na-notesapp"))).slice(0, 200);
  if (!uids.length) return { friends: [] };
  const users = await db.getAll(...uids.map((u) => db.doc(`users/${u}`)));
  const mutual = users.filter((s) => s.exists && iFollow.has(String(s.data()?.username)) && s.data()?.suspended !== true).slice(0, 60);
  const plays = mutual.length ? await db.getAll(...mutual.map((s) => ref(db, s.id))) : [];
  return {
    friends: mutual.map((s, i) => ({ uid: s.id, username: String(s.data()!.username), name: String(s.data()!.displayName ?? s.data()!.username), avatar: String(s.data()!.avatar ?? ""), plays: plays[i]?.exists ?? false, netWorth: num(plays[i]?.data()?.netWorth) })),
  };
}

export async function statement(db: Firestore, uid: string, limit = 30) {
  const s = await db.collection("lifeTx").where("uid", "==", uid).orderBy("at", "desc").limit(limit).get();
  return { lines: s.docs.map((d) => ({ id: d.id, ...(d.data() as { amount: number; label: string; kind: string; at: number }) })) };
}
