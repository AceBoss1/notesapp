"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { nairaText } from "@/lib/pricing";
import type { TrialStats } from "@/lib/trial-earnings";

// Admin → Growth → Trials (docs/GTM_DOORS_AND_TRIALS.md): does showing members what a trial kept them lead to paid plans, and what do the
// trials cost us in commission? Trials that ended in the chosen days.
export default function TrialsPanel({ user, days }: { user: User; days: number }) {
  const [s, setS] = useState<(TrialStats & { days: number }) | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setS(null); setErr("");
    user.getIdToken().then((t) => fetch(`/api/admin/growth/trials?days=${days}`, { headers: { Authorization: `Bearer ${t}` } }))
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Couldn't load"); setS(j.stats); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load"));
  }, [user, days]);
  if (err) return <p className="text-sm text-crimson" role="alert">{err}</p>;
  if (!s) return <p className="text-sm text-slate">Counting…</p>;
  const tile = (v: string, l: string) => <div className="card p-4"><p className="font-display text-3xl text-ink">{v}</p><p className="mt-1 text-sm text-slate">{l}</p></div>;
  const row = (l: string, v: string) => <li className="flex justify-between gap-3 border-t border-rule py-2 first:border-t-0"><span>{l}</span><b className="tabular-nums">{v}</b></li>;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tile(String(s.ended), "trials ended")}
        {tile(String(s.paidAfter), "paid for the plan after")}
        {tile(String(s.toldPaid), "told “it paid”")}
        {tile(String(s.toldNotYet), "told “not yet”")}
      </div>
      <ul className="card mt-5 p-4 text-sm">
        {row("“It paid” → paid for the plan", `${s.paidAfterToldPaid} of ${s.toldPaid}`)}
        {row("“Not yet” → paid anyway", `${s.paidAfterToldNotYet} of ${s.toldNotYet}`)}
        {row("Commission given up in trials (what members kept extra)", nairaText(s.givenUpKobo))}
        {row("Plan payments after trials", `${nairaText(s.planMonthlyKobo)} a month`)}
        {row("“Would have kept you more” messages → paid after", `${s.paidAfterNudge} of ${s.nudged}`)}
      </ul>
      <p className="mt-2 text-xs text-slate">Trials that ended in the last {s.days} days and ran to the end (a member who paid during their trial isn&apos;t counted here). Paid after: paid for a plan on or after the trial&apos;s last day.</p>
    </div>
  );
}
