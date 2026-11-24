"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import { subscribeArcadeAccount, type ArcadeAccount } from "@/lib/arcade/store";
import { boardRule, type BoardView } from "@/lib/arcade/boards";
import type { ArcadeGame } from "@/lib/arcade/catalogue";

// The LEADERBOARD under every game (owner, Nov 2026: "each game has leaderboard makeup of top npc 🤖 and top human, then shares same
// notesville rich list"; docs/ARCADE_TOURNAMENTS.md §4): the computer players 🤖 and the people, side by side, from
// GET /api/arcade/boards/[slug] (lib/arcade/boards-server.ts). A signed-in member sees their own place, highlighted; a guest is asked to
// sign in. N$ is the same wallet as Notes Life, so the shared rich list is Notes Life's Billionaires List. Hidden on tournament pages,
// which have their own verified board.
const fmt = (n: number) => n.toLocaleString("en-NG");
const REFRESH_MS = 15_000;

export default function ArcadeBoard({ game }: { game: ArcadeGame }) {
  const path = usePathname() || "";
  const onTournament = path.includes("/tournament");
  const [acct, setAcct] = useState<ArcadeAccount>({ status: "loading" });
  const [view, setView] = useState<BoardView | null>(null);
  const [failed, setFailed] = useState(false);
  const last = useRef(0);
  useEffect(() => subscribeArcadeAccount(setAcct), []);

  const member = acct.status === "member";
  const saving = !!acct.saving;
  useEffect(() => {
    if (onTournament || acct.status === "loading" || saving) return;
    // After a save (a win, a new best), look again, at most every REFRESH_MS.
    const wait = Math.max(0, last.current + REFRESH_MS - Date.now());
    let live = true;
    const t = window.setTimeout(async () => {
      last.current = Date.now();
      try {
        const token = member ? await auth.currentUser?.getIdToken().catch(() => "") : "";
        const r = await fetch(`/api/arcade/boards/${game.slug}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!r.ok) throw new Error();
        const j = (await r.json()) as BoardView;
        if (live) { setView(j); setFailed(false); }
      } catch {
        if (live) setFailed(true);
      }
    }, view ? wait : 0);
    return () => { live = false; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.slug, acct.status, member, saving, onTournament]);

  if (onTournament) return null;
  const wins = view?.metric === "wins";
  const me = view?.me;
  return (
    <section className="arc-board" aria-label={`${game.name} leaderboard`}>
      <div className="arc-board-head">
        <p className="arc-label">LEADERBOARD · {(view?.label ?? boardRule(game.slug)?.label ?? "").toUpperCase()}</p>
        {member && me && (
          <p className="arc-board-me">{me.rank ? <>You: <strong>#{me.rank}</strong> · {fmt(me.value)} {wins ? (me.value === 1 ? "win" : "wins") : "points"}</> : wins ? "Win a game to get on the board" : "Set a score to get on the board"}</p>
        )}
      </div>
      {!view && !failed && <p className="arc-board-empty">Loading the leaderboard…</p>}
      {failed && !view && <p className="arc-board-empty">The leaderboard couldn&apos;t load just now.</p>}
      {view && (
        <div className="arc-board-cols">
          <div className="arc-board-col">
            <p className="arc-board-title">🤖 COMPUTER PLAYERS</p>
            <ol>
              {view.npcs.map((n, i) => (
                <li key={n.id}><span className="arc-board-rank">{i + 1}</span><span className="arc-board-name">{n.name} <span aria-label="computer player">🤖</span></span><b>{fmt(n.value)}</b></li>
              ))}
            </ol>
            <p className="arc-board-note">{view.npcLabel}</p>
          </div>
          <div className="arc-board-col">
            <p className="arc-board-title">PEOPLE</p>
            {view.people.length ? (
              <ol>
                {view.people.map((p) => (
                  <li key={`${p.rank}-${p.username}`} className={p.you ? "is-you" : undefined}>
                    <span className="arc-board-rank">{p.rank}</span>
                    <span className="arc-board-name" title={p.username ? `@${p.username}` : undefined}>{p.name}{p.you ? " (you)" : ""}</span>
                    <b>{fmt(p.value)}{wins && p.losses ? <small> · {fmt(p.losses)}L</small> : null}</b>
                  </li>
                ))}
              </ol>
            ) : <p className="arc-board-empty">Nobody yet. {wins ? "Win a game" : "Set a score"} signed in and the top spot is yours.</p>}
            <p className="arc-board-note">{wins ? `${view.label} (L: losses)` : view.label}</p>
          </div>
        </div>
      )}
      {acct.status === "guest" && <p className="arc-board-guest"><a href={`/login?next=${encodeURIComponent(path || "/arcade")}`}>Sign in to get on the board ↗</a> Guests play free, but only signed-in games count.</p>}
      {member && me?.hidden && <p className="arc-board-note">Teen mode: only you and friends who follow you back see your name here, as on the Billionaires List.</p>}
      <p className="arc-board-links"><a href="/life">Notesville rich list →</a><a href="/arcade/tournaments">Tournament results →</a></p>
      <style jsx global>{`
        .arc-board { margin-top:22px; padding:14px 16px; border:1px solid #e3e6df; border-radius:14px; background:#fff; color:#5c685f; }
        .arc-board-head { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:6px 14px; margin-bottom:10px; }
        .arc-board .arc-label { display:block; margin:0; color:#929b94; font:600 9px ui-monospace,monospace; letter-spacing:.12em; }
        .arc-board-me { margin:0; color:#3f5a2c; font:600 10px ui-monospace,monospace; letter-spacing:.04em; }.arc-board-me strong { color:#17251f; }
        .arc-board-cols { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.25fr); gap:14px; }
        .arc-board-col { min-width:0; }
        .arc-board-title { margin:0 0 6px; color:#77817b; font:700 9px ui-monospace,monospace; letter-spacing:.1em; }
        .arc-board ol { margin:0; padding:0; list-style:none; }
        .arc-board li { display:flex; align-items:center; gap:8px; padding:5px 6px; border-radius:6px; font-size:12px; line-height:1.3; }
        .arc-board li:nth-child(odd) { background:#f8f9f6; }
        .arc-board li.is-you { background:#e9f7d4; box-shadow:inset 0 0 0 1px #c2f17a; color:#17251f; font-weight:600; }
        .arc-board-rank { width:18px; flex:none; color:#9aa39b; font:600 10px ui-monospace,monospace; text-align:right; }
        .arc-board-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#2c3a31; }
        .arc-board li b { flex:none; color:#17251f; font:600 11px ui-monospace,monospace; }.arc-board li small { color:#8a938b; font-weight:500; }
        .arc-board-note { margin:6px 0 0; color:#98a098; font-size:10px; }
        .arc-board-empty { margin:4px 0; color:#8a938b; font-size:12px; }
        .arc-board-guest { margin:10px 0 0; font-size:12px; }.arc-board-guest a { margin-right:6px; color:#5f9a22; font:700 10px ui-monospace,monospace; letter-spacing:.06em; text-decoration:none; }
        .arc-board-links { display:flex; flex-wrap:wrap; gap:6px 18px; margin:12px 0 0; padding-top:10px; border-top:1px solid #eef0ea; }
        .arc-board-links a { color:#3f5a2c; font:700 10px ui-monospace,monospace; letter-spacing:.06em; text-decoration:none; }.arc-board-links a:hover { color:#17251f; text-decoration:underline; }
        @media(max-width:420px) { .arc-board { padding:12px; }.arc-board-cols { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}
