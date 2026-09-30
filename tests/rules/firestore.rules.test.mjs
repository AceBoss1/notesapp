// Run with:  npm run test:rules   (starts the Firestore emulator; needs Java)
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-notesapp",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice"), { uid: "alice", username: "alice", displayName: "Alice", bio: "", avatar: "", social: {}, role: "reader", email: "a@x.com", createdAt: "x", accountTier: "standard", suspended: false });
    await setDoc(doc(db, "users/pub"), { uid: "pub", username: "pub", displayName: "Pub", bio: "", avatar: "", social: {}, role: "reader", email: "p@x.com", createdAt: "x", accountTier: "basic", suspended: false });
    await setDoc(doc(db, "bookings/ref1"), { clientUid: "alice", publisherUid: "pub", status: "confirmed" });
    await setDoc(doc(db, "payments/ref1"), { uid: "alice", publisherUid: "pub", status: "paid" });
    await setDoc(doc(db, "ledger/ref1"), { publisherUid: "pub", payerUid: "alice", netKobo: 100 });
    await setDoc(doc(db, "payoutAccounts/pub"), { uid: "pub", recipientCode: "RCP_x" });
    await setDoc(doc(db, "publisherSettings/pub"), { uid: "pub" });
    await setDoc(doc(db, "tierSubscriptions/pub"), { uid: "pub", tier: "pro", status: "active" });
    await setDoc(doc(db, "boosts/b1"), { publisherUid: "pub", impressionsPurchased: 1000 });
    await setDoc(doc(db, "gifts/g1"), { toUid: "pub", fromUid: "alice", amountKobo: 100 });
    await setDoc(doc(db, "subscriptions/alice_pub"), { subscriberUid: "alice", username: "pub", status: "active" });
  });
});

const as = (uid, claims = {}) => env.authenticatedContext(uid, claims).firestore();
const anon = () => env.unauthenticatedContext().firestore();

test("users can edit their own bio but not role, tier, suspension or consent", async () => {
  await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), { bio: "hi" }));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { role: "admin" }));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { accountTier: "enterprise" }));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { suspended: false, consent: { version: "x" } }));
});

test("users cannot edit someone else's profile", async () => {
  await assertFails(updateDoc(doc(as("pub"), "users/alice"), { bio: "hacked" }));
});

test("money collections are never client-writable", async () => {
  for (const [path, data] of [
    ["bookings/new", { clientUid: "alice" }],
    ["payments/new", { uid: "alice" }],
    ["ledger/new", { publisherUid: "alice" }],
    ["slotLocks/new", {}],
    ["tierSubscriptions/alice", { uid: "alice", tier: "business", status: "active" }],
    ["platformPlans/pro_monthly", { planCode: "x" }],
    ["badgeSubscriptions/alice", { uid: "alice", status: "active" }],
    ["tierCharges/x", {}],
    ["boosts/new", { publisherUid: "alice", impressionsPurchased: 999999 }],
    ["gifts/new", { toUid: "alice", fromUid: "alice" }],
    ["pageViews/note_x_20260930", { count: 999999 }],
    ["payoutAccounts/alice", { recipientCode: "mine" }],
    ["publisherSettings/alice", { uid: "alice" }],
    ["subscriptions/alice_other", { subscriberUid: "alice" }],
  ]) {
    await assertFails(setDoc(doc(as("alice"), path), data));
  }
  await assertFails(updateDoc(doc(as("pub"), "ledger/ref1"), { netKobo: 999999 }));
  await assertFails(deleteDoc(doc(as("alice"), "bookings/ref1")));
});

test("booking readable by its client and publisher only", async () => {
  await assertSucceeds(getDoc(doc(as("alice"), "bookings/ref1")));
  await assertSucceeds(getDoc(doc(as("pub"), "bookings/ref1")));
  await assertFails(getDoc(doc(as("mallory"), "bookings/ref1")));
  await assertFails(getDoc(doc(anon(), "bookings/ref1")));
});

test("ledger readable by its publisher, not the payer or strangers", async () => {
  await assertSucceeds(getDoc(doc(as("pub"), "ledger/ref1")));
  await assertFails(getDoc(doc(as("alice"), "ledger/ref1")));
  await assertFails(getDoc(doc(as("mallory"), "ledger/ref1")));
});

test("payout account readable only by its owner (and admins)", async () => {
  await assertSucceeds(getDoc(doc(as("pub"), "payoutAccounts/pub")));
  await assertFails(getDoc(doc(as("alice"), "payoutAccounts/pub")));
  await assertFails(getDoc(doc(anon(), "payoutAccounts/pub")));
  await assertSucceeds(getDoc(doc(as("boss", { admin: true }), "payoutAccounts/pub")));
});

test("publisher settings are public to read", async () => {
  await assertSucceeds(getDoc(doc(anon(), "publisherSettings/pub")));
});

test("subscriber can delete their own subscription, others cannot", async () => {
  await assertFails(deleteDoc(doc(as("mallory"), "subscriptions/alice_pub")));
  await assertSucceeds(deleteDoc(doc(as("alice"), "subscriptions/alice_pub")));
});

test("admin custom claim grants access; a plain user with an admin-like claim name does not", async () => {
  await assertSucceeds(getDoc(doc(as("boss", { admin: true }), "ledger/ref1")));
  await assertFails(getDoc(doc(as("boss", { admin: false }), "ledger/ref1")));
  await assertFails(getDoc(doc(as("boss", { isAdmin: true }), "ledger/ref1")));
});

