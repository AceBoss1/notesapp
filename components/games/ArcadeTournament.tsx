"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ArcadeFooter, ArcadeStyles, ArcadeTopbar } from "./ArcadeShell";
import { TournamentStyles } from "./ArcadeTournaments";
import { lagosWhen } from "@/lib/arcade/lagos-time";
import type { Best, PublicTournament } from "@/lib/arcade/tournaments";
import type { BoardRow } from "@/lib/arcade/tournaments-server";
import type { TourneyProps } from "@/lib/arcade/tournament-games";

// One Notes Arcade tournament (owner, 21 Nov 2026: "start tournaments"; docs/ARCADE_TOURNAMENTS.md §6): the sponsor, the prizes, the rules,
// the live leaderboard, and Play. A try starts on the server (POST …/start gives the seed, level and a one-time run id), the game plays in
// tournament mode with `tourney` (lib/arcade/tournament-games.ts TourneyProps), and the recording goes back to POST …/finish, where the
// server replays it and keeps the result IT works out. Guests see everything but Play.

// Each game component takes `tourney?: TourneyProps` and plays the try from the server's seed (lib/arcade/replay-<slug>.ts reads its recording).
// The cast only evens out components whose props are optional as a whole (`= {}`).
type TourneyGame = ComponentType<{ tourney?: TourneyProps }>;
const GAMES: Record<string, TourneyGame> = {
  whot: dynamic(() => import("@/components/games/WhotGame"), { ssr: false }) as TourneyGame,
  run: dynamic(() => import("@/components/games/RunGame"), { ssr: false }) as TourneyGame,
  snake: dynamic(() => import("@/components/games/SnakeGame"), { ssr: false }) as TourneyGame,
  chess: dynamic(() => import("@/components/games/ChessGame"), { ssr: false }) as TourneyGame,
  ludo: dynamic(() => import("@/components/games/LudoGame"), { ssr: false }) as TourneyGame,
  ncho: dynamic(() => import("@/components/games/NchoGame"), { ssr: false }) as TourneyGame,
  akahausa: dynamic(() => import("@/components/games/NchoGame").then((m) => function AkaHausa(p: { tourney?: TourneyProps }) { return <m.default variant="akahausa" {...p} />; }), { ssr: false }) as TourneyGame,
  landlord: dynamic(() => import("@/components/games/LandlordGame"), { ssr: false }) as TourneyGame,
  spades: dynamic(() => import("@/components/games/SpadesGame"), { ssr: false }) as TourneyGame,
  draughts: dynamic(() => import("@/components/games/DraughtsGame"), { ssr: false }) as TourneyGame,
  achi: dynamic(() => import("@/components/games/AchiGame"), { ssr: false }) as TourneyGame,
  puffpuff: dynamic(() => import("@/components/games/PuffPuffGame"), { ssr: false }) as TourneyGame,
};

type Data = {
  tournament: PublicTournament;
  game: { slug: string; name: string; rankedBy: string };
  rows: BoardRow[];
  mine: { tries: number; best: Best | null; rank: number | null; openRun: boolean } | null;
};
type Run = { runId: string; seed: number; level: string; try: number; tries: number };
const REFRESH_MS = 15_000;
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

