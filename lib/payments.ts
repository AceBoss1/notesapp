import { FieldValue } from "firebase-admin/firestore";
import type { SaleGlobal } from "./global-sales";
import { confirmSale, settleSale } from "./global-sales-server";
import { verifyCheckoutPayment } from "./paylony";
import { readVerify } from "./cardtap-topup";
import { emitWebhook } from "./webhooks";
import { getAdminDb, getUserEmail } from "./firebase-admin";
import { slotLockId, verifyTransaction, pricePaidKobo, disableSubscription } from "./paystack";
import { commissionRateFor } from "./tiers";
import { ensurePricing } from "./pricing-server";
import { sessionEnd, sessionStart, formatSlot, formatNaira } from "./booking-time";
import { formatNaira as nairaText } from "./booking-time";
import { moneyIn } from "./global-sales";
import { notifyBell, sendEmail } from "./email";
import type { AccountTier } from "./users";
import { getBoostPackage } from "./boost-config";
import { periodEndFrom, cancelBadgeIfCovered, findPaystackSubscription } from "./tier-billing";
import { tierOf, tierRate, type SubTier } from "./fans";
import { addFanPoints, getFanSettings } from "./fans-server";
import { ESCROW_PLACEHOLDER_DAYS, newParcelId, phoneLast4 } from "./orders";
import { merchParcelDoc } from "./orders-server";
import { creditTopup } from "./wallet-server";
import { addNanaCredit } from "./nana-meter";
import { issueInTransaction } from "./certificates-server";
import { courseShares, fulfilCourseInTransaction, type SaleShare } from "./course-sales-server";
import { extendAddon, type Carrier } from "./logistics-server";
import { extendInventoryAddon, lowStockAlert, recordSale } from "./inventory-server";
import { bookOnlineOrder } from "./books-server";
import { notifyDebtPaid, readDebt, writeDebt, type DebtInfo } from "./books-debt-server";
import { SITE_URL } from "@/lib/host";
import { grantPackInTransaction } from "./exam-prep-server";
import { EXAMS, type ExamId } from "./exam-prep";
import { readCodeForRedemption, writeRedemption, type PaymentDiscount } from "./discounts-server";
import { writeGiftReceipt } from "./giving-server";
import { announceGrandGift, readGiftDaily, readGiftTallies, writeGiftDaily, writeGiftShow, writeGiftTallies, type TallyInput } from "./gifts-server";
import { upliftedRate, type GiftContext, type GiftMotif, type GiftToKind } from "./gift-catalogue";
import { givingReleaseAfter } from "./giving";
import { readForTickets, writeTickets } from "./tickets-server";
import { notifyLiveTicket, readForLiveTicket, refundLiveTicketToCredit, writeLiveTicket } from "./live-tickets-server";
import { alertIfJump, recordPlanEarning, startReferralSubscription, writeProductEarning, type PaymentAffiliate } from "./referrals-server";
import { handleOf, postRoomEvent } from "./room-events-server";

// Server-only. All money-state changes happen here, via the Admin SDK
// (Firestore rules make payments/bookings/ledger/subscriptions
// unwritable from browsers).

export type PaymentRecord = {
  reference: string;
  kind: "booking" | "subscription" | "boost" | "gift" | "tier" | "badge" | "gold_deposit" | "gold" | "merch" | "ad" | "store" | "digital" | "wallet_topup" | "life_naira" | "nana_credit" | "certificate" | "course" | "logistics_addon" | "inventory_addon" | "store_cart" | "exam_pack" | "giving" | "ticket" | "debt" | "live_ticket" | "ppm";
  uid: string; // the payer ("" for a customer paying a debt from their statement link without signing in)
  email: string;
  amountKobo: number;
  status: "pending" | "paid" | "paid_slot_conflict" | "refunded";
  publisherUid: string;
  publisherUsername: string;
  commissionRate: number; // NotesApp's cut, 0–1, fixed at checkout time
  booking?: { username: string; date: string; slot: string; minutes: number };
  subscription?: { username: string; planCode: string; tier?: SubTier }; // tier: lib/fans.ts (Premium when missing)
  boost?: { noteId?: string; itemId?: string; packageId: string }; // a post, or a store item
  // referralFirst: a referred friend's first plan (lib/referrals.ts firstPeriodOffer): the card check or the year less a month now,
  // and the plan's subscription started on Paystack for the end of that first period.
  // couponFirst: a #NotesApp code on the first payment (lib/discounts.ts "plan"): that period at the lower price now, and the
  // subscription started on Paystack for its end in the same way.
  tier?: { tier: "pro" | "business"; interval: "monthly" | "annually"; planCode: string; referralFirst?: boolean; couponFirst?: boolean };
  // An affiliate link brought this sale (lib/referrals-server.ts): their share, taken out of the publisher's net.
  affiliate?: PaymentAffiliate;
  badge?: { planCode: string };
  ad?: { campaignId: string; packageId: string };
  merch?: {
    itemId: string;
    itemName: string;
    logoId: string;
    logoLabel: string;
    size?: string;
    quantity: number;
    unitKobo: number;
    deliveryKobo: number;
    batchId: string;
    address: { fullName: string; phone: string; street: string; city: string; state: string };
  };
  store?: {
    itemId: string;
    itemTitle: string;
    itemImage: string;
    quantity: number;
    // For an item with options: the chosen combination ("XL|Red") and how to show it ("Size: XL, Colour: Red").
    variant?: string;
    variantLabel?: string;
    unitKobo: number;
    discountKobo?: number; // taken off the goods by a discount code (the delivery is never discounted)
    deliveryKobo: number;
    address: { fullName: string; phone: string; street: string; city: string; state: string };
    // Delivered by the store's delivery partner (lib/logistics.ts): deliveryKobo is the partner's fee from its rate card, paid to the
    // partner less our cut (its own ledger entry), not to the store.
    carrier?: Carrier;
  };
  // A downloadable file from a publisher's store: instant, final once downloaded.
  digital?: { itemId: string; itemTitle: string; itemImage: string };
  course?: { courseId: string; courseTitle: string; courseSlug: string }; // a paid course (lib/course-sales-server.ts)
  gold?: { kind: "endorsement" | "identity"; track: "personal" | "corporate"; planCode?: string };
  // animId/animName: an animated gift from the catalogue (lib/gift-catalogue.ts), its price fixed at checkout. liveId: sent during a live.
  // uplift: the premium or VIP gift's extra share of the commission rate, fixed at checkout (commissionRate already includes it).
  // quantity: N of one animated gift sent as one payment (amountKobo is N × the catalogue price); toKind and context: who it was for
  // and where it was sent (gifting everywhere, v0.140.0). Older gifts have none of these (one gift, to the creator).
  gift?: { username: string; noteId?: string; noteSlug?: string; message: string; anonymous: boolean; senderName: string; animId?: GiftMotif; animName?: string; liveId?: string; uplift?: number; quantity?: number; toKind?: GiftToKind; context?: GiftContext; mediaId?: string; replayId?: string };
  // A basket (lib/cart.ts): the payment Paystack charges lists its orders; each order is an ordinary "store" payment carrying cartRef.
  // The basket's own record carries no money of its own in reports (its orders do).
  cart?: { orders: string[] };
  cartRef?: string;
  // Store orders reserve stock while the buyer pays; an unpaid reservation is returned later.
  reservedUntil?: string;
  reservationReleased?: boolean;
  // A discount code used on this purchase (lib/discounts-server.ts): amountKobo is already the lower price; fullKobo is what it
  // would have been. On a basket it sits on the basket's own record, and each order carries its share in store.discountKobo.
  discount?: PaymentDiscount;
  createdAt: string;
  paidAt?: string;
  // Paid from the NotesApp Credit wallet instead of Paystack (lib/wallet-server.ts): what was taken, and how much has gone back.
  // "cardtap": a wallet top-up paid with Paylony CardTap (lib/cardtap-topup-server.ts), confirmed with Paylony instead of Paystack.
  // "global": paid through Stripe, Flutterwave or Paystack in the buyer's currency, for something priced in the seller's own currency
  // (lib/global-sales-server.ts). Then `currency` is the seller's currency (every amount on this record is in its minor units, despite
  // the "Kobo" names; NGN when absent) and `global` is what the buyer paid and through whom.
  payWith?: "wallet" | "cardtap" | "global";
  currency?: string;
  global?: SaleGlobal;
  // CardTap: Paylony's fee (1%, at most ₦1,000), whether we paid it (the launch offer), what the member pays, the code for the app,
  // and Paylony's last answer about it (kept so a reply we don't recognise can be seen).
  cardtap?: { feeKobo: number; waived: boolean; payKobo: number; initiationRef?: string; lastVerify?: { at: string; state: string; body: string } };
  walletDebit?: { creditKobo: number; bonusKobo: number };
  walletRefundedKobo?: number;
  // A wallet top-up: the Bonus Credits it adds (fixed at checkout), and how much of it was later refunded to the card.
  topup?: { bonusKobo: number };
  // A Nana credit pack (lib/nana-meter.ts): which pack, and the AI credit it adds (fixed at checkout).
  nanaPack?: { packId: string; name: string; creditKobo: number };
  examPack?: { pack: ExamId; forUid: string; months: number; via: "self" | "paylink"; payLink?: string }; // Naija Exam Prep (lib/exam-prep-server.ts)
  // A Notes Academy certificate (lib/certificates-server.ts): the course, the name to print, the price fixed at checkout and the
  // teacher's part of it (their margin and its share of any late claim fee); issuedId once it's issued.
  certificate?: { courseId: string; courseTitle: string; learnerName: string; startKobo: number; lateKobo: number; teacherKobo: number; issuedId?: string };
  topupReversedKobo?: number;
  // A gift to a community (lib/giving.ts): the fund, the note, the charges fixed at checkout and what the community receives. amountKobo is
  // what the giver paid (the gift, plus the charges when they covered them). publisherUid is the community's owner.
  giving?: { cid: string; communityName: string; fund: string; note: string; anonymous: boolean; giverName: string; giftKobo: number; bandKobo: number; cardChargeKobo: number; netKobo: number; covered: boolean };
  // Paid event tickets (lib/tickets.ts): the type, how many, and the occurrence they are for. publisherUid is the event's host.
  // bandKobo / cardChargeKobo / netKobo: the charges fixed at checkout (lib/tickets.ts quoteTickets, since v0.117.0); a ticket bought
  // before then has none and keeps the commission recorded in commissionRate.
  ticket?: { eventId: string; eventTitle: string; typeId: string; typeName: string; quantity: number; unitKobo: number; startsAt: string; endsAt: string; holderName: string; bandKobo?: number; cardChargeKobo?: number; netKobo?: number };
  // A customer paying what they owe a Business books seller (lib/books-debt-server.ts): whose statement, which customer, and once paid
  // the payment's entry and the customer's receipt. publisherUid is the seller.
  debt?: DebtInfo;
  // A ticket to a member's paid live (lib/live-tickets.ts): the band and list price, the subscriber discount (their tier's, capped), and
  // the commission share fixed now (commissionRate is the host's rate plus upliftPct % of it). publisherUid is the host.
  liveTicket?: LiveTicketInfo;
  // A pay-per-minute session's charge (lib/ppm-server.ts): written when the call ends, paid from the credit held at booking
  // (payWith "wallet", walletDebit = the charge), so a refund goes back to the wallet like any wallet payment. publisherUid is the host.
  ppm?: PpmPaymentInfo;
};
export type PpmPaymentInfo = { sessionId: string; kind: "voice" | "video"; perMinuteKobo: number; billedMinutes: number; heldKobo: number; baseRate: number; upliftPct: number };
export type LiveTicketInfo = { eventId: string; eventTitle: string; startsAt: string; band: "early" | "normal" | "late"; listKobo: number; discountPct: number; tier?: SubTier; holderName: string; baseRate: number; upliftPct: number };

