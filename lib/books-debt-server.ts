import { randomBytes } from "crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { initializeTransaction, newReference } from "./paystack";
import { physicalCommissionRateFor } from "./tiers";
import { booksCaps } from "./pricing";
import { SITE_URL } from "./host";
import { notifyBell, sendEmail } from "./email";
import { getUserEmail } from "./firebase-admin";
import { makeTicketCode } from "./tickets";
import { BooksError, publicStatement, receiptUrl, statementUrl } from "./books-server";
import { debtAmount, debtCommissionKobo, firstName, lagosDay, naira, openKobo, settleFifo, type Entry } from "./books";
import type { AccountTier } from "./users";

// Paying a debt online (docs/BUSINESS-BOOKS.md: payment kind "debt", open question 5). A customer opens their statement link
// (/statement/<code>), taps Pay now, chooses all or part of what they owe, and pays by card or bank transfer through Paystack.
//
// - Start (POST /api/books/debt { action: "start" }): the amount is checked against what they owe now; a payments/{reference} record of
//   kind "debt" is written (amount, the seller as publisher, the commission rate fixed now) and Paystack's checkout opens, with only card
//   and bank transfer offered. No sign-in is needed: most customers aren't members. They give an email for Paystack and the receipt.
// - Paid (lib/payments.ts fulfillPayment, from the return page or Paystack's webhook, whichever lands first; it does the work once): in one
//   transaction, a "payment received" entry bookEntries/debt_<reference> (source online), applied to their oldest sales first, the
//   customer's balance down, their receipts updated, a receipt of the payment for the customer (bookReceipts/<code>), and the seller's money
//   in the payout ledger (ledger/<reference>, kind "debt"), held books.debtHoldDays (7) days like a sale, then paid out by the usual run.
// - Commission (lib/pricing.ts books.debtCommission): "store" (the default) takes the seller's normal physical-goods rate, the same rule as
//   a store sale; "none" takes nothing. Paystack's charges are ours, as on every sale.
// - Then: the seller gets an email and a bell; the customer gets the receipt link (email, and the bell if they're a member).
// - Paid more than is owed by the time it lands (they also paid cash meanwhile): all of it is recorded, what's owed is cleared, and the
//   seller is told how much extra came, to give back or keep as credit.
export type DebtInfo = { code: string; partyId: string; customer: string; shopName: string; ownerUid: string; receiptCode?: string; entryId?: string; overKobo?: number };
type Init = typeof initializeTransaction;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function startDebtPayment(db: Firestore, raw: { code?: unknown; amount?: unknown; email?: unknown; uid?: string }, now = new Date(), init: Init = initializeTransaction) {
  const code = String(raw.code ?? "").toUpperCase();
  const st = await publicStatement(db, code, now);
  if (!st) throw new BooksError(404, "That link isn't working.");
  const amt = debtAmount(raw.amount, st.owesKobo);
  if (!amt.ok) throw new BooksError(400, amt.error);
  const email = String(raw.email ?? "").trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(email)) throw new BooksError(400, "Enter your email address, for Paystack and your receipt.");
  const party = (await db.collection("bookParties").where("statementCode", "==", code).limit(1).get()).docs[0];
  const owner = (await db.doc(`users/${party.data().ownerUid}`).get()).data() ?? {};
  if (owner.suspended === true) throw new BooksError(409, "This shop can't take payments right now. Pay them the way you usually do.");
  const rule = booksCaps().debtCommission;
  const rate = rule === "none" ? 0 : physicalCommissionRateFor((owner.accountTier as AccountTier) || "basic", owner.customRates);
  const reference = newReference();
  const debt: DebtInfo = { code, partyId: party.id, customer: st.customer, shopName: st.shopName, ownerUid: String(party.data().ownerUid) };
  await db.doc(`payments/${reference}`).set({
    reference, kind: "debt", uid: raw.uid ?? "", email, amountKobo: amt.kobo, status: "pending", publisherUid: debt.ownerUid, publisherUsername: String(owner.username ?? ""),
    commissionRate: rate, debt, createdAt: now.toISOString(),
  });
  const r = await init({ email, amountKobo: amt.kobo, reference, callbackUrl: `${statementUrl(code)}?ref=${encodeURIComponent(reference)}`, metadata: { kind: "debt", shop: st.shopName, customer: st.customer }, channels: ["card", "bank_transfer"] });
  return { reference, url: r.authorization_url, amountKobo: amt.kobo };
}

