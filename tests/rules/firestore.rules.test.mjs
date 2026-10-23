// Run with:  npm run test:rules   (starts the Firestore emulator; needs Java)
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, deleteField, collection, query, where, orderBy, limit, serverTimestamp } from "firebase/firestore";

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

test("profile work lines: optional, short, and only on your own profile", async () => {
  await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), { industry: "tech", jobTitle: "CEO", workplace: "Acme Ltd" }));
  await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), { industry: "", jobTitle: "", workplace: "" })); // clearing them is fine
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { jobTitle: "x".repeat(61) }));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { workplace: "x".repeat(81) }));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { industry: "x".repeat(31) }));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { jobTitle: 42 }));
  await assertFails(updateDoc(doc(as("pub"), "users/alice"), { jobTitle: "CEO" })); // not someone else's
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { jobTitle: "CEO", role: "admin" })); // and nothing else rides along
  // At sign-up the same keys are allowed alongside the ordinary fields, with the same limits.
  const base = { uid: "newbie", username: "newbie", displayName: "N", bio: "", avatar: "", social: {}, role: "reader", createdAt: "x", accountTier: "standard", suspended: false, consent: { version: "v", acceptedAt: "x" } };
  await assertSucceeds(setDoc(doc(as("newbie"), "users/newbie"), { ...base, industry: "coaching", jobTitle: "CEO", workplace: "Acme" }));
  await assertFails(setDoc(doc(as("newbie2"), "users/newbie2"), { ...base, uid: "newbie2", username: "newbie2", jobTitle: "x".repeat(200) }));
  await assertFails(setDoc(doc(as("newbie3"), "users/newbie3"), { ...base, uid: "newbie3", username: "newbie3", notAllowed: "x" }));
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

test("a founder email without the admin claim is no longer an admin", async () => {
  await assertFails(getDoc(doc(as("f", { email: "precheks.info@gmail.com" }), "ledger/ref1")));
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

test("site theme, sections and About/Contact pages are server-only on a member's profile", async () => {
  await assertFails(updateDoc(doc(as("pub"), "users/pub"), { siteTheme: "maroon" }));
  await assertFails(updateDoc(doc(as("pub"), "users/pub"), { siteSections: { journals: false, shop: true, courses: true } }));
  await assertFails(updateDoc(doc(as("pub"), "users/pub"), { sitePages: { about: "Hi", updatedAt: "x" } }));
  await assertFails(updateDoc(doc(as("pub"), "users/pub"), { bio: "ok", "sitePages.contact": "Call me" })); // not alongside an allowed field either
  await assertSucceeds(updateDoc(doc(as("pub"), "users/pub"), { bio: "ok" }));
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
  const item = { ownerUid: "pub", title: "Book", price: "₦1,000", link: "https://www.notesapp.name.ng", image: "/x.png", cta: "Buy now", sellable: true, priceKobo: 100000, deliveryKobo: 0, stock: 4 };
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/i1"), item));
  await assertSucceeds(getDoc(doc(anon(), "storeItems/i1")));
  await assertFails(setDoc(doc(as("alice"), "storeItems/i2"), { ...item, ownerUid: "alice" })); // standard tier can't publish
  await assertFails(setDoc(doc(as("pub"), "storeItems/i3"), { ...item, ownerUid: "alice" }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/i4"), { ...item, link: "javascript:alert(1)" }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/i5"), { ...item, extra: "x" }));
  await assertSucceeds(updateDoc(doc(as("pub"), "storeItems/i1"), { featured: true })); // the owner features an item
  await assertFails(updateDoc(doc(as("pub"), "storeItems/i1"), { featured: "yes" }));
  await assertFails(updateDoc(doc(as("alice"), "storeItems/i1"), { featured: true })); // not someone else
  await assertFails(updateDoc(doc(as("alice"), "storeItems/i1"), { title: "hijack" }));
  await assertFails(deleteDoc(doc(as("alice"), "storeItems/i1")));
  await assertSucceeds(deleteDoc(doc(as("pub"), "storeItems/i1")));
});

test("store items: several photos and up to two options of up to twenty choices, stock per saved combination", async () => {
  const item = { ownerUid: "pub", title: "Gown", price: "₦9,000", link: "https://www.notesapp.name.ng", image: "/a.png", cta: "Buy now", sellable: true, priceKobo: 900000, deliveryKobo: 0, stock: 3 };
  const withOptions = { ...item, images: ["/a.png", "/b.png"], options: [{ name: "Size", choices: ["S", "M", "L"] }, { name: "Colour", choices: ["Red", "Blue"] }], variantStock: { "S|Red": 1, "S|Blue": 2 } };
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/v1"), withOptions));
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/v2"), { ...item, images: ["/a.png", "/b.png", "/c.png"] })); // photos only
  await assertFails(setDoc(doc(as("pub"), "storeItems/v3"), { ...item, images: ["1", "2", "3", "4", "5", "6"] })); // too many photos
  await assertFails(setDoc(doc(as("pub"), "storeItems/v4"), { ...withOptions, options: [...withOptions.options, { name: "Style", choices: ["A"] }] })); // three options
  await assertFails(setDoc(doc(as("pub"), "storeItems/v5"), { ...withOptions, options: [{ name: "Size", choices: Array.from({ length: 21 }, (_, n) => `S${n}`) }] })); // twenty-one choices
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/v5b"), { ...withOptions, options: [{ name: "Size", choices: Array.from({ length: 12 }, (_, n) => `S${n}`) }], variantStock: Object.fromEntries(Array.from({ length: 12 }, (_, n) => [`S${n}`, 2])) })); // twelve sizes
  await assertFails(setDoc(doc(as("pub"), "storeItems/v6"), { ...item, options: withOptions.options })); // options need stock per combination
  await assertFails(setDoc(doc(as("pub"), "storeItems/v7"), { ...item, variantStock: { "S|Red": 1 } })); // stock per combination needs options
  await assertFails(setDoc(doc(as("pub"), "storeItems/v8"), { ...withOptions, kind: "digital", stock: 0, deliveryKobo: 0 })); // downloads have no options
});

test("store items: category from the list, ships-from 2 to 60 characters; saves and store numbers are server-only", async () => {
  const item = { ownerUid: "pub", title: "Gown", price: "₦9,000", link: "https://www.notesapp.name.ng", image: "/a.png", cta: "Buy now", sellable: true, priceKobo: 900000, deliveryKobo: 0, stock: 3 };
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/c1"), { ...item, category: "Fashion & clothing", shipsFrom: "Lekki, Lagos" }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/c2"), { ...item, category: "Stolen goods" })); // not on the list
  await assertFails(setDoc(doc(as("pub"), "storeItems/c3"), { ...item, shipsFrom: "x" })); // too short
  await assertFails(setDoc(doc(as("pub"), "storeItems/c4"), { ...item, shipsFrom: "x".repeat(61) })); // too long
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/c5"), { ...item, subtitle: "x".repeat(1200) })); // description: up to 1,200 characters
  await assertFails(setDoc(doc(as("pub"), "storeItems/c6"), { ...item, subtitle: "x".repeat(1201) }));
  // weight, for delivery partners' prices: more than 0, up to 500 kg; delivery providers are server-only
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/w1"), { ...item, weightKg: 2.5 }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/w2"), { ...item, weightKg: 0 }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/w3"), { ...item, weightKg: 501 }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/w4"), { ...item, weightKg: "2" }));
  await assertFails(getDoc(doc(anon(), "logisticsProviders/pub")));
  await assertFails(setDoc(doc(as("pub"), "logisticsProviders/pub"), { listed: true }));
  // numbers: anyone reads, nobody writes
  await env.withSecurityRulesDisabled(async (ctx) => {
    const sdb = ctx.firestore();
    await setDoc(doc(sdb, "storeStats/c1"), { ownerUid: "pub", views: 4, favs: 1 });
    await setDoc(doc(sdb, "storeFavorites/alice_c1"), { uid: "alice", itemId: "c1", ownerUid: "pub", createdAt: "2026-10-10T00:00:00Z" });
  });
  await assertSucceeds(getDoc(doc(as("alice"), "storeStats/c1")));
  await assertSucceeds(getDoc(doc(anon(), "storeStats/c1")));
  await assertFails(setDoc(doc(as("pub"), "storeStats/c1"), { ownerUid: "pub", views: 999, favs: 999 }));
  // saves: only the member's own, never written from a browser
  await assertSucceeds(getDoc(doc(as("alice"), "storeFavorites/alice_c1")));
  await assertFails(getDoc(doc(as("pub"), "storeFavorites/alice_c1"))); // not even the seller
  await assertFails(setDoc(doc(as("alice"), "storeFavorites/alice_c9"), { uid: "alice", itemId: "c1", ownerUid: "pub", createdAt: "x" }));
  await assertFails(deleteDoc(doc(as("alice"), "storeFavorites/alice_c1")));
});

