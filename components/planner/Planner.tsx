"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { dayLabel } from "@/lib/month-calendar";
import { ANSWER_MAX, PLAN_TOOLS, hourLabel, monthName, monthShort, partTitle, planSpan, progress, type Plan } from "@/lib/planner";
import { PLAN_COLOUR, card, errText, field, ghost, isLocked, papi, primary, type InterviewView, type View } from "./api";
import { PlannerGate, PlannerHeader, PlannerTabs, type Gate } from "./PlannerGate";
import PlanForm from "./PlanForm";

// Notes Planner (/calendar/planner; docs/NOTES_PLANNER.md, mockups 1 to 5): the start screen, Nana's interview one question at a
// time, "Did I get you right?", then the plan and its twelve months. Everything is worked out on the server (lib/planner-server.ts).
type Mode = "auto" | "start" | "form" | "edit";

const Alert = ({ children }: { children: React.ReactNode }) => <p role="alert" className="rounded-xl bg-[#FFF1F3] px-3 py-2 text-sm text-crimson">{children}</p>;
const Note = ({ children }: { children: React.ReactNode }) => <p className="rounded-xl border border-[#F1D48A] bg-[#FFF4D6] px-3 py-2 text-xs leading-relaxed text-[#5a4300]">{children}</p>;
const Bar = ({ pct, colour = "rgb(var(--c-crimson, 122 3 40))" }: { pct: number; colour?: string }) => (
  <div className="h-1.5 overflow-hidden rounded-full bg-[#E5D9D3]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i className="block h-full rounded-full" style={{ width: `${pct}%`, background: colour }} /></div>
);

