// Admin → Users, on the server (owner, 15 Nov 2026: "build all"): what the list shows beside each member, one member's full picture,
// staff notes, the change history, and the one-click actions. Every part follows the staff member's departments (lib/admin-access.ts):
//   signals      sign-in method, email confirmed, last sign-in, last seen, and "not a duplicate" marks: anyone who opens Users
//   detail       account (everyone) · money: wallet, payments, sales (Finance, Customer care) · activity: bookings, referrals, campus
//                (everyone) · trust: reports and suspension (Customer care, Trust & safety, Legal) · who viewed their details (super
//                admins, Legal) · notes and history (everyone)
//   notes        adminMemberNotes: anyone who opens Users adds; the author (or a super admin) deletes
//   history      adminMemberHistory: every change made on the page, stamped here with who and when
//   actions      notify (one or many, Customer care and Trust & safety), resend the confirmation email and send a password reset link
//                (Customer care), export their data (Legal, super admins; logged), mark two accounts as not duplicates (Customer care,
//                Trust & safety)
// Server-only collections: firestore.rules lets no one in directly.
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import type { Auth, UserRecord } from "firebase-admin/auth";
import { hasAnyDept, hasDept, isSuper, type Access, type Dept } from "./admin-access";
import { revealReason } from "./pii";
import { viewLog } from "./pii-server";

export class MemberError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type Staff = { uid: string; name: string; access: Access };
export const USERS_DEPTS: readonly Dept[] = ["support", "moderation", "finance", "legal"];
const need = (s: Staff, depts: readonly Dept[], what: string) => { if (!hasAnyDept(s.access, depts)) throw new MemberError(`Your role doesn't include ${what}.`, 403); };
const uidOk = (u: unknown): u is string => typeof u === "string" && /^[\w-]{1,128}$/.test(u);
const mustUid = (u: unknown) => { if (!uidOk(u)) throw new MemberError("Which member?"); return u; };

export type Signal = { verified: boolean; providers: string[]; lastSignIn?: string; created?: string; lastSeen?: string; disabled?: boolean; notDuplicateOf?: string[] };

const providersOf = (u: UserRecord) => Array.from(new Set(u.providerData.map((p) => (p.providerId === "password" ? "email" : p.providerId.replace(/\.com$/, "").replace(/^oidc\./, "")))));

// What the list shows beside each member. Nothing personal: whether the email is confirmed, how they sign in, when they last signed in
// and were last seen.
export async function signals(db: Firestore, auth: Pick<Auth, "getUsers">, uids: unknown): Promise<Record<string, Signal>> {
  if (!Array.isArray(uids) || uids.length > 2000 || !uids.every(uidOk)) throw new MemberError("uids must be a list of up to 2000.");
  const out: Record<string, Signal> = {};
  for (let i = 0; i < uids.length; i += 100) {
    const batch = uids.slice(i, i + 100) as string[];
    const [res, pres, flags] = await Promise.all([
      auth.getUsers(batch.map((uid) => ({ uid }))),
      db.getAll(...batch.map((u) => db.doc(`presence/${u}`))),
      db.getAll(...batch.map((u) => db.doc(`adminUserFlags/${u}`))),
    ]);
    for (const u of res.users) {
      out[u.uid] = { verified: u.emailVerified, providers: providersOf(u), lastSignIn: u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).toISOString() : undefined, created: u.metadata.creationTime ? new Date(u.metadata.creationTime).toISOString() : undefined, ...(u.disabled ? { disabled: true } : {}) };
    }
    pres.forEach((p, j) => {
      const ts = p.data()?.lastSeen;
      const ms = ts instanceof Timestamp ? ts.toMillis() : typeof ts === "number" ? ts : null;
      if (ms !== null) out[batch[j]] = { ...(out[batch[j]] ?? { verified: false, providers: [] }), lastSeen: new Date(ms).toISOString() };
    });
    flags.forEach((f, j) => {
      const nd = f.data()?.notDuplicateOf;
      if (Array.isArray(nd) && nd.length) out[batch[j]] = { ...(out[batch[j]] ?? { verified: false, providers: [] }), notDuplicateOf: nd.map(String) };
    });
  }
  return out;
}

const naira = (k: unknown) => Number(k) || 0;
const newest = <T extends Record<string, unknown>>(rows: T[], key: string, n: number) => rows.sort((a, b) => String(b[key] ?? "").localeCompare(String(a[key] ?? ""))).slice(0, n);

