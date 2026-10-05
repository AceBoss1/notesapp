"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fmtBytes, fmtDuration } from "@/lib/video-rules";

// #NotesApp's own video player. Built for data-conscious viewers: nothing downloads until you press play (the poster
// and the file size are shown up front), it remembers where you stopped, and it works with keyboard, touch and screen
// readers. Space/K play-pause · ←/→ seek 5 s · M mute · F fullscreen.
const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
const RESUME_KEY = (src: string) => `na_video_pos:${src}`;

export default function VideoPlayer({ src, poster, duration, size, title }: { src: string; poster?: string; duration?: number; size?: number; title?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [total, setTotal] = useState(duration ?? 0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (!started) setStarted(true);
    v.paused ? v.play().catch(() => setFailed(true)) : v.pause();
  }, [started]);

  const seekBy = (s: number) => {
    const v = video.current;
    if (v) v.currentTime = Math.min(Math.max(0, v.currentTime + s), v.duration || Infinity);
  };

  function toggleFullscreen() {
    const el = wrap.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else v?.webkitEnterFullscreen?.(); // iOS Safari
  }

  function onKey(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === " " || e.key.toLowerCase() === "k") { e.preventDefault(); toggle(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); seekBy(5); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); seekBy(-5); }
    else if (e.key.toLowerCase() === "m") setMuted((m) => !m);
    else if (e.key.toLowerCase() === "f") toggleFullscreen();
  }

  function onLoadedMetadata() {
    const v = video.current!;
    setTotal(v.duration);
    try {
      const at = Number(localStorage.getItem(RESUME_KEY(src)) || 0);
      if (at > 3 && at < v.duration - 5) v.currentTime = at;
    } catch { /* private mode — start from the top */ }
  }

  function onTimeUpdate() {
    const v = video.current!;
    setTime(v.currentTime);
    if (Date.now() - lastSaved.current > 3000) {
      lastSaved.current = Date.now();
      try { v.currentTime > 3 ? localStorage.setItem(RESUME_KEY(src), String(Math.floor(v.currentTime))) : null; } catch { /* ignore */ }
    }
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (video.current) video.current.playbackRate = next;
  }

  if (failed) {
    return <div className="mt-8 rounded border border-rule bg-card p-6 text-center text-sm text-slate">This video couldn&apos;t be played on this device.{" "}<a href={src} className="text-crimson underline" target="_blank" rel="noopener noreferrer">Open the file</a></div>;
  }

  const pct = total > 0 ? (time / total) * 100 : 0;
  return (
    <div
      ref={wrap}
      tabIndex={0}
      onKeyDown={onKey}
      role="group"
      aria-label={title ? `Video: ${title}` : "Video"}
      className={`group relative mt-8 overflow-hidden bg-ink outline-none focus-visible:ring-2 focus-visible:ring-crimson ${full ? "flex items-center" : ""}`}
    >
      <video
        ref={video}
        src={src}
        poster={poster}
        preload="none"
        playsInline
        muted={muted}
        className={`block w-full bg-ink ${full ? "max-h-screen" : "aspect-video object-contain"}`}
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => { setPlaying(false); try { localStorage.removeItem(RESUME_KEY(src)); } catch { /* ignore */ } }}
        onError={() => started && setFailed(true)}
      />

      {!playing && (
        <button type="button" onClick={toggle} aria-label="Play video" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/30 text-paper">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-crimson text-2xl shadow-lg">▶</span>
          {!started && (duration || size) ? (
            <span className="rounded-full bg-ink/70 px-3 py-1 font-mono text-xs">
              {duration ? fmtDuration(duration) : ""}{duration && size ? " · " : ""}{size ? `${fmtBytes(size)} of data` : ""}
            </span>
          ) : null}
        </button>
      )}
      {buffering && playing && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-paper" role="status">Loading…</span>}

      {started && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-ink/90 to-transparent px-3 pb-2 pt-6 text-paper">
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="w-6 text-lg leading-none">{playing ? "❚❚" : "▶"}</button>
          <span className="w-24 shrink-0 font-mono text-[11px]">{fmtDuration(time)} / {fmtDuration(total)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(total))}
            value={Math.floor(time)}
            onChange={(e) => video.current && (video.current.currentTime = Number(e.target.value))}
            aria-label="Seek"
            className="h-1 min-w-0 flex-1 cursor-pointer accent-crimson"
            style={{ background: `linear-gradient(to right, #7a0328 ${pct}%, rgba(255,255,255,.3) ${pct}%)` }}
          />
          <button type="button" onClick={cycleSpeed} aria-label="Playback speed" className="w-10 font-mono text-[11px]">{speed}×</button>
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="w-6 text-base leading-none">{muted ? "🔇" : "🔊"}</button>
          <button type="button" onClick={toggleFullscreen} aria-label={full ? "Exit full screen" : "Full screen"} className="w-6 text-base leading-none">{full ? "⤡" : "⤢"}</button>
        </div>
      )}
    </div>
  );
}
