"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dayLabel } from "@/lib/month-calendar";
import type { Plan, Review } from "@/lib/planner";
import { card, errText, field, ghost, isLocked, papi, primary, type View } from "./api";
import { PlannerGate, PlannerHeader, type Gate } from "./PlannerGate";

// The Sunday review (/calendar/planner/review; docs/NOTES_PLANNER.md, mockup 7): three questions, the three numbers, the warning
// signs she named, then one short note from Nana (or ours, when Nana's note is off or she's away).
type Saved = { review: Review; plan: Plan; warnings: { sign: string; response: string }[]; notice?: string };

function Inner({ g }: { g: Gate }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [numbers, setNumbers] = useState<string[]>([]);
  const [signs, setSigns] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  useEffect(() => {
    papi<View>(g.user).then((v) => {
      setView(v);
      const done = v.review?.done;
      setAnswers(v.plan?.review.map((_, i) => done?.answers[i] ?? "") ?? []);
      setNumbers(v.plan?.numbers.map((n, i) => done?.numbers[i] ?? n.now) ?? []);
      setSigns(v.plan?.risks.map((_, i) => done?.signs[i] === true) ?? []);
    }).catch((e) => { if (isLocked(e)) g.locked(); else setError(errText(e, "Couldn't open your review.")); });
  }, [g]);
  const back = { href: "/calendar/planner", label: "Planner" };
  if (!view) return <div className="mx-auto max-w-xl px-4 py-8"><PlannerHeader title="Sunday review" back={back} /><p className="mt-6 text-sm text-slate">{error || "Opening your review…"}</p></div>;
  const plan = view.plan, r = view.review;
  if (!plan || !r) return <div className="mx-auto max-w-xl px-4 py-8"><PlannerHeader title="Sunday review" back={back} /><p className={`${card} mt-6 p-6 text-sm text-slate`}>Make your plan first. Your Sunday review comes with it. <Link href="/calendar/planner" className="text-crimson underline">Open Planner</Link></p></div>;
  if (!r.open) return <div className="mx-auto max-w-xl px-4 py-8"><PlannerHeader title="Sunday review" back={back} /><p className={`${card} mt-6 p-6 text-sm text-slate`}>Your first review opens on the first Sunday of your plan, which starts on {dayLabel(plan.start)}.</p></div>;

  const at = <T,>(list: T[], i: number, v: T) => list.map((x, j) => (j === i ? v : x));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try { setSaved(await papi<Saved>(g.user, { body: { action: "review", answers, numbers, signs } })); }
    catch (err) { if (isLocked(err)) g.locked(); else setError(errText(err, "Couldn't save your review.")); }
    finally { setBusy(false); }
  };
  const shown = saved?.review ?? r.done;
  const warns = saved?.warnings ?? plan.risks.filter((_, i) => r.done?.signs[i]).map((k) => ({ sign: k.sign || k.habit, response: k.response }));
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <PlannerHeader title="Sunday review" back={back} />
      <p className="mt-1 text-sm text-slate">Week ending {dayLabel(r.week)}. Three questions, five minutes.</p>
      {saved ? (
        <div className="mt-5 space-y-3">
          <p className="rounded-xl border border-[#BFE3D2] bg-[#EAF7F0] px-3 py-2 text-sm text-[#17694a]">Saved ✓ Your numbers are updated on your plan.</p>
          {warns.map((w) => <p key={w.sign} className="rounded-xl border border-[#F3C8A2] bg-[#FFF1E6] px-3 py-2 text-xs leading-relaxed text-[#5a2e00]"><b>⚠️ Early warning you named:</b> {w.sign}. Your plan says: {w.response || "go back to your daily moves"}.</p>)}
          {shown?.note && <p className="rounded-2xl border border-[#F0CBD6] bg-gradient-to-br from-card to-[#FBEFF3] px-4 py-3 text-[13.5px] leading-relaxed text-ink"><b className="text-crimson">{shown.ai ? "Nana:" : "This week:"}</b> {shown.note}</p>}
          {saved.notice && <p className="text-xs text-slate">{saved.notice}</p>}
          <div className="flex flex-wrap gap-2"><Link href="/calendar/planner" className={primary}>Back to my plan</Link><button type="button" onClick={() => setSaved(null)} className={ghost}>Change my answers</button></div>
        </div>
      ) : (
        <form onSubmit={save} className="mt-5 space-y-3">
          {r.done?.note && <p className="rounded-2xl border border-[#F0CBD6] bg-gradient-to-br from-card to-[#FBEFF3] px-4 py-3 text-[13.5px] leading-relaxed text-ink"><b className="text-crimson">{r.done.ai ? "Nana:" : "This week:"}</b> {r.done.note}</p>}
          {plan.review.map((q, i) => (
            <label key={i} className={`block ${card} p-3 text-xs font-semibold text-slate`}>{i + 1} · {q}
              <textarea value={answers[i] ?? ""} onChange={(e) => setAnswers(at(answers, i, e.target.value))} maxLength={600} rows={2} className={`${field} mt-1.5 font-normal`} />
            </label>
          ))}
          {plan.numbers.length > 0 && (
            <div>
              <h2 className="font-ui text-sm font-bold text-ink">Update your numbers</h2>
              <div className={`${card} mt-2 divide-y divide-rule px-4`}>
                {plan.numbers.map((n, i) => (
                  <label key={i} className="flex items-center justify-between gap-3 py-2.5 text-[13px] text-ink"><span>{n.label} <span className="text-slate">(target {n.target})</span></span>
                    <input value={numbers[i] ?? ""} onChange={(e) => setNumbers(at(numbers, i, e.target.value))} maxLength={24} className={`${field} w-28 text-right font-bold`} />
                  </label>
                ))}
              </div>
            </div>
          )}
          {plan.risks.length > 0 && (
            <fieldset>
              <legend className="font-ui text-sm font-bold text-ink">Did you see any warning sign you named?</legend>
              <div className="mt-2 space-y-1.5">
                {plan.risks.map((k, i) => (
                  <label key={i} className={`flex items-start gap-2.5 ${card} px-3 py-2.5 text-[13px] text-ink`}>
                    <input type="checkbox" checked={signs[i] === true} onChange={(e) => setSigns(at(signs, i, e.target.checked))} className="mt-0.5 accent-[#7A0328]" />
                    <span>{k.sign || k.habit}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {error && <p role="alert" className="rounded-xl bg-[#FFF1F3] px-3 py-2 text-sm text-crimson">{error}</p>}
          <button type="submit" disabled={busy} className={`${primary} w-full`}>{busy ? "Saving…" : "Save my review"}</button>
          {view.reviews.length > (r.done ? 1 : 0) && (
            <details className="text-xs text-slate"><summary className="cursor-pointer">Earlier reviews</summary>
              <ul className="mt-2 space-y-2">{view.reviews.filter((x) => x.week !== r.week).map((x) => <li key={x.week} className={`${card} p-3 leading-relaxed`}><b className="text-ink">Week ending {dayLabel(x.week, true)}</b>{x.answers.filter(Boolean).map((a, i) => <p key={i}>{a}</p>)}{x.note && <p className="mt-1 text-ink">{x.note}</p>}</li>)}</ul>
            </details>
          )}
        </form>
      )}
    </div>
  );
}

export default function PlannerReview() {
  return <PlannerGate next="/calendar/planner/review">{(g) => <Inner g={g} />}</PlannerGate>;
}
