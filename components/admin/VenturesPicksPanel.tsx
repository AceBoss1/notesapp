"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { PICKS_MAX, PICKS_MIN, PICKS_PER_QUARTER } from "@/lib/ventures";

// Admin → Limits → NotesApp Ventures (lib/ventures.ts): how many Rewrite the Playbook pitches the team picks a quarter. Super admins only:
// the page renders this only for them, and the API refuses everyone else. It applies sitewide at once: the /ventures page and form, the
// "not picked" notifications, and the cap in Admin → Ventures. Picks already made stay picked.
export default function VenturesPicksPanel({ user }: { user: User }) {
  const [n, setN] = useState<number | null>(null);
  const [quarter, setQuarter] = useState("");
  const [picked, setPicked] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const call = useCallback(async (body?: Record<string, unknown>) => {
    const r = await fetch("/api/admin/ventures", { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  useEffect(() => { call().then((j) => { setN(j.call.picksPerQuarter); setQuarter(j.quarter); setPicked(j.pickedThisQuarter); }).catch((e) => setMsg(e.message)); }, [call]);

  const save = async () => {
    if (n === null) return;
    setBusy(true); setMsg("");
    try { const j = await call({ action: "picks", picksPerQuarter: n }); setN(j.call.picksPerQuarter); setMsg(`Saved: ${j.call.picksPerQuarter} a quarter, everywhere.`); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save it."); }
    finally { setBusy(false); }
  };
  if (n === null) return msg ? <p className="mt-6 text-sm text-crimson">{msg}</p> : null;
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-ink">NotesApp Ventures</h2>
      <p className="mt-1 text-sm text-slate">How many Rewrite the Playbook pitches the team can pick a quarter. It changes the /ventures page, the pitch form, the &ldquo;not picked&rdquo; notifications and the cap in Admin → Ventures at once. Picks already made stay picked. Super admins only.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-ink">Picks a quarter
          <input type="number" inputMode="numeric" min={PICKS_MIN} max={PICKS_MAX} step={1} value={Number.isNaN(n) ? "" : n} onChange={(e) => setN(e.target.value === "" ? NaN : Number(e.target.value))} className="w-20 rounded border border-rule px-2 py-1" aria-label="Picks a quarter" />
        </label>
        <button type="button" disabled={busy || !Number.isInteger(n) || n < PICKS_MIN || n > PICKS_MAX} onClick={() => void save()} className="rounded-full bg-crimson px-4 py-1.5 font-ui text-sm font-semibold text-paper disabled:opacity-40">Save</button>
        <span className="text-xs text-slate">Default {PICKS_PER_QUARTER} · {quarter}: {picked} picked so far</span>
      </div>
      {msg && <p className="mt-2 text-sm text-ink" role="status">{msg}</p>}
    </section>
  );
}
