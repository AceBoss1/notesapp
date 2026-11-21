"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/games/ArcadeShell";
import { useCanvasFit, type CanvasSize } from "@/components/games/useCanvasFit";
import { ENTRY } from "@/lib/arcade/puffpuff.entry";
import { arcadeStore } from "@/lib/arcade/store";
import {
  DYING_MS, MAZES, actorPos, initialState, mazeForLevel, step, type Dir, type GameEvent, type Goat, type GoatKind, type Maze, type PuffState, type Speed,
} from "@/lib/arcade/puffpuff";

// Puff-Puff Rush: the canvas, controls and sounds. All the rules live in lib/arcade/puffpuff.ts.

type UiPhase = "idle" | "running" | "paused";
type Hud = { score: number; lives: number; level: number; phase: PuffState["phase"]; status: string };

const BEST_KEY = "puffpuff.best";
const COLS = MAZES[0].width;
const ROWS = MAZES[0].height;

const KEYS: Record<string, Dir> = {
  ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
};

const GOAT_LOOK: Record<GoatKind, { body: string; head: string; horn: string; collar: string }> = {
  chaser: { body: "#f4f1e8", head: "#ffffff", horn: "#9b8a68", collar: "#ff816d" },
  cutter: { body: "#a8703f", head: "#b97d49", horn: "#efe2c4", collar: "#bdf36b" },
  wanderer: { body: "#e6cfa3", head: "#efdcb6", horn: "#8a6f45", collar: "#ffd25e" },
  shy: { body: "#6b4428", head: "#7a4f30", horn: "#e9dcc0", collar: "#8fd0f5" },
};

function statusFor(s: PuffState, ui: UiPhase): string {
  if (ui === "idle") return "Press start, then ride with the arrows, W A S D or a swipe.";
  if (ui === "paused") return "Paused.";
  switch (s.phase) {
    case "ready": return `Get ready: ${s.maze.name}.`;
    case "dying": return s.lives > 0 ? `A goat caught you! ${s.lives} ${s.lives === 1 ? "life" : "lives"} left.` : "A goat caught you!";
    case "cleared": return `${s.maze.name} cleared! On to the next market.`;
    case "over": return `Game over. You scored ${s.score}.`;
    default:
      if (s.scaredMs > 0) return `Pepper soup! The goats are scared for ${Math.ceil(s.scaredMs / 1000)}s.`;
      if (s.bonus) return "A bottle of zobo by the pen! Grab it.";
      return `${s.maze.name}: ${s.itemsLeft} left to grab.`;
  }
}

// --- Drawing (units are tiles; the middle of tile x,y is x+0.5, y+0.5) ---

// roundRect is missing on some older phones; a plain box is fine there.
function roundBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function drawMaze(ctx: CanvasRenderingContext2D, maze: Maze) {
  const isWall = (x: number, y: number) => x < 0 || y < 0 || x >= maze.width || y >= maze.height || maze.rows[y][x] === "#";
  const inset = 0.2;
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const c = maze.rows[y][x];
      if (c === "#") {
        const l = isWall(x - 1, y) ? 0 : inset;
        const r = isWall(x + 1, y) ? 0 : inset;
        const t = isWall(x, y - 1) ? 0 : inset;
        const b = isWall(x, y + 1) ? 0 : inset;
        ctx.fillStyle = "#2f4b3c";
        ctx.fillRect(x + l, y + t, 1 - l - r, 1 - t - b);
        if (t) { ctx.fillStyle = "#4a6d57"; ctx.fillRect(x + l, y + t, 1 - l - r, 0.07); } // a lit edge, like a stall's front
      } else if (c === "g") {
        ctx.fillStyle = "#223a2e";
        ctx.fillRect(x, y + 0.1, 1, 0.8);
      } else if (c === "-") {
        ctx.fillStyle = "#c9a36b";
        ctx.fillRect(x, y + 0.42, 1, 0.16);
      }
    }
  }
}

