"use client";
import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { hasDept } from "@/lib/admin-access";
import { EXAM_IDS, EXAMS, PREP_NAME, type ExamId, type Pack, type Question, type Subject } from "@/lib/exam-prep";
import ReviewCard from "@/components/exam-prep/ReviewCard";
import QuestionEditor, { draftOf, type Draft } from "@/components/exam-prep/QuestionEditor";

// Admin → Naija Exam Prep. Editorial (questions, import, publishing, subjects, reviewers, reports) for content; packs, access,
// grants and refunds for finance; usage for product. The API checks the same departments (app/api/admin/exam-prep).
type Tab = "questions" | "import" | "subjects" | "reviewers" | "reports" | "schools" | "packs" | "access" | "usage";
const TABS: { key: Tab; label: string; dept: "content" | "finance" | "product" }[] = [
  { key: "questions", label: "Questions", dept: "content" }, { key: "import", label: "Import", dept: "content" }, { key: "subjects", label: "Subjects", dept: "content" },
  { key: "reviewers", label: "Reviewers", dept: "content" }, { key: "reports", label: "Reports", dept: "content" }, { key: "schools", label: "Schools", dept: "content" },
  { key: "packs", label: "Packs", dept: "finance" }, { key: "access", label: "Access & refunds", dept: "finance" }, { key: "usage", label: "Usage", dept: "product" },
];
const STATUSES = ["in_review", "changes", "approved", "published", "draft", "retired"] as const;
const naira = (k: number) => `₦${(k / 100).toLocaleString("en-NG")}`;

export default function AdminExamPrep() {
  const { user, access, loading } = useAdminAuth();
  const tabs = TABS.filter((t) => hasDept(access, t.dept));
  const [tab, setTab] = useState<Tab | null>(null);
  useEffect(() => { if (!tab && tabs.length) setTab(tabs[0].key); }, [tab, tabs]);
  const api = useCallback(async <T,>(q: string, body?: unknown): Promise<T> => {
    const r = await fetch(`/api/admin/exam-prep${q}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${await user!.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j as T;
  }, [user]);
  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <p className="eyebrow text-crimson">Admin · Academy</p>
      <h1 className="mt-1 font-display text-4xl">{PREP_NAME}</h1>
      <p className="mt-2 text-sm text-slate">JAMB, WAEC and NECO practice at prep.notesapp.name.ng. Questions go draft → in review → approved → published; packs are NotesApp revenue.</p>
      {!tabs.length && <p className="mt-6 text-sm">This page is for Editorial, Finance or Product & tech.</p>}
      <div className="mt-6 flex flex-wrap gap-1.5">{tabs.map((t) => <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-full px-3 py-1.5 text-sm ${tab === t.key ? "bg-ink text-paper" : "border border-rule"}`}>{t.label}</button>)}</div>
      <div className="mt-6">
        {tab === "questions" && <Questions api={api} />}
        {tab === "import" && <Import api={api} />}
        {tab === "subjects" && <Subjects api={api} />}
        {tab === "reviewers" && <Reviewers api={api} />}
        {tab === "reports" && <Reports api={api} />}
        {tab === "schools" && <Schools api={api} />}
        {tab === "packs" && <Packs api={api} />}
        {tab === "access" && <AccessTab api={api} />}
        {tab === "usage" && <Usage api={api} />}
      </div>
    </section>
  );
}
type Api = <T>(q: string, body?: unknown) => Promise<T>;
const Err = ({ e }: { e: string }) => (e ? <p className="mt-3 text-sm text-crimson">{e}</p> : null);
const toInput = (d: Draft) => ({ ...d, options: d.options.filter((o) => o.trim()) });

