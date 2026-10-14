import type { Firestore } from "firebase-admin/firestore";
import {
  CITY, DEALS, FOOD, FOOD_MODES, GAME_DAY_MS, GAME_HOUR_MS, HOTEL_OF, ITEM, JOB, MONTH_DAYS, NEGOTIATE_CHANCE, ORDER_MAX_ITEMS, RECIPE, RENT_NAIRA,
  SHIFT_MS, START_NAIRA, STARTER_ITEMS, TRANSPORT_OF, bestOwned, cookingSkill, fmtN, jobBlocker, netWorth, shiftPay, type FoodMode,
} from "./catalog";

// Server-only. Notes Life money and ownership: lifePlayers/{uid} (the player, read by the owner, written only here) and lifeTx/{id}
// (their Notesville Naira statement). Every price comes from lib/life/catalog.ts, never from the browser; earnings are time-checked.

export class LifeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type Deal = { who: string; from: string; ask: string; cost: number; pay: number; hours: number; state: "offered" | "active"; offeredAt: number; dueAt?: number };
export type LifePlayer = {
  uid: string; username: string; name: string; avatar: string; city: string; startedAt: number;
  naira: number; owned: string[]; cooks: number; reputation: number; dealsDone: number; shifts: number; chefShifts: number;
  jobId: string | null; shift: { jobId: string; startedAt: number; endsAt: number; pay: number } | null;
  deal: Deal | null; lastDealAt: number; rentMonths: number; rentOwed: number; barberUntil: number; gymUntil: number;
  netWorth: number; updatedAt: number; createdAt: number;
  referredBy: string | null; referralPaid: boolean; invitesDone: number;
};
type Line = { amount: number; label: string; kind: string };

const ref = (db: Firestore, uid: string) => db.doc(`lifePlayers/${uid}`);
const num = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);

function fromDoc(uid: string, d: FirebaseFirestore.DocumentData | undefined, profile: { username: string; name: string; avatar: string }, now: number): { p: LifePlayer; fresh: boolean } {
  // A player who bought Notesville Naira before ever playing has a doc with only `naira`: they start now, with that on top.
  const fresh = !d || !num(d.startedAt);
  const owned = Array.isArray(d?.owned) ? (d!.owned as string[]).filter((i) => !!ITEM(i)) : [];
  for (const s of STARTER_ITEMS) if (!owned.includes(s)) owned.push(s);
  const p: LifePlayer = {
    uid, username: profile.username, name: profile.name, avatar: profile.avatar, city: String(d?.city ?? CITY.id),
    startedAt: fresh ? now : num(d!.startedAt), naira: fresh ? START_NAIRA + num(d?.naira) : num(d!.naira), owned,
    cooks: num(d?.cooks), reputation: num(d?.reputation), dealsDone: num(d?.dealsDone), shifts: num(d?.shifts), chefShifts: num(d?.chefShifts),
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
  return { ...p, cooking: cookingSkill(p.cooks), serverNow: now };
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
    p.netWorth = netWorth(p.naira, p.owned);
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
  | { action: "deal_collect" };

export async function act(db: Firestore, uid: string, a: Action, now = Date.now(), rand: () => number = Math.random) {
  return mutate(db, uid, (p, lines) => {
    switch (a.action) {
      case "buy": {
        const it = ITEM(String(a.item));
        if (!it || it.starter) throw new LifeError(400, "That isn't for sale.");
        if (p.owned.includes(it.id)) throw new LifeError(409, "You already own that.");
        debit(p, lines, it.price, it.name, "buy");
        p.owned.push(it.id);
        return { message: `${it.name} is yours.` };
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
        debit(p, lines, h.price, `Candellux · ${h.name}`, "hotel");
        if (h.boost === "barber") p.barberUntil = now + GAME_DAY_MS;
        if (h.boost === "gym") p.gymUntil = now + GAME_DAY_MS;
        return { minutes: h.minutes, effect: h.effect, set: h.set ?? null, boost: h.boost ?? null };
      }
      case "job_apply": {
        const j = JOB(String(a.job));
        if (!j) throw new LifeError(400, "That job doesn't exist.");
        if (p.shift) throw new LifeError(409, "Finish your shift first.");
        const block = jobBlocker(j, { owned: p.owned, cooking: cookingSkill(p.cooks), chefShifts: p.chefShifts, reputation: p.reputation });
        if (block) throw new LifeError(403, block);
        p.jobId = j.id;
        return { message: `You're hired: ${j.title}, ${j.employer.split(" · ")[0]}.` };
      }
      case "job_quit": {
        if (p.shift) throw new LifeError(409, "Finish your shift first.");
        p.jobId = null;
        return { message: "You've left your job." };
      }
      case "shift_start": {
        const j = p.jobId ? JOB(p.jobId) : undefined;
        if (!j) throw new LifeError(409, "Get a job first (Phone → Jobs).");
        if (p.shift) throw new LifeError(409, "You're already on a shift.");
        p.shift = { jobId: j.id, startedAt: now, endsAt: now + SHIFT_MS, pay: shiftPay(j, p.owned, !!a.needsLow) };
        return { endsAt: p.shift.endsAt, pay: p.shift.pay };
      }
      case "shift_finish": {
        if (!p.shift) throw new LifeError(409, "You're not on a shift.");
        if (now < p.shift.endsAt - 3_000) throw new LifeError(409, "The shift isn't over yet.");
        const j = JOB(p.shift.jobId);
        credit(p, lines, p.shift.pay, `Shift: ${j?.title ?? "work"}`, "pay");
        p.shifts += 1;
        if (j?.brand === "chef_adams") p.chefShifts += 1;
        const pay = p.shift.pay;
        p.shift = null;
        // A finished shift is when an invite counts: lib/life/referral.ts pays the Bonus Credits after this (once; a friend whose email
        // wasn't verified at their first shift gets it after a later one).
        return { pay, firstShift: p.shifts === 1, referral: p.referredBy && !p.referralPaid ? p.referredBy : null };
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
      default:
        throw new LifeError(400, "Unknown action.");
    }
  }, now);
}

// The Billionaires List: the top players by net worth (Notesville Naira plus what they own), and where you stand.
export async function richList(db: Firestore, uid: string, limit = 20) {
  const top = await db.collection("lifePlayers").orderBy("netWorth", "desc").limit(limit).get();
  const me = (await ref(db, uid).get()).data();
  let myRank: number | null = null;
  if (me) myRank = (await db.collection("lifePlayers").where("netWorth", ">", num(me.netWorth)).count().get()).data().count + 1;
  return {
    rows: top.docs.map((d, i) => { const x = d.data(); return { rank: i + 1, uid: d.id, username: String(x.username ?? ""), name: String(x.name ?? ""), avatar: String(x.avatar ?? ""), city: String(x.city ?? CITY.id), netWorth: num(x.netWorth), owned: (x.owned as string[] | undefined)?.filter((i) => (ITEM(i)?.price ?? 0) >= 100_000) ?? [] }; }),
    me: me ? { rank: myRank, netWorth: num(me.netWorth) } : null,
  };
}

// Friends in the game: people on NotesApp you follow who follow you back, and whether they play.
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
