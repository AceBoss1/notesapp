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
    ["goldSubscriptions/alice", { uid: "alice", status: "active" }],
    ["merchOrders/ref1", { uid: "alice", status: "delivered" }],
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

test("a new profile can't self-assign a tier, badge, organisation or trial", async () => {
  const base = { uid: "n2", username: "n2", displayName: "N", bio: "", avatar: "", social: {}, role: "reader", createdAt: "x", accountTier: "standard", suspended: false };
  await assertFails(setDoc(doc(as("n2"), "users/n2"), { ...base, accountTier: "enterprise" }));
  await assertFails(setDoc(doc(as("n2"), "users/n2"), { ...base, role: "admin" }));
  await assertFails(setDoc(doc(as("n2"), "users/n2"), { ...base, verified: true }));
  await assertFails(setDoc(doc(as("n2"), "users/n2"), { ...base, accountKind: "organisation", org: { rcStatus: "verified" } }));
  await assertFails(setDoc(doc(as("n2"), "users/n2"), { ...base, trialUntil: "2099-01-01T00:00:00.000Z" }));
  await assertSucceeds(setDoc(doc(as("n2"), "users/n2"), { ...base, consent: { version: "v", acceptedAt: "x" } }));
});

test("organisation fields can't be edited by the owner", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users/orgx"), { uid: "orgx", username: "orgx", displayName: "Org", bio: "", avatar: "", social: {}, role: "reader", createdAt: "x", accountTier: "business", suspended: false, accountKind: "organisation", org: { rcNumber: "RC123", rcStatus: "unverified" } });
  });
  await assertSucceeds(updateDoc(doc(as("orgx"), "users/orgx"), { bio: "We build things", social: { website: "https://x.com" } }));
  await assertFails(updateDoc(doc(as("orgx"), "users/orgx"), { "org.rcStatus": "verified" }));
  await assertFails(updateDoc(doc(as("orgx"), "users/orgx"), { trialUntil: "2099-01-01T00:00:00.000Z" }));
  await assertFails(updateDoc(doc(as("orgx"), "users/orgx"), { accountKind: "personal" }));
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

test("publishers manage only their own valid store items", async () => {
  const item = { ownerUid: "pub", title: "Book", price: "₦1,000", link: "https://selar.com/x", image: "/x.png", cta: "Buy" };
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/i1"), item));
  await assertSucceeds(getDoc(doc(anon(), "storeItems/i1")));
  await assertFails(setDoc(doc(as("alice"), "storeItems/i2"), { ...item, ownerUid: "alice" })); // standard tier can't publish
  await assertFails(setDoc(doc(as("pub"), "storeItems/i3"), { ...item, ownerUid: "alice" }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/i4"), { ...item, link: "javascript:alert(1)" }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/i5"), { ...item, extra: "x" }));
  await assertFails(updateDoc(doc(as("alice"), "storeItems/i1"), { title: "hijack" }));
  await assertFails(deleteDoc(doc(as("alice"), "storeItems/i1")));
  await assertSucceeds(deleteDoc(doc(as("pub"), "storeItems/i1")));
});

test("badge endorsement requests are private and server-created", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "badgeRequests/alice"), { status: "pending", message: "hello there", requestedAt: "x" });
  });
  await assertFails(getDoc(doc(anon(), "badgeRequests/alice")));
  await assertFails(getDoc(doc(as("pub"), "badgeRequests/alice")));
  await assertSucceeds(getDoc(doc(as("alice"), "badgeRequests/alice")));
  await assertFails(setDoc(doc(as("pub"), "badgeRequests/pub"), { status: "approved" }));
  await assertFails(updateDoc(doc(as("alice"), "badgeRequests/alice"), { status: "approved" }));
  await assertSucceeds(updateDoc(doc(as("boss", { admin: true }), "badgeRequests/alice"), { status: "approved" }));
});

test("merch orders are readable by the buyer and admins only", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "merchOrders/ref1"), { uid: "alice", status: "preordered" });
  });
  await assertSucceeds(getDoc(doc(as("alice"), "merchOrders/ref1")));
  await assertFails(getDoc(doc(as("pub"), "merchOrders/ref1")));
  await assertFails(getDoc(doc(anon(), "merchOrders/ref1")));
  await assertSucceeds(getDoc(doc(as("boss", { admin: true }), "merchOrders/ref1")));
});

test("ad campaigns are readable by the advertiser and admins, never writable", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "adCampaigns/ref1"), { uid: "alice", status: "in_review" });
  });
  await assertSucceeds(getDoc(doc(as("alice"), "adCampaigns/ref1")));
  await assertFails(getDoc(doc(as("pub"), "adCampaigns/ref1")));
  await assertFails(getDoc(doc(anon(), "adCampaigns/ref1")));
  await assertSucceeds(getDoc(doc(as("boss", { admin: true }), "adCampaigns/ref1")));
  await assertFails(updateDoc(doc(as("alice"), "adCampaigns/ref1"), { status: "live" }));
  await assertFails(setDoc(doc(as("alice"), "adCampaigns/new"), { uid: "alice", status: "live" }));
});

