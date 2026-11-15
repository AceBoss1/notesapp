import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { storedSnapshot } from "./stat-cache";
import {
  DAY_MS, FIRST_VALUE_KEYS, LOOKBACK_DAYS, MATURE_DAYS, cleanTrigger, computeGrowth, decodeTouch, isActive, isChannel, isFirstValue, monthKey,
  signupSource, weekOf, type Channel, type FirstValue, type GrowthReport, type InviteStats, type MemberRow, type Touch, type Trigger,
} from "./growth";

// Server-only. Growth measurement (lib/growth.ts has the rules; docs/GROWTH.md). Collections, all server-only (firestore.rules):
//   growthMembers/{uid}                      the channel that brought a member and a small detail (a creator's username or a campaign;
//                                            none for teens and children), when they joined and installed, the last day they were seen,
//                                            the weeks (1 to 4) they came back in and what brought them back. Never an IP or an address.
//   growthFirst/{uid}_{kind}                 the first time a member reached each kind of first value (created once, never changed)
//   growthDaily/{yyyymmdd}                   new visitors and app installs that day, by channel (counts only)
//   growthCreators/{username}_{yyyymm}       how many times a creator's link was opened that month (a count only)
// The numbers on Admin → Growth are counted from these at most once an hour (lib/stat-cache.ts), never per page view.
export const GROWTH_MAX_AGE_MS = 60 * 60_000;
const dayId = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const today = (d: Date) => d.toISOString().slice(0, 10);

// ---- sign-up: the source goes with the account ----

// Once, for an account a week old at most (like a referral claim). Teens and children keep the channel only.
export async function recordSignupSource(db: Firestore, uid: string, cookie: unknown, opts: { installed?: boolean } = {}, now = new Date()): Promise<{ recorded: boolean; channel?: Channel }> {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u) return { recorded: false };
  const created = Date.parse(String(u.createdAt ?? ""));
  if (!Number.isFinite(created) || now.getTime() - created > 7 * DAY_MS) return { recorded: false };
  const young = u.teen === true || u.kid === true;
  const src = signupSource(decodeTouch(cookie), young);
  const t: Touch | null = decodeTouch(cookie);
  const row: MemberRow & Record<string, unknown> = {
    uid, joinedAt: new Date(created).toISOString(), channel: src.channel, ...(src.detail ? { detail: src.detail } : {}), via: src.via,
    ...(t?.day ? { landedDay: t.day } : {}), young, weeks: [], returns: {}, lastSeenDay: today(now),
    ...(opts.installed ? { installedAt: now.toISOString() } : {}),
  };
  try { await db.doc(`growthMembers/${uid}`).create(row); return { recorded: true, channel: src.channel }; }
  catch (err) { if ((err as { code?: number }).code === 6) return { recorded: false }; throw err; } // already recorded
}

// ---- first value ----

// Remembered per server instance so a member doing the same thing again costs nothing; otherwise one create that fails harmlessly.
const done = new Set<string>();
export async function markFirstValue(db: Firestore, uid: string | null | undefined, kind: FirstValue, now = new Date()): Promise<boolean> {
  if (!uid || !isFirstValue(kind)) return false;
  const id = `${uid}_${kind}`;
  if (done.has(id)) return false;
  try {
    await db.doc(`growthFirst/${id}`).create({ uid, kind, at: now.toISOString() });
    done.add(id);
    return true;
  } catch (err) {
    if ((err as { code?: number }).code === 6) { done.add(id); return false; }
    console.error("growth first value", kind, err);
    return false;
  }
}
// The same, never failing the caller's request (awaited, so it isn't cut off when the response is sent).
export const firstValue = (db: Firestore, uid: string | null | undefined, kind: FirstValue): Promise<boolean> => markFirstValue(db, uid, kind).catch(() => false);
// Forget the memory (tests).
export const _resetFirstValueMemory = () => done.clear();

// ---- visits, creator links and installs ----

// A new visitor (ping "v") counts once into today's visits by channel; a creator's link opened (ping "o") counts for that creator this
// month. Members who are already signed in aren't new visitors.
export async function recordVisit(db: Firestore, p: { touch: Touch | null; ping: string; creator?: string | null; signedIn: boolean }, now = new Date()): Promise<{ visit: boolean; open: boolean }> {
  const out = { visit: false, open: false };
  const batch = db.batch();
  if (p.ping.includes("v") && p.touch && !p.signedIn) {
    batch.set(db.doc(`growthDaily/${dayId(now)}`), { day: today(now), visits: { [p.touch.channel]: FieldValue.increment(1) } }, { merge: true });
    out.visit = true;
  }
  const c = String(p.creator ?? "").toLowerCase();
  if (p.ping.includes("o") && /^[a-z0-9_-]{2,30}$/.test(c)) {
    batch.set(db.doc(`growthCreators/${c}_${monthKey(now)}`), { username: c, month: monthKey(now), opens: FieldValue.increment(1) }, { merge: true });
    out.open = true;
  }
  if (out.visit || out.open) await batch.commit();
  return out;
}

// An app install (the browser's appinstalled event, or the installed app's first open on this device). The device counts once into
// today's installs by the visitor's channel; a signed-in member's account also gets it, once.
export async function recordInstall(db: Firestore, p: { touch: Touch | null; uid?: string | null; countDevice: boolean }, now = new Date()): Promise<{ device: boolean; member: boolean }> {
  const out = { device: false, member: false };
  let channel: Channel = p.touch?.channel ?? "direct";
  if (p.uid) {
    const ref = db.doc(`growthMembers/${p.uid}`);
    out.member = await db.runTransaction(async (t) => {
      const m = (await t.get(ref)).data();
      if (!m) return false;
      if (isChannel(m.channel)) channel = m.channel;
      if (m.installedAt) return false;
      t.update(ref, { installedAt: now.toISOString() });
      return true;
    });
  }
  if (p.countDevice) {
    await db.doc(`growthDaily/${dayId(now)}`).set({ day: today(now), installs: { [channel]: FieldValue.increment(1) } }, { merge: true });
    out.device = true;
  }
  return out;
}

