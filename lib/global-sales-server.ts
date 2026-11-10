// Selling in your local currency, on the server (lib/global-sales.ts has the rules). The usual checkout (/api/paystack/initialize) and
// fulfilment (lib/payments.ts fulfillPayment) do the work; this adds the money side for a "global" payment:
//   saleQuote        what the buyer pays in their currency for an amount in the seller's
//   startSaleCheckout the provider's checkout page (Stripe, Flutterwave, or Paystack in naira)
//   confirmSale      asks the provider whether it's paid in full, in the right currency (called by fulfillPayment)
//   settleSale       after fulfilment: the sale's ledger entries leave the naira payout run ("global"), and what the seller earns is
//                    owed in globalEarnings in their currency, paid from the treasury (lib/global-pay-server.ts payOut)
//   refundSale       a whole refund through the provider that took the money
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { isCurrency, providerFor, toMajor, toMinor } from "./currency";
import { GLOBAL_HOLD_DAYS, GlobalPayError, ratesFresh, readerPrice } from "./global-pay";
import { getRates, type GlobalEarning } from "./global-pay-server";
import type { SaleGlobal } from "./global-sales";
import type { LedgerEntry, PaymentRecord } from "./payments";

export { GlobalPayError as SaleError };

// A seller's currency: the one they earn in (Rates & payouts), naira until they choose.
export async function sellerCurrency(db: Firestore, uid: string): Promise<string> {
  const c = (await db.doc(`publisherGlobal/${uid}`).get()).data()?.currency;
  return isCurrency(c) ? c : "NGN";
}

export async function saleQuote(db: Firestore, saleCurrency: string, payCurrency: string, saleMinor: number, now = new Date()): Promise<Omit<SaleGlobal, "backUrl" | "providerRef">> {
  if (!isCurrency(saleCurrency) || !isCurrency(payCurrency)) throw new GlobalPayError("Choose a currency to pay in.");
  if (!Number.isInteger(saleMinor) || saleMinor <= 0) throw new GlobalPayError("That price isn't valid.");
  const rates = await getRates(db);
  if (saleCurrency !== payCurrency && !ratesFresh(rates, now)) throw new GlobalPayError("Paying in this currency is paused for a moment while we update exchange rates. Please try again later, or pay in the seller's currency.", 503);
  const r = rates ?? { perUsd: { [payCurrency]: 1, [saleCurrency]: 1 }, marginPct: 0 };
  return {
    payCurrency, saleCurrency, provider: providerFor(payCurrency),
    payMinor: readerPrice(saleMinor, saleCurrency, payCurrency, r),
    rates: { pay: r.perUsd[payCurrency] ?? 1, sale: r.perUsd[saleCurrency] ?? 1 },
    marginPct: saleCurrency === payCurrency ? 0 : r.marginPct,
  };
}

// The provider's checkout. Comes back to /api/global/return?ref=…, which confirms it and opens backUrl.
export async function startSaleCheckout(
  siteUrl: string,
  p: { reference: string; email: string; title: string; cancelUrl: string; global: Omit<SaleGlobal, "backUrl" | "providerRef"> },
): Promise<{ url: string; providerRef?: string }> {
  const back = `${siteUrl}/api/global/return?ref=${encodeURIComponent(p.reference)}`;
  const g = p.global;
  if (g.provider === "stripe") {
    const { createCheckoutSession } = await import("./stripe");
    const s = await createCheckoutSession({ reference: p.reference, email: p.email, currency: g.payCurrency, amountMinor: g.payMinor, name: p.title, successUrl: `${back}&session_id={CHECKOUT_SESSION_ID}`, cancelUrl: p.cancelUrl });
    if (!s.url) throw new Error("Stripe didn't return a checkout link.");
    return { url: s.url, providerRef: s.id };
  }
  if (g.provider === "flutterwave") {
    const { createPayment } = await import("./flutterwave");
    return { url: (await createPayment({ reference: p.reference, email: p.email, name: p.email, currency: g.payCurrency, amountMajor: toMajor(g.payMinor, g.payCurrency), redirectUrl: back, title: p.title })).link };
  }
  const { initializeTransaction } = await import("./paystack");
  return { url: (await initializeTransaction({ email: p.email, amountKobo: g.payMinor, reference: p.reference, callbackUrl: back, metadata: { global: true, sale: true } })).authorization_url };
}

// Paid in full, in the buyer's currency? Throws when not (fulfillPayment then leaves the payment pending).
export type SaleConfirmation = { paid: boolean; currency: string; minor: number; providerRef?: string };
export async function providerConfirm(reference: string, g: SaleGlobal): Promise<SaleConfirmation> {
  if (g.provider === "stripe") {
    if (!g.providerRef) return { paid: false, currency: "", minor: 0 };
    const { getCheckoutSession } = await import("./stripe");
    const s = await getCheckoutSession(g.providerRef);
    return { paid: s.payment_status === "paid" && s.client_reference_id === reference, currency: String(s.currency ?? ""), minor: Number(s.amount_total ?? 0), providerRef: s.payment_intent ?? s.id };
  }
  if (g.provider === "flutterwave") {
    const { verifyByReference } = await import("./flutterwave");
    const tx = await verifyByReference(reference);
    return { paid: tx.status === "successful" && tx.tx_ref === reference, currency: tx.currency, minor: toMinor(tx.amount, tx.currency), providerRef: String(tx.id) };
  }
  const { verifyTransaction, pricePaidKobo } = await import("./paystack");
  const tx = await verifyTransaction(reference);
  return { paid: tx.status === "success", currency: tx.currency, minor: pricePaidKobo(tx), providerRef: reference };
}
export async function confirmSale(db: Firestore, p: PaymentRecord, confirm: typeof providerConfirm = providerConfirm): Promise<void> {
  const g = p.global;
  if (!g) throw new Error("Not a global payment.");
  const c = await confirm(p.reference, g);
  if (!c.paid) throw new Error("Payment not successful yet.");
  if (c.currency.toUpperCase() !== g.payCurrency || c.minor < g.payMinor) {
    await db.doc(`payments/${p.reference}`).update({ mismatch: { currency: c.currency, minor: c.minor, at: new Date().toISOString() } }).catch(() => {});
    throw new Error(`Paid amount does not match the price (expected ${g.payMinor} ${g.payCurrency}, got ${c.minor} ${c.currency}).`);
  }
  // Stripe: keep the payment intent for a refund (the checkout session was kept at checkout).
  if (c.providerRef && c.providerRef !== g.providerRef && g.provider !== "paystack") await db.doc(`payments/${p.reference}`).update({ "global.paymentRef": c.providerRef }).catch(() => {});
}

