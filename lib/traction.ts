// Platform-wide traction numbers for decks and applications. Pure functions: the admin API gathers
// the documents, this module counts them (so the maths is testable without a database).
export type TractionInput = {
  users: { uid: string; role?: string; accountTier?: string; accountKind?: string; createdAt?: string; goldBadge?: unknown; suspended?: boolean }[];
  storeItems: { ownerUid: string; kind?: string; sellable?: boolean }[];
  payments: { kind: string; status: string; amountKobo: number; uid: string; paidAt?: string; createdAt?: string }[];
  ledger: { kind?: string; status: string; netKobo?: number; commissionKobo?: number }[];
  bookings: { status: string; startsAt?: string }[];
  storeOrders: { status: string }[];
  digitalPurchases: number;
  merchOrders: { status: string }[];
  boosts: number;
  adCampaigns: { status: string }[];
  now?: number;
};

export type Traction = {
  generatedAt: string;
  people: { registered: number; newLast30Days: number; publishers: number; paidPlans: number; organisations: number; goldBadges: number; sellers: number; itemsPhysical: number; itemsDigital: number };
  activity: { sessionsBooked: number; sessionsCompleted: number; storeOrders: number; storeOrdersDelivered: number; digitalSales: number; merchPreorders: number; boosts: number; adCampaigns: number };
  money: {
    paidCount: number; processedKobo: number; processedLast30DaysKobo: number; payingCustomers: number;
    refundedCount: number; refundedKobo: number; commissionKobo: number;
    payoutsCount: number; payoutsKobo: number; inEscrowKobo: number; inEscrowCount: number;
    byKind: { kind: string; count: number; kobo: number }[];
  };
  months: { month: string; signups: number; processedKobo: number }[];
};

const PAID_PLANS = ["pro", "business", "enterprise"];
const monthOf = (iso?: string) => (iso || "").slice(0, 7);

export function computeTraction(i: TractionInput): Traction {
  const now = i.now ?? Date.now();
  const d30 = now - 30 * 86_400_000;
  const at = (iso?: string) => (iso ? new Date(iso).getTime() : NaN);

  const sellers = new Set(i.storeItems.filter((s) => s.sellable !== false).map((s) => s.ownerUid));
  const paid = i.payments.filter((p) => p.status === "paid");
  const byKind = new Map<string, { count: number; kobo: number }>();
  for (const p of paid) {
    const k = byKind.get(p.kind) ?? { count: 0, kobo: 0 };
    k.count++;
    k.kobo += p.amountKobo || 0;
    byKind.set(p.kind, k);
  }
  const refunded = i.payments.filter((p) => p.status === "refunded");
  const live = i.ledger.filter((l) => l.status !== "refunded");
  const sum = (xs: { netKobo?: number }[]) => xs.reduce((a, l) => a + (l.netKobo || 0), 0);
  const escrow = i.ledger.filter((l) => ["held", "disputed", "transferring"].includes(l.status));
  const paidOut = i.ledger.filter((l) => l.status === "paid_out");

  // Last six calendar months, oldest first.
  const months: Traction["months"] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - m);
    const key = d.toISOString().slice(0, 7);
    months.push({
      month: key,
      signups: i.users.filter((u) => monthOf(u.createdAt) === key).length,
      processedKobo: paid.filter((p) => monthOf(p.paidAt || p.createdAt) === key).reduce((a, p) => a + (p.amountKobo || 0), 0),
    });
  }

  return {
    generatedAt: new Date(now).toISOString(),
    people: {
      registered: i.users.length,
      newLast30Days: i.users.filter((u) => at(u.createdAt) >= d30).length,
      publishers: i.users.filter((u) => u.accountTier !== "standard" || ["staff", "volunteer", "admin"].includes(u.role || "")).length,
      paidPlans: i.users.filter((u) => PAID_PLANS.includes(u.accountTier || "")).length,
      organisations: i.users.filter((u) => u.accountKind === "organisation").length,
      goldBadges: i.users.filter((u) => !!u.goldBadge && !u.suspended).length,
      sellers: sellers.size,
      itemsPhysical: i.storeItems.filter((s) => s.kind !== "digital").length,
      itemsDigital: i.storeItems.filter((s) => s.kind === "digital").length,
    },
    activity: {
      sessionsBooked: i.bookings.filter((b) => !b.status.startsWith("cancel") && b.status !== "refunded").length,
      sessionsCompleted: i.bookings.filter((b) => b.status === "confirmed" && at(b.startsAt) < now).length,
      storeOrders: i.storeOrders.filter((o) => o.status !== "refunded").length,
      storeOrdersDelivered: i.storeOrders.filter((o) => ["delivered", "confirmed"].includes(o.status)).length,
      digitalSales: i.digitalPurchases,
      merchPreorders: i.merchOrders.filter((o) => o.status !== "refunded").length,
      boosts: i.boosts,
      adCampaigns: i.adCampaigns.filter((c) => ["live", "completed"].includes(c.status)).length,
    },
    money: {
      paidCount: paid.length,
      processedKobo: paid.reduce((a, p) => a + (p.amountKobo || 0), 0),
      processedLast30DaysKobo: paid.filter((p) => at(p.paidAt || p.createdAt) >= d30).reduce((a, p) => a + (p.amountKobo || 0), 0),
      payingCustomers: new Set(paid.map((p) => p.uid)).size,
      refundedCount: refunded.length,
      refundedKobo: refunded.reduce((a, p) => a + (p.amountKobo || 0), 0),
      commissionKobo: live.reduce((a, l) => a + (l.commissionKobo || 0), 0),
      payoutsCount: paidOut.length,
      payoutsKobo: sum(paidOut),
      inEscrowKobo: sum(escrow),
      inEscrowCount: escrow.length,
      byKind: [...byKind.entries()].map(([kind, v]) => ({ kind, ...v })).sort((a, b) => b.kobo - a.kobo),
    },
    months,
  };
}