function Questions({ api }: { api: Api }) {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("in_review");
  const [exam, setExam] = useState<ExamId | "">("");
  const [subject, setSubject] = useState("");
  const [qs, setQs] = useState<Question[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const [e, setE] = useState("");
  const load = useCallback(() => { setE(""); api<{ questions: Question[] }>(`?view=questions&status=${status}${exam ? `&exam=${exam}` : ""}${subject ? `&subject=${subject}` : ""}`).then((r) => setQs(r.questions)).catch((x) => setE(x.message)); }, [api, status, exam, subject]);
  useEffect(load, [load]);
  useEffect(() => { api<{ subjects: Subject[] }>("?view=subjects").then((r) => setSubjects(r.subjects)).catch(() => undefined); }, [api]);
  async function publish(ids: string[], on: boolean) {
    const r = await api<{ results: { id: string; error?: string }[] }>("", { action: "publish", ids, publish: on });
    const bad = r.results.filter((x) => x.error);
    setE(bad.length ? bad.map((b) => `${b.id}: ${b.error}`).join(" · ") : "");
    load();
  }
  const [busy, setBusy] = useState(false);
  async function approveAll(ids: string[]) {
    if (!confirm(`Approve all ${ids.length} questions shown? You'll be recorded as the reviewer on each. Check them first: students see them once they're published.`)) return;
    setBusy(true); setE("");
    try {
      const r = await api<{ approved: number; results: { id: string; status?: string; error?: string }[] }>("", { action: "approve_all", ids });
      const bad = r.results.filter((x) => x.error);
      const waiting = r.results.filter((x) => x.status === "in_review").length;
      setE([`${r.approved} approved.`, waiting ? `${waiting} need another reviewer (their subject needs two approvals).` : "", bad.length ? bad.map((b) => `${b.id}: ${b.error}`).join(" · ") : "", r.approved ? "Next: switch to Approved and Publish all." : ""].filter(Boolean).join(" "));
      load();
    } catch (x) { setE((x as Error).message); } finally { setBusy(false); }
  }
  async function review(id: string, decision: string, note: string) {
    const token = await (await import("@/lib/firebase")).auth.currentUser!.getIdToken();
    const r = await fetch("/api/exam-prep/review", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id, decision, note }) });
    if (!r.ok) throw new Error((await r.json()).error || "Failed");
    load();
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-lg border border-rule px-2 py-1.5 text-sm" value={status} onChange={(x) => setStatus(x.target.value as typeof status)}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
        <select className="rounded-lg border border-rule px-2 py-1.5 text-sm" value={exam} onChange={(x) => setExam(x.target.value as ExamId | "")}><option value="">All exams</option>{EXAM_IDS.map((x) => <option key={x} value={x}>{EXAMS[x].short}</option>)}</select>
        <select className="rounded-lg border border-rule px-2 py-1.5 text-sm" value={subject} onChange={(x) => setSubject(x.target.value)} aria-label="Subject"><option value="">All subjects</option>{Array.from(new Map(subjects.filter((x) => !exam || x.exam === exam).map((x) => [x.id, x.name])).entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        <span className="text-sm text-slate">{qs?.length ?? "…"} questions{qs?.length === 500 ? " (the first 500: pick an exam or subject)" : ""}</span>
        {status === "approved" && qs && qs.length > 0 && <button onClick={() => publish(qs.map((q) => q.id), true)} className="rounded-lg bg-[#1E8E5A] px-3 py-1.5 text-sm font-semibold text-white">Publish all {qs.length}</button>}
        {status === "in_review" && qs && qs.length > 0 && <button onClick={() => approveAll(qs.map((q) => q.id))} disabled={busy} className="rounded-lg bg-[#1E8E5A] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Approving…" : `Approve all ${qs.length} shown`}</button>}
        <button onClick={() => setEditing("new")} className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-sm text-paper">New question</button>
      </div>
      <Err e={e} />
      {editing && <div className="mt-4"><QuestionEditor subjects={subjects} initial={draftOf(editing === "new" ? undefined : editing)} onCancel={() => setEditing(null)} onSave={async (d, asDraft) => { await api("", { action: "save_question", id: editing === "new" ? undefined : editing.id, question: { ...toInput(d), draft: asDraft } }); setEditing(null); load(); }} /></div>}
      <div className="mt-4 space-y-3">
        {qs?.map((q) => (
          <ReviewCard key={q.id} q={q} onReview={q.status === "in_review" ? (d, n) => review(q.id, d, n) : undefined} actions={<>
            <button onClick={() => setEditing(q)} className="rounded-lg border border-rule px-3 py-1.5 text-sm">Edit</button>
            {q.status === "approved" && <button onClick={() => publish([q.id], true)} className="rounded-lg bg-[#1E8E5A] px-3 py-1.5 text-sm font-semibold text-white">Publish</button>}
            {q.status === "published" && <button onClick={() => publish([q.id], false)} className="rounded-lg border border-rule px-3 py-1.5 text-sm">Unpublish (retire)</button>}
          </>} />
        ))}
      </div>
    </div>
  );
}

