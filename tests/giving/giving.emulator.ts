// Community giving and paid event tickets against the Firestore emulator (lib/giving-server.ts, lib/tickets-server.ts, lib/payments.ts):
// a gift settles with a receipt and a ledger entry net of the charges; a ticket purchase writes tickets, moves the sold count and holds
// the host's money less commission; check-in; sold out; a refund voids tickets; the payout run picks both up when due.
// payWith "wallet" only stands in for "the card payment was checked" (it skips asking Paystack), as in tests/discounts.
// Run: npm run test:giving-server → "GIVING SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as C from "../../lib/community-server";
import * as E from "../../lib/events-server";
import { communityGifts, giftCheckout, myGifts, setGiving } from "../../lib/giving-server";
import { checkIn, checkInStats, myTickets, setTicketTypes, ticketCheckout, voidTicketsFor } from "../../lib/tickets-server";
import { fulfillPayment, type PaymentRecord } from "../../lib/payments";
import { autoReleasePayouts } from "../../lib/payouts";
import { quoteGift } from "../../lib/giving";
import { showCode } from "../../lib/tickets";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) => { await assert.rejects(p, (e: unknown) => (e instanceof C.CommunityError || e instanceof E.EventError) && e.status === status && (!re || re.test(e.message)), `expected ${status} ${re ?? ""}`); };
const user = (uid: string, extra = {}) => db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid === "ada" ? "Ada Obi" : uid.toUpperCase(), role: "publisher", accountTier: "basic", ...extra });
const now = () => new Date().toISOString();

