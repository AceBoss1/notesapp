"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CAPTION_LANGS, CAPTION_PLACES, CAPTION_STYLES, CAPTION_STYLE_LABEL, PAUSE_CHOICES, captionLines, editLine, findPauses, playSpans, playhead, spanTotal,
  type CaptionLang, type Captions, type Span, type Word,
} from "@/lib/moments-tidy";
import { readSound, saveTidyPrefs, tidyPrefs, writeCaptions, type Sound } from "@/lib/moments-tidy-client";

// Tidy up, in the composer (docs/MOMENTS_TIDY.md, mockups 1 to 3): Trim the pauses and Add captions, for a video or a voice-over.
// The sound is read on this device. Nothing is shared unseen: the trim can be played and changed, and captions are read and corrected
// here before the moment is shared.
export type Tidied = { spans: Span[] | null; playSec: number | null; captions: Omit<Captions, "of"> | null };
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const PAUSE_LABEL: Record<number, string> = { 0.25: "¼ second", 0.5: "½ second", 1: "1 second" };

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-crimson" : "bg-[#CFC3BC]"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.125rem]" : "left-0.5"}`} />
    </button>
  );
}

// The sound wave, with the pauses that will be skipped in grey.
function Wave({ sound, pauses, kept }: { sound: Sound; pauses: Span[]; kept: Set<number> }) {
  const bars = useMemo(() => {
    const n = 60, per = Math.max(1, Math.floor(sound.levels.length / n)), max = Math.max(0.0001, ...sound.levels);
    return Array.from({ length: n }, (_, i) => {
      const slice = sound.levels.slice(i * per, (i + 1) * per), t = ((i + 0.5) * per * sound.duration) / Math.max(1, sound.levels.length);
      const cut = pauses.some(([a, b], j) => !kept.has(j) && t >= a && t <= b);
      return { h: Math.max(6, Math.round((Math.max(0, ...slice) / max) * 100)), cut };
    });
  }, [sound, pauses, kept]);
  return (
    <div className="flex h-12 items-center gap-0.5 rounded-xl border border-rule bg-white px-2" aria-hidden>
      {bars.map((b, i) => <i key={i} className="flex-1 rounded-sm" style={{ height: b.cut ? 4 : `${b.h}%`, background: b.cut ? "#D9CDC6" : "rgb(122 3 40)" }} />)}
    </div>
  );
}

