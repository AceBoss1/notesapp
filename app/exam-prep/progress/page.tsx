"use client";
import { useEffect, useState } from "react";
import { EXAMS, suggestNickname, summarise, topicVerdict, type Progress } from "@/lib/exam-prep";
import { loadCatalogue, prepApi, shortDate, useMe, usePrepHref } from "@/lib/exam-prep-client";
import { localProgress } from "@/lib/exam-prep-local";
import { syncProgress } from "@/lib/exam-prep-sync";
import { btnGo, card, input, Note, Pill, Spinner } from "@/components/exam-prep/ui";

// Progress: only what the student actually did (no score predictions), and the weekly effort board, which they join by choice
// with a nickname. Signed out, it's this phone's progress; signed in, the phone and the account merged.
type Board = { week: string; top: { rank: number; nickname: string; count: number; me: boolean }[]; me: { nickname: string; count: number } | null };
export default function ProgressPage() {
  const me = useMe();
  const h = usePrepHref();
  const [p, setP] = useState<Progress | null>(null);
  const [topicNames, setTopicNames] = useState<Record<string, string>>({});
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    if (me === undefined) return;
    (me ? syncProgress() : localProgress()).then(setP).catch(() => localProgress().then(setP));
    loadCatalogue().then((c) => { const m: Record<string, string> = {}; for (const s of c.subjects) for (const t of s.topics) { m[`${s.exam}/${s.id}/${t.id}`] = `${EXAMS[s.exam].short} · ${s.name} · ${t.name}`; m[t.id] ??= t.name; } setTopicNames(m); }).catch(() => undefined);
    if (navigator.onLine) prepApi<Board>("board").then(setBoard).catch(() => undefined);
  }, [me]);
  if (!p) return <Spinner />;
  const s = summarise(p, new Date().toISOString());
  const topics = Object.entries(s.byTopic).sort((a, b) => b[1].total - a[1].total);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold">Your progress</h1>
      {!me && <div className="mt-3"><Note>This is the progress on this phone. <a className="font-semibold underline" href={h(`/signin?next=${encodeURIComponent(h("/progress"))}`)}>Sign in</a> to keep it on your account and see it on any phone.</Note></div>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Questions answered", s.answered], ["Right first time", `${s.firstTimePct}%`], ["Mocks done", s.mocks], ["Days in a row", s.streak]].map(([l, v]) => (
          <div key={String(l)} className={card}><p className="text-2xl font-bold">{v}</p><p className="text-xs font-semibold text-[#0F2747]/60">{l}</p></div>
        ))}
      </div>
      <h2 className="mt-6 font-display text-lg font-bold">By topic</h2>
      {!topics.length ? <p className="mt-2 text-sm text-[#0F2747]/70">Answer a few questions and your topics show here.</p> : (
        <ul className={`${card} mt-2 divide-y divide-[#0F2747]/8 p-0`}>
          {topics.map(([id, t]) => {
            const v = topicVerdict(t);
            return (
              <li key={id} className="flex items-center justify-between gap-2 px-4 py-3">
                <span className="font-medium">{topicNames[id] || id.split("/").pop()!.replace(/-/g, " ")}</span>
                <span className="flex items-center gap-2 text-sm"><span className="text-[#0F2747]/60">{t.right}/{t.total}</span><Pill tone={v === "strong" ? "green" : v === "practise more" ? "gold" : "grey"}>{v}</Pill></span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-[#0F2747]/55">“Strong” means 70% or more right in that topic, after at least 5 answers. It's about your practice here, not a prediction of your exam score.</p>
      {p.mocks.length > 0 && (
        <>
          <h2 className="mt-6 font-display text-lg font-bold">Recent mocks</h2>
          <ul className={`${card} mt-2 divide-y divide-[#0F2747]/8 p-0`}>
            {p.mocks.slice(0, 10).map((m) => <li key={m.id} className="flex justify-between px-4 py-3 text-sm"><span>{EXAMS[m.exam]?.short} {m.offline ? "· offline" : ""} · {shortDate(m.at)}</span><span className="font-semibold">{m.score}/{m.total}</span></li>)}
          </ul>
        </>
      )}
      <BoardCard board={board} signedIn={!!me} onChange={setBoard} />
    </div>
  );
}

function BoardCard({ board, signedIn, onChange }: { board: Board | null; signedIn: boolean; onChange: (b: Board) => void }) {
  const [nick, setNick] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setNick(suggestNickname(Math.floor(Math.random() * 1e6))), []);
  async function join(on: boolean) {
    setBusy(true); setErr("");
    try { await prepApi("board", { body: { join: on, nickname: nick } }); onChange(await prepApi<Board>("board")); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className={`${card} mt-6`}>
      <h2 className="text-lg font-bold">This week's effort board</h2>
      <p className="mt-1 text-sm text-[#0F2747]/70">Counts questions practised this week (each question once a day, up to 300 a day). Nicknames only. It's about effort, not scores. Starts again every Monday.</p>
      {!board ? <p className="mt-3 text-sm text-[#0F2747]/60">The board loads when you're online.</p> : (
        <>
          <ol className="mt-3 space-y-1">
            {board.top.length ? board.top.map((r) => <li key={r.rank} className={`flex justify-between rounded-lg px-3 py-2 text-sm ${r.me ? "bg-[#1E8E5A]/10 font-semibold" : ""}`}><span>{r.rank}. {r.nickname}</span><span>{r.count}</span></li>) : <li className="text-sm text-[#0F2747]/60">No one yet this week. Be first!</li>}
          </ol>
          {signedIn && (board.me ? (
            <div className="mt-3 flex items-center justify-between gap-2 text-sm"><span>You're on as <b>{board.me.nickname}</b> · {board.me.count} this week</span><button onClick={() => join(false)} disabled={busy} className="underline">Leave the board</button></div>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className={input} value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} aria-label="Nickname" /><button onClick={() => join(true)} disabled={busy} className={btnGo}>Join with this nickname</button></div>
          ))}
          {!signedIn && <p className="mt-3 text-sm text-[#0F2747]/60">Sign in to join.</p>}
          {err && <div className="mt-2"><Note tone="error">{err}</Note></div>}
        </>
      )}
    </div>
  );
}