(async () => {
  await Promise.all([user("pastor"), user("ada"), user("bisi"), user("host", { accountTier: "pro" }), user("org", { accountKind: "organisation", org: { rcStatus: "verified" } })]);

  // ---- Giving ----
  const c = await C.createCommunity(db, "pastor", { name: "Grace Chapel" });
  await C.join(db, "ada", c.id, {});
  await fails(setGiving(db, "ada", c.id, { enabled: true }), 403);
  await fails(setGiving(db, "pastor", c.id, { enabled: true, funds: ["Tithe", "Offering"] }), 409, /bank account/);
  await db.doc("payoutAccounts/pastor").set({ recipientCode: "RCP_pastor", accountName: "GRACE CHAPEL" });
  assert.deepEqual(await setGiving(db, "pastor", c.id, { enabled: true, funds: ["Tithe", "Offering"] }), { enabled: true, funds: ["Tithe", "Offering"] });
  const v = await C.viewCommunity(db, c.id, "ada");
  assert.deepEqual(v.giving, { funds: ["Tithe", "Offering"], capKobo: 2_000_000, canGive: true }, "unverified: capped");
  assert.equal("givingSettings" in v, false, "members don't get the settings");
  assert.ok("givingSettings" in (await C.viewCommunity(db, c.id, "pastor")));

  // unverified community: each gift capped at ₦20,000
  await fails(giftCheckout(db, "ada", { cid: c.id, amountNaira: 25_000, fund: "Tithe" }, "card"), 400, /₦20,000/);
  await fails(giftCheckout(db, "pastor", { cid: c.id, amountNaira: 1_000, fund: "Tithe" }, "card"), 409, /run this community/);
  await fails(giftCheckout(db, "ada", { cid: c.id, amountNaira: 50 }, "card"), 400, /₦100/);

  // a ₦10,000 tithe by card, not covering the charges
  const g = await giftCheckout(db, "ada", { cid: c.id, amountNaira: 10_000, fund: "Tithe", note: "Thanksgiving", cover: false }, "card");
  const qq = quoteGift(1_000_000, { method: "card", cover: false });
  assert.equal(g.payKobo, 1_000_000); assert.equal(g.info.netKobo, qq.netKobo); assert.equal(g.ownerUid, "pastor");
  const gp: PaymentRecord = { reference: "GIVE1", kind: "giving", uid: "ada", email: "ada@x.ng", amountKobo: g.payKobo, status: "pending", publisherUid: g.ownerUid, publisherUsername: g.ownerUsername, commissionRate: 0, giving: g.info, payWith: "wallet", createdAt: now() };
  await db.doc("payments/GIVE1").set(gp);
  assert.equal((await fulfillPayment("GIVE1")).status, "paid");
  let led = (await db.doc("ledger/GIVE1").get()).data()!;
  assert.deepEqual([led.kind, led.publisherUid, led.grossKobo, led.commissionKobo, led.netKobo, led.cardChargeKobo, led.status], ["giving", "pastor", 1_000_000 - 25_000, 2_500, 1_000_000 - 27_500, 25_000, "held"]);
  assert.equal(led.grossKobo - led.commissionKobo, led.netKobo, "no commission beyond the band");
  assert.ok(new Date(led.releaseAfter).getTime() >= Date.now() + 23.9 * 3_600_000, "held a day");
  const receipt = (await db.doc("communityGifts/GIVE1").get()).data()!;
  assert.deepEqual([receipt.fund, receipt.giftKobo, receipt.paidKobo, receipt.netKobo, receipt.status, receipt.giverUid], ["Tithe", 1_000_000, 1_000_000, 972_500, "paid", "ada"]);

  // anonymous, covering the charges (the wallet's quote: just the band) → the whole gift arrives
  const g2 = await giftCheckout(db, "ada", { cid: c.id, amountNaira: 3_000, fund: "Offering", anonymous: true, cover: true }, "wallet");
  assert.equal(g2.payKobo, 301_000);
  await db.doc("payments/GIVE2").set({ ...gp, reference: "GIVE2", amountKobo: g2.payKobo, giving: g2.info } satisfies PaymentRecord);
  await fulfillPayment("GIVE2");
  led = (await db.doc("ledger/GIVE2").get()).data()!;
  assert.deepEqual([led.grossKobo, led.commissionKobo, led.netKobo, "cardChargeKobo" in led], [301_000, 1_000, 300_000, false]);
  assert.equal((await fulfillPayment("GIVE2")).status, "paid", "settling twice is harmless");

  // the giver's receipts; the admins' totals per fund, the anonymous name hidden
  assert.deepEqual((await myGifts(db, "ada")).map((x) => x.reference).sort(), ["GIVE1", "GIVE2"]);
  assert.equal("giverEmail" in (await myGifts(db, "ada"))[0], false);
  await fails(communityGifts(db, "ada", c.id), 403);
  const adm = await communityGifts(db, "pastor", c.id);
  assert.deepEqual(adm.totals, { count: 2, giftKobo: 1_300_000, netKobo: 1_272_500 });
  assert.deepEqual(adm.funds.map((f) => [f.fund, f.count, f.giftKobo]), [["Tithe", 1, 1_000_000], ["Offering", 1, 300_000]]);
  assert.equal(adm.gifts.find((x) => x.reference === "GIVE2")!.giverName, "Anonymous");
  assert.equal(adm.gifts.find((x) => x.reference === "GIVE1")!.giverName, "Ada Obi");
  assert.equal(JSON.stringify(adm).includes("ada@x.ng"), false, "no emails for admins");

  // a verified organisation's community: no cap; an invite-only community: members only
  await db.doc("payoutAccounts/org").set({ recipientCode: "RCP_org" });
  const big = await C.createCommunity(db, "org", { name: "Hope Foundation" });
  await setGiving(db, "org", big.id, { enabled: true });
  assert.equal((await giftCheckout(db, "bisi", { cid: big.id, amountNaira: 250_000 }, "card")).info.fund, "Donation", "verified: no cap; default fund");
  await C.updateSettings(db, "org", big.id, { joinMode: "invite" });
  await fails(giftCheckout(db, "bisi", { cid: big.id, amountNaira: 1_000 }, "card"), 403, /members/);

  // ---- Paid event tickets ----
  const ev = await E.createEvent(db, "host", { title: "Gospel concert", startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), place: "Eko Hotel", state: "Lagos" });
  const ev2 = await E.createEvent(db, "host", { title: "Another night", startsAt: new Date(Date.now() + 4 * 86_400_000).toISOString(), place: "Hall" });
  await fails(setTicketTypes(db, "ada", ev.id, [{ name: "Regular", priceNaira: 5000, quantity: 3 }]), 403);
  await fails(setTicketTypes(db, "host", ev.id, [{ name: "Regular", priceNaira: 5000, quantity: 3 }]), 409, /bank account/);
  await db.doc("payoutAccounts/host").set({ recipientCode: "RCP_host" });
  await setTicketTypes(db, "host", ev.id, [{ name: "Regular", priceNaira: 5000, quantity: 3 }, { name: "VIP", priceNaira: 20000, quantity: 1 }]);
  await setTicketTypes(db, "host", ev2.id, [{ name: "Regular", priceNaira: 2000, quantity: 10 }]);
  let shown = await E.getEvent(db, ev.id, "ada");
  assert.deepEqual(shown.tickets, [{ id: "regular", name: "Regular", priceKobo: 500_000, left: 3 }, { id: "vip", name: "VIP", priceKobo: 2_000_000, left: 1 }]);

  await fails(ticketCheckout(db, "ada", { eventId: ev.id, typeId: "regular", quantity: 4 }), 409, /Only 3/);
  await fails(ticketCheckout(db, "ada", { eventId: ev.id, typeId: "regular", quantity: 11 }), 400);
  await fails(ticketCheckout(db, "host", { eventId: ev.id, typeId: "regular", quantity: 1 }), 409, /host/);
  const tk = await ticketCheckout(db, "ada", { eventId: ev.id, typeId: "regular", quantity: 2 });
  assert.equal(tk.amountKobo, 1_000_000); assert.equal(tk.hostUid, "host");
  const tp: PaymentRecord = { reference: "TIX1", kind: "ticket", uid: "ada", email: "ada@x.ng", amountKobo: tk.amountKobo, status: "pending", publisherUid: tk.hostUid, publisherUsername: tk.hostUsername, commissionRate: tk.commissionRate, ticket: tk.info, payWith: "wallet", createdAt: now() };
  await db.doc("payments/TIX1").set(tp);
  assert.equal((await fulfillPayment("TIX1")).status, "paid");
  const mine = await myTickets(db, "ada", ev.id);
  assert.equal(mine.length, 2);
  assert.ok(mine.every((t) => t.status === "valid" && t.holderName === "Ada Obi" && t.typeName === "Regular" && /^[2-9A-HJKMNP-Z]{10}$/.test(t.code)));
  assert.notEqual(mine[0].code, mine[1].code);
  shown = await E.getEvent(db, ev.id, "host");
  assert.deepEqual(shown.tickets[0], { id: "regular", name: "Regular", priceKobo: 500_000, left: 1, quantity: 3, sold: 2 }, "the sold count moved");
  led = (await db.doc("ledger/TIX1").get()).data()!;
  const commission = Math.round(1_000_000 * tk.commissionRate);
  assert.ok(tk.commissionRate > 0);
  assert.deepEqual([led.kind, led.publisherUid, led.grossKobo, led.commissionKobo, led.netKobo, led.releaseAfter], ["ticket", "host", 1_000_000, commission, 1_000_000 - commission, tk.info.endsAt]);

  // check-in: valid → already checked in → not for this event → not a ticket
  await fails(checkIn(db, "ada", ev.id, mine[0].code), 403);
  const ok1 = await checkIn(db, "host", ev.id, showCode(mine[0].code).toLowerCase());
  assert.equal(ok1.state, "valid");
  assert.deepEqual(ok1.state === "valid" && [ok1.name, ok1.type], ["Ada Obi", "Regular"]);
  const again = await checkIn(db, "host", ev.id, `https://x/events/${ev.id}/checkin?code=${mine[0].code}`);
  assert.equal(again.state, "already");
  assert.equal(again.state === "already" && ok1.state === "valid" && again.at, ok1.at, "already checked in at the first time");
  assert.deepEqual(await checkIn(db, "host", ev2.id, mine[1].code), { state: "wrong_event", event: "Gospel concert" });
  assert.deepEqual(await checkIn(db, "host", ev.id, "ABCDE-FGHJK"), { state: "not_found" });
  assert.deepEqual(await checkIn(db, "host", ev.id, "nonsense"), { state: "not_found" });
  const st = await checkInStats(db, "host", ev.id);
  assert.deepEqual([st.sold, st.in], [2, 1]);

  // sold out: refused at checkout; and a payment that lands after the last one went is flagged for a refund, with no tickets
  const vip = await ticketCheckout(db, "bisi", { eventId: ev.id, typeId: "vip", quantity: 1 });
  const vipLate = await ticketCheckout(db, "ada", { eventId: ev.id, typeId: "vip", quantity: 1 }); // both started before either paid
  await db.doc("payments/TIX2").set({ ...tp, reference: "TIX2", uid: "bisi", amountKobo: vip.amountKobo, ticket: vip.info } satisfies PaymentRecord);
  await db.doc("payments/TIX3").set({ ...tp, reference: "TIX3", amountKobo: vipLate.amountKobo, ticket: vipLate.info } satisfies PaymentRecord);
  assert.equal((await fulfillPayment("TIX2")).status, "paid");
  await fails(ticketCheckout(db, "ada", { eventId: ev.id, typeId: "vip", quantity: 1 }), 409, /sold out/);
  assert.equal((await fulfillPayment("TIX3")).status, "paid_slot_conflict");
  assert.equal((await db.doc("ledger/TIX3").get()).exists, false);
  assert.equal((await myTickets(db, "ada", ev.id)).length, 2, "no ticket for the late payment");
  assert.equal((await E.getEvent(db, ev.id, "ada")).tickets[1].left, 0);

  // a type with sales can't be removed
  await fails(setTicketTypes(db, "host", ev.id, [{ id: "regular", name: "Regular", priceNaira: 5000, quantity: 3 }]), 400, /VIP/);

  // a refund: the tickets stop working and go back on sale
  await voidTicketsFor(db, "TIX1");
  assert.deepEqual(await checkIn(db, "host", ev.id, mine[1].code), { state: "refunded", name: "Ada Obi", type: "Regular" });
  assert.equal((await E.getEvent(db, ev.id, "ada")).tickets[0].left, 3, "back on sale");

  // the payout run: gifts once their day has passed, tickets once the event is over (plus the report window)
  const sent: string[] = [];
  const transfer = async (a: { reference: string }) => { sent.push(a.reference); return { transfer_code: `TRF_${a.reference}`, status: "success" } as never; };
  await db.doc("ledger/TIX1").update({ status: "refunded" });
  assert.equal(await autoReleasePayouts({ transfer }), 0, "nothing due yet");
  const day = 86_400_000;
  await db.doc("ledger/GIVE1").update({ releaseAfter: new Date(Date.now() - 60_000).toISOString() });
  await db.doc("ledger/TIX2").update({ releaseAfter: new Date(Date.now() - 2 * day).toISOString() });
  assert.equal(await autoReleasePayouts({ transfer }), 2);
  assert.deepEqual(sent.sort(), ["payout_GIVE1", "payout_TIX2"]);
  assert.equal((await db.doc("ledger/GIVE2").get()).data()!.status, "held");

  console.log("GIVING SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
