"use client";
import { useEffect, useState } from "react";
import { EXAMS, type ExamId } from "@/lib/exam-prep";
import { prepApi, useMe } from "@/lib/exam-prep-client";
import { auth } from "@/lib/firebase";
import { Back, btnLine, card, Note, Spinner } from "@/components/exam-prep/ui";

type View = { cls: { id: string; name: string; exam: ExamId; code: string }; school: { name: string }; students: { uid: string; name: string; answered: number; right: number; weakest: string }[]; board: { rank: number; nickname: string; answered: number }[] };

// A teacher's class (schools, lib/prep-schools.ts): each student by first name and initial, this week's practice, and the board.
export default function ClassPage({ params }: { params: { id: string } }) {
  const me = useMe();
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (me) prepApi<View>(`schools?class=${encodeURIComponent(params.id)}`).then(setV).catch((e) => setError(e.message)); }, [me, params.id]);
  const csv = async () => {
    const r = await fetch(`/api/exam-prep/schools?class=${encodeURIComponent(params.id)}&csv=1`, { headers: { Authorization: `Bearer ${await auth.currentUser!.getIdToken()}` } });
    const url = URL.createObjectURL(await r.blob()); const a = document.createElement("a"); a.href = url; a.download = `${v?.cls.name ?? "class"}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  if (me === undefined || (!v && !error)) return <Spinner />;
  if (error || !v) return <div className="mx-auto max-w-2xl"><Back href="/schools">Schools</Back><Note tone="error">{error}</Note></div>;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Back href="/schools">{v.school.name}</Back>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-2xl font-bold">{v.cls.name} · this week</h1><p className="text-sm text-[#0F2747]/70">{EXAMS[v.cls.exam].short} · code <span className="font-mono font-bold">{v.cls.code}</span> · {v.students.length} student{v.students.length === 1 ? "" : "s"}</p></div>
        <button className={btnLine} onClick={csv}>Export CSV</button>
      </div>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[480px] text-sm">
          <thead><tr className="text-left text-xs text-[#0F2747]/60"><th className="py-1">Student</th><th>Questions</th><th>Score</th><th>Weakest topic</th></tr></thead>
          <tbody>{v.students.map((s) => <tr key={s.uid} className="border-t border-[#0F2747]/10"><td className="py-2">{s.name}</td><td>{s.answered}</td><td>{s.answered ? `${Math.round((s.right / s.answered) * 100)}%` : "–"}</td><td>{s.weakest || "–"}</td></tr>)}</tbody>
        </table>
        {!v.students.length && <p className="py-4 text-center text-sm text-[#0F2747]/60">No students yet. Give them the code {v.cls.code}.</p>}
      </div>
      <div className={card}>
        <p className="font-semibold">Class board <span className="font-normal text-[#0F2747]/60">(nicknames, for students who joined the board)</span></p>
        <p className="mt-1 text-sm text-[#0F2747]/80">{v.board.length ? v.board.map((b) => `${b.rank} ${b.nickname}`).join(" · ") : "Nobody on the board yet this week."}</p>
      </div>
      <p className="text-xs text-[#0F2747]/60">You see your own class only, by first name and initial. Nothing here is shared outside the school or used for ads.</p>
    </div>
  );
}