// Inside fulfillPayment's transaction. Every read first (Firestore needs them before any write), then `write` does the writes.
export async function readDebt(t: Transaction, db: Firestore, p: { debt?: DebtInfo }) {
  const d = p.debt!;
  const partyRef = db.doc(`bookParties/${d.partyId}`);
  const party = await t.get(partyRef);
  const open = party.exists ? (await t.get(db.collection("bookEntries").where("ownerUid", "==", d.ownerUid).where("partyId", "==", d.partyId).where("open", "==", true))).docs.map((x) => ({ ...(x.data() as Omit<Entry, "id">), id: x.id })).filter((e) => openKobo(e) > 0) : [];
  const receipts = open.filter((e) => e.receiptCode);
  const rSnaps = receipts.length ? await t.getAll(...receipts.map((e) => db.doc(`bookReceipts/${e.receiptCode}`))) : [];
  const owner = (await t.get(db.doc(`users/${d.ownerUid}`))).data() ?? {};
  return { partyRef, party, open, rSnaps, owner };
}
export function writeDebt(t: Transaction, db: Firestore, p: { reference: string; amountKobo: number; commissionRate: number; uid: string; publisherUid: string; publisherUsername: string; debt?: DebtInfo }, r: Awaited<ReturnType<typeof readDebt>>, nowIso: string): DebtInfo {
  const d = p.debt!;
  const amount = p.amountKobo;
  const { applied, overKobo } = settleFifo(r.open.map((e) => ({ id: e.id, at: e.at, openKobo: openKobo(e) })), amount);
  for (const a of applied) {
    const e = r.open.find((x) => x.id === a.id)!;
    const settled = (e.settledKobo || 0) + a.kobo;
    t.update(db.doc(`bookEntries/${e.id}`), { settledKobo: settled, open: settled < e.owesKobo });
    const rs = r.rSnaps.find((s) => s.id === e.receiptCode);
    if (rs?.exists) t.update(rs.ref, { owesKobo: e.owesKobo - settled, paidKobo: e.paidKobo + settled });
  }
  const owedBefore = r.open.reduce((n, e) => n + openKobo(e), 0);
  if (r.party.exists) t.update(r.partyRef, { balanceKobo: Math.max(0, (Number(r.party.data()?.balanceKobo) || 0) - (amount - overKobo)), lastPaidAt: nowIso });
  const on = lagosDay(new Date(nowIso));
  const entryId = `debt_${p.reference}`;
  const partyName = String(r.party.data()?.name ?? d.customer);
  t.set(db.doc(`bookEntries/${entryId}`), {
    ownerUid: d.ownerUid, kind: "payment", source: "online", on, at: nowIso, by: "online", lines: [], totalKobo: amount, paidKobo: amount, method: "card",
    owesKobo: 0, settledKobo: 0, open: false, partyId: d.partyId, partyName, applied, files: [], counts: false, paymentRef: p.reference, note: "Paid online from the statement link",
    ...(overKobo ? { overKobo } : {}),
  });
  // The customer's receipt of this payment.
  const code = makeTicketCode((n) => randomBytes(n));
  t.set(db.doc(`bookReceipts/${code}`), {
    ownerUid: d.ownerUid, entryId, shopName: d.shopName, shopUsername: p.publisherUsername, shopLogo: String(r.owner.avatar ?? ""),
    lines: [{ title: "Payment towards what you owe", qty: 1, unitKobo: amount }], totalKobo: amount, paidKobo: amount, owesKobo: Math.max(0, owedBefore - amount),
    method: "card", on, at: nowIso, customer: firstName(partyName), voided: false, online: true, paymentRef: p.reference,
  });
  // The seller's money: held, then paid out like a sale.
  const commissionKobo = debtCommissionKobo(amount, p.commissionRate, p.commissionRate > 0 ? "store" : "none");
  t.set(db.doc(`ledger/${p.reference}`), {
    reference: p.reference, kind: "debt", publisherUid: p.publisherUid, publisherUsername: p.publisherUsername, payerUid: p.uid,
    grossKobo: amount, commissionKobo, netKobo: amount - commissionKobo, status: "held",
    releaseAfter: new Date(Date.parse(nowIso) + booksCaps().debtHoldDays * 86_400_000).toISOString(), createdAt: nowIso,
  });
  return { ...d, receiptCode: code, entryId, ...(overKobo ? { overKobo } : {}) };
}

