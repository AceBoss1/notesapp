import type { Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getUserEmail } from "./firebase-admin";
import { notifyBell, sendEmail } from "./email";
import { effectiveTier } from "./effective-tier";
import { booksCaps } from "./pricing";
import { SITE_URL } from "./host";
import { BooksError, catalog, publicEntry, type Ctx } from "./books-server";
import { ROLE_LABEL, isStaffRole, staffSeats, type Entry, type StaffRole } from "./books";

// Staff on a seller's Business books (docs/BUSINESS-BOOKS.md, step 10; the rules are lib/books.ts can and staffSeats).
//
//   bookStaff/{owner}_{uid}         { ownerUid, uid, username, name, role: cashier | manager, addedAt, addedBy }
//   bookStaffInvites/{owner}_{uid}  { ownerUid, ownerName, ownerUsername, inviteeUid, inviteeUsername, inviteeName, role, status, invitedBy, createdAt }
//
// Both are server-only (firestore.rules). The seller, or an organisation's admins, invite a member by @username or email as a Cashier or a
// Manager; the member gets a bell and an email, and answers on /invites/books/<id>. Seats come from the seller's plan (Business 4, Enterprise
// no fixed limit, Pro only if the admin gives it seats, Free Basic none), counting pending invitations. When the seller's plan no longer
// has staff seats, staff simply can't open the books (lib/books-server.ts booksRoleOf) until it does again.
const id = (owner: string, uid: string) => `${owner}_${uid}`;
const nameOf = (u: FirebaseFirestore.DocumentData | undefined, fallback = "") => String(u?.displayName || (u?.username ? `@${u.username}` : fallback));
const tierOf = (u: FirebaseFirestore.DocumentData | undefined) => effectiveTier({ username: u?.username ?? "", role: (u?.role ?? "reader") as "reader", accountTier: (u?.accountTier ?? "standard") as "standard" });
export const inviteUrl = (inviteId: string) => `${SITE_URL}/invites/books/${encodeURIComponent(inviteId)}`;

export type StaffRow = { uid: string; username: string; name: string; role: StaffRole; addedAt: string };
export type StaffInviteRow = { id: string; inviteeUid: string; inviteeUsername: string; inviteeName: string; role: StaffRole; status: string; createdAt: string };
export async function staffView(c: Ctx) {
  const [st, inv] = await Promise.all([
    c.db.collection("bookStaff").where("ownerUid", "==", c.owner).get(),
    c.db.collection("bookStaffInvites").where("ownerUid", "==", c.owner).where("status", "==", "pending").get(),
  ]);
  const seats = staffSeats(c.tier, booksCaps());
  const staff = st.docs.map((d) => d.data() as StaffRow).sort((a, b) => a.name.localeCompare(b.name));
  const invites = inv.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffInviteRow, "id">) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { seats, used: staff.length + invites.length, staff, invites, tier: c.tier };
}