function drawItems(ctx: CanvasRenderingContext2D, s: PuffState, t: number, still: boolean) {
  const { maze, items } = s;
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const v = items[y * maze.width + x];
      if (v === 1) {
        ctx.fillStyle = "#d98b33";
        ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f6c97a";
        ctx.beginPath(); ctx.arc(x + 0.46, y + 0.45, 0.06, 0, Math.PI * 2); ctx.fill();
      } else if (v === 2) {
        const pulse = still ? 1 : 0.9 + 0.1 * Math.sin(t / 180);
        drawSoup(ctx, x + 0.5, y + 0.5, pulse, still ? 0 : t);
      }
    }
  }
}

function drawSoup(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, t: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#f7f7f2aa"; ctx.lineWidth = 0.05; ctx.lineCap = "round";
  for (const sx of [-0.12, 0.08]) { // steam
    const wob = Math.sin(t / 200 + sx * 10) * 0.04;
    ctx.beginPath(); ctx.moveTo(sx, -0.12); ctx.quadraticCurveTo(sx + 0.08 + wob, -0.24, sx, -0.38); ctx.stroke();
  }
  ctx.fillStyle = "#f7f7f2";
  ctx.beginPath(); ctx.ellipse(0, 0, 0.36, 0.09, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e5533d";
  ctx.beginPath(); ctx.ellipse(0, 0, 0.3, 0.06, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff816d";
  ctx.beginPath(); ctx.moveTo(-0.36, 0.01); ctx.quadraticCurveTo(0, 0.5, 0.36, 0.01); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawZobo(ctx: CanvasRenderingContext2D, x: number, y: number, blink: boolean) {
  if (blink) return;
  ctx.save();
  ctx.translate(x + 0.5, y + 0.5);
  ctx.fillStyle = "#7d1d3f";
  roundBox(ctx, -0.15, -0.12, 0.3, 0.48, 0.08); ctx.fill();
  ctx.fillRect(-0.06, -0.32, 0.12, 0.22);
  ctx.fillStyle = "#bdf36b"; ctx.fillRect(-0.08, -0.4, 0.16, 0.09); // cap
  ctx.fillStyle = "#f7f7f2"; ctx.fillRect(-0.15, 0.04, 0.3, 0.12); // label
  ctx.restore();
}

function drawBike(ctx: CanvasRenderingContext2D, s: PuffState, t: number, still: boolean) {
  const p = s.player;
  const pos = actorPos(p);
  ctx.save();
  ctx.translate(pos.x + 0.5, pos.y + 0.5);
  if (s.phase === "dying" && !still) {
    const k = Math.max(0, s.phaseMs / DYING_MS);
    ctx.rotate((1 - k) * Math.PI * 4);
    ctx.scale(0.3 + 0.7 * k, 0.3 + 0.7 * k);
  }
  const dir = p.dir ?? "left";
  if (dir === "left") ctx.scale(-1, 1);
  else if (dir === "up") ctx.rotate(-Math.PI / 2);
  else if (dir === "down") ctx.rotate(Math.PI / 2);
  const bob = still || s.phase !== "playing" ? 0 : Math.sin(t / 60) * 0.02;
  ctx.translate(0, bob);
  // Wheels
  ctx.lineWidth = 0.05;
  for (const wx of [-0.25, 0.27]) {
    ctx.fillStyle = "#0e1813"; ctx.strokeStyle = "#e7efe3";
    ctx.beginPath(); ctx.arc(wx, 0.22, 0.13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // Frame
  ctx.strokeStyle = "#ff816d"; ctx.lineWidth = 0.09; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(-0.25, 0.22); ctx.lineTo(-0.02, 0.1); ctx.lineTo(0.2, 0.08); ctx.lineTo(0.27, 0.22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.2, 0.08); ctx.lineTo(0.24, -0.1); ctx.stroke();
  // Delivery box on the back
  ctx.fillStyle = "#bdf36b"; ctx.strokeStyle = "#5f8f2a"; ctx.lineWidth = 0.04;
  roundBox(ctx, -0.44, -0.3, 0.34, 0.32, 0.05); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.44, -0.16); ctx.lineTo(-0.1, -0.16); ctx.stroke();
  // Rider
  ctx.strokeStyle = "#17251f"; ctx.lineWidth = 0.1;
  ctx.beginPath(); ctx.moveTo(0, 0.06); ctx.lineTo(0.04, -0.18); ctx.lineTo(0.22, -0.1); ctx.stroke();
  ctx.fillStyle = "#c98b55";
  ctx.beginPath(); ctx.arc(0.08, -0.3, 0.11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff816d"; // helmet
  ctx.beginPath(); ctx.arc(0.08, -0.32, 0.12, Math.PI, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGoat(ctx: CanvasRenderingContext2D, s: PuffState, g: Goat, t: number, still: boolean) {
  const pos = actorPos(g);
  const look = GOAT_LOOK[g.kind];
  const flashing = g.scared && s.scaredMs < 1600 && Math.floor(t / 180) % 2 === 0;
  const body = g.scared ? (flashing ? "#f7f7f2" : "#8fb3d9") : look.body;
  const head = g.scared ? (flashing ? "#ffffff" : "#a5c4e4") : look.head;
  const going = g.mode === "returning";
  ctx.save();
  const hop = still || s.phase !== "playing" ? 0 : Math.abs(Math.sin(t / 110 + g.x)) * -0.05;
  ctx.translate(pos.x + 0.5, pos.y + 0.52 + hop);
  if (g.dir === "left") ctx.scale(-1, 1);
  if (going) ctx.globalAlpha = 0.6;
  ctx.lineCap = "round";
  if (!going) {
    // Legs and body
    ctx.strokeStyle = g.scared ? "#5d7ea3" : "#3a2a1c"; ctx.lineWidth = 0.07;
    const step = still ? 0 : Math.sin(t / 70) * 0.04;
    for (const [lx, o] of [[-0.22, step], [-0.1, -step], [0.08, step], [0.18, -step]] as const) {
      ctx.beginPath(); ctx.moveTo(lx, 0.1); ctx.lineTo(lx + o, 0.34); ctx.stroke();
    }
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(-0.04, 0.06, 0.31, 0.19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = body; ctx.lineWidth = 0.06; // tail
    ctx.beginPath(); ctx.moveTo(-0.33, 0); ctx.lineTo(-0.4, -0.1); ctx.stroke();
    if (!g.scared) { ctx.strokeStyle = look.collar; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(0.17, -0.09); ctx.lineTo(0.22, 0.08); ctx.stroke(); }
  }
  // Head, horns, ear, eye
  ctx.strokeStyle = g.scared ? "#e9f1fa" : look.horn; ctx.lineWidth = 0.06;
  ctx.beginPath(); ctx.moveTo(0.27, -0.24); ctx.quadraticCurveTo(0.22, -0.42, 0.06, -0.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.33, -0.25); ctx.quadraticCurveTo(0.32, -0.44, 0.17, -0.45); ctx.stroke();
  ctx.fillStyle = head;
  ctx.beginPath(); ctx.ellipse(0.3, -0.13, 0.15, 0.13, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0.15, -0.16, 0.08, 0.04, -0.4, 0, Math.PI * 2); ctx.fill();
  if (g.kind === "chaser" && !g.scared && !going) { // a little beard
    ctx.beginPath(); ctx.moveTo(0.33, -0.02); ctx.lineTo(0.41, 0.1); ctx.lineTo(0.42, -0.04); ctx.fill();
  }
  ctx.fillStyle = "#17251f";
  ctx.beginPath(); ctx.arc(0.34, -0.15, g.scared ? 0.04 : 0.03, 0, Math.PI * 2); ctx.fill();
  if (g.scared) { // worried mouth
    ctx.strokeStyle = "#17251f"; ctx.lineWidth = 0.025;
    ctx.beginPath(); ctx.moveTo(0.3, -0.05); ctx.lineTo(0.34, -0.08); ctx.lineTo(0.38, -0.05); ctx.lineTo(0.42, -0.08); ctx.stroke();
  }
  ctx.restore();
}

// `size` is the canvas's CSS size and the pixel ratio its backing store was made for (see useCanvasFit). The whole maze
// is scaled to fit inside it and centred, whatever the box's shape.
function render(canvas: HTMLCanvasElement, size: CanvasSize, s: PuffState, t: number, still: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { w, h, dpr } = size;
  const tile = Math.min(w / s.maze.width, h / s.maze.height);
  const ox = (w - tile * s.maze.width) / 2; const oy = (h - tile * s.maze.height) / 2;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#1b2a23";
  ctx.fillRect(0, 0, w, h);
  ctx.setTransform(dpr * tile, 0, 0, dpr * tile, dpr * ox, dpr * oy);
  drawMaze(ctx, s.maze);
  drawItems(ctx, s, t, still);
  if (s.bonus) drawZobo(ctx, s.maze.bonusTile.x, s.maze.bonusTile.y, !still && s.bonus.ms < 2000 && Math.floor(t / 150) % 2 === 0);
  for (const g of s.goats) drawGoat(ctx, s, g, t, still);
  if (s.phase !== "over") drawBike(ctx, s, t, still);
  // Text in screen pixels so it stays crisp.
  ctx.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.max(9, tile * 0.55)}px ui-monospace, monospace`;
  for (const p of s.popups) {
    ctx.fillStyle = "#bdf36b";
    ctx.fillText(p.text, (p.x + 0.5) * tile, (p.y + 0.5 - (still ? 0 : (1 - p.ms / 1200) * 0.6)) * tile);
  }
  if (s.phase === "ready") {
    ctx.font = `700 ${Math.max(10, tile * 0.7)}px ui-monospace, monospace`;
    ctx.fillStyle = "#ff816d";
    ctx.fillText("GET READY", (s.maze.bonusTile.x + 0.5) * tile, (s.maze.bonusTile.y + 0.5) * tile);
  }
}

// --- Sound: tiny synthesised effects, made up for this game ---

function useSounds() {
  const ctxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const lastPop = useRef(0);
  const popFlip = useRef(false);

  const ensure = useCallback(() => {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctxRef.current) ctxRef.current = new AC();
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const tone = useCallback((from: number, to: number, dur: number, type: OscillatorType, gain: number, delay = 0) => {
    const ac = ctxRef.current;
    if (!ac || mutedRef.current) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    const t0 = ac.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(from, t0);
    o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }, []);

  const play = useCallback((events: readonly GameEvent[]) => {
    if (mutedRef.current || !ctxRef.current) return;
    for (const e of events) {
      switch (e) {
        case "dot": {
          // Rate-limited and soft, so a long lane of puff-puff isn't harsh.
          const now = performance.now();
          if (now - lastPop.current < 95) break;
          lastPop.current = now;
          popFlip.current = !popFlip.current;
          tone(popFlip.current ? 760 : 680, 420, 0.06, "sine", 0.03);
          break;
        }
        case "soup": tone(220, 980, 0.42, "triangle", 0.05); break;
        case "goat": tone(660, 700, 0.07, "triangle", 0.05); tone(990, 1060, 0.1, "triangle", 0.05, 0.07); break;
        case "caught": tone(560, 90, 0.85, "triangle", 0.07); tone(280, 60, 0.85, "sine", 0.04, 0.05); break;
        case "clear": [523, 659, 784, 659, 1047].forEach((f, i) => tone(f, f * 1.01, 0.13, "triangle", 0.045, i * 0.11)); break;
        case "bonus": tone(880, 1320, 0.12, "sine", 0.05); tone(1320, 1760, 0.12, "sine", 0.04, 0.1); break;
        case "bonusShow": tone(1175, 1200, 0.08, "sine", 0.025); break;
        case "start": tone(392, 400, 0.09, "triangle", 0.04); tone(587, 600, 0.12, "triangle", 0.04, 0.1); break;
        default: break;
      }
    }
  }, [tone]);

  return { ensure, play, mutedRef };
}

// --- The game ---

export default function PuffPuffGame() {
  const [speed, setSpeed] = useState<Speed>("normal");
  const [ui, setUi] = useState<UiPhase>("idle");
  const [muted, setMuted] = useState(false);
  const [best, setBest] = useState(0);
  const [runId, setRunId] = useState(0); // bumps on every new game so the loop restarts even after game over
  const [hud, setHud] = useState<Hud>(() => {
    const s = initialState({ seed: 1 });
    return { score: 0, lives: s.lives, level: 1, phase: s.phase, status: statusFor(s, "idle") };
  });
  const gameRef = useRef<PuffState>(initialState({ seed: 1, speed: "normal" }));
  // Size the canvas to its box, sharp on high-density screens: the whole maze, as wide as the box allows but never
  // taller than most of the window, so the bottom rows are always in view.
  const fit = useCanvasFit((boxW, viewH) => {
    const h = Math.min((boxW * ROWS) / COLS, Math.max(300, viewH * 0.8));
    return { w: (h * COLS) / ROWS, h };
  }, { maxDpr: 3, onFit: () => draw(performance.now()) });
  const canvasRef = fit.canvas;
  const pendingDir = useRef<Dir | null>(null);
  const bestRef = useRef(0);
  const uiRef = useRef<UiPhase>("idle");
  const stillRef = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const { ensure, play, mutedRef } = useSounds();

  uiRef.current = ui;

  useEffect(() => {
    try { const b = Number(arcadeStore.getItem(BEST_KEY)) || 0; bestRef.current = b; setBest(b); } catch { /* storage blocked: start from 0 */ }
    try { stillRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* old browser */ }
  }, []);

  const saveBest = useCallback((score: number) => {
    if (score <= bestRef.current) return;
    bestRef.current = score;
    setBest(score);
    try { arcadeStore.setItem(BEST_KEY, String(score)); } catch { /* ignore */ }
  }, []);

  const draw = useCallback((t: number) => {
    if (canvasRef.current) render(canvasRef.current, fit.size.current, gameRef.current, t, stillRef.current);
  }, [canvasRef, fit.size]);

  const syncHud = useCallback(() => {
    const s = gameRef.current;
    const status = statusFor(s, uiRef.current);
    setHud((h) => (h.score === s.score && h.lives === s.lives && h.level === s.level && h.phase === s.phase && h.status === status
      ? h : { score: s.score, lives: s.lives, level: s.level, phase: s.phase, status }));
  }, []);


  // The game loop: only runs while playing and the page is visible.
  useEffect(() => {
    if (ui !== "running") { draw(performance.now()); syncHud(); return; }
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - last));
      last = now;
      const dir = pendingDir.current;
      pendingDir.current = null;
      const next = step(gameRef.current, dt, dir ? { dir } : {});
      gameRef.current = next;
      if (next.events.length) play(next.events);
      if (next.score > bestRef.current && next.events.includes("over")) saveBest(next.score);
      draw(now);
      syncHud();
      if (next.phase === "over") { saveBest(next.score); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onVisibility = () => { if (document.hidden) setUi("paused"); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVisibility); };
  }, [ui, runId, draw, play, saveBest, syncHud]);

  const startGame = useCallback(() => {
    if (!mutedRef.current) ensure();
    const seed = Math.floor(Math.random() * 2 ** 31); // fresh goats each game; the engine itself stays seeded
    gameRef.current = initialState({ seed, speed });
    pendingDir.current = null;
    play(["start"]);
    setRunId((n) => n + 1);
    setUi("running");
    syncHud();
  }, [draw, ensure, mutedRef, play, speed, syncHud]);

  const resume = useCallback(() => {
    if (!mutedRef.current) ensure();
    setUi("running");
  }, [ensure, mutedRef]);

  const steer = useCallback((dir: Dir) => {
    if (uiRef.current === "running") pendingDir.current = dir;
    else if (uiRef.current === "paused") { pendingDir.current = dir; resume(); }
  }, [resume]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;
      const dir = KEYS[e.key];
      const over = gameRef.current.phase === "over";
      if (dir && uiRef.current !== "idle" && !over) { e.preventDefault(); steer(dir); return; }
      if ((e.key === " " || e.key === "Enter") && target?.tagName !== "BUTTON") {
        if (uiRef.current === "idle" || over) { e.preventDefault(); startGame(); }
        else if (uiRef.current === "paused") { e.preventDefault(); resume(); }
      }
      if ((e.key === "p" || e.key === "P" || e.key === "Escape") && uiRef.current === "running" && !over) setUi("paused");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resume, startGame, steer]);

  // Swipes on the board
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const start = touchStart.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    touchStart.current = { x: t.clientX, y: t.clientY }; // keep swiping without lifting the finger
  };

  const toggleSound = () => {
    setMuted((m) => {
      mutedRef.current = !m;
      if (m) ensure();
      return !m;
    });
  };

  const playing = ui === "running" && hud.phase !== "over";
  const over = hud.phase === "over";
  const nextMaze = mazeForLevel(hud.level + 1).name;
  const pad = (dir: Dir, glyph: string, label: string) => (
    <button type="button" className={`pp-pad-btn pp-pad-${dir}`} aria-label={`Ride ${label}`}
      onPointerDown={(e) => { e.preventDefault(); steer(dir); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); steer(dir); } }}>
      {glyph}
    </button>
  );

  return (
    <ArcadeShell game={ENTRY}>
      <div className="arc-console pp-console">
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">SCORE</span><strong aria-live="off">{String(hud.score).padStart(4, "0")}</strong></div>
          <div className="arc-stat"><span className="arc-label">BEST</span><strong>{String(Math.max(best, hud.score)).padStart(4, "0")}</strong></div>
          <div className="arc-stat"><span className="arc-label">LIVES</span><strong className="pp-lives" aria-label={`${hud.lives} lives`}>{Array.from({ length: Math.max(0, hud.lives) }, (_, i) => <i key={i} />)}{hud.lives <= 0 ? "0" : null}</strong></div>
          <div className="arc-stat"><span className="arc-label">MARKET</span><strong>{hud.level}</strong></div>
          <span className="arc-spacer" />
          <label className="pp-speed">
            <span className="arc-label">SPEED</span>
            <select className="arc-select" aria-label="Game speed" value={speed} disabled={playing} onChange={(e) => setSpeed(e.target.value as Speed)}>
              <option value="chill">CHILL</option>
              <option value="normal">NORMAL</option>
              <option value="fast">FAST</option>
            </select>
          </label>
          <button type="button" className="arc-btn-ghost" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
          <button type="button" className="arc-btn-ghost" onClick={startGame} aria-label="Start a new game">NEW GAME</button>
        </div>

        <div className="arc-board-wrap pp-board">
          <div ref={fit.wrapRef} className="pp-canvas-wrap" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => { touchStart.current = null; }}>
            <canvas ref={fit.canvasRef} className="pp-canvas" role="img"
              aria-label={`Puff-Puff Rush board. Market ${hud.level}. Score ${hud.score}. ${hud.lives} lives.`} />
          </div>
          {ui === "idle" && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">READY WHEN YOU ARE</p>
              <h2>Puff-puff time.</h2>
              <p>Ride the lanes, grab every puff-puff, keep clear of the goats.</p>
              <button type="button" className="arc-btn" onClick={startGame} aria-label="Start game">START GAME <span aria-hidden="true">↗</span></button>
            </div>
          )}
          {ui === "paused" && !over && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">TAKING A BREATHER</p>
              <h2>Paused.</h2>
              <p>The goats will wait.</p>
              <button type="button" className="arc-btn" onClick={resume} aria-label="Carry on playing">CARRY ON</button>
            </div>
          )}
          {ui === "running" && hud.phase === "cleared" && (
            <div className="arc-overlay pp-overlay-soft" aria-live="polite">
              <p className="arc-overlay-kicker">MARKET CLEARED</p>
              <h2>Well ridden!</h2>
              <p>Next stop: {nextMaze}.</p>
            </div>
          )}
          {over && ui !== "idle" && (
            <div className="arc-overlay" aria-live="polite">
              <p className="arc-overlay-kicker">THAT&apos;S A WRAP</p>
              <h2>The goats got you.</h2>
              <p>You scored {hud.score}{hud.score >= best && hud.score > 0 ? ", a new best!" : `. Best: ${best}.`}</p>
              <button type="button" className="arc-btn" onClick={startGame} aria-label="Play again">PLAY AGAIN <span aria-hidden="true">↗</span></button>
            </div>
          )}
        </div>

        <p className="arc-status" aria-live="polite">{hud.status}</p>

        <div className="pp-pad" aria-label="Touch controls">
          <div className="pp-pad-grid">
            {pad("up", "↑", "up")}
            {pad("left", "←", "left")}
            {pad("down", "↓", "down")}
            {pad("right", "→", "right")}
          </div>
          {playing && <button type="button" className="arc-btn-ghost pp-pause" onClick={() => setUi("paused")} aria-label="Pause">PAUSE</button>}
        </div>
      </div>

      <style jsx global>{`
        .pp-console .arc-head { gap:12px 16px; }
        .pp-speed { display:flex; align-items:center; gap:8px; }
        .pp-lives { display:flex; align-items:center; gap:4px; min-height:26px; }
        .pp-lives i { display:inline-block; width:10px; height:10px; border-radius:3px 3px 50% 50%; background:#ff816d; box-shadow:inset 0 -3px 0 #e5533d; }
        .pp-board { max-width:520px; margin:0 auto; }
        .pp-canvas-wrap { position:relative; width:100%; touch-action:none; user-select:none; -webkit-user-select:none; }
        .pp-canvas { display:block; max-width:100%; margin:0 auto; }
        .pp-overlay-soft { background:#14231fb0; pointer-events:none; }
        .pp-pad { display:none; align-items:center; justify-content:center; gap:18px; padding:10px 0 2px; }
        .pp-pad-grid { display:grid; grid-template-columns:repeat(3,48px); grid-template-rows:repeat(2,44px); gap:6px; grid-template-areas:". up ." "left down right"; }
        .pp-pad-up { grid-area:up; }.pp-pad-left { grid-area:left; }.pp-pad-down { grid-area:down; }.pp-pad-right { grid-area:right; }
        .pp-pad-btn { display:grid; place-items:center; border:1px solid #e3e7df; border-radius:9px; background:#f7f8f4; color:#39473d; font-size:18px; cursor:pointer; touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
        .pp-pad-btn:active { background:#d9f4b2; }
        .pp-pad-btn:focus-visible { outline:2px solid #83b83c; outline-offset:2px; }
        .pp-pause { align-self:center; }
        @media (max-width:740px), (pointer:coarse) { .pp-pad { display:flex; } }
        @media (max-width:420px) {
          .pp-console { padding:10px; }
          .pp-console .arc-head { gap:10px 12px; padding:2px 2px 10px; }
          .pp-console .arc-stat strong { font-size:16px; }
          .pp-speed { order:1; }
        }
        @media (prefers-reduced-motion:reduce) { .pp-pad-btn { transition:none; } }
      `}</style>
    </ArcadeShell>
  );
}