// ---- returns ----

// Once a day per member (the page asks once a day; this writes only when the day changed). A day after the day they joined, up to the
// end of week 4, is a return: its week is marked and what brought them (?r=) counted. Members who joined before measuring began have
// no record and are skipped.
export async function markSeen(db: Firestore, uid: string, r: unknown, now = new Date()): Promise<{ marked: boolean; week?: number }> {
  const ref = db.doc(`growthMembers/${uid}`);
  const m = (await ref.get()).data();
  if (!m) return { marked: false };
  const day = today(now);
  if (m.lastSeenDay === day) return { marked: false };
  const joined = Date.parse(String(m.joinedAt ?? ""));
  const update: Record<string, unknown> = { lastSeenDay: day };
  let week: number | undefined;
  if (Number.isFinite(joined) && day > today(new Date(joined)) && now.getTime() < joined + MATURE_DAYS * DAY_MS) {
    week = weekOf(joined, now.getTime());
    if (week >= 1 && week <= 4) update.weeks = FieldValue.arrayUnion(week);
    const trigger: Trigger = cleanTrigger(r);
    update[`returns.${trigger}`] = FieldValue.increment(1);
  }
  await ref.update(update);
  return { marked: true, ...(week !== undefined ? { week } : {}) };
}

// ---- the snapshot for Admin → Growth ----

export async function gatherGrowth(db: Firestore, now = new Date()): Promise<GrowthReport> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS).toISOString();
  const days: string[] = [];
  for (let i = 0; i <= 90; i++) days.push(dayId(new Date(now.getTime() - i * DAY_MS)));
  const [members, firsts, payments, daily, referrals] = await Promise.all([
    db.collection("growthMembers").where("joinedAt", ">=", since).select("joinedAt", "channel", "detail", "young", "installedAt", "weeks", "lastSeenDay", "returns").get(),
    db.collection("growthFirst").where("at", ">=", since).select("uid", "kind", "at").get(),
    db.collection("payments").where("paidAt", ">=", since).select("uid", "status", "paidAt").get(),
    db.getAll(...days.map((d) => db.doc(`growthDaily/${d}`))),
    db.collection("referrals").where("referredAt", ">=", since).select("referredByUsername", "referredAt").get(),
  ]);
  return computeGrowth({
    members: members.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<MemberRow, "uid">) })),
    firsts: firsts.docs.map((d) => d.data() as { uid: string; kind: string; at: string }),
    // Any successful payment by the member (a refund later doesn't undo that they paid).
    payments: payments.docs.map((d) => d.data()).filter((p) => /^paid/.test(String(p.status ?? "")) || p.status === "refunded").map((p) => ({ uid: String(p.uid ?? ""), at: String(p.paidAt) })),
    daily: daily.filter((d) => d.exists).map((d) => ({ day: String(d.data()!.day), visits: d.data()!.visits ?? {}, installs: d.data()!.installs ?? {} })),
    referrals: referrals.docs.map((d) => ({ uid: d.id, by: String(d.data().referredByUsername ?? ""), at: String(d.data().referredAt ?? "") })).filter((r) => r.by),
  }, now);
}
export async function storedGrowth(db: Firestore, fresh = false): Promise<{ data: GrowthReport; asOf: string }> {
  return storedSnapshot(db, "growth", GROWTH_MAX_AGE_MS, () => gatherGrowth(db), { fresh });
}

// ---- a member's own invite link (Your invite link) ----

// Counts only: opened this month, and of everyone who joined through them (the referral programme, or a first visit through their
// link), how many installed and how many are still active. Teens and children are never among them.
export async function inviteStats(db: Firestore, uid: string, username: string, now = new Date()): Promise<InviteStats> {
  const u = username.toLowerCase();
  const [opens, refs, touched] = await Promise.all([
    u ? db.doc(`growthCreators/${u}_${monthKey(now)}`).get() : null,
    db.collection("referrals").where("referredBy", "==", uid).select().limit(1000).get(),
    u ? db.collection("growthMembers").where("detail", "==", u).select("channel", "young").limit(1000).get() : null,
  ]);
  const uids = new Set(refs.docs.map((d) => d.id));
  for (const d of touched?.docs ?? []) if (d.data().channel === "creators" && d.data().young !== true) uids.add(d.id);
  uids.delete(uid);
  const list = [...uids];
  const rows: FirebaseFirestore.DocumentData[] = [];
  for (let i = 0; i < list.length; i += 300) {
    const snaps = await db.getAll(...list.slice(i, i + 300).map((x) => db.doc(`growthMembers/${x}`)));
    for (const s of snaps) if (s.exists) rows.push(s.data()!);
  }
  const grown = rows.filter((m) => m.young !== true);
  return {
    opened: Number(opens?.data()?.opens ?? 0),
    joined: list.length - (rows.length - grown.length),
    installed: grown.filter((m) => !!m.installedAt).length,
    active: grown.filter((m) => isActive(m.lastSeenDay, now)).length,
  };
}

// Closing an account: its growth records go with it (lib/account-server.ts).
export const growthDocsFor = (db: Firestore, uid: string) => [db.doc(`growthMembers/${uid}`), ...FIRST_VALUE_KEYS.map((k) => db.doc(`growthFirst/${uid}_${k}`))];