// ── 1 · The start screen ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function Start({ view, busy, onNana, onSelf, onBack }: { view: View; busy: boolean; onNana: (length: number) => void; onSelf: (length: number) => void; onBack?: () => void }) {
  const [length, setLength] = useState(view.lengths[view.lengths.length - 1]);
  const teen = view.teen;
  const items: [string, string, string][] = teen
    ? [["🎯", "One goal", "for this term or year, and up to three numbers to track"], ["🗂", "One project a month", "an exam, a skill or a habit"], ["✅", "Two or three moves a day", "in your calendar"], ["🪞", "A Sunday review", "three questions, five minutes"]]
    : [["🎯", "One goal", "with a date, and three numbers to track"], ["🗂", "One project a month", "for twelve months"], ["✅", "Two or three moves a day", "in your calendar"], ["🪞", "A Sunday review", "three questions, five minutes"]];
  return (
    <div className="mx-auto mt-6 max-w-xl space-y-4">
      <h2 className="font-display text-2xl text-ink">{teen ? "Plan your term or your year" : "Plan your next 12 months"}</h2>
      <p className="text-sm leading-relaxed text-slate">Nana asks about where you are and where you want to be. Then she writes a plan you can follow day by day. It covers <b className="text-ink">{planSpan(view.starts, length)}</b>.</p>
      <ul className={`${card} space-y-2.5 p-4`}>
        {items.map(([icon, bold, rest]) => <li key={bold} className="flex gap-2.5 text-[13.5px] leading-snug text-ink"><span aria-hidden>{icon}</span><span><b>{bold}</b> {rest}</span></li>)}
      </ul>
      {view.lengths.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
          <span className="font-semibold">Plan for</span>
          {view.lengths.map((n) => <button key={n} type="button" aria-pressed={length === n} onClick={() => setLength(n)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${length === n ? "border-crimson bg-crimson text-white" : "border-rule bg-card text-ink"}`}>{n === 3 ? "One term (3 months)" : "A year (12 months)"}</button>)}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={busy} onClick={() => onNana(length)} className={primary}>✨ {view.interview ? "Carry on with Nana" : "Start with Nana"}</button>
        <button type="button" disabled={busy} onClick={() => onSelf(length)} className={ghost}>✍️ Write it myself</button>
      </div>
      <Note>{teen ? "About 14 gentle questions, 10 to 15 minutes." : "About 25 questions, 20 to 30 minutes."} Stop at any time and carry on later. 🔒 Only you can read your answers. Nana&apos;s questions use your Nana allowance; writing it yourself is free. Nana is not a counsellor: this is planning, not therapy.</Note>
      {onBack && <button type="button" onClick={onBack} className="text-xs font-semibold text-crimson">← Back to my plan</button>}
    </div>
  );
}

// ── 2 and 3 · The interview, then "Did I get you right?" ─────────────────────────────────────────────────────────────────────────
function Interview({ g, view, iv, onChange, onPlan }: { g: Gate; view: View; iv: InterviewView; onChange: (iv: InterviewView) => void; onPlan: (plan: Plan) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | "answer" | "write">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fixing, setFixing] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [iv.messages.length, busy]);
  const teen = view.teen;

  const send = async (body: Record<string, unknown>) => {
    setBusy("answer"); setError(""); setNotice("");
    // Her answer shows at once; the server keeps it even if Nana can't reply.
    const mine = typeof body.message === "string" ? body.message : body.skip ? "(Skipped)" : "";
    if (mine) onChange({ ...iv, summary: null, messages: [...iv.messages, { role: "me", text: mine, at: new Date().toISOString() }] });
    try {
      const r = await papi<InterviewView & { notice?: string }>(g.user, { body: { action: "answer", ...body } });
      onChange(r); setText(""); setFixing(false); if (r.notice) setNotice(r.notice);
    } catch (e) {
      if (isLocked(e)) return g.locked();
      setError(errText(e, "Nana couldn't reply. Your answer is saved; try again in a moment."));
      papi<View>(g.user).then((v) => { if (v.interview) onChange(v.interview); }).catch(() => {});
    } finally { setBusy(""); }
  };
  const gentle = async () => {
    try { onChange(await papi<InterviewView>(g.user, { body: { action: "gentle", on: !iv.gentle } })); } catch (e) { if (isLocked(e)) g.locked(); else setError(errText(e, "Couldn't change that.")); }
  };
  const write = async () => {
    setBusy("write"); setError("");
    try { const r = await papi<{ plan: Plan; notice?: string }>(g.user, { body: { action: "write" } }); onPlan(r.plan); }
    catch (e) { if (isLocked(e)) g.locked(); else setError(errText(e, "Nana couldn't write the plan just now. Try again in a moment.")); }
    finally { setBusy(""); }
  };
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (text.trim() && !busy) send({ message: text.trim() }); };

  const summary = iv.summary;
  const shown = summary ? iv.messages.slice(0, -1) : iv.messages;
  return (
    <div className="mx-auto mt-5 max-w-xl">
      <div className="flex items-center justify-between gap-3 text-xs text-slate">
        <span><b className="text-ink">Part {iv.part} of 4</b> · {partTitle(iv.part, teen)}</span>
        <span>{summary ? "Last step" : `Question ${iv.asked} of about ${iv.target}`}</span>
      </div>
      <div className="mt-1.5"><Bar pct={iv.pct} /></div>
      <div className="mt-4 flex flex-col gap-2.5" aria-live="polite">
        {shown.slice(-40).map((m, i) => m.role === "nana" ? (
          <div key={i} className="max-w-[88%] self-start whitespace-pre-line rounded-2xl rounded-bl-md border border-[#F0CBD6] bg-gradient-to-br from-card to-[#FBEFF3] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink"><b className="mb-0.5 block text-[11px] text-crimson">Nana</b>{m.text}</div>
        ) : (
          <div key={i} className="max-w-[84%] self-end whitespace-pre-line rounded-2xl rounded-br-md bg-crimson px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">{m.text}</div>
        ))}
        {busy === "answer" && <div className="self-start rounded-2xl border border-[#F0CBD6] bg-card px-3.5 py-2.5 text-[13px] text-slate">Nana is thinking…</div>}
        {summary && (
          <div className="rounded-2xl border border-[#F0CBD6] bg-gradient-to-br from-card to-[#FBEFF3] p-4 text-[13.5px] leading-relaxed text-ink">
            <b className="text-crimson">Here is what I heard, in your words:</b>
            <ol className="mt-2 space-y-1.5">{summary.map((l, i) => <li key={i} className="flex gap-2"><span className="text-slate">{i + 1}</span><span>{l}</span></li>)}</ol>
          </div>
        )}
        <div ref={end} />
      </div>
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      {notice && <div className="mt-3"><Note>{notice}</Note></div>}
      {summary && !fixing ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-slate">Correct anything that&apos;s wrong before I write your plan.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={write} disabled={!!busy} className={primary}>{busy === "write" ? "Writing your plan…" : "Yes, write my plan"}</button>
            <button type="button" onClick={() => setFixing(true)} disabled={!!busy} className={ghost}>Change something</button>
          </div>
          <p className="text-[11px] text-slate">{busy === "write" ? "This takes about a minute. Please keep this page open." : "The plan takes about a minute to write. You can edit every line afterwards."}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-2">
          {!summary && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" disabled={!!busy} onClick={() => send({ skip: true })} className="rounded-full border border-rule bg-card px-3 py-1 text-xs text-ink hover:border-crimson disabled:opacity-50">Skip this one</button>
              {!teen && <button type="button" disabled={!!busy} onClick={gentle} aria-pressed={iv.gentle} className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${iv.gentle ? "border-crimson bg-[#FBF0F3] text-crimson" : "border-rule bg-card text-ink hover:border-crimson"}`}>{iv.gentle ? "Gentler ✓" : "Go gentler"}</button>}
              {iv.asked >= 8 && <button type="button" disabled={!!busy || !text.trim()} onClick={() => send({ message: text.trim(), sumUp: true })} title="Answer this one, then ask Nana to sum up" className="rounded-full border border-rule bg-card px-3 py-1 text-xs text-ink hover:border-crimson disabled:opacity-50">Answer and sum up</button>}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={ANSWER_MAX} rows={2} placeholder={summary ? "What should I change?" : "Type your answer…"} aria-label={summary ? "What should Nana change?" : "Your answer"}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e); }} className={`${field} min-h-[3rem] flex-1 resize-y`} />
            <button type="submit" disabled={!!busy || !text.trim()} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-crimson text-white disabled:opacity-40">➤</button>
          </div>
          <p className="text-[11px] text-slate">Your answers save as you go. <Link href="/calendar" className="underline">Finish later</Link>{summary ? <> · <button type="button" className="underline" onClick={() => setFixing(false)}>Back</button></> : null}</p>
        </form>
      )}
    </div>
  );
}

