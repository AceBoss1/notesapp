"use client";

import { useState } from "react";
import { LIMITS, monthName, planMonths, planSpan, type Plan } from "@/lib/planner";
import { card, errText, field, ghost, isLocked, papi, primary } from "./api";
import type { Gate } from "./PlannerGate";

// "Write it myself", and every edit afterwards (docs/NOTES_PLANNER.md): the same plan as a form, with no Nana and no cost. Only the
// goal and one daily move are needed; the rest can be filled in later. The server checks it all again (lib/planner.ts cleanPlan).
type Draft = {
  goal: string; becoming: string; vision: string; refuse: string;
  numbers: { label: string; start: string; target: string; now: string }[];
  stop: string; keep: string; moves: string[]; tasks: { text: string; done: boolean }[];
  months: { month: string; project: string; done: string; finished: boolean; tool?: string }[];
  risks: { habit: string; sign: string; response: string }[]; review: string[];
};
const fill = <T,>(list: T[], n: number, blank: () => T) => Array.from({ length: n }, (_, i) => list[i] ?? blank());
function draftOf(plan: Plan | null, start: string, length: number): Draft {
  const months = plan ? plan.months : planMonths(start, length).map((month) => ({ month, project: "", done: "", finished: false }));
  return {
    goal: plan?.goal ?? "", becoming: plan?.becoming ?? "", vision: plan?.vision ?? "", refuse: plan?.refuse ?? "",
    numbers: fill(plan?.numbers ?? [], LIMITS.numbers, () => ({ label: "", start: "", target: "", now: "" })),
    stop: (plan?.stop ?? []).join("\n"), keep: (plan?.keep ?? []).join("\n"),
    moves: fill(plan?.moves ?? [], LIMITS.moves, () => ""), tasks: fill(plan?.tasks ?? [], LIMITS.tasks, () => ({ text: "", done: false })),
    months: months.map((m) => ({ ...m })), risks: fill(plan?.risks ?? [], LIMITS.risks, () => ({ habit: "", sign: "", response: "" })),
    review: fill(plan?.review ?? [], 3, () => ""),
  };
}
const lines = (v: string) => v.split("\n").map((l) => l.trim()).filter(Boolean);

