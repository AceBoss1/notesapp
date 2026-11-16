"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { MOMENTS_LIVE } from "@/lib/moments-rules";
import { CAPTION_STYLES, CAPTION_STYLE_LABEL, MOMENT_TIDY_LIVE, type CaptionStyle } from "@/lib/moments-tidy";
import { DEFAULT_TIDY_PREFS, saveTidyPrefs, tidyPrefs } from "@/lib/moments-tidy-client";

// Tidy up and captions (docs/MOMENTS_TIDY.md, mockup 6): what is offered when you make a video moment, and whether you see captions
// when you watch. Remembered on this device.
function TidySettings() {
  const [p, setP] = useState(DEFAULT_TIDY_PREFS);
  useEffect(() => { setP(tidyPrefs()); }, []);
  const set = (c: Parameters<typeof saveTidyPrefs>[0]) => setP(saveTidyPrefs(c));
  const row = (label: string, on: boolean, change: (v: boolean) => void) => (
    <label className="flex items-center justify-between gap-3 border-t border-rule py-2.5 first:border-t-0"><span className="text-ink">{label}</span><input type="checkbox" checked={on} onChange={(e) => change(e.target.checked)} className="h-4 w-4 accent-[#7A0328]" /></label>
  );
  return (
    <div className="mt-8">
      <h3 className="font-ui text-base font-bold text-ink">Video moments: tidy up and captions</h3>
      <div className="mt-2 text-sm">
        {row("✂️ Trim the pauses when I add a video or a voice-over", p.trim, (v) => set({ trim: v }))}
        {row("Show captions when I watch a moment that has them", p.cc, (v) => set({ cc: v }))}
        <label className="flex items-center justify-between gap-3 border-t border-rule py-2.5"><span className="text-ink">Caption look</span>
          <select value={p.style} onChange={(e) => set({ style: e.target.value as CaptionStyle })} className="rounded border border-rule bg-card px-2 py-1 text-sm">{CAPTION_STYLES.map((s) => <option key={s} value={s}>{CAPTION_STYLE_LABEL[s]}</option>)}</select>
        </label>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate">Trimming happens on your device; nothing is sent anywhere. For captions, only the sound is sent to be written down, and it isn&apos;t kept. English first; Pidgin works but makes more mistakes. These choices are remembered on this device.</p>
    </div>
  );
}

// Who can see your moments: your followers (the default) or anyone signed in. Blocked members never can either way.
export default function MomentSettings() {
  const [pub, setPub] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (MOMENTS_LIVE) api<{ momentsPublic: boolean }>("/api/moments/prefs").then((r) => setPub(r.momentsPublic)).catch(() => {});
  }, []);
  if (!MOMENTS_LIVE || pub === null) return null;
  async function change(next: boolean) {
    setError("");
    try { await api("/api/moments/prefs", { body: { momentsPublic: next } }); setPub(next); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); }
  }
  return (
    <div className="mt-10 border-t border-rule pt-6">
      <h2 className="font-display text-2xl text-ink">Moments privacy</h2>
      <fieldset className="mt-3 space-y-2 text-sm">
        <legend className="sr-only">Who can see my moments</legend>
        <label className="flex items-start gap-2"><input type="radio" name="moments-audience" checked={!pub} onChange={() => change(false)} className="mt-1" /><span><strong className="text-ink">Followers only</strong> <span className="text-slate">(recommended). Only people who follow your journal can see your moments.</span></span></label>
        <label className="flex items-start gap-2"><input type="radio" name="moments-audience" checked={pub} onChange={() => change(true)} className="mt-1" /><span><strong className="text-ink">Everyone</strong> <span className="text-slate">Any signed-in member who opens your profile can see, like and reply to your moments, even if they don&apos;t follow you.</span></span></label>
      </fieldset>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      {MOMENT_TIDY_LIVE && <TidySettings />}
    </div>
  );
}
