// Nana on our AI account against the Firestore emulator (lib/nana-meter.ts, lib/nana-bank.ts, chat() in lib/nana-server.ts): the
// allowance is used first, then bought credit; a plan only gets its gems; the answer bank gives a general answer again for free.
// Run: npm run test:nana-server → "ALL OK".
import assert from "node:assert/strict";
process.env.ANTHROPIC_API_KEY = "test-key";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { chat, gemModel, type CompleteArgs, type NanaDeps } from "../../lib/nana-server";
import { addNanaCredit, nanaStatus } from "../../lib/nana-meter";
import { periodAllowance } from "../../lib/nana-gems";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const now = new Date("2026-10-20T10:00:00Z"); // a Tuesday
const calls: CompleteArgs[] = [];
// Each fake answer costs 2,000 input + 500 output tokens: Pearl ($0.10/$0.50) = $0.00045 = 72 kobo; Emerald ($2/$10) = 1,440; Ruby ($4/$20) = 2,880.
const deps: NanaDeps = { now: () => now, complete: async (a) => { calls.push(a); return { text: `Answer ${calls.length}`, refused: false, usage: { input_tokens: 2000, output_tokens: 500 } }; } };
const member = (uid: string, name: string) => ({ uid, name, email: `${uid}@x.test` });
const ask = (uid: string, content: string, extra: Record<string, unknown> = {}) => chat(db, { messages: [{ role: "user", content }], signedIn: member(uid, uid), ...extra }, deps);
const acct = async (uid: string) => (await db.doc(`nanaAccounts/${uid}`).get()).data() ?? {};

