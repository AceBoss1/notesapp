"use client";

import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/booking-time";
import { FAN_DEFAULTS, SUB_TIERS, TIER_NAME, tierRangeKobo, tierRate, tierUplift, type FanSettings, type SubTier } from "@/lib/fans";
import { useMyRates } from "@/components/MyCommission";
import { TierChip } from "@/components/fans/FanBadges";

// The creator's subscription tiers (Rates & payouts): a price for each tier they offer, within the ranges set in Admin → Limits →
// Subscriptions and fans, with what #NotesApp takes on each (their rate, plus a share of it on VIP and VVIP) and what they keep. Beside
// each price, the discount that tier's subscribers get on the creator's paid-live tickets (v0.141.0, lib/live-tickets.ts), up to the cap
// set in Admin → Limits → Audio rooms → Paid lives.
export type TierForm = Record<SubTier, { on: boolean; price: string; discount: string }>;

export default function TierSettings({ value, onChange, counts }: { value: TierForm; onChange: (v: TierForm) => void; counts?: Partial<Record<SubTier, number>> }) {
  const [s, setS] = useState<FanSettings>(FAN_DEFAULTS);
  const rates = useMyRates();
  const [cap, setCap] = useState<number | null>(null);
  useEffect(() => { fetch("/api/fans/settings").then((r) => r.json()).then((j) => j.settings && setS(j.settings)).catch(() => {}); }, []);
  useEffect(() => { fetch("/api/lives?figures=1").then((r) => r.json()).then((j) => typeof j.figures?.discountMaxPct === "number" && setCap(j.figures.discountMaxPct)).catch(() => {}); }, []);
  const rate = rates?.session ?? null;
  const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;
  return (
    <div className="mt-4 w-full max-w-full overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead><tr className="bg-crimson text-left text-[13px] text-white"><th className="px-3 py-2">Tier</th><th className="px-3 py-2">Offer</th><th className="px-3 py-2">Your price / month</th><th className="px-3 py-2">Paid-live ticket discount</th><th className="px-3 py-2">#NotesApp takes</th><th className="px-3 py-2">You keep</th>{counts && <th className="px-3 py-2">Subscribers</th>}</tr></thead>
        <tbody>
          {SUB_TIERS.map((t, i) => {
            const { minKobo, maxKobo } = tierRangeKobo(t, s);
            const kobo = Math.round(Number(value[t].price) * 100) || 0;
            const r = rate === null ? null : tierRate(rate, t, s);
            const take = r === null ? null : Math.round(kobo * r);
            return (
              <tr key={t} className={i % 2 ? "bg-[#fbf6f2]" : "bg-white"}>
                <td className="px-3 py-2"><span className="flex items-center gap-2"><TierChip tier={t} /> <b>{TIER_NAME[t]}</b></span></td>
                <td className="px-3 py-2"><input type="checkbox" aria-label={`Offer ${TIER_NAME[t]}`} className="h-4 w-4 accent-crimson" checked={value[t].on} onChange={(e) => onChange({ ...value, [t]: { ...value[t], on: e.target.checked } })} /></td>
                <td className="px-3 py-2">
                  ₦ <input type="number" inputMode="numeric" aria-label={`${TIER_NAME[t]} price`} min={minKobo / 100} max={maxKobo / 100} step={100} disabled={!value[t].on} value={value[t].price} onChange={(e) => onChange({ ...value, [t]: { ...value[t], price: e.target.value } })} className="w-28 rounded-lg border border-rule px-2 py-1" />
                  <span className="block text-[11px] text-slate">{formatNaira(minKobo)} – {formatNaira(maxKobo)}</span>
                </td>
                <td className="px-3 py-2">
                  <input type="number" inputMode="numeric" aria-label={`${TIER_NAME[t]} paid-live ticket discount`} min={0} max={cap ?? 100} step={1} value={value[t].discount} onChange={(e) => onChange({ ...value, [t]: { ...value[t], discount: e.target.value } })} className="w-16 rounded-lg border border-rule px-2 py-1" /> %
                  <span className="block text-[11px] text-slate">{cap === null ? "0 = none" : `0 – ${cap}%`}</span>
                </td>
                <td className="px-3 py-2">{r === null ? "—" : <>{pct(r)}{take !== null && value[t].on ? ` · ${formatNaira(take)}` : ""}{tierUplift(t, s) > 0 && <span className="block text-[11px] text-slate">your {pct(rate!)} + {Math.round(tierUplift(t, s) * 100)}% of it</span>}</>}</td>
                <td className="px-3 py-2 font-bold">{take === null || !value[t].on ? "—" : formatNaira(kobo - take)}</td>
                {counts && <td className="px-3 py-2">{counts[t] ?? 0}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate">Each tier includes the ones below it. Changing a price applies to new subscribers; current ones keep theirs. When you publish, choose who can read it: everyone, Premium and up, VIP and up, or VVIP only. Subscribers from before tiers are Premium. The paid-live discount comes off every ticket to your paid lives, on top of whichever price applies (early bird, normal or late), for subscribers of that tier.</p>
    </div>
  );
}
