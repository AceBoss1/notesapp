"use client";

import { useState } from "react";
import { CampusPage, Notice, btn, btnGhost, card, input, useCampus, useCampusView } from "@/components/campus/CampusKit";
import SelectBox from "@/components/ui/SelectBox";
import { PROGRESS_LABEL, TASK_KINDS, isOverdue, campusDay, taskKindLabel, type CampusMember, type CampusTask, type Progress, type ProgressStatus, type TaskKind } from "@/lib/campus";

// Admin → Campus → Tasks (lib/campus.ts). A coordinator gives tasks to some or all of her ambassadors and reviews what they hand in; an
// ambassador reports on hers (to do, in progress, done, with a note and a link as proof); a lead reads a country's or a team's.
const STATUS_TONE: Record<ProgressStatus, string> = { todo: "bg-field text-slate", doing: "bg-amber-50 text-amber-800", done: "bg-green-50 text-green-700" };
const dueText = (t: CampusTask, p: Progress | undefined, today: string) => (isOverdue(t, p, today) ? `Overdue (was due ${t.due})` : t.due === today ? "Due today" : `Due ${t.due}`);

export default function CampusTasksPage() {
  const { me, ready, denied, call } = useCampus();
  const coordinator = me?.member?.role === "coordinator";
  const ambassador = me?.member?.role === "ambassador" && !me.lead;
  const { data, error, reload } = useCampusView<{ tasks: CampusTask[] }>("tasks", {}, ready);
  const team = useCampusView<{ team: CampusMember[] }>("team", {}, ready && !ambassador);
  const people = Object.fromEntries((team.data?.team ?? []).map((m) => [m.uid, m]));
  const mine = (team.data?.team ?? []).filter((m) => m.role === "ambassador" && (!coordinator || m.coordinatorUid === me?.member?.uid));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const today = campusDay(me?.member?.country);

  const act = async (body: Record<string, unknown>, done: string) => {
    setBusy(true); setErr(""); setNote("");
    try { await call({ body }); setNote(done); await reload(); return true; } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); return false; } finally { setBusy(false); }
  };

  return (
    <CampusPage title="Tasks" me={me} denied={denied}
      intro={ambassador ? "What your coordinator asked you to do. Mark each one as you go, and when it's done add a note and a link that shows it (a post, a photo album, a form)." : coordinator ? "Give tasks to all your ambassadors or some of them, then review what they hand in." : "Every task in the country and how each ambassador is getting on."}>
      <Notice error={err || error} note={note} />
      {coordinator && <NewTask people={mine} today={today} busy={busy} onCreate={(b) => act({ action: "task", ...b }, "Task sent. Your ambassadors have been told.")} />}
      {!data ? <p className="font-ui text-sm text-slate">Loading…</p> : data.tasks.length === 0 ? (
        <p className={`${card} font-ui text-sm text-slate`}>{ambassador ? "No tasks yet. Your coordinator will add them here." : "No tasks yet."}</p>
      ) : (
        <ul className="space-y-4">
          {data.tasks.map((t) => ambassador
            ? <MyTask key={t.id} t={t} uid={me!.member!.uid} today={today} busy={busy} onReport={(b) => act({ action: "report", id: t.id, ...b }, "Saved. Your coordinator can see it.")} />
            : <TeamTask key={t.id} t={t} people={people} today={today} busy={busy} own={coordinator && t.coordinatorUid === me?.member?.uid}
                onReview={(uid, verdict, reviewNote) => act({ action: "review", id: t.id, uid, verdict, note: reviewNote }, verdict === "approved" ? "Approved." : "Sent back with your note.")}
                onDelete={() => { if (confirm(`Delete "${t.title}"? What your ambassadors reported on it goes too.`)) void act({ action: "delete", id: t.id }, "Task deleted."); }}
                onDue={(due) => act({ action: "edit", id: t.id, due }, "Due date changed.")} />)}
        </ul>
      )}
    </CampusPage>
  );
}

