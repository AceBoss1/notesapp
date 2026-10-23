"use client";
import { useEffect, useState } from "react";
import { EXAMS, type ExamId } from "@/lib/exam-prep";
import { prepApi, useMe } from "@/lib/exam-prep-client";
import { auth } from "@/lib/firebase";
import { Back, btnLine, card, input, Note, Spinner } from "@/components/exam-prep/ui";
import { MAX_SEATS, SCHOOL_PACK_MONTHS } from "@/lib/prep-schools";

type View = { cls: { id: string; name: string; exam: ExamId; code: string; seats?: number; members?: number }; school: { name: string }; students: { uid: string; name: string; answered: number; right: number; weakest: string }[]; board: { rank: number; nickname: string; answered: number }[] };

// A teacher's class (schools, lib/prep-schools.ts): each student by first name and initial, this week's practice, and the board.
export default function ClassPage({ params }: { params: { id: string } }) {
  const me = useMe();
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [seats, setSeats] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const load = () => prepApi<View>(`schools?class=${encodeURIComponent(params.id)}`).then((x) => { setV(x); setSeats(String(x.cls.seats ?? "")); }).catch((e) => setError(e.message));
  useEffect(() => { if (me) void load(); }, [me, params.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (body: Record<string, unknown>, ok: string) => { setMsg(null); try { await prepApi("schools", { body: { classId: params.id, ...body } }); setMsg({ tone: "ok", text: ok }); await load(); } catch (e) { setMsg({ tone: "error", text: (e as Error).message }); } };
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
        <div><h1 className="font-display text-2xl font-bold">{v.cls.name} · this week</h1><p className="text-sm text-[#0F2747]/70">{EXAMS[v.cls.exam].short} · code <span className="font-mono font-bold">{v.cls.code}</span> · {v.students.length} of {v.cls.seats ?? "?"} students</p></div>
        <button className={btnLine} onClick={csv}>Export CSV</button>
      </div>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      <form className={`${card} flex flex-col gap-2 sm:flex-row sm:items-end`} onSubmit={(e) => { e.preventDefault(); void act({ action: "seats", seats: Number(seats) }, "Class size saved."); }}>
        <label className="flex-1 text-sm"><span className="font-semibold">School pack places</span><span className="block text-xs text-[#0F2747]/65">Each student who joins gets the full {EXAMS[v.cls.exam].short} pack for {SCHOOL_PACK_MONTHS} months, free during the pilot. Removing a student frees their place.</span>
          <input className={`${input} mt-1`} type="number" min={Math.max(1, v.students.length)} max={MAX_SEATS} inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} aria-label="Class size" /></label>
        <button className={btnLine}>Save size</button>
      </form>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[480px] text-sm">
          <thead><tr className="text-left text-xs text-[#0F2747]/60"><th className="py-1">Student</th><th>Questions</th><th>Score</th><th>Weakest topic</th><th /></tr></thead>
          <tbody>{v.students.map((s) => <tr key={s.uid} className="border-t border-[#0F2747]/10"><td className="py-2">{s.name}</td><td>{s.answered}</td><td>{s.answered ? `${Math.round((s.right / s.answered) * 100)}%` : "–"}</td><td>{s.weakest || "–"}</td><td className="text-right"><button className="text-xs text-[#B3261E] underline" onClick={() => { if (confirm(`Remove ${s.name} from ${v.cls.name}? Their school pack ends and the place is freed.`)) void act({ action: "remove", uid: s.uid }, `${s.name} removed.`); }}>Remove</button></td></tr>)}</tbody>
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