// held      = collected, waiting for releaseAfter (session end / dispute window)
// disputed  = admin froze it (no-show, complaint)
// transferring / paid_out = payout to the publisher's bank
// refunded  = returned to the payer
// withdrawn = a gift's share the receiver withdrew: it is paid through the "gift_payout" entry named in withdrawalId
//             (lib/gift-earnings-server.ts), so it is never paid or refunded on its own
// global    = a sale paid in another currency (lib/global-sales-server.ts): kept for the seller's history and reports, never paid by the
//             naira payout run; its money is owed in globalEarnings (the seller's currency) and paid from the treasury.
export type LedgerStatus = "held" | "disputed" | "transferring" | "paid_out" | "refunded" | "withdrawn" | "global";

export type LedgerEntry = {
  currency?: string; // a global sale's seller currency (the amounts are its minor units); naira when absent
  reference: string; // ledger doc id (the payment reference, or `<ref>_<uid>` for a co-author's share)
  paymentReference?: string; // the Paystack payment this entry belongs to (set on split entries)
  sharePercent?: number; // this author's % of a co-authored post's gift
  kind: "booking" | "subscription" | "gift" | "adshare" | "order" | "digital" | "certificate" | "course" | "shipping" | "affiliate" | "giving" | "ticket" | "debt" | "gift_payout" | "live_ticket" | "ppm";
  // Gift withdrawals (lib/gift-earnings-server.ts): a "gift_payout" entry carries how many gifts it gathered and, from the
  // withdrawal line up, needsApproval (it waits for a person to release it); each gathered gift entry carries withdrawalId.
  withdrawalOf?: number;
  needsApproval?: boolean;
  withdrawalId?: string;
  withdrawnAt?: string;
  // Paid-live tickets (lib/live-tickets.ts): true until the live ends (lib/live-door-server.ts markLiveEnded), so nothing is paid out
  // while the live hasn't happened; releaseAfter is then the end, and the payout waits PAYOUT_HOLD_HOURS more.
  awaitingLive?: boolean;
  cardChargeKobo?: number; // giving and tickets by card: Paystack's charge at cost, passed on (grossKobo is already after it)
  affiliateKobo?: number; // an affiliate's share of this sale, already taken out of netKobo
  publisherUid: string;
  publisherUsername: string;
  payerUid: string;
  grossKobo: number;
  commissionKobo: number;
  netKobo: number;
  status: LedgerStatus;
  releaseAfter: string; // ISO — earliest a payout may be released
  createdAt: string;
  transferCode?: string;
  // Paylony payouts: which provider sent it, the reference we gave it (it can be asked about by that reference), when, and how
  // many Paylony attempts have already failed (a failed transfer's reference can't be reused, so each retry gets a new one).
  transferProvider?: "paystack" | "paylony";
  transferReference?: string;
  transferStartedAt?: string;
  paylonyAttempts?: number;
  failureReason?: string;
  // Paystack with "Transfers OTP" on: the transfer exists (transferCode) but waits for the OTP Paystack emailed the business. Shown as
  // "Awaiting OTP" on /admin/payments; the status stays "transferring" so it can't be released twice. Never holds the OTP itself.
  awaitingOtp?: boolean;
  otpSentAt?: string; // when Paystack sent the current OTP (the transfer was made, or Resend OTP); it lasts PAYSTACK_OTP_MINUTES
  otpTries?: number; // codes tried since that OTP was sent (lib/payout-otp-server.ts caps them)
  otpResends?: number;
  otpConfirmedBy?: { uid: string; name: string; at: string };
};

// A delivery partner's share of a store order: its own ledger entry next to the store's.
export const shippingRef = (reference: string) => `${reference}_ship`;

const SUBSCRIPTION_HOLD_DAYS = 7; // dispute window before subscription earnings can be paid out
export const DIGITAL_HOLD_DAYS = 7; // same window before a digital sale is paid out (a purchase is final once downloaded)
const PERIOD_DAYS = 31;

export { commissionRateFor };

function ledgerFor(p: PaymentRecord, grossKobo: number, releaseAfter: Date, now: string): LedgerEntry {
  const commissionKobo = Math.round(grossKobo * p.commissionRate);
  const affiliateKobo = p.affiliate?.kobo ?? 0;
  return {
    reference: p.reference,
    kind: p.kind as LedgerEntry["kind"], // boosts never reach the ledger
    publisherUid: p.publisherUid,
    publisherUsername: p.publisherUsername,
    payerUid: p.uid,
    grossKobo,
    commissionKobo,
    netKobo: grossKobo - commissionKobo - affiliateKobo,
    ...(affiliateKobo ? { affiliateKobo } : {}),
    status: "held",
    releaseAfter: releaseAfter.toISOString(),
    createdAt: now,
  };
}

// Who shares a gift. A gift on a co-authored post is divided between the lead
// and the accepted co-authors in the percentages agreed before publishing
// (coAuthorInvites); each author's portion carries THEIR OWN plan's commission.
// Anything else (no post, no co-authors) is 100% the publisher's.
type Share = { uid: string; username: string; percent: number; rate: number };
async function giftShares(p: PaymentRecord): Promise<Share[]> {
  const lead: Share = { uid: p.publisherUid, username: p.publisherUsername, percent: 100, rate: p.commissionRate };
  const noteId = p.gift?.noteId;
  if (!noteId) return [lead];
  const db = getAdminDb();
  const inv = await db.collection("coAuthorInvites").where("noteId", "==", noteId).where("status", "==", "accepted").get();
  const co: Share[] = [];
  for (const d of inv.docs) {
    const i = d.data();
    if (!(Number(i.percent) > 0)) continue; // a view-only reviewer credited without a share
    const u = (await db.doc(`users/${i.inviteeUid}`).get()).data();
    if (!u || u.suspended) continue; // their share stays with the lead
    const own = commissionRateFor((u.accountTier as AccountTier) || "basic", u.customRates);
    co.push({ uid: i.inviteeUid, username: i.inviteeUsername, percent: Number(i.percent), rate: p.gift?.uplift ? upliftedRate(own, p.gift.uplift) : own });
  }
  if (!co.length) return [lead];
  lead.percent = 100 - co.reduce((s, c) => s + c.percent, 0);
  return [lead, ...co];
}

// Idempotent — called by the redirect-verify route and the webhook,
// in whichever order they land. Confirms with Paystack itself, checks
// the amount against what we recorded server-side, then writes
// everything in one transaction.
// Paylony hasn't confirmed a CardTap payment (yet): state "waiting" while the member is still tapping, "failed" when it said no.
export class CardtapNotPaid extends Error {
  constructor(public state: "waiting" | "failed") { super(state === "failed" ? "The CardTap payment didn't go through." : "Waiting for the CardTap payment."); }
}
async function confirmCardtap(payRef: FirebaseFirestore.DocumentReference, payment: PaymentRecord): Promise<void> {
  const r = await verifyCheckoutPayment(payment.reference);
  const v = readVerify(r.body, payment.cardtap?.payKobo ?? payment.amountKobo);
  const body = (typeof r.body === "string" ? r.body : JSON.stringify(r.body)).slice(0, 1500);
  await payRef.update({ "cardtap.lastVerify": { at: new Date().toISOString(), state: v.state, body } }).catch(() => {});
  if (v.state !== "paid") throw new CardtapNotPaid(v.state);
}

