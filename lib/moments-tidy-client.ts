"use client";

import { auth } from "./firebase";
import {
  CAPTION_CHUNK_SECONDS, DEFAULT_PAUSE, LEVEL_STEP, PAUSE_CHOICES, cleanWords, shiftWords, wordsIn,
  type CaptionLang, type CaptionPlace, type CaptionStyle, type Span, type Word,
} from "./moments-tidy";

// The browser side of Moments tidy up and captions (lib/moments-tidy.ts has the rules). The recording's sound is read on the device:
// its loudness finds the pauses (nothing is sent anywhere for that), and for captions only the sound, made small (16 kHz, one channel),
// goes to our server a piece at a time.
export const SOUND_MAX_BYTES = 300 * 1024 * 1024; // a bigger file isn't read on the device; it can still be shared untrimmed
const RATE = 16_000;

export type Sound = { duration: number; levels: number[]; pcm: Float32Array };

export async function readSound(file: Blob): Promise<Sound> {
  if (file.size > SOUND_MAX_BYTES) throw new Error("That file is too big to tidy on this device. You can still share it as it is.");
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx || typeof OfflineAudioContext === "undefined") throw new Error("This browser can't read the sound, so it can't be tidied here.");
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try { decoded = await ctx.decodeAudioData(await file.arrayBuffer()); }
  catch { throw new Error("We couldn't read the sound in that recording, so it can't be tidied. You can still share it as it is."); }
  finally { ctx.close().catch(() => {}); }
  // One channel at 16 kHz: small enough to send for captions, and plenty to hear where the pauses are.
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
  const src = off.createBufferSource();
  src.buffer = decoded; src.connect(off.destination); src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const step = Math.round(LEVEL_STEP * RATE), levels: number[] = [];
  for (let i = 0; i + step <= pcm.length; i += step) {
    let sum = 0;
    for (let j = i; j < i + step; j++) sum += pcm[j] * pcm[j];
    levels.push(Math.sqrt(sum / step));
  }
  return { duration: decoded.duration, levels, pcm };
}

// A stretch of the sound as a WAV file (16-bit, 16 kHz, one channel).
export function wavOf(pcm: Float32Array, from: number, to: number): Uint8Array {
  const a = Math.max(0, Math.floor(from * RATE)), b = Math.min(pcm.length, Math.ceil(to * RATE)), n = Math.max(0, b - a);
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (at: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(at + i, s.charCodeAt(i)); };
  str(0, "RIFF"); out.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, RATE, true); out.setUint32(28, RATE * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, "data"); out.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[a + i])) * 0x7fff, true);
  return new Uint8Array(out.buffer);
}

// The pieces of the recording to send for captions: at most 45 seconds each, broken at a pause where there is one.
export function captionPieces(spans: Span[], max = CAPTION_CHUNK_SECONDS): Span[] {
  const out: Span[] = [];
  let from = -1, to = -1;
  for (const [a0, b] of spans) {
    let a = a0;
    while (b - a > 0.01) {
      if (from < 0) { from = a; to = a; }
      if (b - from <= max) { to = b; a = b; }
      else if (a - from > 1) { out.push([from, to]); from = -1; } // break at this pause
      else { to = from + max; out.push([from, to]); a = to; from = -1; } // one long stretch: cut it at 45 seconds
    }
  }
  if (from >= 0 && to > from) out.push([from, to]);
  return out;
}

// What was said in the stretches that play, with each word's time in the recording. Only the sound is sent; it isn't kept.
export async function writeCaptions(sound: Sound, spans: Span[], lang: CaptionLang, onProgress: (done: number, of: number) => void): Promise<Word[]> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in first.");
  const pieces = captionPieces(spans);
  const words: Word[] = [];
  for (let i = 0; i < pieces.length; i++) {
    onProgress(i, pieces.length);
    const [a, b] = pieces[i];
    const res = await fetch(`/api/moments/captions?lang=${lang}`, { method: "POST", headers: { "Content-Type": "audio/wav", Authorization: `Bearer ${await user.getIdToken()}` }, body: wavOf(sound.pcm, a, b) as BodyInit, cache: "no-store" });
    const j = (await res.json().catch(() => ({}))) as { words?: unknown; error?: string };
    if (!res.ok) throw new Error(j.error || "Captions couldn't be written just now.");
    words.push(...shiftWords(cleanWords(j.words), a));
  }
  onProgress(pieces.length, pieces.length);
  return wordsIn(cleanWords(words, sound.duration), spans);
}

export async function tidyStatus(): Promise<{ tidy: boolean; captions: boolean }> {
  const user = auth.currentUser;
  if (!user) return { tidy: false, captions: false };
  try {
    const r = await fetch("/api/moments/captions", { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store" });
    return r.ok ? await r.json() : { tidy: false, captions: false };
  } catch { return { tidy: false, captions: false }; }
}

// Her choices, remembered on this device (mockup 6): what to offer when she makes a moment, and whether she sees captions when watching.
export type TidyPrefs = { trim: boolean; captions: boolean; pause: number; style: CaptionStyle; place: CaptionPlace; lang: CaptionLang; cc: boolean };
export const DEFAULT_TIDY_PREFS: TidyPrefs = { trim: true, captions: true, pause: DEFAULT_PAUSE, style: "bold", place: "lower", lang: "en", cc: true };
const KEY = "moment-tidy";
export function tidyPrefs(): TidyPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<TidyPrefs>;
    return { ...DEFAULT_TIDY_PREFS, ...p, pause: (PAUSE_CHOICES as readonly number[]).includes(Number(p.pause)) ? Number(p.pause) : DEFAULT_PAUSE };
  } catch { return DEFAULT_TIDY_PREFS; }
}
export function saveTidyPrefs(change: Partial<TidyPrefs>): TidyPrefs {
  const next = { ...tidyPrefs(), ...change };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}
