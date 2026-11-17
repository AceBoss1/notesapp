"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { uploadToR2 } from "@/lib/upload";
import {
  LOWER_STYLES, SPONSOR_SLOTS, STUDIO_CLIP_MAX, STUDIO_CLIP_TYPES, STUDIO_LAYOUTS, STUDIO_MAX, STUDIO_THEMES, SUB_LOOKS, SUB_LOOK_LABEL, TICKER_SPEEDS, clipKindOf,
  type StudioClipKind, type StudioComment, type StudioPatch, type StudioState,
} from "@/lib/studio";

// The studio's desk (lib/studio.ts): what the host and the editors change during a live. Each control sends one step to the server
// ({ action: "studio", op, … } on /api/community/rooms), which checks who may and writes the room; the picture above then changes for
// everyone. canEdit: holds "studio" (the graphics, clips, sponsor). canAir: holds "onair" (comments on air and the queue).
type Act = (body: Record<string, unknown>) => Promise<unknown>;
type Saved = { url: string; kind: StudioClipKind; label: string };
const CLIPS_KEY = "nls-clips";
const card = "rounded-2xl bg-white/[0.06] p-3";
const input = "w-full rounded-lg bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-white/40";
const chip = (on: boolean) => `rounded-full px-3 py-1.5 font-ui text-[11px] font-semibold ${on ? "bg-white text-ink" : "bg-white/10 text-white/80 hover:bg-white/20"} disabled:opacity-40`;

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? "bg-[#E5122F]" : "bg-white/20"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