export default function ArcadeTournament({ id }: { id: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const userRef = useRef<User | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [finishedText, setFinishedText] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => { userRef.current = u; setUser(u); }), []);

  const api = useCallback(async (path: string, body?: Record<string, unknown>) => {
    const u = userRef.current;
    const headers: Record<string, string> = { ...(u ? { Authorization: `Bearer ${await u.getIdToken()}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) };
    const r = await fetch(`/api/arcade/tournaments/${encodeURIComponent(id)}${path}`, { method: body ? "POST" : "GET", headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || "Something went wrong."), { status: r.status });
    return j;
  }, [id]);
  const load = useCallback(() => api("").then((j) => { setData(j); setError(""); }).catch((e) => setError(e.message)), [api]);
  useEffect(() => {
    if (user === undefined) return;
    void load();
    const t = setInterval(load, REFRESH_MS); // the live board (§4)
    return () => clearInterval(t);
  }, [user, load]);

  const play = useCallback(async () => {
    setMsg(null); setBusy(true);
    try {
      const j = await api("/start", {});
      setFinishedText(undefined);
      setRun({ runId: String(j.runId), seed: Number(j.seed), level: String(j.level), try: Number(j.try), tries: Number(j.tries) });
      void load();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't start a try." }); }
    setBusy(false);
  }, [api, load]);

  const onFinish = useCallback((recording: string) => {
    if (!run) return;
    setFinishedText("Checking your try…");
    api("/finish", { runId: run.runId, recording })
      .then((j) => {
        const left = Number(j.triesLeft);
        const text = `Checked: ${j.result.summary}. Your best: ${j.best.summary}${j.rank ? `, ${ordinal(j.rank)} on the leaderboard` : ""}. ${left ? `${left} ${left === 1 ? "try" : "tries"} left.` : "That was your last try."}`;
        setFinishedText(text); setMsg({ ok: true, text }); void load();
      })
      .catch((e) => { const text = e instanceof Error ? e.message : "Couldn't send your try in."; setFinishedText(text); setMsg({ ok: false, text }); });
  }, [api, load, run]);

  const t = data?.tournament;
  const Game = t ? GAMES[t.game] : undefined;
  const triesLeft = t && data?.mine ? Math.max(0, t.tries - data.mine.tries) : t?.tries ?? 0;
  const next = `/arcade/tournaments/${id}`;

  const board = data && (
    <>
      <p className="arc-label art-h">LEADERBOARD <small className="art-live">updates every 15 seconds</small></p>
      {data.rows.length === 0 ? <p className="art-empty">No finished tries yet.{t?.phase === "playing" ? " Be the first!" : ""}</p> : (
        <ol className="art-board">
          {data.rows.map((r) => (
            <li key={r.rank} className={data.mine?.rank === r.rank ? "is-me" : ""}>
              <b>{r.rank}</b><span><a href={`/u/${r.username}`}>@{r.username}</a></span><em>{r.summary}</em>
            </li>
          ))}
        </ol>
      )}
      {data.mine?.best && data.mine.rank && data.mine.rank > data.rows.length && <p className="art-empty">You: {ordinal(data.mine.rank)}, {data.mine.best.summary}.</p>}
    </>
  );

  // Playing a try: the game in tournament mode, with the tournament strip above and the board below.
  if (run && t && Game) {
    const tourney: TourneyProps = { runId: run.runId, seed: run.seed, level: run.level, onFinish, ...(finishedText ? { finishedText } : {}) };
    return (
      <>
        <div className="art-strip" role="status">
          <span>🏆 {t.name} · try {run.try} of {run.tries} · same deal for everyone · Nana sits out</span>
          <span className="art-strip-actions">
            {finishedText && triesLeft > 0 && !finishedText.startsWith("Checking") && <button className="arc-btn" onClick={play} disabled={busy}>PLAY AGAIN</button>}
            <button className="arc-btn-ghost" onClick={() => { setRun(null); void load(); }}>← BACK TO THE TOURNAMENT</button>
          </span>
        </div>
        <Game key={run.runId} tourney={tourney} />
        <section className="arc-page art-below"><div className="art">{board}</div><TournamentStyles /></section>
        <ArcadeStyles />
      </>
    );
  }

  return (
    <section className="arc-page" aria-label={t ? `${t.name}, Notes Arcade tournament` : "Notes Arcade tournament"}>
      <ArcadeTopbar />
      <div className="art">
        {error && !data && <p className="art-msg" role="alert">{error}</p>}
        {!data && !error && <p className="arc-status">Loading the tournament…</p>}
        {t && data && (
          <>
            <p className="arc-kicker"><span>🏆</span> &nbsp; {data.game.name.toUpperCase()} TOURNAMENT · {t.phase === "playing" ? "PLAYING NOW" : t.phase === "upcoming" ? "COMING UP" : t.status === "results" ? "RESULTS" : "ENDED"}</p>
            <h1>{t.name}</h1>
            {t.sponsor && (
              <a className="art-sponsor-banner" href={t.sponsor.link} target="_blank" rel="sponsored noopener noreferrer">
                {t.sponsor.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={t.sponsor.logo} alt={t.sponsor.name} />}
                <span><small>SPONSORED BY</small><strong>{t.sponsor.name}</strong>{t.sponsor.words && <span>{t.sponsor.words}</span>}</span>
                <em>VISIT ↗</em>
              </a>
            )}

            <div className="art-play">
              {msg && <p className={`art-msg${msg.ok ? " is-ok" : ""}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
              {t.phase === "playing" && user && Game && (
                triesLeft > 0
                  ? <button className="arc-btn" onClick={play} disabled={busy}>{data.mine?.tries ? `PLAY TRY ${data.mine.tries + 1} OF ${t.tries}` : "ENTER AND PLAY"}</button>
                  : <p className="art-empty">You&apos;ve used all {t.tries} tries. Your best stands.</p>
              )}
              {t.phase === "playing" && user && data.mine?.openRun && triesLeft >= 0 && <p className="art-empty">You left a try unfinished. Starting again gives it up, and it still counts as a try.</p>}
              {t.phase === "playing" && user === null && <p className="art-empty"><a href={`/login?next=${encodeURIComponent(next)}`}>Sign in to enter</a> (or <a href={`/signup?next=${encodeURIComponent(next)}`}>create an account</a>). Entry is free.</p>}
              {t.phase === "upcoming" && <p className="art-empty">Opens {lagosWhen(t.playFrom)} (Lagos time). Practise the game until then.</p>}
              {t.phase === "ended" && <p className="art-empty">This tournament has ended.{t.status === "results" ? " Results are checked." : " Results are being checked."}</p>}
              {user && data.mine && data.mine.tries > 0 && <p className="art-empty">You: {data.mine.tries} of {t.tries} tries used{data.mine.best ? `, best ${data.mine.best.summary}` : ""}{data.mine.rank ? `, ${ordinal(data.mine.rank)}` : ""}.</p>}
            </div>

            <div className="art-cols">
              <div>
                {board}
              </div>
              <div>
                {t.prize && t.prizes.length > 0 && (
                  <>
                    <p className="arc-label art-h">PRIZES</p>
                    <ul className="art-prizes">{t.prizes.map((p) => <li key={p.place + p.prize}><b>{p.place}</b><span>{p.prize}</span></li>)}</ul>
                    <p className="art-small">Prizes come from the sponsor; games never pay out cash. Winners are told in Messages after the top results are checked.</p>
                  </>
                )}
                <p className="arc-label art-h">RULES</p>
                <ul className="art-rules">
                  <li><b>Game:</b> {data.game.name}, at level {t.level}, against the computer.</li>
                  <li><b>Same deal:</b> every entrant plays from the same seed. The server replays every try to check it.</li>
                  <li><b>Tries:</b> {t.tries}; your best counts. Starting a new try gives up an unfinished one (it still counts).</li>
                  <li><b>When:</b> {lagosWhen(t.playFrom)} to {lagosWhen(t.playUntil)} (Lagos time). A try must be finished within 30 minutes.</li>
                  {data.game.rankedBy && <li><b>How it&apos;s ranked:</b> {data.game.rankedBy}. On a tie, whoever got there first.</li>}
                  <li><b>Nana sits out tournaments.</b> No hints, no undo, the level is locked.</li>
                  <li><b>Who:</b> free entry; signed-in members with a confirmed email; {t.prize ? "prize tournaments are 18+." : t.ageRule === "practice" ? "a practice tournament with no prizes, so teens can play too." : "18+."}</li>
                </ul>
              </div>
            </div>
          </>
        )}
        <div className="art-cta"><a className="arc-btn-ghost" href="/arcade/tournaments">← ALL TOURNAMENTS</a></div>
      </div>
      <ArcadeFooter />
      <ArcadeStyles />
      <TournamentStyles />
      <style jsx global>{`
        .art-sponsor-banner { display:flex; align-items:center; gap:16px; margin:22px 0 4px; padding:14px 16px; border:1px solid #cfe3b0; border-radius:14px; background:#fbfdf6; color:inherit; text-decoration:none; max-width:720px; }
        .art-sponsor-banner img { max-width:140px; max-height:64px; object-fit:contain; }
        .art-sponsor-banner > span { display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; color:#657169; font-size:13px; line-height:1.5; }
        .art-sponsor-banner small { color:#77817b; font:600 9px ui-monospace,monospace; letter-spacing:.12em; }
        .art-sponsor-banner strong { color:#17251f; font:500 20px Georgia,serif; }
        .art-sponsor-banner em { color:#5f9a22; font:700 10px ui-monospace,monospace; font-style:normal; letter-spacing:.08em; }
        .art-play { margin:18px 0 0; display:flex; flex-direction:column; align-items:flex-start; gap:8px; }
        .art-empty a, .art-small a { color:#5f9a22; font-weight:700; }
        .art-cols { display:grid; grid-template-columns:1.2fr 1fr; gap:clamp(24px,5vw,64px); align-items:start; }
        .art-prizes, .art-rules { margin:0; padding:0; list-style:none; font-size:13px; line-height:1.6; color:#4f5b53; }
        .art-prizes li { display:flex; gap:12px; padding:8px 0; border-top:1px solid #e3e6df; }.art-prizes b { min-width:48px; font:700 12px ui-monospace,monospace; color:#3f5a2c; }
        .art-rules li { padding:5px 0; border-top:1px solid #e3e6df; }.art-rules b { color:#17251f; }
        .art-small { color:#8a938b; font-size:11px; line-height:1.6; }
        @media(max-width:820px) { .art-cols { grid-template-columns:1fr; } .art-sponsor-banner { flex-direction:column; align-items:flex-start; } }
      `}</style>
    </section>
  );
}