// `paidWith`: one order of a basket, settled by fulfillPayment of the basket (lib/cart.ts), whose Paystack payment was just checked;
// the order itself was never charged on its own, so there is nothing to ask Paystack about it.
export async function fulfillPayment(reference: string, paidWith?: { cartRef: string }): Promise<PaymentRecord> {
  await ensurePricing();
  const db = getAdminDb();
  const payRef = db.doc(`payments/${reference}`);
  const snap = await payRef.get();
  if (!snap.exists) throw new Error("Unknown payment reference");
  const payment = snap.data() as PaymentRecord;
  if (payment.status !== "pending") return payment;

  // A wallet payment was taken from the wallet when it was started (payFromWallet), so there is nothing to ask Paystack.
  // A CardTap top-up is asked of Paylony instead, and stays pending (CardtapNotPaid) until Paylony clearly says it's paid.
  if (payment.payWith === "cardtap") await confirmCardtap(payRef, payment);
  if (paidWith && payment.cartRef !== paidWith.cartRef) throw new Error("That order isn't part of this basket.");
  // A payment in another currency (lib/global-sales-server.ts) is asked of the provider that took it (a basket's orders: their basket was).
  if (payment.payWith === "global" && !paidWith) await confirmSale(db, payment);
  const tx = payment.payWith === "wallet" || payment.payWith === "cardtap" || payment.payWith === "global" || paidWith ? null : await verifyTransaction(reference);
  if (tx && tx.status !== "success") throw new Error(`Payment not successful (${tx.status})`);
  if (tx && (pricePaidKobo(tx) !== payment.amountKobo || tx.currency !== "NGN")) {
    // Keep the evidence (a plan-based charge uses the PLAN's amount, so a stale
    // plan shows up here) and say exactly what differed.
    const detail = { kind: payment.kind, expectedKobo: payment.amountKobo, paidKobo: tx.amount, requestedKobo: tx.requested_amount ?? null, feesKobo: tx.fees ?? null, currency: tx.currency };
    console.error("Paystack amount mismatch", reference, detail);
    await payRef.update({ mismatch: { ...detail, at: new Date().toISOString() } }).catch(() => {});
    throw new Error(
      `Paid amount does not match the price (expected ${formatNaira(payment.amountKobo)}, Paystack charged ${formatNaira(pricePaidKobo(tx))} ${tx.currency}).`
    );
  }

  // A basket: its orders are settled one by one (each as a single item would be: order, parcel, held money), then the basket itself is
  // marked paid. Run again after a failure part-way, the orders already settled are left as they are.
  if (payment.kind === "store_cart") {
    for (const order of payment.cart?.orders ?? []) await fulfillPayment(order, { cartRef: reference });
  }

  const now = new Date().toISOString();
  const shares = payment.kind === "gift" ? await giftShares(payment) : [];
  const courseSplit: SaleShare[] = payment.kind === "course" ? await courseShares(db, payment) : [];
  const result = await db.runTransaction(async (t) => {
    const freshPay = await t.get(payRef);
    const current = freshPay.data() as PaymentRecord;
    if (current.status !== "pending") return { payment: current, fresh: false };
    // A discount code's running totals: read now (every read comes before any write), written with the paid status below.
    const codeRead = await readCodeForRedemption(t, db, current.discount);
    const ticketRead = current.kind === "ticket" && current.ticket ? await readForTickets(t, db, current) : null;
    const debtRead = current.kind === "debt" && current.debt ? await readDebt(t, db, current) : null;
    const liveRead = current.kind === "live_ticket" && current.liveTicket ? await readForLiveTicket(t, db, current) : null;
    // A subscription replaces the subscriber's record with this creator (a tier change carries the days left over).
    const subPrev = current.kind === "subscription" && current.subscription ? (await t.get(db.doc(`subscriptions/${current.uid}_${current.subscription.username}`))).data() : undefined;

    if (current.kind === "booking" && current.booking) {
      const { username, date, slot, minutes } = current.booking;
      const lockRef = db.doc(`slotLocks/${slotLockId(username, date, slot)}`);
      const bRef = db.doc(`bookings/${reference}`);
      const existing = await t.get(lockRef);
      if (existing.exists && existing.data()?.reference !== reference) {
        // Someone else's payment claimed this slot first. Money is
        // taken, so flag it for an admin refund rather than lose it.
        t.update(payRef, { status: "paid_slot_conflict", paidAt: now });
        return { payment: { ...current, status: "paid_slot_conflict" as const, paidAt: now }, fresh: true };
      }
      t.set(lockRef, { reference, createdAt: now });
      t.set(bRef, {
        username,
        date,
        slot,
        minutes,
        publisherUid: current.publisherUid,
        clientUid: current.uid,
        clientEmail: current.email,
        reference,
        amountKobo: current.amountKobo,
        startsAt: sessionStart(date, slot).toISOString(),
        status: "confirmed",
        reminder24Sent: false,
        reminder1Sent: false,
        createdAt: now,
      });
      t.set(db.doc(`ledger/${reference}`), ledgerFor(current, current.amountKobo, sessionEnd(date, slot, minutes), now));
    } else if (current.kind === "store" && current.store) {
      // Physical goods: the order + its parcel are created now; the seller's money is
      // held (far-future releaseAfter) until the buyer confirms delivery or the
      // auto-release timer set when the parcel is marked delivered runs out.
      const st = current.store;
      const itemRef = db.doc(`storeItems/${st.itemId}`);
      const item = (await t.get(itemRef)).data();
      const seller = (await t.get(db.doc(`users/${current.publisherUid}`))).data();
      const parcelId = newParcelId();
      const goodsKobo = st.unitKobo * st.quantity - (st.discountKobo ?? 0); // commission on what the buyer paid for the goods
      const commissionKobo = Math.round(goodsKobo * current.commissionRate);
      // Stock was reserved when checkout started. If that reservation was already given
      // back (the buyer paid very late), take it again — or, if it's gone, flag a refund.
      if (current.reservationReleased) {
        const vs = st.variant && item?.variantStock ? (item.variantStock as Record<string, number>) : null;
        const stock = vs ? Number(vs[st.variant!]) || 0 : Number.isInteger(item?.stock) ? Number(item?.stock) : 0;
        if (!item || stock < st.quantity) {
          t.update(payRef, { status: "paid_slot_conflict", paidAt: now });
          return { payment: { ...current, status: "paid_slot_conflict" as const, paidAt: now }, fresh: true };
        }
        if (vs) {
          const next = { ...vs, [st.variant!]: stock - st.quantity };
          t.update(itemRef, { variantStock: next, stock: Object.values(next).reduce((n: number, v) => n + (Number(v) > 0 ? Number(v) : 0), 0) });
        } else t.update(itemRef, { stock: stock - st.quantity });
      }
      // The sale in the store's inventory history (lib/inventory-server.ts): the count after it is what's on the shelf now.
      {
        const vs = st.variant && item?.variantStock ? (item.variantStock as Record<string, number>) : null;
        const shelf = vs ? Number(vs[st.variant!]) || 0 : Number(item?.stock) || 0;
        recordSale(t, db, { ownerUid: current.publisherUid, itemId: st.itemId, variant: st.variant, quantity: st.quantity, after: current.reservationReleased ? Math.max(0, shelf - st.quantity) : shelf, buyerUid: current.uid, orderRef: reference, at: now });
      }
      const carrier = st.carrier;
      t.set(db.doc(`storeOrders/${reference}`), {
        ...(carrier ? { carrier } : {}),
        reference, parcelId, sellerUid: current.publisherUid, sellerUsername: current.publisherUsername, buyerUid: current.uid,
        ...(current.cartRef ? { cartRef: current.cartRef } : {}),
        buyerEmail: current.email, itemId: st.itemId, itemTitle: st.itemTitle, itemImage: st.itemImage, quantity: st.quantity, ...(st.variantLabel ? { variantLabel: st.variantLabel } : {}),
        unitKobo: st.unitKobo, deliveryKobo: st.deliveryKobo, amountKobo: current.amountKobo, commissionKobo,
        address: st.address, status: "paid", paidAt: now,
      });
      t.set(db.doc(`parcels/${parcelId}`), {
        parcelId, orderRef: reference, sellerUid: current.publisherUid, sellerUsername: current.publisherUsername,
        sellerName: seller?.displayName || current.publisherUsername, buyerUid: current.uid, buyerPhoneLast4: phoneLast4(st.address.phone),
        itemTitle: st.itemTitle, quantity: st.quantity, city: st.address.city, state: st.address.state, status: "paid", custody: [], createdAt: now,
        ...(carrier ? { carrierUid: carrier.uid, carrierName: carrier.name } : {}),
      });
      // With a delivery partner the store is paid the goods and the partner the delivery, less our cut; both are held until delivery
      // is confirmed (lib/orders-server.ts confirmOrder releases both).
      const sellerGross = carrier ? current.amountKobo - st.deliveryKobo : current.amountKobo;
      const releaseAfter = new Date(Date.now() + ESCROW_PLACEHOLDER_DAYS * 86_400_000).toISOString();
      t.set(db.doc(`ledger/${reference}`), {
        reference, kind: "order", publisherUid: current.publisherUid, publisherUsername: current.publisherUsername, payerUid: current.uid,
        grossKobo: sellerGross, commissionKobo, netKobo: sellerGross - commissionKobo - (current.affiliate?.kobo ?? 0),
        ...(current.affiliate ? { affiliateKobo: current.affiliate.kobo } : {}), status: "held", releaseAfter, createdAt: now,
      } satisfies LedgerEntry);
      writeProductEarning(t, db, current, "store", st.itemTitle, st.itemId, now);
      if (carrier) {
        t.set(db.doc(`ledger/${shippingRef(reference)}`), {
          reference: shippingRef(reference), paymentReference: reference, kind: "shipping", publisherUid: carrier.uid, publisherUsername: carrier.username,
          payerUid: current.uid, grossKobo: st.deliveryKobo, commissionKobo: carrier.cutKobo, netKobo: st.deliveryKobo - carrier.cutKobo,
          status: "held", releaseAfter, createdAt: now,
        } satisfies LedgerEntry);
      }
    } else if (current.kind === "digital" && current.digital) {
      // A digital sale: access is instant. The seller's money is held for the usual dispute window
      // (paid out automatically afterwards); the buyer cannot be refunded once they download.
      const dg = current.digital;
      t.set(db.doc(`digitalPurchases/${reference}`), {
        reference, buyerUid: current.uid, buyerEmail: current.email, itemId: dg.itemId, itemTitle: dg.itemTitle,
        sellerUid: current.publisherUid, sellerUsername: current.publisherUsername, amountKobo: current.amountKobo,
        downloads: 0, createdAt: now,
      });
      t.set(db.doc(`ledger/${reference}`), ledgerFor(current, current.amountKobo, new Date(Date.now() + DIGITAL_HOLD_DAYS * 86_400_000), now));
      writeProductEarning(t, db, current, "digital", dg.itemTitle, dg.itemId, now);
    } else if (current.kind === "course" && current.course) {
      // A paid course: the learner has it straight away; the tutors' shares are held for the refund window, then paid out.
      await fulfilCourseInTransaction(t, db, current, courseSplit, now);
      writeProductEarning(t, db, current, "course", current.course.courseTitle, current.course.courseId, now);
    } else if (current.kind === "giving" && current.giving) {
      // A gift to a community: a receipt the giver can see, and the community's money (after the charges) held a day, then paid out to
      // the owner's verified bank account with that day's other gifts. Our band charge is the commission; Paystack's card charge is
      // passed on at cost.
      const g = current.giving;
      writeGiftReceipt(t, db, current, now);
      t.set(db.doc(`ledger/${reference}`), {
        reference, kind: "giving", publisherUid: current.publisherUid, publisherUsername: current.publisherUsername, payerUid: current.uid,
        grossKobo: current.amountKobo - g.cardChargeKobo, commissionKobo: g.bandKobo, netKobo: g.netKobo,
        ...(g.cardChargeKobo ? { cardChargeKobo: g.cardChargeKobo } : {}),
        status: "held", releaseAfter: givingReleaseAfter(new Date(now)).toISOString(), createdAt: now,
      } satisfies LedgerEntry);
    } else if (current.kind === "ticket" && current.ticket && ticketRead) {
      // Event tickets: one per admission, the sold count moved here. Not enough left (bought at the same moment as the last ones) →
      // flagged for a refund, like a sold-out shop order. The host's money, after the charges, is held until the event ends: like a
      // gift, the band is our commission and the card charge is passed on at cost. A ticket bought before v0.117.0 has no charges on
      // its payment and keeps the commission it was sold with.
      if (!writeTickets(t, db, current, ticketRead, now)) {
        t.update(payRef, { status: "paid_slot_conflict", paidAt: now });
        return { payment: { ...current, status: "paid_slot_conflict" as const, paidAt: now }, fresh: true };
      }
      const tk = current.ticket;
      t.set(db.doc(`ledger/${reference}`), typeof tk.bandKobo === "number" && typeof tk.netKobo === "number" ? {
        reference, kind: "ticket", publisherUid: current.publisherUid, publisherUsername: current.publisherUsername, payerUid: current.uid,
        grossKobo: current.amountKobo - (tk.cardChargeKobo ?? 0), commissionKobo: tk.bandKobo, netKobo: tk.netKobo,
        ...(tk.cardChargeKobo ? { cardChargeKobo: tk.cardChargeKobo } : {}),
        status: "held", releaseAfter: new Date(tk.endsAt).toISOString(), createdAt: now,
      } satisfies LedgerEntry : ledgerFor(current, current.amountKobo, new Date(tk.endsAt), now));
    } else if (current.kind === "live_ticket" && current.liveTicket && liveRead) {
      // A paid-live ticket: one per person, written here with the sold count. The live cancelled or a ticket already held (two checkouts
      // at once) → flagged for a refund, like a sold-out ticket. The host's money (after the commission fixed at checkout) is held until
      // the live ends (awaitingLive), then the problem window.
      if (!writeLiveTicket(t, db, current, liveRead, now)) {
        t.update(payRef, { status: "paid_slot_conflict", paidAt: now });
        return { payment: { ...current, status: "paid_slot_conflict" as const, paidAt: now }, fresh: true };
      }
      t.set(db.doc(`ledger/${reference}`), { ...ledgerFor(current, current.amountKobo, new Date(current.liveTicket.startsAt), now), awaitingLive: true });
    } else if (current.kind === "debt" && current.debt && debtRead) {
      // A customer paid what they owe a Business books seller: the payment in the seller's books (oldest sales first), the customer's
      // receipt, and the seller's money held in the ledger, then paid out like a sale (lib/books-debt-server.ts).
      current.debt = writeDebt(t, db, current, debtRead, now);
      t.update(payRef, { debt: current.debt });
    } else if (current.kind === "boost" && current.boost) {
      // Boosts are platform revenue: no ledger entry, just an active campaign.
      const pk = getBoostPackage(current.boost.packageId);
      if (!pk) throw new Error("Unknown boost package");
      // Either a post or a store item (its listing is what the Boosted card links to).
      const note = current.boost.noteId ? (await t.get(db.doc(`notes/${current.boost.noteId}`))).data() : undefined;
      const item = current.boost.itemId ? (await t.get(db.doc(`storeItems/${current.boost.itemId}`))).data() : undefined;
      const owner = item ? (await t.get(db.doc(`users/${item.ownerUid}`))).data() : undefined;
      t.set(db.doc(`boosts/${reference}`), {
        reference,
        ...(current.boost.itemId ? { itemId: current.boost.itemId, href: `/shop/${current.boost.itemId}`, targetKind: "item" } : { noteId: current.boost.noteId, targetKind: "post" }),
        slug: note?.slug || "",
        title: note?.title || item?.title || "",
        author: note?.author || owner?.displayName || "",
        image: note?.featured_image || item?.image || "",
        publisherUid: current.uid,
        packageId: pk.id,
        amountKobo: current.amountKobo,
        impressionsPurchased: pk.impressions,
        impressionsDelivered: 0,
        clicks: 0,
        maxPerDay: pk.maxPerDay,
        daily: {},
        startsAt: now,
        endsAt: new Date(Date.now() + pk.windowDays * 86_400_000).toISOString(),
        status: "active",
        refundedKobo: 0,
        createdAt: now,
      });
    } else if (current.kind === "tier" && current.tier) {
      // Paid plan: platform revenue (no ledger). Grant the tier now.
      const tr = current.tier;
      t.set(db.doc(`users/${current.uid}`), { accountTier: tr.tier, lastPaidAt: now, trialUntil: FieldValue.delete(), trialTier: FieldValue.delete(), trialReminderSent: FieldValue.delete() }, { merge: true }); // lastPaidAt: lib/trials.ts
      t.set(db.doc(`tierSubscriptions/${current.uid}`), {
        uid: current.uid,
        email: current.email,
        tier: tr.tier,
        interval: tr.interval,
        planCode: tr.planCode,
        status: "active",
        subscribedAt: now,
        currentPeriodEnd: periodEndFrom(Date.now(), tr.interval),
        // A referred friend's first period: Paystack's subscription is started for its end (startReferralSubscription, below).
        ...(tr.referralFirst ? { referralFirst: true, subscriptionPending: true } : {}),
        ...(tr.couponFirst ? { couponFirst: true, subscriptionPending: true } : {}),
      });
      if (tr.referralFirst) t.set(db.doc(`referrals/${current.uid}`), { offerUsed: true }, { merge: true });
    } else if (current.kind === "wallet_topup") {
      await creditTopup(t, db, current, new Date(now));
    } else if (current.kind === "certificate" && current.certificate) {
      // Issued straight away. The teacher's part (their margin, less our commission) is held for the usual window, like a download.
      const id = await issueInTransaction(t, db, current, new Date(now));
      if (current.certificate.teacherKobo > 0) {
        t.set(db.doc(`ledger/${reference}`), ledgerFor(current, current.certificate.teacherKobo, new Date(Date.now() + DIGITAL_HOLD_DAYS * 86_400_000), now));
      }
      t.update(payRef, { status: "paid", paidAt: now, "certificate.issuedId": id });
      return { payment: { ...current, status: "paid" as const, paidAt: now, certificate: { ...current.certificate, issuedId: id } }, fresh: true };
    } else if (current.kind === "logistics_addon") {
      // A month of the logistics add-on (Free Basic and Pro): runs on from the trial or the month already paid.
      const acc = (await t.get(db.doc(`users/${current.uid}`))).data()?.logisticsAccount;
      extendAddon(t, db, current.uid, acc, new Date(now));
    } else if (current.kind === "exam_pack") {
      // Naija Exam Prep: platform revenue (no ledger). The pack's months go to the account it was bought for; the same reference
      // never adds twice (lib/exam-prep-server.ts).
      await grantPackInTransaction(t, db, current, now);
    } else if (current.kind === "inventory_addon") {
      // A month of inventory on Free Basic or Pro: runs on from the trial or the month already paid.
      const acc = (await t.get(db.doc(`users/${current.uid}`))).data()?.inventoryAccount;
      extendInventoryAddon(t, db, current.uid, acc, new Date(now));
    } else if (current.kind === "nana_credit" && current.nanaPack) {
      addNanaCredit(t, db, current.uid, current.nanaPack.creditKobo, reference, new Date(now));
    } else if (current.kind === "life_naira") {
      // Notesville Naira for Notes Life: 1 kobo of NotesApp Credit (or card) = N$ 1. Game money only; it never converts back.
      const at = Date.now();
      t.set(db.doc(`lifePlayers/${current.uid}`), { naira: FieldValue.increment(current.amountKobo), netWorth: FieldValue.increment(current.amountKobo), updatedAt: at }, { merge: true });
      t.set(db.doc(`lifeTx/${current.uid}_${reference}`), { uid: current.uid, amount: current.amountKobo, label: current.payWith === "wallet" ? "Bought with NotesApp Credit" : "Bought by card", kind: "buy_naira", at });
    } else if (current.kind === "badge" && current.badge) {
      const end = periodEndFrom(Date.now(), "monthly");
      t.set(db.doc(`users/${current.uid}`), { badgeUntil: end }, { merge: true });
      t.set(db.doc(`badgeSubscriptions/${current.uid}`), {
        uid: current.uid,
        email: current.email,
        planCode: current.badge.planCode,
        // Paid from the wallet: one month with no Paystack plan behind it, so it can't renew. It reads as "auto-renewal off" (the
        // badge card shows when it ends and offers no Cancel, which would look for a Paystack plan).
        status: current.payWith === "wallet" ? "cancelled" : "active",
        subscribedAt: now,
        currentPeriodEnd: end,
        ...(current.payWith === "wallet" ? { paidFromWallet: true } : {}),
      });
    } else if (current.kind === "merch" && current.merch) {
      // Official merch is platform revenue (no ledger). One order per payment,
      // collected into a pre-order batch for admin fulfilment.
      const merchParcelId = newParcelId();
      t.set(db.doc(`merchOrders/${reference}`), {
        reference,
        parcelId: merchParcelId,
        uid: current.uid,
        email: current.email,
        ...current.merch,
        amountKobo: current.amountKobo,
        status: "preordered",
        createdAt: now,
      });
      // The same public tracking page store orders use, so the buyer can follow it.
      t.set(db.doc(`parcels/${merchParcelId}`), merchParcelDoc(merchParcelId, { reference, uid: current.uid, itemName: current.merch.itemName, size: current.merch.size, quantity: current.merch.quantity, address: current.merch.address, status: "preordered" }, now));
    } else if (current.kind === "ad" && current.ad) {
      // Paid campaign enters the admin review queue. It is NOT revenue yet — the ad
      // revenue entry is created when an admin approves it (a rejection refunds it).
      t.update(db.doc(`adCampaigns/${current.ad.campaignId}`), { status: "in_review", paidAt: now });
    } else if (current.kind === "gold_deposit" && current.gold) {
      // Non-refundable identity-check deposit: platform revenue, moves the
      // application into admin review.
      t.set(db.doc(`badgeRequests/${current.uid}`), { status: "pending", depositPaidAt: now, depositReference: reference }, { merge: true });
    } else if (current.kind === "gold" && current.gold?.planCode) {
      const g = current.gold;
      const end = periodEndFrom(Date.now(), "monthly");
      t.set(db.doc(`users/${current.uid}`), { goldBadge: { kind: g.kind, track: g.track, grantedAt: now }, goldUntil: end }, { merge: true });
      t.set(db.doc(`goldSubscriptions/${current.uid}`), {
        uid: current.uid,
        email: current.email,
        planCode: g.planCode,
        kind: g.kind,
        track: g.track,
        status: "active",
        subscribedAt: now,
        currentPeriodEnd: end,
      });
      t.set(db.doc(`badgeRequests/${current.uid}`), { status: "active" }, { merge: true });
    } else if (current.kind === "gift" && current.gift) {
      // The receiver's total for the day (Lagos day), read before any write: the "Top gifted today" shelf (lib/gifts-server.ts).
      const dailyPrev = await readGiftDaily(t, db, current.publisherUid, now);
      // The weekly boards, the sender's gift points and the receiver's list of received gifts (gifting everywhere), read now too.
      const tally: TallyInput = { toUid: current.publisherUid, fromUid: current.uid, anonymous: current.gift.anonymous, grossKobo: current.amountKobo, quantity: current.gift.quantity ?? 1, ...(current.gift.animId ? { animId: current.gift.animId } : {}), name: current.gift.animName || "", at: now };
      const tallyPrev = await readGiftTallies(t, db, tally);
      t.set(db.doc(`gifts/${reference}`), {
        reference,
        toUid: current.publisherUid,
        toUsername: current.gift.username,
        fromUid: current.uid,
        senderName: current.gift.anonymous ? "" : current.gift.senderName,
        anonymous: current.gift.anonymous,
        message: current.gift.message,
        noteId: current.gift.noteId || "",
        noteSlug: current.gift.noteSlug || "",
        amountKobo: current.amountKobo,
        ...(current.gift.animId ? { animId: current.gift.animId, animName: current.gift.animName || "" } : {}),
        ...(current.gift.liveId ? { liveId: current.gift.liveId } : {}),
        quantity: current.gift.quantity ?? 1,
        toKind: current.gift.toKind ?? "creator",
        context: current.gift.context ?? (current.gift.liveId ? "live" : current.gift.noteId ? "post" : "profile"),
        ...(current.gift.mediaId ? { mediaId: current.gift.mediaId } : {}),
        ...(current.gift.replayId ? { replayId: current.gift.replayId } : {}),
        createdAt: now,
      });
      // Held for the same 7-day dispute window as subscriptions. One entry per
      // author when the post is co-authored (lead keeps the rounding remainder).
      const hold = new Date(Date.now() + SUBSCRIPTION_HOLD_DAYS * 86_400_000);
      const coGross = shares.slice(1).map((s) => Math.floor((current.amountKobo * s.percent) / 100));
      const grosses = [current.amountKobo - coGross.reduce((a, b) => a + b, 0), ...coGross];
      shares.forEach((s, idx) => {
        const entryId = idx === 0 ? reference : `${reference}_${s.uid}`;
        const base = ledgerFor({ ...current, publisherUid: s.uid, publisherUsername: s.username, commissionRate: s.rate }, grosses[idx], hold, now);
        t.set(db.doc(`ledger/${entryId}`), shares.length > 1 ? { ...base, reference: entryId, paymentReference: reference, sharePercent: s.percent } : base);
      });
      // Counted for the lead publisher (whose page and live it was sent on), gross and after every author's commission.
      const netKobo = shares.reduce((n, s, idx) => n + grosses[idx] - Math.round(grosses[idx] * s.rate), 0);
      writeGiftDaily(t, db, dailyPrev, { uid: current.publisherUid, fromUid: current.uid, grossKobo: current.amountKobo, netKobo, at: now, ...(current.gift.liveId ? { liveId: current.gift.liveId } : {}) });
      if (current.gift.animId) {
        writeGiftShow(t, db, current.publisherUid, { reference, giftId: current.gift.animId, name: current.gift.animName || "", priceKobo: current.amountKobo, senderName: current.gift.anonymous ? "" : current.gift.senderName, at: now, ...((current.gift.quantity ?? 1) > 1 ? { quantity: current.gift.quantity } : {}) });
      }
      writeGiftTallies(t, db, tallyPrev, tally);
    } else if (current.kind === "subscription" && current.subscription) {
      const { username, planCode } = current.subscription;
      const subRef = db.doc(`subscriptions/${current.uid}_${username}`);
      // Changing tier: the new tier starts now and the days left on the old one are added on (subPrev is read before any write).
      const left = subPrev && subPrev.currentPeriodEnd ? Math.max(0, Date.parse(String(subPrev.currentPeriodEnd)) - Date.now()) : 0;
      t.set(subRef, {
        subscriberUid: current.uid,
        subscriberEmail: current.email,
        username,
        planCode,
        tier: tierOf(current.subscription),
        status: "active",
        subscribedAt: subPrev?.subscribedAt ?? now,
        currentPeriodEnd: new Date(Date.now() + left + PERIOD_DAYS * 86_400_000).toISOString(),
        ...(subPrev?.planCode && subPrev.planCode !== planCode ? { previousPlanCode: String(subPrev.planCode) } : {}),
      });
      const hold = new Date(Date.now() + SUBSCRIPTION_HOLD_DAYS * 86_400_000);
      t.set(db.doc(`ledger/${reference}`), ledgerFor(current, current.amountKobo, hold, now));
    }
    writeRedemption(t, db, codeRead, current, now);
    t.update(payRef, { status: "paid", paidAt: now });
    return { payment: { ...current, status: "paid" as const, paidAt: now }, fresh: true };
  });

  // Paid in another currency: the sale's earnings leave the naira payout run and are owed in the seller's currency (idempotent).
  if (result.payment.payWith === "global") await settleSale(db, reference).catch((e) => console.error("settle global sale", reference, e));
  // A paid-live ticket that couldn't be issued (the live was cancelled meanwhile, or they already hold one): back to their NotesApp Credit.
  if (result.fresh && result.payment.status === "paid_slot_conflict" && result.payment.kind === "live_ticket") {
    await refundLiveTicketToCredit(db, reference, "The live couldn't take this ticket").catch((e) => console.error("live ticket conflict refund", reference, e));
  }
  if (result.fresh && result.payment.status === "paid") {
    await notifyPaid(result.payment).catch((e) => console.error("notifyPaid failed", e));
    await afterFanPayment(db, result.payment).catch((e) => console.error("fan points failed", e));
    await emitSaleWebhooks(result.payment);
    if (shares.length > 1 && result.payment.gift) await notifyGiftShares(result.payment, shares).catch((e) => console.error("notifyGiftShares failed", e));
    if (result.payment.affiliate) await alertIfJump(db, result.payment.affiliate.uid).catch(() => false);
    if (result.payment.kind === "tier" && result.payment.tier) {
      const p = result.payment;
      if (p.tier!.referralFirst || p.tier!.couponFirst) await startReferralSubscription(db, p, tx).catch((e) => console.error("referral subscription", p.reference, e));
      // The free month's card check is not a real payment; a referred friend's discounted year is.
      const real = !(p.tier!.referralFirst && p.tier!.interval === "monthly");
      if (real) await recordPlanEarning(db, p.uid, p.reference, p.amountKobo, `${p.tier!.tier === "pro" ? "Pro" : "Business"} plan`).catch((e) => console.error("plan earning", p.reference, e));
    }
    if (result.payment.kind === "tier" && result.payment.tier?.tier === "business") {
      await cancelBadgeIfCovered(result.payment.uid);
    }
    // A corporate identity check runs against the CAC register, so an organisation that
    // passes it (admin approved, then subscribed) counts as registration-confirmed too.
    if (result.payment.kind === "gold" && result.payment.gold?.kind === "identity" && result.payment.gold?.track === "corporate") {
      const uref = db.doc(`users/${result.payment.uid}`);
      const u = (await uref.get()).data();
      if (u?.accountKind === "organisation" && u.org?.rcStatus !== "verified") {
        await uref.update({ "org.rcStatus": "verified", "org.rcVerifiedAt": new Date().toISOString(), "org.rcNote": "Confirmed by corporate identity check" }).catch((e) => console.error("org verify failed", e));
      }
    }
  }
  return result.payment;
}