// After it's paid: the seller hears (email and bell), the customer gets the receipt link.
export async function notifyDebtPaid(p: { reference: string; amountKobo: number; email: string; uid: string; publisherUid: string; debt?: DebtInfo }, send = sendEmail) {
  const d = p.debt;
  if (!d) return;
  const link = d.receiptCode ? receiptUrl(d.receiptCode) : statementUrl(d.code);
  const extra = d.overKobo ? ` That's ${naira(d.overKobo)} more than they owed, so give it back or keep it as their credit.` : "";
  const sellerMsg = `${d.customer} paid ${naira(p.amountKobo)} of what they owe you, online. It's recorded in your books.${extra}`;
  const to = await getUserEmail(p.publisherUid);
  const bell = { uid: p.publisherUid, type: "books" as const, linkHref: "/profile/books?tab=owed", message: sellerMsg };
  if (to) await send({ to, subject: `${d.customer} paid ${naira(p.amountKobo)} online`, text: `${sellerMsg}\n\nThe money is held for a few days like a store sale, then paid to your bank with your other earnings.\nReference: ${p.reference}\n\n#NotesApp`, action: { label: "See money owed", url: `${SITE_URL}/profile/books?tab=owed` }, bell }).catch(() => false);
  else await notifyBell(bell).catch(() => {});
  if (p.email) await send({ to: p.email, subject: `Your payment to ${d.shopName}: ${naira(p.amountKobo)}`, text: `Thank you, ${d.customer}. ${d.shopName} has received your payment of ${naira(p.amountKobo)}.\n\nYour receipt: ${link}\nWhat you still owe: ${statementUrl(d.code)}\n\nSent with #NotesApp Business books.`, action: { label: "See your receipt", url: link } }).catch(() => false);
  if (p.uid) await notifyBell({ uid: p.uid, type: "books", linkHref: d.receiptCode ? `/receipt/${d.receiptCode}` : `/statement/${d.code}`, message: `Your payment of ${naira(p.amountKobo)} to ${d.shopName} went through. Here's your receipt.` }).catch(() => {});
}

// The return page (and a check from the statement): confirm with Paystack (fulfillPayment) and say how it went.
export async function checkDebtPayment(db: Firestore, code: string, reference: string, fulfil: (ref: string) => Promise<{ status: string; debt?: DebtInfo }>) {
  const p = (await db.doc(`payments/${reference}`).get()).data();
  if (!p || p.kind !== "debt" || p.debt?.code !== code.toUpperCase()) throw new BooksError(404, "Payment not found.");
  const done = p.status === "pending" ? await fulfil(reference).catch((e) => { if (!/not successful/i.test(String((e as Error)?.message))) console.error("debt verify", reference, e); return { status: "pending" } as { status: string; debt?: DebtInfo }; }) : (p as { status: string; debt?: DebtInfo });
  return { status: done.status, amountKobo: Number(p.amountKobo), receiptUrl: done.debt?.receiptCode ? receiptUrl(done.debt.receiptCode) : null };
}
