// Platform revenue accounting (server + admin page). One place defines what
// counts as NotesApp revenue so every number on /admin/revenue agrees:
//   commission streams  — sessions, subscriptions, gifts: revenue = the
//                         commission taken (ledger.commissionKobo); the rest
//                         belongs to the publisher.
//   full streams        — boosts, plans, badges, gold, merch, ads: 100% is ours.
// Not deducted: Paystack fees (customers bear them), merch cost of goods.
// Refunded payments are excluded; a boost's undelivered-impression refund is
// subtracted from boost revenue.
export type StreamId = "sessions" | "subscriptions" | "gifts" | "boosts" | "plans" | "badges" | "gold" | "merch" | "ads";

export const STREAMS: Record<StreamId, { label: string; model: "commission" | "full"; live: boolean }> = {
  sessions: { label: "Paid sessions", model: "commission", live: true },
  subscriptions: { label: "Journal subscriptions", model: "commission", live: true },
  gifts: { label: "Gifts", model: "commission", live: true },
  boosts: { label: "Post boosts", model: "full", live: true },
  plans: { label: "Pro / Business plans", model: "full", live: true },
  badges: { label: "Verified badge add-on", model: "full", live: true },
  gold: { label: "Gold badge (deposits + monthly)", model: "full", live: true },
  merch: { label: "Merch pre-orders", model: "full", live: true },
  ads: { label: "Ads (house + networks)", model: "full", live: false },
};

const KIND_TO_STREAM: Record<string, StreamId> = {
  booking: "sessions",
  subscription: "subscriptions",
  gift: "gifts",
  boost: "boosts",
  tier: "plans",
  badge: "badges",
  gold: "gold",
  gold_deposit: "gold",
  merch: "merch",
};

export type PaymentLite = { reference: string; kind: string; status: string; amountKobo: number; paidAt?: string; createdAt?: string };
export type ChargeLite = { reference: string; kind?: string; amountKobo: number; at: string };

export type StreamTotals = { count: number; grossKobo: number; revenueKobo: number };
export type RevenueReport = {
  days: number; // 0 = all time
  streams: Record<StreamId, StreamTotals>;
  totals: { revenueKobo: number; grossKobo: number; count: number; refundedKobo: number; refundedCount: number };
  series: { key: string; revenueKobo: number }[];
  seriesUnit: "day" | "month";
};

const empty = (): StreamTotals => ({ count: 0, grossKobo: 0, revenueKobo: 0 });

export function computeRevenue(input: {
  payments: PaymentLite[];
  commissionByRef: Record<string, number>; // ledger commissions
  boostRefundByRef: Record<string, number>; // boosts.refundedKobo
  charges: ChargeLite[]; // plan / badge / gold renewals
  days: number;
  now?: number;
}): RevenueReport {
  const now = input.now ?? Date.now();
  const since = input.days > 0 ? now - input.days * 86_400_000 : 0;
  const streams = Object.fromEntries((Object.keys(STREAMS) as StreamId[]).map((s) => [s, empty()])) as Record<StreamId, StreamTotals>;
  const totals = { revenueKobo: 0, grossKobo: 0, count: 0, refundedKobo: 0, refundedCount: 0 };
  const byBucket = new Map<string, number>();
  const unit: "day" | "month" = input.days > 0 && input.days <= 90 ? "day" : "month";

  const add = (stream: StreamId, whenIso: string | undefined, gross: number, revenue: number) => {
    const t = whenIso ? new Date(whenIso).getTime() : NaN;
    if (!Number.isFinite(t) || t < since || t > now) return;
    const s = streams[stream];
    s.count += 1;
    s.grossKobo += gross;
    s.revenueKobo += revenue;
    totals.count += 1;
    totals.grossKobo += gross;
    totals.revenueKobo += revenue;
    const d = new Date(t).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }); // YYYY-MM-DD
    const key = unit === "day" ? d : d.slice(0, 7);
    byBucket.set(key, (byBucket.get(key) ?? 0) + revenue);
  };

  for (const p of input.payments) {
    const stream = KIND_TO_STREAM[p.kind];
    if (!stream) continue;
    const when = p.paidAt || p.createdAt;
    if (p.status === "refunded") {
      const t = when ? new Date(when).getTime() : NaN;
      if (Number.isFinite(t) && t >= since && t <= now) {
        totals.refundedKobo += p.amountKobo;
        totals.refundedCount += 1;
      }
      continue;
    }
    if (p.status !== "paid") continue; // pending, or paid_slot_conflict (refund due)
    const revenue =
      STREAMS[stream].model === "commission"
        ? input.commissionByRef[p.reference] ?? 0
        : p.amountKobo - (stream === "boosts" ? input.boostRefundByRef[p.reference] ?? 0 : 0);
    add(stream, when, p.amountKobo, revenue);
  }

  for (const c of input.charges) {
    const stream: StreamId = c.kind === "badge" ? "badges" : c.kind === "gold" ? "gold" : "plans";
    add(stream, c.at, c.amountKobo, c.amountKobo);
  }

  const series = [...byBucket.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, revenueKobo]) => ({ key, revenueKobo }));
  return { days: input.days, streams, totals, series, seriesUnit: unit };
}
