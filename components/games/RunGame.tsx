"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArcadeShell from "@/components/games/ArcadeShell";
import ArcadeNana from "@/components/games/ArcadeNana";
import { newRunWatch, runCoach, runStats, runTip, watchRun, type RunStats } from "@/lib/arcade/nana-run";
import { useCanvasFit } from "@/components/games/useCanvasFit";
import { loadAds, weightedOrder } from "@/components/AdSlot";
import { fitsSpot } from "@/lib/ads";
import { encodeStep, stepDt } from "@/lib/arcade/run-replay";
import { ENTRY } from "@/lib/arcade/run.entry";
import { arcadeStore } from "@/lib/arcade/store";
import type { TourneyProps } from "@/lib/arcade/tournament-games";
import {
  LANE_GLIDE_MS, LANE_WIDTH, OBSTACLES, PEPPER_MS, STRIDE_M, createRun, jumpHeight, nextRandom, score, step,
  type ObstacleKind, type Obstacle, type Pickup, type RunEvent, type RunInput, type RunState, type Speed,
} from "@/lib/arcade/run";

// Naija Run: the canvas, controls and sounds. The rules live in lib/arcade/run.ts; this file only draws a state and feeds
// it inputs from a requestAnimationFrame loop.

type Phase = "ready" | "playing" | "paused" | "over";
const SPEED_LABEL: Record<Speed, string> = { chill: "Chill", normal: "Normal", fast: "Fast" };
const BEST_KEY = (level: Speed) => `notes-arcade-run-best-${level}`;
const CRASH_TEXT: Record<ObstacleKind, string> = {
  pothole: "Into a pothole!", puddle: "Splash! A puddle.", awning: "Bonk! A stall awning.",
  banner: "Tangled in a banner!", danfo: "Straight into a danfo!", barrow: "Over a wheelbarrow!",
};
const newSeed = () => Math.floor(Math.random() * 4294967296);

// Tournament mode (the DAVIDO-at-34 tournament, lib/tournament-server.ts): the speed is fixed, every try starts on the server (which hands out
// the tournament's seed and a run id), every step is recorded (lib/arcade/run-replay.ts), and the recording is sent when the run ends, so
// the server replays it and scores it itself.
export type RunTournament = {
  level: Speed;
  begin: () => Promise<{ runId: string; seed: number } | null>; // null: can't play now (the page says why)
  end: (runId: string, recording: string) => void;
  title: string;
  note: string;
};

const isSpeed = (v: string): v is Speed => Object.prototype.hasOwnProperty.call(SPEED_LABEL, v);

type Props = { tournament?: RunTournament; tourney?: TourneyProps; extra?: React.ReactNode };