// One member's full picture, each part only for the departments it belongs to (a part left out is `null`).
export async function detail(db: Firestore, auth: Pick<Auth, "getUser">, s: Staff, uid: unknown, deps: { wallet?: (uid: string) => Promise<unknown> } = {}) {
  need(s, USERS_DEPTS, "Users");
  const id = mustUid(uid);
  const [profileDoc, authUser, presence, campus, referral, referred] = await Promise.all([
    db.doc(`users/${id}`).get(), auth.getUser(id).catch(() => null), db.doc(`presence/${id}`).get(), db.doc(`campusTeam/${id}`).get(),
    db.doc(`referrals/${id}`).get(), db.collection("referrals").where("referredBy", "==", id).count().get(),
  ]);
  const p = profileDoc.data();
  if (!p) throw new MemberError("That member wasn't found.", 404);
  const lastSeen = presence.data()?.lastSeen;
  const account = {
    uid: id, username: p.username, displayName: p.displayName, role: p.role ?? "reader", tier: p.accountTier ?? "standard", kind: p.accountKind ?? "person",
    createdAt: p.createdAt, suspended: p.suspended === true, trialUntil: p.trialUntil ?? null,
    verified: authUser?.emailVerified ?? false, providers: authUser ? providersOf(authUser) : [], disabled: authUser?.disabled ?? false,
    lastSignIn: authUser?.metadata.lastSignInTime ? new Date(authUser.metadata.lastSignInTime).toISOString() : null,
    lastSeen: lastSeen instanceof Timestamp ? lastSeen.toDate().toISOString() : null,
    campus: campus.exists ? { role: campus.data()!.role, country: campus.data()!.country, campus: campus.data()!.campus, campusLead: !!campus.data()!.campusLead } : null,
    referredBy: referral.data()?.referredByUsername ?? null, referred: referred.data().count,
  };

  let money = null;
  if (hasAnyDept(s.access, ["finance", "support"])) {
    const [pays, sales, wallet] = await Promise.all([
      db.collection("payments").where("uid", "==", id).limit(200).get(),
      db.collection("ledger").where("publisherUid", "==", id).limit(500).get(),
      deps.wallet ? deps.wallet(id).catch(() => null) : Promise.resolve(null),
    ]);
    const payRows = pays.docs.map((d) => d.data()).map((x) => ({ reference: String(x.reference ?? ""), kind: String(x.kind ?? ""), amountKobo: naira(x.amountKobo), currency: x.currency ?? "NGN", status: String(x.status ?? ""), createdAt: String(x.createdAt ?? "") }));
    const saleRows = sales.docs.map((d) => d.data());
    const sum = (st: string[]) => saleRows.filter((x) => st.includes(String(x.status))).reduce((n, x) => n + naira(x.netKobo), 0);
    money = {
      payments: newest(payRows, "createdAt", 10), paymentsCount: pays.size,
      paidKobo: payRows.filter((x) => x.status === "paid" && x.currency === "NGN").reduce((n, x) => n + x.amountKobo, 0),
      sales: { count: saleRows.length, heldKobo: sum(["held", "disputed"]), availableKobo: sum(["available"]), paidOutKobo: sum(["paid_out", "paid"]) },
      wallet,
    };
  }

  const [asClient, asHost] = await Promise.all([
    db.collection("bookings").where("clientUid", "==", id).limit(100).get(),
    db.collection("bookings").where("publisherUid", "==", id).limit(100).get(),
  ]);
  const bk = (d: FirebaseFirestore.QueryDocumentSnapshot) => { const x = d.data(); return { reference: d.id, date: String(x.date ?? ""), status: String(x.status ?? ""), with: String(x.username ?? x.clientName ?? "") }; };
  const activity = { booked: newest(asClient.docs.map(bk), "date", 5), bookedCount: asClient.size, hosted: newest(asHost.docs.map(bk), "date", 5), hostedCount: asHost.size };

  let trust = null;
  if (hasAnyDept(s.access, ["support", "moderation", "legal"])) {
    const [against, by, susp] = await Promise.all([
      db.collection("contentReports").where("targetUid", "==", id).limit(100).get(),
      db.collection("contentReports").where("reporterUid", "==", id).count().get(),
      db.doc(`suspensions/${id}`).get(),
    ]);
    trust = {
      reports: newest(against.docs.map((d) => { const x = d.data(); return { id: d.id, kind: String(x.kind ?? ""), reason: String(x.reason ?? ""), status: String(x.status ?? ""), outcome: x.outcome ? String(x.outcome) : null, createdAt: String(x.createdAt ?? "") }; }), "createdAt", 10),
      reportsCount: against.size, reportsFiled: by.data().count,
      suspension: susp.exists ? { reason: susp.data()!.reason ?? "", suspendedAt: susp.data()!.suspendedAt ?? "", until: susp.data()!.until ?? null, appealStatus: susp.data()!.appealStatus ?? "none", liftedAt: susp.data()!.liftedAt ?? null } : null,
    };
  }

  const views = isSuper(s.access) || hasDept(s.access, "legal") ? await viewLog(db, { subject: id, limit: 20 }).catch(() => []) : null;
  const [notes, history] = await Promise.all([listNotes(db, id), listHistory(db, id)]);
  return { account, money, activity, trust, views, notes, history, can: abilities(s) };
}

