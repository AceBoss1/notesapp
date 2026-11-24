"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import ArcadeNana from "@/components/games/ArcadeNana";
import ArcadeShell from "@/components/games/ArcadeShell";
import { arcadeGame } from "@/lib/arcade/catalogue";
import { arcadeStore } from "@/lib/arcade/store";
import { recordLoss } from "@/lib/arcade/record-loss";
import {
  BISHOP, KING, KNIGHT, QUEEN, ROOK, VALUE, applyMove, chooseMove, gameStatus, initialState, legalMoves, moveToSan,
  pieceColor, pieceType, squareName, type ChessState, type Color, type Level, type Move,
} from "@/lib/arcade/chess";
import type { NanaTake } from "@/lib/arcade/nana";
import { chessTake, chessTip } from "@/lib/arcade/nana-chess";
import { CHESS_LEVELS, encodeChess, tourneyReply } from "@/lib/arcade/replay-chess";
import type { TourneyProps } from "@/lib/arcade/tournament-games";

// U+FE0E keeps phones from drawing the pawn as an emoji. White pieces are the outline glyph over a white-filled solid one.
const TEXT = "\uFE0E";
const SOLID = ["", "\u265F", "\u265E", "\u265D", "\u265C", "\u265B", "\u265A"].map((g) => (g ? g + TEXT : ""));
const OUTLINE = ["", "\u2659", "\u2658", "\u2657", "\u2656", "\u2655", "\u2654"].map((g) => (g ? g + TEXT : ""));

function Piece({ pc }: { pc: number }) {
  const t = pieceType(pc);
  if (pieceColor(pc) === "b") return <span className="chess-piece is-black" aria-hidden="true">{SOLID[t]}</span>;
  return <span className="chess-piece is-white" aria-hidden="true"><span className="chess-fill">{SOLID[t]}</span>{OUTLINE[t]}</span>;
}
const NAME = ["", "pawn", "knight", "bishop", "rook", "queen", "king"];
const PROMOS = [QUEEN, ROOK, BISHOP, KNIGHT];
const CPU_DELAY = 450;
const PREFS_KEY = "notes-arcade-chess";

interface Played { before: ChessState; move: Move; san: string; by: "you" | "cpu" }

const DRAW_TEXT: Record<string, string> = {
  stalemate: "Stalemate: no legal move, but no check either.",
  insufficient: "Not enough pieces left for anyone to checkmate.",
  fifty: "Fifty moves each with no capture or pawn move.",
  threefold: "The same position came up three times.",
};

function readPrefs(): { level?: Level; side?: Color; wins?: number } {
  try { return JSON.parse(arcadeStore.getItem(PREFS_KEY) || "{}"); } catch { return {}; }
}
function writePrefs(p: { level: Level; side: Color; wins: number }) {
  try { arcadeStore.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* storage blocked: fine */ }
}

