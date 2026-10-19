"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { AD_PLACEMENTS, type AdPlacement } from "@/lib/ads";
import { AD_CONFIG_LIMITS, cleanAdConfig, type AdConfig } from "@/lib/ad-config";

// Admin → Ads, top: how many boosts show at once, how long boosts and adverts stay, the feed's promoted posts, the digest's
// sponsored slots, and which spots are on (adConfig/main through /api/admin/ad-config). Visitors see a change within a minute
// or two, without a deploy.
const NUMBERS: { k: keyof typeof AD_CONFIG_LIMITS; label: string; group: "Boosts" | "Adverts" }[] = [
  { k: "boostsWide", label: "Boosts shown at once, computer and tablet", group: "Boosts" },
  { k: "boostsPhone", label: "Boosts shown at once, phone", group: "Boosts" },
  { k: "boostRotateSec", label: "Time each set of boosts stays (seconds)", group: "Boosts" },
  { k: "feedPromoted", label: "Promoted posts in the journal feed", group: "Boosts" },
  { k: "adRotateSec", label: "Time each advert stays (seconds)", group: "Adverts" },
  { k: "digestSlots", label: "Sponsored slots in the weekly digest", group: "Adverts" },
];

export default function AdSettings({ user }: { user: User }) {
  const [c, setC] = useState<AdConfig | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const call = async (method: "GET" | "PUT", body?: AdConfig) => {
    const res = await fetch("/api/admin/ad-config", { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Failed");
    return j.config as AdConfig;
  };
  useEffect(() => { call("GET").then(setC).catch((e) => setError(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!c) return;
    setBusy(true); setError(""); setSaved("");
    try { setC(await call("PUT", cleanAdConfig(c))); setSaved("Saved. Visitors see it within a couple of minutes."); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save"); }
    finally { setBusy(false); }
  }
  if (!c) return <div className="card mt-8 p-5 text-sm text-slate">{error || "Loading the settings…"}</div>;
  const toggle = (p: AdPlacement) => setC({ ...c, spotsOff: c.spotsOff.includes(p) ? c.spotsOff.filter((x) => x !== p) : [...c.spotsOff, p] });
  return (
    <div className="card mt-8 p-5">
      <p className="font-ui text-sm font-bold text-ink">Settings</p>
      <div className="mt-3 grid gap-6 sm:grid-cols-2">
        {(["Boosts", "Adverts"] as const).map((g) => (
          <div key={g}>
            <p className="eyebrow">{g}</p>
            {NUMBERS.filter((n) => n.group === g).map((n) => {
              const [min, max] = AD_CONFIG_LIMITS[n.k];
              return (
                <label key={n.k} className="flex items-center justify-between gap-3 border-b border-rule py-2 text-sm text-ink">
                  <span>{n.label} <span className="text-[11px] text-slate">({min}–{max})</span></span>
                  <input type="number" min={min} max={max} value={c[n.k]} onChange={(e) => setC({ ...c, [n.k]: Number(e.target.value) })} className="w-20 rounded border border-rule bg-card px-2 py-1 text-right font-semibold" />
                </label>
              );
            })}
          </div>
        ))}
      </div>
      <p className="eyebrow mt-5">Spots</p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {(Object.keys(AD_PLACEMENTS) as AdPlacement[]).map((p) => (
          <label key={p} className="flex items-center gap-2"><input type="checkbox" checked={!c.spotsOff.includes(p)} onChange={() => toggle(p)} />{AD_PLACEMENTS[p].label}</label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="btn-primary !px-5 !py-2 text-sm">{busy ? "Saving…" : "Save settings"}</button>
        {saved && <span className="text-xs text-emerald-700">{saved}</span>}
        {error && <span className="text-xs text-crimson">{error}</span>}
      </div>
    </div>
  );
}
