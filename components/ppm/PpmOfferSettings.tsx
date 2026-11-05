"use client";

import { formatNaira } from "@/lib/booking-time";
import { PPM_AUDIENCES, PPM_RATE_MAX_KOBO, PPM_RATE_MIN_KOBO, ppmRate, splitCharge, type PpmAudience } from "@/lib/ppm";
import { pctText } from "@/lib/live-tickets";
import { useMyRates } from "@/components/MyCommission";
import { PAYOUT_HOLD_HOURS } from "@/lib/cancellation";

// Rates & payouts → "Offer pay-per-minute sessions" (docs/LIVE_ECONOMY.md 1b): a price per minute for voice and for video, and who may
// book. Saved with the rest of the page (POST /api/publisher/settings { ppm }, lib/ppm-server.ts savePpmOffer). The weekly times are the
// same as paid sessions'.

export type PpmForm = { on: boolean; voice: string; video: string; audience: PpmAudience };
export const PPM_FORM: PpmForm = { on: false, voice: "150", video: "300", audience: "everyone" };
const seg = (on: boolean) => `rounded-full px-3.5 py-1.5 text-xs ${on ? "bg-crimson text-paper" : "border border-rule bg-card text-ink hover:border-crimson"}`;

export default function PpmOfferSettings({ value, onChange, upliftPct, graceSec, minMinutes }: { value: PpmForm; onChange: (v: PpmForm) => void; upliftPct: number; graceSec: number; minMinutes: number }) {
  const rates = useMyRates();
  const rate = rates?.session ?? null;
  const input = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
  const keep = (naira: string) => {
    const k = Math.round(Number(naira) * 100);
    if (!k || rate === null) return null;
    return splitCharge(k, ppmRate(rate, upliftPct)).netKobo;
  };
  const kv = keep(value.voice), kd = keep(value.video);
  return (
    <div className="card p-6" id="ppm-settings">
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={value.on} onChange={(e) => onChange({ ...value, on: e.target.checked })} />
        <span className="eyebrow">Offer pay-per-minute sessions (voice and video calls)</span>
      </label>
      <p className="mt-2 text-xs text-slate">People book one of your weekly times and hold minutes from their NotesApp Credit. The call is metered by #NotesApp: they pay per started minute after the first {graceSec} seconds, at least {minMinutes} minutes are held, and unused minutes go back to them.</p>
      {value.on && (
        <div className="mt-5 grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs text-slate">
              🎙 Voice, per minute (₦; leave empty for none)
              <input inputMode="numeric" aria-label="Voice price per minute" value={value.voice} onChange={(e) => onChange({ ...value, voice: e.target.value.replace(/[^\d]/g, "") })} className={input} />
              {kv !== null && <span className="mt-1 block text-ink">You keep {formatNaira(kv)} a minute</span>}
            </label>
            <label className="block text-xs text-slate">
              🎥 Video, per minute (₦; leave empty for none)
              <input inputMode="numeric" aria-label="Video price per minute" value={value.video} onChange={(e) => onChange({ ...value, video: e.target.value.replace(/[^\d]/g, "") })} className={input} />
              {kd !== null && <span className="mt-1 block text-ink">You keep {formatNaira(kd)} a minute</span>}
            </label>
          </div>
          <p className="-mt-2 text-xs text-slate">From {formatNaira(PPM_RATE_MIN_KOBO)} to {formatNaira(PPM_RATE_MAX_KOBO)} a minute. #NotesApp takes your rate{rate !== null ? ` (${pctText(rate)})` : ""} plus {upliftPct}% of it{rate !== null ? `: ${pctText(ppmRate(rate, upliftPct))}` : ""}, fixed when each session is booked. You&apos;re paid {PAYOUT_HOLD_HOURS} hours after each call.</p>
          <div>
            <p className="text-xs text-slate">Who can book</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PPM_AUDIENCES.map((a) => <button key={a.id} type="button" aria-pressed={value.audience === a.id} onClick={() => onChange({ ...value, audience: a.id })} className={seg(value.audience === a.id)}>{a.label}</button>)}
            </div>
            {value.audience !== "everyone" && <p className="mt-1.5 text-xs text-slate">Subscribers of your own tiers (Subscriptions, below). They still pay per minute.</p>}
          </div>
          <p className="text-xs text-slate">Uses your weekly availability (the times above). Members in teen mode can&apos;t sell or book pay-per-minute sessions.</p>
        </div>
      )}
    </div>
  );
}