function Section({ title, hint, children, open = false }: { title: string; hint?: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className={`${card} p-4`}>
      <summary className="cursor-pointer font-ui text-sm font-bold text-ink">{title}{hint && <span className="ml-2 font-normal text-slate">{hint}</span>}</summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block text-xs font-semibold text-ink">{label}<div className="mt-1 font-normal">{children}</div></label>;

export default function PlanForm({ g, teen, plan, start, length, onSaved, onCancel }: { g: Gate; teen: boolean; plan: Plan | null; start: string; length: number; onSaved: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(() => draftOf(plan, start, length));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));
  const at = <T,>(list: T[], i: number, v: T) => list.map((x, j) => (j === i ? v : x));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await papi(g.user, { body: { action: "save", fresh: !plan, length, plan: { ...d, stop: lines(d.stop), keep: lines(d.keep) } } });
      onSaved();
    } catch (err) { if (isLocked(err)) g.locked(); else setError(errText(err, "Couldn't save your plan.")); }
    finally { setBusy(false); }
  };
  const span = plan ? planSpan(plan.start, plan.months.length) : planSpan(start, length);
  return (
    <form onSubmit={save} className="mx-auto mt-6 max-w-2xl space-y-3">
      <h2 className="font-display text-2xl text-ink">{plan ? "Edit my plan" : "Write my plan"}</h2>
      <p className="text-sm text-slate">For <b className="text-ink">{span}</b>. Only the goal and one daily move are needed. Fill in the rest when you&apos;re ready.</p>
      <Section title="The goal" open>
        <Field label="One concrete thing that will be true by the last day"><textarea required value={d.goal} onChange={(e) => set("goal", e.target.value)} maxLength={LIMITS.line} rows={2} className={field} placeholder={teen ? "Pass all nine WAEC subjects with at least five credits." : "Earn ₦500,000 a month from tailoring, from my own shop."} /></Field>
        <Field label={'Who I\'m becoming: "I am the type of person who…"'}><input value={d.becoming} onChange={(e) => set("becoming", e.target.value)} maxLength={LIMITS.line} className={field} /></Field>
        <Field label="The life I'm building"><input value={d.vision} onChange={(e) => set("vision", e.target.value)} maxLength={LIMITS.line} className={field} /></Field>
        {!teen && <Field label="The life I refuse"><input value={d.refuse} onChange={(e) => set("refuse", e.target.value)} maxLength={LIMITS.line} className={field} /></Field>}
      </Section>
      <Section title="Every day" hint="one to three moves" open>
        {d.moves.map((m, i) => <input key={i} value={m} onChange={(e) => set("moves", at(d.moves, i, e.target.value))} maxLength={LIMITS.short} required={i === 0} aria-label={`Daily move ${i + 1}`} placeholder={i === 0 ? (teen ? "Study maths for 30 minutes" : "Two focused hours before 9 AM") : "Another move (optional)"} className={field} />)}
      </Section>
      <Section title="Numbers to track" hint="up to three">
        {d.numbers.map((n, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr),5rem,5rem] gap-2">
            <input value={n.label} onChange={(e) => set("numbers", at(d.numbers, i, { ...n, label: e.target.value }))} maxLength={LIMITS.short} aria-label={`Number ${i + 1}: what you're counting`} placeholder="What you're counting" className={field} />
            <input value={n.start} onChange={(e) => set("numbers", at(d.numbers, i, { ...n, start: e.target.value, now: plan ? n.now : e.target.value }))} maxLength={24} aria-label={`Number ${i + 1}: where it starts`} placeholder="Now" className={field} />
            <input value={n.target} onChange={(e) => set("numbers", at(d.numbers, i, { ...n, target: e.target.value }))} maxLength={24} aria-label={`Number ${i + 1}: target`} placeholder="Target" className={field} />
          </div>
        ))}
        <p className="text-[11px] text-slate">Short values work best: 40, ₦1.2m, 90%.</p>
      </Section>
      <Section title="Month by month" hint="one project a month">
        {d.months.map((m, i) => (
          <div key={m.month} className="space-y-1.5">
            <p className="text-xs font-bold text-ink">{monthName(m.month)}</p>
            <input value={m.project} onChange={(e) => set("months", at(d.months, i, { ...m, project: e.target.value }))} maxLength={LIMITS.short} aria-label={`${monthName(m.month)}: project`} placeholder="This month's project" className={field} />
            <input value={m.done} onChange={(e) => set("months", at(d.months, i, { ...m, done: e.target.value }))} maxLength={LIMITS.line} aria-label={`${monthName(m.month)}: what finished means`} placeholder="It's finished when…" className={field} />
          </div>
        ))}
      </Section>
      <Section title="First three tasks" hint="each under 30 minutes">
        {d.tasks.map((t, i) => <input key={i} value={t.text} onChange={(e) => set("tasks", at(d.tasks, i, { ...t, text: e.target.value }))} maxLength={LIMITS.short} aria-label={`Task ${i + 1}`} className={field} />)}
      </Section>
      <Section title="What I'll stop, and what I won't give up" hint="one per line">
        <Field label="I'll stop"><textarea value={d.stop} onChange={(e) => set("stop", e.target.value)} rows={2} className={field} /></Field>
        <Field label="I won't give up"><textarea value={d.keep} onChange={(e) => set("keep", e.target.value)} rows={2} className={field} /></Field>
      </Section>
      <Section title="What could stop me" hint="up to three habits">
        {d.risks.map((k, i) => (
          <div key={i} className="space-y-1.5">
            <input value={k.habit} onChange={(e) => set("risks", at(d.risks, i, { ...k, habit: e.target.value }))} maxLength={LIMITS.short} aria-label={`Habit ${i + 1}`} placeholder="The habit" className={field} />
            <input value={k.sign} onChange={(e) => set("risks", at(d.risks, i, { ...k, sign: e.target.value }))} maxLength={LIMITS.short} aria-label={`Habit ${i + 1}: early warning sign`} placeholder="Its early warning sign" className={field} />
            <input value={k.response} onChange={(e) => set("risks", at(d.risks, i, { ...k, response: e.target.value }))} maxLength={LIMITS.line} aria-label={`Habit ${i + 1}: what I do when I see it`} placeholder="What I do when I see it" className={field} />
          </div>
        ))}
      </Section>
      <Section title="Sunday review questions" hint="leave blank to use ours">
        {d.review.map((q, i) => <input key={i} value={q} onChange={(e) => set("review", at(d.review, i, e.target.value))} maxLength={LIMITS.short} aria-label={`Review question ${i + 1}`} className={field} />)}
      </Section>
      {error && <p role="alert" className="rounded-xl bg-[#FFF1F3] px-3 py-2 text-sm text-crimson">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={primary}>{busy ? "Saving…" : "Save my plan"}</button>
        <button type="button" onClick={onCancel} className={ghost}>Cancel</button>
      </div>
    </form>
  );
}
