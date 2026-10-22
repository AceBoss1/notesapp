"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EXAMS, recordAnswer, type ExamId, type OptionKey, type StudentQuestion } from "@/lib/exam-prep";
import { loadCatalogue, prepApi, useMe, useOnline } from "@/lib/exam-prep-client";
import { keepProgress, localProgress, savedPack, usableQuestions } from "@/lib/exam-prep-local";
import { syncProgress } from "@/lib/exam-prep-sync";
import { Explanation, QuestionBody, ReportButton } from "./QuestionView";
import { Back, btnGo, btnGold, btnLine, card, Note, PLink, Spinner } from "./ui";

// Practice: one question at a time, marked straight away with the explanation. Online it asks the server for the questions this
// student may see; offline (or if that fails) it uses the pack saved on the phone. Questions not yet got right come first.
export default function Practice({ exam }: { exam: ExamId }) {
  const sp = useSearchParams();
  const subject = sp.get("subject") || "";
  const topic = sp.get("topic") || "";
  const me = useMe();
  const online = useOnline();
  const [qs, setQs] = useState<StudentQuestion[] | null>(null);
  const [locked, setLocked] = useState(0);
  const [offline, setOffline] = useState(false);
  const [err, setErr] = useState("");
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<OptionKey | null>(null);
  const [score, setScore] = useState({ right: 0, done: 0 });
  const [names, setNames] = useState<{ subject?: string; topic?: string }>({});
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (me === undefined) return;
    let gone = false;
    (async () => {
      const prog = await syncProgress().catch(() => localProgress());
      const order = (list: StudentQuestion[]) => [...list].sort((a, b) => Number(!!prog.byQuestion[a.id]?.ok) - Number(!!prog.byQuestion[b.id]?.ok));
      const filter = (list: StudentQuestion[]) => list.filter((q) => (!subject || q.subject === subject) && (!topic || q.topic === topic));
      try {
        if (!navigator.onLine) throw new Error("offline");
        const r = await prepApi<{ questions: StudentQuestion[]; lockedCount: number }>(`questions?exam=${exam}${subject ? `&subject=${subject}` : ""}${topic ? `&topic=${topic}` : ""}`);
        if (!gone) { setQs(order(r.questions)); setLocked(r.lockedCount); setOffline(false); }
        loadCatalogue().then((c) => { const s = c.subjects.find((x) => x.exam === exam && x.id === subject); if (!gone) setNames({ subject: s?.name, topic: s?.topics.find((t) => t.id === topic)?.name }); }).catch(() => undefined);
      } catch (e) {
        const p = await savedPack(exam);
        if (p) { const u = await usableQuestions(p, me?.uid); if (!gone) { setQs(order(filter(u.questions))); setLocked(filter(p.questions).length - filter(u.questions).length); setOffline(true); } }
        else if (!gone) { setErr((e as Error).message === "offline" ? "You're offline and this pack isn't saved on this phone. Save it next time you have data." : (e as Error).message); setQs([]); }
      }
    })();
    return () => { gone = true; };
  }, [exam, subject, topic, me]);

  const q = qs?.[i];
  async function choose(k: OptionKey) {
    if (!q || chosen) return;
    setChosen(k);
    setScore((s) => ({ right: s.right + (k === q.answer ? 1 : 0), done: s.done + 1 }));
    const p = recordAnswer(await localProgress(), q, k, new Date().toISOString());
    await keepProgress(p);
    if (navigator.onLine) prepApi("attempt", { body: { questionId: q.id } }).catch(() => undefined);
  }
  function next() {
    setChosen(null);
    setI((n) => n + 1);
    if (me && score.done % 10 === 9) syncProgress().catch(() => undefined);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const title = useMemo(() => [EXAMS[exam].short, names.subject, names.topic].filter(Boolean).join(" · "), [exam, names]);

  return (
    <div ref={top} className="mx-auto max-w-2xl">
      <Back href={`/${exam}`}>{EXAMS[exam].short}</Back>
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold">{title || "Practice"}</h1>
        {qs && qs.length > 0 && <span className="text-sm font-semibold text-[#0F2747]/70">{score.right}/{score.done} right</span>}
      </div>
      {offline && <div className="mt-3"><Note>Using the pack saved on this phone.</Note></div>}
      {err && <div className="mt-3"><Note tone="error">{err}</Note></div>}
      {!qs && <Spinner />}
      {qs && q && (
        <div className={`${card} mt-4`}>
          <div className="mb-3 flex items-center justify-between text-xs font-semibold text-[#0F2747]/60">
            <span>Question {i + 1} of {qs.length}</span>
            <span>{q.access === "pack" ? "Pack" : "Free"}</span>
          </div>
          <QuestionBody q={q} chosen={chosen} reveal={!!chosen} onChoose={choose} disabled={!!chosen} />
          {chosen && <Explanation q={q} chosen={chosen} />}
          <div className="mt-4 flex items-center justify-between gap-2">
            <ReportButton id={q.id} />
            {chosen && <button onClick={next} className={btnGo}>{i + 1 < qs.length ? "Next question" : "Finish"}</button>}
          </div>
        </div>
      )}
      {qs && !q && !err && (
        <div className={`${card} mt-4 text-center`}>
          <p className="text-lg font-bold">{qs.length ? `Done: ${score.right} of ${score.done} right` : "No questions here yet"}</p>
          <p className="mt-1 text-sm text-[#0F2747]/70">{qs.length ? "Go over the ones you missed, or try a timed mock." : "Try another topic."}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {qs.length > 0 && <button onClick={() => { setI(0); setScore({ right: 0, done: 0 }); }} className={btnLine}>Go again</button>}
            <PLink href={`/${exam}/mock${subject ? `?subject=${subject}` : ""}`} className={btnGo}>Timed mock</PLink>
          </div>
        </div>
      )}
      {qs && locked > 0 && (!q || i === qs.length - 1) && (
        <div className={`${card} mt-4 border-[#C9A227]/50`}>
          <p className="font-bold">{locked} more question{locked === 1 ? "" : "s"} here in the {EXAMS[exam].short} pack</p>
          <p className="mt-1 text-sm text-[#0F2747]/70">{offline && me ? "Your saved pass has ended or isn't on this phone. Go online and save the pack again." : "Every question in every subject, with explanations, for 12 months."}</p>
          {!offline && <PLink href={`/${exam}/pack`} className={`${btnGold} mt-3`}>See the pack</PLink>}
        </div>
      )}
      {!online && !offline && qs === null && <Note>Waiting for a connection…</Note>}
    </div>
  );
}
