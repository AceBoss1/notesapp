// Moments: tidy up and captions (docs/MOMENTS_TIDY.md). The rules, shared by the composer, the viewer, the server and the tests.
// Pure: no browser audio, no Firestore, no AI.
//
// Trim the pauses: nothing is re-made. A moment already plays one stretch of its video (clipStart to clipEnd); a trimmed moment keeps
// a list of stretches ("segments") and the player skips the pauses between them. Captions: the words that were said, each with its
// time in the recording, drawn by the player with the current word marked.
import { setting } from "@/lib/config";
import { MOMENT_VIDEO_MAX_SECONDS } from "./moments-rules";

// Hidden until switched on (a Vercel env var, then redeploy), like Moments itself. Captions also need the speech service's keys.
export const MOMENT_TIDY_LIVE = setting("NEXT_PUBLIC_MOMENT_TIDY_LIVE") === "true";

export type Span = [start: number, end: number]; // seconds in the recording
const r2 = (n: number) => Math.round(n * 100) / 100;
export const spanTotal = (spans: Span[]) => r2(spans.reduce((s, [a, b]) => s + (b - a), 0));

// ── Finding the pauses ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// `levels` is the loudness of the recording in equal steps (the page works it out from the sound, lib/moments-tidy-client.ts).
export const LEVEL_STEP = 0.02; // seconds per level
export const PAUSE_CHOICES = [0.25, 0.5, 1] as const; // "Take out pauses longer than"
export const DEFAULT_PAUSE = 0.5;
export const BREATH = 0.12; // kept on each side of a pause, so a word is never clipped

// Quiet means well below how loud the speech in this recording is, so a soft speaker and a noisy room both work.
export function quietBelow(levels: number[]): number {
  if (!levels.length) return 0;
  const sorted = [...levels].sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.9)], floor = sorted[Math.floor(sorted.length * 0.1)];
  return Math.max(0.004, floor + (loud - floor) * 0.12);
}

// The stretches to take out: quiet for longer than `minPause`, less a breath at each end.
export function findPauses(levels: number[], minPause: number = DEFAULT_PAUSE, step = LEVEL_STEP): Span[] {
  const limit = quietBelow(levels);
  const breath = Math.min(BREATH, minPause / 3); // a tighter trim keeps a shorter breath
  const out: Span[] = [];
  let from = -1;
  const close = (to: number) => {
    if (from < 0) return;
    const a = from * step, b = to * step;
    // A pause at the very start or end is taken whole; one in the middle keeps a breath each side.
    const start = from === 0 ? 0 : a + breath, end = to === levels.length ? b : b - breath;
    if (b - a >= minPause && end - start >= 0.1) out.push([r2(start), r2(end)]);
    from = -1;
  };
  levels.forEach((l, i) => { if (l < limit) { if (from < 0) from = i; } else close(i); });
  close(levels.length);
  return out;
}

// What plays once the pauses are out. `keep` names pauses (by their place in the list) the member chose to leave in.
export function playSpans(duration: number, pauses: Span[], keep: Iterable<number> = []): Span[] {
  const kept = new Set(keep);
  const out: Span[] = [];
  let at = 0;
  pauses.forEach(([a, b], i) => {
    if (kept.has(i) || b <= at) return;
    if (a - at >= 0.15) out.push([r2(at), r2(a)]);
    at = Math.max(at, b);
  });
  if (duration - at >= 0.15) out.push([r2(at), r2(duration)]);
  return out;
}

// A long recording as several moments: its stretches dealt out in order, each moment at most 90 seconds of playing time. With room
// for fewer moments than it needs, the rest is left out (as an untrimmed long video already is).
export function splitSpans(spans: Span[], parts: number, max = MOMENT_VIDEO_MAX_SECONDS): Span[][] {
  const out: Span[][] = [];
  let cur: Span[] = [], used = 0;
  for (const [a0, b] of spans) {
    let a = a0;
    while (b - a > 0.01) {
      if (max - used < 0.2) { out.push(cur); cur = []; used = 0; if (out.length >= parts) return out; }
      const take = Math.min(b - a, max - used);
      cur.push([r2(a), r2(a + take)]);
      used += take; a += take;
    }
  }
  if (cur.length && out.length < parts) out.push(cur);
  return out;
}
export const partsForSpans = (spans: Span[]) => Math.max(1, Math.ceil((spanTotal(spans) - 1) / MOMENT_VIDEO_MAX_SECONDS));

// What the server keeps: stretches in order, inside the recording, not overlapping, each long enough to hear.
export const MAX_SPANS = 80;
export function cleanSpans(raw: unknown, duration: number): Span[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  if (raw.length > MAX_SPANS) throw new Error("That video has too many cuts. Choose a longer pause to trim.");
  const out: Span[] = [];
  let last = 0;
  for (const s of raw) {
    const a = Array.isArray(s) ? Number(s[0]) : NaN, b = Array.isArray(s) ? Number(s[1]) : NaN;
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < last - 0.001 || b - a < 0.1 || b > duration + 1) throw new Error("That trim isn't valid. Try trimming again.");
    out.push([r2(a), r2(b)]);
    last = b;
  }
  return out;
}