function Import({ api }: { api: Api }) {
  const [csv, setCsv] = useState("");
  const [res, setRes] = useState<{ added: number; skipped: number; errors: { line: number; errors: string[] }[]; subjectsAdded?: string[] } | null>(null);
  const [starter, setStarter] = useState<number | null>(null);
  const [e, setE] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<{ starter: number }>("?view=subjects").then((r) => setStarter(r.starter)).catch(() => undefined); }, [api]);
  const run = async (body: unknown) => { setBusy(true); setE(""); setRes(null); try { setRes(await api("", body)); } catch (x) { setE((x as Error).message); } finally { setBusy(false); } };
  return (
    <div className="space-y-6">
      <div className="card p-4">
        <p className="font-semibold">Starter set</p>
        <p className="mt-1 text-sm text-slate">{starter ?? "…"} original questions (content/exam-prep/starter.json): JAMB English, Maths, Physics, Chemistry, Biology, Economics and Government; WAEC and NECO 50 each in 18 subjects (those seven plus Literature, Geography, Agricultural Science, Civic Education, Commerce, Financial Accounting, CRS, IRS, Further Maths, Computer Studies and History). Questions already there are skipped. Subjects you don’t have yet are added first, labelled “Nana AI-assisted draft”. They go in as in review; nothing is published until a reviewer approves it and you publish. Importing twice adds nothing twice.</p>
        <button disabled={busy} onClick={() => run({ action: "import_starter" })} className="mt-3 rounded-lg bg-ink px-3 py-1.5 text-sm text-paper">Import the starter set</button>
      </div>
      <div className="card p-4">
        <p className="font-semibold">Spreadsheet (CSV)</p>
        <p className="mt-1 text-sm text-slate">Columns: exam, subject, topic, context, stem, A, B, C, D, E, answer, explanation, why_A … why_E, difficulty, access (free or pack). Subject and topic by name or id. Every row goes in as in review.</p>
        <input type="file" accept=".csv,text/csv" className="mt-3 text-sm" onChange={async (x) => { const f = x.target.files?.[0]; if (f) setCsv(await f.text()); }} />
        <textarea className="mt-2 h-32 w-full rounded-lg border border-rule p-2 font-mono text-xs" value={csv} onChange={(x) => setCsv(x.target.value)} placeholder="…or paste the CSV here" />
        <button disabled={busy || !csv.trim()} onClick={() => run({ action: "import_csv", csv })} className="mt-2 rounded-lg bg-ink px-3 py-1.5 text-sm text-paper">Import</button>
      </div>
      <Err e={e} />
      {res && <div className="card p-4 text-sm"><p><b>{res.added}</b> added · {res.skipped} already there · {res.errors.length} with problems</p>{!!res.subjectsAdded?.length && <p className="mt-1 text-slate">{res.subjectsAdded.length} new subjects added: {res.subjectsAdded.join(", ")}</p>}{res.errors.slice(0, 50).map((x) => <p key={x.line} className="text-crimson">Line {x.line}: {x.errors.join(" ")}</p>)}</div>}
    </div>
  );
}

