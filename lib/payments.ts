import { getAdminDb } from "./firebase-admin";
import { slotLockId, verifyTransaction } from "./paystack";
import { getTierConfig } from "./tiers";
import { sessionEnd, sessionStart, formatSlot, formatNaira } from "./booking-time";
import { sendEmail } from "./email";
import type { AccountTier } from "./users";

// Server-only. All money-state changes happen here, via the Admin SDK
// (Firestore rules make payments/bookings/ledger/subscriptions
// unwritable from browsers).

export type PaymentRecord = {
  reference: string;
  kind: "booking" | "subscription";
  uid: string; // the payer
  email: string;
  amountKobo: number;
  status: "pending" | "paid" | "paid_slot_conflict" | "refunded";
  publisherUid: string;
  publisherUsername: string;
  commissionRate: number; // NotesApp's cut, 0–1, fixed at checkout time
  booking?: { username: string; date: string; slot: string; minutes: number };
  subscription?: { username: string; planCode: string };
  createdAt: string;
  paidAt?: string;
};

// held      = collected, waiting for releaseAfter (session end / dispute window)
// disputed  = admin froze it (no-show, complaint)
// transferring / paid_out = payout to the publisher's bank
// refunded  = returned to the payer
export type LedgerStatus = "held" | "disputed" | "transferring" | "paid_out" | "refunded";

export type LedgerEntry = {
  reference: string;
  kind: "booking" | "subscription";
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
  failureReason?: string;
};

const SUBSCRIPTION_HOLD_DAYS = 7; // dispute window before subscription earnings can be paid out
const PERIOD_DAYS = 31;

export function commissionRateFor(tier: AccountTier): number {
  const c = getTierConfig(tier).sessionAndUnlockCommission;
  // Enterprise is negotiated per account; until an override exists, use the floor.
  return c === "custom" ? getTierConfig(tier).sessionAndUnlockCommissionFloor ?? 0.05 : c;
}

function ledgerFor(p: PaymentRecord, grossKobo: number, releaseAfter: Date, now: string): LedgerEntry {
  const commissionKobo = Math.round(grossKobo * p.commissionRate);
  return {
    reference: p.reference,
    kind: p.kind,
    publisherUid: p.publisherUid,
    publisherUsername: p.publisherUsername,
    payerUid: p.uid,
    grossKobo,
    commissionKobo,
    netKobo: grossKobo - commissionKobo,
    status: "held",
    releaseAfter: releaseAfter.toISOString(),
    createdAt: now,
  };
}

// Idempotent — called by the redirect-verify route and the webhook,
// in whichever order they land. Confirms with Paystack itself, checks
// the amount against what we recorded server-side, then writes
// everything in one transaction.
export async function fulfillPayment(reference: string): Promise<PaymentRecord> {
  const db = getAdminDb();
  const payRef = db.doc(`payments/${reference}`);
  const snap = await payRef.get();
  if (!snap.exists) throw new Error("Unknown payment reference");
  const payment = snap.data() as PaymentRecord;
  if (payment.status !== "pending") return payment;

  const tx = await verifyTransaction(reference);
  if (tx.status !== "success") throw new Error(`Payment not successful (${tx.status})`);
  if (tx.amount !== payment.amountKobo || tx.currency !== "NGN") {
    throw new Error("Paid amount does not match the price");
  }

  const now = new Date().toISOString();
  const result = await db.runTransaction(async (t) => {
    const freshPay = await t.get(payRef);
    const current = freshPay.data() as PaymentRecord;
    if (current.status !== "pending") return { payment: current, fresh: false };

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
    } else if (current.kind === "subscription" && current.subscription) {
      const { username, planCode } = current.subscription;
      const subRef = db.doc(`subscriptions/${current.uid}_${username}`);
      t.set(subRef, {
        subscriberUid: current.uid,
        subscriberEmail: current.email,
        username,
        planCode,
        status: "active",
        subscribedAt: now,
        currentPeriodEnd: new Date(Date.now() + PERIOD_DAYS * 86_400_000).toISOString(),
      });
      const hold = new Date(Date.now() + SUBSCRIPTION_HOLD_DAYS * 86_400_000);
      t.set(db.doc(`ledger/${reference}`), ledgerFor(current, current.amountKobo, hold, now));
    }
    t.update(payRef, { status: "paid", paidAt: now });
    return { payment: { ...current, status: "paid" as const, paidAt: now }, fresh: true };
  });

  if (result.fresh && result.payment.status === "paid") {
    await notifyPaid(result.payment).catch((e) => console.error("notifyPaid failed", e));
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
    amountKobo: tx.amount,
    status: "paid",
    publisherUid,
    publisherUsername: sub.username,
    commissionRate: commissionRateFor((user?.accountTier as AccountTier) || "basic"),
    subscription: { username: sub.username, planCode },
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
    ledgerFor(payment, tx.amount, new Date(now.getTime() + SUBSCRIPTION_HOLD_DAYS * 86_400_000), now.toISOString())
  );
  await batch.commit();
}

export async function markSubscriptionCancelled(planCode: string, email: string): Promise<void> {
  const subs = await getAdminDb()
    .collection("subscriptions")
    .where("planCode", "==", planCode)
    .where("subscriberEmail", "==", email)
    .get();
  await Promise.all(subs.docs.map((d) => d.ref.update({ status: "cancelled" })));
}

async function notifyPaid(p: PaymentRecord) {
  if (p.kind !== "booking" || !p.booking) return;
  const db = getAdminDb();
  const pubUser = (await db.doc(`users/${p.publisherUid}`).get()).data();
  const when = `${p.booking.date} at ${formatSlot(p.booking.slot)} (WAT, ${p.booking.minutes} min)`;
  await sendEmail({
    to: p.email,
    subject: `Session confirmed — ${when}`,
    text: `Your ${p.booking.minutes}-minute session with @${p.booking.username} is confirmed for ${when}.\nPaid: ${formatNaira(p.amountKobo)}.\nReference: ${p.reference}\n\n#NotesApp`,
  });
  if (pubUser?.email) {
    await sendEmail({
      to: pubUser.email,
      subject: `New booking — ${when}`,
      text: `You have a new paid ${p.booking.minutes}-minute session on ${when}.\nClient: ${p.email}\nYour earnings (after ${Math.round(p.commissionRate * 100)}% commission) are released after the session.\nReference: ${p.reference}\n\n#NotesApp`,
    });
  }
}
