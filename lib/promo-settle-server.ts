import type { Firestore } from "firebase-admin/firestore";
import { refundPayment } from "./refunds";
import { notifyBell, sendEmail } from "./email";
import { formatNaira } from "./booking-time";
import { deliveredByAd } from "./ads-server";

// Settling boosts and adverts when they end. The help centre, the Terms and the boost and advertise pages all promise that impressions
// not delivered by the end are refunded pro rata, the way the member paid (card or wallet). Until v0.138.1 that refund only happened
// when an admin pressed "Refund undelivered", so an ended boost or advert could show "Completed" with most of it undelivered and no
// refund. Now the scheduled job (app/api/cron/reminders) settles every ended one by itself; the admin buttons use the same code.
//
// A settlement runs once: it is claimed in a transaction (settlement: "settling") and finished with settledAt, so a second run, an
// admin click and the cron can never refund twice. If the refund fails, the claim is released and the next run tries again; after
// MAX_TRIES failures it is left for an admin (settleError says why) instead of being retried every 15 minutes.

export const MAX_TRIES = 5;
const BATCH = 25; // per kind, per run

type Refund = (reference: string, amountKobo: number) => Promise<void>;
export type SettleResult = { settled: boolean; refundKobo: number; delivered: number; purchased: number; reason?: string };

export const undeliveredShare = (amountKobo: number, purchased: number, delivered: number) =>
  Math.floor((amountKobo * Math.max(0, purchased - delivered)) / Math.max(1, purchased));

const lagosMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }).slice(0, 7);

// ---- boosts (boosts/{reference}; the payment has the same reference) ----

export function boostEnded(b: Record<string, unknown>, now = Date.now()): boolean {
  if (b.status === "completed") return true;
  return b.status === "active" && typeof b.endsAt === "string" && new Date(b.endsAt).getTime() <= now;
}

export async function settleBoost(db: Firestore, reference: string, opts: { refund?: Refund; by?: string; now?: number } = {}): Promise<SettleResult> {
  const ref = db.doc(`boosts/${reference}`);
  const now = opts.now ?? Date.now();
  const claimed = await db.runTransaction(async (t) => {
    const b = (await t.get(ref)).data();
    if (!b) return { skip: "not_found" as const };
    if (b.settledAt || b.status === "closed" || b.settlement === "settling") return { skip: "already" as const };
    if (!boostEnded(b, now)) return { skip: "running" as const };
    t.update(ref, { settlement: "settling" });
    return { b };
  });
  if ("skip" in claimed) return { settled: false, refundKobo: 0, delivered: 0, purchased: 0, reason: claimed.skip };
  const b = claimed.b;
  const purchased = Number(b.impressionsPurchased) || 0, delivered = Math.min(purchased, Number(b.impressionsDelivered) || 0);
  const refundKobo = undeliveredShare(Number(b.amountKobo) || 0, purchased, delivered);
  try {
    if (refundKobo > 0) await (opts.refund ?? refundPayment)(reference, refundKobo);
  } catch (e) {
    const tries = (Number(b.settleTries) || 0) + 1;
    await ref.update({ settlement: null, settleTries: tries, settleError: e instanceof Error ? e.message.slice(0, 300) : "Refund failed" });
    throw e;
  }
  const at = new Date(now).toISOString();
  await ref.update({
    status: "completed", completedAt: b.completedAt ?? at, settlement: "settled", settledAt: at, settledBy: opts.by ?? "auto",
    refundedKobo: refundKobo, settleError: null,
  });
  // Told only when money is going back: a fully delivered boost already shows "Completed", and old ones settled on the first run
  // shouldn't each send a bell.
  if (refundKobo > 0) {
    const title = String(b.title || "your boost");
    const message = `Your boost "${title}" has ended: ${delivered.toLocaleString()} of ${purchased.toLocaleString()} impressions were delivered, so ${formatNaira(refundKobo)} for the rest is on its way back to your card or wallet.`;
    await notifyBell({ uid: String(b.publisherUid), type: "plan", linkHref: "/profile/boosts", message }).catch(() => {});
  }
  return { settled: true, refundKobo, delivered, purchased };
}

// ---- adverts (adCampaigns/{id}; the payment has the same id) ----

export function adEnded(c: Record<string, unknown>, now = Date.now()): boolean {
  if (c.status === "completed") return true;
  return c.status === "live" && typeof c.endsAt === "string" && new Date(c.endsAt).getTime() < now;
}

