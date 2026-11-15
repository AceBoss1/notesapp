// Throwaway emails on the Firestore emulator (lib/throwaway-emails-server.ts): the public list kept whole, adding and removing domains,
// finding accounts by their sign-in email (a stand-in for Firebase Authentication) and suspending them. Run inside npm run test:throwaway.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const T = await import("../../lib/throwaway-emails-server");
  const { BUILT_IN_DOMAINS, THROWAWAY_REASON } = await import("../../lib/throwaway-emails");

  // The list: built in until admins add; reading it writes the public copy the rules check.
  const l0 = await T.blocklist(db);
  assert.deepEqual(l0.added, []);
  assert.equal((await db.doc("settings/emailBlocklist").get()).data()?.domains.length, BUILT_IN_DOMAINS.length);

  const r = await T.addDomains(db, "temp-mail.example\nkuku.lu, gmail.com", "adm");
  assert.deepEqual(r.addedNow, ["temp-mail.example", "kuku.lu"]);
  assert.equal(r.refused.length, 1);
  assert.ok((await db.doc("settings/emailBlocklist").get()).data()?.domains.includes("kuku.lu"));
  await assert.rejects(T.addDomains(db, "gmail.com", "adm"), /ordinary email provider/);
  await assert.rejects(T.removeDomain(db, "petchi.uk", "adm"), /Built-in/);
  await assert.rejects(T.removeDomain(db, "nothere.example", "adm"), /isn't on the list/);
  assert.ok(!(await T.removeDomain(db, "kuku.lu", "adm")).added.includes("kuku.lu"));

  // Accounts: three at blocked domains (one an admin, one already suspended), one ordinary.
  const users = [
    { uid: "u1", email: "free@petchi.uk", username: "freecash" },
    { uid: "u2", email: "b@mail.petchi.uk", username: "botty" },
    { uid: "u3", email: "t@temp-mail.example", username: "tempy", suspended: true },
    { uid: "u4", email: "ada@gmail.com", username: "ada" },
    { uid: "u5", email: "staff@petchi.uk", username: "staffer", role: "admin" },
  ];
  for (const u of users) await db.doc(`users/${u.uid}`).set({ username: u.username, role: u.role ?? "reader", suspended: u.suspended ?? false });
  // Two pages, as Firebase Authentication returns them.
  const auth = {
    listUsers: async (_max?: number, token?: string) => (token ? { users: users.slice(3) } : { users: users.slice(0, 3), pageToken: "p2" }),
  } as never;
  const found = await T.findAccounts(db, auth);
  assert.deepEqual(found.map((a) => a.username).sort(), ["botty", "freecash", "staffer", "tempy"]);
  const botty = found.find((a) => a.uid === "u2")!;
  assert.equal(botty.domain, "mail.petchi.uk"); assert.equal(botty.blockedBy, "petchi.uk"); assert.equal(botty.status, "active");
  assert.ok(!("email" in botty), "never the address");
  assert.equal(found.find((a) => a.uid === "u3")!.status, "suspended");

  // Suspend: only the active, non-admin ones still at a blocked domain; never the ordinary one even if asked.
  await assert.rejects(T.suspendAccounts(db, auth, [], "adm"), /Choose/);
  const s = await T.suspendAccounts(db, auth, ["u1", "u2", "u3", "u4", "u5"], "adm");
  assert.deepEqual(s.suspended.sort(), ["u1", "u2"]);
  assert.equal(s.skipped, 3);
  assert.equal((await db.doc("users/u1").get()).data()?.suspended, true);
  assert.equal((await db.doc("suspensions/u1").get()).data()?.reason, THROWAWAY_REASON);
  assert.equal((await db.doc("users/u4").get()).data()?.suspended, false);
  assert.equal((await db.doc("users/u5").get()).data()?.suspended, false, "admins are never suspended this way");
  const notes = await db.collection("notifications").where("recipientUid", "==", "u2").get();
  assert.equal(notes.size, 1);
  assert.equal((await T.suspendAccounts(db, auth, ["u1"], "adm")).suspended.length, 0, "not twice");

  console.log("THROWAWAY SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
