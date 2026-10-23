// Topping up the NotesApp Credit wallet with Paylony CardTap (pure: the server side is lib/cardtap-topup-server.ts).
//
// How it works: the member picks an amount; we ask Paylony for a CardTap payment (POST /pay_with_cardtap) and show the code it
// returns. They open the CardTap app, paste or scan the code, tap their card and enter the PIN. Paylony tells our webhook, and
// the wallet page asks too (GET /verify_checkout_payment/{reference}); the credit is added once Paylony says it's paid.
// The fee is Paylony's own, at cost, with nothing added by us: 1% of the top-up, never more than ₦1,000, shown before paying.
// During the launch offer (Admin → Credits) we pay it instead, and the member pays only the top-up.
export const CARDTAP_FEE_RATE = 0.01;
export const CARDTAP_FEE_CAP_KOBO = 1_000 * 100;
export const CARDTAP_APP_URL = "https://play.google.com/store/apps/details?id=com.lonytech.cardtap";
export const CARDTAP_WAIT_MINUTES = 15; // how long the wallet page waits for the tap before suggesting a fresh code

export const cardtapFeeKobo = (topupKobo: number) => Math.min(CARDTAP_FEE_CAP_KOBO, Math.ceil(Math.max(0, topupKobo) * CARDTAP_FEE_RATE));
// What the member pays, and what it costs us.
export function cardtapQuote(topupKobo: number, waived: boolean) {
  const feeKobo = cardtapFeeKobo(topupKobo);
  return { topupKobo, feeKobo, waived, payKobo: topupKobo + (waived ? 0 : feeKobo), absorbedKobo: waived ? feeKobo : 0 };
}

// Paylony's replies, read without assuming more of their shape than the collection shows: a status ("00" is success, or the
// words success/successful/completed/approved), maybe inside `data`, and amounts in naira.
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const layers = (body: unknown): Obj[] => { const b = obj(body); return [b, obj(b.data), obj(obj(b.data).transaction), obj(b.transaction)]; };
export const pick = (body: unknown, keys: string[]): unknown => {
  for (const l of layers(body)) for (const k of keys) if (l[k] !== undefined && l[k] !== null && l[k] !== "") return l[k];
  return undefined;
};

// The code to paste into the CardTap app, and the words Paylony gives to go with it.
export function readStart(body: unknown): { initiationRef: string; instruction: string } | null {
  const ref = pick(body, ["initiationRef", "initiation_ref", "initiationReference", "initiation_reference", "paymentRef", "code"]);
  if (typeof ref !== "string" && typeof ref !== "number") return null;
  const instruction = pick(body, ["instruction", "instructions", "message"]);
  return { initiationRef: String(ref), instruction: typeof instruction === "string" ? instruction : "" };
}

const PAID = /^(success|successful|completed|complete|approved|paid)$/i;
const FAILED = /^(failed|declined|cancelled|canceled|reversed|expired|refunded)$/i;
// paid: a PAYMENT status (not the reply's own "00", which only means the request worked) says it went through, for at least
// what we asked; failed: it says it didn't; anything else, or a shape we don't recognise, is still waiting. Strict on purpose:
// a top-up is only credited on a clear yes, and the raw reply is kept on the payment so a new shape shows up in testing.
export function readVerify(body: unknown, payKobo: number): { state: "paid" | "failed" | "waiting"; paidKobo: number | null } {
  const [outer, ...inner] = layers(body);
  const said = [outer.payment_status, outer.paymentStatus, outer.transaction_status, ...inner.flatMap((l) => [l.payment_status, l.paymentStatus, l.transaction_status, l.status])]
    .filter((x) => typeof x === "string").map(String);
  const raw = pick(body, ["amount_paid", "amountPaid", "amount"]);
  const paidKobo = raw === undefined || Number.isNaN(Number(raw)) ? null : Math.round(Number(raw) * 100);
  if (said.some((x) => FAILED.test(x))) return { state: "failed", paidKobo };
  if (said.some((x) => PAID.test(x))) {
    if (paidKobo === null || paidKobo + 1 < payKobo) return { state: "waiting", paidKobo }; // no amount, or less than asked: don't credit
    return { state: "paid", paidKobo };
  }
  return { state: "waiting", paidKobo };
}

// What /status says about CardTap, from the outcome of the latest top-up attempt (paylonyConfig/cardtapLast, written by
// startCardtap). A refusal stays "down" until a top-up starts again, with Paylony's reason in a few words, never the reply itself.
export type CardtapLast = { at: string; ok: boolean; code?: string; meaning?: string; httpStatus?: number };
export function cardtapHealth(last: CardtapLast | null): { state: "operational" | "down"; note: string } {
  if (!last) return { state: "operational", note: "no top-ups yet" };
  if (last.ok) return { state: "operational", note: "the latest top-up started" };
  const why = last.meaning || (last.httpStatus ? `Paylony answered ${last.httpStatus}` : "Paylony didn't answer");
  return { state: "down", note: `the latest top-up couldn't start: ${why}` };
}