// A recurring Paystack charge for an existing plan subscription —
// these arrive only via webhook, with no record of ours behind them.
export async function fulfillRenewal(data: {
  reference: string;
  amount: number;
  customer?: { email?: string };
  plan?: { plan_code?: string } | null;
}): Promise<void> {
  const planCode = data.plan?.plan_code;
  const email = data.customer?.email;
  if (!planCode || !email) return;
  await ensurePricing();
  const db = getAdminDb();
  if ((await db.doc(`ledger/${data.reference}`).get()).exists) return; // already processed

  const tx = await verifyTransaction(data.reference);
  if (tx.status !== "success") return;

  const subs = await db
    .collection("subscriptions")
    .where("planCode", "==", planCode)
    .where("subscriberEmail", "==", email)
    .limit(1)
    .get();
  if (subs.empty) return;
  const subDoc = subs.docs[0];
  const sub = subDoc.data();
  const pub = await db.doc(`usernames/${sub.username}`).get();
  const publisherUid = pub.data()?.uid as string | undefined;
  if (!publisherUid) return;
  const user = (await db.doc(`users/${publisherUid}`).get()).data();

  const now = new Date();
  const base = Math.max(now.getTime(), new Date(sub.currentPeriodEnd).getTime());
  const payment: PaymentRecord = {
    reference: data.reference,
    kind: "subscription",
    uid: sub.subscriberUid,
    email,
    amountKobo: pricePaidKobo(tx),
    status: "paid",
    publisherUid,
    publisherUsername: sub.username,
    // The tier's share of the rate (lib/fans.ts), as on the first payment.
    commissionRate: tierRate(commissionRateFor((user?.accountTier as AccountTier) || "basic", user?.customRates), tierOf(sub), await getFanSettings(db)),
    subscription: { username: sub.username, planCode, tier: tierOf(sub) },
    createdAt: now.toISOString(),
    paidAt: now.toISOString(),
  };
  const batch = db.batch();
  batch.update(subDoc.ref, {
    status: "active",
    currentPeriodEnd: new Date(base + PERIOD_DAYS * 86_400_000).toISOString(),
  });
  batch.set(db.doc(`payments/${data.reference}`), payment);
  batch.set(
    db.doc(`ledger/${data.reference}`),
    ledgerFor(payment, pricePaidKobo(tx), new Date(now.getTime() + SUBSCRIPTION_HOLD_DAYS * 86_400_000), now.toISOString())
  );
  await batch.commit();
  await addFanPoints(db, publisherUid, sub.subscriberUid, { kobo: pricePaidKobo(tx) }).catch((e) => console.error("fan points failed", e));
}