test("past profile pictures: anyone can see them, only the server writes them", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "profilePictures/p1"), { uid: "alice", url: "/images/headshots/a.jpg", createdAt: "2026-10-17T00:00:00Z" });
  });
  await assertSucceeds(getDoc(doc(anon(), "profilePictures/p1")));
  await assertFails(setDoc(doc(as("alice"), "profilePictures/p2"), { uid: "alice", url: "/images/x.jpg", createdAt: "x" }));
  await assertFails(deleteDoc(doc(as("alice"), "profilePictures/p1")));
});

test("saved journals: a member reads only their own, and only the server writes them", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "savedJournals/alice_n1"), { uid: "alice", noteId: "n1", savedAt: "2026-10-17T00:00:00Z" });
  });
  await assertSucceeds(getDoc(doc(as("alice"), "savedJournals/alice_n1")));
  await assertFails(getDoc(doc(as("bob"), "savedJournals/alice_n1")));
  await assertFails(getDoc(doc(anon(), "savedJournals/alice_n1")));
  await assertFails(setDoc(doc(as("alice"), "savedJournals/alice_n2"), { uid: "alice", noteId: "n2", savedAt: "x" }));
  await assertFails(deleteDoc(doc(as("alice"), "savedJournals/alice_n1")));
});

test("kept messages: a member reads only their own, and only the server writes them", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "keptMessages/alice_m1"), { uid: "alice", cid: "alice_bob", messageId: "m1", text: "Lunch at 1?" });
  });
  await assertSucceeds(getDoc(doc(as("alice"), "keptMessages/alice_m1")));
  await assertSucceeds(getDocs(query(collection(as("alice"), "keptMessages"), where("uid", "==", "alice"))));
  await assertFails(getDoc(doc(as("bob"), "keptMessages/alice_m1")));
  await assertFails(getDocs(collection(as("bob"), "keptMessages")));
  await assertFails(setDoc(doc(as("alice"), "keptMessages/alice_m2"), { uid: "alice", messageId: "m2", text: "x" }));
  await assertFails(deleteDoc(doc(as("alice"), "keptMessages/alice_m1")));
});

test("courses: published ones and their lessons are public, drafts and every write stay with the server", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "courses/live"), { ownerUid: "pub", title: "Excel", slug: "excel", status: "published" });
    await setDoc(doc(db, "courses/live/lessons/l1"), { order: 0, title: "Intro", kind: "youtube", youtubeId: "abcdefghijk" });
    await setDoc(doc(db, "courses/draft"), { ownerUid: "pub", title: "Soon", slug: "soon", status: "draft" });
    await setDoc(doc(db, "courses/draft/lessons/l1"), { order: 0, title: "Secret", kind: "text", body: "x" });
    await setDoc(doc(db, "courseSlugs/excel"), { courseId: "live" });
  });
  await assertSucceeds(getDoc(doc(anon(), "courses/live")));
  await assertSucceeds(getDoc(doc(anon(), "courses/live/lessons/l1")));
  await assertSucceeds(getDocs(query(collection(anon(), "courses/live/lessons"), orderBy("order"))));
  await assertSucceeds(getDocs(query(collection(anon(), "courses"), where("slug", "==", "excel"), where("status", "==", "published"))));
  await assertFails(getDocs(query(collection(anon(), "courses"), where("slug", "==", "soon")))); // a query that could return a draft
  await assertFails(getDoc(doc(anon(), "courses/draft")));
  await assertFails(getDoc(doc(as("pub"), "courses/draft"))); // even the teacher reads drafts through the server
  await assertFails(getDoc(doc(as("alice"), "courses/draft/lessons/l1")));
  await assertFails(getDocs(collection(as("alice"), "courses/draft/lessons")));
  await assertFails(getDoc(doc(as("alice"), "courseSlugs/excel")));
  // nobody writes a course, a lesson or a slug from a browser, not even the teacher
  await assertFails(setDoc(doc(as("pub"), "courses/new"), { ownerUid: "pub", title: "Mine", slug: "mine", status: "published" }));
  await assertFails(updateDoc(doc(as("pub"), "courses/live"), { enrolCount: 9999 }));
  await assertFails(updateDoc(doc(as("pub"), "courses/draft"), { status: "published" }));
  await assertFails(setDoc(doc(as("pub"), "courses/live/lessons/l2"), { order: 1, title: "More", kind: "text", body: "x" }));
  await assertFails(deleteDoc(doc(as("pub"), "courses/live/lessons/l1")));
  await assertFails(deleteDoc(doc(as("pub"), "courses/live")));
  await assertFails(setDoc(doc(as("pub"), "courseSlugs/taken"), { courseId: "x" }));
});

test("paid courses: the course is public, its lessons never are; links, invitations and purchases stay private", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "courses/paid"), { ownerUid: "pub", title: "Support", slug: "support", status: "published", priceKobo: 4000000, outline: [{ id: "l1", title: "Intro", kind: "video" }] });
    await setDoc(doc(db, "courses/paid/lessons/l1"), { order: 0, title: "Intro", kind: "video", streamUid: "a".repeat(32), preview: true });
    await setDoc(doc(db, "courseLinks/paid"), { classUrl: "https://zoom.us/j/1", communityUrl: "" });
    await setDoc(doc(db, "courseTutorInvites/paid_bob"), { courseId: "paid", uid: "bob", percent: 30, status: "accepted" });
    await setDoc(doc(db, "coursePurchases/ref1"), { buyerUid: "alice", courseId: "paid", status: "active" });
  });
  await assertSucceeds(getDoc(doc(anon(), "courses/paid")));
  await assertFails(getDoc(doc(anon(), "courses/paid/lessons/l1"))); // even a free preview opens through /api/academy/lesson
  await assertFails(getDoc(doc(as("alice"), "courses/paid/lessons/l1")));
  await assertFails(getDocs(collection(as("alice"), "courses/paid/lessons")));
  await assertFails(getDoc(doc(as("alice"), "courseLinks/paid")));
  await assertFails(getDoc(doc(as("bob"), "courseTutorInvites/paid_bob")));
  await assertSucceeds(getDoc(doc(as("alice"), "coursePurchases/ref1")));
  await assertFails(getDoc(doc(as("bob"), "coursePurchases/ref1")));
  await assertFails(setDoc(doc(as("alice"), "coursePurchases/ref2"), { buyerUid: "alice", courseId: "paid", status: "active" }));
});

test("enrolments: a learner reads only their own progress, and only the server writes it", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "enrolments/live_alice"), { courseId: "live", uid: "alice", enrolledAt: "2026-10-17T00:00:00Z", done: { l1: "2026-10-17T01:00:00Z" } });
  });
  await assertSucceeds(getDoc(doc(as("alice"), "enrolments/live_alice")));
  await assertSucceeds(getDocs(query(collection(as("alice"), "enrolments"), where("uid", "==", "alice"), where("courseId", "==", "live"))));
  await assertFails(getDoc(doc(as("pub"), "enrolments/live_alice")));
  await assertFails(getDoc(doc(anon(), "enrolments/live_alice")));
  await assertFails(getDocs(query(collection(as("pub"), "enrolments"), where("courseId", "==", "live"))));
  await assertFails(setDoc(doc(as("alice"), "enrolments/live2_alice"), { courseId: "live2", uid: "alice", enrolledAt: "x", done: {} }));
  await assertFails(updateDoc(doc(as("alice"), "enrolments/live_alice"), { completedAt: "2026-10-17T02:00:00Z" }));
  await assertFails(deleteDoc(doc(as("alice"), "enrolments/live_alice")));
});

test("digital store items: no delivery/stock, kind is fixed, files and purchases are server-only", async () => {
  const base = { ownerUid: "pub", title: "Guide", price: "₦2,000", link: "https://www.notesapp.name.ng", image: "/x.png", cta: "Buy & download", sellable: true, priceKobo: 200000, deliveryKobo: 0, stock: 0 };
  const digital = { ...base, kind: "digital", fileName: "guide.pdf", fileSize: 1234 };
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/d1"), digital));
  await assertSucceeds(updateDoc(doc(as("pub"), "storeItems/d1"), { priceKobo: 300000, price: "₦3,000" }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/d2"), { ...digital, deliveryKobo: 500000 })); // digital has no delivery fee
  await assertFails(setDoc(doc(as("pub"), "storeItems/d3"), { ...digital, stock: 5 }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/d4"), { ...base, kind: "physical", fileName: "x.pdf" })); // physical carries no file
  await assertFails(setDoc(doc(as("pub"), "storeItems/d5"), { ...digital, kind: "download" }));
  // physical <-> digital switching is refused
  await assertFails(updateDoc(doc(as("pub"), "storeItems/d1"), { kind: "physical", fileName: null }));
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/p1"), { ...base, deliveryKobo: 100000, stock: 3 }));
  await assertFails(updateDoc(doc(as("pub"), "storeItems/p1"), { kind: "digital", deliveryKobo: 0, stock: 0 }));
  // the private file record and purchases can't be read or written from a client
  await env.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, "storeFiles/d1"), { key: "digital/d1/guide.pdf" });
    await setDoc(doc(adminDb, "digitalPurchases/r1"), { buyerUid: "alice", sellerUid: "pub", itemId: "d1" });
  });
  await assertFails(getDoc(doc(as("pub"), "storeFiles/d1")));
  await assertFails(setDoc(doc(as("pub"), "storeFiles/d9"), { key: "x" }));
  await assertSucceeds(getDoc(doc(as("alice"), "digitalPurchases/r1"))); // buyer
  await assertSucceeds(getDoc(doc(as("pub"), "digitalPurchases/r1"))); // seller
  await assertFails(getDoc(doc(as("other"), "digitalPurchases/r1")));
  await assertFails(setDoc(doc(as("alice"), "digitalPurchases/r2"), { buyerUid: "alice", sellerUid: "pub" }));
});

