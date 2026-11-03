"use client";

import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/booking-time";
import { FAN_DEFAULTS, SUB_TIERS, TIER_NAME, tierRangeKobo, tierRate, tierUplift, type FanSettings, type SubTier } from "@/lib/fans";
import { useMyRates } from "@/components/MyCommission";
import { TierChip } from "@/components/fans/FanBadges";

// The creator's subscription tiers (Rates & payouts): a price for each tier they offer, within the ranges set in Admin → Limits →
// Subscriptions and fans, with what #NotesApp takes on each (their rate, plus a share of it on VIP and VVIP) and what they keep.
export type TierForm = Record<SubTier, { on: boolean; price: string }>;

export default function TierSettings({ value, onChange, counts }: { value: TierForm; onChange: (v: TierForm) => void; counts?: Partial<Record<SubTier, number>> }) {
  const [s, setS] = useState<FanSettings>(FAN_DEFAULTS);
  const rates = useMyRates();
  useEffect(() => { fetch("/api/fans/settings").then((r) => r.json()).then((j) => j.settings && setS(j.settings)).catch(() => {}); }, []);
  const rate = rates?.session ?? null;
  const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead><tr className="bg-crimson text-left text-[13px] text-white"><th className="px-3 py-2">Tier</th><th className="px-3 py-2">Offer</th><th className="px-3 py-2">Your price / month</th><th className="px-3 py-2">#NotesApp takes</th><th className="px-3 py-2">You keep</th>{counts && <th className="px-3 py-2">Subscribers</th>}</tr></thead>
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
                <td className="px-3 py-2">{r === null ? "—" : <>{pct(r)}{take !== null && value[t].on ? ` · ${formatNaira(take)}` : ""}{tierUplift(t, s) > 0 && <span className="block text-[11px] text-slate">your {pct(rate!)} + {Math.round(tierUplift(t, s) * 100)}% of it</span>}</>}</td>
                <td className="px-3 py-2 font-bold">{take === null || !value[t].on ? "—" : formatNaira(kobo - take)}</td>
                {counts && <td className="px-3 py-2">{counts[t] ?? 0}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate">Each tier includes the ones below it. Changing a price applies to new subscribers; current ones keep theirs. When you publish, choose who can read it: everyone, Premium and up, VIP and up, or VVIP only. Subscribers from before tiers are Premium.</p>
    </div>
  );
}
