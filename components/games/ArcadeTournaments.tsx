"use client";

import { useEffect, useState } from "react";
import { ArcadeFooter, ArcadeStyles, ArcadeTopbar } from "./ArcadeShell";
import { lagosWhen } from "@/lib/arcade/lagos-time";
import type { PublicTournament } from "@/lib/arcade/tournaments";
import { ARCADE_GAMES } from "@/lib/arcade/catalogue";

// Notes Arcade tournaments, the list (owner, 21 Nov 2026: "start tournaments"; docs/ARCADE_TOURNAMENTS.md §6): playing now, coming up,
// and results. Guests see everything; only signed-in members enter (on each tournament's page).
export default function ArcadeTournaments() {
  const [list, setList] = useState<PublicTournament[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/arcade/tournaments").then((r) => r.json()).then((j) => (j.tournaments ? setList(j.tournaments) : setError(j.error || "Couldn't load tournaments.")))
      .catch(() => setError("Couldn't load tournaments."));
    // One view of the list for the sponsors' reports (owner, 24 Nov 2026); counted once per visitor per day on the server, bots ignored.
    fetch("/api/arcade/tournaments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "view" }), keepalive: true }).catch(() => {});
  }, []);
  const playing = (list ?? []).filter((t) => t.phase === "playing");
  const coming = (list ?? []).filter((t) => t.phase === "upcoming").reverse(); // soonest first
  const ended = (list ?? []).filter((t) => t.phase === "ended");
  return (
    <section className="arc-page" aria-label="Notes Arcade tournaments">
      <ArcadeTopbar />
      <div className="art">
        <p className="arc-kicker"><span>🏆</span> &nbsp; TOURNAMENTS · SAME DEAL FOR EVERYONE</p>
        <h1>Same deal.<br /><em>Best player wins.</em></h1>
        <p className="arc-description art-lead">Every entrant plays the same game from the same deal at the same level, and the server checks every try by replaying it. Free entry for signed-in #NotesApp members; prize tournaments are for adults (18+), and practice tournaments let teens play too. Nana sits out tournaments.</p>
        {error && <p className="art-msg" role="alert">{error}</p>}
        {!list && !error && <p className="arc-status">Loading tournaments…</p>}
        {list && (
          <>
            <Group title="PLAYING NOW" items={playing} empty="Nothing playing right now." />
            <Group title="COMING UP" items={coming} empty="Nothing announced yet. Sponsors: see Partners to put your name on one." />
            <Group title="RESULTS" items={ended} empty="No results yet." />
          </>
        )}
        <div className="art-cta"><a className="arc-btn-ghost" href="/arcade">← ALL GAMES</a><a className="arc-btn-ghost" href="/arcade/partners">SPONSOR A TOURNAMENT ↗</a></div>
      </div>
      <ArcadeFooter />
      <ArcadeStyles />
      <TournamentStyles />
    </section>
  );
}

function Group({ title, items, empty }: { title: string; items: PublicTournament[]; empty: string }) {
  return (
    <>
      <p className="arc-label art-h">{title}</p>
      {items.length === 0 ? <p className="art-empty">{empty}</p> : (
        <ul className="art-cards">
          {items.map((t) => (
            <li key={t.id}>
              <a href={`/arcade/tournaments/${t.id}`}>
                {t.sponsor?.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={t.sponsor.logo} alt={t.sponsor.name} />}
                <span className="art-game">{(ARCADE_GAMES.find((g) => g.slug === t.game)?.name ?? t.game).toUpperCase()} · {t.prize ? "PRIZES · 18+" : t.ageRule === "practice" ? "PRACTICE · TEENS WELCOME" : "18+"}</span>
                <strong>{t.name}</strong>
                {t.sponsor && <span className="art-sponsor">Sponsored by {t.sponsor.name}</span>}
                <span className="art-when">{lagosWhen(t.playFrom)} to {lagosWhen(t.playUntil)} (Lagos time)</span>
                <span className="art-meta">Best of {t.tries} · {t.entrants ?? 0} {t.entrants === 1 ? "entrant" : "entrants"}{t.status === "results" ? " · results checked" : ""}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function TournamentStyles() {
  return (
    <style jsx global>{`
      .art { width:min(1120px,100%); margin:0 auto; padding:clamp(36px,7vh,72px) 0 56px; }
      .art h1 { margin:0; font:500 clamp(46px,6vw,80px)/.95 Georgia,'Times New Roman',serif; letter-spacing:-.06em; }.art h1 em { color:var(--arc-deep); font-weight:500; }
      .art-lead { max-width:620px; }
      .art-h { margin:36px 0 12px; }
      .art-empty { color:#748078; font-size:13px; }
      .art-msg { padding:8px 10px; border-radius:8px; background:#fff0ed; color:#a33a2a; font-size:13px; font-weight:600; }
      .art-msg.is-ok { background:#eef8de; color:#2e5a1c; }
      .art-cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; margin:0; padding:0; list-style:none; }
      .art-cards a { display:flex; flex-direction:column; gap:5px; height:100%; padding:16px; border:1px solid #e3e6df; border-radius:14px; background:#fff; color:inherit; text-decoration:none; transition:transform .15s; }
      .art-cards a:hover { transform:translateY(-2px); border-color:#cfe3b0; }
      .art-cards img { align-self:flex-start; max-width:120px; max-height:48px; object-fit:contain; margin-bottom:4px; }
      .art-cards strong { font:500 21px/1.15 Georgia,serif; letter-spacing:-.02em; color:#17251f; }
      .art-game, .art-meta { color:#77817b; font:600 9px ui-monospace,monospace; letter-spacing:.1em; }
      .art-sponsor { color:#3f5a2c; font-size:12px; font-weight:600; }
      .art-when { color:#657169; font-size:12px; }
      .art-cta { display:flex; flex-wrap:wrap; gap:10px; margin-top:36px; }
      .art-live { margin-left:6px; color:#a0a89f; letter-spacing:.04em; }
      .art-board { margin:0; padding:0; list-style:none; font-size:13px; }
      .art-board li { display:grid; grid-template-columns:34px minmax(0,1fr) auto; gap:10px; align-items:center; padding:8px 4px; border-top:1px solid #e3e6df; }
      .art-board li.is-me { background:#eef8de; }
      .art-board b { font:700 13px ui-monospace,monospace; color:#58645c; }
      .art-board span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.art-board a { color:#17251f; font-weight:600; text-decoration:none; }
      .art-board em { font-style:normal; color:#58645c; font-size:12px; text-align:right; }
      .art-strip { position:sticky; top:0; z-index:30; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 16px; padding:10px clamp(16px,5.6vw,88px); background:#17251f; color:#e8f3d8; font:700 10px ui-monospace,monospace; letter-spacing:.06em; }
      .art-strip-actions { display:flex; gap:8px; }
      .art-below { min-height:0 !important; }.art-below .art { padding-top:0; }
      @media(max-width:820px) { .art-cards { grid-template-columns:1fr; } }
      @media(prefers-reduced-motion:reduce) { .art-cards a { transition:none; } }
    `}</style>
  );
}