test("payout secrets are server-only", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "payoutSecrets/alice"), { accountNumberEnc: "x" });
  });
  await assertFails(getDoc(doc(as("alice"), "payoutSecrets/alice"))); // not even the owner
  await assertFails(setDoc(doc(as("alice"), "payoutSecrets/alice"), { accountNumberEnc: "y" }));
});

test("Paylony webhook events are server-only", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "paylonyEvents/e1"), { event: "collection", amount: "5000" });
  });
  await assertFails(getDoc(doc(as("alice"), "paylonyEvents/e1")));
  await assertFails(setDoc(doc(as("alice"), "paylonyEvents/e2"), { event: "collection" }));
});

test("view-only items: access/lessons only on digital items, device records are server-only", async () => {
  const base = { ownerUid: "pub", title: "Course", price: "₦9,000", link: "https://www.notesapp.name.ng", image: "/x.png", cta: "Buy & view", sellable: true, priceKobo: 900000, deliveryKobo: 0, stock: 0 };
  const view = { ...base, kind: "digital", access: "view" };
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/v1"), view));
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/v2"), { ...view, lessons: [{ id: "a1", title: "Intro", kind: "video" }], lessonCount: 1 }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/v3"), { ...view, access: "stream" })); // only download | view
  await assertFails(setDoc(doc(as("pub"), "storeItems/v4"), { ...base, access: "view" })); // physical items have no access mode
  await assertFails(setDoc(doc(as("pub"), "storeItems/v5"), { ...view, lessonCount: 99 }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/v6"), { ...view, lessons: "x" }));
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "viewAccess/r1"), { buyerUid: "alice", devices: [] });
  });
  await assertFails(getDoc(doc(as("alice"), "viewAccess/r1")));
  await assertFails(setDoc(doc(as("alice"), "viewAccess/r2"), { buyerUid: "alice", devices: [] }));
});

test("error logs are server-only", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "errorLogs/e1"), { message: "x", count: 1 });
  });
  await assertFails(getDoc(doc(as("pub"), "errorLogs/e1")));
  await assertFails(getDoc(doc(as("boss", { admin: true }), "errorLogs/e1"))); // even admins go through the server route
  await assertFails(setDoc(doc(anon(), "errorLogs/e2"), { message: "spam" }));
});

test("API keys, webhooks, deliveries and domains are server-only; members can't grant themselves API access", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "apiKeys/k1"), { uid: "pub", hash: "x" });
    await setDoc(doc(db, "webhookEndpoints/w1"), { uid: "pub", secret: "whsec_x" });
    await setDoc(doc(db, "webhookDeliveries/d1"), { uid: "pub" });
    await setDoc(doc(db, "customDomains/notes.brand.com"), { uid: "pub", status: "active" });
  });
  for (const path of ["apiKeys/k1", "webhookEndpoints/w1", "webhookDeliveries/d1", "customDomains/notes.brand.com"]) {
    await assertFails(getDoc(doc(as("pub"), path)));
    await assertFails(getDoc(doc(as("boss", { admin: true }), path)));
    await assertFails(setDoc(doc(as("pub"), path), { uid: "pub" }));
  }
  await assertFails(updateDoc(doc(as("pub"), "users/pub"), { apiAccess: true }));
});

test("a post can only carry a video the same member uploaded and the server verified", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "videoUploads/v_ok"), { uid: "pub", key: "videos/pub/v_ok.mp4", verified: true });
    await setDoc(doc(db, "videoUploads/v_pending"), { uid: "pub", key: "videos/pub/v_pending.mp4", verified: false });
    await setDoc(doc(db, "videoUploads/v_other"), { uid: "someone", key: "videos/someone/v_other.mp4", verified: true });
    await setDoc(doc(db, "notes/withvideo"), { authorUid: "pub", title: "t", status: "published", videoId: "v_ok", videoKey: "videos/pub/v_ok.mp4" });
  });
  const note = (extra) => ({ authorUid: "pub", title: "t", ...extra });
  // verified, own, matching key → fine
  await assertSucceeds(setDoc(doc(as("pub"), "notes/a"), note({ videoId: "v_ok", videoKey: "videos/pub/v_ok.mp4", videoDuration: 30 })));
  // not verified yet, someone else's, wrong key, made-up id, no key → all refused
  await assertFails(setDoc(doc(as("pub"), "notes/b"), note({ videoId: "v_pending", videoKey: "videos/pub/v_pending.mp4" })));
  await assertFails(setDoc(doc(as("pub"), "notes/c"), note({ videoId: "v_other", videoKey: "videos/someone/v_other.mp4" })));
  await assertFails(setDoc(doc(as("pub"), "notes/d"), note({ videoId: "v_ok", videoKey: "videos/pub/other-file.mp4" })));
  await assertFails(setDoc(doc(as("pub"), "notes/e"), note({ videoId: "nope", videoKey: "videos/pub/nope.mp4" })));
  await assertFails(setDoc(doc(as("pub"), "notes/f"), note({ videoId: "v_ok" })));
  // a post without video is unaffected; editing other fields keeps the video; removing it is allowed; swapping in a bad one is not
  await assertSucceeds(setDoc(doc(as("pub"), "notes/g"), note({})));
  await assertSucceeds(updateDoc(doc(as("pub"), "notes/withvideo"), { title: "edited" }));
  await assertFails(updateDoc(doc(as("pub"), "notes/withvideo"), { videoId: "v_pending", videoKey: "videos/pub/v_pending.mp4" }));
  await assertFails(updateDoc(doc(as("pub"), "notes/g"), { videoId: "v_other", videoKey: "videos/someone/v_other.mp4" }));
  await assertSucceeds(updateDoc(doc(as("pub"), "notes/withvideo"), { videoId: deleteField(), videoKey: deleteField() }));
  // the upload records themselves are server-only
  await assertFails(getDoc(doc(as("pub"), "videoUploads/v_ok")));
  await assertFails(setDoc(doc(as("pub"), "videoUploads/mine"), { uid: "pub", key: "videos/pub/mine.mp4", verified: true }));
  await assertFails(setDoc(doc(as("pub"), "videoUsage/pub_2026-W41"), { uid: "pub", count: 0 }));
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

test("a seller can list a physical item for sale: managed stock, no link-outs", async () => {
  const item = { ownerUid: "pub", title: "Laptop stand", price: "₦9,500", link: "https://www.notesapp.name.ng", image: "x", cta: "Buy now", sellable: true, priceKobo: 950000, deliveryKobo: 150000, stock: 5 };
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/s1"), item));
  await assertSucceeds(setDoc(doc(as("pub"), "storeItems/s1b"), { ...item, stock: 0 })); // sold out is fine
  await assertFails(setDoc(doc(as("pub"), "storeItems/s2"), { ...item, priceKobo: 50 })); // below ₦100
  await assertFails(setDoc(doc(as("pub"), "storeItems/s3"), { ...item, sellable: false }));
  await assertFails(setDoc(doc(as("pub"), "storeItems/s4"), { ...item, deliveryKobo: 99999999 }));
  const { stock, ...noStock } = item;
  await assertFails(setDoc(doc(as("pub"), "storeItems/s5"), noStock)); // stock is required
  await assertFails(setDoc(doc(as("pub"), "storeItems/s5b"), { ...item, stock: -1 }));
  const { sellable, priceKobo, deliveryKobo, ...linkOut } = item;
  await assertFails(setDoc(doc(as("pub"), "storeItems/s5c"), { ...linkOut, link: "https://selar.com/x" })); // no link-out items
  await assertFails(setDoc(doc(as("alice"), "storeItems/s6"), { ...item, ownerUid: "alice" })); // Free Standard can't publish
  await assertFails(setDoc(doc(as("alice"), "storeItems/s7"), { ...item, ownerUid: "pub" })); // not someone else's store
});