// ── Playing ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Where the player should be: inside a stretch (stay), in a pause (jump to the next stretch), or past the last one (finished).
export function playhead(spans: Span[], t: number): { seek?: number; done?: boolean } {
  for (const [a, b] of spans) {
    if (t < a - 0.05) return { seek: a };
    if (t < b - 0.03) return {};
  }
  return { done: true };
}
// What a message from the video player says, whichever way it is worded. Cloudflare Stream's player posts its time in more than one
// shape (an object of properties, or one named property and its value), so every shape seen or documented is read.
export function playerNews(data: unknown): { time?: number; duration?: number; ended?: boolean } {
  let d: unknown = data;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { return {}; } }
  if (!d || typeof d !== "object") return {};
  const o = d as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
  const inner = [o.value, o.data, o.detail, o.payload].filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  const named = (key: string) => ([o.property, o.key, o.name, o.propertyName, o.prop].includes(key) ? num(o.value ?? o.data) : undefined);
  const find = (key: string) => named(key) ?? num(o[key]) ?? inner.map((x) => num(x[key])).find((x) => x !== undefined);
  const words = [o.__privateUnstableMessageType, o.event, o.type, o.eventName, o.name].filter((x) => typeof x === "string");
  const time = find("currentTime"), duration = find("duration");
  return { ...(time !== undefined ? { time } : {}), ...(duration !== undefined ? { duration } : {}), ...(words.includes("ended") ? { ended: true } : {}) };
}

// Where the video has got to, between and without readings from the player. With regular readings it fills the gaps (and stops a
// second and a half after the last one: the video has paused or is loading). With none, or only the first, it keeps time by the
// clock from when the video started, so captions still move.
export function playClock(start: number) {
  let t = start, at = 0, readings = 0;
  return {
    begin(now: number) { if (!at) at = now; },
    feed(time: number, now: number) { if (time !== t || !at) readings++; t = time; at = now; },
    jump(time: number, now: number) { t = time; at = now; },
    at(now: number) { if (!at) return t; const gone = (now - at) / 1000; return r2(t + (readings >= 3 ? Math.min(gone, 1.5) : gone)); },
    get readings() { return readings; },
  };
}

// How much has played by recording time `t`: for the progress bar, and to place captions.
export function playedAt(spans: Span[], t: number): number {
  let s = 0;
  for (const [a, b] of spans) { if (t <= a) break; s += Math.min(t, b) - a; }
  return r2(s);
}

// ── Captions ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Word = { w: string; s: number; e: number; u?: boolean }; // u: the speech service was unsure of it
export const CAPTION_STYLES = ["clean", "bold", "colour"] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number];
export const CAPTION_STYLE_LABEL: Record<CaptionStyle, string> = { clean: "Clean", bold: "Bold word", colour: "Colour word" };
export const CAPTION_PLACES = ["middle", "lower"] as const;
export type CaptionPlace = (typeof CAPTION_PLACES)[number];
export const CAPTION_LANGS = [{ id: "en", label: "English" }, { id: "pcm", label: "Pidgin (less accurate)" }] as const;
export type CaptionLang = (typeof CAPTION_LANGS)[number]["id"];
export const isCaptionLang = (v: unknown): v is CaptionLang => v === "en" || v === "pcm";
export type Captions = { words: Word[]; style: CaptionStyle; place: CaptionPlace; of: "video" | "voice" };
export const MAX_WORDS = 420; // 90 seconds of fast speech
export const WORD_MAX = 40;

const tidyWord = (v: unknown) => (typeof v === "string" ? v : "").replace(/[\u0000-\u001f\u007f<>]+/g, "").replace(/\s+/g, " ").trim().slice(0, WORD_MAX);

// Whatever the speech service or the page sends, made safe: real words, in order, with sensible times.
export function cleanWords(raw: unknown, duration = Infinity): Word[] {
  const out: Word[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const w = tidyWord(o.w ?? o.word ?? o.text);
    const s = Number(o.s ?? o.start), e = Number(o.e ?? o.end);
    if (!w || !Number.isFinite(s) || !Number.isFinite(e) || s < 0 || s > duration + 1) continue;
    const start = Math.max(r2(s), out.length ? out[out.length - 1].s : 0);
    out.push({ w, s: start, e: Math.max(start + 0.05, r2(Math.min(e, duration + 1))), ...(o.u === true ? { u: true } : {}) });
    if (out.length >= MAX_WORDS) break;
  }
  return out;
}
export function cleanCaptions(raw: unknown, of: "video" | "voice", duration: number): Captions | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const words = cleanWords(o.words, duration);
  if (!words.length) return null;
  return {
    words, of,
    style: CAPTION_STYLES.includes(o.style as CaptionStyle) ? (o.style as CaptionStyle) : "bold",
    place: CAPTION_PLACES.includes(o.place as CaptionPlace) ? (o.place as CaptionPlace) : "lower",
  };
}
export const captionText = (c: Pick<Captions, "words"> | null | undefined) => (c ? c.words.map((w) => w.w).join(" ") : "");