// After a payment: fan points for subscriptions and gifts (1 per ₦100 to the creator), and a tier change stops the old tier's
// Paystack subscription so the fan isn't charged twice (best effort: a renewal of the old plan still finds the record by planCode).
async function afterFanPayment(db: FirebaseFirestore.Firestore, p: PaymentRecord) {
  if ((p.kind === "subscription" || p.kind === "gift") && p.publisherUid) await addFanPoints(db, p.publisherUid, p.uid, { kobo: p.amountKobo });
  if (p.kind === "subscription" && p.subscription) {
    const s = (await db.doc(`subscriptions/${p.uid}_${p.subscription.username}`).get()).data();
    const old = s?.previousPlanCode ? String(s.previousPlanCode) : "";
    if (old && old !== p.subscription.planCode) {
      const hit = await findPaystackSubscription(p.email, old).catch(() => null);
      if (hit) await disableSubscription(hit.code, hit.token).catch((e) => console.error("old tier not stopped", e));
    }
  }
}

export async function markSubscriptionCancelled(planCode: string, email: string): Promise<void> {
  const subs = await getAdminDb()
    .collection("subscriptions")
    .where("planCode", "==", planCode)
    .where("subscriberEmail", "==", email)
    .get();
  await Promise.all(subs.docs.map((d) => d.ref.update({ status: "cancelled" })));
}

