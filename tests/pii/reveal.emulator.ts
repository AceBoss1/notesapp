// Revealing a masked detail (lib/pii-server.ts) against the Firestore and Auth emulators: only the departments allowed, only
// with a reason, from an allowed source, and every reveal logged. Run: npm run test:pii-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { RevealError, reveal, viewLog } from "../../lib/pii-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = (p: Promise<unknown>, status: number, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof RevealError && e.status === status && re.test(e.message));
const care = { uid: "s_care", name: "Chika (care)", access: { role: "admin" as const, depts: ["support" as const] } };
const fin = { uid: "s_fin", name: "Femi (finance)", access: { role: "admin" as const, depts: ["finance" as const] } };
const boss = { uid: "s_boss", name: "Boss", access: { role: "super" as const, depts: [] } };

(async () => {
  await getAuth().createUser({ uid: "m_ada", email: "adaeze@gmail.com" }).catch(() => {});
  await db.doc("payments/PAY1").set({ uid: "m_ada", email: "adaeze@gmail.com", status: "paid" });
  await db.doc("merchOrders/M1").set({ uid: "m_ada", email: "adaeze@gmail.com", address: { fullName: "Ada", phone: "08031234567" } });
  await db.doc("leads/L1").set({ name: "Ola", email: "ola@site.ng", status: "new" });

  const r = { reason: "Replying to them", note: "ticket 42", page: "Users" };
  assert.deepEqual(await reveal(db, care, { kind: "member-email", subject: "m_ada", ...r }), { value: "adaeze@gmail.com" });
  assert.deepEqual(await reveal(db, care, { kind: "order-phone", subject: "M1", reason: "Delivering an order", page: "Merch" }), { value: "08031234567" });
  assert.deepEqual(await reveal(db, care, { kind: "lead-email", subject: "L1", reason: "Replying to them", page: "Leads" }), { value: "ola@site.ng" });
  assert.deepEqual(await reveal(db, fin, { kind: "payment-email", subject: "PAY1", reason: "Payment or refund", page: "Payments" }), { value: "adaeze@gmail.com" });
  assert.deepEqual(await reveal(db, boss, { kind: "payment-email", subject: "PAY1", reason: "Legal or data request", page: "Payments" }), { value: "adaeze@gmail.com" }, "a super admin can see any");

  await fails(reveal(db, care, { kind: "payment-email", subject: "PAY1", ...r }), 403, /role/);
  await fails(reveal(db, fin, { kind: "lead-email", subject: "L1", ...r }), 403, /role/);
  await fails(reveal(db, care, { kind: "member-email", subject: "m_ada", reason: "" }), 400, /why/);
  await fails(reveal(db, care, { kind: "member-email", subject: "m_ada", reason: "Other", note: "hm" }), 400, /why/);
  await fails(reveal(db, care, { kind: "bank", subject: "m_ada", ...r }), 400, /Unknown/);
  await fails(reveal(db, care, { kind: "member-email", subject: "../users/x", ...r }), 400, /Whose/);
  await fails(reveal(db, care, { kind: "lead-email", subject: "L404", ...r }), 404, /nothing/);

  // Only the five that showed something are logged, newest first, with who, whose, what, why and where.
  const log = await viewLog(db);
  assert.equal(log.length, 5);
  assert.deepEqual([log[0].adminName, log[0].kind, log[0].subject, log[0].reason, log[0].page], ["Boss", "payment-email", "PAY1", "Legal or data request", "Payments"]);
  assert.equal(log[4].reason, "Replying to them: ticket 42");
  assert.equal(log[4].label, "member's email");
  assert.deepEqual((await viewLog(db, { subject: "PAY1" })).map((v) => v.adminName), ["Boss", "Femi (finance)"]);
  assert.equal((await viewLog(db, { adminUid: "s_care" })).length, 3);
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
