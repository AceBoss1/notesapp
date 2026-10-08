"use client";

import { useEffect, useRef, useState } from "react";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// The dictate button beside Send: tap to start recording a voice note, tap the square to stop (it stops by itself at the plan's limit,
// five minutes by default). The recording is handed back as a file to attach like any other; nothing is uploaded until the message is sent.
export default function VoiceNoteButton({ maxSeconds, disabled, onRecorded, onError }: {
  maxSeconds: number; disabled?: boolean; onRecorded: (file: File, durationSec: number) => void; onError: (message: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<ReturnType<typeof setInterval>>();
  const started = useRef(0);
  const cancelled = useRef(false);
  useEffect(() => () => { clearInterval(tick.current); cancelled.current = true; rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

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
      <div className="flex items-center gap-2 self-end rounded-full border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" role="status" aria-live="off">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" aria-hidden />
        <span className="font-mono tabular-nums">{mmss(seconds)} / {mmss(maxSeconds)}</span>
        <button type="button" onClick={() => { cancelled.current = true; rec.current?.stop(); }} aria-label="Cancel recording" title="Cancel" className="px-1 text-lg leading-none">×</button>
        <button type="button" onClick={() => rec.current?.stop()} aria-label="Stop and attach the voice note" title="Stop and attach" className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">■ Stop</button>
      </div>
    );
  }
  return (
    <button type="button" onClick={start} disabled={disabled} aria-label="Record a voice note" title={`Record a voice note (up to ${mmss(maxSeconds)})`} className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full border border-rule text-ink hover:border-crimson hover:text-crimson disabled:opacity-50">
      {/* Dictate icon: a microphone with sound waves */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
        <path d="M12 18v3" />
        <path d="M2.5 9.5v3M21.5 9.5v3" />
      </svg>
    </button>
  );
}
