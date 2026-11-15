"use client";

import { useEffect, useRef, useState } from "react";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// The dictate button beside Send: tap to start recording a voice note, tap the square to stop (it stops by itself at the plan's limit,
// five minutes by default). The recording is handed back as a file to attach like any other; nothing is uploaded until the message is sent.
// While recording it takes the composer's whole row (Moda user dashboard redesign): the bin to cancel, a pill with the time and a moving
// wave, and the round button that stops and adds it; `onRecordingChange` lets the composer step aside.
export default function VoiceNoteButton({ maxSeconds, disabled, onRecorded, onError, onRecordingChange }: {
  maxSeconds: number; disabled?: boolean; onRecorded: (file: File, durationSec: number) => void; onError: (message: string) => void;
  onRecordingChange?: (recording: boolean) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<ReturnType<typeof setInterval>>();
  const started = useRef(0);
  const cancelled = useRef(false);
  useEffect(() => () => { clearInterval(tick.current); cancelled.current = true; rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => { onRecordingChange?.(recording); }, [recording, onRecordingChange]);

  // Known only in the browser, so decided after the page has loaded (deciding it while rendering makes the server's page and the browser's differ).
  const [supported, setSupported] = useState(false);
  useEffect(() => { setSupported(!!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined"); }, []);
  if (!supported) return null;

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // WebM in Chrome and Firefox, MP4 in Safari.
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      cancelled.current = false;
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        clearInterval(tick.current);
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const duration = (Date.now() - started.current) / 1000;
        if (cancelled.current || duration < 0.5 || !chunks.current.length) return;
        const mime = (r.mimeType || type || "audio/webm").split(";")[0];
        const ext = mime === "audio/mp4" ? "m4a" : "weba";
        onRecorded(new File(chunks.current, `voice-note-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`, { type: mime }), duration);
      };
      rec.current = r;
      started.current = Date.now();
      setSeconds(0); setRecording(true);
      r.start();
      tick.current = setInterval(() => {
        const s = (Date.now() - started.current) / 1000;
        setSeconds(s);
        if (s >= maxSeconds) r.stop();
      }, 250);
    } catch {
      onError("We couldn't use the microphone. Check that you've allowed it for this site.");
    }
  }

  if (recording) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2.5 self-end">
        <button type="button" onClick={() => { cancelled.current = true; rec.current?.stop(); }} aria-label="Cancel the recording" title="Cancel"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-rule bg-paper text-crimson-bright hover:border-crimson">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
        </button>
        <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-crimson-bright/10 px-4" role="status" aria-live="off" aria-label={`Recording a voice note, ${mmss(seconds)} of ${mmss(maxSeconds)}`}>
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-600" aria-hidden />
          <span className="shrink-0 font-ui text-sm font-semibold tabular-nums text-ink">{mmss(seconds)}</span>
          <span className="flex h-6 min-w-0 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
            {Array.from({ length: 22 }, (_, i) => (
              <span key={i} className={`w-[3px] shrink-0 rounded-full ${i < 14 ? "bg-crimson-bright" : "bg-crimson-bright/30"}`}
                style={{ height: `${30 + 70 * Math.abs(Math.sin((i + Math.floor(seconds * 4)) * 0.9))}%`, transition: "height .2s" }} />
            ))}
          </span>
        </div>
        <button type="button" onClick={() => rec.current?.stop()} aria-label="Stop and add the voice note" title="Stop and add"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-crimson-bright text-white hover:bg-crimson">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5"><path d="M4 12 20 4l-4 16-4-7-8-1Z" /></svg>
        </button>
      </div>
    );
  }
  return (
    <button type="button" onClick={start} disabled={disabled} aria-label="Record a voice note" title={`Record a voice note (up to ${mmss(maxSeconds)})`} className="flex h-12 w-12 shrink-0 items-center justify-center self-end rounded-full border border-crimson-bright/60 text-crimson-bright hover:bg-crimson-bright/5 disabled:opacity-50 lg:h-14 lg:w-14 lg:border-transparent lg:text-ink">
      {/* Dictate icon: a microphone with sound waves */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
        <path d="M12 18v3" />
        <path d="M2.5 9.5v3M21.5 9.5v3" />
      </svg>
    </button>
  );
}