// Tell the seller's webhook endpoints (Enterprise API accounts) about a settled sale. Never throws.
async function emitSaleWebhooks(p: PaymentRecord): Promise<void> {
  if (!p.publisherUid) return;
  if (p.kind === "booking" && p.booking) {
    await emitWebhook(p.publisherUid, "booking.created", { id: p.reference, date: p.booking.date, slot: p.booking.slot, minutes: p.booking.minutes, amount_kobo: p.amountKobo });
  } else if (p.kind === "store" && p.store) {
    await emitWebhook(p.publisherUid, "order.paid", { id: p.reference, item_id: p.store.itemId, item_title: p.store.itemTitle, quantity: p.store.quantity, ...(p.store.variantLabel ? { options: p.store.variantLabel } : {}), amount_kobo: p.amountKobo, ship_to: { city: p.store.address.city, state: p.store.address.state } });
  } else if (p.kind === "course" && p.course) {
    await emitWebhook(p.publisherUid, "course.sold", { id: p.reference, course_id: p.course.courseId, course_title: p.course.courseTitle, amount_kobo: p.amountKobo });
  } else if (p.kind === "digital" && p.digital) {
    await emitWebhook(p.publisherUid, "digital.sold", { id: p.reference, item_id: p.digital.itemId, item_title: p.digital.itemTitle, amount_kobo: p.amountKobo });
  }
}