test("legacy founder email still works during the claims migration", async () => {
  await assertSucceeds(getDoc(doc(as("f", { email: "precheks.info@gmail.com" }), "ledger/ref1")));
  await assertFails(getDoc(doc(as("x", { email: "someone@else.com" }), "ledger/ref1")));
});

test("a standard-tier user cannot create a note; a basic-tier publisher can (own authorUid only)", async () => {
  await assertFails(setDoc(doc(as("alice"), "notes/n1"), { authorUid: "alice", title: "t" }));
  await assertSucceeds(setDoc(doc(as("pub"), "notes/n2"), { authorUid: "pub", title: "t" }));
  await assertFails(setDoc(doc(as("pub"), "notes/n3"), { authorUid: "alice", title: "t" }));
});

test("boost stats readable by the buyer only; gifts by recipient and sender only", async () => {
  await assertSucceeds(getDoc(doc(as("pub"), "boosts/b1")));
  await assertFails(getDoc(doc(as("alice"), "boosts/b1")));
  await assertFails(updateDoc(doc(as("pub"), "boosts/b1"), { impressionsDelivered: 1000 }));
  await assertFails(getDoc(doc(anon(), "boosts/b1")));
  await assertSucceeds(getDoc(doc(as("pub"), "gifts/g1")));
  await assertSucceeds(getDoc(doc(as("alice"), "gifts/g1")));
  await assertFails(getDoc(doc(as("mallory"), "gifts/g1")));
});

test("plan records: owner reads their own, others cannot; users can't self-upgrade their tier", async () => {
  await assertSucceeds(getDoc(doc(as("pub"), "tierSubscriptions/pub")));
  await assertFails(getDoc(doc(as("alice"), "tierSubscriptions/pub")));
  await assertFails(getDoc(doc(as("alice"), "platformPlans/pro_monthly")));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { accountTier: "business" }));
});

test("users can't grant themselves the verified badge or extend it", async () => {
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { badgeUntil: "2099-01-01T00:00:00.000Z" }));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { verified: true }));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { tierRequest: { status: "approved", message: "x", requestedAt: "x" } }));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { goldBadge: { kind: "identity", grantedAt: "x" } }));
  await assertSucceeds(updateDoc(doc(as("boss", { admin: true }), "users/alice"), { goldBadge: { kind: "endorsement", grantedAt: "x" } }));
});

test("public user documents can't be created with an email field", async () => {
  const base = { uid: "newbie", username: "newbie", displayName: "N", bio: "", avatar: "", social: {}, role: "reader", createdAt: "x", accountTier: "standard", suspended: false };
  await assertFails(setDoc(doc(as("newbie"), "users/newbie"), { ...base, email: "n@x.com" }));
  await assertSucceeds(setDoc(doc(as("newbie"), "users/newbie"), base));
});

test("a publisher can edit and delete their own entries, not other people's", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, "notes/mine"), { authorUid: "pub", title: "t", status: "draft" });
    await setDoc(doc(adminDb, "notes/theirs"), { authorUid: "someone", title: "t", status: "published" });
  });
  await assertSucceeds(updateDoc(doc(as("pub"), "notes/mine"), { title: "edited", status: "published" }));
  await assertFails(updateDoc(doc(as("pub"), "notes/theirs"), { title: "hijacked" }));
  await assertFails(deleteDoc(doc(as("pub"), "notes/theirs")));
  await assertSucceeds(deleteDoc(doc(as("pub"), "notes/mine")));
});

test("draft notes are private to their author and admins", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, "notes/draft1"), { authorUid: "pub", title: "t", status: "draft" });
    await setDoc(doc(adminDb, "notes/live1"), { authorUid: "pub", title: "t", status: "published" });
  });
  await assertSucceeds(getDoc(doc(anon(), "notes/live1")));
  await assertFails(getDoc(doc(anon(), "notes/draft1")));
  await assertFails(getDoc(doc(as("alice"), "notes/draft1")));
  await assertSucceeds(getDoc(doc(as("pub"), "notes/draft1")));
  await assertSucceeds(getDoc(doc(as("boss", { admin: true }), "notes/draft1")));
});

test("suspension details are private; the member can only file an appeal", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "users/alice"), { uid: "alice", username: "alice", suspended: true, accountTier: "standard", role: "reader" });
    await setDoc(doc(d, "suspensions/alice"), { reason: "spam", suspendedAt: "x", suspendedByUid: "boss", appealStatus: "none" });
  });
  await assertFails(getDoc(doc(anon(), "suspensions/alice")));
  await assertFails(getDoc(doc(as("pub"), "suspensions/alice")));
  await assertSucceeds(getDoc(doc(as("alice"), "suspensions/alice")));
  await assertSucceeds(getDoc(doc(as("boss", { admin: true }), "suspensions/alice")));
  await assertFails(updateDoc(doc(as("alice"), "suspensions/alice"), { reason: "none" }));
  await assertSucceeds(updateDoc(doc(as("alice"), "suspensions/alice"), { appealStatus: "pending", appealText: "sorry", appealedAt: "y" }));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { suspension: { reason: "x" } }));
  await assertSucceeds(updateDoc(doc(as("boss", { admin: true }), "suspensions/alice"), { appealStatus: "rejected" }));
});