test("an organisation's store can be run by team members the owner permitted", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const base = { role: "reader", social: {}, bio: "", avatar: "", createdAt: "x", suspended: false };
    await setDoc(doc(d, "users/orgs"), { ...base, uid: "orgs", username: "orgs", displayName: "Org S", accountKind: "organisation", accountTier: "business" });
    await setDoc(doc(d, "users/orgb"), { ...base, uid: "orgb", username: "orgb", displayName: "Org B", accountKind: "organisation", accountTier: "basic" });
    await setDoc(doc(d, "users/seller"), { ...base, uid: "seller", username: "seller", displayName: "S", accountTier: "standard" });
    await setDoc(doc(d, "users/plain"), { ...base, uid: "plain", username: "plain", displayName: "P", accountTier: "standard" });
    await setDoc(doc(d, "orgMembers/orgs_seller"), { orgUid: "orgs", memberUid: "seller", role: "writer", store: true });
    await setDoc(doc(d, "orgMembers/orgs_plain"), { orgUid: "orgs", memberUid: "plain", role: "admin" });
    await setDoc(doc(d, "users/wr"), { ...base, uid: "wr", username: "wr", displayName: "W", accountTier: "standard" });
    await setDoc(doc(d, "orgMembers/orgs_wr"), { orgUid: "orgs", memberUid: "wr", role: "writer" });
    await setDoc(doc(d, "orgMembers/orgb_seller"), { orgUid: "orgb", memberUid: "seller", role: "writer", store: true });
    await setDoc(doc(d, "storeItems/orgitem"), { ownerUid: "orgs", title: "t", price: "p", link: "https://www.notesapp.name.ng", image: "x", cta: "Buy now", sellable: true, priceKobo: 100000, deliveryKobo: 0, stock: 3 });
  });
  const item = (owner) => ({ ownerUid: owner, title: "Bag", price: "₦5,000", link: "https://www.notesapp.name.ng", image: "x", cta: "Buy now", sellable: true, priceKobo: 500000, deliveryKobo: 0, stock: 2 });
  // a member with store access lists, edits and removes the organisation's items
  await assertSucceeds(setDoc(doc(as("seller"), "storeItems/o1"), item("orgs")));
  await assertSucceeds(updateDoc(doc(as("seller"), "storeItems/orgitem"), { stock: 9 }));
  await assertFails(updateDoc(doc(as("seller"), "storeItems/orgitem"), { ownerUid: "seller" }));
  await assertSucceeds(deleteDoc(doc(as("seller"), "storeItems/o1")));
  // an organisation admin (no separate store switch) can add and edit items to help the owner, but not delete them
  await assertSucceeds(setDoc(doc(as("plain"), "storeItems/o2"), item("orgs")));
  await assertSucceeds(updateDoc(doc(as("plain"), "storeItems/o2"), { stock: 5 }));
  await assertFails(updateDoc(doc(as("plain"), "storeItems/o2"), { ownerUid: "plain" }));
  await assertFails(deleteDoc(doc(as("plain"), "storeItems/o2")));
  // a plain writer without store access, or a stranger, can't
  await assertFails(setDoc(doc(as("wr"), "storeItems/o2w"), item("orgs")));
  await assertFails(setDoc(doc(as("pub"), "storeItems/o3"), item("orgs")));
  // the organisation has to be on a team plan
  await assertFails(setDoc(doc(as("seller"), "storeItems/o4"), item("orgb")));
  // "notify me" watches are server-only
  await assertFails(setDoc(doc(as("alice"), "stockWatches/orgitem_alice"), { itemId: "orgitem", uid: "alice" }));
  await assertFails(getDoc(doc(as("alice"), "stockWatches/orgitem_alice")));
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

test("moments are API-only; conversations are readable only by their two members and never writable", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "moments/m1"), { ownerUid: "pub", ownerUsername: "pub", expiresAt: "2099-01-01T00:00:00.000Z" });
    await setDoc(doc(d, "moments/m1/likes/alice"), { uid: "alice" });
    await setDoc(doc(d, "momentUsage/pub_2026-10-07"), { count: 1 });
    await setDoc(doc(d, "dmBlocks/pub_alice"), { at: "x" });
    await setDoc(doc(d, "momentAudio/a1"), { uid: "pub", key: "moments/pub/a1.webm" });
    await setDoc(doc(d, "serverConfig/limits"), { overrides: {} });
    await setDoc(doc(d, "teamItems/t1"), { title: "x", status: "todo" });
    await setDoc(doc(d, "teamMilestones/m1"), { title: "x" });
    await setDoc(doc(d, "teamItems/t1/discussion/c1"), { byUid: "boss", text: "x" });
    await setDoc(doc(d, "teamMeetings/mt1"), { title: "x" });
    await setDoc(doc(d, "teamReviews/2026-10-05"), { wins: "x" });
    await setDoc(doc(d, "teamDigests/2026-10-09"), { sent: 1 });
    await setDoc(doc(d, "socialConnections/alice_x"), { uid: "alice", accessToken: "enc" });
    await setDoc(doc(d, "socialStates/s1"), { uid: "alice" });
    await setDoc(doc(d, "socialPosts/n1_x"), { uid: "alice" });
    await setDoc(doc(d, "messageUploads/u1"), { uid: "alice", key: "messages/alice/u1-a.png", used: false });
    await setDoc(doc(d, "contentReports/r1"), { reporterUid: "alice", targetUid: "pub", kind: "moment", evidence: { text: "x" } });
    await setDoc(doc(d, "conversations/alice_pub"), { participants: ["alice", "pub"], unread: {} });
    await setDoc(doc(d, "conversations/alice_pub/messages/1"), { from: "alice", text: "hi", createdAt: "x" });
    await setDoc(doc(d, "conversations/boss_pub"), { participants: ["boss", "pub"], unread: {} });
    await setDoc(doc(d, "conversations/g_crew"), { kind: "group", scope: "public", title: "Crew", participants: ["alice", "pub", "boss"], adminUids: ["alice"], unread: {} });
    await setDoc(doc(d, "conversations/g_crew/messages/1"), { from: "alice", text: "hi all", createdAt: "x" });
  });
  // Moments: not even the owner, and not signed out.
  for (const ctx of [as("pub"), as("alice"), anon()]) {
    await assertFails(getDoc(doc(ctx, "moments/m1")));
    await assertFails(getDoc(doc(ctx, "moments/m1/likes/alice")));
  }
  await assertFails(setDoc(doc(as("pub"), "moments/m2"), { ownerUid: "pub", expiresAt: "2099-01-01T00:00:00.000Z" }));
  await assertFails(deleteDoc(doc(as("pub"), "moments/m1")));
  await assertFails(setDoc(doc(as("pub"), "momentUsage/pub_2026-10-07"), { count: 0 }));
  await assertFails(getDoc(doc(as("alice"), "dmBlocks/pub_alice")));
  // Recordings and reports (which hold a copy of what was reported): server-only, not even for the reporter or the owner.
  for (const path of ["momentAudio/a1", "contentReports/r1", "serverConfig/limits", "messageUploads/u1"]) {
    for (const ctx of [as("pub"), as("alice"), as("boss", { admin: true }), anon()]) await assertFails(getDoc(doc(ctx, path)));
  }
  // The team hub is read and written by the admin API only: not even an admin from the browser.
  for (const path of ["teamItems/t1", "teamItems/t1/discussion/c1", "teamMilestones/m1", "teamMeetings/mt1", "teamReviews/2026-10-05", "teamDigests/2026-10-09"]) {
    for (const ctx of [as("alice"), as("boss", { admin: true }), anon()]) await assertFails(getDoc(doc(ctx, path)));
  }
  await assertFails(setDoc(doc(as("boss", { admin: true }), "teamItems/new"), { title: "x" }));
  // Connected social accounts hold encrypted tokens: not even the owner can read or change them from the browser.
  for (const path of ["socialConnections/alice_x", "socialStates/s1", "socialPosts/n1_x"]) {
    for (const ctx of [as("alice"), as("boss", { admin: true }), anon()]) await assertFails(getDoc(doc(ctx, path)));
  }
  await assertFails(setDoc(doc(as("alice"), "socialConnections/alice_x"), { uid: "alice", accessToken: "mine" }));
  await assertFails(deleteDoc(doc(as("alice"), "socialConnections/alice_x")));
  await assertFails(deleteDoc(doc(as("boss", { admin: true }), "teamItems/t1")));
  await assertFails(setDoc(doc(as("boss", { admin: true }), "teamItems/t1/discussion/new"), { byUid: "boss", text: "x" }));
  await assertFails(setDoc(doc(as("boss", { admin: true }), "teamMeetings/new"), { title: "x" }));
  await assertFails(setDoc(doc(as("alice"), "contentReports/new"), { reporterUid: "alice" }));
  await assertFails(setDoc(doc(as("pub"), "momentAudio/new"), { uid: "pub" }));
  await assertFails(setDoc(doc(as("boss", { admin: true }), "serverConfig/limits"), { overrides: {} })); // limits are saved through the admin API, never from the browser
  await assertFails(setDoc(doc(as("alice"), "messageUploads/new"), { uid: "alice" }));
  await assertFails(setDoc(doc(as("alice"), "dmBlocks/alice_pub"), { at: "x" }));
  // Conversations: both members read; a third member and signed-out visitors can't.
  await assertSucceeds(getDoc(doc(as("alice"), "conversations/alice_pub")));
  await assertSucceeds(getDoc(doc(as("pub"), "conversations/alice_pub")));
  await assertSucceeds(getDoc(doc(as("alice"), "conversations/alice_pub/messages/1")));
  await assertFails(getDoc(doc(as("boss"), "conversations/alice_pub")));
  await assertFails(getDoc(doc(as("boss"), "conversations/alice_pub/messages/1")));
  await assertFails(getDoc(doc(anon(), "conversations/alice_pub")));
  await assertFails(getDoc(doc(as("alice"), "conversations/boss_pub")));
  // Group chats: every member reads; someone outside (or signed out) can't; nobody writes from the browser, not even a group admin.
  for (const who of ["alice", "pub", "boss"]) {
    await assertSucceeds(getDoc(doc(as(who), "conversations/g_crew")));
    await assertSucceeds(getDoc(doc(as(who), "conversations/g_crew/messages/1")));
  }
  await assertFails(getDoc(doc(as("stranger"), "conversations/g_crew")));
  await assertFails(getDoc(doc(as("stranger"), "conversations/g_crew/messages/1")));
  await assertFails(getDoc(doc(anon(), "conversations/g_crew")));
  await assertFails(setDoc(doc(as("alice"), "conversations/g_crew/messages/2"), { from: "alice", text: "forged", createdAt: "x" }));
  await assertFails(updateDoc(doc(as("alice"), "conversations/g_crew"), { participants: ["alice", "stranger"] }));
  await assertFails(updateDoc(doc(as("alice"), "conversations/g_crew"), { adminUids: ["alice", "boss"] }));
  await assertFails(deleteDoc(doc(as("alice"), "conversations/g_crew")));
  // The live views list a member's own conversations and one conversation's messages: allowed only with the constraint that proves it.
  await assertSucceeds(getDocs(query(collection(as("alice"), "conversations"), where("participants", "array-contains", "alice"))));
  await assertFails(getDocs(query(collection(as("alice"), "conversations"), where("participants", "array-contains", "pub"))));
  await assertFails(getDocs(collection(as("alice"), "conversations")));
  await assertSucceeds(getDocs(query(collection(as("pub"), "conversations/alice_pub/messages"), orderBy("createdAt", "desc"), limit(100))));
  await assertFails(getDocs(query(collection(as("boss"), "conversations/alice_pub/messages"), orderBy("createdAt", "desc"), limit(100))));
  // Preferences and push subscriptions: server-only.
  for (const path of ["userPrefs/alice", "pushSubscriptions/p1"]) {
    await assertFails(getDoc(doc(as("alice"), path)));
    await assertFails(setDoc(doc(as("alice"), path), { uid: "alice", emailMessages: false }));
  }
  // Never written from a browser, not even by a member of the conversation.
  await assertFails(setDoc(doc(as("alice"), "conversations/alice_pub/messages/2"), { from: "alice", text: "forged", createdAt: "x" }));
  await assertFails(updateDoc(doc(as("alice"), "conversations/alice_pub"), { unread: {} }));
  await assertFails(deleteDoc(doc(as("alice"), "conversations/alice_pub/messages/1")));
  await assertFails(setDoc(doc(as("alice"), "conversations/alice_zed"), { participants: ["alice", "zed"] }));
});