export default function ChessGame({ tourney }: { tourney?: TourneyProps } = {}) {
  // A tournament try (owner, 21 Nov 2026: "start tournaments"; lib/arcade/replay-chess.ts): you play White at the tournament's level, the
  // computer's replies come from the seed with a node-only search (so the server's replay finds the same moves), no undo, no new game.
  const tourneyLevel: Level | null = tourney ? (CHESS_LEVELS.includes(tourney.level as Level) ? (tourney.level as Level) : "medium") : null;
  const [side, setSide] = useState<Color>("w");
  const [level, setLevel] = useState<Level>(tourneyLevel ?? "medium");
  const [resigned, setResigned] = useState(false);
  const sentRef = useRef(false);
  const [wins, setWins] = useState(0);
  const [game, setGame] = useState<ChessState>(() => initialState());
  const [history, setHistory] = useState<Played[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const [focusSq, setFocusSq] = useState(12); // e2
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [muted, setMuted] = useState(false);
  // Nana (owner, 21 Nov 2026): a free hint from the engine itself, lit up in gold, and her take on each computer move.
  const [hint, setHint] = useState<{ from: number; to: number } | null>(null);
  const [take, setTake] = useState<NanaTake | null>(null);
  const [gameNo, setGameNo] = useState(0);
  const loaded = useRef(false);
  const levelRef = useRef<Level>(tourneyLevel ?? "medium");
  const mutedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const squareRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const movesRef = useRef<HTMLOListElement | null>(null);
  const countedRef = useRef<string | null>(null);

  const legal = useMemo(() => legalMoves(game), [game]);
  const status = useMemo(() => gameStatus(game), [game]);
  const ended = status.over || resigned;
  const yourTurn = game.turn === side && !ended;
  const last = history[history.length - 1];

  useEffect(() => {
    const p = readPrefs();
    if (typeof p.wins === "number") setWins(p.wins);
    if (tourney) return; // the tournament sets the level and colour, and its game doesn't change the saved choices
    if (p.level === "easy" || p.level === "medium" || p.level === "hard") { setLevel(p.level); levelRef.current = p.level; }
    if (p.side === "w" || p.side === "b") setSide(p.side);
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (loaded.current) writePrefs({ level, side, wins }); }, [level, side, wins]);

  const tone = useCallback((freq: number, dur = 0.09) => {
    if (mutedRef.current || typeof window === "undefined" || !window.AudioContext) return;
    try {
      const ctx = audioRef.current ?? (audioRef.current = new window.AudioContext());
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator(), vol = ctx.createGain(), now = ctx.currentTime;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      vol.gain.setValueAtTime(0.0001, now);
      vol.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
      vol.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(vol); vol.connect(ctx.destination);
      osc.start(now); osc.stop(now + dur);
    } catch { /* no audio: play on silently */ }
  }, []);

  const commit = useCallback((state: ChessState, m: Move, by: "you" | "cpu") => {
    const san = moveToSan(state, m);
    const next = applyMove(state, m);
    setHistory((h) => [...h, { before: state, move: m, san, by }]);
    setGame(next);
    setSelected(null);
    setPromo(null);
    setHint(null);
    if (by === "cpu") setTake(chessTake(state, m, next));
    tone(san.includes("+") || san.includes("#") ? 660 : m.captured ? 330 : 440);
  }, [tone]);

  // The computer replies after a short pause, so the board paints and you can follow; the search itself is capped.
  useEffect(() => {
    if (status.over || resigned || game.turn === side) return;
    const t = window.setTimeout(() => {
      const m = tourney ? tourneyReply(game, levelRef.current, tourney.seed) : chooseMove(game, levelRef.current);
      if (m) commit(game, m, "cpu");
    }, CPU_DELAY);
    return () => window.clearTimeout(t);
  }, [game, side, status.over, resigned, commit, tourney]);

  // A tournament try ends once: checkmate, a draw, or resigning. The recording is your moves only; the server replays the computer's.
  const finishTourney = useCallback((resign: boolean) => {
    if (!tourney || sentRef.current) return;
    sentRef.current = true;
    tourney.onFinish(encodeChess(history.filter((h) => h.by === "you").map((h) => h.move), resign));
  }, [history, tourney]);
  useEffect(() => { if (status.over) finishTourney(false); }, [status.over, finishTourney]);
  const resign = () => {
    if (!tourney || ended || promo) return;
    setResigned(true);
    setSelected(null);
    setOverlayHidden(false);
    finishTourney(true);
  };

  // Count a win once per finished game.
  useEffect(() => {
    if (!status.over) return;
    const key = game.keys.length + ":" + game.keys[game.keys.length - 1];
    if (countedRef.current === key) return;
    countedRef.current = key;
    if (status.winner === side) { setWins((w) => w + 1); tone(880, 0.25); }
    else tone(status.winner ? 196 : 523, 0.25);
    // Checkmated in practice: the computer at this level gets its leaderboard win (lib/arcade/record-loss.ts).
    if (status.winner && status.winner !== side && !tourney) recordLoss("chess", levelRef.current);
  }, [status, game, side, tone, tourney]);

  useEffect(() => {
    const el = movesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  const newGame = useCallback((nextSide: Color = side) => {
    setSide(nextSide);
    setGame(initialState());
    setHistory([]);
    setSelected(null);
    setPromo(null);
    setOverlayHidden(false);
    setHint(null);
    setTake(null);
    setGameNo((g) => g + 1);
    countedRef.current = null;
  }, [side]);

  const canUndo = history.some((h) => h.by === "you");
  const undo = () => {
    const h = history.slice();
    if (h.length && h[h.length - 1].by === "cpu") h.pop();
    const mine = h.pop();
    if (!mine || mine.by !== "you") return;
    setHistory(h);
    setGame(mine.before);
    setSelected(null);
    setPromo(null);
    setOverlayHidden(false);
    setHint(null);
    setTake(null);
    countedRef.current = null;
  };

  const targets = useMemo(() => (selected === null ? [] : legal.filter((m) => m.from === selected)), [legal, selected]);

  const onSquare = (sq: number) => {
    setFocusSq(sq);
    if (!yourTurn || promo) return;
    const hits = targets.filter((m) => m.to === sq);
    if (hits.length) {
      if (hits.some((m) => m.promo)) setPromo({ from: hits[0].from, to: sq });
      else commit(game, hits[0], "you");
      return;
    }
    const pc = game.board[sq];
    if (pc && pieceColor(pc) === side && sq !== selected && legal.some((m) => m.from === sq)) setSelected(sq);
    else setSelected(null);
  };

  const pickPromo = (t: number) => {
    if (!promo) return;
    const m = legal.find((x) => x.from === promo.from && x.to === promo.to && x.promo === t);
    if (m) commit(game, m, "you");
  };

  // Board orientation: your pieces at the bottom.
  const order = useMemo(() => {
    const list: number[] = [];
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const rank = side === "w" ? 7 - row : row, file = side === "w" ? col : 7 - col;
      list.push(rank * 8 + file);
    }
    return list;
  }, [side]);

  const onBoardKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { setSelected(null); setPromo(null); return; }
    const dirs: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const d = dirs[e.key];
    if (!d || promo) return;
    e.preventDefault();
    const idx = order.indexOf(focusSq);
    const col = Math.min(7, Math.max(0, (idx % 8) + d[0])), row = Math.min(7, Math.max(0, Math.floor(idx / 8) + d[1]));
    const sq = order[row * 8 + col];
    setFocusSq(sq);
    squareRefs.current[sq]?.focus();
  };

  const kingInCheck = status.check ? game.board.findIndex((p) => pieceType(p) === KING && pieceColor(p) === game.turn) : -1;
  const capturedBy = (who: "you" | "cpu") => history.filter((h) => h.by === who && h.move.captured).map((h) => pieceType(h.move.captured)).sort((a, b) => VALUE[b] - VALUE[a]);
  const yours = capturedBy("you"), theirs = capturedBy("cpu");
  const diff = yours.reduce((s, t) => s + VALUE[t], 0) - theirs.reduce((s, t) => s + VALUE[t], 0);
  const lastCpu = [...history].reverse().find((h) => h.by === "cpu");

  let message: string;
  if (resigned) message = "You resigned. The computer wins.";
  else if (status.over) {
    if (status.result === "checkmate") message = status.winner === side ? "Checkmate. You win!" : "Checkmate. The computer wins.";
    else message = "Draw. " + DRAW_TEXT[status.result ?? "stalemate"];
  } else if (!yourTurn) message = "Computer is thinking…";
  else if (promo) message = "Pick a piece for your pawn.";
  else {
    const said = last?.by === "cpu" && lastCpu ? `Computer played ${lastCpu.san}${lastCpu.move.captured ? `, taking your ${NAME[pieceType(lastCpu.move.captured)]}` : ""}. ` : "";
    message = said + (status.check ? "Check! Get your king to safety." : history.length ? "Your turn." : "Your turn. Tap a piece to see its moves.");
  }

  const colourName = (c: Color) => (c === "w" ? "white" : "black");

  return (
    <ArcadeShell game={arcadeGame("chess")} index={7}>
      <div className="arc-console chess-console">
        {tourney && <p className="chess-tourney">TOURNAMENT · same deal for everyone</p>}
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">YOU PLAY</span><strong>{side === "w" ? "WHITE" : "BLACK"}</strong></div>
          <div className="arc-stat"><span className="arc-label">MOVE</span><strong>{String(game.fullmove).padStart(2, "0")}</strong></div>
          <div className="arc-stat"><span className="arc-label">WINS</span><strong>{String(wins).padStart(2, "0")}</strong></div>
          <span className="arc-spacer" />
          <label className="chess-field">
            <span className="arc-label">LEVEL</span>
            <select className="arc-select" aria-label="Computer level" disabled={!!tourney} value={level} onChange={(e) => { const v = e.target.value as Level; setLevel(v); levelRef.current = v; }}>
              <option value="easy">EASY</option>
              <option value="medium">MEDIUM</option>
              <option value="hard">HARD</option>
            </select>
          </label>
          <label className="chess-field">
            <span className="arc-label">PLAY AS</span>
            <select className="arc-select" aria-label="Play as white or black (starts a new game)" disabled={!!tourney} value={side} onChange={(e) => newGame(e.target.value as Color)}>
              <option value="w">WHITE</option>
              <option value="b">BLACK</option>
            </select>
          </label>
        </div>

        <div className="chess-captures" aria-label={`Computer has taken: ${theirs.map((t) => NAME[t]).join(", ") || "nothing"}`}>
          {theirs.map((t, i) => <Piece key={i} pc={t | (side === "w" ? 0 : 8)} />)}
          {diff < 0 && <b>+{Math.round(-diff / 100)}</b>}
        </div>

        <div className="arc-board-wrap chess-wrap">
          <div className="chess-board" role="group" aria-label={`Chess board, you are ${colourName(side)}`} onKeyDown={onBoardKey}>
            {order.map((sq, i) => {
              const pc = game.board[sq];
              const dark = ((sq >> 3) + (sq & 7)) % 2 === 0;
              const target = targets.find((m) => m.to === sq);
              const row = Math.floor(i / 8), col = i % 8;
              const cls = ["chess-sq", dark ? "is-dark" : "is-light",
                last && (last.move.from === sq || last.move.to === sq) ? "is-last" : "",
                selected === sq ? "is-selected" : "", hint && (hint.from === sq || hint.to === sq) ? "is-hint" : "", sq === kingInCheck ? "is-check" : "",
                target ? (target.captured ? "is-capture" : "is-target") : ""].filter(Boolean).join(" ");
              const label = `${squareName(sq)}${pc ? `, ${colourName(pieceColor(pc))} ${NAME[pieceType(pc)]}` : ""}${target ? ", move here" : ""}${selected === sq ? ", selected" : ""}${hint?.from === sq ? ", Nana's hint: move from here" : hint?.to === sq ? ", Nana's hint: move here" : ""}`;
              return (
                <button key={sq} ref={(el) => { squareRefs.current[sq] = el; }} type="button" className={cls}
                  aria-label={label} tabIndex={sq === focusSq ? 0 : -1} onClick={() => onSquare(sq)}>
                  {pc ? <Piece pc={pc} /> : null}
                  {col === 0 && <span className="chess-coord chess-rank" aria-hidden="true">{(sq >> 3) + 1}</span>}
                  {row === 7 && <span className="chess-coord chess-file" aria-hidden="true">{"abcdefgh"[sq & 7]}</span>}
                </button>
              );
            })}
          </div>

          {promo && (
            <div className="arc-overlay chess-promo" role="dialog" aria-label="Promote your pawn">
              <p className="arc-overlay-kicker">PROMOTION</p>
              <h2>Choose a piece</h2>
              <div className="chess-promo-row">
                {PROMOS.map((t) => (
                  <button key={t} type="button" className="chess-promo-btn" aria-label={`Promote to ${NAME[t]}`} autoFocus={t === QUEEN} onClick={() => pickPromo(t)}>
                    <Piece pc={t | (side === "w" ? 0 : 8)} />
                  </button>
                ))}
              </div>
              <button type="button" className="arc-btn-ghost" onClick={() => setPromo(null)}>CANCEL</button>
            </div>
          )}

          {tourney && ended && !overlayHidden && (
            <div className="arc-overlay" role="dialog" aria-label="Game over">
              <p className="arc-overlay-kicker">{resigned ? "RESIGNED" : status.result === "checkmate" ? "CHECKMATE" : "DRAW"}</p>
              <h2>{resigned ? "You resigned" : status.result !== "checkmate" ? "It's a draw" : status.winner === side ? "You win!" : "The computer wins"}</h2>
              <p role="status">{tourney.finishedText ?? "Checking your game…"}</p>
              <div className="chess-over-row">
                <button type="button" className="arc-btn-ghost" onClick={() => setOverlayHidden(true)} aria-label="Look at the board">SEE BOARD</button>
              </div>
            </div>
          )}
          {!tourney && status.over && !overlayHidden && (
            <div className="arc-overlay" role="dialog" aria-label="Game over">
              <p className="arc-overlay-kicker">{status.result === "checkmate" ? "CHECKMATE" : "DRAW"}</p>
              <h2>{status.result !== "checkmate" ? "It's a draw" : status.winner === side ? "You win!" : "The computer wins"}</h2>
              <p>{status.result === "checkmate" ? (status.winner === side ? `Well played on ${level}.` : "Have another go, or take back a move.") : DRAW_TEXT[status.result ?? "stalemate"]}</p>
              <div className="chess-over-row">
                <button type="button" className="arc-btn" onClick={() => newGame()} aria-label="Play again">PLAY AGAIN</button>
                {canUndo && status.winner !== side && <button type="button" className="arc-btn-ghost" onClick={undo} aria-label="Take back your last move">UNDO</button>}
                <button type="button" className="arc-btn-ghost" onClick={() => setOverlayHidden(true)} aria-label="Look at the board">SEE BOARD</button>
              </div>
            </div>
          )}
        </div>

        <div className="chess-captures" aria-label={`You have taken: ${yours.map((t) => NAME[t]).join(", ") || "nothing"}`}>
          {yours.map((t, i) => <Piece key={i} pc={t | (side === "w" ? 8 : 0)} />)}
          {diff > 0 && <b>+{Math.round(diff / 100)}</b>}
        </div>

        <p className="arc-status" role="status" aria-live="polite">{message}</p>

        <ArcadeNana
          slug="chess"
          context={tourney ? { mode: "tournament" } : undefined}
          canAsk={yourTurn && !promo}
          onAsk={() => {
            // Synchronous on tap: the hint search is capped (lib/arcade/nana-chess.ts TIP_SEARCH) and comes back in tens of milliseconds.
            const t = chessTip(game);
            setHint(t ? t.highlight : null);
            return t ? t.tip : null;
          }}
          take={take}
          resetKey={gameNo}
          onToggle={() => setHint(null)}
        />

        <div className="chess-foot">
          <ol className="chess-moves" ref={movesRef} aria-label="Moves">
            {history.length === 0 && <li className="chess-moves-empty">No moves yet</li>}
            {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => (
              <li key={i}><span className="chess-move-no">{i + 1}.</span><span>{history[i * 2].san}</span><span>{history[i * 2 + 1]?.san ?? ""}</span></li>
            ))}
          </ol>
          {tourney ? (
            <div className="chess-actions">
              <button type="button" className="arc-btn-ghost" onClick={resign} disabled={ended || !!promo} aria-label="Resign this game (counts as a loss)">RESIGN</button>
              <button type="button" className="arc-btn-ghost chess-sound" aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}
                onClick={() => setMuted((m) => { mutedRef.current = !m; return !m; })}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
            </div>
          ) : (
          <div className="chess-actions">
            <button type="button" className="arc-btn-ghost" onClick={undo} disabled={!canUndo} aria-label="Undo your last move and the computer's reply">UNDO</button>
            <button type="button" className="arc-btn" onClick={() => newGame()} aria-label="Start a new game">NEW GAME</button>
            <button type="button" className="arc-btn-ghost chess-sound" aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}
              onClick={() => setMuted((m) => { mutedRef.current = !m; return !m; })}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
          </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .chess-field { display:flex; flex-direction:column; gap:4px; }
        .chess-tourney { margin:0 4px 8px; color:#83b83c; font:700 9px ui-monospace,monospace; letter-spacing:.12em; }
        .chess-field .arc-select:disabled { cursor:default; opacity:.7; }
        .chess-wrap { padding:8px; }
        .chess-board { display:grid; grid-template-columns:repeat(8,1fr); width:100%; max-width:560px; margin:0 auto; aspect-ratio:1; border-radius:4px; overflow:hidden; container-type:inline-size; touch-action:manipulation; }
        .chess-sq { position:relative; display:grid; place-items:center; min-width:0; aspect-ratio:1; padding:0; border:0; cursor:pointer; -webkit-tap-highlight-color:transparent; }
        .chess-sq.is-light { background:#eef0e6; }
        .chess-sq.is-dark { background:#7f9c63; }
        .chess-sq.is-last.is-light { background:#dcefb0; }
        .chess-sq.is-last.is-dark { background:#a3c46c; }
        .chess-sq.is-selected { box-shadow:inset 0 0 0 3px #17251f99; }
        .chess-sq.is-hint { box-shadow:inset 0 0 0 3px #ffd166, inset 0 0 14px #ffd166aa; animation:chess-hint 1.4s ease-in-out infinite; }
        @keyframes chess-hint { 50% { box-shadow:inset 0 0 0 3px #ffd166, inset 0 0 22px #ffd166dd; } }
        @media(prefers-reduced-motion:reduce) { .chess-sq.is-hint { animation:none; } }
        .chess-sq.is-check { background:radial-gradient(circle, #ff816d 0%, #ff816dcc 38%, transparent 72%), #eef0e6; }
        .chess-sq.is-check.is-dark { background:radial-gradient(circle, #ff816d 0%, #ff816dcc 38%, transparent 72%), #7f9c63; }
        .chess-sq.is-target::after { content:""; position:absolute; width:28%; height:28%; border-radius:50%; background:#17251f44; pointer-events:none; }
        .chess-sq.is-capture::after { content:""; position:absolute; inset:6%; border-radius:50%; box-shadow:inset 0 0 0 4px #17251f55; pointer-events:none; }
        .chess-sq:focus-visible { outline:3px solid #ff816d; outline-offset:-3px; z-index:1; }
        .chess-piece { position:relative; z-index:1; font-size:34px; font-size:10.5cqw; line-height:1; font-family:"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans",serif; user-select:none; pointer-events:none; }
        .chess-piece.is-white { color:#17251f; }
        .chess-fill { position:absolute; inset:0; z-index:-1; color:#fbfcf7; }
        .chess-piece.is-black { color:#17251f; text-shadow:0 1px 0 #ffffff44; }
        .chess-coord { position:absolute; font:700 9px ui-monospace,monospace; pointer-events:none; }
        .chess-sq.is-light .chess-coord { color:#7f9c63; }
        .chess-sq.is-dark .chess-coord { color:#eef0e6; }
        .chess-rank { top:3px; left:4px; }
        .chess-file { right:4px; bottom:2px; }
        .chess-captures { display:flex; flex-wrap:wrap; align-items:center; gap:1px; min-height:26px; padding:2px 6px; }
        .chess-captures .chess-piece { font-size:20px; }
        .chess-captures b { margin-left:6px; color:#5c685f; font:700 10px ui-monospace,monospace; }
        .chess-promo-row { display:flex; gap:8px; margin-bottom:14px; }
        .chess-promo-btn { display:grid; place-items:center; width:56px; height:56px; border:0; border-radius:10px; background:#eef0e6; cursor:pointer; }
        .chess-promo-btn:hover { background:#dcefb0; }
        .chess-promo-btn:focus-visible { outline:3px solid #bdf36b; outline-offset:2px; }
        .chess-promo-btn .chess-piece { font-size:40px; }
        .chess-over-row { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; }
        .chess-foot { display:flex; flex-wrap:wrap; align-items:flex-start; gap:12px; padding:8px 4px 2px; }
        .chess-moves { flex:1 1 220px; display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:2px 12px; max-height:96px; margin:0; padding:8px 10px; overflow-y:auto; border:1px solid #e3e6df; border-radius:8px; background:#f8f9f6; list-style:none; color:#202d26; font:500 11px ui-monospace,monospace; }
        .chess-moves li { display:grid; grid-template-columns:28px 1fr 1fr; gap:4px; }
        .chess-move-no { color:#929b94; }
        .chess-moves-empty { display:block !important; color:#929b94; }
        .chess-actions { display:flex; flex-wrap:wrap; gap:8px; }
        .chess-actions .arc-btn-ghost:disabled { opacity:.45; cursor:default; }
        .chess-promo-btn, .chess-sq { font-family:inherit; }
        @media(max-width:520px) { .chess-wrap { padding:5px; } .chess-coord { font-size:7px; } .chess-actions { width:100%; } .chess-actions > * { flex:1; } }
      `}</style>
    </ArcadeShell>
  );
}
