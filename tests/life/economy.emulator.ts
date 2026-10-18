import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { act, mutate, richList, friends, statement, invites } from "../../lib/life/server";
import { hotelCheckout, GAME_DAY_MS, GAME_HOUR_MS, SHIFT_MS, START_NAIRA, WORLD_EPOCH, worldTime, shiftPay, JOB, nepaAt, outagesOfDay, OUTLET, OUTLETS, outletTakings, outletProfitPerDay, outletPrice, jobBlocker, swimSkill, vipsAt, HOTEL, FOODS, cynthiaAt, dwOpen, giveawayOn, giveawayPrize, giveawayEligible, weekdayOf, DW_CLASS_MS, GIVEAWAY, RESIDENTS, type Outlet } from "../../lib/life/catalog";
import { advance, freshSave, sanitize, powerStep, powerSource, fridgeCold, chatSocial, CHAT_SOCIAL } from "../../lib/life/play";
import { payFromWallet, creditTopup } from "../../lib/wallet-server";
import { fulfillPayment, type PaymentRecord } from "../../lib/payments";
import { awardReferral } from "../../lib/life/referral";
import { tapCharge } from "../../lib/life/cardtap";
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
  // Power Tank and the fridge: 5 game hours of fridge on a full tank; food spoils after 8 game hours without cold, never in a cold fridge
  const ft = { ...freshSave(0), plates: 3 };
  let x1 = ft; for (let i = 0; i < 5; i++) x1 = powerStep(x1, GAME_HOUR_MS, { out: true, owned: ["power_tank", "fridge", "ac"], night: false, deskWork: false });
  assert.ok(x1.tank < 1, "fridge empties the tank in 5 h: " + x1.tank); assert.equal(x1.plates, 3); assert.equal(fridgeCold(x1, true, ["power_tank", "fridge"]), false);
  for (let i = 0; i < 8; i++) x1 = powerStep(x1, GAME_HOUR_MS, { out: true, owned: ["power_tank", "fridge", "ac"], night: true, deskWork: false });
  assert.equal(x1.plates, 0, "spoiled after 8 warm hours"); assert.ok(x1.spoiledAt > 0);
  let x2 = ft; for (let i = 0; i < 12; i++) x2 = powerStep(x2, GAME_HOUR_MS, { out: false, owned: ["fridge"], night: false, deskWork: false });
  assert.equal(x2.plates, 3, "a fridge with NEPA light keeps food");
  let x3 = ft; for (let i = 0; i < 8; i++) x3 = powerStep(x3, GAME_HOUR_MS, { out: false, owned: [], night: false, deskWork: false });
  assert.equal(x3.plates, 0, "no fridge: spoiled in 8 h");
  assert.equal(powerStep({ ...ft, tank: 0 }, GAME_HOUR_MS, { out: true, owned: ["power_tank", "solar_650", "solar_650b"], night: false, deskWork: false }).tank, 600, "two 650W panels by day");
  assert.equal(powerSource({ genOn: false, fuel: 0, battery: 0, tank: 500 }, true, ["power_tank"]), "tank");
  assert.equal(sanitize({ tank: 9999 }).tank, 1000);
  advance({ ...ft, delivery: { at: 10, hunger: 50, keep: 2 } }, 20).s.plates === 5 || assert.fail("delivery kept for later");
  // outlets: profit a game day near the agreed figures, half sales in blackouts without backup, takings held 30 game days at most
  assert.deepEqual(OUTLETS.map((t) => outletProfitPerDay(t, "wuse")), [72200, 213600, 47000, 181600]);
  assert.equal(outletPrice(OUTLET("chef_kiosk")!, "garki"), 2_800_000);
  const k0: Outlet = { kind: "chef_kiosk", area: "wuse", openedAt: WORLD_EPOCH, lastCollectAt: WORLD_EPOCH, earned: 0, backup: true };
  assert.ok(Math.abs(outletTakings(k0, WORLD_EPOCH + GAME_DAY_MS).takings - Math.round(110000 * 0.96 * 0.72 - 7000)) < 2);
  assert.ok(outletTakings({ ...k0, backup: false }, WORLD_EPOCH + GAME_DAY_MS).takings < outletTakings(k0, WORLD_EPOCH + GAME_DAY_MS).takings, "blackouts cost sales");
  assert.equal(outletTakings(k0, WORLD_EPOCH + 40 * GAME_DAY_MS).takings, outletTakings(k0, WORLD_EPOCH + 30 * GAME_DAY_MS).takings, "held 30 days at most");
  assert.equal(outletTakings(k0, WORLD_EPOCH + 31 * GAME_DAY_MS).capped, true);
  // jobs: brand shifts, fitness
  assert.match(jobBlocker(JOB("itel_super")!, { owned: [], cooking: 1, chefShifts: 0, itelShifts: 3, reputation: 0 }) ?? "", /10 itel Energy shifts \(you have 3\)/);
  assert.match(jobBlocker(JOB("hotel_guard")!, { owned: [], cooking: 1, chefShifts: 0, reputation: 0 }) ?? "", /fitness/);
  assert.equal(jobBlocker(JOB("hotel_guard")!, { owned: [], cooking: 1, chefShifts: 0, reputation: 0, fit: true }), null);
  // swimming, gym and VIP rules
  assert.equal(swimSkill(0, 0), 0); assert.equal(swimSkill(3, 4), 8); assert.equal(swimSkill(9, 9), 10);
  assert.match(jobBlocker(JOB("hotel_swim")!, { owned: [], cooking: 1, chefShifts: 0, reputation: 0, swim: 2 }) ?? "", /swimming skill 5 \(you have 2\)/);
  assert.equal(jobBlocker(JOB("hotel_swim")!, { owned: [], cooking: 1, chefShifts: 0, reputation: 0, swim: 6 }), null);
  assert.match(jobBlocker(JOB("hotel_gym")!, { owned: [], cooking: 1, chefShifts: 0, reputation: 0, gymSessions: 4 }) ?? "", /10 gym sessions \(4 so far\)/);
  assert.equal(HOTEL.find((h) => h.id === "vipbar")!.price, 11_500); assert.equal(HOTEL.find((h) => h.id === "poolbar")!.price, 10_000); assert.equal(HOTEL.find((h) => h.id === "lesson")!.price, 15_000);
  const v = vipsAt(WORLD_EPOCH + 5 * GAME_HOUR_MS); assert.equal(v.in.length, 2); assert.ok(v.next); assert.ok(v.nextAt > WORLD_EPOCH + 5 * GAME_HOUR_MS);
  assert.notDeepEqual(vipsAt(WORLD_EPOCH).in, vipsAt(WORLD_EPOCH + 4 * GAME_HOUR_MS).in, "VIPs rotate every 4 game hours");
  for (const [id, price] of [["shawarma", 3500], ["pizza", 6000], ["smoothie", 1800]] as const) assert.equal(FOODS.find((f) => f.id === id)?.price, price);
  // chatting with friends: +8 a message, +12 at the same place, +4 a reply, 40 an hour at most, new allowance each hour
  const H = 3_600_000 * 500_000;
  let cs = { ...freshSave(H), needs: { ...freshSave(H).needs, social: 10 } };
  let g = chatSocial(cs, "send", H); assert.equal(g.gain, CHAT_SOCIAL.send); assert.equal(g.save.needs.social, 18); cs = g.save;
  g = chatSocial(cs, "here", H + 1000); assert.equal(g.gain, 12); cs = g.save;
  g = chatSocial(cs, "reply", H + 2000); assert.equal(g.gain, 4); cs = g.save;
  for (let i = 0; i < 5; i++) cs = chatSocial(cs, "here", H + 3000 + i).save;
  assert.equal(cs.chatGained, 40, "capped at 40 an hour"); assert.equal(chatSocial(cs, "send", H + 9000).gain, 0);
  assert.equal(chatSocial(cs, "send", H + 3_600_000).gain, 8, "a new hour, a new allowance");
  assert.equal(sanitize({ chatHour: 5, chatGained: 12 }).chatGained, 12);
  // Digital Witch: Cynthia is #1, at the hub by day and the VIP bar in the evening; certificates open tech jobs; the Saturday giveaway
  assert.equal([...RESIDENTS].sort((a, b) => (b.netWorth ?? 0) - (a.netWorth ?? 0))[0].id, "cynthia");
  const atH = (h: number, dayOffset = 0) => { let t = WORLD_EPOCH + dayOffset * GAME_DAY_MS; while (worldTime(t).hour !== h) t += GAME_HOUR_MS / 4; return t; };
  assert.equal(cynthiaAt(atH(10)), "dw"); assert.equal(cynthiaAt(atH(20)), "hotel"); assert.equal(cynthiaAt(atH(2)), null);
  assert.ok(dwOpen(atH(9)) && !dwOpen(atH(18)) && !dwOpen(atH(7)));
  assert.equal(vipsAt(atH(20)).in[0], "cynthia"); assert.ok(!vipsAt(atH(12)).in.includes("cynthia"));
  assert.match(jobBlocker(JOB("dw_va")!, { owned: [], cooking: 1, chefShifts: 0, reputation: 0 }) ?? "", /Virtual Assistant certificate/);
  assert.equal(jobBlocker(JOB("dw_va")!, { owned: [], cooking: 1, chefShifts: 0, reputation: 0, certs: ["va"] }), null);
  assert.match(jobBlocker(JOB("tech")!, { owned: ["pc_laptop"], cooking: 1, chefShifts: 0, reputation: 0 }) ?? "", /Digital Witch certificate/);
  assert.equal(jobBlocker(JOB("tech")!, { owned: ["pc_laptop"], cooking: 1, chefShifts: 0, reputation: 0, certs: ["cs"] }), null);
  let sat = WORLD_EPOCH; while (weekdayOf(sat) !== GIVEAWAY.weekday) sat += GAME_DAY_MS / 2;
  const satNight = atH(20, Math.round((sat - WORLD_EPOCH) / GAME_DAY_MS));
  assert.ok(giveawayOn(satNight)); assert.ok(!giveawayOn(atH(20, Math.round((sat - WORLD_EPOCH) / GAME_DAY_MS) + 1)));
  assert.equal(giveawayPrize(0.01), 1_000_000); assert.equal(giveawayPrize(0.1), 500_000); assert.equal(giveawayPrize(0.5), 0);
  assert.ok(!giveawayEligible(["va"], 9) && giveawayEligible(["va"], 10) && !giveawayEligible([], 50));
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
  assert.equal(tapCharge({ action: "food", mode: "delivery", items: [{ id: "combo", qty: 1 }] }, { jobId: null })?.amount, 2700, "the CardTap terminal shows what the server charges");
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
  const rlAll = await richList(db, "p2"); assert.equal(rlAll.rows[0].uid, "npc:cynthia"); assert.match(rlAll.rows[0].avatar, /cynthia-okeh/); assert.equal(rlAll.rows[1].uid, "npc:musa"); assert.ok(rlAll.rows.some((x) => x.uid === "p2" && !x.npc)); assert.equal(rlAll.me?.realRank, 1); assert.ok((rlAll.me?.rank ?? 0) > 1);
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
  // partner outlets on the server: qualify, open, collect, backup; itel staff price; Candellux tips and staff half price
  await db.doc("users/p7").set({ username: "gogo" });
  const T7 = T0 + 50 * GAME_DAY_MS;
  await mutate(db, "p7", () => null, T7);
  await db.doc("lifePlayers/p7").update({ naira: 12_000_000, owned: FieldValue.arrayUnion("power_go") });
  await rej(act(db, "p7", { action: "outlet_open", outlet: "chef_kiosk" }, T7), /10 Chef Adams shifts/);
  await rej(act(db, "p7", { action: "outlet_open", outlet: "itel_home" }, T7), /5 itel Energy shifts/);
  await db.doc("lifePlayers/p7").update({ chefShifts: 10, reputation: 3, itelShifts: 5 });
  r = await act(db, "p7", { action: "outlet_open", outlet: "chef_kiosk", area: "garki" }, T7); assert.equal(r.player.naira, 12_000_000 - 2_800_000);
  await rej(act(db, "p7", { action: "outlet_open", outlet: "chef_kiosk" }, T7), /already own/);
  await rej(act(db, "p7", { action: "outlet_open", outlet: "chef_shop" }, T7 + GAME_DAY_MS), /7 game days/);
  assert.equal(r.player.netWorth, r.player.naira + 150000 + Math.round(2_800_000 * 0.96));
  const n7 = r.player.naira;
  r = await act(db, "p7", { action: "outlet_collect" }, T7 + 2 * GAME_DAY_MS); const got = (r.result as { total: number }).total;
  assert.ok(got > 100_000 && got < 2 * 81_000, "two days of takings: " + got); assert.equal(r.player.naira, n7 + got); assert.equal(r.player.outlets[0].earned, got);
  r = await act(db, "p7", { action: "outlet_backup", outlet: "chef_kiosk" }, T7 + 3 * GAME_DAY_MS); assert.equal(r.player.outlets[0].backup, true);
  r = await act(db, "p7", { action: "outlet_open", outlet: "itel_home" }, T7 + 3 * GAME_DAY_MS); assert.equal(r.player.outlets.length, 2);
  await rej(act(db, "p7", { action: "outlet_backup", outlet: "chef_kiosk" }, T7 + 3 * GAME_DAY_MS), /already/);
  await act(db, "p7", { action: "job_apply", job: "itel_sales" }, T7 + 3 * GAME_DAY_MS);
  r = await act(db, "p7", { action: "buy", item: "power_tank" }, T7 + 3 * GAME_DAY_MS); assert.match((r.result as { message: string }).message, /staff price, N\$ 320,000/);
  assert.equal(tapCharge({ action: "buy", item: "power_tank" }, { jobId: "itel_sales" })?.amount, 320_000, "CardTap: itel staff price");
  await act(db, "p7", { action: "shift_start", needsLow: false }, T7 + 3 * GAME_DAY_MS);
  r = await act(db, "p7", { action: "shift_finish" }, T7 + 3 * GAME_DAY_MS + SHIFT_MS, () => 0.99); assert.equal((r.result as { extra: number }).extra, 1500); assert.equal(r.player.itelShifts, 6);
  await act(db, "p7", { action: "job_apply", job: "hotel_house" }, T7 + 4 * GAME_DAY_MS);
  const b7 = (await db.doc("lifePlayers/p7").get()).data()!.naira;
  r = await act(db, "p7", { action: "hotel", service: "pool" }, T7 + 4 * GAME_DAY_MS); assert.equal(r.player.naira, b7 - 12_500, "Candellux staff: half price pool");
  assert.equal(tapCharge({ action: "hotel", service: "pool" }, { jobId: "hotel_house" })?.amount, 12_500, "CardTap: Candellux staff price");
  console.log("outlets ok");

  await db.doc("users/p8").set({ username: "femi", displayName: "FEMI" });
  const T8 = T0 + 30 * GAME_DAY_MS;
  await mutate(db, "p8", () => null, T8);
  await db.doc("lifePlayers/p8").update({ naira: 500_000 });
  for (let i = 0; i < 3; i++) await act(db, "p8", { action: "hotel", service: "lesson" }, T8 + i * GAME_DAY_MS);
  r = await act(db, "p8", { action: "hotel", service: "gym" }, T8 + 3 * GAME_DAY_MS);
  assert.equal(r.player.swimLessons, 3); assert.equal(r.player.gymSessions, 1); assert.equal(swimSkill(r.player.swimLessons, r.player.swims), 6);
  r = await act(db, "p8", { action: "job_apply", job: "hotel_swim" }, T8 + 3 * GAME_DAY_MS); assert.equal(r.player.jobId, "hotel_swim");
  await rej(act(db, "p8", { action: "job_apply", job: "hotel_gym" }, T8 + 3 * GAME_DAY_MS), /gym sessions/);
  r = await act(db, "p8", { action: "city_notify", city: "lagos" }, T8); assert.deepEqual(r.player.cityNotify, ["lagos"]);
  await rej(act(db, "p8", { action: "city_notify", city: "kano" }, T8), /isn't coming/);
  console.log("swim ok");

  // Digital Witch at the server: enrol, take classes (spaced, in opening hours), get certified, apply, the giveaway
  await db.doc("users/p9").set({ username: "kemi", displayName: "KEMI" });
  const D0 = atH(9, 70);
  await mutate(db, "p9", () => null, D0);
  await db.doc("lifePlayers/p9").update({ naira: 300_000 });
  await rej(act(db, "p9", { action: "dw_class", course: "va" }, D0), /Pay for the Virtual Assistant course/);
  r = await act(db, "p9", { action: "dw_enroll", course: "va" }, D0); assert.equal(r.player.naira, 240_000);
  await rej(act(db, "p9", { action: "dw_enroll", course: "va" }, D0), /already on/);
  r = await act(db, "p9", { action: "dw_class", course: "va" }, D0); assert.equal((r.result as { done: number }).done, 1);
  await rej(act(db, "p9", { action: "dw_class", course: "va" }, D0 + 1000), /One class at a time/);
  await rej(act(db, "p9", { action: "dw_class", course: "va" }, atH(20, 70)), /9 AM to 6 PM/);
  let tc = D0;
  for (let i = 2; i <= 4; i++) { tc += DW_CLASS_MS; r = await act(db, "p9", { action: "dw_class", course: "va" }, tc); }
  assert.equal((r.result as { cert: boolean }).cert, true); assert.deepEqual(r.player.certs, ["va"]);
  r = await act(db, "p9", { action: "job_apply", job: "dw_va" }, tc); assert.equal(r.player.jobId, "dw_va");
  const satDay = Math.ceil((tc - WORLD_EPOCH) / GAME_DAY_MS); let gs = atH(20, satDay); while (!giveawayOn(gs)) gs += GAME_DAY_MS;
  await rej(act(db, "p9", { action: "dw_giveaway" }, gs), /10 tech shifts/);
  await db.doc("lifePlayers/p9").update({ techShifts: 10, owned: FieldValue.arrayUnion("pc_laptop") });
  await rej(act(db, "p9", { action: "dw_giveaway" }, gs - 6 * GAME_HOUR_MS), /Saturday nights/);
  const before9 = (await db.doc("lifePlayers/p9").get()).data()!.naira;
  r = await act(db, "p9", { action: "dw_giveaway" }, gs, () => 0.01); assert.equal((r.result as { prize: number }).prize, 1_000_000); assert.equal(r.player.naira, before9 + 1_000_000);
  await rej(act(db, "p9", { action: "dw_giveaway" }, gs + 1000, () => 0.01), /this week's giveaway/);
  await act(db, "p9", { action: "shift_start", needsLow: false }, gs + 2000);
  r = await act(db, "p9", { action: "shift_finish" }, gs + 2000 + SHIFT_MS); assert.equal(r.player.techShifts, 11);
  console.log("digital witch ok");
  // the Candellux suite: yours till 11 AM checkout (from 6 AM, the next day's), room service fills you up
  const co = (h: number) => worldTime(hotelCheckout(atH(h, 80)));
  assert.equal(co(14).label, "11:00 AM"); assert.equal(co(2).label, "11:00 AM"); assert.equal(co(11).label, "11:00 AM");
  assert.ok(hotelCheckout(atH(14, 80)) - atH(14, 80) === 21 * GAME_HOUR_MS, "2 PM to 11 AM is 21 game hours");
  assert.ok(hotelCheckout(atH(2, 80)) - atH(2, 80) === 9 * GAME_HOUR_MS, "a late arrival checks out the same morning");
  assert.ok(hotelCheckout(atH(9, 80)) - atH(9, 80) === 26 * GAME_HOUR_MS, "an early arrival keeps the room to tomorrow's 11 AM");
  await db.doc("users/p10").set({ username: "tobi" }); await mutate(db, "p10", () => null, atH(14, 80));
  await db.doc("lifePlayers/p10").update({ naira: 400_000 });
  r = await act(db, "p10", { action: "hotel", service: "suite" }, atH(14, 80));
  assert.equal(r.player.hotelUntil, hotelCheckout(atH(14, 80))); assert.equal(r.player.naira, 220_000);
  assert.deepEqual((r.result as { set: unknown }).set, { energy: 100, hygiene: 100, bladder: 100, fun: 100 });
  await rej(act(db, "p10", { action: "hotel", service: "suite" }, atH(18, 80)), /yours till 11:00 AM checkout/);
  r = await act(db, "p10", { action: "hotel", service: "restaurant" }, atH(20, 80));
  assert.deepEqual((r.result as { set: unknown; roomService: boolean }).set, { hunger: 100 }); assert.equal((r.result as { roomService: boolean }).roomService, true);
  r = await act(db, "p10", { action: "hotel", service: "restaurant" }, atH(12, 81));
  assert.equal((r.result as { set: unknown }).set, null, "after checkout the restaurant is the restaurant again");
  r = await act(db, "p10", { action: "hotel", service: "suite" }, atH(12, 81)); assert.ok(r.player.hotelUntil > atH(12, 81), "book again after checkout");
  console.log("hotel stay ok");
  console.log("ALL OK");
})().catch((e) => { console.log("FAIL", e); process.exit(1); });