export function abilities(s: Staff) {
  return {
    notify: hasAnyDept(s.access, ["support", "moderation"]),
    emails: hasDept(s.access, "support"),
    exportData: isSuper(s.access) || hasDept(s.access, "legal"),
    duplicates: hasAnyDept(s.access, ["support", "moderation"]),
    suspend: hasAnyDept(s.access, ["support", "moderation"]),
  };
}

// ---- staff notes ----

export type MemberNote = { id: string; uid: string; text: string; byUid: string; byName: string; at: string };
export async function listNotes(db: Firestore, uid: string): Promise<MemberNote[]> {
  const snap = await db.collection("adminMemberNotes").where("uid", "==", uid).limit(200).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MemberNote, "id">) })).sort((a, b) => b.at.localeCompare(a.at));
}
export async function addNote(db: Firestore, s: Staff, uid: unknown, text: unknown, now = new Date()) {
  need(s, USERS_DEPTS, "Users");
  const id = mustUid(uid);
  const t = String(text ?? "").trim().slice(0, 2000);
  if (t.length < 2) throw new MemberError("Write the note first.");
  const ref = await db.collection("adminMemberNotes").add({ uid: id, text: t, byUid: s.uid, byName: s.name, at: now.toISOString() });
  return { id: ref.id };
}
export async function deleteNote(db: Firestore, s: Staff, noteId: unknown) {
  if (typeof noteId !== "string" || !noteId) throw new MemberError("Which note?");
  const ref = db.doc(`adminMemberNotes/${noteId}`);
  const n = (await ref.get()).data();
  if (!n) throw new MemberError("That note wasn't found.", 404);
  if (n.byUid !== s.uid && !isSuper(s.access)) throw new MemberError("Only the person who wrote a note (or a super admin) can delete it.", 403);
  await ref.delete();
  return { deleted: noteId };
}

// ---- change history ----

export const HISTORY_WHAT = ["role", "tier", "gold", "suspended", "unsuspended", "appeal", "badge request", "basic request", "notified", "verification email", "password reset", "data export", "not duplicate", "note"] as const;
export type HistoryWhat = (typeof HISTORY_WHAT)[number];
export type HistoryEntry = { id: string; uid: string; what: HistoryWhat; detail: string; byUid: string; byName: string; at: string };
export async function listHistory(db: Firestore, uid: string): Promise<HistoryEntry[]> {
  const snap = await db.collection("adminMemberHistory").where("uid", "==", uid).limit(300).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HistoryEntry, "id">) })).sort((a, b) => b.at.localeCompare(a.at));
}
export async function logChange(db: Firestore, s: Staff, uid: unknown, what: unknown, detail: unknown, now = new Date()) {
  need(s, USERS_DEPTS, "Users");
  const id = mustUid(uid);
  if (!(HISTORY_WHAT as readonly string[]).includes(String(what))) throw new MemberError("Unknown change.");
  await db.collection("adminMemberHistory").add({ uid: id, what, detail: String(detail ?? "").slice(0, 300), byUid: s.uid, byName: s.name, at: now.toISOString() });
  return { ok: true };
}

// ---- actions ----

export type Notify = (n: { uid: string; message: string; linkHref: string }) => Promise<void>;

