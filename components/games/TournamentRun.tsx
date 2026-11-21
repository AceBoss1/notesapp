"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import RunGame from "@/components/games/RunGame";
import type { BoardRow } from "@/lib/tournament-server";

type Board = {
  name: string; playFrom: string; playUntil: string; tries: number; playing: boolean; entrants: number; played: number; rows: BoardRow[];
  mine: { rank: number | null; best: number | null; triesUsed: number; signedUp: boolean } | null;
};
const lagosTime = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });
const REFRESH_MS = 15_000;

// The tournament page: Naija Run in tournament mode (components/games/RunGame.tsx) and the live leaderboard under it. Each try starts on the
// server, the run is recorded step by step, and the server replays it to score it (lib/tournament-server.ts).
export default function TournamentRun({ code }: { code: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [board, setBoard] = useState<Board | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const userRef = useRef<User | null>(null);
  useEffect(() => onAuthStateChanged(auth, (u) => { userRef.current = u; setUser(u); }), []);

  const api = useCallback(async (method: "GET" | "POST", body?: Record<string, unknown>, query = "") => {
    const u = userRef.current;
    const headers: Record<string, string> = { ...(u ? { Authorization: `Bearer ${await u.getIdToken()}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) };
    const r = await fetch(`/api/promos${query}`, { method, headers, ...(body ? { body: JSON.stringify({ code, ...body }) } : {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }, [code]);
  const load = useCallback(() => api("GET", undefined, `?code=${encodeURIComponent(code)}&board=1`).then(setBoard).catch(() => {}), [api, code]);
  useEffect(() => { if (user === undefined) return; void load(); const t = setInterval(load, REFRESH_MS); return () => clearInterval(t); }, [user, load]);

  const begin = useCallback(async () => {
    setMsg(null);
    if (!userRef.current) { setMsg({ ok: false, text: "Sign in to play in the tournament (you can still practise on Naija Run)." }); return null; }
    try {
      const j = await api("POST", { action: "run-start" });
      setMsg({ ok: true, text: `Try ${j.try} of ${j.tries}. Go!` });
      return { runId: String(j.runId), seed: Number(j.seed) };
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't start a try." }); return null; }
  }, [api]);
  const end = useCallback((runId: string, recording: string) => {
    setMsg({ ok: true, text: "Checking your run…" });
    api("POST", { action: "run-finish", runId, recording })
      .then((j) => { setMsg({ ok: true, text: `Scored ${j.score} (${j.metres} m). Your best: ${j.best}${j.rank ? `, ${ordinal(j.rank)} on the leaderboard` : ""}. ${j.triesLeft ? `${j.triesLeft} ${j.triesLeft === 1 ? "try" : "tries"} left.` : "That was your last try."}` }); void load(); })
      .catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't send your run in." }));
  }, [api, load]);

  const when = board ? `${lagosTime(board.playFrom)} to ${lagosTime(board.playUntil)}` : "tonight from 10 PM";
  const note = board && !board.playing && Date.now() < Date.parse(board.playFrom)
    ? `Opens at ${lagosTime(board.playFrom)} (Lagos time). Practise on Naija Run until then.`
    : `Same street for everyone. Best of ${board?.tries ?? 3} tries counts. Up jumps, down slides, left and right change lanes.`;

  const extra = (
    <div className="tr-panel">
      {msg && <p className={`tr-msg ${msg.ok ? "is-ok" : "is-err"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      <p className="tr-meta">
        {board?.name ?? "Davido at 34 Arcade Tournament"} · {when} (Lagos time) · free entry, signed-in members 18+ · {board ? `${board.entrants} in, ${board.played} on the board` : ""}
        {board?.mine?.signedUp && <> · you: {board.mine.triesUsed}/{board.tries} tries{board.mine.best !== null ? `, best ${board.mine.best}` : ""}{board.mine.rank ? `, ${ordinal(board.mine.rank)}` : ""}</>}
      </p>
      {user === null && <p className="tr-meta"><Link href="/login?next=/arcade/tournament">Sign in</Link> or <Link href="/signup?next=/arcade/tournament">create an account</Link> to play.</p>}
      <h3 className="tr-h">Leaderboard <small>updates live</small></h3>
      {!board || board.rows.length === 0 ? <p className="tr-meta">No scores yet. {board?.playing ? "Be the first!" : ""}</p> : (
        <ol className="tr-board">
          {board.rows.map((r) => (
            <li key={r.rank} className={board.mine?.rank === r.rank ? "is-me" : ""}>
              <b>{r.rank}</b><span><Link href={`/u/${r.username}`}>{r.name}</Link></span><strong>{r.best}</strong><em>{r.metres} m</em>
            </li>
          ))}
        </ol>
      )}
      <style jsx global>{`
        .tr-panel { margin-top:10px; font:500 13px var(--font-ui, system-ui), sans-serif; color:#17251f; }
        .tr-msg { margin:0 0 8px; padding:8px 10px; border-radius:8px; font-weight:600; }
        .tr-msg.is-ok { background:#eef8de; color:#2e5a1c; } .tr-msg.is-err { background:#fff0ed; color:#a33a2a; }
        .tr-meta { margin:4px 0; color:#58645c; font-size:12px; } .tr-meta a { color:#2e5a1c; font-weight:700; text-decoration:underline; }
        .tr-h { margin:14px 0 6px; font:700 12px ui-monospace,monospace; letter-spacing:.12em; text-transform:uppercase; }
        .tr-h small { margin-left:6px; color:#929b94; letter-spacing:.04em; text-transform:none; font-weight:600; }
        .tr-board { margin:0; padding:0; list-style:none; }
        .tr-board li { display:grid; grid-template-columns:34px 1fr auto 64px; gap:8px; align-items:center; padding:6px 4px; border-top:1px solid #e3e6df; }
        .tr-board li.is-me { background:#eef8de; }
        .tr-board b { font:700 13px ui-monospace,monospace; color:#58645c; } .tr-board span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .tr-board span a { color:#17251f; } .tr-board strong { font:800 14px ui-monospace,monospace; } .tr-board em { font-style:normal; color:#929b94; text-align:right; font-size:12px; }
      `}</style>
    </div>
  );

  return <RunGame tournament={{ level: "normal", begin, end, title: board?.name ?? "Davido at 34 Arcade Tournament", note }} extra={extra} />;
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
