"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { MOMENTS_LIVE } from "@/lib/moments-rules";
import { CAPTION_STYLES, CAPTION_STYLE_LABEL, MOMENT_TIDY_LIVE, type CaptionStyle } from "@/lib/moments-tidy";
import { DEFAULT_TIDY_PREFS, saveTidyPrefs, tidyPrefs } from "@/lib/moments-tidy-client";
import { IconCc, IconMic, IconMusic, IconScissors } from "./icons";
import { Notice, Switch, cardCls } from "./tidy-parts";

// Tidy up and captions (docs/MOMENTS_TIDY.md; the owner's "Moments Redesign", Moda, 16 Nov 2026): what is offered when you make a
// video moment, and whether you see captions when you watch. Remembered on this device.
function TidySettings() {
  const [p, setP] = useState(DEFAULT_TIDY_PREFS);
  useEffect(() => { setP(tidyPrefs()); }, []);
  const set = (c: Parameters<typeof saveTidyPrefs>[0]) => setP(saveTidyPrefs(c));
  const row = "flex items-center gap-3 py-3.5";
  const label = "min-w-0 flex-1 font-ui text-[16px] text-ink";
  const know = "flex gap-3 font-ui text-[15px] leading-snug text-ink";
  return (
    <div className="mt-8">
      <h3 className="font-display text-2xl text-ink">Moment settings</h3>
      <div className="mt-3 grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="font-ui text-sm font-semibold text-slate">When I make a video moment</p>
          <div className={`${cardCls} divide-y divide-rule px-4`}>
            <div className={row}><IconScissors className="shrink-0 text-crimson" /><span className={label}>Offer to trim the pauses</span><Switch on={p.trim} onChange={(v) => set({ trim: v })} label="Offer to trim the pauses" /></div>
            <div className={row}><IconCc className="shrink-0 text-crimson" /><span className={label}>Add captions</span><Switch on={p.captions} onChange={(v) => set({ captions: v })} label="Add captions" /></div>
            <label className={row}><span className={label}>Caption look</span>
              <select value={p.style} onChange={(e) => set({ style: e.target.value as CaptionStyle })} className="rounded-full border border-rule bg-card px-3 py-1.5 font-ui text-[15px] font-bold text-ink">{CAPTION_STYLES.map((s) => <option key={s} value={s}>{CAPTION_STYLE_LABEL[s]}</option>)}</select>
            </label>
          </div>
          <p className="font-ui text-sm font-semibold text-slate">When I watch</p>
          <div className={`${cardCls} px-4`}><div className={row}><span className={label}>Show captions when there are any</span><Switch on={p.cc} onChange={(v) => set({ cc: v })} label="Show captions when there are any" /></div></div>
        </div>
        <div className="space-y-3">
          <p className="font-ui text-sm font-semibold text-slate">Good to know</p>
          <div className={`${cardCls} space-y-4 p-4`}>
            <p className={know}><IconScissors className="shrink-0 text-crimson" /><span>Trimming happens <b>on your phone</b>. Nothing is sent anywhere.</span></p>
            <p className={know}><IconCc className="shrink-0 text-crimson" /><span>For captions, <b>only the sound</b> is sent to be written down. It isn&apos;t kept afterwards.</span></p>
            <p className={know}><IconMic className="shrink-0 text-crimson" /><span>English first. Pidgin works but makes more mistakes.</span></p>
            <p className={know}><IconMusic className="shrink-0 text-crimson" /><span>A moment with a song and no speech has no captions.</span></p>
          </div>
          <Notice>Captions are checked like any other words on #NotesApp before a moment is shared. These choices are remembered on this device.</Notice>
        </div>
      </div>
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