async function notifyPaid(p: PaymentRecord) {
  // Amounts in the sale's own currency (a global sale priced in shillings says "KSh 650", not naira).
  const formatNaira = (kobo: number) => moneyIn(kobo, p.currency, nairaText);
  if (p.kind === "debt" && p.debt) return notifyDebtPaid(p);
  if (p.kind === "gift" && p.gift) return notifyGift(p);
  if (p.kind === "giving" && p.giving) return notifyGiving(p);
  if (p.kind === "ticket" && p.ticket) return notifyTickets(p);
  if (p.kind === "live_ticket" && p.liveTicket) return notifyLiveTicket(p);
  if (p.kind === "life_naira") {
    await notifyBell({ uid: p.uid, type: "plan", linkHref: "/life/play", message: `N$ ${p.amountKobo.toLocaleString("en-NG")} added to Notes Life.` });
    return;
  }
  if (p.kind === "certificate" && p.certificate?.issuedId) {
    await notifyBell({ uid: p.uid, type: "plan", linkHref: `/certificates/${p.certificate.issuedId}`, message: `Your certificate for “${p.certificate.courseTitle}” is ready. Share it or add it to LinkedIn.` });
    if (p.publisherUid && p.publisherUid !== p.uid) await notifyBell({ uid: p.publisherUid, type: "plan", linkHref: "/academy/teach", message: `${p.certificate.learnerName} got their certificate for “${p.certificate.courseTitle}”.` });
    return;
  }
  if (p.kind === "exam_pack" && p.examPack) {
    await notifyBell({ uid: p.examPack.forUid, type: "plan", linkHref: `/exam-prep/${p.examPack.pack}`, message: `Your ${EXAMS[p.examPack.pack].name} pack is open for ${p.examPack.months} months. Built for your next breakthrough.` });
    return;
  }
  if (p.kind === "inventory_addon") {
    await notifyBell({ uid: p.uid, type: "plan", linkHref: "/profile/inventory", message: `Inventory paid (${formatNaira(p.amountKobo)}): another month of stock, SKUs, history and low-stock alerts.` });
    return;
  }
  if (p.kind === "logistics_addon") {
    await notifyBell({ uid: p.uid, type: "plan", linkHref: "/shipments", message: `Logistics add-on paid (${formatNaira(p.amountKobo)}): another month of Shipments and your place in the logistics network.` });
    return;
  }
  if (p.kind === "nana_credit" && p.nanaPack) {
    await notifyBell({ uid: p.uid, type: "plan", linkHref: "/nana#credit", message: `${formatNaira(p.nanaPack.creditKobo)} of Nana credit added (${p.nanaPack.name}). It never expires and is used after your free allowance.` });
    return;
  }
  if (p.kind === "wallet_topup") {
    await notifyBell({ uid: p.uid, type: "plan", linkHref: "/profile/wallet", message: `${formatNaira(p.amountKobo)} added to your wallet${p.topup?.bonusKobo ? `, plus ${formatNaira(p.topup.bonusKobo)} in Bonus Credits` : ""}.` });
    return;
  }
  if (p.kind === "boost") {
    // No email for boosts — the bell is the receipt.
    await notifyBell({ uid: p.uid, type: "plan", linkHref: "/profile/boosts", message: `Your boost is live (${formatNaira(p.amountKobo)}). Track it under Boost performance.` });
    return;
  }
  if (p.kind === "course" && p.course) {
    const site = SITE_URL;
    const href = `/academy/${p.course.courseSlug}`;
    await sendEmail({
      to: p.email,
      subject: `You're in: ${p.course.courseTitle}`,
      bell: { uid: p.uid, type: "course", linkHref: href, message: `You bought “${p.course.courseTitle}”. Start whenever you like.` },
      text: `Thanks! “${p.course.courseTitle}” (${formatNaira(p.amountKobo)}) is yours, for good. Open it from its page or from Continue learning on Notes Academy. It plays on up to 2 of your devices.\n\nChanged your mind? You can get a refund within 7 days, as long as you haven't started the course.\nReference: ${p.reference}\n\n#NotesApp`,
      action: { label: "Open the course", url: `${site}${href}` },
    });
    await notifyBell({ uid: p.publisherUid, type: "course", linkHref: "/academy/teach", message: `Sold: “${p.course.courseTitle}” (${formatNaira(p.amountKobo)}). Earnings after commission are paid out after ${DIGITAL_HOLD_DAYS} days.` });
    return;
  }
  if (p.kind === "digital" && p.digital) {
    const site = SITE_URL;
    await sendEmail({
      to: p.email,
      subject: "Your #NotesApp purchase is ready",
      bell: { uid: p.uid, type: "order", linkHref: "/orders", message: `Your purchase is ready: ${p.digital.itemTitle}` },
      text: `Thanks! ${p.digital.itemTitle} (${formatNaira(p.amountKobo)}) is yours. Open or download it any time from My orders → My purchases. Digital purchases are final once downloaded or opened, so there are no refunds after that. If it is a view-only item, it works on up to 2 devices.\nReference: ${p.reference}\n\n#NotesApp`,
      action: { label: "Open My orders", url: `${site}/orders` },
    });
    const sellerEmail = await getUserEmail(p.publisherUid);
    const net = p.amountKobo - Math.round(p.amountKobo * p.commissionRate);
    if (sellerEmail) {
      await sendEmail({
        to: sellerEmail,
        subject: "You sold a download",
        bell: { uid: p.publisherUid, type: "order", linkHref: "/orders", message: `Sold: ${p.digital.itemTitle}` },
        text: `${p.digital.itemTitle} was bought for ${formatNaira(p.amountKobo)}. Your share after commission (${formatNaira(net)}) is paid to your bank account after a ${DIGITAL_HOLD_DAYS}-day dispute window.\nReference: ${p.reference}\n\n#NotesApp`,
      }).catch(() => {});
    }
    return;
  }
  if (p.kind === "subscription" && p.subscription) {
    await notifyBell({ uid: p.uid, type: "plan", linkHref: `/u/${p.subscription.username}`, message: `You're subscribed to @${p.subscription.username} (${formatNaira(p.amountKobo)}/month).` });
    await notifyBell({ uid: p.publisherUid, type: "plan", linkHref: "/profile/publishing", message: "You have a new subscriber." });
    return;
  }
  if (p.kind === "badge") {
    await sendEmail({
      to: p.email,
      subject: "Your #NotesApp verified badge is active",
      bell: { uid: p.uid, type: "badge", linkHref: "/badges" },
      text: p.payWith === "wallet"
        ? `The ✔ now shows next to your name for one month (${formatNaira(p.amountKobo)}, paid from your wallet). It doesn't renew by itself: when it ends, add it again from the verification badges page.\nReference: ${p.reference}\n\n#NotesApp`
        : `The ✔ now shows next to your name (${formatNaira(p.amountKobo)}/month, renews automatically). Cancel any time under Edit profile — you keep the badge until the period ends.\nReference: ${p.reference}\n\n#NotesApp`,
    });
    return;
  }
  if (p.kind === "ad" && p.ad) {
    await sendEmail({
      to: p.email,
      subject: "Your #NotesApp ad campaign is in review",
      bell: { uid: p.uid, type: "ad", linkHref: "/advertise/campaigns" },
      text: `Thanks — we received ${formatNaira(p.amountKobo)} for your ad campaign. We review every ad before it goes live (usually within a day). If we can't run it you'll get a full refund. Track it any time at ${SITE_URL}/advertise/campaigns.\nReference: ${p.reference}\n\n#NotesApp`,
    });
    return;
  }
  if (p.kind === "store" && p.store) {
    const site = SITE_URL;
    const st = p.store;
    // The seller hears when this sale took the item to its low-stock level or sold it out (when they have inventory).
    await lowStockAlert(getAdminDb(), { ownerUid: p.publisherUid, itemId: st.itemId, variant: st.variant, quantity: st.quantity }).catch(() => false);
    // The sale in the seller's Business books (lib/books-server.ts): one entry per order, safe to repeat; books open also catches up.
    await bookOnlineOrder(getAdminDb(), p.reference).catch((e) => console.error("books online order failed", p.reference, e));
    if (p.cartRef) return; // part of a basket: one message for the whole basket (below)
    await sendEmail({
      to: p.email,
      subject: "Your #NotesApp order is confirmed",
      bell: { uid: p.uid, type: "order", linkHref: "/orders" },
      text: `Thanks! ${st.quantity} × ${st.itemTitle}${st.variantLabel ? ` (${st.variantLabel})` : ""} — ${formatNaira(p.amountKobo)} including delivery, to ${st.address.fullName}, ${st.address.street}, ${st.address.city}, ${st.address.state}.\nYour money is held by #NotesApp until you confirm the parcel arrived (or 7 days after it's marked delivered). Follow it and confirm delivery at ${site}/orders.\nReference: ${p.reference}\n\n#NotesApp`,
    });
    const sellerEmail = await getUserEmail(p.publisherUid);
    if (sellerEmail) {
      await sendEmail({
        to: sellerEmail,
        subject: "New order on your #NotesApp store",
        bell: { uid: p.publisherUid, type: "order", linkHref: "/orders", message: `New order: ${st.quantity} × ${st.itemTitle}${st.variantLabel ? ` (${st.variantLabel})` : ""}` },
        text: st.carrier
          ? `${st.quantity} × ${st.itemTitle}${st.variantLabel ? ` (${st.variantLabel})` : ""} was ordered (${formatNaira(p.amountKobo - st.deliveryKobo)} for the goods; the buyer paid ${formatNaira(st.deliveryKobo)} delivery to your delivery partner, ${st.carrier.name}). Have it ready: ${st.carrier.name} collects it and delivers to ${st.address.fullName} in ${st.address.city}, ${st.address.state}, and keeps the tracking up to date. Follow it at ${site}/orders. You're paid after the buyer confirms delivery, or 7 days after it's marked delivered.\n\n#NotesApp`
          : `${st.quantity} × ${st.itemTitle}${st.variantLabel ? ` (${st.variantLabel})` : ""} was ordered (${formatNaira(p.amountKobo)} incl. delivery). Deliver to ${st.address.fullName}, ${st.address.phone}, ${st.address.street}, ${st.address.city}, ${st.address.state}.\nDispatch it and keep the tracking up to date at ${site}/orders (courier details, or each hand-off if it goes by bike, bus or park). You're paid after the buyer confirms delivery, or 7 days after you mark it delivered.\n\n#NotesApp`,
      }).catch(() => {});
    }
    // The delivery partner: a pickup from the store, the buyer's address, and what it's paid once delivery is confirmed.
    if (st.carrier) {
      const carrierEmail = await getUserEmail(st.carrier.uid);
      if (carrierEmail) {
        await sendEmail({
          to: carrierEmail,
          subject: `New delivery from @${p.publisherUsername}`,
          bell: { uid: st.carrier.uid, type: "order", linkHref: "/shipments", message: `New delivery: ${st.quantity} × ${st.itemTitle} from @${p.publisherUsername} to ${st.address.city}, ${st.address.state}` },
          text: `@${p.publisherUsername} has an order for you to deliver: ${st.quantity} × ${st.itemTitle}${st.variantLabel ? ` (${st.variantLabel})` : ""}.\nDeliver to ${st.address.fullName}, ${st.address.phone}, ${st.address.street}, ${st.address.city}, ${st.address.state}.\nThe buyer paid ${formatNaira(st.deliveryKobo)} for delivery; you're paid ${formatNaira(st.deliveryKobo - st.carrier.cutKobo)} after delivery is confirmed (#NotesApp keeps ${formatNaira(st.carrier.cutKobo)}). Collect it from the store, then record each hand-off and mark it delivered at ${site}/shipments.\n\n#NotesApp`,
        }).catch(() => {});
      }
    }
    return;
  }
  // A basket: one confirmation for the buyer, one new-order message for the seller (and the delivery partner), listing every item.
  if (p.kind === "store_cart" && p.cart) {
    const site = SITE_URL;
    const db = getAdminDb();
    const orders = (await Promise.all(p.cart.orders.map((r) => db.doc(`payments/${r}`).get()))).map((d) => d.data() as PaymentRecord | undefined).filter((o): o is PaymentRecord => !!o?.store);
    if (!orders.length) return;
    const first = orders[0].store!;
    const a = first.address;
    const list = orders.map((o) => `${o.store!.quantity} × ${o.store!.itemTitle}${o.store!.variantLabel ? ` (${o.store!.variantLabel})` : ""}`).join("\n");
    const soldOut = orders.filter((o) => o.status === "paid_slot_conflict").map((o) => o.store!.itemTitle);
    const delivery = first.deliveryKobo, carrier = first.carrier;
    await sendEmail({
      to: p.email,
      subject: "Your #NotesApp order is confirmed",
      bell: { uid: p.uid, type: "order", linkHref: "/orders" },
      text: `Thanks! Your basket from @${p.publisherUsername} — ${formatNaira(p.amountKobo)} including ${formatNaira(delivery)} delivery — to ${a.fullName}, ${a.street}, ${a.city}, ${a.state}:\n${list}\n${soldOut.length ? `\nSold out before your payment landed, so refunded: ${soldOut.join(", ")}.\n` : ""}\nEach item is its own order on ${site}/orders. Your money is held by #NotesApp until you confirm it arrived (or 7 days after it's marked delivered).\nReference: ${p.reference}\n\n#NotesApp`,
    });
    const sellerEmail = await getUserEmail(p.publisherUid);
    if (sellerEmail) {
      await sendEmail({
        to: sellerEmail,
        subject: "New order on your #NotesApp store",
        bell: { uid: p.publisherUid, type: "order", linkHref: "/orders", message: `New order: ${orders.length} items in one basket` },
        text: `A basket of ${orders.length} items was ordered — send them together:\n${list}\n\n${carrier ? `The buyer paid ${formatNaira(delivery)} delivery to your delivery partner, ${carrier.name}, who collects the parcel and delivers to ${a.fullName} in ${a.city}, ${a.state}.` : `Deliver to ${a.fullName}, ${a.phone}, ${a.street}, ${a.city}, ${a.state} (the buyer paid ${formatNaira(delivery)} delivery).`}\nEach item is its own order on ${site}/orders: dispatch and track each there. You're paid for each after the buyer confirms delivery, or 7 days after it's marked delivered.\n\n#NotesApp`,
      }).catch(() => {});
    }
    if (carrier) {
      const carrierEmail = await getUserEmail(carrier.uid);
      if (carrierEmail) {
        await sendEmail({
          to: carrierEmail,
          subject: `New delivery from @${p.publisherUsername}`,
          bell: { uid: carrier.uid, type: "order", linkHref: "/shipments", message: `New delivery: ${orders.length} items from @${p.publisherUsername} to ${a.city}, ${a.state}` },
          text: `@${p.publisherUsername} has a basket for you to deliver as one parcel:\n${list}\nDeliver to ${a.fullName}, ${a.phone}, ${a.street}, ${a.city}, ${a.state}.\nThe buyer paid ${formatNaira(delivery)} for delivery; you're paid ${formatNaira(delivery - carrier.cutKobo)} after delivery is confirmed (#NotesApp keeps ${formatNaira(carrier.cutKobo)}). Record it at ${site}/shipments.\n\n#NotesApp`,
        }).catch(() => {});
      }
    }
    return;
  }
  if (p.kind === "merch" && p.merch) {
    const m = p.merch;
    const site = SITE_URL;
    const parcelId = ((await getAdminDb().doc(`merchOrders/${p.reference}`).get()).data() as { parcelId?: string } | undefined)?.parcelId;
    await sendEmail({
      to: p.email,
      subject: "Your #NotesApp merch pre-order is confirmed",
      bell: { uid: p.uid, type: "merch", linkHref: parcelId ? `/track/${parcelId}` : "/orders" },
      text: `Thanks! ${m.quantity} × ${m.itemName}${m.size ? ` (${m.size})` : ""} with the ${m.logoLabel} logo — ${formatNaira(p.amountKobo)} including delivery.\nDelivering to ${m.address.fullName}, ${m.address.street}, ${m.address.city}, ${m.address.state}.\nWe print after the batch closes and deliver within about 3 weeks of closing. You can ask for a refund before the batch is printed.${parcelId ? `\nTrack it any time with parcel ID ${parcelId}.` : ""}\nReference: ${p.reference}\n\n#NotesApp`,
      ...(parcelId ? { action: { label: "Track your order", url: `${site}/track/${parcelId}` } } : {}),
    });
    return;
  }
  if (p.kind === "gold_deposit") {
    await sendEmail({
      to: p.email,
      subject: "We received your #NotesApp identity-check deposit",
      bell: { uid: p.uid, type: "badge", linkHref: "/badges" },
      text: `Thanks — your ${formatNaira(p.amountKobo)} deposit (non-refundable; it covers the third-party check) is received and your gold badge application is now in review. We'll update the status on the badges page.\nReference: ${p.reference}\n\n#NotesApp`,
    });
    return;
  }
  if (p.kind === "gold") {
    await sendEmail({
      to: p.email,
      subject: "Your #NotesApp gold badge is active",
      bell: { uid: p.uid, type: "badge", linkHref: "/badges" },
      text: `The gold ✔ now shows next to your name (${formatNaira(p.amountKobo)}/month, renews automatically). Cancel any time on the badges page — you keep it until the period ends.\nReference: ${p.reference}\n\n#NotesApp`,
    });
    return;
  }
  if (p.kind === "tier" && p.tier) {
    const name = p.tier.tier === "pro" ? "Pro" : "Business";
    await sendEmail({
      to: p.email,
      subject: `Welcome to #NotesApp ${name}`,
      bell: { uid: p.uid, type: "plan", linkHref: "/pricing" },
      text: `Your ${name} plan (${formatNaira(p.amountKobo)} per ${p.tier.interval === "annually" ? "year" : "month"}) is active. Your lower commission and ${name} benefits apply from now. It renews automatically; cancel any time under Rates & payouts and you keep the plan until the period ends.\nReference: ${p.reference}\n\n#NotesApp`,
    });
    return;
  }
  if (p.kind !== "booking" || !p.booking) return;
  const pubEmail = await getUserEmail(p.publisherUid);
  const when = `${p.booking.date} at ${formatSlot(p.booking.slot)} (WAT, ${p.booking.minutes} min)`;
  await sendEmail({
    to: p.email,
    subject: `Session confirmed — ${when}`,
    bell: { uid: p.uid, type: "booking", linkHref: "/bookings" },
    text: `Your ${p.booking.minutes}-minute session with @${p.booking.username} is confirmed for ${when}.\nPaid: ${formatNaira(p.amountKobo)}.\nReference: ${p.reference}\n\n#NotesApp`,
  });
  if (pubEmail) {
    await sendEmail({
      to: pubEmail,
      subject: `New booking — ${when}`,
      bell: { uid: p.publisherUid, type: "booking", linkHref: "/bookings" },
      text: `You have a new paid ${p.booking.minutes}-minute session on ${when}.\nClient: ${p.email}\nYour earnings (after ${Math.round(p.commissionRate * 100)}% commission) are released after the session.\nReference: ${p.reference}\n\n#NotesApp`,
    });
  }
}