export default function RunGame({ tournament: davido, tourney, extra }: Props = {}) {
  // The Arcade tournaments (owner, 21 Nov 2026: "start tournaments"; lib/arcade/tournament-games.ts TourneyProps) hand the game a seed
  // and run id the page already got from the server, and take the recording back through onFinish. Rather than a second recording path,
  // they're adapted into the DAVIDO shape above, so both modes step, record and send in exactly the same code. One try per run id: once
  // it's been played, begin() says no until the page gives us the next run id.
  const usedRun = useRef<string | null>(null);
  const tourneyFinish = useRef(tourney?.onFinish);
  tourneyFinish.current = tourney?.onFinish;
  const runId = tourney?.runId; const seed = tourney?.seed; const lv = tourney?.level;
  const generic = useMemo<RunTournament | undefined>(() => {
    if (runId === undefined || seed === undefined || lv === undefined) return undefined;
    return {
      level: isSpeed(lv) ? lv : "normal",
      begin: async () => {
        if (usedRun.current === runId) return null;
        usedRun.current = runId;
        return { runId, seed };
      },
      end: (_id, recording) => tourneyFinish.current?.(recording),
      title: "Tournament · same street for everyone",
      note: "Everyone runs the same street at the same speed. Up jumps, down slides, left and right change lanes.",
    };
  }, [runId, seed, lv]);
  const tournament = davido ?? generic;
  const [phase, setPhase] = useState<Phase>("ready");
  const [level, setLevel] = useState<Speed>(tournament?.level ?? "normal");
  const tRef = useRef(tournament);
  tRef.current = tournament;
  const recRef = useRef<number[]>([]);
  const runIdRef = useRef<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [hud, setHud] = useState({ score: 0, coins: 0, metres: 0 });
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [crash, setCrash] = useState<ObstacleKind | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [stepsOn, setStepsOn] = useState(false);
  const [peppered, setPeppered] = useState(false);

  // ---- Size: fill the console's width; 16:10 on desktop, taller on phones ----
  const fit = useCanvasFit((boxW, viewH) => {
    const w = Math.max(240, boxW);
    const tall = w < 560;
    return { w, h: tall ? Math.min(w * 1.4, Math.max(360, viewH * 0.72)) : w * 0.625 };
  }, { maxDpr: 2.5 });
  const canvasRef = fit.canvas;
  const sizeRef = fit.size;

  const gameRef = useRef<RunState>(createRun(1, "normal"));
  // Nana (lib/arcade/nana-run.ts, owner, 21 Nov 2026): she watches a practice run from the side, reading each state after it's stepped
  // and never writing to it, then coaches between runs. In tournament mode none of this runs: she sits out, and the run, its seed and
  // its recording are exactly what they'd be without her.
  const nanaWatch = useRef(newRunWatch());
  const bestNow = useRef(0);
  const [lastRun, setLastRun] = useState<RunStats | null>(null);
  const [runNo, setRunNo] = useState(0);
  const phaseRef = useRef<Phase>("ready");
  const inputs = useRef<RunInput[]>([]);
  const crashAt = useRef(0);
  const reduced = useRef(false);
  const soundRef = useRef(true);
  const stepsRef = useRef(false);
  const audio = useRef<{ ctx: AudioContext; out: GainNode; noise: AudioBuffer } | null>(null);

  // ---- Billboards along the street (owner, 21 Nov 2026): the Arcade's booked adverts, or "Your brand here" ----
  const boardsRef = useRef<Board[]>([]);
  const [onBoard, setOnBoard] = useState<Board | null>(null); // the advert on the board you passed last, for the link under the game
  const [booked, setBooked] = useState(false);
  useEffect(() => {
    let live = true;
    loadAds("arcade").then((l) => {
      if (!live) return;
      // 16:9 boards take only adverts with a billboard picture: the wide 1.91 picture is never stretched onto them (lib/ads.ts fitsSpot).
      const ads = weightedOrder(l.ads.filter((a) => a.provider === "notesapp" && fitsSpot(a, "billboard")));
      boardsRef.current = ads.map((a) => {
        const board: Board = { id: a.id, title: a.title, href: a.href, img: null };
        const src = a.billboard;
        if (src) { const img = new Image(); img.decoding = "async"; img.onload = () => { board.img = img; }; img.src = src; }
        return board;
      });
      setBooked(ads.length > 0);
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  const trackAd = useCallback((event: "impression" | "click", adId: string) => {
    const body = JSON.stringify({ adId, event, placement: "arcade", game: "run" });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/ads/track", new Blob([body], { type: "application/json" }));
      else fetch("/api/ads/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch { /* counting must never break a game */ }
  }, []);
  // A board counts as seen once it's big enough to read while you're running: one impression per advert per tab.
  const lastBoard = useRef<string | null>(null);
  const boardSeen = useCallback((b: Board) => {
    if (phaseRef.current !== "playing" || lastBoard.current === b.id) return;
    lastBoard.current = b.id;
    setOnBoard(b);
    const key = `adimp:arcade:billboard:${b.id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* no storage: count it anyway */ }
    trackAd("impression", b.id);
  }, [trackAd]);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  // The page's next try (a new run id) brings back the start screen, at the tournament's speed.
  useEffect(() => {
    if (!generic) return;
    setLevel(generic.level);
    if (phaseRef.current === "over") { phaseRef.current = "ready"; setPhase("ready"); }
  }, [generic]);
  useEffect(() => { bestNow.current = best; }, [best]);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
  useEffect(() => { stepsRef.current = stepsOn; }, [stepsOn]);
  useEffect(() => {
    try { setBest(Number(arcadeStore.getItem(BEST_KEY(level))) || 0); } catch { setBest(0); }
  }, [level]);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    reduced.current = !!mq?.matches;
    const on = () => { reduced.current = !!mq?.matches; };
    mq?.addEventListener?.("change", on);
    return () => mq?.removeEventListener?.("change", on);
  }, []);

  // ---- Sound: Web Audio made on the first gesture, every effect synthesised ----
  const ensureAudio = useCallback(() => {
    if (audio.current) { if (audio.current.ctx.state === "suspended") void audio.current.ctx.resume(); return audio.current; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    audio.current = { ctx, out, noise };
    return audio.current;
  }, []);

  const tone = useCallback((freq: number, endFreq: number, at: number, dur: number, vol: number, type: OscillatorType = "sine") => {
    const a = audio.current; if (!a) return;
    const o = a.ctx.createOscillator(); const g = a.ctx.createGain();
    const t = a.ctx.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.out); o.start(t); o.stop(t + dur + 0.02);
  }, []);

  const hiss = useCallback((from: number, to: number, dur: number, vol: number, filter: BiquadFilterType = "bandpass") => {
    const a = audio.current; if (!a) return;
    const src = a.ctx.createBufferSource(); src.buffer = a.noise;
    const f = a.ctx.createBiquadFilter(); f.type = filter; f.Q.value = filter === "bandpass" ? 1.2 : 0.7;
    const g = a.ctx.createGain();
    const t = a.ctx.currentTime;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(a.out); src.start(t); src.stop(t + dur + 0.02);
  }, []);

  const playEvents = useCallback((events: RunEvent[]) => {
    if (!soundRef.current || !audio.current || events.length === 0) return;
    const seen = new Set(events);
    if (seen.has("crash")) { tone(140, 38, 0, 0.38, 0.5); hiss(900, 120, 0.3, 0.35, "lowpass"); return; }
    if (seen.has("step") && stepsRef.current) hiss(1400, 700, 0.035, 0.05, "lowpass");
    if (seen.has("jump")) { hiss(500, 2200, 0.2, 0.18); tone(320, 640, 0, 0.16, 0.05, "triangle"); }
    if (seen.has("slide")) hiss(2000, 350, 0.26, 0.16);
    if (seen.has("lane")) hiss(1200, 1800, 0.06, 0.04);
    if (seen.has("coin")) { tone(1320, 1320, 0, 0.07, 0.08, "triangle"); tone(1980, 1980, 0.055, 0.12, 0.07, "triangle"); }
    if (seen.has("pepper")) [660, 880, 1100, 1320, 1760].forEach((f, i) => tone(f, f, i * 0.06, 0.16, 0.07, "triangle"));
    if (seen.has("smash")) { tone(220, 70, 0, 0.18, 0.25); hiss(1500, 300, 0.15, 0.2); }
  }, [hiss, tone]);

  // ---- Game flow ----
  const freshRun = useCallback((lv: Speed) => {
    gameRef.current = createRun(newSeed(), lv);
    inputs.current = [];
    nanaWatch.current = newRunWatch();
    setRunNo((n) => n + 1);
    setHud({ score: 0, coins: 0, metres: 0 });
    setCrash(null); setNewBest(false); setPeppered(false);
  }, []);

  const start = useCallback(() => {
    ensureAudio();
    const t = tRef.current;
    if (t) {
      // A tournament try: the server says go (and which street), then the run starts with an empty recording.
      if (starting) return;
      setStarting(true);
      void t.begin().then((go) => {
        setStarting(false);
        if (!go) return;
        freshRun(t.level);
        gameRef.current = createRun(go.seed, t.level);
        recRef.current = [];
        runIdRef.current = go.runId;
        phaseRef.current = "playing";
        setPhase("playing");
        canvasRef.current?.focus({ preventScroll: true });
      }, () => setStarting(false));
      return;
    }
    freshRun(level);
    phaseRef.current = "playing";
    setPhase("playing");
    canvasRef.current?.focus({ preventScroll: true });
  }, [ensureAudio, freshRun, level, starting]);

  const resume = useCallback(() => { ensureAudio(); phaseRef.current = "playing"; setPhase("playing"); }, [ensureAudio]);

  const changeLevel = (lv: Speed) => {
    setLevel(lv);
    freshRun(lv);
    phaseRef.current = "ready";
    setPhase("ready");
  };

  const finish = useCallback((s: RunState) => {
    phaseRef.current = "over";
    const t = tRef.current;
    if (t && runIdRef.current) { t.end(runIdRef.current, recRef.current.join(",")); runIdRef.current = null; }
    if (!t) setLastRun(runStats(s, nanaWatch.current, bestNow.current));
    crashAt.current = performance.now();
    const sc = score(s);
    setHud({ score: sc, coins: s.coins, metres: Math.floor(s.distance) });
    setCrash(s.crashedInto);
    setPeppered(false);
    setBest((b) => {
      // A tournament try isn't a practice best (it would land on the practice leaderboard; owner, 24 Nov 2026).
      if (sc <= b || tRef.current) return b;
      setNewBest(true);
      try { arcadeStore.setItem(BEST_KEY(s.level), String(sc)); } catch { /* storage blocked: keep it for this visit */ }
      return sc;
    });
    setPhase("over");
  }, []);

  const send = useCallback((input: RunInput) => {
    if (phaseRef.current === "ready") { start(); return; }
    if (phaseRef.current === "paused") { resume(); return; }
    if (phaseRef.current !== "playing") return;
    if (inputs.current.length < 3) inputs.current.push(input);
  }, [resume, start]);

  // ---- The loop: step while playing, draw always; stops while the tab is hidden ----
  useEffect(() => {
    let raf = 0; let last = 0; let hudAt = 0; let wasPeppered = false;
    const frame = (now: number) => {
      const dt = last ? Math.min(now - last, 50) : 16;
      last = now;
      if (phaseRef.current === "playing") {
        const input = inputs.current.shift() ?? "none";
        // A tournament run steps in whole milliseconds and records each step, so the server can replay it exactly.
        const d = tRef.current ? stepDt(dt) : dt;
        if (tRef.current) recRef.current.push(encodeStep(d, input));
        const next = step(gameRef.current, d, input);
        if (!tRef.current) nanaWatch.current = watchRun(nanaWatch.current, gameRef.current, next, d);
        gameRef.current = next;
        playEvents(next.events);
        if (next.over) finish(next);
        else if (now - hudAt > 100) {
          hudAt = now;
          setHud({ score: score(next), coins: next.coins, metres: Math.floor(next.distance) });
          const hot = next.pepperMs > 0;
          if (hot !== wasPeppered) { wasPeppered = hot; setPeppered(hot); }
        }
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        const { w, h, dpr } = sizeRef.current;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const shake = phaseRef.current === "over" && !reduced.current ? Math.max(0, 1 - (now - crashAt.current) / 350) : 0;
        drawScene(ctx, w, h, gameRef.current, now, reduced.current, shake, boardsRef.current, boardSeen);
      }
      raf = requestAnimationFrame(frame);
    };
    const begin = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
    const halt = () => { cancelAnimationFrame(raf); raf = 0; };
    const onVis = () => {
      if (document.hidden) {
        halt();
        if (phaseRef.current === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
      } else begin();
    };
    document.addEventListener("visibilitychange", onVis);
    if (!document.hidden) begin();
    return () => { halt(); document.removeEventListener("visibilitychange", onVis); };
  }, [finish, playEvents]);

  // ---- Keyboard ----
  useEffect(() => {
    const keys: Record<string, RunInput> = {
      ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
      ArrowUp: "jump", w: "jump", W: "jump", " ": "jump", ArrowDown: "slide", s: "slide", S: "slide",
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "SELECT" || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || (t.tagName === "BUTTON" && (e.key === " " || e.key === "Enter")))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const p = phaseRef.current;
      if (p === "over") {
        // A short wait so a held jump key doesn't restart straight away.
        if ((e.key === "Enter" || e.key === " ") && performance.now() - crashAt.current > 700) { e.preventDefault(); start(); }
        return;
      }
      const input = keys[e.key];
      if (input) { e.preventDefault(); if (!e.repeat) send(input); }
      else if (e.key === "Enter" && p !== "playing") { e.preventDefault(); send("none"); }
      else if ((e.key === "p" || e.key === "P" || e.key === "Escape") && p === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, start]);

  // ---- Touch / mouse: swipe to steer, tap to jump ----
  const swipe = useRef<{ x: number; y: number; t: number; done: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "playing") return;
    swipe.current = { x: e.clientX, y: e.clientY, t: performance.now(), done: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const sw = swipe.current; if (!sw || sw.done) return;
    const dx = e.clientX - sw.x; const dy = e.clientY - sw.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    sw.done = true;
    send(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "jump" : "slide");
  };
  const onPointerUp = () => {
    const sw = swipe.current; swipe.current = null;
    if (sw && !sw.done && performance.now() - sw.t < 350) send("jump");
  };

  // Coaching between runs; never worked out for a tournament try.
  const inTournament = !!tournament;
  const nanaTake = useMemo(() => (inTournament ? null : runCoach(lastRun)), [inTournament, lastRun]);

  const status =
    phase === "ready" ? "Press space or tap Start. Arrows or swipes to run." :
    phase === "paused" ? "Paused. Carry on when you're ready." :
    phase === "over" ? `${crash ? CRASH_TEXT[crash] : "Run over."} You scored ${hud.score}.` :
    peppered ? "Pepper! Double points, and nothing can stop you." :
    "Jump the holes, slide the awnings, dodge the danfos.";

  return (
    <ArcadeShell game={ENTRY}>
      <div className="arc-console run-console">
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">SCORE</span><strong>{String(hud.score).padStart(5, "0")}</strong></div>
          <div className="arc-stat"><span className="arc-label">COINS</span><strong className="run-coins">{hud.coins}</strong></div>
          <div className="arc-stat"><span className="arc-label">BEST</span><strong>{String(best).padStart(5, "0")}</strong></div>
          <div className="arc-spacer" />
          <label className="run-speed">
            <span className="arc-label">SPEED</span>
            <select className="arc-select" value={level} disabled={phase === "playing" || !!tournament} aria-label="Speed" onChange={(e) => changeLevel(e.target.value as Speed)}>
              {(Object.keys(SPEED_LABEL) as Speed[]).map((k) => <option key={k} value={k}>{SPEED_LABEL[k].toUpperCase()}</option>)}
            </select>
          </label>
          <button type="button" className="arc-btn-ghost" aria-pressed={soundOn} aria-label={soundOn ? "Turn sound off" : "Turn sound on"} onClick={() => { setSoundOn((v) => !v); ensureAudio(); }}>
            SOUND {soundOn ? "ON" : "OFF"}
          </button>
          <button type="button" className="arc-btn-ghost" aria-pressed={stepsOn} aria-label={stepsOn ? "Turn footsteps off" : "Turn footsteps on"} onClick={() => setStepsOn((v) => !v)}>
            STEPS {stepsOn ? "ON" : "OFF"}
          </button>
        </div>

        <div className="arc-board-wrap run-wrap" ref={fit.wrapRef}>
          <canvas
            ref={fit.canvasRef}
            className="run-canvas"
            tabIndex={0}
            role="img"
            aria-label={`Naija Run. ${hud.metres} metres, ${hud.coins} coins.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { swipe.current = null; }}
          />
          {phase === "playing" && (
            <button type="button" className="run-pause" aria-label="Pause" onClick={() => { phaseRef.current = "paused"; setPhase("paused"); }}>II</button>
          )}
          {phase === "ready" && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">{tournament ? tournament.title.toUpperCase() : `NAIJA RUN · ${SPEED_LABEL[level].toUpperCase()}`}</p>
              <h2>The street is waiting.</h2>
              <p>{tournament ? tournament.note : "Swipe or use the arrows. Up jumps, down slides, tap to jump."}</p>
              <button type="button" className="arc-btn" onClick={start} disabled={starting} aria-label="Start run">{starting ? "STARTING…" : tournament ? "START A TRY" : "START RUN"}</button>
            </div>
          )}
          {phase === "paused" && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">PAUSED</p>
              <h2>Catch your breath.</h2>
              <p>{hud.metres} m so far · {hud.coins} coins</p>
              <button type="button" className="arc-btn" onClick={resume} aria-label="Carry on running">CARRY ON</button>
            </div>
          )}
          {phase === "over" && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">{newBest ? "NEW BEST!" : "RUN OVER"}</p>
              <h2>{crash ? CRASH_TEXT[crash] : "Run over."}</h2>
              <p>Score {hud.score} · Best {best} · {hud.metres} m · {hud.coins} coins</p>
              {generic && !davido ? <p role="status"><b>{tourney?.finishedText ?? "Sending your run to be checked…"}</b></p> : <button type="button" className="arc-btn" onClick={start} disabled={starting} aria-label="Play again">{starting ? "STARTING…" : tournament ? "NEXT TRY" : "PLAY AGAIN"}</button>}
            </div>
          )}
        </div>
        <p className="arc-status" role="status">{status}</p>
        {/* Clicking Nana's buttons mustn't take focus from the street, or space would press them instead of jumping. */}
        <div onMouseDown={(e) => e.preventDefault()}>
          {tournament
            ? <ArcadeNana slug="run" context={{ mode: "tournament" }} canAsk={false} onAsk={() => null} />
            : <ArcadeNana slug="run" canAsk={phase === "paused"} onAsk={() => (phaseRef.current === "paused" ? runTip(gameRef.current) : null)} take={nanaTake} resetKey={runNo} />}
        </div>
        {extra}
        <p className="run-boards">
          {booked && onBoard
            ? <>On the billboards: <a href={onBoard.href} target="_blank" rel="sponsored noopener noreferrer" onClick={() => trackAd("click", onBoard.id)}>{onBoard.title} ↗</a> <small>SPONSORED</small></>
            : <>Your brand on these billboards: <a href="/arcade/partners">partner with Notes Arcade ↗</a></>}
        </p>
      </div>
      <style jsx global>{`
        .run-wrap { touch-action:none; user-select:none; -webkit-user-select:none; background:#1e2147; }
        .run-canvas { display:block; max-width:100%; outline:none; cursor:pointer; touch-action:none; }
        .run-canvas:focus-visible { outline:2px solid var(--arc-deep); outline-offset:-2px; }
        .run-speed { display:flex; align-items:center; gap:8px; }
        .run-coins { color:#b8860b !important; }
        .run-boards { margin:4px 2px 0; color:#58645c; font:600 11px ui-monospace,monospace; letter-spacing:.03em; }
        .run-boards a { color:var(--arc-deep, #2e5a1c); font-weight:800; text-decoration:underline; text-underline-offset:2px; }
        .run-boards small { margin-left:6px; color:#929b94; font-size:9px; letter-spacing:.1em; }
        .run-pause { position:absolute; top:10px; right:10px; z-index:4; width:34px; height:34px; border:1px solid #ffffff40; border-radius:8px; background:#14231f99; color:#fff; font:700 11px ui-monospace,monospace; letter-spacing:.05em; cursor:pointer; }
        .run-pause:focus-visible { outline:2px solid var(--arc-green); outline-offset:2px; }
        @media(max-width:560px) { .run-console .arc-head { gap:10px 14px; } .run-console .arc-stat strong { font-size:17px; } }
      `}</style>
    </ArcadeShell>
  );
}

// ======================= Drawing =======================
// A simple pinhole camera a few metres behind the runner, looking down the street. World x is sideways (metres from the
// middle of the road), y is up, and dz is how far in front of the camera something is.

const CAM_BACK = 4.2; // camera distance behind the runner
const FAR = 120;
const NEAR = 0.6;
const ROAD_HALF = LANE_WIDTH * 1.5 + 0.3;
const WALK = 3.2; // pavement width
const BLOCK = 9; // building plot length
const FACADES = ["#5b4766", "#6e4c55", "#47546b", "#7a5d4c", "#4f5e4a", "#6a5a73"];
const AWNINGS = [["#ff816d", "#fff4e6"], ["#9bd34d", "#f7f7f2"], ["#f2c230", "#3a6ea5"]];

type View = { w: number; h: number; f: number; hz: number; camH: number; camX: number; dist: number };
type Board = { id: string; title: string; href: string; img: HTMLImageElement | null };
const BOARD_EVERY = 4; // a roadside billboard every 4th block, alternating sides
const BOARD_W = 6.4; const BOARD_H = 3.6; // 16:9, like a Notes Life billboard picture
type P = { x: number; y: number; s: number };

function proj(v: View, x: number, y: number, dz: number): P {
  const d = Math.max(dz, NEAR);
  const s = v.f / d;
  return { x: v.w / 2 + (x - v.camX) * s, y: v.hz + (v.camH - y) * s, s };
}
const dzOf = (v: View, z: number) => z - v.dist + CAM_BACK;

function poly(ctx: CanvasRenderingContext2D, pts: P[], fill: string | CanvasGradient) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// Ground quad between two depths and two x positions.
function groundQuad(ctx: CanvasRenderingContext2D, v: View, x0: number, x1: number, dz0: number, dz1: number, fill: string | CanvasGradient, y = 0) {
  const a = Math.max(dz0, NEAR); const b = Math.max(dz1, NEAR);
  if (b <= NEAR) return;
  poly(ctx, [proj(v, x0, y, a), proj(v, x1, y, a), proj(v, x1, y, b), proj(v, x0, y, b)], fill);
}

// A box from (x0,y0,dz0) to (x1,y1,dz1): draws the faces the camera can see, far ones first.
function box(ctx: CanvasRenderingContext2D, v: View, x0: number, x1: number, y0: number, y1: number, dz0: number, dz1: number, c: { front: string; side: string; top: string }) {
  const n = Math.max(dz0, NEAR); const f = Math.max(dz1, NEAR);
  if (f <= NEAR) return;
  if (v.camH > y1) poly(ctx, [proj(v, x0, y1, n), proj(v, x1, y1, n), proj(v, x1, y1, f), proj(v, x0, y1, f)], c.top);
  if (v.camX < x0) poly(ctx, [proj(v, x0, y0, n), proj(v, x0, y0, f), proj(v, x0, y1, f), proj(v, x0, y1, n)], c.side);
  if (v.camX > x1) poly(ctx, [proj(v, x1, y0, n), proj(v, x1, y0, f), proj(v, x1, y1, f), proj(v, x1, y1, n)], c.side);
  if (dz0 > NEAR) poly(ctx, [proj(v, x0, y0, n), proj(v, x1, y0, n), proj(v, x1, y1, n), proj(v, x0, y1, n)], c.front);
}

const laneX = (lane: number) => (lane - 1) * LANE_WIDTH;
const hash = (a: number, b = 0) => nextRandom((a * 2654435761 + b * 40503 + 7) >>> 0)[0];

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, s: RunState, now: number, still: boolean, shake: number, boards: Board[] = [], seen?: (b: Board) => void) {
  // Camera: road fills ~84% of the width at the runner; horizon high enough that phones see a long way down the street.
  const f = (0.84 * w * CAM_BACK) / (2 * ROAD_HALF);
  const runnerY = h * 0.9;
  const hz = h * (h > w ? 0.3 : 0.36);
  const camH = ((runnerY - hz) * CAM_BACK) / f;
  const glide = Math.min(1, s.laneMs / LANE_GLIDE_MS);
  const ease = 1 - (1 - glide) * (1 - glide);
  const rx = laneX(s.laneFrom) + (laneX(s.lane) - laneX(s.laneFrom)) * ease;
  const v: View = { w, h, f, hz, camH, camX: rx * 0.35, dist: s.distance };

  ctx.save();
  if (shake > 0) ctx.translate((hash(Math.floor(now / 30)) - 0.5) * 14 * shake, (hash(Math.floor(now / 30), 1) - 0.5) * 10 * shake);

  // Sky at dusk, a low sun, and a far skyline.
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, "#1e2147"); sky.addColorStop(0.45, "#5b3a6e"); sky.addColorStop(0.8, "#e0704f"); sky.addColorStop(1, "#f7b267");
  ctx.fillStyle = sky; ctx.fillRect(-20, -20, w + 40, hz + 22);
  const sunX = w * 0.68; const sunR = Math.max(18, w * 0.06);
  const glow = ctx.createRadialGradient(sunX, hz, sunR * 0.5, sunX, hz, sunR * 3.5);
  glow.addColorStop(0, "#ffd58aaa"); glow.addColorStop(1, "#ffd58a00");
  ctx.fillStyle = glow; ctx.fillRect(sunX - sunR * 4, hz - sunR * 4, sunR * 8, sunR * 4);
  ctx.fillStyle = "#ffcf7a"; ctx.beginPath(); ctx.arc(sunX, hz, sunR, Math.PI, 0); ctx.fill();
  const drift = (s.distance * 0.15) % 60;
  ctx.fillStyle = "#3d2f55";
  for (let i = -1; i < w / 30 + 2; i += 1) {
    const idx = i + Math.floor(s.distance * 0.15 / 60) * 2;
    const bh = 10 + hash(idx, 3) * h * 0.08;
    ctx.fillRect(i * 30 - drift, hz - bh, 26, bh + 1);
  }
  for (let i = 0; i < 6; i += 1) { // two or three tall towers on the island
    const tx = ((i * 0.19 + 0.07) * w - drift * 0.4 + w) % w; const th = h * (0.1 + hash(i, 9) * 0.1);
    ctx.fillStyle = "#33284a"; ctx.fillRect(tx, hz - th, 14 + hash(i, 4) * 10, th);
  }

  // Ground: a base colour under everything (so clipped walls never show a gap), pavements, kerbs, road and lane marks.
  ctx.fillStyle = "#4a3d4c"; ctx.fillRect(-20, hz, w + 40, h - hz + 20);
  const walk = ctx.createLinearGradient(0, hz, 0, h);
  walk.addColorStop(0, "#6d5a63"); walk.addColorStop(1, "#8e7b72");
  groundQuad(ctx, v, -ROAD_HALF - WALK, -ROAD_HALF, NEAR, FAR, walk);
  groundQuad(ctx, v, ROAD_HALF, ROAD_HALF + WALK, NEAR, FAR, walk);
  const road = ctx.createLinearGradient(0, hz, 0, h);
  road.addColorStop(0, "#4a4258"); road.addColorStop(0.35, "#33313d"); road.addColorStop(1, "#24252b");
  groundQuad(ctx, v, -ROAD_HALF, ROAD_HALF, NEAR, FAR, road);
  const firstZ = Math.floor((s.distance - CAM_BACK) / 2) * 2;
  for (let z = firstZ; dzOf(v, z) < FAR; z += 2) { // yellow-and-black kerbs
    const c = Math.round(z / 2) % 2 === 0 ? "#f2c230" : "#22242a";
    groundQuad(ctx, v, -ROAD_HALF - 0.25, -ROAD_HALF, dzOf(v, z), dzOf(v, z + 2), c, 0.01);
    groundQuad(ctx, v, ROAD_HALF, ROAD_HALF + 0.25, dzOf(v, z), dzOf(v, z + 2), c, 0.01);
  }
  const dashZ = Math.floor((s.distance - CAM_BACK) / 8) * 8;
  for (let z = dashZ; dzOf(v, z) < FAR; z += 8) {
    for (const x of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) groundQuad(ctx, v, x - 0.07, x + 0.07, dzOf(v, z), dzOf(v, z + 3), "#e9e3d488", 0.01);
  }

  // Buildings along both pavements, far first.
  const firstBlock = Math.floor((s.distance - CAM_BACK) / BLOCK);
  const lastBlock = Math.floor((s.distance + FAR) / BLOCK);
  for (let b = lastBlock; b >= firstBlock; b -= 1) {
    for (const side of [-1, 1]) {
      drawBuilding(ctx, v, b, side);
      if (b % BOARD_EVERY === 0 && side === (Math.floor(b / BOARD_EVERY) % 2 === 0 ? 1 : -1)) {
        const k = Math.floor(b / BOARD_EVERY);
        drawBillboard(ctx, v, b, side, boards.length ? boards[((k % boards.length) + boards.length) % boards.length] : null, seen);
      }
    }
  }
  ctx.globalAlpha = 1;
  // A soft glow down the far end of the street, between the buildings, so far things fade in rather than pop.
  const hl = proj(v, -ROAD_HALF - WALK, 0, 45).x; const hr = proj(v, ROAD_HALF + WALK, 0, 45).x;
  const haze = ctx.createLinearGradient(0, hz - h * 0.03, 0, hz + h * 0.04);
  haze.addColorStop(0, "#f0a07000"); haze.addColorStop(0.45, "#f0a07099"); haze.addColorStop(1, "#f0a07000");
  ctx.fillStyle = haze; ctx.fillRect(hl, hz - h * 0.03, hr - hl, h * 0.07);

  // Everything on the road, sorted far to near, with the runner in their place.
  type D = { dz: number; draw: () => void };
  const list: D[] = [];
  for (const o of s.obstacles) {
    const dz = dzOf(v, o.z);
    if (dz + OBSTACLES[o.kind].length > NEAR && dz < FAR) list.push({ dz, draw: () => drawObstacle(ctx, v, o, dz, now, still) });
  }
  for (const p of s.pickups) {
    const dz = dzOf(v, p.z);
    if (!p.taken && dz > NEAR + 0.3 && dz < FAR) list.push({ dz, draw: () => drawPickup(ctx, v, p, dz, now, still) });
  }
  const lampZ = Math.floor(s.distance / 25) * 25;
  for (let z = lampZ; dzOf(v, z) < FAR; z += 25) {
    const dz = dzOf(v, z);
    if (dz > NEAR) for (const side of [-1, 1]) list.push({ dz, draw: () => drawLamp(ctx, v, side * (ROAD_HALF + 0.7), dz) });
  }
  list.push({ dz: CAM_BACK + 0.001, draw: () => drawRunner(ctx, v, s, rx, now, still) });
  list.sort((a, b) => b.dz - a.dz);
  for (const d of list) {
    ctx.globalAlpha = d.dz > FAR - 25 ? Math.max(0, (FAR - d.dz) / 25) : 1;
    d.draw();
  }
  ctx.globalAlpha = 1;

  // Pepper timer along the top.
  if (s.pepperMs > 0) {
    ctx.fillStyle = "#00000055"; ctx.fillRect(12, 12, w * 0.3, 6);
    ctx.fillStyle = "#ff5a3c"; ctx.fillRect(12, 12, (w * 0.3 * s.pepperMs) / PEPPER_MS, 6);
    ctx.fillStyle = "#fff"; ctx.font = "600 10px ui-monospace, monospace"; ctx.fillText("PEPPER ×2", 12, 32);
  }
  ctx.restore();
}