// A message from #NotesApp in their notifications (one member, or up to 200 at once).
export async function notifyMembers(db: Firestore, s: Staff, uids: unknown, message: unknown, link: unknown, notify: Notify, now = new Date()) {
  need(s, ["support", "moderation"], "messaging members");
  const list = (Array.isArray(uids) ? uids : [uids]).filter(uidOk) as string[];
  if (!list.length || list.length > 200) throw new MemberError("Choose up to 200 members.");
  const text = String(message ?? "").trim().slice(0, 280);
  if (text.length < 5) throw new MemberError("Write the message (5 to 280 characters).");
  const href = typeof link === "string" && /^\/[\w\-/?=&.%#]*$/.test(link) ? link : "/";
  for (const uid of Array.from(new Set(list))) {
    await notify({ uid, message: text, linkHref: href });
    await logChange(db, s, uid, "notified", text, now);
  }
  return { sent: list.length };
}

type Mailer = (m: { to: string; subject: string; text: string; action: { label: string; url: string } }) => Promise<boolean | void>;
type LinkAuth = Pick<Auth, "getUser" | "generateEmailVerificationLink" | "generatePasswordResetLink">;

export async function resendVerification(db: Firestore, auth: LinkAuth, s: Staff, uid: unknown, send: Mailer, now = new Date()) {
  need(s, ["support"], "sending account emails");
  const u = await auth.getUser(mustUid(uid)).catch(() => null);
  if (!u?.email) throw new MemberError("They have no email to confirm.", 404);
  if (u.emailVerified) throw new MemberError("Their email is already confirmed.", 409);
  const link = await auth.generateEmailVerificationLink(u.email);
  await send({ to: u.email, subject: "Confirm your email for #NotesApp", text: "Please confirm your email address so we can send you booking, order and account updates. (Our support team sent this at your request.)", action: { label: "Confirm my email", url: link } });
  await logChange(db, s, u.uid, "verification email", "Sent again", now);
  return { sent: true };
}

export async function sendPasswordReset(db: Firestore, auth: LinkAuth, s: Staff, uid: unknown, send: Mailer, now = new Date()) {
  need(s, ["support"], "sending account emails");
  const u = await auth.getUser(mustUid(uid)).catch(() => null);
  if (!u?.email) throw new MemberError("They have no email to send it to.", 404);
  const link = await auth.generatePasswordResetLink(u.email);
  await send({ to: u.email, subject: "Reset your #NotesApp password", text: "Our support team sent you this link to choose a new password, as you asked. If you didn't ask, you can ignore this email and nothing will change.", action: { label: "Choose a new password", url: link } });
  await logChange(db, s, u.uid, "password reset", "Link sent", now);
  return { sent: true };
}

// Their data, for a data request: Legal and super admins only, with a reason, logged in the view log and the member's history.
export async function exportMember(db: Firestore, auth: Pick<Auth, "getUser">, s: Staff, uid: unknown, reason: unknown, note: unknown, collect: (uid: string, email: string) => Promise<unknown>, now = new Date()) {
  if (!isSuper(s.access) && !hasDept(s.access, "legal")) throw new MemberError("Only Legal & compliance and super admins export a member's data.", 403);
  const id = mustUid(uid);
  const why = revealReason(reason, note);
  if (!why) throw new MemberError("Say why you need it (for Other, add a few words).");
  const u = await auth.getUser(id).catch(() => null);
  const data = await collect(id, u?.email ?? "");
  await db.collection("adminViewLog").add({ at: Timestamp.fromDate(now), adminUid: s.uid, adminName: s.name, kind: "member-email", subject: id, reason: `Data export · ${why}`, page: "Users" });
  await logChange(db, s, id, "data export", why, now);
  return data;
}

// Two accounts that look alike but are different people: the warning goes away for both.
export async function markNotDuplicate(db: Firestore, s: Staff, a: unknown, b: unknown, now = new Date()) {
  need(s, ["support", "moderation"], "duplicate accounts");
  const x = mustUid(a), y = mustUid(b);
  if (x === y) throw new MemberError("Choose two different accounts.");
  const batch = db.batch();
  batch.set(db.doc(`adminUserFlags/${x}`), { notDuplicateOf: FieldValue.arrayUnion(y) }, { merge: true });
  batch.set(db.doc(`adminUserFlags/${y}`), { notDuplicateOf: FieldValue.arrayUnion(x) }, { merge: true });
  await batch.commit();
  await logChange(db, s, x, "not duplicate", `Not the same person as ${y}`, now);
  await logChange(db, s, y, "not duplicate", `Not the same person as ${x}`, now);
  return { ok: true };
}
