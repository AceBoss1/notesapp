"use client";

import { useMemo, useRef, useEffect } from "react";
import { captionAt, captionLines, playhead, type Captions, type Span } from "@/lib/moments-tidy";

// Captions on a moment (docs/MOMENTS_TIDY.md, mockups 4 and 5): the line being said, with the current word marked. Drawn here by the
// viewer, not burnt into the video, so viewers can turn them off and a wrong line can be taken off after sharing.
export function CaptionOverlay({ captions, time }: { captions: Captions; time: number }) {
  const lines = useMemo(() => captionLines(captions.words), [captions.words]);
  const now = captionAt(lines, time);
  if (!now) return null;
  const { style, place } = captions;
  return (
    <p aria-live="off" className={`pointer-events-none absolute inset-x-4 z-[5] text-center leading-snug text-white ${place === "middle" ? "top-1/2 -translate-y-1/2" : "bottom-10"} ${style === "clean" ? "text-lg font-semibold" : "text-xl font-extrabold"}`}
      style={{ textShadow: "0 2px 6px rgba(0,0,0,.85)" }}>
      {now.line.words.map((w, i) => {
        const on = i === now.word;
        return <span key={i} className={on && style === "bold" ? "rounded-md bg-[#FFD23F] px-1 text-[#1A1210]" : on && style === "colour" ? "text-[#FFD23F]" : ""} style={on && style === "bold" ? { textShadow: "none" } : undefined}>{w.w}{i < now.line.words.length - 1 ? " " : ""}</span>;
      })}
    </p>
  );
}

// A voice-over, played over a picture, a video or text. With a trim it skips its pauses, as a trimmed video does.
export function VoiceOver({ src, spans, muted, onTime }: { src: string; spans?: Span[]; muted?: boolean; onTime?: (t: number) => void }) {
  const el = useRef<HTMLAudioElement>(null);
  const cb = useRef(onTime); cb.current = onTime;
  useEffect(() => { const a = el.current; if (a && spans?.length && spans[0][0] > 0.05) a.currentTime = spans[0][0]; }, [src, spans]);
  return (
    <audio ref={el} src={src} autoPlay muted={muted}
      onTimeUpdate={(e) => {
        const a = e.currentTarget;
        cb.current?.(a.currentTime);
        if (!spans?.length) return;
        const h = playhead(spans, a.currentTime);
        if (h.seek !== undefined) a.currentTime = h.seek; else if (h.done && !a.paused) a.pause();
      }} />
  );
}

// Cloudflare Stream's player SDK, loaded only for a trimmed video: it lets the page move the player past a pause. Without it (blocked,
// offline) the video simply plays its pauses.
type StreamPlayer = { currentTime: number };
let sdk: Promise<(frame: HTMLIFrameElement) => StreamPlayer> | null = null;
export function loadStreamSdk(): Promise<(frame: HTMLIFrameElement) => StreamPlayer> {
  sdk ??= new Promise((resolve, reject) => {
    const w = window as unknown as { Stream?: (frame: HTMLIFrameElement) => StreamPlayer };
    if (w.Stream) return resolve(w.Stream);
    const s = document.createElement("script");
    s.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
    s.async = true;
    s.onload = () => (w.Stream ? resolve(w.Stream) : reject(new Error("no Stream SDK")));
    s.onerror = () => { sdk = null; reject(new Error("Stream SDK didn't load")); };
    document.head.appendChild(s);
  });
  return sdk;
}
