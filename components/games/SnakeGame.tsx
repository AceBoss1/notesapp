"use client";

import Image from "next/image";
import { ArcadeFooter, ArcadeGallery, ArcadeStyles, ArcadeTopbar } from "./ArcadeShell";
import ArcadeAdSpot from "./ArcadeAdSpot";
import { arcadeGame } from "@/lib/arcade/catalogue";
import ArcadeNana from "./ArcadeNana";
import { onSnakeEdge, snakeCoach, type SnakeStats } from "@/lib/arcade/nana-snake";
import {
  OPPOSITE, SNAKE_BOARD as BOARD_SIZE, SNAKE_PACES, START_FOOD, createSnake, intervalMs as paceInterval, levelOf, randomSeed, step,
  turn as turnSnake, type SnakeDir as Direction, type SnakePace as Pace, type SnakeState,
} from "@/lib/arcade/snake";
import { encodeSnakeTick } from "@/lib/arcade/replay-snake";
import type { TourneyProps } from "@/lib/arcade/tournament-games";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// The rules live in lib/arcade/snake.ts (owner, 21 Nov 2026: "start tournaments"), so a tournament run can be replayed on the server with
// the same code. This component keeps the ticking clock, the keys, the sound and the look.
export default function SnakeGame({ tourney }: { tourney?: TourneyProps } = {}) {
  // A tournament try is played at the tournament's speed from its seed (same snacks for everyone); normal play keeps a random seed per game.
  const tourneyPace: Pace | null = tourney ? (SNAKE_PACES.includes(tourney.level as Pace) ? (tourney.level as Pace) : "classic") : null;
  const [game, setGame] = useState<SnakeState>(() => (tourney ? createSnake(tourney.seed, tourneyPace ?? "classic") : createSnake(0, "classic", START_FOOD)));
  const gameRef = useRef(game);
  const { snake, food, score } = game;
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [muted, setMuted] = useState(false);
  const [pace, setPaceState] = useState<Pace>(tourneyPace ?? "classic");
  const audioContextRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  // A tournament try: every tick's character for the server's replay, and onFinish sent once.
  const recordingRef = useRef("");
  const sentRef = useRef(false);
  // Nana (lib/arcade/nana-snake.ts, owner, 21 Nov 2026): Snake has no pause, so no hints; she coaches after each run from how it ended.
  const [lastRun, setLastRun] = useState<SnakeStats | null>(null);
  const [runNo, setRunNo] = useState(0);
  const bestRef = useRef(0);
  const bestAtStart = useRef(0);
  useEffect(() => { bestRef.current = best; }, [best]);
  const nanaTake = useMemo(() => snakeCoach(lastRun), [lastRun]);

  const setBoth = useCallback((next: SnakeState) => { gameRef.current = next; setGame(next); }, []);

  // Normal play: the opening board keeps its fixed snack, but the snacks after it come from a fresh random seed (set after mount, so the
  // server-rendered board and the first client render agree).
  useEffect(() => {
    if (!tourney) setBoth({ ...gameRef.current, rng: randomSeed() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The speed can change mid-game in normal play, as it always could; a tournament's speed is fixed.
  const setPace = (next: Pace) => {
    if (tourney) return;
    setPaceState(next);
    setBoth({ ...gameRef.current, pace: next });
  };

  const getAudioContext = useCallback(() => {
    if (!window.AudioContext) return null;
    if (!audioContextRef.current) audioContextRef.current = new window.AudioContext();
    const context = audioContextRef.current;
    if (context.state === "suspended") void context.resume();
    return context;
  }, []);

  const playSound = useCallback((frequency: number, duration: number) => {
    if (mutedRef.current) return;
    const context = audioContextRef.current ?? getAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    const now = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }, [getAudioContext]);

  const toggleSound = useCallback(() => {
    setMuted((current) => {
      const nextMuted = !current;
      mutedRef.current = nextMuted;
      if (!nextMuted) getAudioContext();
      return nextMuted;
    });
  }, [getAudioContext]);

  const startGame = useCallback(() => {
    // A tournament try is one game from one seed: it starts once and never restarts (no "play again").
    if (tourney) {
      if (status !== "ready") return;
    } else {
      setBoth(createSnake(randomSeed(), pace));
    }
    bestAtStart.current = bestRef.current;
    setRunNo((n) => n + 1);
    if (!mutedRef.current) getAudioContext();
    setStatus("playing");
  }, [getAudioContext, pace, setBoth, status, tourney]);

  const turn = useCallback((next: Direction) => {
    if (status === "over") return;
    setBoth(turnSnake(gameRef.current, next));
    if (status === "ready") {
      if (!mutedRef.current) getAudioContext();
      setStatus("playing");
    }
  }, [getAudioContext, setBoth, status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: "up", w: "up", W: "up",
        ArrowDown: "down", s: "down", S: "down",
        ArrowLeft: "left", a: "left", A: "left",
        ArrowRight: "right", d: "right", D: "right",
      };
      if (event.key === " " || event.key === "Enter") {
        if (status !== "playing") startGame();
        event.preventDefault();
        return;
      }
      const next = keyMap[event.key];
      if (next) {
        event.preventDefault();
        if (status === "over") return;
        if (next !== OPPOSITE[gameRef.current.queued]) {
          setBoth(turnSnake(gameRef.current, next));
          if (status === "ready") {
            if (!mutedRef.current) getAudioContext();
            setStatus("playing");
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [getAudioContext, setBoth, startGame, status]);

  // The clock: one step of the pure rules per tick, at the pace's interval for the current score (it speeds up every 50 points).
  const tickMs = paceInterval(pace, score);
  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setInterval(() => {
      const before = gameRef.current;
      if (before.over) return;
      // A tournament try records exactly what the server's replay reads: one character per tick, taken just before the step.
      if (tourney) recordingRef.current += encodeSnakeTick(before);
      const after = step(before);
      setBoth(after);
      if (after.over) {
        setLastRun({
          cause: after.cause ?? "self", heading: after.dir, length: before.snake.length, score: before.score, bestBefore: bestAtStart.current,
          pace: before.pace, intervalMs: paceInterval(before.pace, before.score), foodOnEdge: onSnakeEdge(before.food),
        });
        playSound(165, 0.2);
        setStatus("over");
        if (tourney && !sentRef.current) { sentRef.current = true; tourney.onFinish(recordingRef.current); }
        return;
      }
      if (after.score > before.score) {
        playSound(740, 0.1);
        setBest((currentBest) => Math.max(currentBest, after.score));
      }
    }, tickMs);
    return () => window.clearInterval(timer);
  }, [playSound, setBoth, status, tickMs, tourney]);

  const cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const x = index % BOARD_SIZE;
    const y = Math.floor(index / BOARD_SIZE);
    const isHead = snake[0]?.x === x && snake[0]?.y === y;
    const isSnake = snake.some((part) => part.x === x && part.y === y);
    const isFood = food.x === x && food.y === y;
    return (
      <span
        key={index}
        className={`snake-cell${isSnake ? " is-snake" : ""}${isHead ? " is-head" : ""}${isFood ? " is-food" : ""}`}
        aria-hidden="true"
      />
    );
  });

  const controlButton = (label: string, next: Direction, glyph: string) => (
    <button
      type="button"
      className="snake-control"
      aria-label={`Move ${label.toLowerCase()}`}
      onClick={() => turn(next)}
    >
      {glyph}
    </button>
  );

  return (
    <section className="snake-page" aria-label="Snake arcade game">
      <ArcadeTopbar />

      <div className="snake-layout">
        <div className="snake-intro">
          <p className="snake-kicker"><span>01</span> &nbsp; THE CLASSICS</p>
          <h1>Stay<br /><em>hungry.</em></h1>
          <p className="snake-description">One little snake. A lot of snacks. How long can you keep the good times rolling?</p>
          <div className="snake-desktop-tip"><span className="snake-key">↑</span><span className="snake-key">←</span><span className="snake-key">↓</span><span className="snake-key">→</span><span className="snake-tip-copy">to move</span></div>
          <p className="snake-or">or use <strong>W A S D</strong></p>
          <div className="snake-note"><span className="snake-note-dot" /> The rules are simple: eat, grow, don&apos;t bump into yourself.</div>
        </div>

        <div className="snake-console">
          {tourney && <p className="snake-tourney">TOURNAMENT · same deal for everyone</p>}
          <div className="snake-console-head">
            <div><span className="snake-console-label">SCORE</span><strong className="snake-score" aria-live="polite">{String(score).padStart(3, "0")}</strong></div>
            <div className="snake-best"><span className="snake-console-label">BEST</span><strong>{String(best).padStart(3, "0")}</strong></div>
            <label className="snake-pace">
              <span className="snake-console-label">SPEED</span>
              <select className="snake-pace-select" aria-label={tourney ? "Game speed (set by the tournament)" : "Game speed"} disabled={!!tourney} value={pace} onChange={(event) => setPace(event.target.value as Pace)}>
                <option value="chill">CHILL</option>
                <option value="classic">CLASSIC</option>
                <option value="fast">FAST</option>
              </select>
            </label>
            <button className="snake-sound" type="button" onClick={toggleSound} aria-label={muted ? "Turn sound on" : "Turn sound off"} aria-pressed={!muted}>
              {muted ? "SOUND OFF" : "SOUND ON"}<span className={`snake-sound-dot${muted ? " is-muted" : ""}`} />
            </button>
          </div>

          <div className="snake-board-wrap">
            <div className="snake-board" role="img" aria-label={`Snake game board. Score ${score}. ${status === "over" ? "Game over." : status === "playing" ? "Game in progress." : "Ready to play."}`}>
              {cells}
            </div>
            {status !== "playing" && (
              <div className="snake-overlay">
                <div className="snake-overlay-icon">{status === "over" ? "×" : "S"}</div>
                <p className="snake-overlay-kicker">{status === "over" ? "THAT'S A WRAP" : "READY WHEN YOU ARE"}</p>
                <h2>{status === "over" ? "Nice run." : "Let's play."}</h2>
                <p>{status === "over" ? `You scored ${score} points.` : tourney ? "Same snacks for everyone. One go: make it count." : "Your next favorite high score starts here."}</p>
                {status === "over" && tourney ? (
                  <p className="snake-tourney-done" role="status">{tourney.finishedText ?? "Checking your run…"}</p>
                ) : (
                  <>
                    <button type="button" className="snake-play" onClick={startGame}>{status === "over" ? "PLAY AGAIN" : "START GAME"}<span aria-hidden="true">↗</span></button>
                    <span className="snake-overlay-hint">OR PRESS SPACE</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="snake-console-foot"><span><i className="snake-food-legend" /> FOOD</span><span>BOARD <b>20 × 20</b></span><span>LEVEL <b>{levelOf(score)}</b></span></div>
          <div className="snake-touch" aria-label="Touch controls">
            <div className="snake-pad">
              <div>{controlButton("Up", "up", "↑")}</div>
              <div>{controlButton("Left", "left", "←")}{controlButton("Down", "down", "↓")}{controlButton("Right", "right", "→")}</div>
            </div>
            <span>USE THE ARROWS TO MOVE</span>
          </div>
          {/* No pause in Snake, so HINT stays off; clicking Nana's buttons mustn't take focus from the board either. */}
          <div onMouseDown={(event) => event.preventDefault()}>
            <ArcadeNana slug="snake" context={tourney ? { mode: "tournament" } : undefined} canAsk={false} onAsk={() => null} take={nanaTake} resetKey={runNo} />
          </div>
        </div>
      </div>
      <div className="snake-gallery"><ArcadeAdSpot variant="banner" game="snake" /><ArcadeGallery game={arcadeGame("snake")} /></div>
      <ArcadeFooter />
      <ArcadeStyles />

      <style jsx global>{`
        .snake-page { --snake-ink: #17251f; --snake-muted: #748078; --snake-paper: #f7f7f2; --snake-green: #bdf36b; --snake-board: #1b2a23; min-height: 100vh; padding: 0 clamp(20px, 5.6vw, 88px); background: var(--snake-paper); color: var(--snake-ink); font-family: Inter, Arial, sans-serif; overflow: hidden; }
        .snake-topbar { height: 82px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #e4e7df; }
        .snake-brand { display:flex; align-items:center; gap:10px; color:var(--snake-ink); text-decoration:none; font-size:12px; font-weight:800; letter-spacing:.09em; }
        .snake-brand-icon { display:block; width:32px; height:32px; object-fit:contain; }.snake-brand-accent { color:#9cd849; }
        .snake-live { display:flex; align-items:center; gap:9px; color:#637068; font:600 10px ui-monospace,monospace; letter-spacing:.12em; }.snake-live i,.snake-note-dot { width:7px; height:7px; display:inline-block; border-radius:50%; background:#9bd34d; box-shadow:0 0 0 4px #9bd34d22; }
        .snake-layout { display:grid; grid-template-columns:minmax(210px,.76fr) minmax(350px,1.24fr); gap:clamp(32px,7vw,112px); align-items:center; width:min(1040px,100%); margin:0 auto; padding:clamp(42px,8vh,82px) 0 64px; }
        .snake-intro { padding-bottom:10px; }.snake-kicker { margin:0 0 25px; color:#77817b; font:600 10px ui-monospace,monospace; letter-spacing:.12em; }.snake-kicker span { color:#93c640; }
        .snake-intro h1 { margin:0; font:500 clamp(58px,7.2vw,92px)/.91 Georgia,'Times New Roman',serif; letter-spacing:-.065em; }.snake-intro h1 em { color:#83b83c; font-weight:500; }
        .snake-description { max-width:300px; margin:25px 0 28px; color:#657169; font-size:14px; line-height:1.8; }
        .snake-desktop-tip { display:flex; align-items:center; gap:5px; }.snake-key { display:grid; place-items:center; min-width:27px; height:27px; border:1px solid #dce0d9; border-radius:6px; background:#fff; color:#58645c; font-size:13px; box-shadow:0 2px 0 #e8eae5; }.snake-tip-copy { margin-left:8px; color:#7c867e; font-size:11px; }.snake-or { margin:12px 0 0; color:#8a938b; font-size:11px; }.snake-or strong { color:#657169; font:600 10px ui-monospace,monospace; letter-spacing:.08em; }
        .snake-note { display:flex; align-items:flex-start; gap:11px; max-width:300px; margin-top:48px; padding-top:18px; border-top:1px solid #e4e7df; color:#828c84; font-size:11px; line-height:1.7; }.snake-note-dot { flex:none; margin-top:5px; width:6px; height:6px; }
        .snake-console { padding:16px; border:1px solid #e3e6df; border-radius:16px; background:#fff; box-shadow:0 18px 55px #17251f0c; }.snake-console-head { display:flex; align-items:center; gap:18px; padding:4px 6px 14px; }.snake-console-head>div:first-child { display:flex; align-items:center; gap:11px; }.snake-console-label { display:block; color:#929b94; font:600 9px ui-monospace,monospace; letter-spacing:.12em; }.snake-score { color:#202d26; font:500 25px ui-monospace,monospace; letter-spacing:.04em; }.snake-best { display:flex; align-items:center; gap:9px; padding-left:20px; border-left:1px solid #e8eae5; }.snake-best strong { color:#7b877e; font:500 15px ui-monospace,monospace; }.snake-pace { display:flex; align-items:center; gap:8px; margin-left:auto; }.snake-pace-select { min-height:30px; padding:5px 8px; border:1px solid #e3e6df; border-radius:6px; background:#f8f9f6; color:#58645c; font:700 8px ui-monospace,monospace; letter-spacing:.06em; cursor:pointer; }.snake-pace-select:focus-visible,.snake-sound:focus-visible,.snake-play:focus-visible,.snake-control:focus-visible { outline:2px solid #83b83c; outline-offset:3px; }.snake-sound { display:flex; align-items:center; gap:8px; margin-left:0; padding:7px 0 7px 10px; border:0; background:transparent; color:#858e87; font:600 9px ui-monospace,monospace; letter-spacing:.06em; cursor:pointer; }.snake-sound-dot { width:6px;height:6px;border-radius:50%;background:#9bd34d; }.snake-sound-dot.is-muted { background:#c6cbc4; }
        .snake-board-wrap { position:relative; overflow:hidden; border-radius:9px; background:var(--snake-board); }.snake-board { display:grid; aspect-ratio:1; grid-template-columns:repeat(20,minmax(0,1fr)); grid-template-rows:repeat(20,minmax(0,1fr)); padding:10px; background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px); background-size:5% 5%; }.snake-cell { position:relative; z-index:1; margin:1px; border-radius:3px; }.snake-cell.is-snake { background:#a5df59; box-shadow:0 0 12px #a5df5940; }.snake-cell.is-head { border-radius:7px; background:#d1ff89; }.snake-cell.is-food { border-radius:50%; background:#ff816d; box-shadow:0 0 14px #ff816d88; transform:scale(.68); }
        .snake-overlay { position:absolute; inset:0; z-index:2; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; background:#14231fdc; color:white; text-align:center; backdrop-filter:blur(3px); }.snake-overlay-icon { display:grid; place-items:center; width:43px; height:43px; margin-bottom:15px; border:1px solid #d7f5a34f; border-radius:13px; color:#c8f28b; font:500 26px Georgia,serif; }.snake-overlay-kicker { margin:0 0 7px; color:#c1e993; font:600 9px ui-monospace,monospace; letter-spacing:.16em; }.snake-overlay h2 { margin:0; color:#fff; font:500 clamp(30px,4vw,43px)/1.1 Georgia,serif; letter-spacing:-.04em; }.snake-overlay>p:not(.snake-overlay-kicker) { margin:9px 0 20px; color:#c1cbc3; font-size:12px; }.snake-play { display:flex; align-items:center; gap:20px; padding:13px 17px; border:0; border-radius:7px; background:#c2f17a; color:#20301e; font:700 10px ui-monospace,monospace; letter-spacing:.08em; cursor:pointer; transition:transform .15s,background .15s; }.snake-play:hover { transform:translateY(-2px); background:#d3ff96; }.snake-play span { font-size:15px; }.snake-overlay-hint { margin-top:12px; color:#87968a; font:500 8px ui-monospace,monospace; letter-spacing:.12em; }
        .snake-console-foot { display:flex; justify-content:space-between; padding:14px 4px 1px; color:#929b94; font:600 8px ui-monospace,monospace; letter-spacing:.08em; }.snake-console-foot span { display:flex; align-items:center; gap:6px; }.snake-console-foot b { color:#637068; font-weight:700; }.snake-food-legend { display:inline-block; width:7px;height:7px;border-radius:50%;background:#ff816d; }
        .snake-tourney { margin:0 6px 10px; color:#83b83c; font:700 9px ui-monospace,monospace; letter-spacing:.12em; }.snake-tourney-done { max-width:300px; margin:0 !important; color:#e8f3dc !important; font-size:13px !important; line-height:1.5; }.snake-pace-select:disabled { cursor:default; opacity:.7; }
        .snake-touch { display:none; }.snake-gallery { width:min(1040px,100%); margin:0 auto 40px; }.snake-footer { display:flex; justify-content:space-between; width:min(1040px,100%); margin:0 auto; padding:20px 0 24px; border-top:1px solid #e4e7df; color:#98a098; font:600 8px ui-monospace,monospace; letter-spacing:.12em; }.snake-footer b { padding:0 4px; color:#a5d95c; }
        @media(max-width:740px) { .snake-page { padding:0 20px; }.snake-topbar { height:68px; }.snake-layout { grid-template-columns:1fr; gap:27px; max-width:440px; padding:35px 0 42px; }.snake-intro { display:grid; grid-template-columns:1fr auto; align-items:end; }.snake-kicker { grid-column:1/-1; margin-bottom:12px; }.snake-intro h1 { font-size:clamp(48px,13vw,68px); }.snake-description { grid-column:1/-1; max-width:360px; margin:14px 0 0; font-size:13px; }.snake-desktop-tip,.snake-or,.snake-note { display:none; }.snake-console { padding:12px; border-radius:14px; }.snake-console-head { flex-wrap:wrap; gap:13px; padding:3px 4px 11px; }.snake-score { font-size:22px; }.snake-best { gap:6px; padding-left:12px; }.snake-pace { order:1; width:100%; justify-content:space-between; margin-left:0; }.snake-pace-select { min-width:148px; }.snake-sound { gap:6px; font-size:8px; }.snake-board { padding:7px; }.snake-cell { margin:.7px; border-radius:2px; }.snake-console-foot { padding:11px 3px 0; font-size:7px; }.snake-touch { display:flex; align-items:center; justify-content:space-between; padding:14px 4px 3px; }.snake-touch>span { color:#a0a8a1; font:600 8px ui-monospace,monospace; letter-spacing:.1em; }.snake-pad { display:flex; flex-direction:column; align-items:center; gap:4px; }.snake-pad>div { display:flex; gap:4px; }.snake-control { display:grid; place-items:center; width:39px;height:34px; border:1px solid #e3e7df; border-radius:7px; background:#f7f8f4; color:#39473d; font-size:15px; cursor:pointer; touch-action:manipulation; }.snake-control:active { background:#d9f4b2; }.snake-footer { padding-top:15px; font-size:7px; } }
        @media(max-width:380px) { .snake-page { padding:0 14px; }.snake-layout { padding-top:27px; }.snake-console { padding:9px; }.snake-best { padding-left:9px; }.snake-sound { font-size:7px; }.snake-footer { font-size:6px; } }
        @media(prefers-reduced-motion:reduce) { .snake-play { transition:none; } }
      `}</style>
    </section>
  );
}