function Subjects({ api }: { api: Api }) {
  const [subs, setSubs] = useState<Subject[] | null>(null);
  const [e, setE] = useState("");
  const load = useCallback(() => api<{ subjects: Subject[] }>("?view=subjects").then((r) => setSubs(r.subjects)).catch((x) => setE(x.message)), [api]);
  useEffect(() => { load(); }, [load]);
  const save = async (s: Subject, patch: Partial<Subject>) => { setE(""); try { await api("", { action: "save_subject", ...s, ...patch }); load(); } catch (x) { setE((x as Error).message); } };
  return (
    <div>
      <p className="text-sm text-slate">A subject shows to students once it's live and has published questions. Approvals: how many reviewers must approve each question (move to 2 once there are enough reviewers).</p>
      <Err e={e} />
      <div className="mt-3 space-y-2">
        {subs?.map((s) => (
          <div key={`${s.exam}_${s.id}`} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
            <b className="w-14">{EXAMS[s.exam].short}</b><span className="min-w-[160px] flex-1">{s.name} <span className="text-slate">· {s.topics.map((t) => t.name).join(", ")}</span></span>
            <label className="flex items-center gap-1"><input type="checkbox" checked={s.live} onChange={(x) => save(s, { live: x.target.checked })} />Live</label>
            <label className="flex items-center gap-1">Approvals <select className="rounded border px-1" value={s.approvalsNeeded} onChange={(x) => save(s, { approvalsNeeded: Number(x.target.value) })}><option value={1}>1</option><option value={2}>2</option></select></label>
          </div>
        ))}
      </div>
    </div>
  );
}

