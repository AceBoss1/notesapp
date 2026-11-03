"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { FAN_DEFAULTS, FAN_SETTINGS, type FanSettings } from "@/lib/fans";

// Admin → Limits → Subscriptions and fans (lib/fans.ts): the price range creators can set for each tier, and the share of the creator's
// rate #NotesApp adds on VIP and VVIP. Saved on its own; the help, /pricing and the creator's settings follow within about 30 seconds.
export default function FanSettingsPanel({ user }: { user: User }) {
  const [s, setS] = useState<FanSettings | null>(null);
  const [msg, setMsg] = useState("");
  const call = useCallback(async (init?: RequestInit) => {
    const r = await fetch("/api/admin/fans", { ...init, headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    setS(j.fans);
  }, [user]);
  useEffect(() => { call().catch((e) => setMsg(e.message)); }, [call]);
  if (!s) return msg ? <p className="mt-6 text-sm text-crimson">{msg}</p> : null;
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-ink">Subscriptions and fans</h2>
      <p className="mt-1 text-sm text-slate">Creators price Premium, VIP and VVIP within these ranges (a creator&apos;s current price stays until they change it). VIP and VVIP subscriptions carry the creator&apos;s commission plus this share of it, fixed on each payment.</p>
      <table className="mt-4 w-full border-collapse text-sm"><tbody>
        {FAN_SETTINGS.map((a) => (
          <tr key={a.key} className="border-b border-rule">
            <td className="py-2 pr-4">{a.label} <span className="text-slate">({a.unit}; default {a.def.toLocaleString("en-NG")})</span></td>
            <td className="px-2 py-2"><input type="number" inputMode="numeric" min={a.min} max={a.max} step={1} value={Number.isNaN(s[a.key]) ? "" : s[a.key]} onChange={(e) => setS({ ...s, [a.key]: e.target.value === "" ? NaN : Number(e.target.value) })} aria-label={a.label} className="w-28 rounded border border-rule px-2 py-1" /></td>
          </tr>
        ))}
      </tbody></table>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => { setMsg(""); call({ method: "POST", body: JSON.stringify({ fans: s }) }).then(() => setMsg("Saved.")).catch((e) => setMsg(e.message)); }}>Save subscription settings</button>
        <button type="button" className="btn-ghost" onClick={() => setS({ ...FAN_DEFAULTS })}>Reset</button>
        {msg && <span className="text-sm text-slate" role="status">{msg}</span>}
      </div>
    </section>
  );
}
