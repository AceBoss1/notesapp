"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EXAMS, MOCK_SIZES, mark, recordAnswer, type ExamId, type Marked, type MockQuestion, type OptionKey, type StudentQuestion } from "@/lib/exam-prep";
import { loadCatalogue, prepApi, useMe } from "@/lib/exam-prep-client";
import { keepProgress, localProgress, savedPack, usableQuestions } from "@/lib/exam-prep-local";
import { syncProgress } from "@/lib/exam-prep-sync";
import { Explanation, QuestionBody } from "./QuestionView";
import { Back, btnGo, btnLine, btnNavy, card, Note, PLink, Spinner } from "./ui";

// A timed mock. Online the server keeps the clock and marks it (a refresh picks it up again); offline it runs from the saved pack
// on the phone and is marked here, and the result joins the student's progress as an offline mock.
type Running = { id: string; token: string | null; offline: boolean; questions: (MockQuestion & Partial<Pick<StudentQuestion, "answer" | "explanation" | "whyNot">>)[]; deadline: number; skew: number; subject: string };
type Result = { result: Marked; answers: Record<string, string>; questions: StudentQuestion[]; offline: boolean };
const CURRENT = "prep-mock-current";

export default function Mock({ exam }: { exam: ExamId }) {
  const sp = useSearchParams();
  const me = useMe();
  const [subject, setSubject] = useState(sp.get("subject") || "");
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [size, setSize] = useState<number>(20);
  const [run, setRun] = useState<Running | null>(null);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(0);
  const [done, setDone] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [resuming, setResuming] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const submitting = useRef(false);

  useEffect(() => { loadCatalogue().then((c) => setSubjects(c.subjects.filter((s) => s.exam === exam).map((s) => ({ id: s.id, name: s.name })))).catch(() => undefined); }, [exam]);

  // A mock that was running when the page closed: carry on (online) with the server's clock.
  useEffect(() => {
    if (me === undefined) return;
    let cur: { id: string; token: string | null; exam: string } | null = null;
    try { cur = JSON.parse(localStorage.getItem(CURRENT) || "null"); } catch { /* none */ }
    if (!cur || cur.exam !== exam || !navigator.onLine) { setResuming(false); return; }
    prepApi<{ submitted: boolean; questions: MockQuestion[]; answers: Record<string, OptionKey>; deadline: string; serverNow: string; subject: string } & Partial<Result>>(`mock/${cur.id}`, { headers: cur.token ? { "x-mock-token": cur.token } : {} })
      .then((m) => {
        if (m.submitted) { try { localStorage.removeItem(CURRENT); } catch { /* fine */ } return; }
        setAnswers(m.answers || {});
        setRun({ id: cur!.id, token: cur!.token, offline: false, questions: m.questions, deadline: new Date(m.deadline).getTime(), skew: new Date(m.serverNow).getTime() - Date.now(), subject: m.subject });
      })
      .catch(() => { try { localStorage.removeItem(CURRENT); } catch { /* fine */ } })
      .finally(() => setResuming(false));
  }, [me, exam]);

  async function start() {
    setBusy(true); setErr("");
    try {
      if (navigator.onLine) {
        const m = await prepApi<{ id: string; token: string | null; questions: MockQuestion[]; deadline: string; serverNow: string; fewer: boolean }>("mock", { body: { exam, subject: subject || undefined, size } });
        try { localStorage.setItem(CURRENT, JSON.stringify({ id: m.id, token: m.token, exam })); } catch { /* fine */ }
        setAnswers({}); setI(0);
        setRun({ id: m.id, token: m.token, offline: false, questions: m.questions, deadline: new Date(m.deadline).getTime(), skew: new Date(m.serverNow).getTime() - Date.now(), subject });
        if (m.fewer) setErr(`There are ${m.questions.length} questions to use, so this mock has ${m.questions.length}.`);
      } else {
        const p = await savedPack(exam);
        if (!p) throw new Error("You're offline and this pack isn't saved on this phone.");
        const pool = (await usableQuestions(p, me?.uid)).questions.filter((q) => !subject || q.subject === subject);
        if (!pool.length) throw new Error("No saved questions for this mock.");
        for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
        const picked = pool.slice(0, size);
        const minutes = Math.max(5, Math.round(picked.length * EXAMS[exam].mockMinutesPerQuestion));
        setAnswers({}); setI(0);
        setRun({ id: `offline-${Date.now()}`, token: null, offline: true, questions: picked, deadline: Date.now() + minutes * 60_000, skew: 0, subject });
      }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const submit = useCallback(async () => {
    if (!run || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      let res: Result;
      if (run.offline) {
        const qs = run.questions as StudentQuestion[];
        res = { result: mark(qs, answers), answers, questions: qs, offline: true };
      } else {
        const r = await prepApi<{ result: Marked; answers: Record<string, string>; questions: StudentQuestion[] }>(`mock/${run.id}`, { body: { answers }, headers: run.token ? { "x-mock-token": run.token } : {} });
        res = { ...r, offline: false };
        try { localStorage.removeItem(CURRENT); } catch { /* fine */ }
      }
      // Into this phone's progress: each answer, and the mock itself.
      let p = await localProgress();
      const now = new Date().toISOString();
      for (const q of res.questions) { const c = res.answers[q.id] as OptionKey | undefined; if (c) p = recordAnswer(p, q, c, now); }
      p = { ...p, mocks: [{ id: run.id, exam, subject: run.subject, score: res.result.score, total: res.result.total, at: now, offline: run.offline }, ...p.mocks].slice(0, 100) };
      await keepProgress(p);
      syncProgress().catch(() => undefined);
      setDone(res);
      setRun(null);
      window.scrollTo({ top: 0 });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); submitting.current = false; }
  }, [run, answers, exam]);

  // The clock: time left from the server's deadline (corrected for this phone's clock). At zero it submits by itself.
  useEffect(() => {
    if (!run) return;
    const tick = () => { const ms = run.deadline - (Date.now() + run.skew); setLeft(Math.max(0, Math.ceil(ms / 1000))); if (ms <= 0) submit(); };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [run, submit]);

  function choose(k: OptionKey) {
    if (!run) return;
    const q = run.questions[i];
    const next = { ...answers, [q.id]: k };
    setAnswers(next);
    if (!run.offline) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => prepApi(`mock/${run.id}`, { method: "PUT", body: { answers: next }, headers: run.token ? { "x-mock-token": run.token } : {} }).catch(() => undefined), 800);
    }
  }

  // A new question starts at the top, under the clock.
  useEffect(() => { if (run) window.scrollTo({ top: 0 }); }, [i, run]);

  const e = EXAMS[exam];
  if (resuming) return <Spinner />;

  if (done) {
    const pct = done.result.total ? Math.round((done.result.score / done.result.total) * 100) : 0;
    return (
      <div className="mx-auto max-w-2xl">
        <Back href={`/${exam}`}>{e.short}</Back>
        <div className={`${card} text-center`}>
          <p className="text-sm font-semibold text-[#0F2747]/60">{e.short} mock{done.offline ? " · offline" : ""}</p>
          <p className="mt-1 font-display text-4xl font-bold">{done.result.score} / {done.result.total}</p>
          <p className="text-sm text-[#0F2747]/70">{pct}% · {done.result.answered} answered</p>
          <p className="mt-2 text-xs text-[#0F2747]/60">Practice score only: it isn't a prediction of your exam result.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2"><button onClick={() => setDone(null)} className={btnGo}>Another mock</button><PLink href="/progress" className={btnLine}>Your progress</PLink></div>
        </div>
        <h2 className="mt-6 font-display text-lg font-bold">Go through your answers</h2>
        <div className="mt-2 space-y-3">
          {done.questions.map((q, n) => (
            <div key={q.id} className={card}>
              <p className="mb-2 text-xs font-semibold text-[#0F2747]/60">Question {n + 1}</p>
              <QuestionBody q={q} chosen={(done.answers[q.id] as OptionKey) ?? null} reveal onChoose={() => undefined} disabled />
              <Explanation q={q} chosen={(done.answers[q.id] as OptionKey) ?? null} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (run) {
    const q = run.questions[i];
    const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, "0");
    const answered = Object.keys(answers).length;
    return (
      <div className="mx-auto max-w-2xl">
        <div className="sticky top-[57px] z-20 -mx-4 mb-3 flex items-center justify-between gap-2 border-b border-[#0F2747]/10 bg-[#FBF8F2]/95 px-4 py-2 backdrop-blur">
          <span className="text-sm font-semibold">{e.short} mock{run.offline ? " · offline" : ""}</span>
          <span aria-live="polite" className={`rounded-lg px-2.5 py-1 font-mono text-lg font-bold ${left < 60 ? "bg-[#B3261E] text-white" : "bg-[#0F2747] text-white"}`}>{mm}:{ss}</span>
        </div>
        {err && <div className="mb-3"><Note>{err}</Note></div>}
        <div className={card}>
          <p className="mb-3 text-xs font-semibold text-[#0F2747]/60">Question {i + 1} of {run.questions.length} · {answered} answered</p>
          <QuestionBody q={q} chosen={answers[q.id] ?? null} reveal={false} onChoose={choose} />
          <div className="mt-4 flex justify-between gap-2">
            <button onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} className={btnLine}>Back</button>
            {i + 1 < run.questions.length ? <button onClick={() => setI((n) => n + 1)} className={btnNavy}>Next</button> : <button onClick={submit} disabled={busy} className={btnGo}>{busy ? "Marking…" : "Submit"}</button>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Jump to a question">
          {run.questions.map((x, n) => <button key={x.id} onClick={() => setI(n)} className={`h-9 w-9 rounded-lg text-sm font-semibold ${n === i ? "bg-[#0F2747] text-white" : answers[x.id] ? "bg-[#1E8E5A]/15 text-[#146b43]" : "bg-white text-[#0F2747]/70 ring-1 ring-[#0F2747]/15"}`}>{n + 1}</button>)}
        </div>
        <button onClick={() => { if (confirm(`Submit now? ${run.questions.length - answered} not answered.`)) submit(); }} disabled={busy} className={`${btnLine} mt-4 w-full`}>Submit now</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <Back href={`/${exam}`}>{e.short}</Back>
      <h1 className="font-display text-2xl font-bold">{e.short} timed mock</h1>
      <p className="mt-1 text-sm text-[#0F2747]/70">Questions picked at random. The clock runs on our side, so it keeps going if you leave the page. Marked when you submit or when time is up.</p>
      <div className={`${card} mt-4 space-y-4`}>
        <div>
          <p className="text-sm font-semibold">Subject</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[{ id: "", name: "All subjects" }, ...subjects].map((s) => <button key={s.id} onClick={() => setSubject(s.id)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${subject === s.id ? "border-[#0F2747] bg-[#0F2747] text-white" : "border-[#0F2747]/20 bg-white"}`}>{s.name}</button>)}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold">Questions</p>
          <div className="mt-2 flex gap-2">
            {MOCK_SIZES.map((n) => <button key={n} onClick={() => setSize(n)} className={`min-h-[44px] flex-1 rounded-xl border text-sm font-semibold ${size === n ? "border-[#0F2747] bg-[#0F2747] text-white" : "border-[#0F2747]/20 bg-white"}`}>{n} · {Math.max(5, Math.round(n * e.mockMinutesPerQuestion))} min</button>)}
          </div>
        </div>
        {err && <Note tone="error">{err}</Note>}
        <button onClick={start} disabled={busy} className={`${btnGo} w-full`}>{busy ? "Starting…" : "Start the clock"}</button>
      </div>
    </div>
  );
}
