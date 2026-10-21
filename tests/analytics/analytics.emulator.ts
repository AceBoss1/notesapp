// Member analytics against the Firestore emulator (lib/analytics-server.ts, lib/visits-server.ts): visits counted into the owner's day
// (store items, courses, journals and profiles), the report's reads, what each plan sees, and organisations' teammates.
// Run: npm run test:analytics-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { AnalyticsError, accountsFor, gatherReport } from "../../lib/analytics-server";
import { countOwnerVisit, sourceFrom } from "../../lib/visits-server";
import { recordView } from "../../lib/store-stats-server";
import { recordCourseView } from "../../lib/courses-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const now = new Date();
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
const fails = async (p: Promise<unknown>, re: RegExp) => { await assert.rejects(p, (e: unknown) => e instanceof AnalyticsError && re.test(e.message)); };

(async () => {
  await db.doc("users/apex").set({ uid: "apex", username: "apexglitz", displayName: "Apex Glitz", role: "publisher", accountTier: "basic" });
  await db.doc("users/org").set({ uid: "org", username: "bigco", displayName: "Big Co", role: "publisher", accountTier: "business" });
  await db.doc("users/staff").set({ uid: "staff", username: "staff1", displayName: "Staff", role: "reader", accountTier: "standard" });
  await db.doc("orgMembers/org_staff").set({ orgUid: "org", memberUid: "staff", role: "writer", store: true });
  await db.doc("storeItems/bag").set({ ownerUid: "apex", title: "Tote bag", sellable: true, stock: 2, priceKobo: 1_000_000, kind: "physical" });
  await db.doc("courses/c1").set({ ownerUid: "apex", title: "Bag making", status: "published", tutorUids: [] });

  // Visits: a store item from WhatsApp, a course from search, the seller's own look ignored, the profile direct.
  assert.equal(sourceFrom({ ref: "web.whatsapp.com" }, "www.notesapp.name.ng"), "whatsapp");
  assert.equal(sourceFrom({ ref: "apexglitz.com.ng" }, "apexglitz.com.ng"), "inside", "moving around the member's own domain");
  assert.equal(await recordView(db, "bag", "buyer1", "whatsapp"), true);
  assert.equal(await recordView(db, "bag", "apex", "direct"), false, "the seller's own look isn't counted");
  assert.equal(await recordCourseView(db, "c1", "learner", now, "search"), true);
  await countOwnerVisit(db, "apex", "profile", "apexglitz", "direct");
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  const v = (await db.doc(`ownerViews/apex_${day}`).get()).data()!;
  assert.equal(v.count, 3);
  assert.deepEqual(v.pages, { "item:bag": 1, "course:c1": 1, "profile:apexglitz": 1 });
  assert.deepEqual(v.src, { whatsapp: 1, search: 1, direct: 1 });
  console.log("visits ok");

  // Money and orders
  await db.doc("ledger/o1").set({ publisherUid: "apex", kind: "order", grossKobo: 1_000_000, netKobo: 940_000, status: "held", createdAt: iso(1) });
  await db.doc("ledger/old").set({ publisherUid: "apex", kind: "order", grossKobo: 1, netKobo: 1, status: "paid_out", createdAt: iso(400) });
  await db.doc("storeOrders/o1").set({ sellerUid: "apex", buyerUid: "ada", buyerEmail: "ada@x.ng", itemId: "bag", itemTitle: "Tote bag", quantity: 1, unitKobo: 1_000_000, deliveryKobo: 150_000, amountKobo: 1_150_000, status: "paid", paidAt: iso(1), address: { fullName: "Ada Obi", phone: "0803", city: "Enugu", state: "Enugu" } });
  await db.doc("payments/o1").set({ publisherUid: "apex", kind: "store", status: "paid", createdAt: iso(1) });
  await db.doc("payments/p2").set({ publisherUid: "apex", kind: "boost", status: "paid", createdAt: iso(1) }); // not a checkout
  await db.doc("bookings/b1").set({ publisherUid: "apex", status: "confirmed", amountKobo: 500_000, createdAt: iso(2), startsAt: iso(-2) });
  await db.doc("boosts/bo1").set({ publisherUid: "apex", title: "Tote bag", amountKobo: 300_000, refundedKobo: 0, impressionsDelivered: 900, clicks: 12, digestClicks: 3, status: "active" });

  // Free Basic: 7 days whatever is asked, no customers, no visit detail.
  const basic = await gatherReport(db, "apex", "apex", 90, now);
  assert.equal(basic.tier, "basic"); assert.equal(basic.report.days, 7);
  assert.equal(basic.report.totals.earnedKobo, 940_000); assert.equal(basic.report.totals.ordersPaid, 1);
  assert.equal(basic.report.totals.checkouts, 1, "only store and download checkouts"); assert.equal(basic.report.totals.bookings, 1);
  assert.equal(basic.report.totals.visits, 3); assert.deepEqual(basic.report.lowStock.map((i) => i.itemId), ["bag"]);
  assert.equal(basic.report.items[0].views, 1);
  assert.deepEqual(basic.report.promos.map((p) => [p.label, p.impressions, p.clicks]), [["Tote bag", 900, 15]]);
  assert.equal(basic.report.customers, null); assert.equal(basic.report.pages, null);
  // Business: 90 days, customers, visits by page with names
  await db.doc("users/apex").update({ accountTier: "business" });
  const biz = await gatherReport(db, "apex", "apex", 90, now);
  assert.equal(biz.report.days, 90);
  assert.equal(biz.report.customers![0].name, "Ada Obi");
  assert.deepEqual(Object.fromEntries(biz.report.pages!.map((p) => [p.key, p.label])), { "item:bag": "Tote bag", "course:c1": "Bag making", "profile:apexglitz": "Your profile and site home" });
  assert.deepEqual(biz.report.sources!.map((s) => s.source).sort(), ["direct", "search", "whatsapp"]);
  console.log("report ok");

  // An organisation's teammate with store access sees its analytics; others don't.
  assert.deepEqual((await accountsFor(db, "staff")).map((a) => a.uid), ["staff", "org"]);
  assert.equal((await gatherReport(db, "staff", "org", 30, now)).tier, "business");
  await fails(gatherReport(db, "staff", "apex", 7, now), /can't see/);
  await db.doc("orgMembers/org_staff").update({ store: false });
  await fails(gatherReport(db, "staff", "org", 7, now), /can't see/);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
