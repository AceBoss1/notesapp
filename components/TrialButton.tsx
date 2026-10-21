"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { TRIAL_DAYS } from "@/lib/trials";

// Under a paid plan on Pricing (on its crimson header): "Try it free for 15 days" when the account may (lib/trials.ts), or why not. Signed-out visitors see nothing:
// the plan's own button already asks them to sign up.
export default function TrialButton({ tier, label }: { tier: "pro" | "business"; label: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<{ ok: boolean; reason?: string; message?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (!u) return setState(null);
    const r = await fetch(`/api/billing/trial?tier=${tier}`, { headers: { Authorization: `Bearer ${await u.getIdToken()}` } }).catch(() => null);
    setState(r?.ok ? await r.json() : null);
  }), [tier]);

  if (!user || !state) return null;
  if (done) return <p className="mt-2 max-w-[14rem] text-xs font-semibold text-paper" role="status">{done}</p>;
  // Already on this plan or above: nothing to say.
  if (!state.ok && state.reason === "has-plan") return null;
  if (!state.ok) return <p className="mt-2 max-w-[14rem] text-xs text-paper/75">{state.message}</p>;

  async function go() {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/billing/trial", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ tier }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't start the trial.");
      setDone(`Your free ${label} trial runs until ${new Date(d.until).toDateString()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the trial.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 max-w-[14rem]">
      <button type="button" onClick={go} disabled={busy} className="rounded-full border border-paper/70 px-4 py-1.5 text-xs font-semibold text-paper hover:bg-paper/10 disabled:opacity-50">
        {busy ? "Starting…" : `Try ${label} free for ${TRIAL_DAYS} days`}
      </button>
      <p className="mt-1 text-[11px] text-paper/70">No card. Once per plan; another trial needs a paid plan in between.</p>
      {error && <p className="mt-1 text-xs font-semibold text-paper" role="alert">{error}</p>}
    </div>
  );
}