// ── 4 and 5 · The plan, and month by month ───────────────────────────────────────────────────────────────────────────────────────
function Tick({ done, label, onChange, disabled }: { done: boolean; label: string; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={done} disabled={disabled} onClick={() => onChange(!done)} className={`flex w-full items-center gap-2.5 ${card} px-3 py-2.5 text-left text-[13.5px] disabled:opacity-60`}>
      <i className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-[11px] not-italic text-white" style={done ? { background: PLAN_COLOUR, borderColor: PLAN_COLOUR } : { borderColor: "#CFC3BC" }} aria-hidden>{done ? "✓" : ""}</i>
      <span className={done ? "text-slate line-through" : "text-ink"}>{label}</span>
    </button>
  );
}
const Label = ({ children }: { children: React.ReactNode }) => <h3 className="font-ui text-[11px] font-bold uppercase tracking-wider text-slate">{children}</h3>;

function PlanView({ g, view, onView, onEdit, onNew }: { g: Gate; view: View; onView: (v: View) => void; onEdit: () => void; onNew: () => void }) {
  const plan = view.plan!;
  const [error, setError] = useState("");
  const act = async (body: Record<string, unknown>, apply: (r: { plan?: Plan; view?: NonNullable<View["day"]> }) => View) => {
    setError("");
    try { onView(apply(await papi(g.user, { body }))); } catch (e) { if (isLocked(e)) g.locked(); else setError(errText(e, "Couldn't save that.")); }
  };
  const day = view.day;
  const thisMonth = view.today.slice(0, 7);
  const end = plan.months[plan.months.length - 1].month;
  const ended = thisMonth > end;
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
      <section className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {view.interview && <Note>You have a new plan interview in progress. <button type="button" className="font-bold underline" onClick={onNew}>Carry on with Nana</button></Note>}
        <div className="rounded-2xl bg-gradient-to-br from-[rgb(var(--c-crimson-deep,78_1_25))] to-[rgb(var(--c-crimson-bright,166_9_61))] p-4 text-white">
          <p className="text-[10.5px] font-bold uppercase tracking-wider opacity-80">The goal · by the end of {monthName(end)}</p>
          <p className="mt-1 font-display text-xl leading-snug">{plan.goal}</p>
          <p className="mt-2 text-[11px] opacity-80">{planSpan(plan.start, plan.months.length)}{plan.by === "nana" ? " · written with Nana" : ""}</p>
        </div>
        {plan.becoming && <div className={`${card} p-4 text-[13.5px] leading-relaxed text-ink`}><Label>Who I&apos;m becoming</Label><p className="mt-1">{plan.becoming}</p></div>}
        {(plan.vision || plan.refuse) && (
          <div className={`${card} space-y-2 p-4 text-[13.5px] leading-relaxed text-ink`}>
            {plan.vision && <div><Label>The life I&apos;m building</Label><p className="mt-1">{plan.vision}</p></div>}
            {plan.refuse && <div><Label>The life I refuse</Label><p className="mt-1">{plan.refuse}</p></div>}
          </div>
        )}
        {plan.numbers.length > 0 && (
          <div>
            <Label>{plan.numbers.length === 3 ? "Three numbers" : "My numbers"}</Label>
            <div className={`${card} mt-2 space-y-3 p-4`}>
              {plan.numbers.map((n, i) => {
                const pct = progress(n);
                return (
                  <div key={i} className="text-[13px] text-ink">
                    <div className="flex items-baseline justify-between gap-3"><span>{n.label}</span><b className="shrink-0">{n.now || n.start || "?"} <span className="font-normal text-slate">of {n.target}</span></b></div>
                    {pct !== null && <div className="mt-1.5"><Bar pct={pct} /></div>}
                  </div>
                );
              })}
              <p className="text-[11px] text-slate">Numbers move when you update them in your Sunday review.</p>
            </div>
          </div>
        )}
        {(plan.stop.length > 0 || plan.keep.length > 0) && (
          <div>
            <Label>What I&apos;ll stop · what I won&apos;t give up</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plan.stop.map((s) => <span key={`s${s}`} className="rounded-full border border-rule bg-card px-3 py-1 text-xs text-ink">🚫 {s}</span>)}
              {plan.keep.map((s) => <span key={`k${s}`} className="rounded-full border border-rule bg-card px-3 py-1 text-xs text-ink">💛 {s}</span>)}
            </div>
          </div>
        )}
        {plan.risks.length > 0 && (
          <div>
            <Label>What could stop me</Label>
            <ul className="mt-2 space-y-2">
              {plan.risks.map((k, i) => <li key={i} className="rounded-xl border border-[#F3C8A2] bg-[#FFF1E6] px-3 py-2 text-xs leading-relaxed text-[#5a2e00]"><b>{k.habit}</b>{k.sign && <> · Early sign: {k.sign}</>}{k.response && <><br />When I see it: {k.response}</>}</li>)}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={onEdit} className={ghost}>✏️ Edit my plan</button>
          <button type="button" onClick={onNew} className={ghost}>{ended ? "Plan my next 12 months" : "Start a new plan"}</button>
        </div>
        {view.old && <details className="text-xs text-slate"><summary className="cursor-pointer">Your plan before this one</summary><p className="mt-1 leading-relaxed">{planSpan(view.old.start, view.old.months.length)}: {view.old.goal}</p></details>}
      </section>

      <section className="space-y-4">
        {view.review?.open && (
          <Link href="/calendar/planner/review" className={`flex items-center justify-between gap-3 ${card} p-4 hover:border-crimson`}>
            <span><b className="block font-ui text-sm text-ink">🪞 Sunday review</b><span className="text-xs text-slate">{view.review.done ? "Done for this week. Open it to read Nana's note or change it." : "Three questions, five minutes. This week's is waiting."}</span></span>
            <span className="text-crimson" aria-hidden>›</span>
          </Link>
        )}
        <div>
          <div className="flex items-center justify-between"><Label>{day?.inPlan ? "Today's moves" : "Every day"}</Label>{view.streak > 0 && <span className="text-xs text-slate">🔥 {view.streak} day{view.streak === 1 ? "" : "s"}</span>}</div>
          <div className="mt-2 space-y-2">
            {day?.inPlan
              ? day.moves.map((m, i) => <Tick key={i} done={m.done} label={m.text} onChange={(on) => act({ action: "tick", i, on }, (r) => ({ ...view, day: r.view ?? view.day }))} />)
              : plan.moves.map((m, i) => <p key={i} className={`${card} px-3 py-2.5 text-[13.5px] text-ink`}>{m}</p>)}
            {day && !day.inPlan && day.startsIn > 0 && <p className="text-xs text-slate">Your plan starts in {day.startsIn} day{day.startsIn === 1 ? "" : "s"}, on {dayLabel(plan.start)}. Ticks open then.</p>}
          </div>
        </div>
        {plan.tasks.length > 0 && (
          <div>
            <Label>First three tasks</Label>
            <div className="mt-2 space-y-2">{plan.tasks.map((t, i) => <Tick key={i} done={t.done} label={t.text} onChange={(on) => act({ action: "task", i, on }, (r) => ({ ...view, plan: r.plan ?? plan }))} />)}</div>
          </div>
        )}
        <div>
          <Label>Month by month</Label>
          <p className="mt-1 text-xs text-slate">One project a month. Each is finished by the last day.</p>
          <ul className="mt-2 space-y-1.5">
            {plan.months.map((m) => {
              const now = m.month === thisMonth, tool = m.tool ? PLAN_TOOLS[m.tool] : null;
              return (
                <li key={m.month} className={`rounded-xl border bg-card px-3 py-2 ${now ? "border-2 border-crimson bg-[#FBF0F3]" : "border-rule"} ${m.finished ? "opacity-70" : ""}`}>
                  <div className="flex items-start gap-3">
                    <b className={`mt-0.5 w-8 shrink-0 font-ui text-[11px] ${now ? "text-crimson" : "text-slate"}`} title={monthName(m.month)}>{monthShort(m.month)}</b>
                    <div className="min-w-0 flex-1 text-[13px] leading-snug text-ink">
                      <span className={m.finished ? "line-through" : ""}>{m.project || <span className="text-slate">No project yet</span>}</span>
                      {m.done && <span className="mt-0.5 block text-[11.5px] text-slate">Done when: {m.done}</span>}
                      {tool && <Link href={tool.href} className="mt-0.5 inline-block text-[11.5px] font-semibold text-crimson underline">Use {tool.label} on #NotesApp</Link>}
                    </div>
                    {m.project && m.month <= thisMonth && (
                      <button type="button" onClick={() => act({ action: "month", month: m.month, on: !m.finished }, (r) => ({ ...view, plan: r.plan ?? plan }))} aria-pressed={m.finished} className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${m.finished ? "border-transparent text-white" : "border-rule text-ink hover:border-crimson"}`} style={m.finished ? { background: PLAN_COLOUR } : undefined}>{m.finished ? "Finished ✓" : "Finished?"}</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-xs text-slate">Reminders: today&apos;s moves at {hourLabel(view.prefs.movesBell).toLowerCase()}, Sunday review at {hourLabel(view.prefs.reviewBell).toLowerCase()}. <Link href="/calendar/planner/settings" className="text-crimson underline">Change</Link> · <Link href="/help/notes-planner" className="text-crimson underline">How Notes Planner works</Link></p>
      </section>
    </div>
  );
}

// ── The page ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function Inner({ g }: { g: Gate }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [length, setLength] = useState(12);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => papi<View>(g.user).then(setView).catch((e) => { if (isLocked(e)) g.locked(); else setError(errText(e, "Couldn't open Notes Planner.")); }), [g]);
  useEffect(() => { load(); }, [load]);

  if (error && !view) return <div className="mx-auto max-w-xl px-4 py-12"><PlannerHeader title="Notes Planner" back={{ href: "/calendar", label: "My Calendar" }} /><p className={`${card} mt-6 p-6 text-sm text-slate`}>{error}</p></div>;
  if (!view) return <p className="px-4 py-16 text-center text-sm text-slate">Opening Notes Planner…</p>;

  const start = async (len: number) => {
    setBusy(true); setError("");
    try { const iv = await papi<InterviewView>(g.user, { body: { action: "start", length: len } }); setView({ ...view, interview: iv }); setMode("auto"); }
    catch (e) { if (isLocked(e)) g.locked(); else setError(errText(e, "Couldn't start.")); }
    finally { setBusy(false); }
  };
  const iv = view.interview;
  // With a plan, the plan shows unless she asked for something else; without one, the interview if there is one, else the start screen.
  const screen = mode === "form" || mode === "edit" ? mode : mode === "start" ? (iv ? "interview" : "start") : view.plan ? "plan" : iv ? "interview" : "start";
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PlannerHeader title="My Calendar" />
      <PlannerTabs active="planner" />
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      {screen === "start" && <Start view={view} busy={busy} onNana={start} onSelf={(n) => { setLength(n); setMode("form"); }} onBack={view.plan ? () => setMode("auto") : undefined} />}
      {screen === "interview" && iv && (
        <>
          <Interview g={g} view={view} iv={iv} onChange={(next) => setView({ ...view, interview: next })} onPlan={() => { setMode("auto"); setView(null); load(); }} />
          <p className="mx-auto mt-4 max-w-xl text-center text-[11px] text-slate">
            Rather write it yourself? <button type="button" className="underline" onClick={() => { setLength(iv.length); setMode("form"); }}>Open the form</button>
            {view.plan && <> · <button type="button" className="underline" onClick={() => setMode("auto")}>Back to my plan</button></>}
          </p>
        </>
      )}
      {(screen === "form" || screen === "edit") && (
        <PlanForm g={g} teen={view.teen} plan={screen === "edit" ? view.plan : null} start={view.starts} length={length}
          onSaved={() => { setMode("auto"); setView(null); load(); }} onCancel={() => setMode("auto")} />
      )}
      {screen === "plan" && <PlanView g={g} view={view} onView={setView} onEdit={() => setMode("edit")} onNew={() => setMode("start")} />}
    </div>
  );
}

export default function Planner() {
  return <PlannerGate next="/calendar/planner">{(g) => <Inner g={g} />}</PlannerGate>;
}