// ---- Staff roles: a super admin (or an account with only the old `admin` claim) sees everything; an admin sees only their departments.
const staff = (...depts) => as("staff", { admin: true, adminRole: "admin", depts });
const superAdmin = () => as("boss", { admin: true, adminRole: "super" });
const legacyAdmin = () => as("boss2", { admin: true });

test("staff roles: each department reaches its own collections and not the others'", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "notes/draft1"), { slug: "d", title: "x", status: "draft", authorUid: "pub" });
    await setDoc(doc(d, "notes/pub1"), { slug: "p", title: "x", status: "published", authorUid: "pub" });
    await setDoc(doc(d, "notes/pub1/comments/c1"), { authorUid: "alice", text: "x", likeCount: 0 });
    await setDoc(doc(d, "leads/l1"), { name: "n", email: "e", category: "other", message: "m", status: "new", createdAt: "x" });
    await setDoc(doc(d, "suspensions/alice"), { reason: "x", appealStatus: "none" });
    await setDoc(doc(d, "merchOrders/m1"), { uid: "alice", status: "preordered" });
    await setDoc(doc(d, "storeOrders/o1"), { buyerUid: "alice", sellerUid: "pub", status: "paid" });
    await setDoc(doc(d, "adRevenue/r1"), { month: "2026-10" });
    await setDoc(doc(d, "adCampaigns/a1"), { uid: "alice", status: "live" });
    await setDoc(doc(d, "adCreatives/c1"), { title: "x" });
    await setDoc(doc(d, "orgMembers/o_p"), { orgUid: "o", memberUid: "pub" });
    await setDoc(doc(d, "badgeRequests/alice"), { status: "pending" });
    await setDoc(doc(d, "settings/site"), { email: "x" });
  });
  const reads = { // path → the departments allowed to read it (a super admin always can)
    "notes/draft1": ["content", "moderation"], "leads/l1": ["support", "growth"], "suspensions/alice": ["support", "moderation"],
    "merchOrders/m1": ["finance", "support"], "storeOrders/o1": ["finance", "support"], "adRevenue/r1": ["finance"], "adCampaigns/a1": ["growth", "finance"],
    "adCreatives/c1": ["growth"], "orgMembers/o_p": ["support", "growth"], "badgeRequests/alice": ["support", "moderation"],
    "payments/ref1": ["finance"], "ledger/ref1": ["finance"], "payoutAccounts/pub": ["finance"], "bookings/ref1": ["support", "finance"], "gifts/g1": ["finance", "support"],
    "boosts/b1": ["growth", "finance"], "tierSubscriptions/pub": ["finance", "support"],
  };
  const all = ["support", "moderation", "finance", "growth", "content", "product"];
  for (const [path, allowed] of Object.entries(reads)) {
    for (const dept of all) {
      const run = allowed.includes(dept) ? assertSucceeds : assertFails;
      await run(getDoc(doc(staff(dept), path))).catch((e) => { throw new Error(`${dept} reading ${path} (allowed: ${allowed.includes(dept)}): ${e.message}`); });
    }
    await assertSucceeds(getDoc(doc(superAdmin(), path))).catch((e) => { throw new Error(`super reading ${path}: ${e.message}`); });
    await assertSucceeds(getDoc(doc(legacyAdmin(), path))).catch((e) => { throw new Error(`legacy reading ${path}: ${e.message}`); }); // accounts set up before roles existed stay super admins
    await assertFails(getDoc(doc(staff(), path))).catch((e) => { throw new Error(`no-department reading ${path}: ${e.message}`); }); // an admin with no department sees none of it
    await assertFails(getDoc(doc(as("nobody", { adminRole: "super" }), path))).catch((e) => { throw new Error(`role-only reading ${path}: ${e.message}`); }); // a role claim without `admin` is nothing
    await assertFails(getDoc(doc(as("odd", { admin: true, adminRole: "weird", depts: ["finance"] }), path.replace(/.*/, "leads/l1")))); // an unknown role is the safe reading (depts, not super)
  }
  // Writing: each department only where it belongs.
  await assertSucceeds(updateDoc(doc(staff("content"), "notes/pub1"), { title: "edited" }));
  await assertFails(updateDoc(doc(staff("finance"), "notes/pub1"), { title: "finance edit" }));
  await assertSucceeds(deleteDoc(doc(staff("moderation"), "notes/pub1/comments/c1")));
  await assertSucceeds(setDoc(doc(staff("content"), "notes/new1"), { slug: "n", title: "x", status: "draft", authorUid: "staff" }));
  await assertFails(setDoc(doc(staff("support"), "notes/new2"), { slug: "n", title: "x", status: "draft", authorUid: "staff" }));
  await assertSucceeds(setDoc(doc(staff("product"), "settings/site"), { email: "y" }));
  await assertFails(setDoc(doc(staff("support"), "settings/site"), { email: "y" }));
  await assertSucceeds(setDoc(doc(staff("growth"), "adCreatives/c2"), { title: "y" }));
  await assertFails(setDoc(doc(staff("finance"), "adCreatives/c3"), { title: "y" }));
  await assertSucceeds(updateDoc(doc(staff("support"), "leads/l1"), { status: "read" }));
  await assertFails(updateDoc(doc(staff("moderation"), "leads/l1"), { status: "read" }));
  await assertSucceeds(updateDoc(doc(staff("moderation"), "badgeRequests/alice"), { status: "approved" }));
  await assertFails(updateDoc(doc(staff("growth"), "badgeRequests/alice"), { status: "approved" }));
  // Members' profiles: customer care and trust & safety can suspend and reinstate, nothing else; finance and super admins can change tiers.
  await assertSucceeds(updateDoc(doc(staff("support"), "users/alice"), { suspended: true }));
  await assertSucceeds(updateDoc(doc(staff("moderation"), "users/alice"), { suspended: false }));
  await assertFails(updateDoc(doc(staff("support"), "users/alice"), { accountTier: "enterprise" }));
  await assertFails(updateDoc(doc(staff("moderation"), "users/alice"), { suspended: true, role: "staff" }));
  await assertFails(updateDoc(doc(staff("content"), "users/alice"), { suspended: true }));
  await assertSucceeds(updateDoc(doc(staff("finance"), "users/alice"), { accountTier: "pro" }));
  await assertSucceeds(updateDoc(doc(superAdmin(), "users/alice"), { accountTier: "business" }));
  await assertSucceeds(setDoc(doc(staff("support"), "suspensions/pub"), { reason: "x", appealStatus: "none" }));
  await assertFails(setDoc(doc(staff("finance"), "suspensions/pub2"), { reason: "x", appealStatus: "none" }));
  // The money ledger is server-only: not even a super admin or finance reads it from a browser (payroll lines must not leak).
  for (const who of [superAdmin(), staff("finance"), staff("product"), legacyAdmin()]) {
    await assertFails(getDoc(doc(who, "financeEntries/e1")));
    await assertFails(setDoc(doc(who, "financeEntries/e2"), { kind: "expense" }));
    await assertFails(getDoc(doc(who, "financeLog/l1")));
    // Nana AI's chats hold visitors' names and emails; the knowledge base and the daily counter are written by the server too.
    for (const c of ["nanaChats", "kbArticles", "nanaUsage", "nanaAccounts", "nanaSpend", "nanaBank", "creditTopups", "academies", "certificates", "aiConnections", "grants", "financeDues", "granolaConnections", "granolaStates", "integrationClients", "platformSettings", "pricingLog", "storeReviews", "recommendations"]) {
      await assertFails(getDoc(doc(who, `${c}/x1`)));
      await assertFails(setDoc(doc(who, `${c}/x2`), { a: 1 }));
    }
    await assertFails(setDoc(doc(who, "financeLog/l2"), { at: "x" }));
  }
  // Nobody gives themselves staff access from the browser.
  await assertFails(setDoc(doc(as("alice"), "adminAccessLog/x"), { at: "x" }));
});

