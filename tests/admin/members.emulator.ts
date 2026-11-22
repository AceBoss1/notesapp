// Admin → Users on the Firestore emulator (lib/admin-members-server.ts): each part of a member's picture follows the staff member's
// departments, notes (only the author or a super admin deletes), the change history, messaging, account emails, data export (Legal,
// logged), not-duplicate marks, and the list's signals. Run: npm run test:admin-users
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const M = await import("../../lib/admin-members-server");
  const now = new Date("2026-11-15T10:00:00Z");
  const staff = (uid: string, depts: string[], role: "admin" | "super" = "admin") => ({ uid, name: uid.toUpperCase(), access: { role, depts } as never });
  const care = staff("care", ["support"]), money = staff("money", ["finance"]), legal = staff("legal", ["legal"]), boss = staff("boss", [], "super"), ed = staff("ed", ["content"]);
  const authUser = (uid: string, email: string, verified: boolean) => ({ uid, email, emailVerified: verified, disabled: false, providerData: [{ providerId: "password" }, { providerId: "google.com" }], metadata: { lastSignInTime: "Sat, 14 Nov 2026 09:00:00 GMT", creationTime: "Thu, 01 Oct 2026 09:00:00 GMT" } });
  const people: Record<string, ReturnType<typeof authUser>> = { m1: authUser("m1", "m1@example.test", false), m2: authUser("m2", "m2@example.test", true) };
  const sent: { to: string; subject: string }[] = [];
  const auth = {
    getUser: async (uid: string) => { if (!people[uid]) throw new Error("no user"); return people[uid]; },
    getUsers: async (ids: { uid: string }[]) => ({ users: ids.map((i) => people[i.uid]).filter(Boolean) }),
    generateEmailVerificationLink: async (e: string) => `https://x.test/verify?e=${e}`,
    generatePasswordResetLink: async (e: string) => `https://x.test/reset?e=${e}`,
  } as never;
  const mail = async (m: { to: string; subject: string }) => { sent.push(m); };
  const bells: { uid: string; message: string }[] = [];
  const notify = async (n: { uid: string; message: string; linkHref: string }) => { bells.push(n); };

  await db.doc("users/m1").set({ username: "m1", displayName: "Member One", accountTier: "pro", createdAt: "2026-10-01T09:00:00Z", trialUntil: "2026-11-20T00:00:00Z" });
  await db.doc("users/m2").set({ username: "m2", displayName: "Member Two", accountTier: "standard", createdAt: "2026-10-02T09:00:00Z" });
  await db.doc("presence/m1").set({ lastSeen: Timestamp.fromDate(new Date("2026-11-15T08:00:00Z")) });
  await db.doc("payments/p1").set({ reference: "p1", uid: "m1", kind: "store", amountKobo: 500000, status: "paid", createdAt: "2026-11-10T09:00:00Z" });
  await db.doc("ledger/l1").set({ publisherUid: "m1", netKobo: 90000, status: "held" });
  await db.doc("ledger/l2").set({ publisherUid: "m1", netKobo: 10000, status: "paid_out" });
  await db.doc("bookings/b1").set({ clientUid: "m1", date: "2026-11-20", status: "confirmed", username: "coach" });
  await db.doc("contentReports/r1").set({ targetUid: "m1", reporterUid: "m2", kind: "post", reason: "spam", status: "open", createdAt: "2026-11-11T09:00:00Z" });
  await db.doc("referrals/m2").set({ uid: "m2", referredBy: "m1", referredByUsername: "m1" });
  await db.doc("campusTeam/m1").set({ uid: "m1", role: "ambassador", country: "NG", campus: "UNILAG", campusLead: true });

  // Who sees which part.
  await assert.rejects(M.detail(db, auth, ed, "m1"), /Users/);
  const c = await M.detail(db, auth, care, "m1", { wallet: async () => ({ creditKobo: 100 }) });
  assert.equal(c.account.tier, "pro"); assert.equal(c.account.verified, false); assert.deepEqual(c.account.providers, ["email", "google"]);
  assert.equal(c.account.lastSeen, "2026-11-15T08:00:00.000Z"); assert.equal(c.account.trialUntil, "2026-11-20T00:00:00Z");
  assert.equal(c.account.referred, 1); assert.deepEqual(c.account.campus, { role: "ambassador", country: "NG", campus: "UNILAG", campusLead: true });
  assert.equal(c.money!.paidKobo, 500000); assert.equal(c.money!.sales.heldKobo, 90000); assert.equal(c.money!.sales.paidOutKobo, 10000);
  assert.equal(c.activity.bookedCount, 1); assert.equal(c.trust!.reportsCount, 1); assert.equal(c.views, null, "only Legal and super admins see the view log");
  const f = await M.detail(db, auth, money, "m1");
  assert.ok(f.money && f.trust === null, "Finance: money, not trust");
  const l = await M.detail(db, auth, legal, "m1");
  assert.ok(l.money === null && l.trust && Array.isArray(l.views));
  await assert.rejects(M.detail(db, auth, care, "nobody"), /wasn't found/);

  // Notes: anyone on the page adds; only the author or a super admin deletes.
  await assert.rejects(M.addNote(db, care, "m1", " "), /Write the note/);
  const n = await M.addNote(db, care, "m1", "Called about the refund, sorted.", now);
  await assert.rejects(M.deleteNote(db, money, n.id), /Only the person who wrote/);
  const n2 = await M.addNote(db, money, "m1", "Payout on hold.", now);
  await M.deleteNote(db, boss, n2.id);
  assert.deepEqual((await M.listNotes(db, "m1")).map((x) => x.text), ["Called about the refund, sorted."]);

  // History and actions.
  await assert.rejects(M.logChange(db, care, "m1", "nonsense", ""), /Unknown change/);
  await M.logChange(db, care, "m1", "tier", "standard → pro", now);
  await assert.rejects(M.notifyMembers(db, money, ["m1"], "Hello there", "/", notify), /messaging members/);
  await assert.rejects(M.notifyMembers(db, care, ["m1"], "Hi", "/", notify), /5 to 280/);
  assert.equal((await M.notifyMembers(db, care, ["m1", "m2", "m1"], "Your refund is on its way.", "javascript:alert(1)", notify, now)).sent, 3);
  assert.equal(bells.length, 2, "once each"); assert.ok(bells.every((b) => b.message === "Your refund is on its way."));
  await assert.rejects(M.resendVerification(db, auth, money, "m1", mail), /account emails/);
  await M.resendVerification(db, auth, care, "m1", mail, now);
  await assert.rejects(M.resendVerification(db, auth, care, "m2", mail), /already confirmed/);
  await M.sendPasswordReset(db, auth, care, "m2", mail, now);
  assert.deepEqual(sent.map((x) => x.to), ["m1@example.test", "m2@example.test"]);
  // Many at once (the bulk bar): confirmed and unknown ones are skipped, not errors.
  await assert.rejects(M.resendVerificationMany(db, auth, money, ["m1"], mail), /account emails/);
  await assert.rejects(M.resendVerificationMany(db, auth, care, [], mail), /Which members/);
  await assert.rejects(M.resendVerificationMany(db, auth, care, Array.from({ length: 101 }, (_, i) => `u${i}`), mail), /At most 100/);
  assert.deepEqual(await M.resendVerificationMany(db, auth, care, ["m1", "m2", "nobody", "m1"], mail, now), { sent: 1, skipped: 2 });
  sent.splice(2);
  await assert.rejects(M.exportMember(db, auth, care, "m1", "Legal or data request", "", async () => ({})), /Only Legal/);
  await assert.rejects(M.exportMember(db, auth, legal, "m1", "nope", "", async () => ({})), /Say why/);
  const data = await M.exportMember(db, auth, legal, "m1", "Legal or data request", "DSAR #12", async (uid, email) => ({ uid, email }), now);
  assert.deepEqual(data, { uid: "m1", email: "m1@example.test" });
  const vlog = (await db.collection("adminViewLog").where("subject", "==", "m1").get()).docs.map((d) => d.data().reason);
  assert.ok(vlog.some((r) => /Data export · Legal or data request: DSAR #12/.test(r)), "the export is in the view log");
  await assert.rejects(M.markNotDuplicate(db, care, "m1", "m1"), /two different/);
  await M.markNotDuplicate(db, care, "m1", "m2", now);
  const hist = (await M.listHistory(db, "m1")).map((h) => h.what);
  for (const w of ["tier", "notified", "verification email", "data export", "not duplicate"]) assert.ok(hist.includes(w as never), `history has ${w}`);
  assert.ok((await M.listHistory(db, "m1")).every((h) => h.byName && h.at));

  // The list's signals: nothing personal, and the not-duplicate marks.
  const sig = await M.signals(db, auth, ["m1", "m2", "ghost"]);
  assert.equal(sig.m1.verified, false); assert.equal(sig.m2.verified, true);
  assert.equal(sig.m1.lastSeen, "2026-11-15T08:00:00.000Z"); assert.deepEqual(sig.m1.notDuplicateOf, ["m2"]);
  assert.ok(!("email" in sig.m1));
  assert.equal(sig.ghost, undefined);
  await assert.rejects(M.signals(db, auth, ["bad id!"]), /uids/);

  // Find by email: only the uid comes back, for the departments that may see emails, with a reason, logged.
  const P = await import("../../lib/pii-server");
  const find = async (e: string) => (e === "m2@example.test" ? "m2" : null);
  await assert.rejects(P.findByEmail(db, ed as never, { email: "m2@example.test", reason: "Replying to them" }, find), /Your role/);
  await assert.rejects(P.findByEmail(db, care as never, { email: "m2@", reason: "Replying to them" }, find), /whole email/);
  await assert.rejects(P.findByEmail(db, care as never, { email: "m2@example.test" }, find), /Say why/);
  await assert.rejects(P.findByEmail(db, care as never, { email: "ghost@example.test", reason: "Replying to them" }, find), /No #NotesApp account/);
  assert.deepEqual(await P.findByEmail(db, care as never, { email: " M2@Example.test ", reason: "Replying to them", note: "ticket 9" }, find, now), { uid: "m2" });
  const fl = (await db.collection("adminViewLog").where("subject", "==", "m2").get()).docs.map((d) => d.data());
  assert.ok(fl.some((x) => x.reason === "Found by email · Replying to them: ticket 9" && x.adminUid === "care"));

  console.log("ADMIN MEMBERS OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
