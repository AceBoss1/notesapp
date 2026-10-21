// CardTap wallet top-ups (lib/cardtap-topup.ts): Paylony's fee at cost, the launch offer, and reading Paylony's replies strictly.
// Run: npm run test:cardtap → "ALL OK".
import assert from "node:assert/strict";
import { CARDTAP_FEE_CAP_KOBO, cardtapFeeKobo, cardtapHealth, cardtapQuote, readStart, readVerify } from "../../lib/cardtap-topup";

const N = (n: number) => n * 100;
// 1% of the top-up, never more than ₦1,000
assert.equal(cardtapFeeKobo(N(1_000)), N(10)); assert.equal(cardtapFeeKobo(N(5_000)), N(50)); assert.equal(cardtapFeeKobo(N(10_000)), N(100));
assert.equal(cardtapFeeKobo(N(100_000)), N(1_000)); assert.equal(cardtapFeeKobo(N(500_000)), CARDTAP_FEE_CAP_KOBO, "capped at ₦1,000");
assert.equal(cardtapFeeKobo(N(1_050)), 1_050, "1% of ₦1,050 is ₦10.50"); assert.equal(cardtapFeeKobo(101), 2, "rounded up to the kobo");
assert.deepEqual(cardtapQuote(N(5_000), false), { topupKobo: N(5_000), feeKobo: N(50), waived: false, payKobo: N(5_050), absorbedKobo: 0 }, "at cost: the member pays the fee");
assert.deepEqual(cardtapQuote(N(5_000), true), { topupKobo: N(5_000), feeKobo: N(50), waived: true, payKobo: N(5_000), absorbedKobo: N(50) }, "launch offer: we pay it");

// the code for the app, wherever Paylony puts it
assert.deepEqual(readStart({ status: "00", initiationRef: "CT-123456", instruction: "Copy the code into CardTap" }), { initiationRef: "CT-123456", instruction: "Copy the code into CardTap" });
assert.deepEqual(readStart({ status: "00", data: { initiation_ref: 4455667788 } }), { initiationRef: "4455667788", instruction: "" });
assert.equal(readStart({ status: "07", message: "Incomplete request" }), null, "no code, no start");

// verifying: only a clear payment status, for at least what we asked, credits anything
const pay = N(5_050);
assert.equal(readVerify({ status: "00", data: { status: "successful", amount: "5050" } }, pay).state, "paid");
assert.equal(readVerify({ status: "00", payment_status: "success", amount: 5050 }, pay).state, "paid");
assert.equal(readVerify({ status: "00", data: { status: "pending", amount: "5050" } }, pay).state, "waiting");
assert.equal(readVerify({ status: "00", message: "success", amount: "5050" }, pay).state, "waiting", "the reply's own 00 isn't a payment");
assert.equal(readVerify({ status: "00" }, pay).state, "waiting", "a shape we don't know waits");
assert.equal(readVerify({ status: "00", data: { status: "successful" } }, pay).state, "waiting", "no amount, no credit");
assert.equal(readVerify({ status: "00", data: { status: "successful", amount: "50" } }, pay).state, "waiting", "less than asked isn't credited");
assert.equal(readVerify({ status: "00", data: { status: "failed", amount: "5050" } }, pay).state, "failed");
assert.equal(readVerify({ status: "00", data: { transaction_status: "declined" } }, pay).state, "failed");
assert.equal(readVerify("<html>Bad gateway</html>", pay).state, "waiting");

// /status: the latest attempt decides, with Paylony's reason in words
assert.deepEqual(cardtapHealth(null), { state: "operational", note: "no top-ups yet" });
assert.equal(cardtapHealth({ at: "x", ok: true }).state, "operational");
assert.deepEqual(cardtapHealth({ at: "x", ok: false, code: "19", meaning: "Invalid Merchant Authorization", httpStatus: 401 }), { state: "down", note: "the latest top-up couldn't start: Invalid Merchant Authorization" });
assert.equal(cardtapHealth({ at: "x", ok: false, httpStatus: 502 }).note, "the latest top-up couldn't start: Paylony answered 502");
assert.equal(cardtapHealth({ at: "x", ok: false, httpStatus: 0 }).note, "the latest top-up couldn't start: Paylony didn't answer");

console.log("ALL OK");