export async function inviteStaff(c: Ctx, raw: { identifier?: unknown; role?: unknown }, send = sendEmail) {
  const { db, owner } = c;
  if (!isStaffRole(raw.role)) throw new BooksError(400, "Choose Cashier or Manager.");
  const seats = staffSeats(c.tier, booksCaps());
  if (seats === 0) throw new BooksError(402, "Staff on your books come with Business and Enterprise. Move up to invite a cashier or a manager.", "staff_plan");
  const idf = String(raw.identifier ?? "").trim().replace(/^@/, "").toLowerCase();
  if (!idf) throw new BooksError(400, "Enter their @username or email address.");
  let uid: string | null = null;
  if (idf.includes("@")) uid = await getAuth(getAdminApp()).getUserByEmail(idf).then((u) => u.uid).catch(() => null);
  else uid = ((await db.doc(`usernames/${idf}`).get()).data()?.uid as string) || (await db.collection("users").where("username", "==", idf).limit(1).get()).docs[0]?.id || null;
  if (!uid) throw new BooksError(404, "We couldn't find a #NotesApp account for that. They need to sign up first (it's free).");
  if (uid === owner) throw new BooksError(400, "That's you.");
  const [who, already, pending] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`bookStaff/${id(owner, uid)}`).get(), db.doc(`bookStaffInvites/${id(owner, uid)}`).get()]);
  const u = who.data();
  if (!u) throw new BooksError(404, "We couldn't find a #NotesApp account for that.");
  if (u.suspended === true) throw new BooksError(409, "That account can't be invited right now.");
  if (u.accountKind === "organisation") throw new BooksError(400, "Invite the person's own account, not an organisation.");
  if (already.exists) throw new BooksError(409, "They're already on your books. Change their role below.");
  if (pending.data()?.status === "pending") throw new BooksError(409, "They already have an invitation waiting.");
  const view = await staffView(c);
  if (seats !== null && view.used >= seats) throw new BooksError(409, `All ${seats} staff seats on your plan are in use (waiting invitations count). Remove someone first, or ask us about Enterprise.`, "staff_seats");
  const now = c.now.toISOString();
  const invite = {
    ownerUid: owner, ownerName: nameOf(c.profile, "A shop"), ownerUsername: c.profile.username ?? "", inviteeUid: uid, inviteeUsername: String(u.username ?? ""), inviteeName: nameOf(u),
    role: raw.role, status: "pending", invitedBy: c.actor, createdAt: now,
  };
  await db.doc(`bookStaffInvites/${id(owner, uid)}`).set(invite);
  const what = raw.role === "cashier" ? "record sales and payments received, and share receipts" : "keep the books with them: sales, expenses, money owed, profit and loss, imports and exports";
  const to = await getUserEmail(uid);
  const bell = { uid, type: "books" as const, linkHref: `/invites/books/${id(owner, uid)}`, message: `${invite.ownerName} invited you to their Business books as ${raw.role === "cashier" ? "a cashier" : "a manager"}.` };
  if (to) await send({ to, subject: `${invite.ownerName} invited you to their Business books`, text: `${invite.ownerName} invited you to their Business books on #NotesApp as ${raw.role === "cashier" ? "a Cashier" : "a Manager"}, to ${what}.\n\nAccept or decline: ${inviteUrl(id(owner, uid))}\n\nEvery entry you make shows that you made it. You never see their bank details or payouts.\n\n#NotesApp`, action: { label: "See the invitation", url: inviteUrl(id(owner, uid)) }, bell }).catch(() => false);
  else await notifyBell(bell).catch(() => {});
  return { id: id(owner, uid), ...invite };
}

export async function revokeInvite(c: Ctx, inviteId: string) {
  const ref = c.db.doc(`bookStaffInvites/${inviteId}`);
  const inv = (await ref.get()).data();
  if (!inv || inv.ownerUid !== c.owner || inv.status !== "pending") throw new BooksError(404, "No such invitation.");
  await ref.update({ status: "revoked", resolvedAt: c.now.toISOString(), resolvedBy: c.actor });
}
export async function setStaffRole(c: Ctx, uid: string, role: unknown) {
  if (!isStaffRole(role)) throw new BooksError(400, "Choose Cashier or Manager.");
  const ref = c.db.doc(`bookStaff/${id(c.owner, uid)}`);
  if (!(await ref.get()).exists) throw new BooksError(404, "They're not on your books.");
  await ref.update({ role, changedAt: c.now.toISOString(), changedBy: c.actor });
  await notifyBell({ uid, type: "books", linkHref: `/profile/books?owner=${c.owner}`, message: `${nameOf(c.profile, "A shop")} changed your role on their books to ${ROLE_LABEL[role]}.` }).catch(() => {});
}
export async function removeStaff(c: Ctx, uid: string) {
  const ref = c.db.doc(`bookStaff/${id(c.owner, uid)}`);
  if (!(await ref.get()).exists) throw new BooksError(404, "They're not on your books.");
  await ref.delete();
}

