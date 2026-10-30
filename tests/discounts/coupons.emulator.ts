// Coupons end to end on the Firestore and Auth emulators (lib/discounts-server.ts, step 3 of docs/REFERRALS.md): a publisher shows
// a code in their shop, a buyer saves it and checkout suggests the best one; an affiliate's own code (TOLU-AMAKA10) gives the same
// discount and names the affiliate. Run: npm run test:coupons-server → "COUPONS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { DiscountError } from "../../lib/discounts";
import { affiliateCodes, applyCode, bestCoupon, couponCard, expiringCoupons, myCoupons, remindExpiringCoupons, removeCoupon, saveCode, saveCoupon, setCodeActive, shopCoupons } from "../../lib/discounts-server";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof DiscountError && re.test(e.message));

async function member(uid: string, username: string, verified = true) {
  await getAuth().createUser({ uid, email: `${uid}@x.ng`, emailVerified: verified }).catch(() => {});
  await db.doc(`usernames/${username}`).set({ uid });
  await db.doc(`users/${uid}`).set({ uid, username, displayName: username, createdAt: new Date().toISOString() });
}

(async () => {
  await member("shop", "stylebyamaka");
  await member("ada", "ada");
  await member("tolu", "tolu");
  await member("ghost", "ghost", false);

  // the publisher's codes: one shown in the shop, one only for a dress, one hidden, one affiliates may share
  await saveCode(db, "shop", "shop", { create: true, code: "AMAKA10", kind: "percent", percent: 10, targets: ["store", "digital"], showInShop: true, allowAffiliates: true });
  await saveCode(db, "shop", "shop", { create: true, code: "DRESS2K", kind: "amount", amountKobo: 200_000, targets: ["store"], itemIds: ["dress"], showInShop: true });
  await saveCode(db, "shop", "shop", { create: true, code: "VIPONLY", kind: "percent", percent: 30, targets: ["store"] });

  // in the shop: shown codes only; on a product page, only codes for that product (or for everything)
  assert.deepEqual((await shopCoupons(db, "stylebyamaka")).map((c) => c.code).sort(), ["AMAKA10", "DRESS2K"]);
  assert.deepEqual((await shopCoupons(db, "@StyleByAmaka", "bag")).map((c) => c.code), ["AMAKA10"]);
  const shown = (await shopCoupons(db, "stylebyamaka"))[0];
  assert.ok(!("uses" in shown) && !("revenueKobo" in shown), "never the counts");
  // a card is any open code its owner shares, shown in the shop or not; a paused one has none
  assert.equal((await couponCard(db, "stylebyamaka", "viponly"))?.label, "30% off");
  await setCodeActive(db, "shop", "VIPONLY", false);
  assert.equal(await couponCard(db, "stylebyamaka", "VIPONLY"), null);
  assert.equal(await couponCard(db, "nobody", "AMAKA10"), null);

  // a buyer's wallet: save, see, Nana's pick at checkout (saved and shown coupons), remove
  await rejects(saveCoupon(db, "shop", "stylebyamaka", "AMAKA10"), /your own coupon/);
  await rejects(saveCoupon(db, "ada", "stylebyamaka", "VIPONLY"), /isn't available/);
  await saveCoupon(db, "ada", "stylebyamaka", "AMAKA10");
  const dress = await saveCoupon(db, "ada", "stylebyamaka", "dress2k");
  assert.deepEqual((await myCoupons(db, "ada")).map((c) => c.code).sort(), ["AMAKA10", "DRESS2K"]);
  // a ₦35,000 dress: ₦3,500 (10%) beats ₦2,000; a ₦15,000 dress: ₦2,000 beats ₦1,500; a bag: only AMAKA10 works
  assert.equal((await bestCoupon(db, "ada", "shop", { target: "store", itemId: "dress", subtotalKobo: 3_500_000 }))?.code, "AMAKA10");
  assert.equal((await bestCoupon(db, "ada", "shop", { target: "store", itemId: "dress", subtotalKobo: 1_500_000 }))?.code, "DRESS2K");
  assert.deepEqual(await bestCoupon(db, "ada", "shop", { target: "store", itemId: "bag", subtotalKobo: 1_000_000 }), { code: "AMAKA10", discountKobo: 100_000, label: "10% off", source: "saved" });
  // a buyer who saved nothing still gets the store's shown coupons; a hidden code is never picked
  assert.deepEqual(await bestCoupon(db, "tolu", "shop", { target: "store", itemId: "dress", subtotalKobo: 1_500_000 }), { code: "DRESS2K", discountKobo: 200_000, label: "₦2,000 off", source: "shop" });
  assert.equal(await bestCoupon(db, "ada", "shop", { target: "course", subtotalKobo: 1_000_000 }), null, "none for courses");
  await rejects(removeCoupon(db, "tolu", dress.id), /isn't in your list/);
  await removeCoupon(db, "ada", dress.id);
  assert.equal((await myCoupons(db, "ada")).length, 1);
  // an ended coupon stays in the wallet, marked, and is never picked
  await setCodeActive(db, "shop", "AMAKA10", false);
  assert.equal((await myCoupons(db, "ada"))[0].open, false);
  assert.equal(await bestCoupon(db, "ada", "shop", { target: "store", itemId: "bag", subtotalKobo: 1_000_000 }), null);
  await setCodeActive(db, "shop", "AMAKA10", true);

  // an affiliate's own code: same discount, names the affiliate; only for codes the publisher lets affiliates share
  const viaTolu = await applyCode(db, "shop", "tolu-amaka10", "ada", { target: "store", itemId: "bag", subtotalKobo: 1_000_000 });
  assert.equal(viaTolu.discountKobo, 100_000);
  assert.deepEqual(viaTolu.affiliate, { uid: "tolu", username: "tolu" });
  assert.equal((await applyCode(db, "shop", "AMAKA10", "ada", { target: "store", itemId: "bag", subtotalKobo: 1_000_000 })).affiliate, undefined);
  await rejects(applyCode(db, "shop", "TOLU-DRESS2K", "ada", { target: "store", itemId: "dress", subtotalKobo: 1_000_000 }), /isn't valid here/);
  await rejects(applyCode(db, "shop", "GHOST-AMAKA10", "ada", { target: "store", subtotalKobo: 1_000_000 }), /isn't valid here/);
  await rejects(applyCode(db, "shop", "STYLEBYAMAKA-AMAKA10", "ada", { target: "store", subtotalKobo: 1_000_000 }), /isn't valid here/);
  // the marketplace lists the shareable codes per publisher
  assert.deepEqual(Object.fromEntries(Object.entries(await affiliateCodes(db, ["shop", "ada"])).map(([k, v]) => [k, v.map((c) => c.code)])), { shop: ["AMAKA10"] });

  // store A's coupon in store B, or at #NotesApp's checkout: refused, saying whose it is
  await member("b", "kemibakes");
  await saveCode(db, "b", "b", { create: true, code: "CAKE15", kind: "percent", percent: 15, targets: ["store"], showInShop: true });
  await rejects(applyCode(db, "shop", "cake15", "ada", { target: "store", subtotalKobo: 1_000_000 }), /another store\. Input a coupon from this store/);
  await rejects(applyCode(db, "b", "AMAKA10", "ada", { target: "store", subtotalKobo: 1_000_000 }), /another store\. Input a coupon from this store/);
  await rejects(applyCode(db, "notesapp", "AMAKA10", "ada", { target: "boost", subtotalKobo: 500_000 }), /from a store on #NotesApp/);
  await rejects(applyCode(db, "shop", "NOSUCHCODE", "ada", { target: "store", subtotalKobo: 1_000_000 }), /isn't valid here/);
  // and Nana never picks another store's coupon, saved or not
  await saveCoupon(db, "ada", "kemibakes", "CAKE15");
  assert.equal((await bestCoupon(db, "ada", "shop", { target: "store", itemId: "bag", subtotalKobo: 1_000_000 }))?.code, "AMAKA10");
  assert.equal((await bestCoupon(db, "ada", "b", { target: "store", subtotalKobo: 1_000_000 }))?.code, "CAKE15");
  // #NotesApp's offered codes are picked at its own checkouts
  await saveCode(db, "notesapp", "admin", { create: true, code: "BOOST20", kind: "percent", percent: 20, targets: ["boost"], showInShop: true });
  await saveCode(db, "notesapp", "admin", { create: true, code: "SECRET50", kind: "percent", percent: 50, targets: ["boost"] });
  assert.deepEqual(await bestCoupon(db, "ada", "notesapp", { target: "boost", subtotalKobo: 500_000 }), { code: "BOOST20", discountKobo: 100_000, label: "20% off", source: "shop" });

  // saved coupons ending within 3 days: one bell a day each, and the same list for the once-a-day prompt
  const now = new Date();
  const in2days = new Date(now.getTime() + 2 * 86_400_000).toISOString(), in10days = new Date(now.getTime() + 10 * 86_400_000).toISOString();
  await saveCode(db, "shop", "shop", { create: true, code: "LASTCALL", kind: "percent", percent: 20, targets: ["store"], showInShop: true, endsAt: in2days });
  await saveCode(db, "shop", "shop", { create: true, code: "LATER", kind: "percent", percent: 5, targets: ["store"], showInShop: true, endsAt: in10days });
  await saveCoupon(db, "ada", "stylebyamaka", "LASTCALL");
  await saveCoupon(db, "ada", "stylebyamaka", "LATER");
  await saveCoupon(db, "tolu", "stylebyamaka", "LASTCALL");
  const bells: { uid: string; message: string; linkHref?: string }[] = [];
  const bell = async (b: { uid?: string | null; message: string; linkHref?: string }) => { bells.push({ uid: String(b.uid), message: b.message, linkHref: b.linkHref }); };
  assert.equal(await remindExpiringCoupons(db, now, bell as never), 2, "ada and tolu, for LASTCALL only");
  assert.deepEqual(bells.map((b) => b.uid).sort(), ["ada", "tolu"]);
  assert.match(bells[0].message, /LASTCALL \(20% off\) at @stylebyamaka ends in 2 days/);
  assert.equal(bells[0].linkHref, "/profile/coupons");
  assert.equal(await remindExpiringCoupons(db, new Date(now.getTime() + 60_000), bell as never), 0, "once a day");
  assert.equal(await remindExpiringCoupons(db, new Date(now.getTime() + 86_400_000), bell as never), 2, "and again the next day");
  await setCodeActive(db, "shop", "LASTCALL", false);
  assert.equal(await remindExpiringCoupons(db, new Date(now.getTime() + 2 * 86_400_000 - 3_600_000), bell as never), 0, "not for a paused coupon");
  await setCodeActive(db, "shop", "LASTCALL", true);
  assert.deepEqual((await expiringCoupons(db, "ada", now)).map((c) => [c.code, c.endsIn]), [["LASTCALL", "ends in 2 days"]]);
  assert.deepEqual(await expiringCoupons(db, "shop", now), []);

  console.log("COUPONS SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
