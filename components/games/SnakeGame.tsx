"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";
type Pace = "chill" | "classic" | "fast";

const BOARD_SIZE = 20;
const BASE_INTERVAL: Record<Pace, number> = { chill: 210, classic: 145, fast: 105 };
const START_SNAKE: Point[] = [
  { x: 8, y: 10 },
  { x: 7, y: 10 },
  { x: 6, y: 10 },
];
const START_FOOD: Point = { x: 14, y: 10 };
const VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function makeFood(snake: Point[]): Point {
  const open: Point[] = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!snake.some((part) => part.x === x && part.y === y)) open.push({ x, y });
    }
  }
  return open[Math.floor(Math.random() * open.length)] ?? { x: 0, y: 0 };
}

export default function SnakeGame() {
  const [snake, setSnake] = useState<Point[]>(START_SNAKE);
  const [food, setFood] = useState<Point>(START_FOOD);
  const [direction, setDirection] = useState<Direction>("right");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [muted, setMuted] = useState(false);
  const [pace, setPace] = useState<Pace>("classic");
  const directionRef = useRef<Direction>("right");
  const queuedDirection = useRef<Direction>("right");
  const audioContextRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);

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
    const initial = START_SNAKE.map((part) => ({ ...part }));
    setSnake(initial);
    setFood(makeFood(initial));
    setScore(0);
    setDirection("right");
    directionRef.current = "right";
    queuedDirection.current = "right";
    if (!mutedRef.current) getAudioContext();
    setStatus("playing");
  }, [getAudioContext]);

  const turn = useCallback((next: Direction) => {
    if (next !== OPPOSITE[queuedDirection.current]) {
      queuedDirection.current = next;
    }
    if (status === "ready") {
      if (!mutedRef.current) getAudioContext();
      setStatus("playing");
    }
  }, [getAudioContext, status]);

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
        if (next !== OPPOSITE[queuedDirection.current]) {
          queuedDirection.current = next;
          if (status === "ready") {
            if (!mutedRef.current) getAudioContext();
            setStatus("playing");
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [getAudioContext, startGame, status]);

  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setInterval(() => {
      const nextDirection = queuedDirection.current;
      directionRef.current = nextDirection;
      setDirection(nextDirection);
      setSnake((current) => {
        const vector = VECTORS[nextDirection];
        const head = { x: current[0].x + vector.x, y: current[0].y + vector.y };
        const ate = head.x === food.x && head.y === food.y;
        const body = ate ? current : current.slice(0, -1);
        const collided =
          head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE ||
          body.some((part) => part.x === head.x && part.y === head.y);
        if (collided) {
          playSound(165, 0.2);
          setStatus("over");
          return current;
        }
        const nextSnake = [head, ...current.slice(0, ate ? undefined : -1)];
        if (ate) {
          playSound(740, 0.1);
          setScore((value) => {
            const nextScore = value + 10;
            setBest((currentBest) => Math.max(currentBest, nextScore));
            return nextScore;
          });
          setFood(makeFood(nextSnake));
        }
        return nextSnake;
      });
    }, Math.max(72, BASE_INTERVAL[pace] - Math.floor(score / 50) * 8));
    return () => window.clearInterval(timer);
  }, [food, pace, playSound, score, status]);

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
      <div className="snake-topbar">
        <a className="snake-brand" href="/arcade" aria-label="Notes Arcade, all games">
          <Image className="snake-brand-icon" src="/images/brand/notesapp-icon.webp" alt="" width={32} height={32} />
          <span>NOTES <span className="snake-brand-accent">ARCADE</span></span>
        </a>
        <div className="snake-live"><i /> ARCADE MODE</div>
      </div>

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
          <div className="snake-console-head">
            <div><span className="snake-console-label">SCORE</span><strong className="snake-score" aria-live="polite">{String(score).padStart(3, "0")}</strong></div>
            <div className="snake-best"><span className="snake-console-label">BEST</span><strong>{String(best).padStart(3, "0")}</strong></div>
            <label className="snake-pace">
              <span className="snake-console-label">SPEED</span>
              <select className="snake-pace-select" aria-label="Game speed" value={pace} onChange={(event) => setPace(event.target.value as Pace)}>
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
                <p>{status === "over" ? `You scored ${score} points.` : "Your next favorite high score starts here."}</p>
                <button type="button" className="snake-play" onClick={startGame}>{status === "over" ? "PLAY AGAIN" : "START GAME"}<span aria-hidden="true">↗</span></button>
                <span className="snake-overlay-hint">OR PRESS SPACE</span>
              </div>
            )}
          </div>
          <div className="snake-console-foot"><span><i className="snake-food-legend" /> FOOD</span><span>BOARD <b>20 × 20</b></span><span>LEVEL <b>{Math.floor(score / 50) + 1}</b></span></div>
          <div className="snake-touch" aria-label="Touch controls">
            <div className="snake-pad">
              <div>{controlButton("Up", "up", "↑")}</div>
              <div>{controlButton("Left", "left", "←")}{controlButton("Down", "down", "↓")}{controlButton("Right", "right", "→")}</div>
            </div>
            <span>USE THE ARROWS TO MOVE</span>
          </div>
        </div>
      </div>
      <footer className="snake-footer"><span>NOTES ARCADE</span><span>MADE FOR A LITTLE FUN <b>·</b> 2026</span></footer>

      <style jsx global>{`
        .snake-page { --snake-ink: #17251f; --snake-muted: #748078; --snake-paper: #f7f7f2; --snake-green: #bdf36b; --snake-board: #1b2a23; min-height: 100vh; padding: 0 clamp(20px, 5.6vw, 88px); background: var(--snake-paper); color: var(--snake-ink); font-family: Inter, Arial, sans-serif; overflow: hidden; }
        .snake-topbar { height: 82px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #e4e7df; }
        .snake-brand { display:flex; align-items:center; gap:10px; color:var(--snake-ink); text-decoration:none; font-size:12px; font-weight:800; letter-spacing:.09em; }
        .snake-brand-icon { display:block; width:32px; height:32px; object-fit:contain; filter:hue-rotate(108deg) saturate(.6) brightness(1.05); }.snake-brand-accent { color:#9cd849; }
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
        .snake-touch { display:none; }.snake-footer { display:flex; justify-content:space-between; width:min(1040px,100%); margin:0 auto; padding:20px 0 24px; border-top:1px solid #e4e7df; color:#98a098; font:600 8px ui-monospace,monospace; letter-spacing:.12em; }.snake-footer b { padding:0 4px; color:#a5d95c; }
        @media(max-width:740px) { .snake-page { padding:0 20px; }.snake-topbar { height:68px; }.snake-layout { grid-template-columns:1fr; gap:27px; max-width:440px; padding:35px 0 42px; }.snake-intro { display:grid; grid-template-columns:1fr auto; align-items:end; }.snake-kicker { grid-column:1/-1; margin-bottom:12px; }.snake-intro h1 { font-size:clamp(48px,13vw,68px); }.snake-description { grid-column:1/-1; max-width:360px; margin:14px 0 0; font-size:13px; }.snake-desktop-tip,.snake-or,.snake-note { display:none; }.snake-console { padding:12px; border-radius:14px; }.snake-console-head { flex-wrap:wrap; gap:13px; padding:3px 4px 11px; }.snake-score { font-size:22px; }.snake-best { gap:6px; padding-left:12px; }.snake-pace { order:1; width:100%; justify-content:space-between; margin-left:0; }.snake-pace-select { min-width:148px; }.snake-sound { gap:6px; font-size:8px; }.snake-board { padding:7px; }.snake-cell { margin:.7px; border-radius:2px; }.snake-console-foot { padding:11px 3px 0; font-size:7px; }.snake-touch { display:flex; align-items:center; justify-content:space-between; padding:14px 4px 3px; }.snake-touch>span { color:#a0a8a1; font:600 8px ui-monospace,monospace; letter-spacing:.1em; }.snake-pad { display:flex; flex-direction:column; align-items:center; gap:4px; }.snake-pad>div { display:flex; gap:4px; }.snake-control { display:grid; place-items:center; width:39px;height:34px; border:1px solid #e3e7df; border-radius:7px; background:#f7f8f4; color:#39473d; font-size:15px; cursor:pointer; touch-action:manipulation; }.snake-control:active { background:#d9f4b2; }.snake-footer { padding-top:15px; font-size:7px; } }
        @media(max-width:380px) { .snake-page { padding:0 14px; }.snake-layout { padding-top:27px; }.snake-console { padding:9px; }.snake-best { padding-left:9px; }.snake-sound { font-size:7px; }.snake-footer { font-size:6px; } }
        @media(prefers-reduced-motion:reduce) { .snake-play { transition:none; } }
      `}</style>
    </section>
  );
}
