import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { act, mutate, richList, friends, statement, invites } from "../../lib/life/server";
import { GAME_DAY_MS, GAME_HOUR_MS, SHIFT_MS, START_NAIRA, WORLD_EPOCH, worldTime, shiftPay, JOB, nepaAt, outagesOfDay } from "../../lib/life/catalog";
import { advance, freshSave, sanitize, powerStep, powerSource } from "../../lib/life/play";
import { payFromWallet, creditTopup } from "../../lib/wallet-server";
import { fulfillPayment, type PaymentRecord } from "../../lib/payments";
import { awardReferral } from "../../lib/life/referral";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const rej = async (p: Promise<unknown>, re: RegExp) => { await assert.rejects(p, re); };
(async () => {
  // pure bits
  assert.equal(worldTime(Date.UTC(2026, 9, 1, 5, 0, 0)).label, "6:00 AM");
  assert.equal(worldTime(Date.UTC(2026, 9, 1, 5, 24, 0)).label, "6:00 PM");
  const s0 = freshSave(0); const r1 = advance({ ...s0, tickAt: 0 }, GAME_HOUR_MS * 10);
  assert.ok(r1.s.needs.hunger < s0.needs.hunger && r1.s.needs.bladder === 30, "needs decay: " + JSON.stringify(r1.s.needs));
  const slept = advance({ ...s0, tickAt: 0, activity: { kind: "sleep", label: "Sleeping", icon: "🛏", startedAt: 0, endsAt: GAME_HOUR_MS * 4, perHour: { energy: 12 } } }, GAME_HOUR_MS * 5);
  assert.equal(slept.finished?.kind, "sleep"); assert.equal(slept.s.needs.energy, 97.5);
  assert.equal(sanitize({ needs: { hunger: 500 }, outfit: "red", place: "moon" }).needs.hunger, 100);
  assert.equal(shiftPay(JOB("writer")!, ["pc_aio"], false), 15000); assert.equal(shiftPay(JOB("rider")!, ["ebike"], true), 7200);
  // NEPA: 2 or 3 outages a game day, 2 to 6 game hours, the same for everyone
  for (let d = 0; d < 40; d++) { const o = outagesOfDay(d); assert.ok(o.length >= 2 && o.length <= 3); for (const x of o) { const h = (x.to - x.from) / GAME_HOUR_MS; assert.ok(h >= 2 && h <= 6, "length " + h); } }
  const o0 = outagesOfDay(3)[0]; assert.equal(nepaAt(o0.from + 1000).out, true); assert.equal(nepaAt(o0.from + 1000).id, o0.id); assert.equal(nepaAt(o0.from - 1000).out, false);
  // power: the Power GO drains in a blackout and charges with light; the generator burns petrol and stops when empty
  const ps = { ...freshSave(0), battery: 320 };
  const go = powerStep(ps, GAME_HOUR_MS, { out: true, owned: ["power_go", "fan"], night: true, deskWork: true }); assert.equal(go.battery, 320 - 91);
  assert.equal(powerStep({ ...go }, GAME_HOUR_MS, { out: false, owned: ["power_go"], night: true, deskWork: false }).battery, 320);
  const g1 = powerStep({ ...ps, genOn: true, fuel: 0.3 }, GAME_HOUR_MS, { out: true, owned: ["gen_small"], night: true, deskWork: false }); assert.equal(g1.fuel, 0); assert.equal(g1.genOn, false);
  assert.equal(powerSource({ genOn: false, fuel: 0, battery: 0 }, true, ["power_go"]), "none");
  assert.equal(powerStep({ ...ps, battery: 0 }, GAME_HOUR_MS, { out: true, owned: ["power_go", "solar_panel"], night: false, deskWork: false }).battery, 55, "empty: solar fills it, nothing runs yet");
  console.log("pure ok");

  for (const [u, n] of [["p1", "ada"], ["p2", "bola"], ["p3", "chi"]]) await db.doc(`users/${u}`).set({ username: n, displayName: n.toUpperCase() });
  const T0 = Date.UTC(2026, 9, 14, 8);
  let { player } = await mutate(db, "p1", () => null, T0);
  assert.equal(player.naira, START_NAIRA); assert.ok(player.owned.includes("rug_notesapp"));
  await db.doc("lifePlayers/p1").update({ owned: FieldValue.arrayUnion("power_go") }); // desk shifts below shouldn't depend on NEPA's schedule
  await rej(act(db, "p1", { action: "buy", item: "ac" }, T0), /Not enough/);
  ({ player } = await act(db, "p1", { action: "buy", item: "cooker" }, T0)); assert.equal(player.naira, 35000);
  await rej(act(db, "p1", { action: "buy", item: "cooker" }, T0), /already own/);
  let r = await act(db, "p1", { action: "food", mode: "delivery", items: [{ id: "combo", qty: 1 }] }, T0); assert.equal(r.player.naira, 35000 - 2700); assert.equal((r.result as { hunger: number }).hunger, 50);
  await rej(act(db, "p1", { action: "food", mode: "delivery", items: [{ id: "lobster", qty: 1 }] }, T0), /menu/);
  await rej(act(db, "p1", { action: "travel", mode: "ebike", to: "work" }, T0), /don't have/);
  r = await act(db, "p1", { action: "cook", recipe: "noodles_egg" }, T0); assert.equal(r.player.cooks, 1);
  await rej(act(db, "p1", { action: "job_apply", job: "tech" }, T0), /Needs/);
  await rej(act(db, "p1", { action: "job_apply", job: "chef_cook" }, T0), /cooking skill/);
  r = await act(db, "p1", { action: "job_apply", job: "writer" }, T0);
  r = await act(db, "p1", { action: "shift_start", needsLow: false }, T0); assert.equal((r.result as { pay: number }).pay, 6000);
  await rej(act(db, "p1", { action: "shift_finish" }, T0 + 60_000), /isn't over/);
  const before = r.player.naira;
  r = await act(db, "p1", { action: "shift_finish" }, T0 + SHIFT_MS); assert.equal(r.player.naira, before + 6000); assert.equal(r.player.shifts, 1);
  await rej(act(db, "p1", { action: "shift_finish" }, T0 + SHIFT_MS), /not on a shift/);
  // deals: none before 8 game hours, then one; accept pays after its hours
  r = await act(db, "p1", { action: "deal_ring" }, T0 + GAME_HOUR_MS); assert.equal((r.result as { deal: unknown }).deal, null);
  r = await act(db, "p1", { action: "deal_ring" }, T0 + GAME_HOUR_MS * 9, () => 0.5); const deal = (r.result as { deal: { cost: number; pay: number; hours: number } }).deal; assert.ok(deal);
  const nBefore = r.player.naira;
  if (nBefore >= deal.cost) {
    r = await act(db, "p1", { action: "deal_answer", answer: "accept" }, T0 + GAME_HOUR_MS * 9); assert.equal(r.player.naira, nBefore - deal.cost);
    await rej(act(db, "p1", { action: "deal_collect" }, T0 + GAME_HOUR_MS * 10), /isn't ready/);
    r = await act(db, "p1", { action: "deal_collect" }, T0 + GAME_HOUR_MS * (9 + deal.hours)); assert.equal(r.player.naira, nBefore - deal.cost + deal.pay); assert.equal(r.player.reputation, 0.5);
  } else { r = await act(db, "p1", { action: "deal_answer", answer: "decline" }, T0 + GAME_HOUR_MS * 9); }
  // negotiate that fails loses the deal
  r = await act(db, "p1", { action: "deal_ring" }, T0 + GAME_HOUR_MS * 60, () => 0.1);
  r = await act(db, "p1", { action: "deal_answer", answer: "negotiate" }, T0 + GAME_HOUR_MS * 60, () => 0.99); assert.equal(r.player.deal, null);
  // rent after 30 game days
  const n0 = r.player.naira;
  r = await act(db, "p1", { action: "deal_ring" }, T0 + 30 * GAME_DAY_MS + 1000, () => 0.1);
  assert.equal(r.player.rentMonths + r.player.rentOwed / 60000, 1, "rent month counted");
  console.log("rent", n0, "→", r.player.naira, "owed", r.player.rentOwed);
  // hotel boosts and travel
  await mutate(db, "p2", () => null, T0);
  await rej(act(db, "p2", { action: "hotel", service: "suite" }, T0), /Not enough/);
  r = await act(db, "p2", { action: "hotel", service: "barber" }, T0); assert.ok(r.player.barberUntil > T0);
  await rej(act(db, "p2", { action: "hotel", service: "conference" }, T0), /isn't open/);
  r = await act(db, "p2", { action: "travel", mode: "keke", to: "work" }, T0); assert.equal(r.player.naira, 100000 - 8000 - 400);
  // N$ bought with NotesApp Credit: 1 kobo = N$ 1
  const top: PaymentRecord = { reference: "topL", kind: "wallet_topup", uid: "p2", email: "b@x.ng", amountKobo: 500_000, status: "paid", publisherUid: "p2", publisherUsername: "", commissionRate: 0, topup: { bonusKobo: 0 }, createdAt: new Date().toISOString() };
  await db.runTransaction((t) => creditTopup(t, db, top, new Date()));
  const buy: PaymentRecord = { reference: "lifeN1", kind: "life_naira", uid: "p2", email: "b@x.ng", amountKobo: 350_000, status: "pending", publisherUid: "p2", publisherUsername: "", commissionRate: 0, createdAt: new Date().toISOString() };
  await payFromWallet(db, buy); await fulfillPayment("lifeN1");
  const p2 = (await db.doc("lifePlayers/p2").get()).data()!; assert.equal(p2.naira, 91600 + 350000);
  // a buyer who never played yet: starts with N$ 100,000 on top
  await payFromWallet(db, { ...buy, reference: "lifeN2", uid: "p3" }).catch((e) => assert.match(String(e), /Not enough/));
  await db.doc("lifePlayers/p3").set({ naira: 5000 }, { merge: true });
  ({ player } = await mutate(db, "p3", () => null, T0)); assert.equal(player.naira, 105000);
  // power shop, petrol and NEPA at the desk
  await db.doc("users/p6").set({ username: "fola" });
  const outT = outagesOfDay(Math.floor((T0 - WORLD_EPOCH) / GAME_DAY_MS) + 1)[0].from + 60_000; // inside a blackout
  await mutate(db, "p6", () => null, outT);
  await rej(act(db, "p6", { action: "buy", item: "solar_panel" }, outT), /first/);
  await rej(act(db, "p6", { action: "buy", item: "home_kit" }, outT), /coming soon/);
  await rej(act(db, "p6", { action: "fuel", litres: 2 }, outT), /generator/);
  await act(db, "p6", { action: "job_apply", job: "writer" }, outT);
  await rej(act(db, "p6", { action: "shift_start", needsLow: false }, outT), /NEPA/);
  r = await act(db, "p6", { action: "buy", item: "gen_small" }, outT); assert.equal(r.player.naira, 100000 - 65000);
  await rej(act(db, "p6", { action: "fuel", litres: 9 }, outT), /1 to 5/);
  r = await act(db, "p6", { action: "fuel", litres: 3 }, outT); assert.equal(r.player.naira, 35000 - 3300);
  r = await act(db, "p6", { action: "shift_start", needsLow: false }, outT); assert.ok((r.result as { pay: number }).pay > 0);
  // rich list and friends
  const rl = await richList(db, "p2", 20, true); assert.equal(rl.rows[0].uid, "p2"); assert.equal(rl.me?.rank, 1);
  const rlAll = await richList(db, "p2"); assert.equal(rlAll.rows[0].uid, "npc:musa"); assert.ok(rlAll.rows.some((x) => x.uid === "p2" && !x.npc)); assert.equal(rlAll.me?.realRank, 1); assert.ok((rlAll.me?.rank ?? 0) > 1);
  await db.doc("follows/p1_bola").set({ followerUid: "p1", username: "bola" }); await db.doc("follows/p2_ada").set({ followerUid: "p2", username: "ada" }); await db.doc("follows/p3_ada").set({ followerUid: "p3", username: "ada" });
  const fr = await friends(db, "p1"); assert.deepEqual(fr.friends.map((f) => f.username), ["bola"]); assert.equal(fr.friends[0].plays, true);
  const st = await statement(db, "p2"); assert.ok(st.lines.some((l) => l.kind === "buy_naira"));
  // invites: the friend's first finished shift pays both of them once, only with a verified email, never to yourself
  await db.doc("users/p4").set({ username: "dee", displayName: "DEE" });
  ({ player } = await mutate(db, "p4", () => null, T0, "p1")); assert.equal(player.referredBy, "p1");
  await db.doc("lifePlayers/p4").update({ owned: FieldValue.arrayUnion("power_go") });
  ({ player } = await mutate(db, "p4", () => null, T0, "p2")); assert.equal(player.referredBy, "p1", "an invite only counts when you start");
  ({ player } = await mutate(db, "p1", () => null, T0, "p4")); assert.equal(player.referredBy, null, "an existing player can't be invited");
  await act(db, "p4", { action: "job_apply", job: "writer" }, T0); await act(db, "p4", { action: "shift_start", needsLow: false }, T0);
  r = await act(db, "p4", { action: "shift_finish" }, T0 + SHIFT_MS); assert.equal((r.result as { referral: string | null }).referral, "p1");
  const at = new Date(T0);
  assert.equal(await awardReferral(db, "p4", "p1", at, { verified: async () => false }), "skipped");
  assert.equal((await invites(db, "p1")).invites[0].status, "verify");
  await act(db, "p4", { action: "shift_start", needsLow: false }, T0 + SHIFT_MS);
  r = await act(db, "p4", { action: "shift_finish" }, T0 + 2 * SHIFT_MS); assert.equal((r.result as { referral: string | null }).referral, "p1", "asked again after a later shift");
  assert.equal(await awardReferral(db, "p4", "p4", at, { verified: async () => true }), "skipped");
  assert.equal(await awardReferral(db, "p4", "p2", at, { verified: async () => true }), "skipped", "only the one who invited you");
  assert.equal(await awardReferral(db, "p4", "p1", at, { verified: async () => true }), "paid");
  assert.equal(await awardReferral(db, "p4", "p1", at, { verified: async () => true }), "skipped", "paid once");
  const bonusOf = async (u: string) => ((await db.doc(`wallets/${u}`).get()).data()?.bonusLots as { kobo: number }[]).reduce((t, l) => t + l.kobo, 0);
  assert.equal(await bonusOf("p4"), 25_000); assert.equal(await bonusOf("p1"), 25_000);
  assert.equal((await db.doc("lifePlayers/p1").get()).data()!.invitesDone, 1);
  assert.equal((await db.doc(`lifeBonus/${at.toISOString().slice(0, 7)}`).get()).data()!.kobo, 50_000);
  // the inviter's monthly limit: a 21st friend that month is marked done without a bonus
  await db.doc("lifePlayers/p1").update({ [`invitesByMonth.${at.toISOString().slice(0, 7)}`]: 20 });
  await db.doc("users/p5").set({ username: "eze" }); await mutate(db, "p5", () => null, T0, "p1");
  assert.equal(await awardReferral(db, "p5", "p1", at, { verified: async () => true }), "skipped");
  assert.equal((await db.doc("lifePlayers/p5").get()).data()!.referralPaid, true);
  assert.equal(await bonusOf("p1"), 25_000);
  const inv = await invites(db, "p1");
  assert.deepEqual(inv.invites.map((x) => [x.username, x.status]).sort(), [["dee", "paid"], ["eze", "limit"]]); assert.equal(inv.paid, 1);
  r = await act(db, "p4", { action: "shift_start", needsLow: false }, T0 + 2 * SHIFT_MS);
  r = await act(db, "p4", { action: "shift_finish" }, T0 + 3 * SHIFT_MS); assert.equal((r.result as { referral: string | null }).referral, null, "never again once paid");
  console.log("referral ok");
  console.log("ALL OK");
})().catch((e) => { console.log("FAIL", e); process.exit(1); });
