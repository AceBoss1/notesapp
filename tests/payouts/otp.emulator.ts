// Paystack transfer OTP on payouts, against the Firestore emulator with a stubbed Paystack (lib/payouts.ts, lib/payout-otp-server.ts):
// a release that Paystack answers with status "otp" is stored as awaiting OTP with its transfer_code; a wrong OTP gives a clear message
// and counts a try; the right one finalizes and the payout follows the normal path; resend resets the clock; tries are capped;
// a non-admin is refused; the OTP is never written anywhere.
// Run: npm run test:payout-otp → "PAYOUT OTP OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { releaseLedgerEntry } from "../../lib/payouts";
import { cleanOtp, handlePayoutOtp, otpExpiresAt, otpFailureMessage, OTP_MAX_TRIES, type OtpDeps } from "../../lib/payout-otp-server";
import type { LedgerEntry } from "../../lib/payments";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const GOOD = "710522";

(async () => {
  // Pure bits
  assert.equal(cleanOtp(" 710 522 "), "710522");
  assert.throws(() => cleanOtp("71052"), /6-digit/);
  assert.throws(() => cleanOtp("abcdef"), /6-digit/);
  assert.equal(otpExpiresAt("2026-11-01T10:00:00.000Z"), "2026-11-01T10:30:00.000Z");
  assert.ok(!otpFailureMessage(new Error(`OTP ${GOOD} is invalid`), GOOD).includes(GOOD), "the code never comes back in a message");
  assert.match(otpFailureMessage(new Error("OTP has expired"), GOOD), /expired.*Resend OTP/);

  const ref = "na_1792347205354_f22d862a02cd";
  const ledger: LedgerEntry = {
    reference: ref, kind: "digital", publisherUid: "pub1", publisherUsername: "ada", payerUid: "buyer", grossKobo: 120000, commissionKobo: 24000, netKobo: 96000,
    status: "held", releaseAfter: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z",
  };
  await db.doc(`ledger/${ref}`).set(ledger);
  await db.doc("payoutAccounts/pub1").set({ recipientCode: "RCP_test", accountName: "Ada Obi" });

  // 1. Release: Paystack says "otp" → stored as awaiting OTP with the transfer_code, still "transferring" (can't be released twice).
  const r = await releaseLedgerEntry(ref, { transfer: async (p) => { assert.equal(p.reference, `payout_${ref}`); return { transfer_code: "TRF_otp1", status: "otp" }; } });
  assert.deepEqual(r, { ok: true, transferStatus: "otp" });
  let l = (await db.doc(`ledger/${ref}`).get()).data() as LedgerEntry;
  assert.equal(l.status, "transferring");
  assert.equal(l.awaitingOtp, true);
  assert.equal(l.transferCode, "TRF_otp1");
  assert.ok(l.otpSentAt);
  const again = await releaseLedgerEntry(ref, { transfer: async () => { throw new Error("must not be called"); } });
  assert.equal(again.ok, false);

  const calls: string[] = [];
  const admin = { uid: "fin1", name: "Finance Person" };
  const deps = (finalize: OtpDeps["finalize"]): Parameters<typeof handlePayoutOtp>[2] => ({
    verify: async (t) => { if (t !== "admin-token") throw new Error("not admin"); return admin; },
    finalize: async (code, otp) => { calls.push(`finalize:${code}`); return finalize(code, otp); },
    resend: async (code) => { calls.push(`resend:${code}`); return {}; },
    emit: async () => { calls.push("emit"); },
  });
  const paystack = deps(async (code, otp) => { if (otp !== GOOD) throw new Error("Invalid OTP"); return { status: "success", transfer_code: code }; });

  // 2. A non-admin is refused, and Paystack is never called.
  const no = await handlePayoutOtp(db, { token: "member-token", body: { action: "finalize", reference: ref, otp: GOOD } }, paystack);
  assert.equal(no.status, 403);
  assert.equal(calls.length, 0);

  // 3. A wrong OTP: a clear message, a try counted, still waiting.
  const bad = await handlePayoutOtp(db, { token: "admin-token", body: { action: "finalize", reference: ref, otp: "123456" } }, paystack);
  assert.equal(bad.status, 400);
  assert.match(String(bad.json.error), /didn't accept that OTP.*newest email/);
  l = (await db.doc(`ledger/${ref}`).get()).data() as LedgerEntry;
  assert.equal(l.awaitingOtp, true);
  assert.equal(l.otpTries, 1);
  // Not 6 digits: refused before Paystack.
  const short = await handlePayoutOtp(db, { token: "admin-token", body: { action: "finalize", reference: ref, otp: "12" } }, paystack);
  assert.equal(short.status, 400);
  assert.equal(calls.filter((c) => c.startsWith("finalize")).length, 1);

  // 4. Tries are capped per code; Resend OTP gives a fresh count and a fresh 30 minutes.
  for (let i = 1; i < OTP_MAX_TRIES; i++) await handlePayoutOtp(db, { token: "admin-token", body: { action: "finalize", reference: ref, otp: "000000" } }, paystack);
  const capped = await handlePayoutOtp(db, { token: "admin-token", body: { action: "finalize", reference: ref, otp: GOOD } }, paystack);
  assert.equal(capped.status, 429);
  assert.match(String(capped.json.error), /Resend OTP/);
  const later = new Date(Date.now() + 60_000);
  const rs = await handlePayoutOtp(db, { token: "admin-token", body: { action: "resend", reference: ref } }, paystack, later);
  assert.equal(rs.status, 200);
  assert.ok(calls.includes("resend:TRF_otp1"));
  l = (await db.doc(`ledger/${ref}`).get()).data() as LedgerEntry;
  assert.equal(l.otpTries, 0);
  assert.equal(l.otpSentAt, later.toISOString());
  assert.equal(rs.json.expiresAt, otpExpiresAt(later.toISOString()));

  // 5. The right OTP: finalized, paid out, who confirmed it recorded, the publisher's webhook sent.
  const ok = await handlePayoutOtp(db, { token: "admin-token", body: { action: "finalize", reference: ref, otp: GOOD } }, paystack);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.status, "success");
  l = (await db.doc(`ledger/${ref}`).get()).data() as LedgerEntry;
  assert.equal(l.status, "paid_out");
  assert.equal(l.awaitingOtp, false);
  assert.equal(l.otpConfirmedBy?.uid, "fin1");
  assert.ok(calls.includes("emit"));
  // Nothing left to finalize.
  const done = await handlePayoutOtp(db, { token: "admin-token", body: { action: "finalize", reference: ref, otp: GOOD } }, paystack);
  assert.equal(done.status, 409);

  // 6. Finalize that Paystack answers "failed": back to held with a reason, ready to release again.
  const ref2 = "na_2_fail";
  await db.doc(`ledger/${ref2}`).set({ ...ledger, reference: ref2 });
  await releaseLedgerEntry(ref2, { transfer: async () => ({ transfer_code: "TRF_otp2", status: "otp" }) });
  const failed = await handlePayoutOtp(db, { token: "admin-token", body: { action: "finalize", reference: ref2, otp: GOOD } }, deps(async () => ({ status: "failed" })));
  assert.equal(failed.status, 200);
  l = (await db.doc(`ledger/${ref2}`).get()).data() as LedgerEntry;
  assert.equal(l.status, "held");
  assert.match(l.failureReason ?? "", /failed/);

  // 7. A transfer without OTP is untouched by all this.
  const ref3 = "na_3_plain";
  await db.doc(`ledger/${ref3}`).set({ ...ledger, reference: ref3 });
  const plain = await releaseLedgerEntry(ref3, { transfer: async () => ({ transfer_code: "TRF_3", status: "pending" }) });
  assert.deepEqual(plain, { ok: true, transferStatus: "pending" });
  assert.notEqual(((await db.doc(`ledger/${ref3}`).get()).data() as LedgerEntry).awaitingOtp, true);

  // 8. Audit trail: who, what and the result, for every try. The OTP itself appears nowhere in the database.
  const log = (await db.collection("payoutOtpLog").where("reference", "==", ref).get()).docs.map((d) => d.data());
  assert.ok(log.length >= OTP_MAX_TRIES + 2);
  assert.ok(log.every((e) => e.adminUid === "fin1" && e.adminName === "Finance Person"));
  assert.ok(log.some((e) => e.action === "resend" && e.result === "sent"));
  assert.ok(log.some((e) => e.action === "finalize" && e.result === "success"));
  const everything = JSON.stringify([...(await db.collection("payoutOtpLog").get()).docs.map((d) => d.data()), ...(await db.collection("ledger").get()).docs.map((d) => d.data())]);
  assert.ok(!everything.includes(GOOD) && !everything.includes("123456"), "no OTP is stored");

  console.log("PAYOUT OTP OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