test("organisation team members write for the organisation, within limits", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const base = { role: "reader", social: {}, bio: "", avatar: "", createdAt: "x", suspended: false };
    await setDoc(doc(d, "users/org1"), { ...base, uid: "org1", username: "org1", displayName: "Org One", accountKind: "organisation", accountTier: "business" });
    await setDoc(doc(d, "users/org2"), { ...base, uid: "org2", username: "org2", displayName: "Org Two", accountKind: "organisation", accountTier: "basic" });
    await setDoc(doc(d, "users/wri"), { ...base, uid: "wri", username: "wri", displayName: "Writer", accountTier: "standard" });
    await setDoc(doc(d, "users/adm"), { ...base, uid: "adm", username: "adm", displayName: "Admin", accountTier: "standard" });
    await setDoc(doc(d, "orgMembers/org1_wri"), { orgUid: "org1", memberUid: "wri", role: "writer" });
    await setDoc(doc(d, "orgMembers/org1_adm"), { orgUid: "org1", memberUid: "adm", role: "admin" });
    await setDoc(doc(d, "orgMembers/org2_wri"), { orgUid: "org2", memberUid: "wri", role: "writer" });
    await setDoc(doc(d, "notes/orgnote"), { authorUid: "org1", writerUid: "adm", title: "t", status: "draft" });
  });
  const note = (org, writer) => ({ authorUid: org, writerUid: writer, title: "t", status: "draft", slug: "s" });
  // a writer publishes as the organisation
  await assertSucceeds(setDoc(doc(as("wri"), "notes/n1"), note("org1", "wri")));
  // ...but not for an organisation they're not on, one that isn't on Business, or as someone else
  await assertFails(setDoc(doc(as("wri"), "notes/n2"), note("org3", "wri")));
  await assertFails(setDoc(doc(as("wri"), "notes/n3"), note("org2", "wri")));
  await assertFails(setDoc(doc(as("wri"), "notes/n4"), note("org1", "adm")));
  // a plain member can't use writerUid on their own post, or claim another author
  await assertFails(setDoc(doc(as("alice"), "notes/n5"), { authorUid: "alice", writerUid: "alice", title: "t", status: "draft" }));
  await assertFails(setDoc(doc(as("alice"), "notes/n6"), note("org1", "alice")));
  // writer edits only their own org posts; an org admin edits any; nobody changes the author
  await assertSucceeds(setDoc(doc(as("wri"), "notes/mine"), note("org1", "wri")).then(() => updateDoc(doc(as("wri"), "notes/mine"), { title: "edited" })));
  await assertFails(updateDoc(doc(as("wri"), "notes/orgnote"), { title: "nope" }));
  await assertSucceeds(updateDoc(doc(as("adm"), "notes/orgnote"), { title: "edited by admin" }));
  await assertFails(updateDoc(doc(as("adm"), "notes/orgnote"), { authorUid: "org2" }));
  await assertFails(updateDoc(doc(as("wri"), "notes/mine"), { writerUid: "adm" }));
  // drafts: the writer and org admins can read them, other members can't
  await assertSucceeds(getDoc(doc(as("adm"), "notes/orgnote")));
  await assertFails(getDoc(doc(as("pub"), "notes/orgnote")));
  // delete: own post yes, someone else's no, admin yes
  await assertFails(deleteDoc(doc(as("wri"), "notes/orgnote")));
  await assertSucceeds(deleteDoc(doc(as("adm"), "notes/orgnote")));
  // the team tables are server-only
  await assertFails(setDoc(doc(as("wri"), "orgMembers/org1_pub"), { orgUid: "org1", memberUid: "pub", role: "admin" }));
  await assertFails(getDoc(doc(as("wri"), "orgMembers/org1_wri")));
});

test("store orders, parcels and handoff links are server-controlled", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "storeOrders/o1"), { buyerUid: "alice", sellerUid: "pub", status: "paid" });
    await setDoc(doc(d, "parcels/NA-AAAAAAAA"), { buyerUid: "alice", sellerUid: "pub", custody: [] });
    await setDoc(doc(d, "parcelLinks/h"), { parcelId: "NA-AAAAAAAA", active: true });
  });
  await assertSucceeds(getDoc(doc(as("alice"), "storeOrders/o1"))); // buyer
  await assertSucceeds(getDoc(doc(as("pub"), "storeOrders/o1"))); // seller
  await assertFails(getDoc(doc(as("stranger"), "storeOrders/o1")));
  await assertFails(getDoc(doc(anon(), "storeOrders/o1")));
  await assertSucceeds(getDoc(doc(as("boss", { admin: true }), "storeOrders/o1")));
  await assertFails(updateDoc(doc(as("alice"), "storeOrders/o1"), { status: "confirmed" }));
  await assertFails(updateDoc(doc(as("pub"), "storeOrders/o1"), { status: "delivered" }));
  await assertFails(getDoc(doc(as("alice"), "parcels/NA-AAAAAAAA")));
  await assertFails(updateDoc(doc(as("pub"), "parcels/NA-AAAAAAAA"), { custody: [{ holderName: "x" }] }));
  await assertFails(getDoc(doc(as("boss", { admin: true }), "parcelLinks/h")));
});