export async function settleAdCampaign(db: Firestore, id: string, opts: { refund?: Refund; by?: string; now?: number; delivered?: (id: string) => Promise<number> } = {}): Promise<SettleResult> {
  const ref = db.doc(`adCampaigns/${id}`);
  const now = opts.now ?? Date.now();
  const claimed = await db.runTransaction(async (t) => {
    const c = (await t.get(ref)).data();
    if (!c) return { skip: "not_found" as const };
    if (c.settledAt || c.refundedKobo || c.settlement === "settling") return { skip: "already" as const };
    if (!adEnded(c, now)) return { skip: "running" as const };
    t.update(ref, { settlement: "settling" });
    return { c };
  });
  if ("skip" in claimed) return { settled: false, refundKobo: 0, delivered: 0, purchased: 0, reason: claimed.skip };
  const c = claimed.c;
  const purchased = Number(c.impressionsBudget) || 0;
  let delivered = 0;
  let refundKobo = 0;
  try {
    delivered = Math.min(purchased, opts.delivered ? await opts.delivered(id) : (await deliveredByAd([id]))[id]?.impressions ?? 0);
    refundKobo = undeliveredShare(Number(c.amountKobo) || 0, purchased, delivered);
    if (refundKobo > 0) await (opts.refund ?? refundPayment)(id, refundKobo);
  } catch (e) {
    const tries = (Number(c.settleTries) || 0) + 1;
    await ref.update({ settlement: null, settleTries: tries, settleError: e instanceof Error ? e.message.slice(0, 300) : "Refund failed" });
    throw e;
  }
  const at = new Date(now).toISOString();
  const batch = db.batch();
  if (refundKobo > 0) {
    // Keep the revenue books honest: a negative entry for the refunded part.
    batch.set(db.doc(`adRevenue/refund_${id}`), {
      month: lagosMonth(), source: "notesapp", label: `Refund (undelivered): ${String(c.advertiserName ?? "")}`, amountKobo: -refundKobo,
      note: id, campaignId: id, createdAt: at, createdBy: opts.by ?? "auto",
    });
  }
  batch.update(ref, {
    status: "completed", completedAt: c.completedAt ?? at, impressionsDelivered: delivered, refundedKobo: refundKobo,
    settlement: "settled", settledAt: at, settledBy: opts.by ?? "auto", settleError: null,
  });
  batch.set(db.doc(`adCreatives/${id}`), { active: false }, { merge: true });
  await batch.commit();
  if (refundKobo > 0) {
    const title = String((c.creative as { title?: string } | undefined)?.title || "your ad");
    const text = `Your campaign "${title}" has ended. It delivered ${delivered.toLocaleString()} of ${purchased.toLocaleString()} impressions, so ${formatNaira(refundKobo)} for the rest is being refunded the way you paid. A card refund can take several business days to reach your bank.\n\n#NotesApp`;
    if (c.email) {
      await sendEmail({ to: String(c.email), bell: c.uid ? { uid: String(c.uid), type: "ad", linkHref: "/advertise/campaigns" } : undefined, subject: "Your ad has ended: refund for undelivered impressions", text }).catch(() => {});
    } else if (c.uid) {
      await notifyBell({ uid: String(c.uid), type: "ad", linkHref: "/advertise/campaigns", message: text.split("\n")[0] }).catch(() => {});
    }
  }
  return { settled: true, refundKobo, delivered, purchased };
}

// ---- the scheduled sweep ----

export async function settleEndedPromotions(db: Firestore, opts: { refund?: Refund; now?: number; delivered?: (id: string) => Promise<number> } = {}): Promise<number> {
  const now = opts.now ?? Date.now();
  let n = 0;
  const due = (d: FirebaseFirestore.DocumentData) => !d.settledAt && d.settlement !== "settling" && (Number(d.settleTries) || 0) < MAX_TRIES;
  const boosts = await db.collection("boosts").where("status", "in", ["active", "completed"]).get();
  for (const s of boosts.docs.filter((s) => due(s.data()) && boostEnded(s.data(), now)).slice(0, BATCH)) {
    try { if ((await settleBoost(db, s.id, { refund: opts.refund, now })).settled) n++; } catch (e) { console.error("settle boost", s.id, e); }
  }
  const ads = await db.collection("adCampaigns").where("status", "in", ["live", "completed"]).get();
  for (const s of ads.docs.filter((s) => due(s.data()) && !s.data().refundedKobo && adEnded(s.data(), now)).slice(0, BATCH)) {
    try { if ((await settleAdCampaign(db, s.id, { refund: opts.refund, now, delivered: opts.delivered })).settled) n++; } catch (e) { console.error("settle ad", s.id, e); }
  }
  return n;
}