function drawBuilding(ctx: CanvasRenderingContext2D, v: View, b: number, side: number) {
  const z0 = b * BLOCK + 0.6; const z1 = (b + 1) * BLOCK - 0.6;
  const dz0 = dzOf(v, z0); const dz1 = dzOf(v, z1);
  if (dz1 <= NEAR || dz0 > FAR) return;
  ctx.globalAlpha = dz0 > FAR - 30 ? Math.max(0, (FAR - dz0) / 30) : 1;
  const x = side * (ROAD_HALF + WALK);
  const height = buildingHeight(b, side);
  const col = FACADES[Math.floor(hash(b, side + 11) * FACADES.length)];
  const n = Math.max(dz0, NEAR);
  // Facade facing the road, and the end wall facing us.
  poly(ctx, [proj(v, x, 0, n), proj(v, x, 0, dz1), proj(v, x, height, dz1), proj(v, x, height, n)], col);
  if (dz0 > NEAR) poly(ctx, [proj(v, x, 0, dz0), proj(v, x + side * 8, 0, dz0), proj(v, x + side * 8, height, dz0), proj(v, x, height, dz0)], shade(col, -0.25));
  // Shop sign band and lit windows above it.
  const sign = AWNINGS[Math.floor(hash(b, side + 2) * AWNINGS.length)][0];
  const sx = x - side * 0.02;
  if (dz0 > NEAR || dz1 > NEAR + 1) {
    const a = Math.max(dz0 + 0.8, NEAR); const c = Math.max(dz1 - 0.8, NEAR);
    poly(ctx, [proj(v, sx, 2.6, a), proj(v, sx, 2.6, c), proj(v, sx, 3.2, c), proj(v, sx, 3.2, a)], sign);
  }
  for (let floor = 0; 4 + floor * 3 + 1.4 < height; floor += 1) {
    for (let k = 0; k < 3; k += 1) {
      const wz0 = z0 + 1 + k * 2.6; const wa = dzOf(v, wz0); const wb = dzOf(v, wz0 + 1.3);
      if (wa <= NEAR) continue;
      const lit = hash(b * 7 + k, floor + side * 3) > 0.45;
      const y0 = 4 + floor * 3;
      poly(ctx, [proj(v, sx, y0, wa), proj(v, sx, y0, wb), proj(v, sx, y0 + 1.4, wb), proj(v, sx, y0 + 1.4, wa)], lit ? "#ffd27a" : "#2b2440");
    }
  }
}