// After fulfilPayment wrote the sale's ledger entries ("held", as for any sale): they become "global" (so the naira payout run never
// pays them), and each seller's net is owed in their currency in globalEarnings, with the treasury pools told. The money came in once,
// on the payment the buyer paid (a basket's own record, or the single payment). Idempotent.
export async function settleSale(db: Firestore, reference: string, now = new Date()): Promise<number> {
  const p = (await db.doc(`payments/${reference}`).get()).data() as PaymentRecord | undefined;
  if (!p || p.payWith !== "global" || !p.global || (p.status !== "paid" && p.status !== "paid_slot_conflict")) return 0;
  const currency = p.currency ?? "NGN";
  const refs = new Set<string>();
  const direct = await Promise.all([reference, `${reference}_ship`].map((id) => db.doc(`ledger/${id}`).get()));
  for (const d of direct) if (d.exists) refs.add(d.id);
  for (const d of (await db.collection("ledger").where("paymentReference", "==", reference).get()).docs) refs.add(d.id);
  let n = 0;
  const at = now.toISOString();
  await db.runTransaction(async (t) => {
    const rows = await Promise.all([...refs].map((id) => t.get(db.doc(`ledger/${id}`))));
    const counted = await t.get(db.doc(`globalSaleIn/${p.cartRef ?? reference}`));
    for (const d of rows) {
      const e = d.data() as LedgerEntry;
      if (!e || e.status !== "held") continue;
      t.update(d.ref, { status: "global", currency });
      const earning: GlobalEarning = {
        reference: d.id, publisherUid: e.publisherUid, publisherUsername: e.publisherUsername, payerUid: e.payerUid, currency, minor: e.netKobo,
        status: "held", releaseAfter: new Date(Math.max(Date.parse(e.releaseAfter), now.getTime() + GLOBAL_HOLD_DAYS * 86_400_000)).toISOString(), createdAt: at,
      };
      t.set(db.doc(`globalEarnings/${d.id}`), { ...earning, sale: { kind: p.kind, paymentReference: reference } });
      t.set(db.doc(`treasuryPools/${currency}`), { currency, dueMinor: FieldValue.increment(e.netKobo) }, { merge: true });
      n++;
    }
    // The buyer's money arrives once per payment they made (a basket's orders share one).
    if (!counted.exists) {
      t.set(db.doc(`globalSaleIn/${p.cartRef ?? reference}`), { at, currency: p.global!.payCurrency, minor: p.global!.payMinor });
      t.set(db.doc(`treasuryPools/${p.global!.payCurrency}`), { currency: p.global!.payCurrency, inMinor: FieldValue.increment(p.global!.payMinor) }, { merge: true });
    }
  });
  return n;
}

// A whole refund of a global sale through its provider. Part refunds, and basket orders (one card payment shared by several orders), are
// refunded by Finance in the provider's dashboard and recorded, since Stripe and Flutterwave refunds here are all-or-nothing.
export async function refundSale(db: Firestore, p: PaymentRecord, amountKobo: number | undefined, now = new Date()): Promise<void> {
  const g = p.global;
  if (!g) throw new Error("Not a global payment.");
  if (p.cartRef) throw new Error(`This order was paid in ${g.payCurrency} as part of a basket: refund it in the ${g.provider} dashboard, then record it.`);
  if (amountKobo !== undefined && amountKobo < p.amountKobo) throw new Error(`Part refunds of payments in ${g.payCurrency} are made in the ${g.provider} dashboard, then recorded.`);
  const earnings = await db.collection("globalEarnings").where("sale.paymentReference", "==", p.reference).get();
  if (earnings.docs.some((d) => d.data().status === "paying" || d.data().status === "paid_out")) throw new Error("The seller has already been paid for this one (or is being paid): refund it by hand and record it.");
  const ref = g.paymentRef ?? g.providerRef;
  if (g.provider === "stripe") await (await import("./stripe")).refundPaymentIntent(String(ref), p.reference);
  else if (g.provider === "flutterwave") await (await import("./flutterwave")).refundTransaction(Number(ref));
  else await (await import("./paystack")).refundTransaction(p.reference);
  const batch = db.batch();
  for (const d of earnings.docs) {
    batch.update(d.ref, { status: "refunded", refundedAt: now.toISOString() });
    batch.set(db.doc(`treasuryPools/${d.data().currency}`), { currency: d.data().currency, dueMinor: FieldValue.increment(-Number(d.data().minor)) }, { merge: true });
  }
  batch.set(db.doc(`treasuryPools/${g.payCurrency}`), { currency: g.payCurrency, inMinor: FieldValue.increment(-g.payMinor) }, { merge: true });
  await batch.commit();
}