function NewTask({ people, today, busy, onCreate }: { people: CampusMember[]; today: string; busy: boolean; onCreate: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", details: "", kind: "signups" as TaskKind, target: "10", due: "", all: true, pick: [] as string[] });
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={`${btn} mb-5`}>+ New task</button>;
  const submit = async () => {
    const ok = await onCreate({ title: f.title, details: f.details, kind: f.kind, target: f.kind === "signups" ? Number(f.target) : undefined, due: f.due, assignees: f.all ? "all" : f.pick });
    if (ok) { setOpen(false); setF({ ...f, title: "", details: "", pick: [] }); }
  };
  return (
    <section className={`${card} mb-5`} aria-labelledby="new-task">
      <h2 id="new-task" className="font-ui text-base font-semibold text-ink">New task</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="mb-1.5 block font-ui text-[13px] text-slate">Title</span><input className={input} value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Bring 10 sign-ups from your faculty" /></label>
        <SelectBox label="Kind" value={f.kind} onChange={(kind) => setF({ ...f, kind })} options={TASK_KINDS.map((k) => ({ value: k.id, label: `${k.label}: ${k.hint}` }))} />
        <label className="block"><span className="mb-1.5 block font-ui text-[13px] text-slate">Due</span><input type="date" className={input} value={f.due} min={today} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
        {f.kind === "signups" && <label className="block"><span className="mb-1.5 block font-ui text-[13px] text-slate">Sign-ups each ambassador should bring</span><input type="number" min={1} className={input} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></label>}
        <label className="block sm:col-span-2"><span className="mb-1.5 block font-ui text-[13px] text-slate">Details (optional)</span><textarea rows={3} className={input} value={f.details} maxLength={2000} onChange={(e) => setF({ ...f, details: e.target.value })} placeholder="What to do, and what to send as proof" /></label>
      </div>
      <fieldset className="mt-4">
        <legend className="font-ui text-[13px] text-slate">For</legend>
        <div className="mt-2 flex flex-wrap gap-2 font-ui text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={f.all} onChange={() => setF({ ...f, all: true })} /> All my ambassadors ({people.length})</label>
          <label className="flex items-center gap-2"><input type="radio" checked={!f.all} onChange={() => setF({ ...f, all: false })} /> Choose</label>
        </div>
        {!f.all && (
          <ul className="mt-3 grid max-h-56 gap-1 overflow-y-auto rounded-[10px] border border-rule bg-paper p-2 sm:grid-cols-2">
            {people.map((m) => (
              <li key={m.uid}><label className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-ui text-sm text-ink hover:bg-card">
                <input type="checkbox" checked={f.pick.includes(m.uid)} onChange={(e) => setF({ ...f, pick: e.target.checked ? [...f.pick, m.uid] : f.pick.filter((u) => u !== m.uid) })} />
                <span className="truncate">{m.name} <span className="text-slate">· {m.campus}</span></span>
              </label></li>
            ))}
          </ul>
        )}
      </fieldset>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !f.title.trim() || !f.due || (!f.all && !f.pick.length)} onClick={() => void submit()} className={btn}>{busy ? "Sending…" : "Send the task"}</button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Cancel</button>
      </div>
    </section>
  );
}

function TaskHead({ t, line }: { t: CampusTask; line: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-ui text-base font-semibold text-ink">{t.title}</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-crimson-bright">{taskKindLabel(t.kind)}{t.target ? ` · ${t.target} each` : ""}</span>
      </div>
      <p className="mt-1 font-ui text-[13px] text-slate">{line}</p>
      {t.details && <p className="mt-2 whitespace-pre-line font-ui text-sm text-ink">{t.details}</p>}
    </>
  );
}

