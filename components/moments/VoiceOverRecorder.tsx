"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/moments-client";
import { MOMENT_AUDIO_MAX_SECONDS } from "@/lib/moments-rules";

export type VoiceOver = { blob: Blob; durationSec: number; contentType: string };

// Records a voice-over in the browser (up to 90 seconds) to play over the picture, video or text. Nothing is uploaded until the
// moment is shared; `uploadVoiceOver` does that.
export default function VoiceOverRecorder({ value, onChange }: { value: VoiceOver | null; onChange: (v: VoiceOver | null) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<ReturnType<typeof setInterval>>();
  const started = useRef(0);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (!value) { setUrl(null); return; } const u = URL.createObjectURL(value.blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [value]);
  useEffect(() => () => { clearInterval(tick.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  if (!supported) return <p className="text-xs text-slate">Voice-over needs a browser that can record audio.</p>;

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // WebM in Chrome and Firefox, MP4 in Safari: the two the server accepts.
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        clearInterval(tick.current);
        stream.getTracks().forEach((t) => t.stop());
        const contentType = (r.mimeType || type || "audio/webm").split(";")[0];
        onChange({ blob: new Blob(chunks.current, { type: contentType }), durationSec: (Date.now() - started.current) / 1000, contentType });
        setRecording(false);
      };
      rec.current = r;
      started.current = Date.now();
      setSeconds(0); setRecording(true);
      r.start();
      tick.current = setInterval(() => {
        const s = Math.floor((Date.now() - started.current) / 1000);
        setSeconds(s);
        if (s >= MOMENT_AUDIO_MAX_SECONDS) r.stop();
      }, 250);
    } catch {
      setError("We couldn't use the microphone. Check that you've allowed it for this site.");
    }
  }

  return (
    <div className="mt-3 text-sm">
      {value && url ? (
        <div className="flex items-center gap-2">
          <audio src={url} controls className="h-9 min-w-0 flex-1" />
          <button type="button" onClick={() => onChange(null)} className="rounded border border-rule px-3 py-1">Remove</button>
        </div>
      ) : recording ? (
        <button type="button" onClick={() => rec.current?.stop()} className="rounded bg-red-600 px-3 py-1.5 font-bold text-white">■ Stop ({seconds}s / {MOMENT_AUDIO_MAX_SECONDS}s)</button>
      ) : (
        <button type="button" onClick={start} className="rounded border border-rule px-3 py-1.5">🎙 Add a voice-over</button>
      )}
      {error && <p className="mt-1 text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}

// Uploads a recording through /api/moments/audio and returns the id to pass to createMoment.
export async function uploadVoiceOver(v: VoiceOver): Promise<string> {
  const start = await api<{ id: string; uploadUrl: string }>("/api/moments/audio", { body: { action: "start", size: v.blob.size, contentType: v.contentType, durationSec: v.durationSec } });
  const put = await fetch(start.uploadUrl, { method: "PUT", headers: { "Content-Type": v.contentType }, body: v.blob });
  if (!put.ok) throw new Error("The voice-over didn't upload. Try again.");
  await api("/api/moments/audio", { body: { action: "finish", id: start.id } });
  return start.id;
}
