"use client";

import { useEffect, useMemo, useState } from "react";
import { findPauses, playSpans, spanTotal, type Span, type Word } from "@/lib/moments-tidy";
import { readSound, saveTidyPrefs, tidyPrefs, writeCaptions, type Sound } from "@/lib/moments-tidy-client";

// What the composer knows about the recording being tidied (docs/MOMENTS_TIDY.md): its sound, read on this device; the pauses found
// in it; what plays once they are out; and the captions, once she asks for them. One recording at a time: the voice-over when there
// is one (it is what's heard), else the video.
export function useTidy(source: Blob | null) {
  const [prefs, setPrefs] = useState(tidyPrefs);
  const [sound, setSound] = useState<Sound | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [trim, setTrimState] = useState(prefs.trim);
  const [captions, setCaptionsState] = useState(prefs.captions);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [words, setWords] = useState<Word[] | null>(null);
  const [writing, setWriting] = useState("");
  const [url, setUrl] = useState("");
  const change = (c: Parameters<typeof saveTidyPrefs>[0]) => setPrefs(saveTidyPrefs(c));

  useEffect(() => {
    setSound(null); setError(""); setWords(null); setKept(new Set()); setUrl("");
    if (!source) { setReading(false); return; }
    let live = true;
    setReading(true);
    readSound(source).then((s) => { if (live) setSound(s); }).catch((e) => { if (live) setError(e instanceof Error ? e.message : "We couldn't read the sound."); }).finally(() => { if (live) setReading(false); });
    const u = URL.createObjectURL(source); setUrl(u);
    return () => { live = false; URL.revokeObjectURL(u); };
  }, [source]);

  const pauses = useMemo(() => (sound ? findPauses(sound.levels, prefs.pause) : []), [sound, prefs.pause]);
  const cut = useMemo(() => (sound && pauses.length ? playSpans(sound.duration, pauses, kept) : null), [sound, pauses, kept]);
  const saved = sound && cut ? Math.max(0, sound.duration - spanTotal(cut)) : 0;
  const worth = saved >= 1 && !!cut?.length;
  // The stretches that will play: only when she has the trim on and it saves at least a second.
  const spans: Span[] | null = trim && worth ? cut : null;
  const after = sound ? (spans ? spanTotal(spans) : sound.duration) : 0;
  // A changed trim changes which words are heard, so captions are written again.
  useEffect(() => { setWords(null); }, [spans]);

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

  return {
    prefs, change, sound, reading, error, setError, url, pauses, kept, saved, worth, spans, after, words, setWords, writing, write,
    trim, setTrim: (v: boolean) => { setTrimState(v); change({ trim: v }); },
    captions, setCaptions: (v: boolean) => { setCaptionsState(v); change({ captions: v }); },
    toggleKeep: (i: number) => setKept((k) => { const n = new Set(k); if (n.has(i)) n.delete(i); else n.add(i); return n; }),
    resetKept: () => setKept(new Set()),
  };
}
export type Tidy = ReturnType<typeof useTidy>;