function MyTask({ t, uid, today, busy, onReport }: { t: CampusTask; uid: string; today: string; busy: boolean; onReport: (b: Record<string, unknown>) => Promise<boolean> }) {
  const p = t.progress[uid];
  const [f, setF] = useState({ status: (p?.status ?? "todo") as ProgressStatus, note: p?.note ?? "", proofUrl: p?.proofUrl ?? "" });
  return (
    <li className={card}>
      <TaskHead t={t} line={<span className={isOverdue(t, p, today) ? "font-semibold text-red-700" : ""}>{dueText(t, p, today)}</span>} />
      {p?.review === "redo" && <p className="mt-3 rounded-[10px] bg-amber-50 px-3 py-2 font-ui text-sm text-amber-900"><b>Needs another go:</b> {p.reviewNote}</p>}
      {p?.review === "approved" && <p className="mt-3 rounded-[10px] bg-green-50 px-3 py-2 font-ui text-sm text-green-800">✓ Approved by your coordinator.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-[12rem,1fr]">
        <SelectBox label="Where you are" value={f.status} onChange={(status) => setF({ ...f, status })} options={(Object.keys(PROGRESS_LABEL) as ProgressStatus[]).map((s) => ({ value: s, label: PROGRESS_LABEL[s] }))} />
        <label className="block"><span className="mb-1.5 block font-ui text-[13px] text-slate">Proof link (optional)</span><input className={input} value={f.proofUrl} onChange={(e) => setF({ ...f, proofUrl: e.target.value })} placeholder="https://" inputMode="url" /></label>
        <label className="block sm:col-span-2"><span className="mb-1.5 block font-ui text-[13px] text-slate">Note (optional)</span><textarea rows={2} className={input} value={f.note} maxLength={1000} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="What you did" /></label>
      </div>
      <button type="button" disabled={busy} onClick={() => void onReport(f)} className={`${btn} mt-4`}>Save</button>
    </li>
  );
}

function TeamTask({ t, people, today, busy, own, onReview, onDelete, onDue }: {
  t: CampusTask; people: Record<string, CampusMember>; today: string; busy: boolean; own: boolean;
  onReview: (uid: string, verdict: "approved" | "redo", note: string) => Promise<boolean>; onDelete: () => void; onDue: (due: string) => Promise<boolean>;
}) {
  const done = t.assignees.filter((u) => t.progress[u]?.status === "done").length;
  const [redo, setRedo] = useState<{ uid: string; note: string } | null>(null);
  const [due, setDue] = useState(t.due);
  return (
    <li className={card}>
      <TaskHead t={t} line={<>{t.due < today ? `Was due ${t.due}` : t.due === today ? "Due today" : `Due ${t.due}`} · {done} of {t.assignees.length} done{!own && people[t.coordinatorUid] ? ` · ${people[t.coordinatorUid].name}'s team` : ""}</>} />
      <ul className="mt-4 divide-y divide-rule rounded-[10px] border border-rule">
        {t.assignees.map((u) => {
          const p = t.progress[u] ?? { status: "todo" as const };
          const who = people[u];
          return (
            <li key={u} className="p-3 font-ui text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <b className="min-w-0 flex-1 truncate text-ink">{who?.name ?? "Former ambassador"}{who && <span className="font-normal text-slate"> · {who.campus}</span>}</b>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[p.status]}`}>{PROGRESS_LABEL[p.status]}</span>
                {isOverdue(t, p, today) && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">Overdue</span>}
                {p.review === "approved" && <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">✓ Approved</span>}
                {p.review === "redo" && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Sent back</span>}
              </div>
              {p.review === "redo" && p.reviewNote && <p className="mt-1 text-[13px] text-amber-800">You asked: {p.reviewNote}</p>}
              {(p.note || p.proofUrl) && <p className="mt-1 text-[13px] text-slate">{p.note}{p.note && p.proofUrl ? " · " : ""}{p.proofUrl && <a href={p.proofUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-crimson underline">Proof</a>}</p>}
              {own && p.status === "done" && p.review !== "approved" && (
                redo?.uid === u ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input className={`${input} min-w-0 flex-1`} value={redo.note} onChange={(e) => setRedo({ uid: u, note: e.target.value })} placeholder="What needs doing again" />
                    <button type="button" disabled={busy || !redo.note.trim()} onClick={() => void onReview(u, "redo", redo.note).then((ok) => ok && setRedo(null))} className={btnGhost}>Send back</button>
                    <button type="button" onClick={() => setRedo(null)} className="font-ui text-sm text-slate">Cancel</button>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busy} onClick={() => void onReview(u, "approved", "")} className="rounded-full bg-green-700 px-4 py-1.5 font-ui text-xs font-semibold text-white disabled:opacity-50">Approve</button>
                    <button type="button" disabled={busy} onClick={() => setRedo({ uid: u, note: "" })} className="rounded-full border border-rule px-4 py-1.5 font-ui text-xs font-semibold text-ink">Ask again</button>
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
      {own && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input type="date" aria-label="Due date" className={`${input} !w-auto`} value={due} onChange={(e) => setDue(e.target.value)} />
          {due !== t.due && <button type="button" disabled={busy} onClick={() => void onDue(due)} className={btnGhost}>Change due date</button>}
          <button type="button" disabled={busy} onClick={onDelete} className="ml-auto font-ui text-sm font-semibold text-red-700">Delete task</button>
        </div>
      )}
    </li>
  );
}