// ---- The invited member's side (/invites/books/<id>) ----
export async function staffInvite(db: Firestore, uid: string, inviteId: string) {
  const inv = (await db.doc(`bookStaffInvites/${inviteId}`).get()).data();
  if (!inv || (inv.inviteeUid !== uid && inv.ownerUid !== uid)) throw new BooksError(404, "That invitation isn't available.");
  return { id: inviteId, ownerName: String(inv.ownerName), ownerUsername: String(inv.ownerUsername ?? ""), role: inv.role as StaffRole, status: String(inv.status), createdAt: String(inv.createdAt), viewer: inv.inviteeUid === uid ? "invitee" : "owner", ownerUid: String(inv.ownerUid) };
}
export async function myStaffInvites(db: Firestore, uid: string) {
  const s = await db.collection("bookStaffInvites").where("inviteeUid", "==", uid).where("status", "==", "pending").get();
  return s.docs.map((d) => ({ id: d.id, ownerName: String(d.data().ownerName), role: d.data().role as StaffRole, createdAt: String(d.data().createdAt) }));
}
export async function answerStaffInvite(db: Firestore, uid: string, inviteId: string, accept: boolean, now = new Date()) {
  const ref = db.doc(`bookStaffInvites/${inviteId}`);
  const inv = (await ref.get()).data();
  if (!inv || inv.inviteeUid !== uid || inv.status !== "pending") throw new BooksError(404, "That invitation isn't available.");
  if (!accept) { await ref.update({ status: "declined", resolvedAt: now.toISOString() }); return { ok: true, owner: String(inv.ownerUid) }; }
  const [me, owner] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`users/${inv.ownerUid}`).get()]);
  if (me.data()?.suspended === true) throw new BooksError(403, "This account is suspended.");
  if (!owner.exists || owner.data()?.suspended === true) throw new BooksError(409, "This shop isn't available.");
  if (staffSeats(tierOf(owner.data()), booksCaps()) === 0) throw new BooksError(409, `${inv.ownerName}'s plan doesn't have staff seats at the moment. Ask them to check their plan.`);
  const batch = db.batch();
  batch.set(db.doc(`bookStaff/${inviteId}`), { ownerUid: inv.ownerUid, uid, username: String(me.data()?.username ?? inv.inviteeUsername ?? ""), name: nameOf(me.data(), inv.inviteeName), role: inv.role, addedAt: now.toISOString(), addedBy: inv.invitedBy });
  batch.update(ref, { status: "accepted", resolvedAt: now.toISOString() });
  await batch.commit();
  await notifyBell({ uid: String(inv.ownerUid), type: "books", linkHref: "/profile/books?tab=staff", message: `${nameOf(me.data(), inv.inviteeName)} joined your books as ${ROLE_LABEL[inv.role as StaffRole]}.` }).catch(() => {});
  return { ok: true, owner: String(inv.ownerUid) };
}
export async function leaveBooks(db: Firestore, uid: string, owner: string) {
  await db.doc(`bookStaff/${id(owner, uid)}`).delete();
}

// ---- What a cashier sees: today's sales and payments they recorded, nothing about profit, costs or expenses ----
export async function cashierHome(c: Ctx) {
  const s = await c.db.collection("bookEntries").where("ownerUid", "==", c.owner).where("on", "==", c.today).get().catch(() => null);
  const mine = (s?.docs ?? []).map((d) => ({ ...(d.data() as Omit<Entry, "id">), id: d.id })).filter((e) => e.by === c.actor && (e.kind === "sale" || e.kind === "payment"))
    .sort((a, b) => b.at.localeCompare(a.at));
  const live = mine.filter((e) => !e.voidedAt);
  const strip = (e: Entry) => ({ ...publicEntry(e), lines: e.lines.map((l) => ({ ...l, costKobo: 0, noCost: undefined })), feeKobo: undefined });
  return {
    role: c.role, today: c.today, shop: { name: nameOf(c.profile, "My shop"), username: c.profile.username ?? "", tier: c.tier }, access: c.access, inventory: c.inventory,
    mine: { sales: live.filter((e) => e.kind === "sale").length, salesKobo: live.filter((e) => e.kind === "sale").reduce((n, e) => n + e.totalKobo, 0), paymentsKobo: live.filter((e) => e.kind === "payment").reduce((n, e) => n + e.totalKobo, 0) },
    entries: mine.slice(0, 100).map(strip),
  };
}
// The catalog without costs (cashiers sell at the price; what it cost is the owner's business).
export async function catalogFor(c: Ctx) {
  const items = await catalog(c);
  return c.role === "cashier" ? items.map((x) => ({ ...x, costKobo: 0 })) : items;
}
// Who made each entry, for the seller's "by" filter: the owner, admins and staff, by uid.
export async function keepers(c: Ctx): Promise<{ uid: string; name: string; role: string }[]> {
  const [st, admins] = await Promise.all([
    c.db.collection("bookStaff").where("ownerUid", "==", c.owner).get(),
    c.db.collection("orgMembers").where("orgUid", "==", c.owner).get().catch(() => null),
  ]);
  const out = [{ uid: c.owner, name: nameOf(c.profile, "Owner"), role: "Owner" }];
  for (const d of st.docs) out.push({ uid: String(d.data().uid), name: String(d.data().name || d.data().username), role: ROLE_LABEL[d.data().role as StaffRole] ?? "Staff" });
  for (const d of admins?.docs ?? []) if (d.data().role === "admin" && !out.some((x) => x.uid === d.data().memberUid)) out.push({ uid: String(d.data().memberUid), name: String(d.data().memberName || d.data().memberUsername || "Admin"), role: "Admin" });
  return out;
}
