"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/games/ArcadeShell";
import ArcadeNana from "@/components/games/ArcadeNana";
import { arcadeGame } from "@/lib/arcade/catalogue";
import { arcadeStore } from "@/lib/arcade/store";
import {
  SEAT_NAME, SUIT_NAME, applyMove, cardName, computerBid, computerMove, initialState, isLegal, rankLabel, teamOf,
  type Card, type Play, type Seat, type SpadesMove, type SpadesState, type Suit,
} from "@/lib/arcade/spades";
import { isHintCard, spadesTake, spadesTip, type SpadesHint } from "@/lib/arcade/nana-spades";
import type { NanaTake } from "@/lib/arcade/nana";
import { SPADES_TOURNEY_HANDS, encodeSpadesMove, spadesTourneyOver, spadesTourneyStart } from "@/lib/arcade/replay-spades";
import type { TourneyProps } from "@/lib/arcade/tournament-games";

const RECORD_KEY = "notes-arcade-spades-record";
const COMPUTER_DELAY = 600;
const TRICK_PAUSE = 1100; // how long a finished trick stays on the table

// Our own suit drawings (viewBox 0 0 100 100); SVG rather than text so phones don't swap in emoji.
function SuitIcon({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {suit === "H" && <path d="M50 90C22 68 6 50 6 31 6 17 17 7 30 7c9 0 16 5 20 13 4-8 11-13 20-13 13 0 24 10 24 24 0 19-16 37-44 59z" />}
      {suit === "D" && <polygon points="50,4 86,50 50,96 14,50" />}
      {suit === "S" && <path d="M50 5C36 25 8 39 8 60c0 13 10 22 22 22 7 0 13-3 16-9-1 10-5 17-12 22h32c-7-5-11-12-12-22 3 6 9 9 16 9 12 0 22-9 22-22C92 39 64 25 50 5z" />}
      {suit === "C" && (<><circle cx="50" cy="29" r="19" /><circle cx="28" cy="58" r="19" /><circle cx="72" cy="58" r="19" /><circle cx="50" cy="52" r="11" /><path d="M45 55h10l5 40H40z" /></>)}
    </svg>
  );
}

function PlayingCard({ card }: { card: Card }) {
  const red = card.suit === "H" || card.suit === "D";
  return (
    <span className={`sp-face${red ? " is-red" : ""}`} aria-hidden="true">
      <span className="sp-corner"><b>{rankLabel(card.rank)}</b><SuitIcon suit={card.suit} /></span>
      <span className="sp-pip"><SuitIcon suit={card.suit} /></span>
      <span className="sp-corner is-flip"><b>{rankLabel(card.rank)}</b><SuitIcon suit={card.suit} /></span>
    </span>
  );
}

type Record_ = { won: number; lost: number };
const SLOT = ["s", "w", "n", "e"] as const;