test("online visibility and list privacy: your own switches only, true or false", async () => {
  await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), { showOnline: false, showLists: false }));
  await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), { showOnline: true }));
  await assertFails(updateDoc(doc(as("alice"), "users/alice"), { showOnline: "no" }));
  await assertFails(updateDoc(doc(as("pub"), "users/alice"), { showOnline: false })); // not someone else's
});

test("presence: write only your own heartbeat, nobody reads it from the client", async () => {
  await assertSucceeds(setDoc(doc(as("alice"), "presence/alice"), { lastSeen: serverTimestamp() }));
  await assertFails(setDoc(doc(as("alice"), "presence/pub"), { lastSeen: serverTimestamp() })); // not as someone else
  await assertFails(setDoc(doc(as("alice"), "presence/alice"), { lastSeen: new Date("2020-01-01") })); // the clock is the server's
  await assertFails(setDoc(doc(as("alice"), "presence/alice"), { lastSeen: serverTimestamp(), extra: 1 }));
  await assertFails(getDoc(doc(as("alice"), "presence/alice")));
  await assertFails(getDoc(doc(anon(), "presence/alice")));
  await assertSucceeds(deleteDoc(doc(as("alice"), "presence/alice"))); // switching online visibility off removes it
  await assertFails(deleteDoc(doc(as("pub"), "presence/alice")));
});

test("follows made in @na-notesapp's name can't be made or removed from a client", async () => {
  await assertFails(setDoc(doc(as("alice"), "follows/na-notesapp_pub"), { followerUid: "na-notesapp", username: "pub", followedAt: "x", mandatory: false }));
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), "follows/na-notesapp_pub"), { followerUid: "na-notesapp", username: "pub", followedAt: "x", mandatory: false }));
  await assertFails(deleteDoc(doc(as("alice"), "follows/na-notesapp_pub")));
});

test("follow records: you can read your own, nobody can list someone else's or a journal's followers", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const adb = ctx.firestore();
    await setDoc(doc(adb, "follows/alice_pub"), { followerUid: "alice", username: "pub", followedAt: "x", mandatory: false });
    await setDoc(doc(adb, "follows/pub_alice"), { followerUid: "pub", username: "alice", followedAt: "x", mandatory: false });
  });
  const a = as("alice");
  await assertSucceeds(getDoc(doc(a, "follows/alice_pub")));
  await assertSucceeds(getDocs(query(collection(a, "follows"), where("followerUid", "==", "alice"))));
  await assertFails(getDoc(doc(a, "follows/pub_alice")));
  await assertFails(getDocs(query(collection(a, "follows"), where("username", "==", "pub"))));
  await assertFails(getDocs(query(collection(a, "follows"), where("followerUid", "==", "pub"))));
  await assertFails(getDocs(query(collection(anon(), "follows"), where("followerUid", "==", "alice"))));
});

test("payroll, staff library and message hub collections are server-only", async () => {
  for (const path of ["payrollStaff/x", "payrollRuns/2026-10", "payrollSecrets/x", "staffDocs/x", "hubMessages/x", "convMutes/a_b"]) {
    await assertFails(getDoc(doc(as("alice", { admin: true }), path)));
    await assertFails(setDoc(doc(as("alice", { admin: true }), path), { a: 1 }));
    await assertFails(getDoc(doc(anon(), path)));
  }
});

test("a child profile can't make itself public: no profile edits, username or follows", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users/kid_abc"), { uid: "kid_abc", displayName: "Ada-Star", kid: true, teen: true });
  });
  const kid = env.authenticatedContext("kid_abc", { kid: true }).firestore();
  await assertFails(updateDoc(doc(kid, "users/kid_abc"), { bio: "hi" }));
  await assertFails(setDoc(doc(kid, "usernames/adastar"), { uid: "kid_abc" }));
  await assertFails(setDoc(doc(kid, "follows/kid_abc_pub"), { followerUid: "kid_abc", username: "pub", followedAt: "x" }));
  for (const path of ["kidProfiles/abc", "kidPlay/kid_abc_2026-10-23", "kidReports/x"]) await assertFails(getDoc(doc(kid, path)));
});

test("team time collections are server-only, even for super admins", async () => {
  for (const path of ["timeTimers/alice", "timeEntries/x", "timeSheets/alice_2026-10-12", "timeLeave/x", "timeProjects/x", "timeLeads/alice", "timeNudges/2026-10-12", "invoices/x", "invoiceCounters/2026", "invoicePays/x", "invoiceSettings/main"]) {
    await assertFails(getDoc(doc(as("alice", { admin: true }), path)));
    await assertFails(setDoc(doc(as("alice", { admin: true }), path), { a: 1 }));
    await assertFails(getDoc(doc(anon(), path)));
  }
});

test("calls: only the two people read it; caller writes the offer, callee answers; nobody else", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "calls/c1"), { callerUid: "alice", calleeUid: "pub", kind: "audio", status: "ringing", cid: "alice_pub", createdAt: "x" });
  });
  const a = as("alice"), p = as("pub"), x = as("stranger");
  await assertSucceeds(getDoc(doc(a, "calls/c1")));
  await assertSucceeds(getDocs(query(collection(p, "calls"), where("calleeUid", "==", "pub"), where("status", "==", "ringing"))));
  await assertFails(getDoc(doc(x, "calls/c1")));
  await assertFails(setDoc(doc(a, "calls/c2"), { callerUid: "alice", calleeUid: "pub", status: "ringing" })); // only the server starts calls
  await assertSucceeds(updateDoc(doc(a, "calls/c1"), { offer: { type: "offer", sdp: "v=0" } }));
  await assertFails(updateDoc(doc(a, "calls/c1"), { status: "ended" })); // ending goes through the server
  await assertFails(updateDoc(doc(p, "calls/c1"), { offer: { type: "offer", sdp: "x" } }));
  await assertFails(updateDoc(doc(x, "calls/c1"), { answer: { type: "answer", sdp: "x" }, status: "accepted", acceptedAt: "t" }));
  await assertSucceeds(addDoc(collection(a, "calls/c1/callerCandidates"), { candidate: "c" }));
  await assertFails(addDoc(collection(p, "calls/c1/callerCandidates"), { candidate: "c" }));
  await assertSucceeds(updateDoc(doc(p, "calls/c1"), { answer: { type: "answer", sdp: "v=0" }, status: "accepted", acceptedAt: "2026-10-13T10:00:00Z" }));
  await assertSucceeds(addDoc(collection(p, "calls/c1/calleeCandidates"), { candidate: "c" }));
  await assertFails(getDocs(collection(x, "calls/c1/calleeCandidates")));
  await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), "calls/c1"), { status: "ended" }));
  await assertFails(addDoc(collection(a, "calls/c1/callerCandidates"), { candidate: "late" })); // nothing after it ends
});

