// CardTap wallet top-ups end to end (lib/cardtap-topup-server.ts, lib/payments.ts) on the Firestore emulator, with Paylony's API
// stubbed: starting one, waiting, a clear "paid" adding the credit and its bonus exactly once, a refusal, and the launch offer.
// Run: npm run test:cardtap-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

let verifyReply: unknown = { status: "00", data: { status: "pending" } };
const sent: { url: string; body: Record<string, unknown> }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.startsWith("https://api.paylony.com/")) return realFetch(input, init);
  if (url.endsWith("/pay_with_cardtap")) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    sent.push({ url, body });
    return new Response(JSON.stringify({ status: "00", initiationRef: `CT-${String(body.reference).slice(-6)}`, instruction: "Paste the code in CardTap" }), { status: 200 });
  }
  if (url.includes("/verify_checkout_payment/")) return new Response(JSON.stringify(verifyReply), { status: 200 });
  return new Response("{}", { status: 404 });
}) as typeof fetch;

(async () => {
  const { startCardtap, checkCardtap, setCardtapFeeWaived, CardtapError } = await import("../../lib/cardtap-topup-server");
  await db.doc("users/u_ada").set({ username: "ada", displayName: "Ada Obi", phone: "08030000000" });
  const me = { uid: "u_ada", email: "ada@x.test" };

  // at cost: ₦10,000 + ₦100 fee, with the ₦700 bonus
  const s = await startCardtap(db, me, 10_000, "https://www.notesapp.name.ng");
  assert.equal(s.payKobo, 1_010_000); assert.equal(s.feeKobo, 10_000); assert.equal(s.waived, false); assert.equal(s.bonusKobo, 70_000);
  assert.match(s.initiationRef, /^CT-/);
  assert.equal(sent[0].body.amount, 10_100, "Paylony is asked for the top-up plus the fee, in naira");
  assert.equal(sent[0].body.terminal_id, "T-TEST"); assert.equal(sent[0].body.reference, s.reference); assert.equal(sent[0].body.phone, "08030000000");
  const p0 = (await db.doc(`payments/${s.reference}`).get()).data()!;
  assert.equal(p0.status, "pending"); assert.equal(p0.payWith, "cardtap"); assert.equal(p0.amountKobo, 1_000_000, "the wallet gets the top-up, not the fee");

  // still tapping
  assert.equal((await checkCardtap(db, s.reference, "u_ada")).status, "waiting");
  assert.equal((await db.doc("wallets/u_ada").get()).exists, false, "nothing credited while waiting");
  await assert.rejects(checkCardtap(db, s.reference, "u_someone_else"), (e: unknown) => e instanceof CardtapError && e.status === 404, "only the member's own");

  // paid: credited once, however many times it's asked (the page and the webhook)
  verifyReply = { status: "00", data: { status: "successful", amount: "10100", reference: s.reference } };
  assert.equal((await checkCardtap(db, s.reference, "u_ada")).status, "paid");
  assert.equal((await checkCardtap(db, s.reference)).status, "paid");
  const w = (await db.doc("wallets/u_ada").get()).data()!;
  assert.equal(w.creditKobo, 1_000_000); assert.equal(w.bonusLots.length, 1); assert.equal(w.bonusLots[0].kobo, 70_000);
  assert.equal((await db.doc(`walletTx/${s.reference}_topup`).get()).data()!.label, "Top-up via CardTap");
  assert.equal((await db.doc(`payments/${s.reference}`).get()).data()!.cardtap.lastVerify.state, "paid", "Paylony's answer is kept");

  // a refusal: failed, nothing credited
  verifyReply = { status: "00", data: { status: "pending" } };
  const f = await startCardtap(db, me, 2_000, "https://www.notesapp.name.ng");
  verifyReply = { status: "00", data: { status: "declined", amount: "2020" } };
  assert.equal((await checkCardtap(db, f.reference, "u_ada")).status, "failed");
  assert.equal((await checkCardtap(db, f.reference, "u_ada")).status, "failed", "and stays failed");
  assert.equal((await db.doc("wallets/u_ada").get()).data()!.creditKobo, 1_000_000);

  // the launch offer: the member pays only the top-up
  await setCardtapFeeWaived(db, true, "u_owner");
  const l = await startCardtap(db, me, 5_000, "https://www.notesapp.name.ng");
  assert.equal(l.payKobo, 500_000); assert.equal(l.waived, true); assert.equal(sent[sent.length - 1].body.amount, 5_000);
  await assert.rejects(startCardtap(db, me, 999, "https://x"), (e: unknown) => e instanceof CardtapError && e.status === 400, "₦1,000 at least");

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
