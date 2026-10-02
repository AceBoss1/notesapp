import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getUserEmail } from "./firebase-admin";
import { slotLockId, verifyTransaction, pricePaidKobo } from "./paystack";
import { commissionRateFor } from "./tiers";
import { sessionEnd, sessionStart, formatSlot, formatNaira } from "./booking-time";
import { sendEmail } from "./email";
import type { AccountTier } from "./users";
import { getBoostPackage } from "./boost-config";
import { periodEndFrom, cancelBadgeIfCovered } from "./tier-billing";

// Server-only. All money-state changes happen here, via the Admin SDK
// (Firestore rules make payments/bookings/ledger/subscriptions
// unwritable from browsers).

export type PaymentRecord = {
  reference: string;
  kind: "booking" | "subscription" | "boost" | "gift" | "tier" | "badge" | "gold_deposit" | "gold" | "merch" | "ad";
  uid: string; // the payer
  email: string;
  amountKobo: number;
  status: "pending" | "paid" | "paid_slot_conflict" | "refunded";
  publisherUid: string;
  publisherUsername: string;
  commissionRate: number; // NotesApp's cut, 0–1, fixed at checkout time
  booking?: { username: string; date: string; slot: string; minutes: number };
  subscription?: { username: string; planCode: string };
  boost?: { noteId: string; packageId: string };
  tier?: { tier: "pro" | "business"; interval: "monthly" | "annually"; planCode: string };
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
  gold?: { kind: "endorsement" | "identity"; track: "personal" | "corporate"; planCode?: string };
  gift?: { username: string; noteId?: string; noteSlug?: string; message: string; anonymous: boolean; senderName: string };
  createdAt: string;
  paidAt?: string;
};

// held      = collected, waiting for releaseAfter (session end / dispute window)
// disputed  = admin froze it (no-show, complaint)
// transferring / paid_out = payout to the publisher's bank
// refunded  = returned to the payer
export type LedgerStatus = "held" | "disputed" | "transferring" | "paid_out" | "refunded";