async function notifyGiftShares(p: PaymentRecord, shares: Share[]) {
  const db = getAdminDb();
  const who = p.gift?.anonymous ? "Someone" : p.gift?.senderName || "A reader";
  const coGross = shares.slice(1).map((s) => Math.floor((p.amountKobo * s.percent) / 100));
  await Promise.all(
    shares.slice(1).map((s, i) =>
      db.collection("notifications").add({
        recipientUid: s.uid,
        type: "gift",
        message: `${who} sent a ${formatNaira(p.amountKobo)} gift on a post you co-wrote — your ${s.percent}% share is ${formatNaira(coGross[i] - Math.round(coGross[i] * s.rate))} after commission`,
        read: false,
        createdAt: new Date().toISOString(),
        linkHref: p.gift?.noteSlug ? `/journals/${p.gift.noteSlug}` : "/profile/publishing",
      })
    )
  );
}

async function notifyGift(p: PaymentRecord) {
  if (!p.gift) return;
  const db = getAdminDb();
  // Sent during a live: a line in its chat, "@ada gifted @emmanuel a Jollof Plate 🎁" (lib/room-events-server.ts). Anonymous stays so.
  if (p.gift.liveId) {
    const qtyN = p.gift.quantity ?? 1;
    const giftName = p.gift.animName ? (qtyN > 1 ? `${qtyN} × ${p.gift.animName}` : `a ${p.gift.animName}`) : `a gift of ${formatNaira(p.amountKobo)}`;
    const from = p.gift.anonymous ? "Someone" : await handleOf(db, p.uid).catch(() => p.gift!.senderName || "Someone");
    await postRoomEvent(db, p.gift.liveId, "gift", `${from} gifted @${p.gift.username} ${giftName} 🎁`).catch((e) => console.error("[gifts] live event", e));
  }
  // A grand gift: everyone on the app sees it announced, with a link to the live (lib/gifts-server.ts). Never blocks the rest.
  if (p.gift.animId) {
    await ensurePricing(); // the grand-gift price and the announce switch in force
    // Judged on one gift's price: a send of N is always of a premium gift, so it is never announced.
    await announceGrandGift(db, { reference: p.reference, giftId: p.gift.animId, name: p.gift.animName, priceKobo: Math.round(p.amountKobo / (p.gift.quantity ?? 1)), senderName: p.gift.anonymous ? "" : p.gift.senderName, toUid: p.publisherUid, toUsername: p.gift.username, liveId: p.gift.liveId })
      .catch((e) => console.error("[gifts] announcement failed", e));
  }
  const who = p.gift.anonymous ? "Someone" : p.gift.senderName || "A reader";
  const about = p.gift.noteSlug ? " on one of your posts" : "";
  const qty = p.gift.quantity ?? 1;
  const what = p.gift.animId ? `${qty > 1 ? `${qty} × ${p.gift.animName || "gift"}` : `a ${p.gift.animName || "gift"}`} (${formatNaira(p.amountKobo)})` : `a gift of ${formatNaira(p.amountKobo)}`;
  await db.collection("notifications").add({
    recipientUid: p.publisherUid,
    type: "gift",
    message: `${who} sent you ${what}${about}${p.gift.message ? ` — "${p.gift.message}"` : ""}`,
    ...(p.gift.animId ? { giftAnim: p.gift.animId, ...(qty > 1 ? { giftQty: qty } : {}) } : {}),
    read: false,
    createdAt: new Date().toISOString(),
    linkHref: p.gift.noteSlug ? `/journals/${p.gift.noteSlug}` : `/u/${p.gift.username}`,
  });
  // A bell only, never an email (owner, 7 Nov 2026: "every gift should trigger bell but not email"). The bell above is written for every
  // gift, whatever it is and however it was paid; co-authors get theirs in notifyGiftShares.
}

// A gift to a community: a bell to the giver (the receipt stays under My giving) and to the community's owner.
async function notifyGiving(p: PaymentRecord) {
  const g = p.giving!;
  // A gift to a community: bells only, never an email, to either side (owner, 7 Nov 2026: "no gift email, to any party"). The full receipt
  // (fund, charges, what the community receives, the receipt number) stays under My giving (/giving).
  await notifyBell({ uid: p.uid, type: "community", linkHref: "/giving", message: `Thank you: ${formatNaira(g.giftKobo)} to ${g.communityName} (${g.fund}). Your receipt is under My giving.` }).catch(() => {});
  await notifyBell({ uid: p.publisherUid, type: "community", linkHref: `/c/${g.cid}?tab=admin`, message: `${g.anonymous ? "Someone" : g.giverName} gave ${formatNaira(g.giftKobo)} to ${g.fund} in ${g.communityName}.` }).catch(() => {});
}

// Event tickets: the buyer's email lists the codes (the QR codes are on the Tickets page); the host hears about the sale.
async function notifyTickets(p: PaymentRecord) {
  const tk = p.ticket!;
  const codes = (await getAdminDb().collection("tickets").where("reference", "==", p.reference).get()).docs.map((d) => String(d.data().code));
  const shown = codes.map((c) => `${c.slice(0, 5)}-${c.slice(5)}`);
  const when = new Date(tk.startsAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "full", timeStyle: "short" });
  await sendEmail({
    to: p.email,
    subject: `Your tickets: ${tk.eventTitle}`,
    bell: { uid: p.uid, type: "event", linkHref: "/tickets", message: `Your ${tk.quantity} × ${tk.typeName} ${tk.quantity === 1 ? "ticket" : "tickets"} for ${tk.eventTitle} ${tk.quantity === 1 ? "is" : "are"} ready.` },
    text: `Thanks! ${tk.quantity} × ${tk.typeName} for ${tk.eventTitle}, ${when} (Lagos time). Paid: ${formatNaira(p.amountKobo)}.\n\nShow the QR code on each ticket at the door (open ${SITE_URL}/tickets on your phone), or read out the code:\n${shown.join("\n")}\n\nEach ticket lets one person in, once.\nReference: ${p.reference}\n\n#NotesApp`,
    action: { label: "My tickets", url: `${SITE_URL}/tickets` },
  });
  await notifyBell({ uid: p.publisherUid, type: "event", linkHref: `/events/${tk.eventId}/checkin`, message: `Sold: ${tk.quantity} × ${tk.typeName} for ${tk.eventTitle} (${formatNaira(p.amountKobo)}). Paid out after the event, less commission.` }).catch(() => {});
}