type Inv = { id: string; kind: "single" | "open"; subjects: string[]; uses: number; maxUses: number; active: boolean; createdAt: string; expiresAt: string; note: string; by: string };
type Rev = { uid: string; name: string; active: boolean; subjects: string[]; reviews: number; reviewsByMonth: Record<string, number>; lastReviewAt: string | null; at: string };
function Reviewers({ api }: { api: Api }) {
  const [data, setData] = useState<{ reviewers: Rev[]; invites: Inv[] } | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pick, setPick] = useState<string[]>([]);
  const [kind, setKind] = useState<"single" | "open">("open");
  const [days, setDays] = useState(30);
  const [maxUses, setMaxUses] = useState(50);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [e, setE] = useState("");
  const load = useCallback(() => api<NonNullable<typeof data>>("?view=reviewers").then(setData).catch((x) => setE(x.message)), [api]);
  useEffect(() => { load(); api<{ subjects: Subject[] }>("?view=subjects").then((r) => setSubjects(r.subjects)).catch(() => undefined); }, [load, api]);
  const key = (s: Subject) => `${s.exam}_${s.id}`;
  const label = (k: string) => { const s = subjects.find((x) => key(x) === k); return s ? `${EXAMS[s.exam].short} ${s.name}` : k; };
  const toggle = (k: string) => setPick((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const month = new Date().toISOString().slice(0, 7);
  async function invite() {
    setE(""); setLink("");
    try { const r = await api<{ token: string }>("", { action: "invite", subjects: pick, kind, days, maxUses, note }); setLink(`https://prep.notesapp.name.ng/review/invite?t=${r.token}`); setNote(""); load(); } catch (x) { setE((x as Error).message); }
  }
  return (
    <div>
      <div className="card p-4">
        <p className="font-semibold">Invite reviewers</p>
        <p className="mt-1 text-sm text-slate">1. Choose the subjects they&apos;ll review. 2. Choose a link for one person, or an open link to share with volunteers (a WhatsApp group, a staff room). Reviewers see only the review queue for their subjects: never payments or students.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {EXAM_IDS.map((ex) => (
            <div key={ex} className="rounded-lg border border-rule p-2 text-sm">
              <p className="font-semibold">{EXAMS[ex].short}</p>
              {subjects.filter((s) => s.exam === ex).map((s) => <label key={key(s)} className="mt-1 flex items-center gap-2"><input type="checkbox" checked={pick.includes(key(s))} onChange={() => toggle(key(s))} />{s.name}</label>)}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1"><input type="radio" checked={kind === "open"} onChange={() => setKind("open")} />Open link for volunteers</label>
          <label className="flex items-center gap-1"><input type="radio" checked={kind === "single"} onChange={() => setKind("single")} />One person (14 days)</label>
          {kind === "open" && <>
            <label>for <select className="rounded border px-1" value={days} onChange={(x) => setDays(Number(x.target.value))}>{[7, 14, 30, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
            <label>up to <input type="number" min={1} max={500} className="w-20 rounded border px-1" value={maxUses} onChange={(x) => setMaxUses(Number(x.target.value))} /> reviewers</label>
          </>}
        </div>
        <div className="mt-3 flex gap-2"><input className="flex-1 rounded-lg border border-rule px-2 py-1.5 text-sm" value={note} onChange={(x) => setNote(x.target.value)} placeholder="Who it's for (only staff see this)" /><button onClick={invite} disabled={!pick.length} className="rounded-lg bg-ink px-3 py-1.5 text-sm text-paper disabled:opacity-40">Make the link</button></div>
        {link && <><p className="mt-2 break-all rounded bg-black/5 p-2 font-mono text-xs">{link}</p><div className="mt-1 flex gap-3 text-xs"><button className="underline" onClick={() => navigator.clipboard.writeText(link)}>Copy</button><a className="underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Help Nigerian students prepare for JAMB, WAEC and NECO: review practice questions on Naija Exam Prep. ${link}`)}`}>Share on WhatsApp</a><span className="text-slate">Copy it now: it isn&apos;t shown again.</span></div></>}
      </div>
      <Err e={e} />
      <h3 className="mt-6 font-semibold">Links</h3>
      {data?.invites.length === 0 && <p className="text-sm text-slate">None yet.</p>}
      {data?.invites.map((i) => {
        const live = i.active && i.expiresAt > new Date().toISOString() && i.uses < i.maxUses;
        return <div key={i.id} className="mt-2 flex flex-wrap items-center gap-2 text-sm"><b>{i.kind === "open" ? "Open link" : "One person"}</b><span>{i.subjects.map(label).join(", ")}</span><span className="text-slate">{i.uses}/{i.maxUses} joined · until {i.expiresAt.slice(0, 10)} · {i.note || "no note"}</span>{live ? <button onClick={async () => { await api("", { action: "close_invite", id: i.id }); load(); }} className="rounded border border-rule px-2 py-0.5 text-xs">Close</button> : <span className="text-xs text-slate">{i.active ? "ended" : "closed"}</span>}</div>;
      })}
      <h3 className="mt-6 font-semibold">Reviewers</h3>
      <p className="text-xs text-slate">Reviews are counted per reviewer and per month, ready for paying reviewers into their NotesApp wallet later.</p>
      {data?.reviewers.length === 0 && <p className="text-sm text-slate">None yet.</p>}
      {data?.reviewers.map((r) => (
        <div key={r.uid} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <b>{r.name}</b><span>{r.subjects.length ? r.subjects.map(label).join(", ") : <i>no subjects</i>}</span>
          <span className="text-slate">{r.reviews} reviews · {r.reviewsByMonth?.[month] ?? 0} this month{r.lastReviewAt ? ` · last ${r.lastReviewAt.slice(0, 10)}` : ""}</span>
          <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={r.active} onChange={async (x) => { await api("", { action: "reviewer_active", uid: r.uid, active: x.target.checked }); load(); }} />Active</label>
        </div>
      ))}
    </div>
  );
}

function Reports({ api }: { api: Api }) {
  const [list, setList] = useState<{ id: string; questionId: string; reason: string; note: string; at: string }[] | null>(null);
  const [e, setE] = useState("");
  const load = useCallback(() => api<{ reports: NonNullable<typeof list> }>("?view=reports").then((r) => setList(r.reports)).catch((x) => setE(x.message)), [api]);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <p className="text-sm text-slate">Problems students reported. Fix the question from Questions (editing sends it back for review), then mark the report done.</p>
      <Err e={e} />
      {list?.length === 0 && <p className="mt-3 text-sm">No open reports.</p>}
      {list?.map((r) => <div key={r.id} className="card mt-2 flex flex-wrap items-center gap-2 p-3 text-sm"><b>{r.reason.replace("-", " ")}</b><span className="font-mono text-xs">{r.questionId}</span><span className="flex-1 text-slate">{r.note}</span><span className="text-xs text-slate">{r.at.slice(0, 10)}</span><button onClick={async () => { await api("", { action: "resolve_report", id: r.id }); load(); }} className="rounded-lg border border-rule px-2 py-1">Done</button></div>)}
    </div>
  );
}

function Packs({ api }: { api: Api }) {
  const [packs, setPacks] = useState<Record<ExamId, Pack> | null>(null);
  const [e, setE] = useState("");
  const [ok, setOk] = useState("");
  useEffect(() => { api<{ packs: Record<ExamId, Pack> }>("?view=packs").then((r) => setPacks(r.packs)).catch((x) => setE(x.message)); }, [api]);
  async function save(p: Pack) { setE(""); setOk(""); try { const r = await api<{ packs: Record<ExamId, Pack> }>("", { action: "save_pack", exam: p.exam, priceNaira: p.priceKobo / 100, months: p.months, available: p.available }); setPacks(r.packs); setOk(`${EXAMS[p.exam].short} saved.`); } catch (x) { setE((x as Error).message); } }
  const edit = (ex: ExamId, patch: Partial<Pack>) => setPacks((x) => (x ? { ...x, [ex]: { ...x[ex], ...patch } } : x));
  return (
    <div>
      <p className="text-sm text-slate">One pack per exam: every subject. A new price applies to new purchases only.</p>
      <Err e={e} />{ok && <p className="mt-2 text-sm text-[#146b43]">{ok}</p>}
      {packs && EXAM_IDS.map((ex) => (
        <div key={ex} className="card mt-2 flex flex-wrap items-center gap-3 p-3 text-sm">
          <b className="w-14">{EXAMS[ex].short}</b>
          <label>₦ <input type="number" className="w-24 rounded border px-2 py-1" value={packs[ex].priceKobo / 100} onChange={(x) => edit(ex, { priceKobo: Number(x.target.value) * 100 })} /></label>
          <label><input type="number" className="w-16 rounded border px-2 py-1" value={packs[ex].months} onChange={(x) => edit(ex, { months: Number(x.target.value) })} /> months</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={packs[ex].available} onChange={(x) => edit(ex, { available: x.target.checked })} />On sale</label>
          <span className="text-slate">{naira(packs[ex].priceKobo)}</span>
          <button onClick={() => save(packs[ex])} className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-paper">Save</button>
        </div>
      ))}
    </div>
  );
}

type Lookup = { uid: string; username: string; displayName: string; teen: boolean; access: { exam: ExamId; state: { active: boolean; expiresAt: string | null; daysLeft: number }; doc: { sources: { kind: string; ref: string; months: number; at: string; by?: string; refundedAt?: string }[]; firstPaidQuestionAt?: string } | null; refundable: { ref: string; ok: boolean; why: string }[] }[]; payments: { reference: string; status: string; pack: ExamId; via: string; amountKobo: number; createdAt: string; paidAt: string | null }[] };
function AccessTab({ api }: { api: Api }) {
  const [q, setQ] = useState("");
  const [m, setM] = useState<Lookup | null>(null);
  const [e, setE] = useState("");
  const [msg, setMsg] = useState("");
  const [grant, setGrant] = useState<{ exam: ExamId; months: number; note: string }>({ exam: "jamb", months: 12, note: "" });
  const find = async (query = q) => { setE(""); setMsg(""); try { setM(await api<Lookup>(`?view=access&q=${encodeURIComponent(query)}`)); } catch (x) { setE((x as Error).message); setM(null); } };
  const act = async (body: unknown, done: string) => { setE(""); setMsg(""); try { await api("", body); setMsg(done); await find(); } catch (x) { setE((x as Error).message); } };
  return (
    <div>
      <div className="flex gap-2"><input className="flex-1 rounded-lg border border-rule px-2 py-1.5 text-sm" value={q} onChange={(x) => setQ(x.target.value)} onKeyDown={(x) => x.key === "Enter" && find()} placeholder="Email, username or account id" /><button onClick={() => find()} className="rounded-lg bg-ink px-3 py-1.5 text-sm text-paper">Look up</button></div>
      <Err e={e} />{msg && <p className="mt-2 text-sm text-[#146b43]">{msg}</p>}
      {m && (
        <div className="mt-4 space-y-4 text-sm">
          <p><b>{m.displayName || m.username}</b> @{m.username} · <span className="font-mono text-xs">{m.uid}</span>{m.teen ? " · teen mode" : ""}</p>
          {m.access.map((a) => (
            <div key={a.exam} className="card p-3">
              <p><b>{EXAMS[a.exam].short}</b>: {a.state.active ? `open until ${a.state.expiresAt?.slice(0, 10)} (${a.state.daysLeft} days)` : a.doc ? `ended ${a.state.expiresAt?.slice(0, 10)}` : "no pack"}{a.doc?.firstPaidQuestionAt ? ` · first pack question opened ${a.doc.firstPaidQuestionAt.slice(0, 10)}` : ""}</p>
              {a.doc?.sources.map((s) => <p key={s.ref} className="text-xs text-slate">{s.kind} · +{s.months} months · {s.at.slice(0, 10)} · <span className="font-mono">{s.ref}</span>{s.by ? ` · ${s.by}` : ""}{s.refundedAt ? " · refunded" : ""}</p>)}
              {a.refundable.map((r) => <div key={r.ref} className="mt-1 flex items-center gap-2 text-xs"><span className="font-mono">{r.ref}</span>{r.ok ? <button onClick={() => confirm("Refund this payment in full?") && act({ action: "refund", reference: r.ref }, "Refunded. The months it added are taken off.")} className="rounded border border-crimson px-2 py-0.5 text-crimson">Refund</button> : <span className="text-slate">no refund: {r.why}</span>}</div>)}
            </div>
          ))}
          <div className="card p-3">
            <p className="font-semibold">Pack payments</p>
            {m.payments.length === 0 && <p className="text-slate">None.</p>}
            {m.payments.map((p) => <div key={p.reference} className="mt-1 flex flex-wrap items-center gap-2 text-xs"><span className="font-mono">{p.reference}</span><span>{EXAMS[p.pack]?.short}</span><span>{naira(p.amountKobo)}</span><span>{p.via}</span><b>{p.status}</b><span className="text-slate">{p.createdAt.slice(0, 10)}</span>{p.status === "pending" && <button onClick={() => act({ action: "recheck", reference: p.reference }, "Checked with Paystack.")} className="rounded border border-rule px-2 py-0.5">Check with Paystack</button>}</div>)}
          </div>
          <div className="card p-3">
            <p className="font-semibold">Grant a pack</p>
            <p className="text-xs text-slate">For a school, a sponsor, a competition prize, or to put right a payment problem. The reason is kept with it.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <select className="rounded border px-2 py-1" value={grant.exam} onChange={(x) => setGrant({ ...grant, exam: x.target.value as ExamId })}>{EXAM_IDS.map((x) => <option key={x} value={x}>{EXAMS[x].short}</option>)}</select>
              <input type="number" className="w-20 rounded border px-2 py-1" value={grant.months} onChange={(x) => setGrant({ ...grant, months: Number(x.target.value) })} /> months
              <input className="min-w-[200px] flex-1 rounded border px-2 py-1" value={grant.note} onChange={(x) => setGrant({ ...grant, note: x.target.value })} placeholder="Why" />
              <button onClick={() => act({ action: "grant", uid: m.uid, ...grant }, "Granted.")} className="rounded-lg bg-ink px-3 py-1 text-paper">Grant</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Usage({ api }: { api: Api }) {
  const [u, setU] = useState<{ days: Record<string, number | string>[]; inReview: number; published: number; openReports: number; passKey: boolean } | null>(null);
  const [e, setE] = useState("");
  useEffect(() => { api<NonNullable<typeof u>>("?view=metrics").then(setU).catch((x) => setE(x.message)); }, [api]);
  const sum = (k: string) => u?.days.reduce((n, d) => n + Number(d[k] ?? 0), 0) ?? 0;
  const kpi = (n: number | string, l: string) => <div className="card p-4"><p className="font-display text-3xl text-ink">{n}</p><p className="text-xs text-slate">{l}</p></div>;
  return (
    <div>
      <Err e={e} />
      {u && (
        <>
          {!u.passKey && <p className="mb-3 rounded-lg bg-[#C9A227]/20 p-3 text-sm">EXAM_PREP_PASS_KEY isn't set, so pack questions can't be saved for offline use (free ones can). See docs/ENVIRONMENT.md.</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{kpi(u.published, "published questions")}{kpi(u.inReview, "waiting for review")}{kpi(u.openReports, "open reports")}{kpi(sum("packsSold"), "packs sold (30 days)")}</div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{kpi(sum("answers"), "answers (30 days)")}{kpi(sum("mocks"), "mocks started")}{kpi(sum("packsSaved"), "packs saved offline")}{kpi(sum("payLinks"), "pay links made")}</div>
          <p className="mt-3 text-xs text-slate">Daily counts only: no student is identified in them.</p>
        </>
      )}
    </div>
  );
}

// Schools (lib/prep-schools.ts): approve a school's application, and keep Legal's onboarding data agreement (version and text).
type SchoolRow = { id: string; name: string; state: string; students: number; leadName: string; leadRole: string; leadEmail: string; status: string; signature?: { version: string; name: string; at: string }; createdAt: string };
function Schools({ api }: { api: <T>(q: string, body?: unknown) => Promise<T> }) {
  const [d, setD] = useState<{ schools: SchoolRow[]; agreement: { version: string; text: string } | null } | null>(null);
  const [msg, setMsg] = useState("");
  const [ag, setAg] = useState({ version: "", text: "" });
  const load = useCallback(() => api<{ schools: SchoolRow[]; agreement: { version: string; text: string } | null }>("?view=schools").then((x) => { setD(x); if (x.agreement) setAg(x.agreement); }).catch((e) => setMsg(e.message)), [api]);
  useEffect(() => { void load(); }, [load]);
  const act = async (b: Record<string, unknown>, ok: string) => { setMsg(""); try { await api("", b); setMsg(ok); await load(); } catch (e) { setMsg((e as Error).message); } };
  if (!d) return <p className="text-sm text-slate">Loading…</p>;
  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-slate" role="status">{msg}</p>}
      <div className="space-y-2">
        {d.schools.map((s) => (
          <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div><p className="font-semibold text-ink">{s.name} <span className="font-normal text-slate">· {s.state} · about {s.students} students</span></p><p className="text-xs text-slate">{s.leadName} ({s.leadRole}) · {s.leadEmail} · applied {s.createdAt.slice(0, 10)}{s.signature ? ` · signed ${s.signature.version} by ${s.signature.name} on ${s.signature.at.slice(0, 10)}` : ""}</p></div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-rule px-2 py-0.5 text-xs">{s.status}</span>
              {s.status === "pending" && <><button className="rounded-full bg-ink px-3 py-1 text-xs text-paper" onClick={() => act({ action: "school_decide", id: s.id, decision: "approve" }, "Approved; the lead has been emailed.")}>Approve</button><button className="rounded-full border border-rule px-3 py-1 text-xs" onClick={() => act({ action: "school_decide", id: s.id, decision: "decline" }, "Declined.")}>Decline</button></>}
            </div>
          </div>
        ))}
        {!d.schools.length && <p className="text-sm text-slate">No school has applied yet. Schools apply at prep.notesapp.name.ng/schools.</p>}
      </div>
      <form className="card space-y-2 p-4" onSubmit={(e) => { e.preventDefault(); void act({ action: "school_agreement", ...ag }, "Agreement saved. Approved schools can sign it now."); }}>
        <p className="font-semibold text-ink">Onboarding data agreement</p>
        <p className="text-xs text-slate">Legal&apos;s text. Schools sign the version shown here; a new version means schools sign again. {d.agreement ? `Current: ${d.agreement.version}.` : "Not set yet: approved schools can't sign until it is."}</p>
        <input className="w-full rounded-lg border border-rule px-3 py-2 text-sm" placeholder="Version, for example 2026-11-01" value={ag.version} onChange={(e) => setAg({ ...ag, version: e.target.value })} />
        <textarea className="h-48 w-full rounded-lg border border-rule px-3 py-2 text-sm" placeholder="The full agreement text" value={ag.text} onChange={(e) => setAg({ ...ag, text: e.target.value })} />
        <button className="rounded-full bg-ink px-4 py-2 text-xs text-paper">Save the agreement</button>
      </form>
    </div>
  );
}
