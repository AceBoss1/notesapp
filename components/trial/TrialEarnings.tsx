"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMember } from "@/lib/member-client";
import { nairaText, pct } from "@/lib/pricing";
import { planName } from "@/lib/trials";
import type { Comparison, Rates } from "@/lib/trial-earnings";
import type { TrialView } from "@/lib/trial-earnings-server";

// What a free trial kept you (docs/GTM_DOORS_AND_TRIALS.md): the card on My account while a trial runs, and the page /profile/trial with
// the running total, the result when it ends and how we worked it out. Only the member's own figures, from /api/account/trial.

function useTrial(enabled: boolean) {
  const { user } = useMember();
  const [view, setView] = useState<TrialView | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!user || !enabled) return;
    (async () => {
      const r = await fetch("/api/account/trial", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load your trial.");
      setView(j.view);
    })().catch((e) => setErr(e.message));
  }, [user, enabled]);
  return { view, err };
}

// On every My account page while a trial runs.
export function TrialCard() {
  const { profile } = useMember();
  const running = !!profile?.trialUntil && new Date(profile.trialUntil).getTime() > Date.now() && !String((profile as { trialSource?: string }).trialSource ?? "").startsWith("promo:");
  const { view } = useTrial(running);
  if (!running || !view || view.state !== "running") return null;
  const c = view.comparison;
  return (
    <div className="card mb-6 border-crimson p-4">
      <div className="flex justify-between font-ui text-xs font-bold"><span>{planName(view.tier)} trial</span><span className="text-slate">day {view.day} of {view.days}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-field"><div className="h-full bg-crimson" style={{ width: `${Math.round((view.day / view.days) * 100)}%` }} /></div>
      <p className="mt-3 text-sm text-ink">
        {c.count === 0 ? <>No paid sessions, subscriptions, gifts or sales in your trial yet. When they come in, you'll see here how much more {planName(view.tier)} keeps you.</>
          : c.extraKobo > 0 ? <>So far on {planName(view.tier)} you've kept <b>{nairaText(c.extraKobo)} more</b> than you would have on {planName(view.back)}.</>
          : <>So far {planName(view.tier)} has kept you the same as {planName(view.back)}.</>}
      </p>
      {c.count > 0 && <p className="mt-1 text-xs text-slate">From {nairaText(c.grossKobo)} you earned since {new Date(view.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.</p>}
      <Link href="/profile/trial" className="mt-2 inline-block font-ui text-xs font-bold text-crimson">See how we worked it out →</Link>
    </div>
  );
}

function Bars({ c, back, plan }: { c: Comparison; back: string; plan: string }) {
  const max = Math.max(1, c.keptBackKobo, c.keptPlanKobo);
  const row = (label: string, kobo: number, on: boolean) => (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 text-slate">{label}</span>
      <span className="min-w-0 flex-1"><i className={`block h-5 rounded ${on ? "bg-crimson" : "bg-rule"}`} style={{ width: `${Math.max(4, (kobo / max) * 100)}%` }} /></span>
      <b className="shrink-0">{nairaText(kobo)}</b>
    </div>
  );
  return <div className="card space-y-2 p-4">{row(planName(back), c.keptBackKobo, false)}{row(planName(plan), c.keptPlanKobo, true)}<p className="text-xs text-slate">What you keep after commission.</p></div>;
}

function Breakdown({ c, back, plan, rates }: { c: Comparison; back: string; plan: string; rates: { plan: Rates; back: Rates } }) {
  return (
    <section className="card mt-6 p-4">
      <h2 className="font-ui text-sm font-bold">How we worked it out</h2>
      {c.lines.length === 0 ? <p className="mt-2 text-sm text-slate">No paid sessions, subscriptions, gifts or sales in this trial.</p> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead><tr className="text-left text-xs text-slate"><th className="py-1.5">Earned</th><th className="text-right">Paid</th><th className="text-right">{planName(back)}</th><th className="text-right">{planName(plan)}</th></tr></thead>
            <tbody>
              {c.lines.map((l) => <tr key={l.label} className="border-t border-rule"><td className="py-1.5">{l.label} ({l.count})</td><td className="text-right">{nairaText(l.grossKobo)}</td><td className="text-right">{nairaText(l.keptBackKobo)}</td><td className="text-right">{nairaText(l.keptPlanKobo)}</td></tr>)}
              <tr className="border-t-2 border-ink font-bold"><td className="py-1.5">You keep</td><td /><td className="text-right">{nairaText(c.keptBackKobo)}</td><td className="text-right">{nairaText(c.keptPlanKobo)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-slate">
        On {planName(plan)} we show what we actually took from each payment. On {planName(back)} we show what its rates take today: {pct(rates.back.session)} of sessions, subscriptions and gifts
        (against {pct(rates.plan.session)} on {planName(plan)}), {pct(rates.back.physical)} of shop items and {pct(rates.back.digital)} of downloads and courses. A fan tier&apos;s uplift is
        counted the same way on both. Refunded payments aren&apos;t counted. Ad share is paid monthly, so it isn&apos;t in this comparison. Only you see these figures.
      </p>
    </section>
  );
}

// /profile/trial
export function TrialPage() {
  const { user } = useMember();
  const { view, err } = useTrial(true);
  if (user === null) return <p className="text-slate">Sign in to see your trial.</p>;
  if (err) return <p className="text-sm text-crimson">{err}</p>;
  if (!view) return <p className="text-sm text-slate">Loading your trial…</p>;
  if (view.state === "none") return (
    <div className="card max-w-xl p-5">
      <p className="font-display text-xl">No free trial yet</p>
      <p className="mt-2 text-sm text-slate">Try Pro or Business free for 15 days, with no card. When it ends we show you what you kept on it, next to what you&apos;d have kept without it, so you decide with your own numbers.</p>
      <Link href="/pricing#compare" className="btn-primary mt-4 inline-flex">See the plans</Link>
    </div>
  );
  if (view.state === "running") return (
    <div className="max-w-2xl">
      <p className="font-display text-2xl">Your {planName(view.tier)} trial, so far</p>
      <p className="mt-1 text-sm text-slate">Until {new Date(view.until).toDateString()}. {planName(view.tier)} costs {nairaText(view.monthlyKobo)} a month after the trial.</p>
      <div className="mt-4"><Bars c={view.comparison} back={view.back} plan={view.tier} /></div>
      <Breakdown c={view.comparison} back={view.back} plan={view.tier} rates={{ plan: view.plan, back: view.backRates }} />
    </div>
  );
  const r = view.result, c = r.comparison, o = r.outcome, plan = planName(r.tier), back = planName(r.back);
  const dates = `${new Date(r.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(r.until).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  return (
    <div className="max-w-2xl">
      <span className="eyebrow">Your {plan} trial · {dates}</span>
      {c.count === 0 ? (
        <>
          <p className="mt-2 font-display text-3xl leading-tight">Nothing to compare yet</p>
          <p className="mt-2 text-sm text-slate">You had no paid sessions, subscriptions, gifts or sales in the trial, so we can&apos;t show what {plan} would keep you. {o.breakEvenKobo ? `${plan} pays for itself once you earn about ${nairaText(o.breakEvenKobo)} a month in sessions, subscriptions and gifts.` : ""}</p>
        </>
      ) : o.verdict === "paid" ? (
        <>
          <p className="mt-2 font-display text-3xl leading-tight">{plan} kept you {nairaText(c.extraKobo)} more.</p>
          <p className="mt-2 text-sm text-slate">You earned {nairaText(c.grossKobo)} in the trial.</p>
          <div className="mt-4"><Bars c={c} back={r.back} plan={r.tier} /></div>
          <ul className="mt-3 divide-y divide-rule text-sm">
            <li className="flex justify-between py-2"><span>{plan} costs</span><b>{nairaText(r.monthlyKobo)} a month</b></li>
            <li className="flex justify-between gap-3 py-2"><span>At this pace, {plan} gives you back</span><b>about {nairaText(o.paceKobo)} a month</b></li>
          </ul>
          {o.times >= 1 && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{plan} paid for itself {o.times >= 2 ? `${Math.floor(o.times)} times over` : "and more"} in your trial.</p>}
        </>
      ) : (
        <>
          <p className="mt-2 font-display text-3xl leading-tight">{back} suits you for now.</p>
          <p className="mt-2 text-sm text-slate">You earned {nairaText(c.grossKobo)} in your trial. On {plan} you kept {nairaText(c.extraKobo)} more than on {back}, and {plan} for those days costs about {nairaText(o.costKobo)}.</p>
          <div className="mt-4"><Bars c={c} back={r.back} plan={r.tier} /></div>
          {o.breakEvenKobo && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{plan} pays for itself once you earn about <b>{nairaText(o.breakEvenKobo)} a month</b> in sessions, subscriptions and gifts. We&apos;ll tell you when you get there.</p>}
          <p className="mt-3 text-sm text-slate">Everything you made on {plan} stays where it is.</p>
        </>
      )}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {o.verdict === "paid" ? <>
          <Link href="/pricing#compare" className="btn-primary justify-center">Get {plan} · {nairaText(r.monthlyKobo)} a month</Link>
          <Link href="/profile/publishing" className="btn-ghost justify-center">Stay on {back}</Link>
        </> : <>
          <Link href="/profile/publishing" className="btn-primary justify-center">Stay on {back}</Link>
          <Link href="/pricing#compare" className="btn-ghost justify-center">Get {plan} anyway</Link>
        </>}
      </div>
      <Breakdown c={c} back={r.back} plan={r.tier} rates={{ plan: r.plan, back: r.backRates }} />
    </div>
  );
}