export type LedgerEntry = {
  reference: string; // ledger doc id (the payment reference, or `<ref>_<uid>` for a co-author's share)
  paymentReference?: string; // the Paystack payment this entry belongs to (set on split entries)
  sharePercent?: number; // this author's % of a co-authored post's gift
  kind: "booking" | "subscription" | "gift" | "adshare";
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

export { commissionRateFor };

function ledgerFor(p: PaymentRecord, grossKobo: number, releaseAfter: Date, now: string): LedgerEntry {
  const commissionKobo = Math.round(grossKobo * p.commissionRate);
  return {
    reference: p.reference,
    kind: p.kind as LedgerEntry["kind"], // boosts never reach the ledger
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
    const u = (await db.doc(`users/${i.inviteeUid}`).get()).data();
    if (!u || u.suspended) continue; // their share stays with the lead
    co.push({ uid: i.inviteeUid, username: i.inviteeUsername, percent: Number(i.percent), rate: commissionRateFor((u.accountTier as AccountTier) || "basic") });
  }
  if (!co.length) return [lead];
  lead.percent = 100 - co.reduce((s, c) => s + c.percent, 0);
  return [lead, ...co];
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
  if (pricePaidKobo(tx) !== payment.amountKobo || tx.currency !== "NGN") {
    // Keep the evidence (a plan-based charge uses the PLAN's amount, so a stale
    // plan shows up here) and say exactly what differed.
    const detail = { kind: payment.kind, expectedKobo: payment.amountKobo, paidKobo: tx.amount, requestedKobo: tx.requested_amount ?? null, feesKobo: tx.fees ?? null, currency: tx.currency };
    console.error("Paystack amount mismatch", reference, detail);
    await payRef.update({ mismatch: { ...detail, at: new Date().toISOString() } }).catch(() => {});
    throw new Error(
      `Paid amount does not match the price (expected ${formatNaira(payment.amountKobo)}, Paystack charged ${formatNaira(pricePaidKobo(tx))} ${tx.currency}).`
    );
  }

  const now = new Date().toISOString();
  const shares = payment.kind === "gift" ? await giftShares(payment) : [];
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
    } else if (current.kind === "boost" && current.boost) {
      // Boosts are platform revenue: no ledger entry, just an active campaign.
      const pk = getBoostPackage(current.boost.packageId);
      if (!pk) throw new Error("Unknown boost package");
      const note = (await t.get(db.doc(`notes/${current.boost.noteId}`))).data();
      t.set(db.doc(`boosts/${reference}`), {
        reference,
        noteId: current.boost.noteId,
        slug: note?.slug || "",
        title: note?.title || "",
        author: note?.author || "",
        image: note?.featured_image || "",
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
      t.set(db.doc(`users/${current.uid}`), { accountTier: tr.tier, trialUntil: FieldValue.delete(), trialTier: FieldValue.delete(), trialReminderSent: FieldValue.delete() }, { merge: true });
      t.set(db.doc(`tierSubscriptions/${current.uid}`), {
        uid: current.uid,
        email: current.email,
        tier: tr.tier,
        interval: tr.interval,
        planCode: tr.planCode,
        status: "active",
        subscribedAt: now,
        currentPeriodEnd: periodEndFrom(Date.now(), tr.interval),
      });
    } else if (current.kind === "badge" && current.badge) {
      const end = periodEndFrom(Date.now(), "monthly");
      t.set(db.doc(`users/${current.uid}`), { badgeUntil: end }, { merge: true });
      t.set(db.doc(`badgeSubscriptions/${current.uid}`), {
        uid: current.uid,
        email: current.email,
        planCode: current.badge.planCode,
        status: "active",
        subscribedAt: now,
        currentPeriodEnd: end,
      });
    } else if (current.kind === "merch" && current.merch) {
      // Official merch is platform revenue (no ledger). One order per payment,
      // collected into a pre-order batch for admin fulfilment.
      t.set(db.doc(`merchOrders/${reference}`), {
        reference,
        uid: current.uid,
        email: current.email,
        ...current.merch,
        amountKobo: current.amountKobo,
        status: "preordered",
        createdAt: now,
      });
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
    if (shares.length > 1 && result.payment.gift) await notifyGiftShares(result.payment, shares).catch((e) => console.error("notifyGiftShares failed", e));
    if (result.payment.kind === "tier" && result.payment.tier?.tier === "business") {
      await cancelBadgeIfCovered(result.payment.uid);
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
    ledgerFor(payment, pricePaidKobo(tx), new Date(now.getTime() + SUBSCRIPTION_HOLD_DAYS * 86_400_000), now.toISOString())
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
  if (p.kind === "gift" && p.gift) return notifyGift(p);
  if (p.kind === "badge") {
    await sendEmail({
      to: p.email,
      subject: "Your #NotesApp verified badge is active",
      text: `The ✔ now shows next to your name (${formatNaira(p.amountKobo)}/month, renews automatically). Cancel any time under Edit profile — you keep the badge until the period ends.\nReference: ${p.reference}\n\n#NotesApp`,
    });
    return;
  }
  if (p.kind === "ad" && p.ad) {
    await sendEmail({
      to: p.email,
      subject: "Your #NotesApp ad campaign is in review",
      text: `Thanks — we received ${formatNaira(p.amountKobo)} for your ad campaign. We review every ad before it goes live (usually within a day). If we can't run it you'll get a full refund. Track it any time at ${process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng"}/advertise/campaigns.\nReference: ${p.reference}\n\n#NotesApp`,
    });
    return;
  }
  if (p.kind === "merch" && p.merch) {
    const m = p.merch;
    await sendEmail({
      to: p.email,
      subject: "Your #NotesApp merch pre-order is confirmed",
      text: `Thanks! ${m.quantity} × ${m.itemName}${m.size ? ` (${m.size})` : ""} with the ${m.logoLabel} logo — ${formatNaira(p.amountKobo)} including delivery.\nDelivering to ${m.address.fullName}, ${m.address.street}, ${m.address.city}, ${m.address.state}.\nWe print after the batch closes and deliver within about 3 weeks of closing. You can ask for a refund before the batch is printed.\nReference: ${p.reference}\n\n#NotesApp`,
    });
    return;
  }
  if (p.kind === "gold_deposit") {
    await sendEmail({
      to: p.email,
      subject: "We received your #NotesApp identity-check deposit",
      text: `Thanks — your ${formatNaira(p.amountKobo)} deposit (non-refundable; it covers the third-party check) is received and your gold badge application is now in review. We'll update the status on the badges page.\nReference: ${p.reference}\n\n#NotesApp`,
    });
    return;
  }
  if (p.kind === "gold") {
    await sendEmail({
      to: p.email,
      subject: "Your #NotesApp gold badge is active",
      text: `The gold ✔ now shows next to your name (${formatNaira(p.amountKobo)}/month, renews automatically). Cancel any time on the badges page — you keep it until the period ends.\nReference: ${p.reference}\n\n#NotesApp`,
    });
    return;
  }
  if (p.kind === "tier" && p.tier) {
    const name = p.tier.tier === "pro" ? "Pro" : "Business";
    await sendEmail({
      to: p.email,
      subject: `Welcome to #NotesApp ${name}`,
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
    text: `Your ${p.booking.minutes}-minute session with @${p.booking.username} is confirmed for ${when}.\nPaid: ${formatNaira(p.amountKobo)}.\nReference: ${p.reference}\n\n#NotesApp`,
  });
  if (pubEmail) {
    await sendEmail({
      to: pubEmail,
      subject: `New booking — ${when}`,
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
  const who = p.gift.anonymous ? "Someone" : p.gift.senderName || "A reader";
  const net = p.amountKobo - Math.round(p.amountKobo * p.commissionRate);
  const about = p.gift.noteSlug ? " on one of your posts" : "";
  await db.collection("notifications").add({
    recipientUid: p.publisherUid,
    type: "gift",
    message: `${who} sent you a gift of ${formatNaira(p.amountKobo)}${about}${p.gift.message ? ` — "${p.gift.message}"` : ""}`,
    read: false,
    createdAt: new Date().toISOString(),
    linkHref: p.gift.noteSlug ? `/journals/${p.gift.noteSlug}` : `/u/${p.gift.username}`,
  });
  const pubEmail = await getUserEmail(p.publisherUid);
  if (pubEmail) {
    await sendEmail({
      to: pubEmail,
      subject: `You received a ${formatNaira(p.amountKobo)} gift`,
      text: `${who} sent you a gift of ${formatNaira(p.amountKobo)}${about}.${p.gift.message ? `\n\n"${p.gift.message}"` : ""}\n\nYour share after commission (${formatNaira(net)}) is released after a 7-day dispute window, to your verified bank account.\nReference: ${p.reference}\n\n#NotesApp`,
    });
  }
}
