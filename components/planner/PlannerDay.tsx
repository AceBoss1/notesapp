"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { monthShort } from "@/lib/planner";
import { PLAN_COLOUR, card, errText, isLocked, papi, type DayData } from "./api";

// The plan's part of a day in My Calendar (docs/NOTES_PLANNER.md, mockup 6): the month's project on top, the day's moves to tick,
// and today the first three tasks. Nothing shows for a member with no plan; with her lock on it says so and links to the Planner.
function Tick({ done, label, onChange, disabled }: { done: boolean; label: string; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={done} disabled={disabled} onClick={() => onChange(!done)} className={`flex w-full items-center gap-2.5 ${card} px-3 py-2.5 text-left text-[13.5px] disabled:cursor-default`}>
      <i className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-[11px] not-italic text-white" style={done ? { background: PLAN_COLOUR, borderColor: PLAN_COLOUR } : { borderColor: "#CFC3BC" }} aria-hidden>{done ? "✓" : ""}</i>
      <span className={done ? "text-slate line-through" : "text-ink"}>{label}</span>
    </button>
  );
}

export default function PlannerDay({ user, day, hidden }: { user: User; day: string; hidden: boolean }) {
  const [data, setData] = useState<DayData | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setError("");
    papi<DayData>(user, { query: `day=${day}` }).then((d) => { if (live) { setData(d); setLocked(false); } }).catch((e) => { if (live) { setData(null); setLocked(isLocked(e)); } });
    return () => { live = false; };
  }, [user, day]);
  if (hidden) return null;
  if (locked) return <p className={`${card} mb-3 px-3 py-2.5 text-xs text-slate`}>🔒 Your Planner is locked. <Link href="/calendar/planner" className="font-semibold text-crimson underline">Unlock it</Link> to see your moves.</p>;
  if (!data?.has) return null;
  const v = data.view;
  if (!v.inPlan) return v.startsIn > 0 && v.startsIn <= 31 ? <p className={`${card} mb-3 px-3 py-2.5 text-xs text-slate`}><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: PLAN_COLOUR }} aria-hidden />Your plan starts in {v.startsIn} day{v.startsIn === 1 ? "" : "s"}. <Link href="/calendar/planner" className="font-semibold text-crimson underline">Open Planner</Link></p> : null;
  const send = async (body: Record<string, unknown>) => {
    setError("");
    try {
      const r = await papi<{ view?: typeof v; plan?: { tasks: { text: string; done: boolean }[] } }>(user, { body });
      setData((d) => (d?.has ? { ...d, view: r.view ?? d.view, tasks: r.plan ? r.plan.tasks : d.tasks } : d));
    } catch (e) { if (isLocked(e)) setLocked(true); else setError(errText(e, "Couldn't save that.")); }
  };
  return (
    <div className="mb-4 space-y-2">
      {v.month && (
        <Link href="/calendar/planner" className="flex items-center gap-3 rounded-xl border border-crimson bg-[#FBF0F3] px-3 py-2 text-[12.5px] text-ink">
          <b className="font-ui text-[11px] text-crimson">{monthShort(v.month.month)}</b>
          <span className={`min-w-0 flex-1 ${v.month.finished ? "line-through" : ""}`}>{v.month.project}</span>
          <span className="shrink-0 text-slate">{v.month.finished ? "Finished ✓" : v.daysLeft === 0 ? "Last day" : `${v.daysLeft} day${v.daysLeft === 1 ? "" : "s"} left`}</span>
        </Link>
      )}
      {v.moves.map((m, i) => <Tick key={i} done={m.done} label={m.text} disabled={!data.canTick} onChange={(on) => send({ action: "tick", day, i, on })} />)}
      {data.tasks.some((t) => !t.done) && (
        <>
          <h3 className="pt-1 font-ui text-xs font-bold text-ink">First three tasks</h3>
          {data.tasks.map((t, i) => <Tick key={`t${i}`} done={t.done} label={t.text} onChange={(on) => send({ action: "task", i, on })} />)}
        </>
      )}
      {!data.canTick && <p className="text-[11px] text-slate">You can tick a move on the day, not before it.</p>}
      {error && <p role="alert" className="text-xs text-crimson">{error}</p>}
    </div>
  );
}
