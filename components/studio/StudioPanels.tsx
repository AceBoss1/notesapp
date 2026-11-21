"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { auth } from "@/lib/firebase";
import { uploadToR2 } from "@/lib/upload";
import {
  LOWER_STYLES, SPONSOR_SLOTS, STUDIO_CLIP_MAX, STUDIO_CLIP_TYPES, STUDIO_MAX, STUDIO_THEMES, SUB_LOOKS, SUB_LOOK_LABEL, TICKER_SPEEDS, clipKindOf,
  type StudioClipKind, type StudioComment, type StudioPatch, type StudioState,
} from "@/lib/studio";
import { Icon, PRODUCT, ring } from "./StudioShell";

// The studio's desk (lib/studio.ts), as the panels of Media Live Studio PRO's sidebar (StudioShell.tsx): Banners (lower third, ticker,
// subtitles), Brand (theme, logo and badges, sponsor overlay), Media (clips) and the on-air queue for Comments. Each control sends one
// step to the server ({ action: "studio", op, … } on /api/community/rooms), which checks who may and writes the room; the picture then
// changes for everyone. Editing needs "studio" (the graphics, clips, sponsor); comments on air need "onair".
export type Act = (body: Record<string, unknown>) => Promise<unknown>;
type Saved = { url: string; kind: StudioClipKind; label: string };
const CLIPS_KEY = "nls-clips";
const card = "rounded-xl border border-white/10 bg-white/[0.03] p-3";
const input = "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none disabled:opacity-50";
export const chip = (on: boolean) => `rounded-full px-3 py-1.5 font-ui text-[11px] font-semibold transition ${ring} ${on ? "bg-white text-ink" : "bg-white/10 text-white/80 hover:bg-white/20"} disabled:opacity-40`;
const go = `rounded-full bg-white px-3 py-1.5 font-ui text-[11px] font-bold text-ink hover:bg-white/85 disabled:opacity-40 ${ring}`;

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 ${ring} ${on ? "bg-[#E5122F]" : "bg-white/20"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

// One step at a time, with the step's tag kept while it is on its way (so its button can say so).
export function useDesk(act: Act, onError: (m: string) => void) {
  const [busy, setBusy] = useState("");
  const run = async (tag: string, body: Record<string, unknown>) => {
    setBusy(tag);
    try { await act({ action: "studio", ...body }); } catch (e) { onError(e instanceof Error ? e.message : "Couldn't change the studio."); } finally { setBusy(""); }
  };
  const set = (tag: string, patch: StudioPatch) => run(tag, { op: "set", patch });
  return { busy, run, set };
}
export type Desk = ReturnType<typeof useDesk>;

// While the studio is off, a panel can't change anything yet (the server refuses until the host goes live with it).
function Locked({ locked, children }: { locked?: boolean; children: ReactNode }) {
  return (
    <fieldset disabled={locked} className="min-w-0 space-y-3 p-3">
      {locked && <p className="rounded-lg bg-[#F5B83D]/15 px-3 py-2 text-xs text-[#FFD98A]">This is a preview. Press <b>Go live with studio</b> to put the graphics on air; then these change what viewers see.</p>}
      {children}
    </fieldset>
  );
}
function Head({ title, hint, right }: { title: string; hint?: string; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-start justify-between gap-2">
      <p className="min-w-0 font-ui text-sm font-bold">{title}{hint && <span className="block font-body text-[11px] font-normal text-white/50">{hint}</span>}</p>
      {right}
    </div>
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

// The host's card while the studio is off (in the classic room view).
export function StudioOff({ isHost, desk, onOpen }: { isHost: boolean; desk: Desk; onOpen?: () => void }) {
  return (
    <div className={card}>
      <p className="font-ui text-sm font-bold">🎬 {PRODUCT}</p>
      <p className="mt-1 text-xs text-white/65">A broadcast look for this live: your logo, a lower third with the headline and the speaker&apos;s name, a scrolling ticker, subtitles, viewers&apos; comments on air, intro and outro clips. Everyone watching sees it.</p>
      {isHost
        ? <div className="mt-3 flex flex-wrap gap-2">
            {onOpen && <button type="button" onClick={onOpen} className={go}>Open the studio</button>}
            <button type="button" disabled={desk.busy === "on"} onClick={() => void desk.run("on", { op: "on", on: true })} className={chip(false)}>Go live with studio now</button>
          </div>
        : <p className="mt-2 text-xs text-white/50">The host switches it on.</p>}
    </div>
  );
}

// ── Banners: the lower third, the ticker, the typed subtitle line and automatic subtitles. ──
export function BannersPanel({ studio, stage, nameOf, desk, tryOut, locked }: { studio: StudioState; stage: string[]; nameOf: (uid: string) => string; desk: Desk; tryOut?: boolean; locked?: boolean }) {
  const { busy, run, set } = desk;
  // What is being typed, kept apart from what is on air until Show or Update is pressed.
  const [lower, setLower] = useState(studio.lower);
  const [lines, setLines] = useState(studio.ticker.lines.join("\n"));
  const [tag, setTag] = useState(studio.ticker.tag);
  const [caption, setCaption] = useState("");
  // Automatic subtitles need the speech service's keys (CLOUDFLARE_AI_TOKEN); until they are set, the switch says so.
  const [speech, setSpeech] = useState<boolean | null>(null);
  useEffect(() => { if (tryOut) { setSpeech(true); return; } fetch("/api/studio/subtitles", { cache: "no-store" }).then((r) => r.json()).then((j) => setSpeech(j.ready === true)).catch(() => setSpeech(false)); }, [tryOut]);
  const tickerLines = lines.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <Locked locked={locked}>
      <div className={`${card} ${studio.lower.on ? "ring-1 ring-[#E5122F]/70" : ""}`}>
        <Head title="Lower third" hint="The headline and the speaker's name" right={<Toggle label="Show the lower third" on={studio.lower.on} disabled={busy === "lower" || (!studio.lower.on && !lower.head.trim() && !lower.name.trim())} onChange={(on) => void set("lower", { lower: { ...lower, on } })} />} />
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
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {stage.length > 0 && <select aria-label="Fill the name from the stage" className={`rounded-full bg-white/10 px-2 py-1.5 text-[11px] text-white ${ring}`} value="" onChange={(e) => { if (e.target.value) setLower({ ...lower, name: nameOf(e.target.value) }); }}>
            <option value="">Name from stage…</option>{stage.map((u) => <option key={u} value={u} className="text-ink">{nameOf(u)}</option>)}</select>}
          <span className="flex-1" />
          <button type="button" disabled={busy === "lower" || (!lower.head.trim() && !lower.name.trim())} onClick={() => void set("lower", { lower: { ...lower, on: true } })} className={go}>{studio.lower.on ? "Update on screen" : "Show on screen"}</button>
        </div>
      </div>

      <div className={`${card} ${studio.ticker.on ? "ring-1 ring-[#E5122F]/70" : ""}`}>
        <Head title="Ticker" hint="Lines that scroll along the bottom" right={<Toggle label="Show the ticker" on={studio.ticker.on} disabled={busy === "ticker" || (!studio.ticker.on && !tickerLines.length)} onChange={(on) => void set("ticker", { ticker: { on, lines: tickerLines, tag } })} />} />
        <textarea className={`${input} h-[76px] resize-none`} value={lines} onChange={(e) => setLines(e.target.value)} placeholder={"One line each, up to 8.\nThey scroll along the bottom."} aria-label="Ticker lines, one per line" />
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <input className={`${input} !w-28`} value={tag} maxLength={STUDIO_MAX.tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag" aria-label="The ticker's tag" />
          {TICKER_SPEEDS.map((s) => <button key={s} type="button" aria-pressed={studio.ticker.speed === s} onClick={() => void set("ticker", { ticker: { speed: s } })} className={chip(studio.ticker.speed === s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}
          <span className="flex-1" />
          <button type="button" disabled={busy === "ticker" || !tickerLines.length} onClick={() => void set("ticker", { ticker: { on: true, lines: tickerLines, tag } })} className={go}>{studio.ticker.on ? "Update" : "Show"}</button>
        </div>
      </div>

      <div className={card}>
        <Head title="Subtitle line" hint="Type what was said, or a translation" />
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (caption.trim()) void set("caption", { caption }).then(() => setCaption("")); }}>
          <input className={input} value={caption} maxLength={STUDIO_MAX.caption} onChange={(e) => setCaption(e.target.value)} placeholder="Type a line and press Enter" aria-label="Subtitle line" />
          <button className={`shrink-0 ${go}`} disabled={!caption.trim() || busy === "caption"}>Show</button>
        </form>
        {studio.caption
          ? <p className="mt-2 flex items-start gap-2 text-xs text-white/70"><span className="min-w-0 flex-1">On air: “{studio.caption}”</span><button type="button" onClick={() => void set("caption", { caption: "" })} className="shrink-0 underline">Clear</button></p>
          : <p className="mt-2 text-xs text-white/45">Shown under the picture until you clear it or send the next line. While a typed line is up, it takes the place of automatic subtitles.</p>}
      </div>

      <div className={`${card} text-xs`}>
        <Head title="Automatic subtitles" hint={speech === false ? "Not set up yet on this site." : "What each speaker says, a few seconds behind."}
          right={<Toggle on={studio.subs.on} disabled={speech !== true && !studio.subs.on} onChange={(v) => void set("subs", { subs: { on: v } })} label="Automatic subtitles" />} />
        {studio.subs.on && (
          <div className="space-y-3">
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
            <p className="text-white/45">Each speaker&apos;s own device writes down their own microphone. Subtitles go out unchecked and can be wrong: type a line above to take over, or switch a speaker off.</p>
          </div>
        )}
      </div>
    </Locked>
  );
}

// The three themes, drawn as swatches.
const SWATCH: Record<string, string> = { crimson: "linear-gradient(135deg,#A6093D,#16080d)", midnight: "linear-gradient(135deg,#1d4ed8,#04070f)", ivory: "linear-gradient(135deg,#fbf6f2,#e2c8cf)" };

// ── Brand: the theme, the logo and badges, and the sponsor overlay. ──
export function BrandPanel({ studio, desk, onError, locked }: { studio: StudioState; desk: Desk; onError: (m: string) => void; locked?: boolean }) {
  const { busy, set } = desk;
  const [show, setShow] = useState(studio.bug.show);
  const [place, setPlace] = useState(studio.bug.place);
  const [up, setUp] = useState("");
  const [slot, setSlot] = useState(studio.sponsor?.slot ?? "corner");
  const logoFile = useRef<HTMLInputElement>(null), sponsorFile = useRef<HTMLInputElement>(null);
  const pick = async (what: "logo" | "sponsor", f: File | undefined) => {
    if (!f) return;
    setUp(what);
    try {
      if (what === "logo") {
        if (!f.type.startsWith("image/")) throw new Error("A logo is a picture: PNG, WebP or JPEG.");
        await set("logo", { bug: { logo: await uploadToR2(f, "poster"), on: true } });
      } else {
        const url = f.type.startsWith("image/") ? await uploadToR2(f, "poster") : await uploadClip(f);
        if (clipKindOf(url) === "audio") throw new Error("The sponsor spot takes a picture or a video (played without sound).");
        await set("sponsor", { sponsor: { url, slot, label: "" } });
      }
    } catch (e) { onError(e instanceof Error ? e.message : "Couldn't upload that."); } finally { setUp(""); }
  };
  return (
    <Locked locked={locked}>
      <div className={card}>
        <Head title="Theme" hint="The colours of the graphics" />
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
          {STUDIO_THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={studio.theme === t.id} disabled={busy === "theme"} onClick={() => void set("theme", { theme: t.id })}
              className={`rounded-lg border p-1.5 text-left transition ${ring} ${studio.theme === t.id ? "border-[#E5122F] bg-white/10" : "border-white/10 hover:border-white/30"}`}>
              <span className="block aspect-video rounded" style={{ background: SWATCH[t.id] }} />
              <span className="mt-1 block truncate font-ui text-[10.5px] font-semibold">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={card}>
        <Head title="Logo and badges" hint="Top of the picture" right={<Toggle label="Show the logo" on={studio.bug.on} disabled={busy === "bug"} onChange={(on) => void set("bug", { bug: { on } })} />} />
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={studio.bug.logo || "/images/brand/icon-192.png"} alt="The logo on air" className="h-12 w-12 rounded-lg bg-black/30 object-contain p-1" />
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={up === "logo"} onClick={() => logoFile.current?.click()} className={chip(false)}>{up === "logo" ? "Uploading…" : "Upload a logo"}</button>
            {studio.bug.logo && <button type="button" onClick={() => void set("bug", { bug: { logo: "" } })} className="text-[11px] text-white/60 underline">Use the NotesApp mark</button>}
          </div>
        </div>
        <div className="mt-2 space-y-1.5">
          <input className={input} value={show} maxLength={STUDIO_MAX.show} onChange={(e) => setShow(e.target.value)} placeholder="Show name beside the logo" aria-label="Show name" />
          <input className={input} value={place} maxLength={STUDIO_MAX.place} onChange={(e) => setPlace(e.target.value)} placeholder="Where from, e.g. LAGOS · LONDON" aria-label="Where from" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={studio.bug.live} onClick={() => void set("bug", { bug: { live: !studio.bug.live } })} className={chip(studio.bug.live)}>LIVE badge</button>
          <button type="button" aria-pressed={studio.bug.clock} onClick={() => void set("bug", { bug: { clock: !studio.bug.clock } })} className={chip(studio.bug.clock)}>Clock</button>
          <span className="flex-1" />
          <button type="button" disabled={busy === "bug"} onClick={() => void set("bug", { bug: { show, place } })} className={go}>Update</button>
        </div>
        <input ref={logoFile} type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={(e) => { void pick("logo", e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      <div className={card}>
        <Head title="Sponsor overlay" hint="A picture (it can move) or a video, always without sound" />
        <div className="flex flex-wrap items-center gap-1.5">
          {SPONSOR_SLOTS.map((s) => <button key={s.id} type="button" aria-pressed={slot === s.id} onClick={() => { setSlot(s.id); if (studio.sponsor) void set("sponsor", { sponsor: { ...studio.sponsor, slot: s.id } }); }} className={chip(slot === s.id)}>{s.label}</button>)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" disabled={up === "sponsor"} onClick={() => sponsorFile.current?.click()} className={chip(false)}>{up === "sponsor" ? "Uploading…" : studio.sponsor ? "Replace" : "＋ Upload"}</button>
          {studio.sponsor && <><span className="rounded bg-[#E5122F]/20 px-2 py-0.5 text-[11px] font-semibold text-[#FFB4C0]">On screen</span><button type="button" onClick={() => void set("sponsor", { sponsor: null })} className="text-[11px] text-white/60 underline">Take it off</button></>}
        </div>
        <input ref={sponsorFile} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" hidden onChange={(e) => { void pick("sponsor", e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </Locked>
  );
}

// ── Media: intros, outros, videos, sounds and pictures that play for everyone. `children`: more below (the host's music in a live). ──
export function MediaPanel({ studio, desk, onError, locked, children }: { studio: StudioState; desk: Desk; onError: (m: string) => void; locked?: boolean; children?: ReactNode }) {
  const { busy, run } = desk;
  const [saved, setSaved] = useState<Saved[]>([]);
  const [up, setUp] = useState(false);
  const [ad, setAd] = useState(false);
  useEffect(() => { try { setSaved(JSON.parse(localStorage.getItem(CLIPS_KEY) || "[]")); } catch { /* none kept */ } }, []);
  const keep = (list: Saved[]) => { setSaved(list); try { localStorage.setItem(CLIPS_KEY, JSON.stringify(list.slice(-12))); } catch { /* this visit only */ } };
  const clipFile = useRef<HTMLInputElement>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setUp(true);
    try {
      const url = f.type.startsWith("image/") ? await uploadToR2(f, "poster") : await uploadClip(f);
      keep([...saved, { url, kind: clipKindOf(url), label: f.name.replace(/\.[A-Za-z0-9]{1,5}$/, "").slice(0, STUDIO_MAX.label) }]);
    } catch (e) { onError(e instanceof Error ? e.message : "Couldn't upload that."); } finally { setUp(false); }
  };
  return (
    <Locked locked={locked}>
      <div className={card}>
        <Head title="Video clips and pictures" hint="An intro, an outro, a video or a sound in between, or a slide. It plays for everyone, over the picture." />
        {studio.clip && <p className="mb-2 flex items-center gap-2 rounded-lg bg-[#E5122F]/20 px-3 py-2 text-xs font-semibold"><span className="min-w-0 flex-1 truncate">▶ Playing: {studio.clip.label || studio.clip.kind}{studio.clip.ad ? " (advertisement)" : ""}</span><button type="button" disabled={busy === "clip"} onClick={() => void run("clip", { op: "clip", url: "" })} className={go}>■ Stop</button></p>}
        <ul className="space-y-1.5 text-xs">
          {saved.map((c) => (
            <li key={c.url} className="flex items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5">
              <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/10">{c.kind === "video" ? "🎞" : c.kind === "audio" ? "🎵" : "🖼"}</span>
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              <button type="button" disabled={busy === "clip"} onClick={() => void run("clip", { op: "clip", url: c.url, label: c.label, ad: ad && c.kind === "video" })} className={chip(false)}>▶ Play</button>
              <button type="button" onClick={() => keep(saved.filter((x) => x.url !== c.url))} aria-label={`Remove ${c.label} from the list`} className={`rounded px-1 text-white/40 hover:text-white ${ring}`}>×</button>
            </li>
          ))}
          {!saved.length && <li className="text-white/40">No clips yet. Upload them before you need them.</li>}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <button type="button" disabled={up} onClick={() => clipFile.current?.click()} className={chip(false)}>{up ? "Uploading…" : "＋ Upload a clip"}</button>
          <label className="flex items-center gap-1.5 text-white/65"><input type="checkbox" checked={ad} onChange={(e) => setAd(e.target.checked)} className="h-3.5 w-3.5" />Play videos as a full-screen advertisement</label>
        </div>
        <p className="mt-2 text-[11px] text-white/45">Stage microphones stay as they are: mute yours while a clip with sound plays.</p>
        <input ref={clipFile} type="file" accept="video/mp4,video/webm,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {children}
    </Locked>
  );
}

// ── Comments on air: the one showing and the queue (the chat itself sits under it in the Comments tab). ──
export function OnAirQueue({ studio, desk }: { studio: StudioState; desk: Desk }) {
  const airing = studio.comment;
  if (!airing && !studio.queue.length) return <p className="px-1 text-xs text-white/45">Point at a comment below and choose <b>Show on stage</b>, or <b>Queue</b> to line it up.</p>;
  return (
    <div>
      <p className="mb-1.5 font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">On stage and up next</p>
      {airing && <QueueRow c={airing} live onAir={() => {}} onDrop={() => void desk.run("comment", { op: "comment", message: null })} />}
      {studio.queue.map((q, i) => <QueueRow key={q.id} c={q} n={i + 1} onAir={() => void desk.run("comment", { op: "comment", message: q })} onDrop={() => void desk.run("queue", { op: "unqueue", messageId: q.id })} />)}
    </div>
  );
}

function QueueRow({ c, n, live, onAir, onDrop }: { c: StudioComment; n?: number; live?: boolean; onAir: () => void; onDrop: () => void }) {
  return (
    <div className={`mb-1.5 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${live ? "bg-[#E5122F]/20 ring-1 ring-[#E5122F]" : "bg-black/25"}`}>
      {live ? <span className="shrink-0 rounded bg-[#E5122F] px-1.5 py-0.5 text-[10px] font-extrabold">ON AIR</span> : <span className="shrink-0 font-mono text-white/50">{n}</span>}
      <span className="min-w-0 flex-1 truncate"><b>{c.name}:</b> {c.text}</span>
      {!live && <button type="button" onClick={onAir} className={`shrink-0 rounded-full bg-white px-2.5 py-1 font-bold text-ink ${ring}`}>Show</button>}
      <button type="button" onClick={onDrop} className={`shrink-0 text-white/60 underline ${ring}`}>{live ? "Take off" : "Remove"}</button>
    </div>
  );
}

// A note for a tab that has nothing to do here (yet).
export function EmptyNote({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/60"><Icon name={icon} /></span>
      <p className="font-ui text-sm font-bold">{title}</p>
      <div className="mt-1 text-xs text-white/55">{children}</div>
    </div>
  );
}
