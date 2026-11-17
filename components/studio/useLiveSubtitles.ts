"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { auth } from "@/lib/firebase";
import { wavOf } from "@/lib/moments-tidy-client";
import { SUBS, type SubLang } from "@/lib/studio";

// Automatic subtitles, on a speaker's own device (docs/STUDIO_SUBTITLES.md). While the editor has subtitles on and this person is on
// stage with theirs on, their own microphone (never the room's mix) is listened to here a few seconds at a time. A piece with speech
// in it is sent to be written down, and the words are posted to the room as their line. Silence, and a muted microphone, send nothing.
const RATE = 16_000;
const SPEECH = 0.012; // louder than this is taken as speech
const MIN_SPEECH_SEC = 0.35;

// The sound at 16 kHz, whatever rate the device records at.
export function to16k(pcm: Float32Array, rate: number): Float32Array {
  if (rate === RATE) return pcm;
  const n = Math.floor((pcm.length * RATE) / rate), out = new Float32Array(n), step = rate / RATE;
  for (let i = 0; i < n; i++) { const at = i * step, a = Math.floor(at), b = Math.min(pcm.length - 1, a + 1); out[i] = pcm[a] + (pcm[b] - pcm[a]) * (at - a); }
  return out;
}
// When to send what has been heard: after about 4 seconds at the next quiet moment, or at 6 seconds whatever is happening.
export const pieceReady = (seconds: number, quietNow: boolean) => seconds >= SUBS.maxPieceSec || (seconds >= SUBS.pieceSec && quietNow);

export function useLiveSubtitles({ roomId, on, micRef, lang, say }: {
  roomId: string; on: boolean; micRef: MutableRefObject<MediaStream | null>; lang: SubLang; say: (text: string, ms: number) => Promise<unknown>;
}): { listening: boolean; error: string } {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const sayRef = useRef(say); sayRef.current = say;
  const langRef = useRef(lang); langRef.current = lang;

  useEffect(() => {
    if (!on) { setListening(false); setError(""); return; }
    let ctx: AudioContext | null = null, source: MediaStreamAudioSourceNode | null = null, proc: ScriptProcessorNode | null = null, heard: MediaStream | null = null;
    let bufs: Float32Array[] = [], samples = 0, speech = 0, busy = false, stopped = false, waitUntil = 0;
    const reset = () => { bufs = []; samples = 0; speech = 0; };
    const send = async (pcm: Float32Array, ms: number) => {
      if (busy || Date.now() < waitUntil) return; // one at a time: a piece that arrives while another is being written is let go
      busy = true;
      try {
        const u = auth.currentUser;
        if (!u) return;
        const res = await fetch(`/api/studio/subtitles?room=${encodeURIComponent(roomId)}&lang=${langRef.current}`, { method: "POST", headers: { "Content-Type": "audio/wav", Authorization: `Bearer ${await u.getIdToken()}` }, body: wavOf(pcm, 0, pcm.length / RATE) as BodyInit, cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok) {
          // Not allowed, switched off or over the limit: say why and wait a while. A hiccup: just try the next piece.
          if (res.status === 403 || res.status === 429 || res.status === 503) { setError(j.error || "Subtitles aren't available just now."); waitUntil = Date.now() + 30_000; }
          return;
        }
        setError("");
        if (j.text && !stopped) await sayRef.current(j.text, ms).catch(() => {});
      } catch { /* offline for a moment: the next piece tries again */ } finally { busy = false; }
    };
    const stop = () => { proc?.disconnect(); source?.disconnect(); ctx?.close().catch(() => {}); proc = null; source = null; ctx = null; heard = null; reset(); };
    const start = (stream: MediaStream) => {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) { setError("This browser can't subtitle your microphone."); return; }
      try { ctx = new Ctx({ sampleRate: RATE }); } catch { ctx = new Ctx(); }
      const c = ctx, rate = c.sampleRate;
      source = c.createMediaStreamSource(stream);
      proc = c.createScriptProcessor(4096, 1, 1);
      const silent = c.createGain(); silent.gain.value = 0; // the processor only runs while it leads somewhere; nothing is played
      source.connect(proc); proc.connect(silent); silent.connect(c.destination);
      proc.onaudioprocess = (e) => {
        const d = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
        const loud = Math.sqrt(sum / d.length) > SPEECH;
        if (!loud && !samples) return; // nothing yet: wait for a voice
        bufs.push(new Float32Array(d)); samples += d.length; if (loud) speech += d.length;
        if (!pieceReady(samples / rate, !loud)) return;
        const all = new Float32Array(samples); let at = 0;
        for (const b of bufs) { all.set(b, at); at += b.length; }
        const spoke = speech / rate, ms = Math.round((samples / rate) * 1000);
        reset();
        if (spoke >= MIN_SPEECH_SEC) void send(to16k(all, rate), ms);
      };
      heard = stream; setListening(true);
    };
    // The microphone arrives when she comes on stage, and can be replaced; look for it every second.
    const watch = setInterval(() => {
      const mic = micRef.current;
      if (mic === heard) return;
      stop(); setListening(false);
      if (mic && mic.getAudioTracks().length) start(mic);
    }, 1000);
    return () => { stopped = true; clearInterval(watch); stop(); setListening(false); };
  }, [on, roomId, micRef]);

  return { listening, error };
}