test("group calls: members read the call; a connection is written by the newcomer and answered by the other; nobody else", async () => {
  const seen = { name: "x", avatar: "", at: "2026-10-19T10:00:00Z", seen: "2026-10-19T10:00:00Z" };
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, "groupCalls/g1"), { cid: "g_1", kind: "audio", title: "Choir", startedBy: "alice", memberUids: ["alice", "pub", "bob"], joined: { alice: seen, pub: seen }, status: "live", createdAt: "2026-10-19T10:00:00Z" });
  });
  const a = as("alice"), p = as("pub"), b = as("bob"), x = as("stranger");
  await assertSucceeds(getDoc(doc(b, "groupCalls/g1"))); // a member not yet in it (to see Join)
  await assertSucceeds(getDocs(query(collection(b, "groupCalls"), where("memberUids", "array-contains", "bob"), where("status", "==", "live"))));
  await assertFails(getDoc(doc(x, "groupCalls/g1")));
  await assertFails(updateDoc(doc(a, "groupCalls/g1"), { status: "ended" })); // the server starts, joins and ends calls
  const offer = { type: "offer", sdp: "v=0" };
  await assertSucceeds(setDoc(doc(p, "groupCalls/g1/links/l1"), { from: "pub", to: "alice", at: "t", offer }));
  await assertFails(setDoc(doc(b, "groupCalls/g1/links/l2"), { from: "bob", to: "alice", at: "t", offer })); // bob hasn't joined
  await assertFails(setDoc(doc(p, "groupCalls/g1/links/l3"), { from: "alice", to: "pub", at: "t", offer })); // only as yourself
  await assertFails(setDoc(doc(p, "groupCalls/g1/links/l4"), { from: "pub", to: "bob", at: "t", offer })); // only to someone in the call
  await assertFails(setDoc(doc(p, "groupCalls/g1/links/l5"), { from: "pub", to: "alice", at: "t", offer, answer: offer }));
  await assertSucceeds(getDoc(doc(a, "groupCalls/g1/links/l1")));
  await assertFails(getDoc(doc(b, "groupCalls/g1/links/l1"))); // a member, but not on this connection
  await assertFails(updateDoc(doc(p, "groupCalls/g1/links/l1"), { answer: { type: "answer", sdp: "x" } })); // the offerer can't answer
  await assertSucceeds(updateDoc(doc(a, "groupCalls/g1/links/l1"), { answer: { type: "answer", sdp: "v=0" } }));
  await assertSucceeds(addDoc(collection(p, "groupCalls/g1/links/l1/fromCandidates"), { candidate: "c" }));
  await assertFails(addDoc(collection(a, "groupCalls/g1/links/l1/fromCandidates"), { candidate: "c" }));
  await assertSucceeds(addDoc(collection(a, "groupCalls/g1/links/l1/toCandidates"), { candidate: "c" }));
  await assertSucceeds(getDocs(collection(p, "groupCalls/g1/links/l1/toCandidates")));
  await assertFails(getDocs(collection(b, "groupCalls/g1/links/l1/toCandidates")));
  await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), "groupCalls/g1"), { status: "ended" }));
  await assertFails(addDoc(collection(p, "groupCalls/g1/links/l1/fromCandidates"), { candidate: "late" })); // nothing after it ends
});

test("audio rooms: people in the room read it; a connection is written by its two people only, with a stage or listen kind", async () => {
  const seen = { name: "x", avatar: "", at: "2026-10-22T10:00:00Z", seen: "2026-10-22T10:00:00Z" };
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "communityRooms/r1"), { cid: "grace", communityName: "Grace", title: "Q&A", hostUid: "host", hostName: "H", speakers: [], hands: {}, joined: { host: seen, lis: seen }, status: "live", mode: "p2p", createdAt: seen.at });
  });
  const h = as("host"), l = as("lis"), x = as("stranger");
  await assertSucceeds(getDoc(doc(l, "communityRooms/r1")));
  await assertFails(getDoc(doc(x, "communityRooms/r1")));
  await assertFails(updateDoc(doc(h, "communityRooms/r1"), { speakers: ["lis"] })); // the server decides who speaks
  const offer = { type: "offer", sdp: "v=0" };
  await assertSucceeds(setDoc(doc(h, "communityRooms/r1/links/k1"), { from: "host", to: "lis", at: "t", kind: "listen", offer }));
  await assertFails(setDoc(doc(h, "communityRooms/r1/links/k2"), { from: "host", to: "lis", at: "t", kind: "video", offer }));
  await assertFails(setDoc(doc(h, "communityRooms/r1/links/k3"), { from: "host", to: "stranger", at: "t", kind: "listen", offer }));
  await assertFails(setDoc(doc(x, "communityRooms/r1/links/k4"), { from: "stranger", to: "host", at: "t", kind: "stage", offer }));
  await assertFails(getDoc(doc(x, "communityRooms/r1/links/k1")));
  await assertFails(updateDoc(doc(h, "communityRooms/r1/links/k1"), { answer: offer })); // the offerer can't answer
  await assertSucceeds(updateDoc(doc(l, "communityRooms/r1/links/k1"), { answer: { type: "answer", sdp: "v=0" } }));
  await assertSucceeds(addDoc(collection(h, "communityRooms/r1/links/k1/fromCandidates"), { candidate: "c" }));
  await assertFails(addDoc(collection(l, "communityRooms/r1/links/k1/fromCandidates"), { candidate: "c" }));
  await assertSucceeds(addDoc(collection(l, "communityRooms/r1/links/k1/toCandidates"), { candidate: "c" }));
  // The room's chat: everyone in it reads and writes, as themselves (their own name and picture from the room), nobody edits or deletes.
  const msg = (from, extra = {}) => ({ from, name: "x", avatar: "", text: "Amen", at: "2026-10-22T10:01:00Z", ...extra });
  await assertSucceeds(addDoc(collection(l, "communityRooms/r1/chat"), msg("lis")));
  await assertSucceeds(getDocs(collection(h, "communityRooms/r1/chat")));
  await assertFails(getDocs(collection(x, "communityRooms/r1/chat")));
  await assertFails(addDoc(collection(x, "communityRooms/r1/chat"), msg("stranger")));
  await assertFails(addDoc(collection(l, "communityRooms/r1/chat"), msg("host"))); // not as someone else
  await assertFails(addDoc(collection(l, "communityRooms/r1/chat"), msg("lis", { name: "Pastor" }))); // not under another name
  await assertFails(addDoc(collection(l, "communityRooms/r1/chat"), msg("lis", { text: "" })));
  await assertFails(addDoc(collection(l, "communityRooms/r1/chat"), msg("lis", { text: "a".repeat(501) })));
  await assertFails(addDoc(collection(l, "communityRooms/r1/chat"), msg("lis", { pinned: true })));
  await assertFails(setDoc(doc(l, "communityRooms/r1/chat/m1"), msg("lis")).then(() => updateDoc(doc(l, "communityRooms/r1/chat/m1"), { text: "edited" })));
  await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), "communityRooms/r1"), { status: "ended" }));
  await assertFails(addDoc(collection(h, "communityRooms/r1/links/k1/fromCandidates"), { candidate: "late" }));
  await assertFails(addDoc(collection(l, "communityRooms/r1/chat"), msg("lis"))); // the room is over
});

test("wallet: a member reads only their own balance and statement; nobody writes from a browser", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, "wallets/alice"), { creditKobo: 100000, bonusLots: [] });
    await setDoc(doc(f, "walletTx/t1"), { uid: "alice", type: "topup", creditKobo: 100000, bonusKobo: 0, label: "Top-up", at: "2026-10-14T00:00:00Z" });
  });
  const a = as("alice"), x = as("stranger");
  await assertSucceeds(getDoc(doc(a, "wallets/alice")));
  await assertFails(getDoc(doc(x, "wallets/alice")));
  await assertFails(setDoc(doc(a, "wallets/alice"), { creditKobo: 99999999, bonusLots: [] }));
  await assertFails(updateDoc(doc(a, "wallets/alice"), { creditKobo: 99999999 }));
  await assertSucceeds(getDocs(query(collection(a, "walletTx"), where("uid", "==", "alice"))));
  await assertFails(getDocs(query(collection(x, "walletTx"), where("uid", "==", "alice"))));
  await assertFails(setDoc(doc(a, "walletTx/t2"), { uid: "alice", type: "topup", creditKobo: 5, bonusKobo: 0, label: "x", at: "x" }));
  await assertFails(getDoc(doc(a, "groupCreates/alice")));
});