// Words into the lines shown on screen: short enough to read at a glance, broken at a pause or the end of a sentence.
export type Line = { s: number; e: number; words: Word[]; from: number }; // from: the first word's place in the whole list
export const LINE_CHARS = 30;
export function captionLines(words: Word[], maxChars = LINE_CHARS): Line[] {
  const out: Line[] = [];
  let cur: Word[] = [], len = 0, from = 0;
  const push = () => { if (cur.length) out.push({ s: cur[0].s, e: cur[cur.length - 1].e, words: cur, from }); };
  words.forEach((w, i) => {
    const prev = cur[cur.length - 1];
    const gap = prev ? w.s - prev.e : 0;
    const ended = prev ? /[.!?]$/.test(prev.w) : false;
    if (cur.length && (len + 1 + w.w.length > maxChars || gap > 0.7 || (ended && len > maxChars / 2))) { push(); cur = []; len = 0; from = i; }
    cur.push(w); len += (len ? 1 : 0) + w.w.length;
  });
  push();
  return out;
}
// The line on screen at recording time `t`, and which of its words is being said. A line stays up briefly after its last word.
export function captionAt(lines: Line[], t: number): { line: Line; word: number } | null {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], until = Math.min(l.e + 0.6, lines[i + 1]?.s ?? Infinity);
    if (t < l.s - 0.05) return null;
    if (t <= until) {
      let word = -1;
      l.words.forEach((w, j) => { if (t >= w.s - 0.03) word = j; });
      return { line: l, word };
    }
  }
  return null;
}

// She corrected a line: the new words share the line's time evenly by their length, so the timing stays.
export function editLine(words: Word[], line: Line, text: string): Word[] {
  const next = text.replace(/\s+/g, " ").trim().split(" ").map(tidyWord).filter(Boolean);
  const before = words.slice(0, line.from), after = words.slice(line.from + line.words.length);
  if (!next.length) return [...before, ...after];
  const same = next.length === line.words.length;
  const total = next.reduce((n, w) => n + w.length, 0), span = line.e - line.s;
  let at = line.s;
  const made = next.map((w, i): Word => {
    if (same) return { w, s: line.words[i].s, e: line.words[i].e };
    const d = (span * w.length) / total, word = { w, s: r2(at), e: r2(at + d) };
    at += d;
    return word;
  });
  return [...before, ...made, ...after].slice(0, MAX_WORDS);
}

// The words that belong to one moment of a longer recording: those said inside its stretches.
export const wordsIn = (words: Word[], spans: Span[]) => words.filter((w) => spans.some(([a, b]) => w.s >= a - 0.05 && w.s < b));
// Sound sent for captions comes in pieces (lib/moments-tidy-client.ts); each piece's words are moved to their place in the recording.
export const shiftWords = (words: Word[], by: number): Word[] => words.map((w) => ({ ...w, s: r2(w.s + by), e: r2(w.e + by) }));

// ── The speech service's answer ──────────────────────────────────────────────────────────────────────────────────────────────────
// Whisper answers with words and their times, at the top level or inside segments, depending on the version. When there are only
// segment times, each segment's words share its time evenly.
export function wordsFromSpeech(result: unknown): Word[] {
  const o = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  const direct = cleanWords(o.words);
  if (direct.length) return direct;
  const out: Word[] = [];
  for (const seg of Array.isArray(o.segments) ? o.segments : []) {
    const s = (seg && typeof seg === "object" ? seg : {}) as Record<string, unknown>;
    const inner = cleanWords(s.words);
    if (inner.length) { out.push(...inner); continue; }
    const text = typeof s.text === "string" ? s.text.trim() : "", a = Number(s.start), b = Number(s.end);
    if (!text || !Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue;
    out.push(...editLine([], { s: a, e: b, words: [], from: 0 }, text).map((w) => ({ ...w, u: true })));
  }
  return cleanWords(out);
}

// ── Limits ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const CAPTION_CHUNK_SECONDS = 45; // the sound is sent in pieces this long
export const CAPTION_CHUNK_MAX_BYTES = 2_000_000; // 45 seconds of 16 kHz mono sound is about 1.4 MB
export const CAPTION_CHUNKS_PER_DAY = 120; // per member: about 90 minutes of speech a day