(async () => {
  await db.doc("users/u_basic").set({ displayName: "Bola", username: "bola", accountTier: "basic" });
  await db.doc("users/u_biz").set({ displayName: "Biz", username: "biz", accountTier: "business" });
  await db.doc("users/u_ent").set({ displayName: "Ent", username: "ent", accountTier: "enterprise" });
  const weekly = periodAllowance(50 * 100, "week"); // Free Basic: ₦50 a month → about ₦11.50 a week

  // Free Basic: Pearl at Quick whatever they ask for; each answer is charged to the allowance.
  const r1 = await ask("u_basic", "Tell me about my week's plan for writing", { gem: "ruby", effort: "high" });
  assert.equal(r1.via, "platform"); assert.equal(r1.gem, "pearl"); assert.equal(r1.effort, "low");
  assert.equal(calls[0].model, gemModel("pearl")); assert.equal(calls[0].model, "claude-haiku-5-5"); assert.equal(calls[0].effort, "low"); assert.equal(calls[0].maxTokens, 2000);
  assert.equal((await acct("u_basic")).usedKobo, 72);
  // Until the allowance runs out; the call that crosses the line is still answered (we carry the rest).
  while ((await acct("u_basic")).usedKobo < weekly) await ask("u_basic", `Another personal question ${calls.length}, about my drafts`);
  const out = await ask("u_basic", "One more about my drafts please");
  assert.equal(out.via, "kb", "nothing left: the help centre answers");
  assert.match(out.notice ?? "", /used your free Nana allowance/);
  const st = await nanaStatus(db, "u_basic", now);
  assert.equal(st.leftKobo, 0); assert.equal(st.resetsAt, "2026-10-25T23:00:00.000Z", "Monday 00:00 Lagos");

  // A credit pack: used once the allowance is gone, and it carries over.
  await db.runTransaction(async (t) => addNanaCredit(t, db, "u_basic", 800 * 100, "na_test", now));
  const paid = await ask("u_basic", "And now about my drafts again");
  assert.equal(paid.via, "platform");
  assert.equal((await acct("u_basic")).creditKobo, 80_000 - 72);
  // Next week the allowance is back, and is used before the credit.
  const nextWeek = new Date("2026-10-27T10:00:00Z");
  const later = await chat(db, { messages: [{ role: "user", content: "Next week, my drafts" }], signedIn: member("u_basic", "Bola") }, { ...deps, now: () => nextWeek });
  assert.equal(later.via, "platform");
  const a = await acct("u_basic");
  assert.equal(a.creditKobo, 80_000 - 72, "credit untouched while there's allowance"); assert.equal(a.usedKobo, 72); assert.equal(a.period, "w2026-10-26");

  // Business gets Emerald and Balanced, not Ruby; Enterprise gets Ruby and Thorough. A dearer gem costs more.
  const b = await ask("u_biz", "Draft my plan for this week", { gem: "ruby", effort: "high" });
  assert.equal(b.gem, "emerald"); assert.equal(b.effort, "medium");
  assert.equal(calls[calls.length - 1].model, "claude-sonnet-5-5"); assert.equal(calls[calls.length - 1].maxTokens, 4000);
  assert.equal((await acct("u_biz")).usedKobo, 1_440);
  const e = await ask("u_ent", "Draft my plan for this week", { gem: "ruby", effort: "high" });
  assert.equal(e.gem, "ruby"); assert.equal(calls[calls.length - 1].model, "claude-opus-5-5"); assert.equal(calls[calls.length - 1].effort, "high");
  assert.equal((await acct("u_ent")).usedKobo, 2_880);

  // The answer bank: a visitor's general question is answered once; the next person gets it free and instantly.
  const n = calls.length;
  const v1 = await chat(db, { messages: [{ role: "user", content: "How do I get paid?" }], name: "Ada", email: "ada@x.test" }, deps);
  assert.equal(v1.via, "platform"); assert.equal(calls.length, n + 1);
  assert.doesNotMatch(String(calls[n].system[calls[n].system.length - 1].text), /Ada/, "a bank answer is written without the person's name");
  const v2 = await chat(db, { messages: [{ role: "user", content: "hello, how do I get paid" }], name: "Chi", email: "chi@x.test" }, deps);
  assert.equal(v2.via, "bank"); assert.equal(v2.reply, v1.reply); assert.equal(calls.length, n + 1, "no AI call");
  assert.match(v2.notice ?? "", /answer bank/);
  // Members are banked apart from visitors; a member out of allowance still gets a banked answer.
  const m1 = await ask("u_biz", "How do I get paid?");
  assert.equal(m1.via, "platform");
  await db.doc("nanaAccounts/u_biz").set({ usedKobo: 10_000_000 }, { merge: true });
  const m2 = await ask("u_biz", "How do I get paid?");
  assert.equal(m2.via, "bank"); assert.equal((await acct("u_biz")).usedKobo, 10_000_000, "nothing charged");
  // A Pearl answer isn't given to someone who chose Ruby; Ruby's answer then replaces it for everyone.
  const r = await ask("u_ent", "How do I get paid?", { gem: "ruby" });
  assert.equal(r.via, "platform");
  const p = await ask("u_basic", "How do I get paid?");
  assert.equal(p.via, "bank"); assert.equal(p.reply, r.reply);
  // Personal questions never go in.
  const before = (await db.collection("nanaBank").get()).size;
  await ask("u_ent", "Why hasn't order 48213 arrived?");
  assert.equal((await db.collection("nanaBank").get()).size, before);

  // ---- Nana Lite: chosen in the picker (free, never a paid model), and the stand-in when the allowance is gone ----
  let liteDown = false, liteLeft = 3;
  const liteAsked: { system: string; user: string }[] = [];
  const lite = { call: async (a: { system: string; user: string }) => { liteAsked.push(a); if (liteDown) throw new Error("busy"); return { text: "Lite says: open Earnings. [[GAP]]", ms: 3 }; }, count: async () => liteLeft-- > 0 };
  const askL = (uid: string, content: string, extra: Record<string, unknown> = {}) => chat(db, { messages: [{ role: "user", content }], signedIn: member(uid, uid), ...extra }, deps, lite);
  await db.doc("users/u_lite").set({ displayName: "Lola", username: "lola", accountTier: "basic" });
  const nCalls = calls.length;
  const l1 = await askL("u_lite", "Where do I see my earnings this week?", { lite: true });
  assert.equal(l1.via, "lite"); assert.equal(l1.reply, "Lite says: open Earnings."); assert.equal(l1.gap, true);
  assert.equal(calls.length, nCalls, "no paid model"); assert.equal((await acct("u_lite")).usedKobo ?? 0, 0, "nothing from the allowance");
  assert.match(l1.notice ?? "", /free/); assert.match(liteAsked[0].system, /Nana Lite/); assert.match(liteAsked[0].user, /PERSON: Where do I see my earnings/);
  liteDown = true;
  const l2 = await askL("u_lite", "Where do I see my earnings now?", { lite: true });
  assert.equal(l2.via, "kb", "chose Lite and it's busy: the help centre, never Pearl"); assert.equal(calls.length, nCalls);
  liteDown = false;
  // Out of allowance: Nana Lite answers instead of the help centre.
  assert.equal((await askL("u_lite", "A Pearl answer about my drafts")).via, "platform", "not chosen: Pearl as usual");
  await db.doc("nanaAccounts/u_lite").set({ usedKobo: 10_000_000, creditKobo: 0 }, { merge: true });
  const l3 = await askL("u_lite", "One more about my drafts again");
  assert.equal(l3.via, "lite"); assert.match(l3.notice ?? "", /used your free Nana allowance.*Nana Lite/);
  // Its daily limit reached: the help centre, as before.
  liteLeft = 0;
  assert.equal((await askL("u_lite", "And another about my drafts")).via, "kb");
  // The team hub never uses Nana Lite.
  liteLeft = 5; const hubAsks = liteAsked.length;
  await chat(db, { messages: [{ role: "user", content: "hub question about drafts" }], signedIn: member("u_basic", "Bola"), hubContext: "" , lite: true }, deps, lite);
  assert.equal(liteAsked.length, hubAsks);
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
