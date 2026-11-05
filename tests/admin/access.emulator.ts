// Team access (lib/admin-access-server.ts) against the Firestore and Auth emulators: super admins and the Chief of Staff manage admins;
// the Chief of Staff never touches their own access, a super admin's or another Chief of Staff's; only the owner names the Chief of Staff.
// Run: npm run test:access → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { accessFromClaims, canManageTeam, canOpen, roleLabel } from "../../lib/admin-access";
import { AccessChangeError, changeAccess, clearStaffCache, type Caller } from "../../lib/admin-access-server";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const auth = getAuth();
const notify = async () => {};
const owner: Caller = { uid: "u_owner", email: "owner@x.test", access: { role: "super", depts: [] }, owner: true };
const sup: Caller = { uid: "u_super", email: "super@x.test", access: { role: "super", depts: [] }, owner: false };
const cos: Caller = { uid: "u_cos", email: "cos@x.test", access: { role: "admin", depts: ["support"], cos: true }, owner: false };
const plain: Caller = { uid: "u_admin", email: "admin@x.test", access: { role: "admin", depts: ["finance"] }, owner: false };
const refused = async (p: Promise<unknown>, status: number) => { await assert.rejects(p, (e: unknown) => e instanceof AccessChangeError && e.status === status); };
const claimsOf = async (uid: string) => accessFromClaims((await auth.getUser(uid)).customClaims as Record<string, unknown>);

(async () => {
  for (const [uid, email] of [["u_owner", "owner@x.test"], ["u_super", "super@x.test"], ["u_cos", "cos@x.test"], ["u_admin", "admin@x.test"], ["u_new", "new@x.test"], ["u_two", "two@x.test"]]) {
    await auth.createUser({ uid, email }).catch(() => {});
  }
  await auth.setCustomUserClaims("u_super", { admin: true, adminRole: "super" });
  await auth.setCustomUserClaims("u_admin", { admin: true, adminRole: "admin", depts: ["finance"] });

  // Claims: the cos flag only counts on an admin.
  assert.deepEqual(accessFromClaims({ admin: true, adminRole: "admin", depts: ["support"], cos: true }), { role: "admin", depts: ["support"], cos: true });
  assert.deepEqual(accessFromClaims({ admin: true, adminRole: "admin", depts: ["support"], cos: "yes" }), { role: "admin", depts: ["support"] });
  assert.equal(canManageTeam(cos.access), true);
  assert.equal(canManageTeam(plain.access), false);
  assert.equal(canOpen(cos.access, "team"), true);
  assert.equal(canOpen(plain.access, "team"), false);
  assert.equal(canOpen(cos.access, "super"), false, "the Chief of Staff isn't a super admin");
  assert.equal(roleLabel(cos.access), "Chief of Staff");

  // Only the owner names the Chief of Staff.
  await refused(changeAccess(db, sup, { email: "cos@x.test", role: "admin", depts: ["support"], cos: true }, new Date(), notify), 403);
  await changeAccess(db, owner, { email: "cos@x.test", role: "admin", depts: ["support"], cos: true }, new Date(), notify);
  assert.deepEqual(await claimsOf("u_cos"), { role: "admin", depts: ["support"], cos: true });
  await refused(changeAccess(db, owner, { email: "two@x.test", role: "super", cos: true }, new Date(), notify), 400);

  // The Chief of Staff adds a new team member to any department, and moves them.
  await changeAccess(db, cos, { email: "new@x.test", role: "admin", depts: ["moderation", "legal"] }, new Date(), notify);
  assert.deepEqual(await claimsOf("u_new"), { role: "admin", depts: ["moderation", "legal"] });
  await changeAccess(db, cos, { email: "admin@x.test", role: "admin", depts: ["growth"] }, new Date(), notify);
  assert.deepEqual(await claimsOf("u_admin"), { role: "admin", depts: ["growth"] });
  // Marketing & user acquisition is its own department (split from Sales & partnerships, the "growth" key): the marketing pages, not
  // the sales ones.
  {
    const { pathAllowed, DEPT_LABEL } = await import("../../lib/admin-access");
    const mk = accessFromClaims({ admin: true, adminRole: "admin", depts: ["marketing"] });
    assert.deepEqual(mk, { role: "admin", depts: ["marketing"] });
    for (const p of ["/admin/discounts", "/admin/referrals", "/admin/ads", "/admin/traction", "/admin/team"]) assert.equal(pathAllowed(mk, p), true, p);
    for (const p of ["/admin/enterprise", "/admin/leads", "/admin/organisations", "/admin/payments"]) assert.equal(pathAllowed(mk, p), false, p);
    assert.equal(DEPT_LABEL.growth, "Sales & partnerships"); assert.equal(DEPT_LABEL.marketing, "Marketing & user acquisition");
    await changeAccess(db, cos, { email: "admin@x.test", role: "admin", depts: ["marketing", "growth"] }, new Date(), notify);
    assert.deepEqual(await claimsOf("u_admin"), { role: "admin", depts: ["marketing", "growth"] }, "the Chief of Staff can assign Marketing");
    await changeAccess(db, cos, { email: "admin@x.test", role: "admin", depts: ["growth"] }, new Date(), notify);
  }
  // ...and removes an admin's access.
  await changeAccess(db, cos, { email: "new@x.test", role: "none" }, new Date(), notify);
  assert.equal(await claimsOf("u_new"), null);

  // But never their own access, never a super admin, never makes one, never names a Chief of Staff.
  await refused(changeAccess(db, cos, { email: "cos@x.test", role: "admin", depts: ["support", "finance"] }, new Date(), notify), 403);
  await refused(changeAccess(db, cos, { email: "super@x.test", role: "admin", depts: ["support"] }, new Date(), notify), 403);
  await refused(changeAccess(db, cos, { email: "two@x.test", role: "super" }, new Date(), notify), 403);
  await refused(changeAccess(db, cos, { email: "two@x.test", role: "admin", depts: ["support"], cos: true }, new Date(), notify), 403);

  // A super admin who isn't the owner can't change the Chief of Staff either; a plain admin can't change anyone.
  await refused(changeAccess(db, sup, { email: "cos@x.test", role: "none" }, new Date(), notify), 403);
  await refused(changeAccess(db, plain, { email: "two@x.test", role: "admin", depts: ["support"] }, new Date(), notify), 403);

  // A super admin editing an admin's departments keeps the flags they didn't touch; the owner can take the role back.
  await changeAccess(db, owner, { email: "cos@x.test", role: "admin", depts: ["support", "content"] }, new Date(), notify);
  assert.deepEqual(await claimsOf("u_cos"), { role: "admin", depts: ["support", "content"], cos: true });
  await changeAccess(db, owner, { email: "cos@x.test", role: "admin", depts: ["support"], cos: false }, new Date(), notify);
  assert.deepEqual(await claimsOf("u_cos"), { role: "admin", depts: ["support"] });

  // Every change is logged.
  clearStaffCache();
  const log = await db.collection("adminAccessLog").get();
  assert.ok(log.docs.some((d) => d.data().byEmail === "cos@x.test" && String(d.data().after).includes("Legal")));
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