test("Notes Life: the player, statement and bonus cap are server-only; saves and restore points are the player's own", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "lifePlayers/alice"), { naira: 100000 });
    await setDoc(doc(db, "lifeTx/t1"), { uid: "alice", n: 1 });
    await setDoc(doc(db, "lifeBonus/2026-10"), { kobo: 50000 });
  });
  await assertSucceeds(getDoc(doc(as("alice"), "lifePlayers/alice")));
  await assertFails(getDoc(doc(as("pub"), "lifePlayers/alice")));
  await assertFails(setDoc(doc(as("alice"), "lifePlayers/alice"), { naira: 9e12 }));
  await assertSucceeds(getDocs(query(collection(as("alice"), "lifeTx"), where("uid", "==", "alice"))));
  await assertFails(getDocs(query(collection(as("pub"), "lifeTx"), where("uid", "==", "alice"))));
  await assertFails(getDoc(doc(as("alice"), "lifeBonus/2026-10")));
  await assertFails(setDoc(doc(as("alice"), "lifeBonus/2026-10"), { kobo: 0 }));
  const save = { state: "{}", v: 1, savedAt: Date.now() };
  await assertSucceeds(setDoc(doc(as("alice"), "lifeSaves/alice"), save));
  await assertFails(setDoc(doc(as("alice"), "lifeSaves/alice"), { ...save, naira: 1 }));
  await assertFails(setDoc(doc(as("pub"), "lifeSaves/alice"), save));
  await assertFails(getDoc(doc(as("pub"), "lifeSaves/alice")));
  await assertSucceeds(setDoc(doc(as("alice"), "lifeSavePoints/alice_h7"), { uid: "alice", ...save, slot: "h7" }));
  await assertFails(setDoc(doc(as("alice"), "lifeSavePoints/pub_h7"), { uid: "alice", ...save, slot: "h7" }));
  await assertFails(setDoc(doc(as("alice"), "lifeSavePoints/alice_x1"), { uid: "alice", ...save, slot: "x1" }));
  await assertSucceeds(getDocs(query(collection(as("alice"), "lifeSavePoints"), where("uid", "==", "alice"))));
  await assertFails(deleteDoc(doc(as("alice"), "lifeSavePoints/alice_h7")));
});

test("Notes Life presence: you write only your own place, outfit and time; signed-in players can read it", async () => {
  const pres = { place: "chef", outfit: "#f59e0b", at: Date.now() };
  await assertSucceeds(setDoc(doc(as("alice"), "lifePresence/alice"), pres));
  await assertFails(setDoc(doc(as("alice"), "lifePresence/pub"), pres));
  await assertFails(setDoc(doc(as("alice"), "lifePresence/alice"), { ...pres, username: "pub" }));
  await assertFails(setDoc(doc(as("alice"), "lifePresence/alice"), { ...pres, place: "moon" }));
  await assertSucceeds(getDoc(doc(as("pub"), "lifePresence/alice")));
  await assertFails(getDoc(doc(anon(), "lifePresence/alice")));
  await assertFails(deleteDoc(doc(as("pub"), "lifePresence/alice")));
  await assertSucceeds(deleteDoc(doc(as("alice"), "lifePresence/alice")));
});

test("Messages: typing is written only by yourself in your own conversations; chat pins are yours to read and only the server writes them", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "conversations/alice_pub"), { participants: ["alice", "pub"] });
    await setDoc(doc(db, "chatPins/alice"), { uid: "alice", list: ["alice_pub"] });
  });
  await assertSucceeds(setDoc(doc(as("alice"), "conversations/alice_pub/typing/alice"), { at: Date.now() }));
  await assertFails(setDoc(doc(as("alice"), "conversations/alice_pub/typing/pub"), { at: Date.now() }));
  await assertFails(setDoc(doc(as("alice"), "conversations/alice_pub/typing/alice"), { at: Date.now(), text: "secret" }));
  await assertFails(setDoc(doc(as("bob"), "conversations/alice_pub/typing/bob"), { at: Date.now() }));
  await assertSucceeds(getDocs(collection(as("pub"), "conversations/alice_pub/typing")));
  await assertFails(getDocs(collection(as("bob"), "conversations/alice_pub/typing")));
  await assertSucceeds(deleteDoc(doc(as("alice"), "conversations/alice_pub/typing/alice")));
  await assertSucceeds(getDoc(doc(as("alice"), "chatPins/alice")));
  await assertFails(getDoc(doc(as("pub"), "chatPins/alice")));
  await assertFails(setDoc(doc(as("alice"), "chatPins/alice"), { list: [] }));
});

test("notifications and comments: only the server creates them; members read and mark their own bells, delete their own comments", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "notes/pub1"), { slug: "p", title: "x", status: "published", authorUid: "pub" });
    await setDoc(doc(db, "notes/pub1/comments/c1"), { authorUid: "alice", content: "x", likeCount: 0 });
    await setDoc(doc(db, "notifications/n1"), { recipientUid: "alice", type: "like", message: "m", read: false, createdAt: "x" });
  });
  // nobody, not even the person it would be for, can create a bell or a comment from a browser
  const fake = { recipientUid: "pub", type: "like", message: "Fake", read: false, createdAt: "x" };
  await assertFails(setDoc(doc(as("alice"), "notifications/fake1"), fake));
  await assertFails(setDoc(doc(as("pub"), "notifications/fake2"), fake));
  await assertFails(setDoc(doc(as("alice"), "notes/pub1/comments/c2"), { authorUid: "alice", authorDisplayName: "Emmanuel Adams", content: "x", likeCount: 0 }));
  // reading and marking your own bell still work; someone else's don't
  await assertSucceeds(getDoc(doc(as("alice"), "notifications/n1")));
  await assertFails(getDoc(doc(as("bob"), "notifications/n1")));
  await assertSucceeds(updateDoc(doc(as("alice"), "notifications/n1"), { read: true }));
  await assertFails(updateDoc(doc(as("alice"), "notifications/n1"), { message: "changed" }));
  // comments stay public to read; their author (or moderation) can delete
  await assertSucceeds(getDoc(doc(as("bob"), "notes/pub1/comments/c1")));
  await assertFails(deleteDoc(doc(as("bob"), "notes/pub1/comments/c1")));
  await assertSucceeds(deleteDoc(doc(as("alice"), "notes/pub1/comments/c1")));
});

test("sites: a member's site content is public to read; only the server writes it", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "sites/pub"), { uid: "pub", kit: "food", blocks: {}, order: [] });
  });
  await assertSucceeds(getDoc(doc(anon(), "sites/pub")));
  await assertSucceeds(getDoc(doc(as("bob"), "sites/pub")));
  await assertFails(setDoc(doc(as("pub"), "sites/pub"), { uid: "pub", kit: "school" })); // not even the owner: plans are checked on the server
  await assertFails(updateDoc(doc(as("pub"), "sites/pub"), { kit: "school" }));
  await assertFails(setDoc(doc(as("alice"), "sites/alice"), { uid: "alice" }));
});

test("free trials: a member can't give themselves a trial, a trial history or a payment date", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users/tri"), { uid: "tri", username: "tri", displayName: "Tri", role: "publisher", accountTier: "basic", suspended: false });
  });
  const me = env.authenticatedContext("tri").firestore();
  await assertFails(updateDoc(doc(me, "users/tri"), { trials: [] }));
  await assertFails(updateDoc(doc(me, "users/tri"), { lastPaidAt: "2026-10-21T00:00:00Z" }));
  await assertFails(updateDoc(doc(me, "users/tri"), { trialTier: "business", trialUntil: "2099-01-01T00:00:00Z", accountTier: "business" }));
  await assertSucceeds(updateDoc(doc(me, "users/tri"), { bio: "still fine" }));
});

test("inventory: SKUs, cost prices and the stock history are private; only the server reads and writes them", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, "inventory/bag"), { ownerUid: "pub", sku: "TOTE", costKobo: 600000, lowAt: 3 });
    await setDoc(doc(f, "inventoryMoves/m1"), { ownerUid: "pub", itemId: "bag", delta: 5, after: 5, reason: "restock" });
  });
  const owner = as("pub");
  await assertFails(getDoc(doc(owner, "inventory/bag"))); // even the owner reads them through /api/inventory
  await assertFails(getDoc(doc(env.authenticatedContext("bob").firestore(), "inventory/bag")));
  await assertFails(setDoc(doc(owner, "inventory/bag"), { ownerUid: "pub", costKobo: 1 }));
  await assertFails(setDoc(doc(owner, "inventoryMoves/m2"), { ownerUid: "pub", itemId: "bag", delta: 100, after: 100, reason: "restock" }));
  await assertFails(getDoc(doc(owner, "inventoryMoves/m1")));
});

test("communities and events: read and written only through the server, which checks each person's role", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, "communities/grace"), { name: "Grace", ownerUid: "pub", memberCount: 1 });
    await setDoc(doc(f, "communityMembers/grace_pub"), { cid: "grace", uid: "pub", role: "owner", status: "active" });
    await setDoc(doc(f, "communityPosts/p1"), { cid: "grace", channel: "members", text: "members only" });
    await setDoc(doc(f, "events/e1"), { title: "Service", visibility: "members", cid: "grace" });
  });
  const owner = as("pub");
  for (const path of ["communities/grace", "communityMembers/grace_pub", "communityPosts/p1", "events/e1"]) {
    await assertFails(getDoc(doc(owner, path)));
    await assertFails(getDoc(doc(anon(), path)));
  }
  await assertFails(setDoc(doc(as("alice"), "communityMembers/grace_alice"), { cid: "grace", uid: "alice", role: "owner", status: "active" }));
  await assertFails(updateDoc(doc(owner, "communities/grace"), { memberCount: 9999 }));
  await assertFails(setDoc(doc(as("bob"), "eventRsvps/e1_bob"), { eventId: "e1", uid: "bob", status: "going" }));
});