async function uploadClip(file: File): Promise<string> {
  const type = STUDIO_CLIP_TYPES[file.type];
  if (!type) throw new Error("Use an MP4 or WebM video, or an MP3, M4A, WAV or OGG sound.");
  if (file.size > STUDIO_CLIP_MAX[type.kind]) throw new Error(`That file is too large (at most ${Math.round(STUDIO_CLIP_MAX[type.kind] / 1048576)} MB).`);
  const u = auth.currentUser;
  if (!u) throw new Error("Sign in to upload.");
  const res = await fetch("/api/studio/upload", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await u.getIdToken()}` }, body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Couldn't start the upload.");
  const put = await fetch(j.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new Error("The upload didn't finish. Try again.");
  return String(j.publicUrl);
}

export default function StudioControls({ studio, isHost, canEdit, canAir, stage, nameOf, act, onError, onModerators }: {
  studio: StudioState; isHost: boolean; canEdit: boolean; canAir: boolean; stage: string[]; nameOf: (uid: string) => string;
  act: Act; onError: (m: string) => void; onModerators?: () => void;
}) {
  const [busy, setBusy] = useState("");
  const run = async (tag: string, body: Record<string, unknown>) => {
    setBusy(tag);
    try { await act({ action: "studio", ...body }); } catch (e) { onError(e instanceof Error ? e.message : "Couldn't change the studio."); } finally { setBusy(""); }
  };
  const set = (tag: string, patch: StudioPatch) => run(tag, { op: "set", patch });

  // What is being typed, kept apart from what is on air until Show or Update is pressed.
  const [lower, setLower] = useState(studio.lower);
  const [lines, setLines] = useState(studio.ticker.lines.join("\n"));
  const [tag, setTag] = useState(studio.ticker.tag);
  const [caption, setCaption] = useState("");
  // Automatic subtitles need the speech service's keys (CLOUDFLARE_AI_TOKEN); until they are set, the switch says so.
  const [speech, setSpeech] = useState<boolean | null>(null);
  useEffect(() => { fetch("/api/studio/subtitles", { cache: "no-store" }).then((r) => r.json()).then((j) => setSpeech(j.ready === true)).catch(() => setSpeech(false)); }, []);
  const [show, setShow] = useState(studio.bug.show);
  const [place, setPlace] = useState(studio.bug.place);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [up, setUp] = useState("");
  const [ad, setAd] = useState(false);
  const [slot, setSlot] = useState(studio.sponsor?.slot ?? "corner");
  useEffect(() => { try { setSaved(JSON.parse(localStorage.getItem(CLIPS_KEY) || "[]")); } catch { /* none kept */ } }, []);
  const keep = (list: Saved[]) => { setSaved(list); try { localStorage.setItem(CLIPS_KEY, JSON.stringify(list.slice(-12))); } catch { /* this visit only */ } };
  const clipFile = useRef<HTMLInputElement>(null), logoFile = useRef<HTMLInputElement>(null), sponsorFile = useRef<HTMLInputElement>(null);

  const pickFile = async (what: "clip" | "logo" | "sponsor", f: File | undefined) => {
    if (!f) return;
    setUp(what);
    try {
      const url = f.type.startsWith("image/") ? await uploadToR2(f, "poster") : await uploadClip(f);
      if (what === "logo") { if (!f.type.startsWith("image/")) throw new Error("A logo is a picture: PNG, WebP or JPEG."); await set("logo", { bug: { logo: url, on: true } }); }
      else if (what === "sponsor") { if (clipKindOf(url) === "audio") throw new Error("The sponsor spot takes a picture or a video (played without sound)."); await set("sponsor", { sponsor: { url, slot, label: "" } }); }
      else keep([...saved, { url, kind: clipKindOf(url), label: f.name.replace(/\.[A-Za-z0-9]{1,5}$/, "").slice(0, STUDIO_MAX.label) }]);
    } catch (e) { onError(e instanceof Error ? e.message : "Couldn't upload that."); } finally { setUp(""); }
  };
  const tickerLines = lines.split("\n").map((l) => l.trim()).filter(Boolean);
  const airing = studio.comment;

  if (!studio.on) {
    return (
      <div className={card}>
        <p className="font-ui text-sm font-bold">🎬 Notes Live Studio</p>
        <p className="mt-1 text-xs text-white/65">A broadcast look for this live: your logo, a lower third with the headline and the speaker&apos;s name, a scrolling ticker, subtitles, viewers&apos; comments on air, intro and outro clips. Everyone watching sees it.</p>
        {isHost
          ? <button type="button" disabled={busy === "on"} onClick={() => void run("on", { op: "on", on: true })} className="mt-3 rounded-full bg-white px-4 py-2 font-ui text-xs font-bold text-ink disabled:opacity-40">Switch the studio on</button>
          : <p className="mt-2 text-xs text-white/50">The host switches it on.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <div className={`${card} flex flex-wrap items-center gap-2`}>
        <span className="font-ui text-sm font-bold">🎬 Studio</span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-semibold"><span className="h-2 w-2 rounded-full bg-[#35C27A]" />NotesApp · live</span>
        <span className="rounded-full border border-dashed border-white/25 px-2.5 py-1 text-white/55" title="Sending the same programme to LinkedIn Live is being built">LinkedIn Live · coming soon</span>
        <span className="flex-1" />
        {isHost && onModerators && <button type="button" onClick={onModerators} className={chip(false)}>🛡 Editors and moderators</button>}
        {isHost && <button type="button" disabled={busy === "on"} onClick={() => void run("on", { op: "on", on: false })} className={chip(false)}>Switch the studio off</button>}
      </div>

      {canEdit && (
        <div className={card}>
          <p className="mb-2 font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Layout</p>
          <div className="flex flex-wrap gap-1.5">
            {STUDIO_LAYOUTS.map((l) => <button key={l.id} type="button" title={l.hint} disabled={busy === "layout"} aria-pressed={studio.layout === l.id} onClick={() => void set("layout", { layout: l.id })} className={chip(studio.layout === l.id)}>{l.label}</button>)}
            <span className="mx-1 w-px self-stretch bg-white/15" />
            {STUDIO_THEMES.map((t) => <button key={t.id} type="button" disabled={busy === "theme"} aria-pressed={studio.theme === t.id} onClick={() => void set("theme", { theme: t.id })} className={chip(studio.theme === t.id)}>{t.label}</button>)}
          </div>
          {stage.length > 1 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="text-white/55">In focus:</span>
              <button type="button" onClick={() => void set("focus", { focus: "" })} aria-pressed={!studio.focus} className={chip(!studio.focus)}>Host</button>
              {stage.slice(1).map((u) => <button key={u} type="button" onClick={() => void set("focus", { focus: u })} aria-pressed={studio.focus === u} className={chip(studio.focus === u)}>{nameOf(u)}</button>)}
            </div>
          )}
          {studio.screen && <p className="mt-2 text-white/60">🖥 {nameOf(studio.screen)} is sharing a screen: it stays large and whole.</p>}
        </div>
      )}

      {canEdit && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className={card}>
            <div className="mb-2 flex items-center justify-between"><span className="font-ui text-sm font-bold">Lower third</span><Toggle label="Lower third" on={studio.lower.on} disabled={busy === "lower"} onChange={(on) => void set("lower", { lower: { ...lower, on } })} /></div>
            <div className="space-y-1.5">
              <input className={input} value={lower.kicker} maxLength={STUDIO_MAX.kicker} onChange={(e) => setLower({ ...lower, kicker: e.target.value })} placeholder="Small line above, e.g. TONIGHT'S QUESTION" aria-label="Small line above the headline" />
              <input className={input} value={lower.head} maxLength={STUDIO_MAX.head} onChange={(e) => setLower({ ...lower, head: e.target.value })} placeholder="Headline" aria-label="Headline" />
              <div className="flex gap-1.5">
                <input className={input} value={lower.name} maxLength={STUDIO_MAX.name} onChange={(e) => setLower({ ...lower, name: e.target.value })} placeholder="Speaker's name" aria-label="Speaker's name" />
                <input className={input} value={lower.role} maxLength={STUDIO_MAX.role} onChange={(e) => setLower({ ...lower, role: e.target.value })} placeholder="Who they are" aria-label="Who they are" />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {LOWER_STYLES.map((s) => <button key={s.id} type="button" aria-pressed={lower.style === s.id} onClick={() => setLower({ ...lower, style: s.id })} className={chip(lower.style === s.id)}>{s.label}</button>)}
              <span className="flex-1" />
              {stage.length > 0 && <select aria-label="Fill the name from the stage" className="rounded-full bg-white/10 px-2 py-1.5 text-[11px] text-white" value="" onChange={(e) => { if (e.target.value) setLower({ ...lower, name: nameOf(e.target.value) }); }}>
                <option value="">Name from stage…</option>{stage.map((u) => <option key={u} value={u} className="text-ink">{nameOf(u)}</option>)}</select>}
              <button type="button" disabled={busy === "lower" || (!lower.head.trim() && !lower.name.trim())} onClick={() => void set("lower", { lower: { ...lower, on: true } })} className="rounded-full bg-white px-3 py-1.5 font-ui text-[11px] font-bold text-ink disabled:opacity-40">{studio.lower.on ? "Update" : "Show"}</button>
            </div>
          </div>

          <div className={card}>
            <div className="mb-2 flex items-center justify-between"><span className="font-ui text-sm font-bold">Ticker</span><Toggle label="Ticker" on={studio.ticker.on} disabled={busy === "ticker" || (!studio.ticker.on && !tickerLines.length)} onChange={(on) => void set("ticker", { ticker: { on, lines: tickerLines, tag } })} /></div>
            <textarea className={`${input} h-[68px] resize-none`} value={lines} onChange={(e) => setLines(e.target.value)} placeholder={"One line each, up to 8.\nThey scroll along the bottom."} aria-label="Ticker lines, one per line" />
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <input className={`${input} !w-28`} value={tag} maxLength={STUDIO_MAX.tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag" aria-label="The ticker's tag" />
              {TICKER_SPEEDS.map((s) => <button key={s} type="button" aria-pressed={studio.ticker.speed === s} onClick={() => void set("ticker", { ticker: { speed: s } })} className={chip(studio.ticker.speed === s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}
              <span className="flex-1" />
              <button type="button" disabled={busy === "ticker" || !tickerLines.length} onClick={() => void set("ticker", { ticker: { on: true, lines: tickerLines, tag } })} className="rounded-full bg-white px-3 py-1.5 font-ui text-[11px] font-bold text-ink disabled:opacity-40">{studio.ticker.on ? "Update" : "Show"}</button>
            </div>
          </div>

          <div className={card}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-ui text-sm font-bold">Automatic subtitles<span className="block font-body text-[11px] font-normal text-white/50">{speech === false ? "Not set up yet on this site." : "What each speaker says, a few seconds behind."}</span></p>
              <Toggle on={studio.subs.on} disabled={speech !== true && !studio.subs.on} onChange={(v) => void set("subs", { subs: { on: v } })} label="Automatic subtitles" />
            </div>
            {studio.subs.on && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-1.5 text-white/60">Look</p>
                  <div className="flex flex-wrap gap-1.5">{SUB_LOOKS.map((l) => <button key={l} type="button" aria-pressed={studio.subs.look === l} className={chip(studio.subs.look === l)} onClick={() => void set("subs", { subs: { look: l } })}>{SUB_LOOK_LABEL[l]}</button>)}</div>
                </div>
                <div className="flex items-center justify-between gap-2"><span>Show the speaker&apos;s name<span className="block text-[11px] text-white/45">Left off when only one microphone is on.</span></span><Toggle on={studio.subs.names} onChange={(v) => void set("subs", { subs: { names: v } })} label="Show the speaker's name" /></div>
                <div>
                  <p className="mb-1.5 text-white/60">Language</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" aria-pressed={studio.subs.lang === "en"} className={chip(studio.subs.lang === "en")} onClick={() => void set("subs", { subs: { lang: "en" } })}>English</button>
                    <button type="button" aria-pressed={studio.subs.lang === "pcm"} className={chip(studio.subs.lang === "pcm")} onClick={() => void set("subs", { subs: { lang: "pcm" } })}>Pidgin (less accurate)</button>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-white/60">Who is subtitled</p>
                  {stage.map((u) => {
                    const off = studio.subs.off.includes(u);
                    return <div key={u} className="flex items-center justify-between gap-2 border-t border-white/10 py-1.5 first:border-t-0"><span className="min-w-0 truncate">{nameOf(u)}{studio.subs.quiet.includes(u) && <span className="ml-1.5 text-[11px] text-white/45">muted</span>}</span><Toggle on={!off} onChange={(v) => void run("subsfor", { op: "subsfor", uid: u, off: !v })} label={`Subtitle ${nameOf(u)}`} /></div>;
                  })}
                </div>
                <p className="text-white/45">Each speaker&apos;s own device writes down their own microphone. Subtitles go out unchecked and can be wrong: type a line below to take over, or switch a speaker off.</p>
              </div>
            )}
          </div>

          <div className={card}>
            <p className="mb-2 font-ui text-sm font-bold">Subtitle line</p>
            <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (caption.trim()) void set("caption", { caption }).then(() => setCaption("")); }}>
              <input className={input} value={caption} maxLength={STUDIO_MAX.caption} onChange={(e) => setCaption(e.target.value)} placeholder="Type what was said, or a translation, and press Enter" aria-label="Subtitle line" />
              <button className="shrink-0 rounded-full bg-white px-3 py-1.5 font-ui text-[11px] font-bold text-ink disabled:opacity-40" disabled={!caption.trim() || busy === "caption"}>Show</button>
            </form>
            {studio.caption
              ? <p className="mt-2 flex items-start gap-2 text-white/70"><span className="min-w-0 flex-1">On air: “{studio.caption}”</span><button type="button" onClick={() => void set("caption", { caption: "" })} className="shrink-0 underline">Clear</button></p>
              : <p className="mt-2 text-white/45">Shown under the picture until you clear it or send the next line. While a typed line is up, it takes the place of automatic subtitles.</p>}
          </div>

          <div className={card}>
            <div className="mb-2 flex items-center justify-between"><span className="font-ui text-sm font-bold">Logo and badges</span><Toggle label="Logo" on={studio.bug.on} disabled={busy === "bug"} onChange={(on) => void set("bug", { bug: { on } })} /></div>
            <div className="flex gap-1.5">
              <input className={input} value={show} maxLength={STUDIO_MAX.show} onChange={(e) => setShow(e.target.value)} placeholder="Show name beside the logo" aria-label="Show name" />
              <input className={input} value={place} maxLength={STUDIO_MAX.place} onChange={(e) => setPlace(e.target.value)} placeholder="Where from, e.g. LAGOS · LONDON" aria-label="Where from" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button type="button" aria-pressed={studio.bug.live} onClick={() => void set("bug", { bug: { live: !studio.bug.live } })} className={chip(studio.bug.live)}>LIVE badge</button>
              <button type="button" aria-pressed={studio.bug.clock} onClick={() => void set("bug", { bug: { clock: !studio.bug.clock } })} className={chip(studio.bug.clock)}>Clock</button>
              <button type="button" disabled={up === "logo"} onClick={() => logoFile.current?.click()} className={chip(false)}>{up === "logo" ? "Uploading…" : "Upload a logo"}</button>
              {studio.bug.logo && <button type="button" onClick={() => void set("bug", { bug: { logo: "" } })} className="underline text-white/60">Use the NotesApp mark</button>}
              <span className="flex-1" />
              <button type="button" disabled={busy === "bug"} onClick={() => void set("bug", { bug: { show, place } })} className="rounded-full bg-white px-3 py-1.5 font-ui text-[11px] font-bold text-ink disabled:opacity-40">Update</button>
            </div>
            <input ref={logoFile} type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={(e) => { void pickFile("logo", e.target.files?.[0]); e.target.value = ""; }} />
          </div>

          <div className={card}>
            <p className="mb-1 font-ui text-sm font-bold">Clips</p>
            <p className="mb-2 text-white/50">An intro, an outro, a video or a sound in between, or a picture (a slide, a title card). It plays for everyone, over the picture. Stage microphones stay as they are: mute yours while a clip with sound plays.</p>
            {studio.clip && <p className="mb-2 flex items-center gap-2 rounded-lg bg-[#E5122F]/20 px-3 py-2 font-semibold"><span className="min-w-0 flex-1 truncate">▶ Playing: {studio.clip.label || studio.clip.kind}{studio.clip.ad ? " (advertisement)" : ""}</span><button type="button" disabled={busy === "clip"} onClick={() => void run("clip", { op: "clip", url: "" })} className="shrink-0 rounded-full bg-white px-3 py-1 font-bold text-ink">■ Stop</button></p>}
            <ul className="space-y-1.5">
              {saved.map((c) => (
                <li key={c.url} className="flex items-center gap-2">
                  <span aria-hidden>{c.kind === "video" ? "🎞" : c.kind === "audio" ? "🎵" : "🖼"}</span>
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <button type="button" disabled={busy === "clip"} onClick={() => void run("clip", { op: "clip", url: c.url, label: c.label, ad: ad && c.kind === "video" })} className={chip(false)}>▶ Play</button>
                  <button type="button" onClick={() => keep(saved.filter((x) => x.url !== c.url))} aria-label={`Remove ${c.label} from the list`} className="text-white/40 hover:text-white">×</button>
                </li>
              ))}
              {!saved.length && <li className="text-white/40">No clips yet. Upload them before you need them.</li>}
            </ul>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" disabled={up === "clip"} onClick={() => clipFile.current?.click()} className={chip(false)}>{up === "clip" ? "Uploading…" : "＋ Upload a clip"}</button>
              <label className="flex items-center gap-1.5 text-white/65"><input type="checkbox" checked={ad} onChange={(e) => setAd(e.target.checked)} className="h-3.5 w-3.5" />Play videos as a full-screen advertisement</label>
            </div>
            <input ref={clipFile} type="file" accept="video/mp4,video/webm,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { void pickFile("clip", e.target.files?.[0]); e.target.value = ""; }} />
          </div>

          <div className={card}>
            <p className="mb-1 font-ui text-sm font-bold">Sponsor spot</p>
            <p className="mb-2 text-white/50">A picture (it can be animated) or a video, always without sound, in one of the two marked places.</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {SPONSOR_SLOTS.map((s) => <button key={s.id} type="button" aria-pressed={slot === s.id} onClick={() => { setSlot(s.id); if (studio.sponsor) void set("sponsor", { sponsor: { ...studio.sponsor, slot: s.id } }); }} className={chip(slot === s.id)}>{s.label}</button>)}
              <button type="button" disabled={up === "sponsor"} onClick={() => sponsorFile.current?.click()} className={chip(false)}>{up === "sponsor" ? "Uploading…" : studio.sponsor ? "Replace" : "＋ Upload"}</button>
              {studio.sponsor && <button type="button" onClick={() => void set("sponsor", { sponsor: null })} className="underline text-white/60">Take it off</button>}
            </div>
            <input ref={sponsorFile} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" hidden onChange={(e) => { void pickFile("sponsor", e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        </div>
      )}

      {canAir && (airing || studio.queue.length > 0) && (
        <div className={card}>
          <p className="mb-2 font-ui text-sm font-bold">Comments on air</p>
          {airing && <QueueRow c={airing} live onAir={() => {}} onDrop={() => void run("comment", { op: "comment", message: null })} />}
          {studio.queue.map((q, i) => <QueueRow key={q.id} c={q} n={i + 1} onAir={() => void run("comment", { op: "comment", message: q })} onDrop={() => void run("queue", { op: "unqueue", messageId: q.id })} />)}
        </div>
      )}
      {canAir && !airing && !studio.queue.length && <p className="px-1 text-white/45">To put a viewer&apos;s comment on air, point at it in the chat and choose On air or Queue.</p>}
    </div>
  );
}

function QueueRow({ c, n, live, onAir, onDrop }: { c: StudioComment; n?: number; live?: boolean; onAir: () => void; onDrop: () => void }) {
  return (
    <div className={`mb-1.5 flex items-center gap-2 rounded-lg px-3 py-2 ${live ? "bg-[#E5122F]/20 ring-1 ring-[#E5122F]" : "bg-black/25"}`}>
      {live ? <span className="shrink-0 rounded bg-[#E5122F] px-1.5 py-0.5 text-[10px] font-extrabold">ON AIR</span> : <span className="shrink-0 font-mono text-white/50">{n}</span>}
      <span className="min-w-0 flex-1 truncate"><b>{c.name}:</b> {c.text}</span>
      {!live && <button type="button" onClick={onAir} className="shrink-0 rounded-full bg-white px-2.5 py-1 font-bold text-ink">Put on air</button>}
      <button type="button" onClick={onDrop} className="shrink-0 text-white/60 underline">{live ? "Take off" : "Remove"}</button>
    </div>
  );
}