// Tournament mode (owner, 21 Nov 2026: "add tournament versions of … Spades …"; lib/arcade/tournament-games.ts TourneyProps): the deals
// come from the tournament's seed through spadesTourneyStart, the same function the server replays from, and the try lasts
// SPADES_TOURNEY_HANDS hands with no target. Every bid and card you play is recorded with encodeSpadesMove (the format replay-spades.ts
// reads), and the recording goes to `onFinish` once, when the last hand is scored. No new game, no Nana, and the practice won/lost record
// is left alone.
export default function SpadesGame({ tourney }: { tourney?: TourneyProps } = {}) {
  const [game, setGame] = useState<SpadesState | null>(() => (tourney ? spadesTourneyStart(tourney.seed, tourney.level) : null));
  const tourneyRef = useRef(tourney);
  tourneyRef.current = tourney;
  const recRef = useRef<string[]>([]);
  const sentRef = useRef(false);
  const [pausing, setPausing] = useState(false);
  const [record, setRecord] = useState<Record_>({ won: 0, lost: 0 });
  const [muted, setMuted] = useState(false);
  // Nana (owner, 21 Nov 2026): the card or bid she suggests, lit in gold until the game moves on, and her take on the last
  // computer move (West, Partner or East).
  const [hint, setHint] = useState<SpadesHint | null>(null);
  const [take, setTake] = useState<NanaTake | null>(null);
  const [round, setRound] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(arcadeStore.getItem(RECORD_KEY) ?? "null") as Record_ | null;
      if (saved && typeof saved.won === "number" && typeof saved.lost === "number") setRecord(saved);
    } catch { /* storage blocked: keep a fresh record */ }
  }, []);

  const beep = useCallback((freq: number, dur = 0.08) => {
    if (mutedRef.current || typeof window === "undefined" || !window.AudioContext) return;
    try {
      if (!audioRef.current) audioRef.current = new window.AudioContext();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator(); const vol = ctx.createGain(); const now = ctx.currentTime;
      osc.type = "sine"; osc.frequency.setValueAtTime(freq, now);
      vol.gain.setValueAtTime(0.0001, now); vol.gain.exponentialRampToValueAtTime(0.04, now + 0.01); vol.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(vol); vol.connect(ctx.destination); osc.start(now); osc.stop(now + dur);
    } catch { /* no audio, no problem */ }
  }, []);

  // A new try (a new run id) deals afresh from its seed with an empty recording.
  const tourneyRun = tourney?.runId;
  const firstRun = useRef(tourneyRun);
  useEffect(() => {
    const t = tourneyRef.current;
    if (!t || tourneyRun === firstRun.current) return; // the first try was dealt by useState above
    firstRun.current = tourneyRun;
    recRef.current = [];
    sentRef.current = false;
    setPausing(false);
    setTake(null);
    setRound((r) => r + 1);
    setGame(spadesTourneyStart(t.seed, t.level));
  }, [tourneyRun]);

  const commit = useCallback((prev: SpadesState, m: SpadesMove) => {
    const next = applyMove(prev, m);
    setGame(next);
    const t = tourneyRef.current;
    // Only your own bids and cards are recorded; the computer seats and NEXT HAND are the replay's to redo.
    if (t && prev.turn === 0 && m.type !== "next") recRef.current.push(encodeSpadesMove(m));
    if (!t && prev.turn !== 0) setTake(spadesTake(prev, m, next));
    if (m.type === "play" && next.trick.length === 0) {
      setPausing(true);
      beep(teamOf(next.lastTrick?.winner ?? 0) === 0 ? 660 : 300, 0.12);
    } else if (m.type === "play") beep(480, 0.05);
    if (t) {
      if (spadesTourneyOver(next) && !sentRef.current) { sentRef.current = true; t.onFinish(recRef.current.join(",")); }
      return; // a tournament try never touches the practice record
    }
    if (next.phase === "over") {
      setRecord((r) => {
        const updated = next.winner === 0 ? { ...r, won: r.won + 1 } : { ...r, lost: r.lost + 1 };
        try { arcadeStore.setItem(RECORD_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
        return updated;
      });
    }
  }, [beep]);

  // Leave a finished trick on the table for a moment so everyone sees who took it.
  useEffect(() => {
    if (!pausing) return;
    const t = window.setTimeout(() => setPausing(false), TRICK_PAUSE);
    return () => window.clearTimeout(t);
  }, [pausing]);

  // Computer seats bid and play with a short delay.
  useEffect(() => {
    if (!game || pausing || game.turn === 0 || (game.phase !== "bid" && game.phase !== "play")) return;
    const t = window.setTimeout(() => commit(game, computerMove(game)), COMPUTER_DELAY);
    return () => window.clearTimeout(t);
  }, [game, pausing, commit]);

  const deal = () => {
    if (tourneyRef.current) return; // one deal per tournament try
    setPausing(false); setGame(initialState()); setTake(null); setRound((r) => r + 1); };
  // A hint belongs to one position: any move puts the gold away.
  useEffect(() => { setHint(null); }, [game]);
  const askNana = () => {
    if (!game) return null;
    const t = spadesTip(game);
    setHint(t?.highlight ?? null);
    return t?.tip ?? null;
  };
  const myTurn = !!game && !pausing && game.turn === 0;
  const play = (card: Card) => { if (game && myTurn && game.phase === "play" && isLegal(game, card)) commit(game, { type: "play", card }); };
  const bid = (n: number) => { if (game && myTurn && game.phase === "bid") commit(game, { type: "bid", bid: n }); };
  const toggleSound = () => { setMuted((m) => { mutedRef.current = !m; return !m; }); };

  const showing: Play[] = game ? (pausing && game.lastTrick ? game.lastTrick.plays : game.trick) : [];
  const winnerSeat = pausing ? game?.lastTrick?.winner : undefined;
  const hand = game?.hands[0] ?? [];
  const n = hand.length;

  const tourneyDone = !!tourney && !!game && spadesTourneyOver(game);
  let status = "Deal to start.";
  if (game) {
    if (pausing && game.lastTrick) status = `${game.lastTrick.winner === 0 ? "You win" : `${SEAT_NAME[game.lastTrick.winner]} wins`} the trick.`;
    else if (tourneyDone) status = `All ${SPADES_TOURNEY_HANDS} hands played.`;
    else if (game.phase === "over") status = game.winner === 0 ? "You and your partner win the game!" : "East and West win this one.";
    else if (game.phase === "handOver") status = "Hand over. Check the scores.";
    else if (game.phase === "bid") status = game.turn === 0 ? "Your bid: how many tricks will you win?" : `${SEAT_NAME[game.turn]} is bidding…`;
    else if (game.turn !== 0) status = `${SEAT_NAME[game.turn]} is thinking…`;
    else if (game.trick.length === 0) status = game.spadesBroken ? "Your lead. Play any card." : "Your lead. Spades aren't broken yet.";
    else {
      const led = game.trick[0].card.suit;
      status = hand.some((c) => c.suit === led) ? `Your turn: follow ${SUIT_NAME[led]}.` : `No ${SUIT_NAME[led]}: play anything, a spade will trump.`;
    }
  }

  const seatInfo = (seat: Seat) => {
    const b = game?.bids[seat];
    return (
      <div className={`sp-seat sp-seat-${SLOT[seat]}${game && game.turn === seat && !pausing && (game.phase === "bid" || game.phase === "play") ? " is-turn" : ""}`}>
        <span className="sp-seat-name">{SEAT_NAME[seat].toUpperCase()}</span>
        <span className="sp-seat-line">BID {b ?? "–"} · WON {game?.tricksWon[seat] ?? 0}</span>
      </div>
    );
  };

  const last = game?.history.at(-1);

  return (
    <ArcadeShell game={arcadeGame("spades")} index={4}>
      <div className="arc-console">
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">US</span><strong>{game?.scores[0] ?? 0}</strong></div>
          <div className="arc-stat"><span className="arc-label">THEM</span><strong>{game?.scores[1] ?? 0}</strong></div>
          {tourney
            ? <>
                <div className="arc-stat"><span className="arc-label">HAND</span><strong>{Math.min(SPADES_TOURNEY_HANDS, (game?.history.length ?? 0) + (tourneyDone ? 0 : 1))} / {SPADES_TOURNEY_HANDS}</strong></div>
                <div className="arc-stat"><span className="arc-label">TOURNAMENT</span><strong className="sp-same">same deal for everyone</strong></div>
              </>
            : <>
                <div className="arc-stat"><span className="arc-label">TO WIN</span><strong>{game?.target ?? 250}</strong></div>
                <div className="arc-stat"><span className="arc-label">WON · LOST</span><strong>{record.won} · {record.lost}</strong></div>
              </>}
          <span className="arc-spacer" />
          <button type="button" className="arc-btn-ghost" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
          {!tourney && <button type="button" className="arc-btn" onClick={deal} aria-label="Start a new game">NEW GAME</button>}
        </div>

        <div className="arc-board-wrap sp-board">
          <div className="sp-table">
            {seatInfo(2)}
            {seatInfo(1)}
            {seatInfo(3)}
            <div className="sp-trick" aria-live="polite" aria-label={showing.length ? `On the table: ${showing.map((p) => `${SEAT_NAME[p.seat]} ${cardName(p.card)}`).join(", ")}` : "No cards on the table"}>
              {showing.map((p) => (
                <span key={`${p.seat}-${p.card.suit}${p.card.rank}`} className={`sp-card sp-slot-${SLOT[p.seat]}${winnerSeat === p.seat ? " is-winner" : ""}`}>
                  <PlayingCard card={p.card} />
                </span>
              ))}
              {game?.phase === "play" && !showing.length && <span className="sp-trick-hint">{game.spadesBroken ? <>SPADES BROKEN</> : <>SPADES NOT BROKEN</>}</span>}
            </div>
            {seatInfo(0)}
          </div>

          <div className="sp-hand" role="group" aria-label="Your hand" style={{ gridTemplateColumns: n > 1 ? `repeat(${n - 1}, minmax(0, 34px)) var(--cw)` : "var(--cw)" }}>
            {hand.map((card, i) => {
              const ok = !!game && myTurn && game.phase === "play" && isLegal(game, card);
              const off = i - (n - 1) / 2;
              return (
                <span key={`${card.suit}${card.rank}`} className="sp-hand-cell">
                  <button
                    type="button"
                    className={`sp-card is-hand${ok ? " is-ok" : ""}${game?.phase === "play" && myTurn && !ok ? " is-dim" : ""}${isHintCard(hint, card) ? " is-nana" : ""}`}
                    style={{ transform: `translateY(${Math.abs(off) * Math.abs(off) * 0.5}px) rotate(${off * 1.8}deg)` }}
                    onClick={() => play(card)}
                    disabled={!ok}
                    aria-label={`Play ${cardName(card)}${ok ? "" : game?.phase === "play" && myTurn ? " (not allowed now)" : ""}`}
                  >
                    <PlayingCard card={card} />
                  </button>
                </span>
              );
            })}
          </div>

          {game?.phase === "bid" && myTurn && (
            <div className="sp-bid" role="dialog" aria-label="Choose your bid">
              <p>HOW MANY TRICKS WILL YOU WIN?</p>
              <div className="sp-bid-grid">
                {Array.from({ length: 14 }, (_, k) => (
                  <button key={k} type="button" className={`sp-bid-btn${hint?.type === "bid" && hint.bid === k ? " is-nana" : ""}`} onClick={() => bid(k)} aria-label={`Bid ${k}`}>{k}</button>
                ))}
              </div>
              <span className="sp-bid-hint">
                {game.bids[2] !== null ? `Partner bid ${game.bids[2]}. ` : ""}A fair guess for your hand: {computerBid(hand)}
              </span>
            </div>
          )}

          {game?.phase === "handOver" && !pausing && last && !tourneyDone && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">HAND {game.history.length}</p>
              <h2>{last.points[0] >= 0 ? "Bid made." : "Bid missed."}</h2>
              <p>Us: bid {last.bids[0]}, took {last.tricks[0]} ({last.points[0] >= 0 ? "+" : ""}{last.points[0]}). Them: bid {last.bids[1]}, took {last.tricks[1]} ({last.points[1] >= 0 ? "+" : ""}{last.points[1]}).</p>
              <button type="button" className="arc-btn" onClick={() => commit(game, { type: "next" })} aria-label="Deal the next hand">NEXT HAND</button>
            </div>
          )}
          {tourney && tourneyDone && game && !pausing && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">TOURNAMENT · ALL {SPADES_TOURNEY_HANDS} HANDS PLAYED</p>
              <h2>Your team {game.scores[0]}, them {game.scores[1]}.</h2>
              <p className="sp-sent" role="status">{tourney.finishedText ?? "Checking your game…"}</p>
            </div>
          )}
          {(!game || (game.phase === "over" && !pausing)) && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">{!game ? "READY WHEN YOU ARE" : game.winner === 0 ? "WELL PLAYED" : "SO CLOSE"}</p>
              <h2>{!game ? "Let's play." : game.winner === 0 ? "Your team wins." : "East and West win."}</h2>
              <p>{!game ? "You and your partner against East and West. First to 250." : `Final score ${game.scores[0]} to ${game.scores[1]}.`}</p>
              <button type="button" className="arc-btn" onClick={deal} aria-label={game ? "Play again" : "Deal the cards"}>{game ? "PLAY AGAIN" : "DEAL"}</button>
            </div>
          )}
        </div>
        <p className="arc-status" role="status">{status}</p>
        {tourney
          ? <ArcadeNana slug="spades" context={{ mode: "tournament" }} canAsk={false} onAsk={() => null} />
          : <ArcadeNana
              slug="spades"
              canAsk={myTurn && (game?.phase === "bid" || game?.phase === "play")}
              onAsk={askNana}
              take={take}
              resetKey={round}
              onToggle={() => setHint(null)}
            />}

        {game && game.history.length > 0 && (
          <table className="sp-scores">
            <caption className="arc-label">SCORES</caption>
            <thead><tr><th scope="col">HAND</th><th scope="col">US BID/WON</th><th scope="col">PTS</th><th scope="col">THEM BID/WON</th><th scope="col">PTS</th></tr></thead>
            <tbody>
              {game.history.map((h, i) => (
                <tr key={i}><td>{i + 1}</td><td>{h.bids[0]}/{h.tricks[0]}</td><td className={h.points[0] < 0 ? "is-neg" : ""}>{h.points[0]}</td><td>{h.bids[1]}/{h.tricks[1]}</td><td className={h.points[1] < 0 ? "is-neg" : ""}>{h.points[1]}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row">TOTAL</th><td /><td>{game.scores[0]}</td><td /><td>{game.scores[1]}</td></tr></tfoot>
          </table>
        )}
      </div>

      <style jsx global>{`
        .sp-board { --cw:clamp(46px,14vw,62px); display:flex; flex-direction:column; gap:10px; min-height:470px; padding:12px 10px 18px; background:radial-gradient(circle at 50% 40%,#24382e,#1b2a23 70%); }
        .sp-table { flex:1; display:grid; grid-template-columns:minmax(58px,1fr) minmax(0,2.4fr) minmax(58px,1fr); grid-template-areas:". n ." "w t e" ". s ."; align-items:center; justify-items:center; gap:6px; }
        .sp-seat { display:flex; flex-direction:column; align-items:center; gap:3px; padding:6px 8px; border:1px solid #ffffff1c; border-radius:8px; background:#ffffff0a; text-align:center; transition:box-shadow .2s,border-color .2s; }
        .sp-seat.is-turn { border-color:#bdf36b; box-shadow:0 0 0 3px #bdf36b33; }
        .sp-seat-n { grid-area:n; }.sp-seat-w { grid-area:w; }.sp-seat-e { grid-area:e; }.sp-seat-s { grid-area:s; }
        .sp-seat-name { color:#e9efe6; font:700 9px ui-monospace,monospace; letter-spacing:.12em; }
        .sp-seat-n .sp-seat-name,.sp-seat-s .sp-seat-name { color:#bdf36b; }
        .sp-seat-line { color:#a9b6ac; font:600 8px ui-monospace,monospace; letter-spacing:.06em; white-space:nowrap; }
        .sp-trick { grid-area:t; position:relative; width:100%; max-width:230px; aspect-ratio:1/1; }
        .sp-trick-hint { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#ffffff40; font:600 8px ui-monospace,monospace; letter-spacing:.12em; text-align:center; }
        .sp-card { position:relative; display:block; width:var(--cw); aspect-ratio:5/7; padding:0; border:0; border-radius:calc(var(--cw)*.1); background:none; box-shadow:0 3px 10px #0006; font-size:calc(var(--cw)*.24); }
        .sp-trick .sp-card { position:absolute; animation:sp-in .2s ease-out; }
        .sp-slot-n { top:0; left:50%; margin-left:calc(var(--cw)/-2); }
        .sp-slot-s { bottom:0; left:50%; margin-left:calc(var(--cw)/-2); }
        .sp-slot-w { left:0; top:50%; margin-top:calc(var(--cw)*-.7); }
        .sp-slot-e { right:0; top:50%; margin-top:calc(var(--cw)*-.7); }
        .sp-card.is-winner { box-shadow:0 0 0 3px #bdf36b,0 4px 14px #0007; z-index:2; }
        @keyframes sp-in { from { opacity:.3; transform:scale(.9); } to { opacity:1; transform:none; } }
        .sp-face { position:absolute; inset:0; display:block; border-radius:inherit; background:#fffdf8; border:1px solid #e6e2d6; color:#17251f; fill:#17251f; overflow:hidden; }
        .sp-face.is-red { color:#c8323f; fill:#c8323f; }
        .sp-corner { position:absolute; top:4%; left:7%; display:flex; flex-direction:column; align-items:center; line-height:1; }
        .sp-corner b { font:700 1em Georgia,serif; letter-spacing:-.04em; }.sp-corner svg { width:.7em; height:.7em; margin-top:.1em; }
        .sp-corner.is-flip { top:auto; left:auto; bottom:4%; right:7%; transform:rotate(180deg); }
        .sp-pip { position:absolute; inset:30% 24%; display:flex; align-items:center; justify-content:center; }.sp-pip svg { width:100%; height:100%; }
        .sp-hand { display:grid; justify-content:center; padding:10px 6px 0; min-height:calc(var(--cw)*1.4 + 14px); }
        .sp-hand-cell { min-width:0; }
        .sp-card.is-hand { cursor:default; transition:transform .15s,opacity .15s,filter .15s; touch-action:manipulation; }
        .sp-card.is-hand.is-ok { cursor:pointer; }
        .sp-card.is-hand.is-ok:hover,.sp-card.is-hand.is-ok:focus-visible { translate:0 -10px; }
        .sp-card.is-hand.is-dim { filter:brightness(.6) saturate(.35); }
        .sp-card.is-hand:focus-visible,.sp-bid-btn:focus-visible { outline:2px solid #bdf36b; outline-offset:3px; }
        .sp-bid { position:absolute; left:50%; top:12px; z-index:4; transform:translateX(-50%); width:min(330px,94%); padding:14px; border-radius:12px; background:#f7f7f2; box-shadow:0 18px 40px #0008; text-align:center; }
        .sp-bid p { margin:0 0 10px; color:#17251f; font:700 9px ui-monospace,monospace; letter-spacing:.12em; }
        .sp-bid-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; }
        .sp-bid-btn { min-height:34px; border:1px solid #e3e6df; border-radius:7px; background:#fff; color:#17251f; font:600 13px ui-monospace,monospace; cursor:pointer; touch-action:manipulation; }.sp-bid-btn:hover { background:#d9f4b2; }
        .sp-bid-hint { display:block; margin-top:9px; color:#6d7870; font-size:11px; }
        .sp-scores { width:100%; margin-top:12px; border-collapse:collapse; font:500 11px ui-monospace,monospace; color:#3d4a42; }
        .sp-scores caption { text-align:left; padding:0 4px 6px; }
        .sp-scores th { color:#929b94; font:600 8px ui-monospace,monospace; letter-spacing:.1em; text-align:left; padding:5px 4px; border-bottom:1px solid #e4e7df; }
        .sp-scores td { padding:5px 4px; border-bottom:1px solid #f0f2ec; }.sp-scores td.is-neg { color:#c8323f; }
        .sp-scores tfoot td,.sp-scores tfoot th { border-bottom:0; font-weight:700; color:#17251f; }
        /* Nana's suggestion: a gold ring and a lift (translate, so the fan's own rotate stays put). */
        .sp-card.is-hand.is-nana { box-shadow:0 0 0 3px #ffd166,0 6px 16px #0007; translate:0 -14px; z-index:2; }
        .sp-same { font-size:12px !important; letter-spacing:.02em; }
        .sp-sent { font-weight:600; }
        .sp-bid-btn.is-nana { box-shadow:0 0 0 3px #ffd166; background:#fff6dc; }
        @media(max-width:420px) { .sp-board { min-height:430px; padding:10px 6px 16px; }.sp-table { grid-template-columns:minmax(54px,1fr) minmax(0,2.6fr) minmax(54px,1fr); }.sp-seat { padding:5px 4px; }.sp-seat-line { font-size:7px; } }
        @media(prefers-reduced-motion:reduce) { .sp-trick .sp-card { animation:none; }.sp-card.is-hand,.sp-seat { transition:none; }.sp-card.is-hand.is-nana { translate:none; } }
      `}</style>
    </ArcadeShell>
  );
}
