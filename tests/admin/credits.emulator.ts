// Admin → Credits (lib/admin-credits.ts) against the Firestore and Auth emulators: only the owner, and the super admins the owner allows,
// can add credit; Nana credit and wallet credit land where they're spent; every top-up needs a reason, is logged and rings the member.
// Run: npm run test:credits → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { CreditError, canTopUp, recentTopUps, searchMembers, setTopUpAdmins, topUp, type Admin } from "../../lib/admin-credits";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const bells: { uid?: string; message: string }[] = [];
const notify: NonNullable<Parameters<typeof topUp>[4]> = async (n) => { bells.push({ uid: n.uid ?? undefined, message: n.message }); };
const owner: Admin = { uid: "u_owner", email: "owner@x.test", access: { role: "super", depts: [] }, owner: true };
const sup: Admin = { uid: "u_super", email: "super@x.test", access: { role: "super", depts: [] }, owner: false };
const plain: Admin = { uid: "u_admin", email: "admin@x.test", access: { role: "admin", depts: ["finance"] }, owner: false };
const refused = async (p: Promise<unknown>, status: number) => { await assert.rejects(p, (e: unknown) => e instanceof CreditError && e.status === status); };

(async () => {
  await getAuth().createUser({ uid: "u_tola", email: "tola@x.test" }).catch(() => {});
  await db.doc("users/u_tola").set({ displayName: "Tola Bello", username: "tola" });
  await db.doc("usernames/tola").set({ uid: "u_tola" });
  await db.doc("users/u_tobi").set({ displayName: "Tobi Ade", username: "tobi" });

  // Search: by username (with or without @), email, or the start of a name.
  assert.deepEqual((await searchMembers(db, "@tola")).map((m) => m.uid), ["u_tola"]);
  assert.equal((await searchMembers(db, "tola@x.test"))[0].email, "tola@x.test");
  assert.deepEqual((await searchMembers(db, "To")).map((m) => m.uid).sort(), ["u_tobi", "u_tola"]);
  assert.deepEqual(await searchMembers(db, "t"), [], "too short");

  // The owner adds Nana credit: it lands in nanaAccounts, is logged and rings the member.
  assert.equal(await canTopUp(db, owner), true);
  const r = await topUp(db, owner, { uid: "u_tola", kind: "nana", naira: 800, reason: "Charged at the wrong price" }, new Date(), notify);
  assert.equal((await db.doc("nanaAccounts/u_tola").get()).data()!.creditKobo, 80_000);
  assert.equal(r.member.nanaKobo, 80_000); assert.equal(r.member.email, "tola@x.test", "the refreshed member keeps their email");
  assert.match(bells[0].message, /added ₦800 of Nana credit/); assert.equal(bells[0].uid, "u_tola");
  const log = await recentTopUps(db);
  assert.equal(log[0].reason, "Charged at the wrong price"); assert.equal(log[0].byEmail, "owner@x.test"); assert.equal(log[0].member, "@tola");

  // Other super admins can't, until the owner allows them; admins who aren't super never can.
  assert.equal(await canTopUp(db, sup), false);
  await refused(topUp(db, sup, { uid: "u_tola", kind: "wallet", naira: 500, reason: "Emergency refund" }, new Date(), notify), 403);
  await refused(setTopUpAdmins(db, sup, ["u_super"], [{ uid: "u_super" }]), 403);
  await refused(setTopUpAdmins(db, owner, ["u_admin"], [{ uid: "u_super" }]), 400);
  await setTopUpAdmins(db, owner, ["u_super"], [{ uid: "u_super" }]);
  assert.equal(await canTopUp(db, sup), true);
  assert.equal(await canTopUp(db, plain), false, "the list only counts for super admins");

  // An allowed super admin adds wallet credit: the wallet and its history.
  await topUp(db, sup, { uid: "u_tola", kind: "wallet", naira: 500, reason: "Emergency refund" }, new Date(), notify);
  assert.equal((await db.doc("wallets/u_tola").get()).data()!.creditKobo, 50_000);
  const tx = (await db.collection("walletTx").where("uid", "==", "u_tola").get()).docs.map((d) => d.data());
  assert.equal(tx.length, 1); assert.equal(tx[0].kind, "admin_credit"); assert.equal(tx[0].creditKobo, 50_000);
  await topUp(db, sup, { uid: "u_tola", kind: "wallet", naira: 250, reason: "Second part" }, new Date(), notify);
  assert.equal((await db.doc("wallets/u_tola").get()).data()!.creditKobo, 75_000, "adds to what's there");

  // Checks: a reason, a sensible amount, a real member, a known kind.
  await refused(topUp(db, owner, { uid: "u_tola", kind: "nana", naira: 100, reason: "ok" }), 400);
  await refused(topUp(db, owner, { uid: "u_tola", kind: "nana", naira: 600_000, reason: "Too much money" }), 400);
  await refused(topUp(db, owner, { uid: "u_tola", kind: "nana", naira: 0.5, reason: "Too little money" }), 400);
  await refused(topUp(db, owner, { uid: "u_nobody", kind: "nana", naira: 100, reason: "Who is this" }), 404);
  await refused(topUp(db, owner, { uid: "u_tola", kind: "gold", naira: 100, reason: "Wrong kind" }), 400);

  // Switching them off again.
  await setTopUpAdmins(db, owner, [], [{ uid: "u_super" }]);
  assert.equal(await canTopUp(db, sup), false);
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