const buildingHeight = (b: number, side: number) => 5 + Math.floor(hash(b, side + 5) * 4) * 3; // one to three floors above the shop

// A roadside billboard on two posts at the edge of the pavement, above the shop signs, facing down the street so the runner
// sees it grow as they come up to it: the advert's picture (cropped to fill), or "YOUR BRAND HERE" when nothing is booked or
// the picture hasn't loaded yet.
function drawBillboard(ctx: CanvasRenderingContext2D, v: View, b: number, side: number, board: Board | null, seen?: (b: Board) => void) {
  const dz = dzOf(v, b * BLOCK + 1.4);
  if (dz <= NEAR + 0.5 || dz > FAR) return;
  const y0 = 4; // clear of the shop signs (up to 3.2 m)
  const xn = side * (ROAD_HALF + 0.9); const xf = xn + side * BOARD_W;
  const tl = proj(v, Math.min(xn, xf), y0 + BOARD_H, dz); const br = proj(v, Math.max(xn, xf), y0, dz);
  const bw = br.x - tl.x; const bh = br.y - tl.y;
  if (bw < 2 || br.x < 0 || tl.x > v.w) return;
  // Two posts down to the pavement.
  ctx.strokeStyle = "#1b1922"; ctx.lineWidth = Math.max(1, 0.18 * br.s);
  for (const t of [0.12, 0.45]) {
    const x = xn + side * BOARD_W * t;
    const a = proj(v, x, 0, dz); const c = proj(v, x, y0, dz);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  }
  // Frame, then the picture.
  const pad = Math.max(1, 0.16 * br.s);
  ctx.fillStyle = "#15131c"; ctx.fillRect(tl.x - pad, tl.y - pad, bw + pad * 2, bh + pad * 2);
  const img = board?.img;
  if (img && img.naturalWidth > 0) {
    const want = bw / bh; const have = img.naturalWidth / img.naturalHeight;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (have > want) { sw = sh * want; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / want; sy = (img.naturalHeight - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, tl.x, tl.y, bw, bh);
  } else {
    const g = ctx.createLinearGradient(tl.x, tl.y, br.x, br.y);
    g.addColorStop(0, "#9bd34d"); g.addColorStop(1, "#4f8a2b");
    ctx.fillStyle = g; ctx.fillRect(tl.x, tl.y, bw, bh);
    if (bw > 36) {
      ctx.fillStyle = "#14231f"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.max(6, bh * 0.2)}px ui-monospace, monospace`;
      const line1 = board ? board.title.toUpperCase().slice(0, 22) : "YOUR BRAND HERE";
      ctx.fillText(line1, tl.x + bw / 2, tl.y + bh * 0.45, bw * 0.9);
      ctx.font = `700 ${Math.max(5, bh * 0.1)}px ui-monospace, monospace`;
      ctx.fillText(board ? "NOTES ADS" : "NOTES ARCADE · PARTNER WITH US", tl.x + bw / 2, tl.y + bh * 0.72, bw * 0.9);
      ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
    }
  }
  if (bw > 90) { // the sponsored tag, as on every Arcade advert
    const fs = Math.max(6, bh * 0.07);
    ctx.font = `700 ${fs}px ui-monospace, monospace`;
    const tw = ctx.measureText("SPONSORED").width;
    ctx.fillStyle = "#000000aa"; ctx.fillRect(br.x - tw - fs * 1.2, tl.y + fs * 0.4, tw + fs * 0.8, fs * 1.4);
    ctx.fillStyle = "#fff"; ctx.fillText("SPONSORED", br.x - tw - fs * 0.8, tl.y + fs * 1.45);
  }
  // A lamp over the board so it reads at dusk.
  const lamp = ctx.createLinearGradient(0, tl.y, 0, br.y);
  lamp.addColorStop(0, "#ffe9b033"); lamp.addColorStop(1, "#ffe9b000");
  ctx.fillStyle = lamp; ctx.fillRect(tl.x, tl.y, bw, bh);
  if (board && seen && bw > v.w * 0.12) seen(board);
}

function drawLamp(ctx: CanvasRenderingContext2D, v: View, x: number, dz: number) {
  const base = proj(v, x, 0, dz); const top = proj(v, x, 5, dz);
  ctx.strokeStyle = "#2a2733"; ctx.lineWidth = Math.max(1, 0.12 * base.s);
  ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
  const head = proj(v, x - Math.sign(x) * 0.8, 5, dz);
  ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(head.x, head.y); ctx.stroke();
  const r = 1.6 * head.s;
  const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, r);
  g.addColorStop(0, "#fff1c4"); g.addColorStop(0.15, "#ffd27acc"); g.addColorStop(1, "#ffd27a00");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(head.x, head.y, r, 0, Math.PI * 2); ctx.fill();
}

function drawObstacle(ctx: CanvasRenderingContext2D, v: View, o: Obstacle, dz: number, now: number, still: boolean) {
  const len = OBSTACLES[o.kind].length;
  let x = laneX(o.lane);
  if (o.hit) { // knocked aside by a peppered runner
    x += (o.lane === 0 ? -1 : 1) * 1.2;
    ctx.globalAlpha *= 0.55;
  }
  const dz1 = dz + len;
  switch (o.kind) {
    case "pothole":
    case "puddle": {
      const a = proj(v, x, 0, Math.max(dz, NEAR)); const b = proj(v, x, 0, dz1);
      const cy = (a.y + b.y) / 2; const ry = Math.max(1, (a.y - b.y) / 2); const rx = 0.8 * ((a.s + b.s) / 2) * (o.kind === "puddle" ? 1.15 : 1);
      ctx.beginPath(); ctx.ellipse(a.x + (b.x - a.x) / 2, cy, rx, ry, 0, 0, Math.PI * 2);
      if (o.kind === "pothole") {
        const g = ctx.createRadialGradient(a.x, cy, 0, a.x, cy, rx);
        g.addColorStop(0, "#0d0d10"); g.addColorStop(0.75, "#1a1a1f"); g.addColorStop(1, "#5a5560");
        ctx.fillStyle = g; ctx.fill();
      } else {
        const g = ctx.createLinearGradient(0, b.y, 0, a.y);
        g.addColorStop(0, "#f2a07a"); g.addColorStop(0.5, "#6f6a9a"); g.addColorStop(1, "#3e4f73");
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = "#ffffff55"; ctx.lineWidth = 1; ctx.stroke();
        const ripple = still ? 0.5 : (now / 900) % 1;
        ctx.beginPath(); ctx.ellipse(a.x, cy, rx * ripple, ry * ripple, 0, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,255,255,${0.4 * (1 - ripple)})`; ctx.stroke();
      }
      break;
    }
    case "awning": {
      const [c1, c2] = AWNINGS[o.id % AWNINGS.length];
      const w2 = LANE_WIDTH / 2 - 0.1;
      for (const px of [x - w2, x + w2]) { // poles
        const p0 = proj(v, px, 0, dz); const p1 = proj(v, px, 1.55, dz);
        ctx.strokeStyle = "#3b3030"; ctx.lineWidth = Math.max(1, 0.08 * p0.s);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      box(ctx, v, x - w2 - 0.1, x + w2 + 0.1, 1.5, 1.6, dz, dz1, { front: c1, side: c1, top: shade(c1, -0.15) });
      // Striped valance hanging down to 1.15 m: slide under it.
      const stripes = 6; const sw = (2 * w2 + 0.2) / stripes;
      for (let i = 0; i < stripes; i += 1) {
        const xa = x - w2 - 0.1 + i * sw;
        poly(ctx, [proj(v, xa, 1.15, dz), proj(v, xa + sw, 1.15, dz), proj(v, xa + sw, 1.5, dz), proj(v, xa, 1.5, dz)], i % 2 ? c2 : c1);
      }
      // A few goods on a little table behind.
      box(ctx, v, x - 0.6, x + 0.6, 0, 0.7, dz + 0.4, dz1, { front: "#6b4a2b", side: "#57391f", top: "#7d5a37" });
      for (let i = 0; i < 3; i += 1) {
        const q = proj(v, x - 0.4 + i * 0.4, 0.82, dz + 0.6);
        ctx.fillStyle = ["#e8412c", "#f2c230", "#9bd34d"][i]; ctx.beginPath(); ctx.arc(q.x, q.y, 0.12 * q.s, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case "banner": {
      const w2 = LANE_WIDTH / 2 - 0.05;
      for (const px of [x - w2, x + w2]) {
        const p0 = proj(v, px, 0, dz); const p1 = proj(v, px, 2.1, dz);
        ctx.strokeStyle = "#2c2a30"; ctx.lineWidth = Math.max(1, 0.07 * p0.s);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      const sway = still ? 0 : Math.sin(now / 400 + o.id) * 0.04;
      const tl = proj(v, x - w2 + 0.1, 1.75, dz); const br = proj(v, x + w2 - 0.1, 1.1 + sway, dz);
      const r = proj(v, x - w2, 2.05, dz); const r2 = proj(v, x + w2, 2.05, dz);
      ctx.strokeStyle = "#2c2a30"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(tl.x, tl.y); ctx.moveTo(r2.x, r2.y); ctx.lineTo(br.x, tl.y); ctx.stroke();
      ctx.fillStyle = "#ff816d"; ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.fillStyle = "#17251f"; ctx.fillRect(tl.x, br.y - (br.y - tl.y) * 0.18, br.x - tl.x, (br.y - tl.y) * 0.18);
      const fs = Math.max(6, (br.y - tl.y) * 0.45);
      ctx.fillStyle = "#fff8ec"; ctx.font = `700 ${fs}px Georgia, serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("MEGA SALE", (tl.x + br.x) / 2, tl.y + (br.y - tl.y) * 0.42);
      ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
      break;
    }
    case "danfo": {
      const hw = 0.95;
      // Shadow, wheels, then the body.
      groundQuad(ctx, v, x - hw - 0.1, x + hw + 0.1, dz - 0.2, dz1, "#00000040", 0.005);
      box(ctx, v, x - hw, x + hw, 0.35, 2.4, dz, dz1, { front: "#f2c230", side: "#d9a920", top: "#f6d465" });
      if (dz > NEAR) {
        const stripe = (y0: number, y1: number, c: string) => poly(ctx, [proj(v, x - hw, y0, dz), proj(v, x + hw, y0, dz), proj(v, x + hw, y1, dz), proj(v, x - hw, y1, dz)], c);
        stripe(1.05, 1.15, "#17251f"); stripe(0.75, 0.85, "#17251f");
        poly(ctx, [proj(v, x - hw + 0.15, 1.4, dz), proj(v, x + hw - 0.15, 1.4, dz), proj(v, x + hw - 0.15, 2.2, dz), proj(v, x - hw + 0.15, 2.2, dz)], "#2b3346");
        poly(ctx, [proj(v, x - hw + 0.2, 1.9, dz), proj(v, x - 0.2, 1.9, dz), proj(v, x - 0.3, 2.15, dz), proj(v, x - hw + 0.25, 2.15, dz)], "#ffffff22");
        for (const tx of [x - hw + 0.12, x + hw - 0.32]) poly(ctx, [proj(v, tx, 0.5, dz), proj(v, tx + 0.2, 0.5, dz), proj(v, tx + 0.2, 0.7, dz), proj(v, tx, 0.7, dz)], "#ff4b3a");
        poly(ctx, [proj(v, x - 0.35, 0.42, dz), proj(v, x + 0.35, 0.42, dz), proj(v, x + 0.35, 0.62, dz), proj(v, x - 0.35, 0.62, dz)], "#f7f7f2");
        for (const wx of [x - hw + 0.25, x + hw - 0.25]) { const q = proj(v, wx, 0.35, dz + 0.3); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.ellipse(q.x, q.y, 0.16 * q.s, 0.32 * q.s, 0, 0, Math.PI * 2); ctx.fill(); }
      }
      break;
    }
    case "barrow": {
      groundQuad(ctx, v, x - 0.6, x + 0.6, dz, dz1, "#00000035", 0.005);
      // Handles toward us, the tray, a wheel at the far end, and a load of yams.
      for (const hx of [x - 0.35, x + 0.35]) {
        const a = proj(v, hx, 0.75, dz); const b = proj(v, hx, 0.5, dz + 0.5);
        ctx.strokeStyle = "#5b3a20"; ctx.lineWidth = Math.max(1, 0.07 * a.s); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        const l = proj(v, hx, 0, dz + 0.45); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(l.x, l.y); ctx.stroke();
      }
      const wq = proj(v, x, 0.25, dz1 - 0.15); ctx.fillStyle = "#1c1c20"; ctx.beginPath(); ctx.arc(wq.x, wq.y, 0.25 * wq.s, 0, Math.PI * 2); ctx.fill();
      box(ctx, v, x - 0.5, x + 0.5, 0.4, 0.85, dz + 0.4, dz1 - 0.1, { front: "#4f7d3a", side: "#3f672e", top: "#2e3b2a" });
      for (let i = 0; i < 4; i += 1) {
        const q = proj(v, x - 0.25 + (i % 2) * 0.5, 0.92 + (i > 1 ? 0.12 : 0), dz + 0.6 + (i > 1 ? 0.3 : 0));
        ctx.fillStyle = i % 2 ? "#8a5a33" : "#7a4b28"; ctx.beginPath(); ctx.ellipse(q.x, q.y, 0.22 * q.s, 0.11 * q.s, 0.3, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
  }
}

function drawPickup(ctx: CanvasRenderingContext2D, v: View, p: Pickup, dz: number, now: number, still: boolean) {
  const x = laneX(p.lane);
  const bob = still ? 0 : Math.sin(now / 250 + p.id) * 0.08;
  const shadow = proj(v, x, 0, dz);
  ctx.fillStyle = "#00000033"; ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y, 0.25 * shadow.s, 0.06 * shadow.s, 0, 0, Math.PI * 2); ctx.fill();
  if (p.kind === "coin") {
    const q = proj(v, x, 0.7 + bob, dz);
    const r = 0.28 * q.s; const spin = still ? 1 : Math.abs(Math.cos(now / 180 + p.id * 0.7));
    ctx.fillStyle = "#b8860b"; ctx.beginPath(); ctx.ellipse(q.x, q.y, Math.max(1, r * spin), r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f6c945"; ctx.beginPath(); ctx.ellipse(q.x, q.y, Math.max(0.5, r * spin * 0.78), r * 0.78, 0, 0, Math.PI * 2); ctx.fill();
    if (spin > 0.5) { ctx.fillStyle = "#fff3b8"; ctx.beginPath(); ctx.ellipse(q.x - r * 0.25 * spin, q.y - r * 0.3, r * 0.15 * spin, r * 0.15, 0, 0, Math.PI * 2); ctx.fill(); }
  } else {
    const q = proj(v, x, 0.85 + bob, dz); const u = q.s;
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 0.8 * u);
    g.addColorStop(0, "#ff7a4a88"); g.addColorStop(1, "#ff7a4a00");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, 0.8 * u, 0, Math.PI * 2); ctx.fill();
    // A fat scotch-bonnet-ish pepper: red body, green cap.
    ctx.fillStyle = "#e8412c"; ctx.beginPath(); ctx.ellipse(q.x, q.y + 0.05 * u, 0.26 * u, 0.22 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff6f55"; ctx.beginPath(); ctx.ellipse(q.x - 0.08 * u, q.y - 0.02 * u, 0.07 * u, 0.1 * u, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4f9a2e"; ctx.beginPath(); ctx.ellipse(q.x, q.y - 0.17 * u, 0.14 * u, 0.05 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3f7d22"; ctx.lineWidth = Math.max(1, 0.04 * u); ctx.beginPath(); ctx.moveTo(q.x, q.y - 0.2 * u); ctx.quadraticCurveTo(q.x + 0.03 * u, q.y - 0.32 * u, q.x + 0.1 * u, q.y - 0.34 * u); ctx.stroke();
  }
}

function drawRunner(ctx: CanvasRenderingContext2D, v: View, s: RunState, x: number, now: number, still: boolean) {
  const lift = jumpHeight(s) * 1.05;
  const g = proj(v, x, 0, CAM_BACK);
  const u = g.s; // pixels per metre at the runner
  const sliding = s.slideMs >= 0;
  ctx.fillStyle = "#00000055";
  ctx.beginPath(); ctx.ellipse(g.x, g.y, 0.42 * u * (1 - lift * 0.3), 0.1 * u, 0, 0, Math.PI * 2); ctx.fill();
  const P = (dx: number, y: number) => { const q = proj(v, x + dx, y + lift, CAM_BACK); return [q.x, q.y] as const; };
  const line = (a: readonly [number, number], b: readonly [number, number], width: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = width * u; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  };
  const skin = "#5a3825"; const shirt = "#9bd34d"; const shorts = "#2f3e60";

  if (s.pepperMs > 0) { // a warm glow and a few sparks while peppered
    const c = P(0, sliding ? 0.5 : 1.0);
    const gl = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], 1.2 * u);
    gl.addColorStop(0, "#ff7a4a66"); gl.addColorStop(1, "#ff7a4a00");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(c[0], c[1], 1.2 * u, 0, Math.PI * 2); ctx.fill();
    if (!still) for (let i = 0; i < 5; i += 1) {
      const t = ((now / 300 + i / 5) % 1);
      const sp = P((hash(i, Math.floor(now / 300)) - 0.5) * 0.8, 0.3 + t * 1.4);
      ctx.fillStyle = `rgba(255,${120 + i * 20},60,${1 - t})`; ctx.beginPath(); ctx.arc(sp[0], sp[1] + t * 0.6 * u, 0.05 * u, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (s.over) ctx.globalAlpha *= 0.95;
  if (sliding) {
    // Low slide: legs out in front, body leaning back, one hand trailing.
    line(P(-0.15, 0.25), P(-0.2, 0.08), 0.15, shorts);
    line(P(0.15, 0.25), P(0.22, 0.1), 0.15, shorts);
    poly(ctx, [P(-0.28, 0.25), P(0.28, 0.25), P(0.24, 0.72), P(-0.24, 0.72)].map(([px, py]) => ({ x: px, y: py, s: u })), shirt);
    line(P(-0.28, 0.6), P(-0.5, 0.2), 0.1, skin);
    line(P(0.28, 0.6), P(0.48, 0.35), 0.1, skin);
    const h = P(0, 0.88); ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(h[0], h[1], 0.16 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#17251f"; ctx.beginPath(); ctx.arc(h[0], h[1] - 0.04 * u, 0.16 * u, Math.PI, 0); ctx.fill();
    return;
  }
  const phase = still ? 0 : (s.distance / STRIDE_M) * Math.PI;
  const airborne = s.jumpMs >= 0;
  const swing = airborne ? 0.35 : Math.sin(phase);
  // Legs (seen from behind, so the stride shows as feet lifting in turn).
  const legL = airborne ? 0.3 : Math.max(0, swing) * 0.32;
  const legR = airborne ? 0.15 : Math.max(0, -swing) * 0.32;
  line(P(-0.13, 0.95), P(-0.15, legL), 0.16, shorts);
  line(P(0.13, 0.95), P(0.15, legR), 0.16, shorts);
  line(P(-0.15, legL + 0.02), P(-0.15, legL), 0.2, "#f7f7f2"); // trainers
  line(P(0.15, legR + 0.02), P(0.15, legR), 0.2, "#f7f7f2");
  // Shirt with a little coral pattern, and a backpack.
  const torso = [P(-0.3, 0.9), P(0.3, 0.9), P(0.27, 1.5), P(-0.27, 1.5)].map(([px, py]) => ({ x: px, y: py, s: u }));
  poly(ctx, torso, shirt);
  ctx.fillStyle = "#ff816d";
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 2; j += 1) { const d = P(-0.16 + i * 0.16, 1.05 + j * 0.25); ctx.beginPath(); ctx.arc(d[0], d[1], 0.035 * u, 0, Math.PI * 2); ctx.fill(); }
  poly(ctx, [P(-0.18, 1.0), P(0.18, 1.0), P(0.16, 1.38), P(-0.16, 1.38)].map(([px, py]) => ({ x: px, y: py, s: u })), "#17251f");
  // Arms swing against the legs.
  const armL = airborne ? 1.75 : 1.05 + Math.max(0, -swing) * 0.3;
  const armR = airborne ? 1.75 : 1.05 + Math.max(0, swing) * 0.3;
  line(P(-0.3, 1.45), P(-0.42, armL), 0.1, skin);
  line(P(0.3, 1.45), P(0.42, armR), 0.1, skin);
  const h = P(0, 1.68);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(h[0], h[1], 0.17 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#17251f"; ctx.beginPath(); ctx.arc(h[0], h[1] - 0.03 * u, 0.17 * u, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  if (s.over) { // little stars after a bump
    for (let i = 0; i < 3; i += 1) {
      const a = now / 200 + (i * Math.PI * 2) / 3; const sp = P(Math.cos(a) * 0.3, 1.95 + Math.sin(a) * 0.06);
      ctx.fillStyle = "#f6c945"; ctx.beginPath(); ctx.arc(sp[0], sp[1], 0.05 * u, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