test("a seller can list a physical item for sale, within limits", async () => {
  const item = { ownerUid: "pub", title: "Laptop stand", price: "₦9,500", link: "https://www.notesapp.name.ng", image: "x", cta: "Buy now", sellable: true, priceKobo: 950000, deliveryKobo: 150000, stock: 5 };
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/s1"), item));
  await assertFails(setDoc(doc(as("pub"), "storeItems/s2"), { ...item, priceKobo: 50 })); // below ₦100
  await assertFails(setDoc(doc(as("pub"), "storeItems/s3"), { ...item, sellable: false }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/s4"), { ...item, deliveryKobo: 99999999 }));
  const { sellable, ...noFlag } = item;
  await assertFails(setDoc(doc(as("pub"), "storeItems/s5"), noFlag)); // sale fields without the flag
  await assertFails(setDoc(doc(as("alice"), "storeItems/s6"), { ...item, ownerUid: "alice" })); // Free Standard can't publish
});

test("co-author fields and invites are server-controlled", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "notes/co1"), { authorUid: "pub", title: "t", status: "draft" });
    await setDoc(doc(d, "coAuthorInvites/co1_alice"), { noteId: "co1", leadUid: "pub", inviteeUid: "alice", percent: 20, status: "pending" });
  });
  // a lead can't grant co-authorship by writing the note directly
  await assertFails(updateDoc(doc(as("pub"), "notes/co1"), { coAuthorUids: ["alice"], coAuthors: ["Alice"] }));
  await assertFails(setDoc(doc(as("pub"), "notes/co2"), { authorUid: "pub", title: "t", status: "draft", coAuthorUids: ["alice"] }));
  await assertSucceeds(updateDoc(doc(as("pub"), "notes/co1"), { title: "edited" }));
  // invites: lead + invitee read, others don't, nobody writes
  await assertSucceeds(getDoc(doc(as("pub"), "coAuthorInvites/co1_alice")));
  await assertSucceeds(getDoc(doc(as("alice"), "coAuthorInvites/co1_alice")));
  await assertFails(getDoc(doc(anon(), "coAuthorInvites/co1_alice")));
  await assertFails(updateDoc(doc(as("alice"), "coAuthorInvites/co1_alice"), { status: "accepted", percent: 90 }));
});

test("ad creatives are admin-only", async () => {
  await assertFails(setDoc(doc(as("pub"), "adCreatives/a1"), { title: "x", active: true }));
  await assertFails(getDoc(doc(anon(), "adCreatives/a1")));
  await assertSucceeds(setDoc(doc(as("boss", { admin: true }), "adCreatives/a1"), { title: "x", active: true }));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { adsOptIn: true }));
});

test("ad stats are server-written; publishers read only their own totals", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "adPublisherStats/pub_20261001"), { publisherUid: "pub", day: "20261001", impressions: 3 });
    await setDoc(doc(d, "adStats/a_20261001"), { adId: "a", impressions: 3 });
  });
  await assertSucceeds(getDoc(doc(as("pub"), "adPublisherStats/pub_20261001")));
  await assertFails(getDoc(doc(as("alice"), "adPublisherStats/pub_20261001")));
  await assertFails(setDoc(doc(as("pub"), "adPublisherStats/pub_20261002"), { publisherUid: "pub", impressions: 999999 }));
  await assertFails(getDoc(doc(as("pub"), "adStats/a_20261001")));
  await assertSucceeds(getDoc(doc(as("boss", { admin: true }), "adStats/a_20261001")));
});

test("ad revenue is admin-only; publishers read only their own ad-share statements", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "adRevenue/r1"), { month: "2026-10", amountKobo: 100000 });
    await setDoc(doc(d, "adShareStatements/2026-10_pub"), { uid: "pub", month: "2026-10", shareKobo: 5000, status: "pending_review" });
  });
  await assertFails(getDoc(doc(as("pub"), "adRevenue/r1")));
  await assertSucceeds(getDoc(doc(as("boss", { admin: true }), "adRevenue/r1")));
  await assertSucceeds(getDoc(doc(as("pub"), "adShareStatements/2026-10_pub")));
  await assertFails(getDoc(doc(as("alice"), "adShareStatements/2026-10_pub")));
  await assertFails(updateDoc(doc(as("pub"), "adShareStatements/2026-10_pub"), { shareKobo: 9999999, status: "approved" }));
});