export default function TidyPanel({ source, kind, captionsOn, allowCaptions = true, onChange }: {
  source: Blob; kind: "video" | "voice"; captionsOn: boolean; allowCaptions?: boolean; onChange: (t: Tidied) => void;
}) {
  const [prefs, setPrefs] = useState(tidyPrefs);
  const [sound, setSound] = useState<Sound | null>(null);
  const [reading, setReading] = useState(true);
  const [error, setError] = useState("");
  const [trim, setTrim] = useState(prefs.trim);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [openTrim, setOpenTrim] = useState(false);
  const [words, setWords] = useState<Word[] | null>(null);
  const [writing, setWriting] = useState<string>("");
  const [editing, setEditing] = useState(-1);
  const [draft, setDraft] = useState("");
  const [url, setUrl] = useState("");
  const player = useRef<HTMLMediaElement | null>(null);
  const change = (c: Parameters<typeof saveTidyPrefs>[0]) => setPrefs(saveTidyPrefs(c));

  useEffect(() => {
    let live = true;
    setSound(null); setReading(true); setError(""); setWords(null); setKept(new Set());
    readSound(source).then((s) => { if (live) setSound(s); }).catch((e) => { if (live) setError(e instanceof Error ? e.message : "We couldn't read the sound."); }).finally(() => { if (live) setReading(false); });
    const u = URL.createObjectURL(source); setUrl(u);
    return () => { live = false; URL.revokeObjectURL(u); };
  }, [source]);

  const pauses = useMemo(() => (sound ? findPauses(sound.levels, prefs.pause) : []), [sound, prefs.pause]);
  const spans = useMemo(() => (sound && trim && pauses.length ? playSpans(sound.duration, pauses, kept) : null), [sound, trim, pauses, kept]);
  const after = sound ? (spans ? spanTotal(spans) : sound.duration) : 0;
  const saved = sound ? Math.max(0, sound.duration - after) : 0;
  const worth = saved >= 1;

  // Tell the composer what will be shared, each time it changes.
  const out = useRef(onChange); out.current = onChange;
  useEffect(() => {
    const useSpans = spans && worth && spans.length ? spans : null;
    out.current({ spans: useSpans, playSec: useSpans ? after : null, captions: words?.length ? { words, style: prefs.style, place: prefs.place } : null });
  }, [spans, worth, after, words, prefs.style, prefs.place]);
  // A changed trim changes which words are heard, so captions are written again.
  useEffect(() => { setWords(null); }, [spans]);

  // Playing the result here: the same skipping the viewer does.
  const onTime = () => { const p = player.current; if (!p || !spans) return; const h = playhead(spans, p.currentTime); if (h.seek !== undefined) p.currentTime = h.seek; else if (h.done) { p.pause(); p.currentTime = spans[0][0]; } };

  const write = async () => {
    if (!sound) return;
    setWriting("Listening…"); setError("");
    try {
      const w = await writeCaptions(sound, spans ?? [[0, sound.duration]], prefs.lang, (d, n) => setWriting(n > 1 ? `Writing captions… ${d} of ${n}` : "Writing captions…"));
      setWords(w);
      if (!w.length) setError("We didn't hear any speech to caption.");
    } catch (e) { setError(e instanceof Error ? e.message : "Captions couldn't be written just now."); }
    finally { setWriting(""); }
  };
  const lines = useMemo(() => (words ? captionLines(words) : []), [words]);
  const saveLine = (i: number) => { if (words) setWords(editLine(words, lines[i], draft)); setEditing(-1); };

  const what = kind === "video" ? "video" : "voice-over";
  if (reading) return <p className="mt-3 rounded border border-rule bg-paper p-3 text-xs text-slate" role="status">Listening to your {what} for pauses…</p>;
  if (!sound) return error ? <p className="mt-3 rounded border border-rule bg-paper p-3 text-xs text-slate" role="status">{error}</p> : null;
  return (
    <div className="mt-3 rounded-xl border border-rule bg-paper p-3 text-sm">
      <p className="font-bold text-ink">Tidy up {kind === "voice" ? "the voice-over" : ""}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-ink">✂️ Trim the pauses<span className="block text-xs text-slate">{!pauses.length ? "No long pauses found" : trim && worth ? `Saves ${Math.round(saved)} seconds: ${clock(sound.duration)} becomes ${clock(after)}` : trim ? "Nothing worth trimming" : `${pauses.length} pause${pauses.length === 1 ? "" : "s"} found`}</span></span>
        <Switch on={trim && pauses.length > 0} disabled={!pauses.length} onChange={(v) => { setTrim(v); change({ trim: v }); }} label="Trim the pauses" />
      </div>
      {trim && pauses.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setOpenTrim((v) => !v)} aria-expanded={openTrim} className="text-xs font-semibold text-crimson underline">{openTrim ? "Hide the trim" : "Check the trim"}</button>
          {openTrim && (
            <div className="mt-2 space-y-2">
              {kind === "video"
                ? <video ref={(el) => { player.current = el; }} src={url} controls playsInline onTimeUpdate={onTime} onPlay={onTime} className="max-h-48 w-full rounded-lg bg-black" />
                : <audio ref={(el) => { player.current = el; }} src={url} controls onTimeUpdate={onTime} onPlay={onTime} className="h-9 w-full" />}
              <Wave sound={sound} pauses={pauses} kept={kept} />
              <p className="text-[11px] text-slate"><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-crimson align-middle" />You speaking <i className="ml-2 mr-1 inline-block h-2 w-2 rounded-sm bg-[#D9CDC6] align-middle" />Pauses taken out ({pauses.length - kept.size})</p>
              <p className="text-xs font-bold text-ink">Take out pauses longer than</p>
              <div className="flex flex-wrap gap-1.5">
                {PAUSE_CHOICES.map((p) => <button key={p} type="button" aria-pressed={prefs.pause === p} onClick={() => { setKept(new Set()); change({ pause: p }); }} className={`rounded-full border px-3 py-1 text-xs font-semibold ${prefs.pause === p ? "border-crimson bg-crimson text-white" : "border-rule bg-white text-ink"}`}>{PAUSE_LABEL[p]}</button>)}
              </div>
              <p className="text-[11px] text-slate">A short breath is kept on each side, so it never cuts inside a word. Nothing is deleted: the moment skips the grey parts when it plays.</p>
              {pauses.length <= 12 && (
                <details className="text-xs text-slate"><summary className="cursor-pointer">Keep a pause</summary>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {pauses.map(([a, b], i) => <button key={i} type="button" aria-pressed={kept.has(i)} onClick={() => setKept((k) => { const n = new Set(k); if (n.has(i)) n.delete(i); else n.add(i); return n; })} className={`rounded-full border px-2.5 py-1 ${kept.has(i) ? "border-crimson bg-[#FBF0F3] text-crimson" : "border-rule bg-white text-ink"}`}>{kept.has(i) ? "Kept" : "Keep"} {clock(a)} ({(b - a).toFixed(1)}s)</button>)}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {allowCaptions && captionsOn && (
        <div className="mt-3 border-t border-rule pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink">💬 Captions<span className="block text-xs text-slate">{words?.length ? `${words.length} words. Read them through before you share.` : "Shows each word as you say it"}</span></span>
            {words?.length ? <button type="button" onClick={() => setWords(null)} className="rounded-full border border-rule bg-white px-3 py-1 text-xs font-semibold text-ink">Remove</button>
              : <button type="button" onClick={write} disabled={!!writing} className="rounded-full bg-crimson px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">{writing || "Write captions"}</button>}
          </div>
          {!words?.length && (
            <label className="mt-2 flex items-center gap-2 text-xs text-slate">I&apos;m speaking
              <select value={prefs.lang} onChange={(e) => change({ lang: e.target.value as CaptionLang })} className="rounded border border-rule bg-white px-2 py-1 text-xs text-ink">{CAPTION_LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
            </label>
          )}
          {words && words.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-slate">Tap a line to fix a word. Names and places are the usual slips.</p>
              {lines.map((l, i) => editing === i ? (
                <form key={i} onSubmit={(e) => { e.preventDefault(); saveLine(i); }} className="flex gap-1.5">
                  <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={120} aria-label={`Caption at ${clock(l.s)}`} className="min-w-0 flex-1 rounded-lg border-2 border-crimson bg-white px-2 py-1.5 text-[13px] text-ink" />
                  <button type="submit" className="rounded-lg bg-crimson px-3 text-xs font-bold text-white">Save</button>
                </form>
              ) : (
                <button key={i} type="button" onClick={() => { setEditing(i); setDraft(l.words.map((w) => w.w).join(" ")); }} className="flex w-full gap-2 rounded-lg border border-rule bg-white px-2 py-1.5 text-left text-[13px] leading-snug text-ink">
                  <small className="w-8 shrink-0 pt-0.5 text-[10.5px] text-slate">{clock(l.s)}</small>
                  <span>{l.words.map((w, j) => <span key={j} className={w.u ? "underline decoration-[#E0123E] decoration-wavy underline-offset-4" : ""}>{w.w}{" "}</span>)}</span>
                </button>
              ))}
              <p className="pt-1 text-xs font-bold text-ink">Look</p>
              <div className="grid grid-cols-3 gap-1.5">
                {CAPTION_STYLES.map((s) => <button key={s} type="button" aria-pressed={prefs.style === s} onClick={() => change({ style: s })} className={`rounded-lg bg-[#2A1712] px-1 py-2.5 text-[11px] font-extrabold text-white ${prefs.style === s ? "outline outline-2 outline-offset-1 outline-crimson" : ""}`}>{CAPTION_STYLE_LABEL[s]}</button>)}
              </div>
              <p className="pt-1 text-xs font-bold text-ink">Where</p>
              <div className="flex gap-1.5">
                {CAPTION_PLACES.map((p) => <button key={p} type="button" aria-pressed={prefs.place === p} onClick={() => change({ place: p })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${prefs.place === p ? "border-crimson bg-crimson text-white" : "border-rule bg-white text-ink"}`}>{p === "middle" ? "Middle" : "Lower third"}</button>)}
              </div>
              <p className="rounded-lg border border-[#F1D48A] bg-[#FFF4D6] px-2.5 py-1.5 text-[11.5px] leading-snug text-[#5a4300]">Captions are written by AI and can be wrong. You are sharing them, so please read them through. Only the sound was sent to write them, and it isn&apos;t kept.</p>
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}