const ngn = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;

// A few plain lines to paste into a deck or an application form.
export function summaryText(t: Traction): string {
  const p = t.people, a = t.activity, m = t.money;
  return [
    `As of ${t.generatedAt.slice(0, 10)}:`,
    `• ${p.registered.toLocaleString()} registered users (${p.newLast30Days.toLocaleString()} in the last 30 days), ${p.publishers.toLocaleString()} publishers, ${p.sellers.toLocaleString()} sellers with ${(p.itemsPhysical + p.itemsDigital).toLocaleString()} items listed, ${p.organisations.toLocaleString()} organisations, ${p.goldBadges.toLocaleString()} gold-verified accounts.`,
    `• ${m.paidCount.toLocaleString()} paid transactions from ${m.payingCustomers.toLocaleString()} paying customers, ${ngn(m.processedKobo)} processed (${ngn(m.processedLast30DaysKobo)} in the last 30 days).`,
    `• ${a.storeOrders.toLocaleString()} store orders (${a.storeOrdersDelivered.toLocaleString()} delivered), ${a.digitalSales.toLocaleString()} digital sales, ${a.sessionsBooked.toLocaleString()} sessions booked (${a.sessionsCompleted.toLocaleString()} held), ${a.merchPreorders.toLocaleString()} merch pre-orders.`,
    `• ${ngn(m.payoutsKobo)} paid out to sellers and publishers in ${m.payoutsCount.toLocaleString()} payouts; ${ngn(m.inEscrowKobo)} currently held in escrow.`,
  ].join("\n");
}

export function tractionCsv(t: Traction): string {
  const rows: [string, string | number][] = [
    ["generated_at", t.generatedAt],
    ...Object.entries(t.people).map(([k, v]) => [`people.${k}`, v] as [string, number]),
    ...Object.entries(t.activity).map(([k, v]) => [`activity.${k}`, v] as [string, number]),
    ...Object.entries(t.money).filter(([k]) => k !== "byKind").map(([k, v]) => [`money.${k}${k.endsWith("Kobo") ? "" : ""}`, v as number] as [string, number]),
    ...t.money.byKind.flatMap((k) => [[`money.kind.${k.kind}.count`, k.count], [`money.kind.${k.kind}.kobo`, k.kobo]] as [string, number][]),
    ...t.months.flatMap((m) => [[`month.${m.month}.signups`, m.signups], [`month.${m.month}.processedKobo`, m.processedKobo]] as [string, number][]),
  ];
  return ["metric,value", ...rows.map(([k, v]) => `${k},${v}`)].join("\n");
}
