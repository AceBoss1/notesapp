import { getAdminDb } from "./firebase-admin";
import { ttlCache } from "./ttl-cache";
import type { AdCreative } from "./ads";

// Impressions delivered so far per ad id (sums the daily adStats docs).
export async function deliveredByAd(ids: string[]): Promise<Record<string, { impressions: number; clicks: number }>> {
  const out: Record<string, { impressions: number; clicks: number }> = {};
  const db = getAdminDb();
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await db.collection("adStats").where("adId", "in", ids.slice(i, i + 30)).get();
    for (const d of snap.docs) {
      const x = d.data();
      const t = (out[x.adId] ||= { impressions: 0, clicks: 0 });
      t.impressions += Number(x.impressions) || 0;
      t.clicks += Number(x.clicks) || 0;
    }
  }
  return out;
}

// Active house creatives, one Firestore read per instance per 5 minutes. Paid
// campaigns (campaignId set) stop automatically once their impression budget is
// delivered or their window ends — they're marked completed here, lazily. Delivery
// can overshoot by whatever is served inside one cache window (a few minutes).
export const loadActiveAds = ttlCache(5 * 60_000, async () => {
  const db = getAdminDb();
  const snap = await db.collection("adCreatives").where("active", "==", true).get();
  const all = snap.docs.map((d) => ({ provider: "notesapp", ...d.data(), id: d.id }) as AdCreative & { campaignId?: string; impressionsBudget?: number });
  const campaigns = all.filter((a) => a.campaignId);
  if (campaigns.length === 0) return all;

  const delivered = await deliveredByAd(campaigns.map((c) => c.id));
  const now = Date.now();
  const done = new Set<string>();
  for (const c of campaigns) {
    const d = delivered[c.id]?.impressions ?? 0;
    const over = (c.impressionsBudget ?? Infinity) <= d || (c.endsAt ? new Date(c.endsAt).getTime() < now : false);
    if (!over) continue;
    done.add(c.id);
    db.doc(`adCreatives/${c.id}`).update({ active: false }).catch(() => {});
    db.doc(`adCampaigns/${c.id}`).update({ status: "completed", completedAt: new Date().toISOString(), impressionsDelivered: d }).catch(() => {});
  }
  return all.filter((a) => !done.has(a.id));
});

export const lagosDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }).replace(/-/g, ""); // YYYYMMDD
