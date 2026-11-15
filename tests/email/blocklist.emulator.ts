// Admin → Throwaway emails on the emulators (lib/email-blocklist-server.ts). Run: npm run test:email-blocklist-server
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { addDomains, addedDomains, findBlockedAccounts, removeDomain, suspendBlockedAccounts } from "../../lib/email-blocklist-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore(), auth = getAuth();
const refused = async (p: Promise<unknown>, re: RegExp) => { try { await p; } catch (e) { assert.match((e as Error).message, re); return; } assert.fail("expected a refusal"); };

(async () => {
  const people = [
    { uid: "t1", email: "spam@petchi.uk", username: "spammer" },
    { uid: "t2", email: "x@mail.temp-mail.example", username: "temp2" },
    { uid: "t3", email: "y@petchi.uk", username: null },
    { uid: "ok", email: "ada@gmail.com", username: "ada" },
  ];
  for (const p of people) {
    await auth.createUser({ uid: p.uid, email: p.email, password: "password123" }).catch(() => {});
    if (p.username) await db.doc(`users/${p.uid}`).set({ uid: p.uid, username: p.username, suspended: false });
  }
  await refused(addDomains(db, "gmail.com", "admin"), /ordinary email provider/);
  await refused(addDomains(db, "not a domain", "admin"), /Enter domains/);
  await refused(removeDomain(db, "petchi.uk", "admin"), /built in/);
  assert.deepEqual(await addDomains(db, "Temp-Mail.EXAMPLE\nkuku.lu, petchi.uk", "admin"), ["kuku.lu", "temp-mail.example"], "cleaned, sorted, built-in left out");
  const s = (await db.doc("settings/emailBlocklist").get()).data()!;
  assert.match("x@mail.temp-mail.example", new RegExp(s.regex)); assert.match("y@petchi.uk", new RegExp(s.regex));

  const found = await findBlockedAccounts(db, auth);
  assert.deepEqual(found.map((a) => a.uid).sort(), ["t1", "t2", "t3"]);
  assert.equal(found.find((a) => a.uid === "t3")!.username, null);
  assert.equal(await suspendBlockedAccounts(db, auth, "admin"), 2, "only accounts with a profile");
  assert.equal((await db.doc("users/t1").get()).data()!.suspended, true);
  assert.match(String((await db.doc("suspensions/t2").get()).data()!.reason), /throwaway/);
  assert.equal((await db.doc("users/ok").get()).data()!.suspended, false);
  assert.equal(await suspendBlockedAccounts(db, auth, "admin"), 0, "already suspended");

  assert.deepEqual(await removeDomain(db, "kuku.lu", "admin"), ["temp-mail.example"]);
  assert.deepEqual(await addedDomains(db), ["temp-mail.example"]);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
