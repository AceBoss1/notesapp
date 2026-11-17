"use client";

import SongPicker from "@/components/media/SongPicker";
import { useEffect, useMemo, useRef, useState } from "react";
import MentionPicker from "@/components/MentionPicker";
import { auth } from "@/lib/firebase";
import { uploadToR2WithKey } from "@/lib/upload";
import { api } from "@/lib/moments-client";
import BlockedNotice from "@/components/content-checks/BlockedNotice";
import { contentCheckOf, type CheckDetail } from "@/lib/content-checks";
import { sendToStream, videoInfo } from "@/lib/media-client";
import { MOMENT_DEFAULT_HOURS, MOMENT_HINT, MOMENT_HOURS, MOMENT_TEXT_MAX, MOMENT_VIDEO_MAX_SECONDS, MOMENT_VIDEO_SOURCE_MAX_SECONDS, momentVideoClips, momentVideoParts, type MomentHours, type ComposedMomentKind as MomentKind } from "@/lib/moments-rules";
import { VIDEO_ACCEPT } from "@/lib/video-rules";
import {
  CAPTION_LANGS, CAPTION_PLACES, CAPTION_STYLES, PAUSE_CHOICES, captionLines, editLine, partsForSpans, playhead, splitSpans, spanTotal, wordsIn,
  type CaptionLang, type Captions, type Span,
} from "@/lib/moments-tidy";
import { tidyStatus } from "@/lib/moments-tidy-client";
import { CaptionOverlay } from "./CaptionOverlay";
import { IconBack, IconCc, IconChevron, IconClose, IconMusic, IconNote, IconScissors, IconTimer } from "./icons";
import { Legend, Notice, StepBars, Steps, Switch, Wave, cardCls, clock, pillGhost, pillPrimary } from "./tidy-parts";
import { useTidy } from "./useTidy";
import VoiceOverRecorder, { uploadVoiceOver, type VoiceOver } from "./VoiceOverRecorder";

const readDuration = (file: File) =>
  new Promise<number>((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
    v.onerror = () => reject(new Error("We couldn't read that video."));
    v.src = URL.createObjectURL(file);
  });
const PAUSE_LABEL: Record<number, string> = { 0.25: "¼ second", 0.5: "½ second", 1: "1 second" };
type Step = "make" | "trim" | "captions";

// Create a moment: text, a picture or a video, for 24 hours by default (48 or 72 if you choose). A moment's video is up to 90
// seconds; a longer one is cut into parts of up to 90 seconds, one moment each, as far as the plan's weekly video moments allow.
// A voice-over (recorded here, up to 90 seconds) can go on top of any of them.
//
// The look is the owner's "Moments Redesign" (Moda, 16 Nov 2026): a full page in up to three steps. Step 1 makes the moment. When
// tidy up is switched on (docs/MOMENTS_TIDY.md), step 2 checks the trimmed pauses and step 3 the captions, before anything is shared.
export default function MomentComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const [kind, setKind] = useState<MomentKind>("text");
  const [text, setText] = useState("");
  const captionBox = useRef<HTMLTextAreaElement>(null);
  const [hours, setHours] = useState<MomentHours>(MOMENT_DEFAULT_HOURS);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [voice, setVoice] = useState<VoiceOver | null>(null);
  const [songId, setSongId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<CheckDetail | null>(null); // AI content checks
  const [duration, setDuration] = useState<number | null>(null);
  const [quota, setQuota] = useState<{ limit: number; used: number; remaining: number } | null>(null);
  const [doneNote, setDoneNote] = useState<string | null>(null); // shown after a video was shared, before closing
  const [step, setStep] = useState<Step>("make");
  const [open, setOpen] = useState<"" | "note" | "sound" | "hours">("");
  const [editing, setEditing] = useState(-1);
  const [draft, setDraft] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const player = useRef<HTMLMediaElement | null>(null);
  const [previewAt, setPreviewAt] = useState(0);

  // Tidy up and captions: offered when switched on. One recording is tidied: the voice-over when there is one, else the video.
  const [tidyOn, setTidyOn] = useState({ tidy: false, captions: false });
  useEffect(() => { tidyStatus().then(setTidyOn); }, []);
  const target: "voice" | "video" | null = voice ? "voice" : kind === "video" && file ? "video" : null;
  const source = useMemo(() => (tidyOn.tidy ? (target === "voice" ? voice!.blob : target === "video" ? file : null) : null), [tidyOn.tidy, target, voice, file]);
  const tidy = useTidy(source);
  const wantTrim = !!source && tidy.trim && !!tidy.spans;
  const wantCaptions = !!source && tidyOn.captions && tidy.captions;
  const steps: Step[] = ["make", ...(wantTrim ? ["trim" as const] : []), ...(wantCaptions ? ["captions" as const] : [])];
  const at = Math.max(0, steps.indexOf(step));

  useEffect(() => { if (!file || kind === "text") { setFileUrl(""); return; } const u = URL.createObjectURL(file); setFileUrl(u); return () => URL.revokeObjectURL(u); }, [file, kind]);

  // Choosing a video: read its length, and if it needs more than one moment, ask how many the plan has left so the member is told
  // what will happen before pressing Share.
  async function pickFile(f: File | null) {
    setFile(f); setDuration(null); setQuota(null); setError(null);
    if (!f || kind !== "video") return;
    try {
      const d = await readDuration(f);
      setDuration(d);
      if (momentVideoParts(d) > 1) setQuota(await api("/api/video", { body: { action: "quota", purpose: "moment" } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't read that video.");
    }
  }
  // Trimmed, a video is as long as what plays, so it may need fewer moments.
  const trimmed: Span[] | null = target === "video" ? tidy.spans : null;
  const untrimmedParts = duration ? momentVideoParts(duration) : 1;
  const needed = duration ? (trimmed ? partsForSpans(trimmed) : untrimmedParts) : 1;
  const allowed = quota ? Math.min(needed, quota.remaining) : needed;
  const caps: Omit<Captions, "of"> | null = tidy.words?.length ? { words: tidy.words, style: tidy.prefs.style, place: tidy.prefs.place } : null;

  async function post() {
    setBusy(true); setError(null); setBlocked(null);
    try {
      const body: Record<string, unknown> = { kind, hours, text };
      if (kind === "image") {
        if (!file) throw new Error("Choose a picture.");
        body.imageKey = (await uploadToR2WithKey(file, "moment")).key;
      } else if (kind === "video") {
        if (!file) throw new Error("Choose a video.");
        const info = await videoInfo(file).catch(() => null);
        const durationSec = duration ?? info?.durationSec ?? (await readDuration(file));
        // Straight to Cloudflare Stream, which burns in the NotesApp mark (your @username) as the video arrives; only that copy is kept.
        const start = await api<{ id: string; uploadURL: string; partsAllowed: number; partsNeeded: number }>("/api/video", { body: { action: "start", purpose: "moment", size: file.size, contentType: file.type, durationSec, width: info?.width, height: info?.height, ...(trimmed ? { playSec: spanTotal(trimmed) } : {}) } });
        await sendToStream(start.uploadURL, file, () => {});
        if (!auth.currentUser) throw new Error("Sign in first.");
        // One moment per part, in order (each waits for the one before, so they appear in the right order). A voice-over goes on the first.
        // Trimmed: the stretches that play, dealt out over the moments there is room for, each with the captions said inside them.
        const parts: Span[][] | null = trimmed ? splitSpans(trimmed, start.partsAllowed) : null;
        const clips = parts ? parts.map((p) => ({ start: p[0][0], end: p[p.length - 1][1] })) : momentVideoClips(durationSec, start.partsAllowed);
        const voiceId = voice ? await uploadVoiceOver(voice) : undefined;
        const tidyOf = (i: number): Record<string, unknown> => {
          const span: Span[] = parts ? parts[i] : [[clips[i].start, clips[i].end]];
          const said = target === "video" && caps ? wordsIn(caps.words, span) : [];
          return {
            ...(parts ? { spans: parts[i] } : {}),
            ...(said.length ? { captions: { ...caps, words: said } } : {}),
            ...(i === 0 && voiceId && target === "voice" && tidy.spans ? { audioSpans: tidy.spans } : {}),
            ...(i === 0 && voiceId && target === "voice" && caps ? { captions: caps } : {}),
          };
        };
        let made = 0;
        try {
          for (let i = 0; i < clips.length; i++) {
            const caption = clips.length === 1 ? text : text ? `${text} (${i + 1}/${clips.length})` : `Part ${i + 1} of ${clips.length}`;
            await api("/api/moments", { body: { kind: "video", hours, text: caption, videoUploadId: start.id, clipStart: clips[i].start, clipEnd: clips[i].end, ...(i === 0 && voiceId ? { audioUploadId: voiceId } : {}), ...(songId ? { songId } : {}), ...tidyOf(i) } });
            made++;
          }
        } catch (e) {
          if (made) onPosted();
          throw new Error(`${made ? `Shared ${made} of ${clips.length} parts. ` : ""}${e instanceof Error ? e.message : "Couldn't share the rest."}`);
        }
        onPosted();
        if (clips.length > 1 || start.partsNeeded > start.partsAllowed) {
          const used = Math.round(parts ? parts.reduce((n, p) => n + spanTotal(p), 0) : clips[clips.length - 1].end - clips[0].start);
          setDoneNote(
            start.partsAllowed >= start.partsNeeded
              ? `Your ${clock(durationSec)} video was shared as ${clips.length} moments, in order, each up to ${MOMENT_VIDEO_MAX_SECONDS} seconds.${voiceId ? " The voice-over is on the first one." : ""}`
              : `Your video is ${clock(durationSec)} long, but your plan had room for ${clips.length === 1 ? "one more video moment" : `${clips.length} more video moments`} this week, so only the first ${clock(used)} was shared (${clips.length === 1 ? "one moment" : `${clips.length} moments`}). The rest was left out.`
          );
          return;
        }
        onClose();
        return;
      }
      if (voice) {
        body.audioUploadId = await uploadVoiceOver(voice);
        if (target === "voice" && tidy.spans) body.audioSpans = tidy.spans;
        if (target === "voice" && caps) body.captions = caps;
      }
      if (songId) body.songId = songId;
      if (!auth.currentUser) throw new Error("Sign in first.");
      await api("/api/moments", { body });
      onPosted();
      onClose();
    } catch (e) {
      const d = contentCheckOf(e);
      if (d) setBlocked(d);
      else setError(e instanceof Error ? e.message : "Couldn't share the moment.");
    } finally {
      setBusy(false);
    }
  }

  const tooLong = !!duration && duration > MOMENT_VIDEO_SOURCE_MAX_SECONDS + 1;
  const noRoom = needed > 1 && !!quota && quota.remaining === 0;
  const cantShare = busy || tooLong || noRoom || (kind === "text" ? !text.trim() : !file);
  const next = steps[at + 1];
  const go = (s: Step) => { setStep(s); setError(null); if (s === "captions" && !tidy.words && !tidy.writing) void tidy.write(); };
  const back = () => (at > 0 ? setStep(steps[at - 1]) : onClose());
  // Playing the trim here: the same skipping the viewer does.
  const onTime = () => {
    const p = player.current; if (!p) return;
    setPreviewAt(p.currentTime);
    if (!tidy.spans) return;
    const h = playhead(tidy.spans, p.currentTime);
    if (h.seek !== undefined) p.currentTime = h.seek; else if (h.done) { p.pause(); p.currentTime = tidy.spans[0][0]; }
  };
  // For checking, whole sentences read better than the short lines shown on the video.
  const lines = useMemo(() => (tidy.words ? captionLines(tidy.words, 64) : []), [tidy.words]);
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => { page.current?.scrollTo({ top: 0 }); }, [step]);

  if (doneNote) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Moment shared">
        <div className={`${cardCls} w-full max-w-md p-6 shadow-xl`}>
          <h2 className="font-display text-2xl text-ink">Shared</h2>
          <p className="mt-3 text-sm text-slate">{doneNote}</p>
          <button onClick={onClose} className={`${pillPrimary} mt-5 w-full`}>Close</button>
        </div>
      </div>
    );
  }

  const title = step === "trim" ? "Trim the pauses" : step === "captions" ? "Check your captions" : "New moment";
  const preview = (showCaptions: boolean) => (
    <div className="relative overflow-hidden rounded-2xl bg-[#E4E1DF]">
      {target === "voice" || kind !== "video"
        ? <div className="flex aspect-[4/3] items-center justify-center p-4 lg:aspect-[3/4]">{kind === "image" && fileUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={fileUrl} alt="" className="max-h-full max-w-full rounded-xl object-contain" /> : <p className="px-4 text-center font-display text-xl text-ink">{text || "Your voice-over"}</p>}
            {tidy.url && <audio ref={(el) => { player.current = el; }} src={tidy.url} controls onTimeUpdate={onTime} onPlay={onTime} className="absolute inset-x-3 bottom-3 h-9" />}</div>
        : <video ref={(el) => { player.current = el; }} src={fileUrl} controls playsInline onTimeUpdate={onTime} onPlay={onTime} className="aspect-[4/3] w-full bg-black object-contain lg:aspect-[3/4]" />}
      {showCaptions && caps && <CaptionOverlay captions={{ ...caps, of: target === "voice" ? "voice" : "video" }} time={previewAt} />}
      {step === "trim" && tidy.sound && <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 font-ui text-xs font-bold text-white">{clock(tidy.after)}</span>}
    </div>
  );

  return (
    <div ref={page} className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-paper lg:top-[4.5rem] lg:z-30" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-8 pt-12 lg:max-w-5xl lg:px-8 lg:pb-24 lg:pt-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={back} aria-label={at > 0 ? "Back" : "Close"} className="-ml-1 text-ink lg:hidden">{at > 0 ? <IconBack size={26} /> : <IconClose size={26} />}</button>
            {at > 0 && <button type="button" onClick={back} aria-label="Back" className="hidden text-ink lg:block"><IconBack size={24} /></button>}
            <h2 className="whitespace-nowrap font-display text-[25px] font-semibold leading-none text-ink lg:text-[32px]">{title}</h2>
          </div>
          <Steps step={at + 1} of={steps.length} />
        </div>
        <StepBars step={at + 1} of={steps.length} />

        {/* ── Step 1 · New moment ───────────────────────────────────────────────────────────────────── */}
        {step === "make" && (
          <div className="mt-5 grid flex-1 gap-5 lg:grid-cols-[minmax(0,26rem),minmax(0,1fr)] lg:gap-8">
            <div className={`space-y-4 lg:rounded-3xl lg:border lg:border-rule lg:bg-card lg:self-start lg:p-5`}>
              <div className="flex rounded-full bg-field p-1" role="tablist" aria-label="Kind of moment">
                {(["text", "image", "video"] as MomentKind[]).map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setFile(null); setDuration(null); setQuota(null); }}
                    className={`h-11 flex-1 rounded-full font-ui text-[15px] ${kind === k ? "bg-crimson font-bold text-white" : "text-ink"}`}>{k === "text" ? "Text" : k === "image" ? "Picture" : "Video"}</button>
                ))}
              </div>
              <input ref={fileInput} type="file" hidden accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/gif,image/avif" : VIDEO_ACCEPT} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
              {kind === "text" ? (
                <div className="relative">
                  <MentionPicker target={captionBox} value={text} onChange={setText} />
                  <textarea ref={captionBox} value={text} onChange={(e) => setText(e.target.value)} maxLength={MOMENT_TEXT_MAX} rows={6} placeholder={MOMENT_HINT} className={`${cardCls} w-full p-4 font-display text-xl text-ink outline-none focus:border-crimson`} />
                  <p className="text-right font-ui text-xs text-slate">{text.length}/{MOMENT_TEXT_MAX}</p>
                </div>
              ) : !file ? (
                <button type="button" onClick={() => fileInput.current?.click()} className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rule bg-card font-ui text-[15px] font-bold text-crimson lg:aspect-[3/4]">
                  {kind === "image" ? "Choose a picture" : "Choose a video"}<span className="text-xs font-normal text-slate">{kind === "video" ? `Up to ${MOMENT_VIDEO_MAX_SECONDS} seconds a moment` : "JPEG, PNG or WebP"}</span>
                </button>
              ) : (
                <div className="relative overflow-hidden rounded-2xl bg-[#E4E1DF]">
                  {kind === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={fileUrl} alt="" className="aspect-[4/3] w-full object-contain lg:aspect-[3/4]" /> : <video src={fileUrl} muted playsInline className="aspect-[4/3] w-full bg-black object-contain lg:aspect-[3/4]" />}
                  <button type="button" onClick={() => fileInput.current?.click()} className="absolute bottom-3 left-3 rounded-full bg-white px-4 py-1.5 font-ui text-[13px] font-bold text-ink shadow">Replace {kind === "image" ? "picture" : "video"}</button>
                  {kind === "video" && duration !== null && <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 font-ui text-xs font-bold text-white">{clock(duration)}</span>}
                </div>
              )}
              {kind !== "text" && <p className="font-ui text-xs text-slate">{kind === "video" ? `Up to ${MOMENT_VIDEO_MAX_SECONDS} seconds. ` : ""}It carries the NotesApp mark and your @username.</p>}
            </div>

            <div className="flex flex-col gap-4">
              {source && (
                <>
                  <p className="hidden font-ui text-sm font-semibold text-slate lg:block">Tidy up{target === "voice" ? " the voice-over" : ""}</p>
                  <div className={`${cardCls} divide-y divide-rule px-4`}>
                    <div className="flex items-center gap-3 py-3.5">
                      <IconScissors className="shrink-0 text-crimson" />
                      <span className="min-w-0 flex-1 font-ui text-[16px] text-ink">Trim the pauses<span className="block text-[13px] text-slate">{tidy.reading ? "Listening for pauses…" : !tidy.sound ? tidy.error || "Couldn't read the sound" : !tidy.pauses.length || !tidy.worth ? "No long pauses found" : `Saves ${Math.round(tidy.saved)} seconds`}</span></span>
                      <Switch on={tidy.trim && tidy.worth} disabled={!tidy.worth} onChange={tidy.setTrim} label="Trim the pauses" />
                    </div>
                    {tidyOn.captions && (
                      <div className="flex items-center gap-3 py-3.5">
                        <IconCc className="shrink-0 text-crimson" />
                        <span className="min-w-0 flex-1 font-ui text-[16px] text-ink">Add captions<span className="block text-[13px] text-slate">Shows each word as you say it</span></span>
                        <Switch on={tidy.captions} disabled={!tidy.sound} onChange={tidy.setCaptions} label="Add captions" />
                      </div>
                    )}
                  </div>
                  {tidy.sound && tidy.spans && (
                    <div className="hidden grid-cols-2 gap-3 lg:grid">
                      <div className={`${cardCls} px-4 py-3 font-ui text-xs text-slate`}>Before<b className="block font-display text-2xl text-ink">{clock(tidy.sound.duration)}</b>{target === "video" ? `${untrimmedParts} moment${untrimmedParts === 1 ? "" : "s"}` : "voice-over"}</div>
                      <div className={`${cardCls} border-2 !border-crimson px-4 py-3 font-ui text-xs text-slate`}>After<b className="block font-display text-2xl text-crimson">{clock(tidy.after)}</b>{target === "video" ? `${needed} moment${needed === 1 ? "" : "s"}` : "voice-over"}</div>
                    </div>
                  )}
                </>
              )}
              {kind === "video" && duration !== null && (tooLong || needed > 1 || untrimmedParts > 1) && (
                <Notice>
                  {tooLong ? `That video is ${clock(duration)} long. We can use videos of up to ${MOMENT_VIDEO_SOURCE_MAX_SECONDS / 60} minutes.`
                    : needed === 1 ? <>Trimmed, your video fits in one moment, so it uses <b>1</b> of your video moments this week, not {untrimmedParts}.</>
                    : !quota ? `That video is ${clock(duration)}. Checking how many video moments you have left this week…`
                    : quota.remaining === 0 ? `That video is ${clock(duration)}, longer than the ${MOMENT_VIDEO_MAX_SECONDS} seconds a moment can be, and you've used all ${quota.limit} of this week's video moments${quota.limit === 0 ? " (video moments come with a paid plan)" : ""}. Pictures and text are still free.`
                    : allowed >= needed ? `That video is ${clock(duration)}, longer than the ${MOMENT_VIDEO_MAX_SECONDS} seconds a moment can be. It will be shared as ${needed} moments, in order, each up to ${MOMENT_VIDEO_MAX_SECONDS} seconds. That uses ${needed} of your ${quota.remaining} video moments left this week.${voice ? " The voice-over goes on the first one." : ""}`
                    : `That video is ${clock(duration)}, longer than the ${MOMENT_VIDEO_MAX_SECONDS} seconds a moment can be, and you have ${quota.remaining === 1 ? "1 video moment" : `${quota.remaining} video moments`} left this week. Only the first ${clock(Math.min(duration, allowed * MOMENT_VIDEO_MAX_SECONDS))} will be shared; the rest will be left out.`}
                </Notice>
              )}

              <p className="hidden font-ui text-sm font-semibold text-slate lg:block">More</p>
              <div className={`${cardCls} divide-y divide-rule px-4`}>
                {kind !== "text" && (
                  <div>
                    <button type="button" onClick={() => setOpen(open === "note" ? "" : "note")} aria-expanded={open === "note"} className="flex w-full items-center gap-3 py-3.5 text-left">
                      <IconNote className="shrink-0 text-ink" /><span className="flex-1 font-ui text-[16px] font-semibold text-ink">Note</span>
                      <span className="max-w-[9rem] truncate font-ui text-[14px] text-slate">{text || "Add a note"}</span><IconChevron size={18} className={`text-slate transition-transform ${open === "note" ? "rotate-90" : ""}`} />
                    </button>
                    {open === "note" && (
                      <div className="relative pb-3">
                        <MentionPicker target={captionBox} value={text} onChange={setText} />
                        <textarea ref={captionBox} value={text} onChange={(e) => setText(e.target.value)} maxLength={MOMENT_TEXT_MAX} rows={3} placeholder={MOMENT_HINT} className="w-full rounded-2xl border border-rule bg-paper p-3 text-sm text-ink outline-none focus:border-crimson" />
                        <p className="text-right font-ui text-xs text-slate">{text.length}/{MOMENT_TEXT_MAX}</p>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <button type="button" onClick={() => setOpen(open === "sound" ? "" : "sound")} aria-expanded={open === "sound"} className="flex w-full items-center gap-3 py-3.5 text-left">
                    <IconMusic className="shrink-0 text-ink" /><span className="flex-1 font-ui text-[16px] font-semibold text-ink">Sound</span>
                    <span className="font-ui text-[14px] text-slate">{voice ? "Voice-over" : songId ? "A song" : kind === "video" ? "Original sound" : "None"}</span><IconChevron size={18} className={`text-slate transition-transform ${open === "sound" ? "rotate-90" : ""}`} />
                  </button>
                  {open === "sound" && <div className="pb-4"><VoiceOverRecorder value={voice} onChange={setVoice} /><div className="mt-3"><SongPicker value={songId} onChange={setSongId} /></div></div>}
                </div>
                <div>
                  <button type="button" onClick={() => setOpen(open === "hours" ? "" : "hours")} aria-expanded={open === "hours"} className="flex w-full items-center gap-3 py-3.5 text-left">
                    <IconTimer className="shrink-0 text-ink" /><span className="flex-1 font-ui text-[16px] font-semibold text-ink">Disappears after<span className="block text-[13px] font-normal text-slate">{hours === 24 ? "You can also choose 48 or 72 hours" : "24, 48 or 72 hours"}</span></span>
                    <span className="font-ui text-[14px] text-slate">{hours} hours</span><IconChevron size={18} className={`text-slate transition-transform ${open === "hours" ? "rotate-90" : ""}`} />
                  </button>
                  {open === "hours" && <div className="flex gap-2 pb-4">{MOMENT_HOURS.map((h) => <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)} className={`h-10 flex-1 rounded-full border font-ui text-sm ${hours === h ? "border-crimson bg-crimson font-bold text-white" : "border-rule bg-card text-ink"}`}>{h} hours</button>)}</div>}
                </div>
              </div>
              <p className="font-ui text-xs leading-relaxed text-slate">A moment shows on your picture for 24 to 72 hours, then disappears. It doesn&apos;t change your profile picture.</p>

              {error && <p className="font-ui text-sm text-red-700" role="alert">{error}</p>}
              {blocked && <BlockedNotice detail={blocked} onRemovePhoto={() => setFile(null)} onClose={() => setBlocked(null)} />}
              <div className="mt-auto flex gap-3 pt-2 lg:justify-end">
                <button type="button" onClick={onClose} className={`${pillGhost} hidden !border-rule !text-ink lg:inline-flex`}>Cancel</button>
                {next
                  ? <button type="button" onClick={() => go(next)} disabled={cantShare || tidy.reading} className={`${pillPrimary} w-full lg:w-auto`}>Next: check it</button>
                  : <button type="button" onClick={post} disabled={cantShare} className={`${pillPrimary} w-full lg:w-auto`}>{busy ? "Sharing…" : "Share moment"}</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2 · Trim the pauses ───────────────────────────────────────────────────────────── */}
        {step === "trim" && tidy.sound && (
          <div className="mt-5 grid flex-1 gap-5 lg:grid-cols-[minmax(0,26rem),minmax(0,1fr)] lg:gap-8">
            <div className={`space-y-3 lg:rounded-3xl lg:border lg:border-rule lg:bg-card lg:self-start lg:p-5`}>
              {preview(false)}
              <Wave sound={tidy.sound} pauses={tidy.pauses} kept={tidy.kept} />
              <Legend out={tidy.pauses.length - tidy.kept.size} />
            </div>
            <div className="flex flex-col gap-4">
              <p className="font-ui text-[16px] font-bold text-ink lg:text-sm lg:font-semibold lg:text-slate">Take out pauses longer than</p>
              <div className="flex gap-2">
                {PAUSE_CHOICES.map((p) => <button key={p} type="button" aria-pressed={tidy.prefs.pause === p} onClick={() => { tidy.resetKept(); tidy.change({ pause: p }); }} className={`h-12 flex-1 rounded-full border font-ui text-[15px] ${tidy.prefs.pause === p ? "border-crimson bg-crimson font-bold text-white" : "border-rule bg-card text-ink"}`}>{PAUSE_LABEL[p]}</button>)}
              </div>
              <p className="font-ui text-[13.5px] leading-snug text-slate">A short breath is kept on each side, so it never cuts inside a word. Nothing is deleted: the moment skips the grey parts when it plays.</p>
              {tidy.pauses.length > 0 && (
                <div className={`${cardCls} max-h-52 divide-y divide-rule overflow-y-auto px-4`}>
                  {tidy.pauses.slice(0, 20).map(([a, b], i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-3"><span className="font-ui text-[15px] text-ink">Keep the pause at {clock(a)} <span className="text-slate">({(b - a).toFixed(1)}s)</span></span><Switch on={tidy.kept.has(i)} onChange={() => tidy.toggleKeep(i)} label={`Keep the pause at ${clock(a)}`} /></div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className={`${cardCls} px-4 py-3 font-ui text-xs text-slate`}>Before<b className="block font-display text-2xl text-ink">{clock(tidy.sound.duration)}</b>{target === "video" ? `${untrimmedParts} moment${untrimmedParts === 1 ? "" : "s"}` : "voice-over"}</div>
                <div className={`${cardCls} border-2 !border-crimson px-4 py-3 font-ui text-xs text-slate`}>After<b className="block font-display text-2xl text-crimson">{clock(tidy.after)}</b>{target === "video" ? `${needed} moment${needed === 1 ? "" : "s"}` : "voice-over"}</div>
              </div>
              {error && <p className="font-ui text-sm text-red-700" role="alert">{error}</p>}
              {blocked && <BlockedNotice detail={blocked} onRemovePhoto={() => setFile(null)} onClose={() => setBlocked(null)} />}
              <div className="mt-auto flex gap-3 pt-2 lg:justify-end">
                <button type="button" onClick={() => { tidy.setTrim(false); setStep("make"); }} className={`${pillGhost} flex-1 lg:flex-none`}>Undo the trim</button>
                {next
                  ? <button type="button" onClick={() => go(next)} className={`${pillPrimary} flex-1 lg:flex-none`}>Looks good</button>
                  : <button type="button" onClick={post} disabled={cantShare} className={`${pillPrimary} flex-1 lg:flex-none`}>{busy ? "Sharing…" : "Share moment"}</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3 · Check your captions ───────────────────────────────────────────────────── */}
        {step === "captions" && (
          <div className="mt-5 grid flex-1 gap-5 lg:grid-cols-[minmax(0,26rem),minmax(0,1fr)] lg:gap-8">
            <div className={`hidden lg:block lg:rounded-3xl lg:border lg:border-rule lg:bg-card lg:self-start lg:p-5`}>{preview(true)}</div>
            <div className="flex flex-col gap-3">
              {tidy.writing ? <p className={`${cardCls} p-5 font-ui text-sm text-slate`} role="status">{tidy.writing} Only the sound is sent, and it isn&apos;t kept.</p>
                : !tidy.words?.length ? (
                  <div className={`${cardCls} space-y-3 p-5`}>
                    <p className="font-ui text-sm text-slate">{tidy.error || "No captions yet."}</p>
                    <label className="flex items-center gap-2 font-ui text-sm text-ink">I&apos;m speaking
                      <select value={tidy.prefs.lang} onChange={(e) => tidy.change({ lang: e.target.value as CaptionLang })} className="rounded-full border border-rule bg-card px-3 py-1.5 text-sm">{CAPTION_LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
                    </label>
                    <button type="button" onClick={() => tidy.write()} className={pillGhost}>Try again</button>
                  </div>
                ) : (
                  <>
                    <p className="font-ui text-[13.5px] text-slate">Tap a line to fix a word. Names and places are the usual slips.</p>
                    <div className="space-y-2">
                      {lines.map((l, i) => editing === i ? (
                        <form key={i} onSubmit={(e) => { e.preventDefault(); tidy.setWords(editLine(tidy.words!, l, draft)); setEditing(-1); }} className={`${cardCls} flex gap-2 !border-2 !border-crimson p-2`}>
                          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={120} aria-label={`Caption at ${clock(l.s)}`} className="min-w-0 flex-1 bg-transparent px-2 font-ui text-[16px] text-ink outline-none" />
                          <button type="submit" className="rounded-full bg-crimson px-4 py-2 font-ui text-sm font-bold text-white">Save</button>
                        </form>
                      ) : (
                        <button key={i} type="button" onClick={() => { setEditing(i); setDraft(l.words.map((w) => w.w).join(" ")); }} className={`${cardCls} flex w-full items-start gap-4 px-4 py-3.5 text-left`}>
                          <small className="w-9 shrink-0 pt-0.5 font-ui text-[13px] text-slate">{clock(l.s)}</small>
                          <span className="font-ui text-[16px] leading-snug text-ink">{l.words.map((w, j) => <span key={j} className={w.u ? "underline decoration-ink underline-offset-4" : ""}>{w.w}{" "}</span>)}</span>
                        </button>
                      ))}
                    </div>
                    <p className="font-ui text-[15px] font-bold text-ink lg:text-sm lg:font-semibold lg:text-slate">Look</p>
                    <div className="grid grid-cols-3 gap-2">
                      {CAPTION_STYLES.map((s) => (
                        <button key={s} type="button" aria-pressed={tidy.prefs.style === s} onClick={() => tidy.change({ style: s })} className={`h-12 rounded-2xl bg-[#2A2422] font-ui text-[15px] font-extrabold text-white ${tidy.prefs.style === s ? "outline outline-[3px] outline-offset-0 outline-crimson" : ""}`}>
                          {s === "clean" ? "Clean" : <>{s === "bold" ? "Bold " : "Colour "}<span className={s === "bold" ? "rounded-md bg-[#FFD23F] px-1.5 py-0.5 text-[#1A1210]" : "text-[#FFD23F]"}>word</span></>}
                        </button>
                      ))}
                    </div>
                    <p className="font-ui text-[15px] font-bold text-ink lg:text-sm lg:font-semibold lg:text-slate">Where</p>
                    <div className="flex gap-2">
                      {CAPTION_PLACES.map((p) => <button key={p} type="button" aria-pressed={tidy.prefs.place === p} onClick={() => tidy.change({ place: p })} className={`h-12 flex-1 rounded-full border font-ui text-[15px] ${tidy.prefs.place === p ? "border-crimson bg-crimson font-bold text-white" : "border-rule bg-card text-ink"}`}>{p === "middle" ? "Middle" : "Lower third"}</button>)}
                    </div>
                    <Notice>Captions are written by AI and can be wrong. You are sharing them, so please read them through.</Notice>
                  </>
                )}
              {error && <p className="font-ui text-sm text-red-700" role="alert">{error}</p>}
              {blocked && <BlockedNotice detail={blocked} onRemovePhoto={() => setFile(null)} onClose={() => setBlocked(null)} />}
              <div className="mt-auto flex gap-3 pt-3 lg:justify-end">
                <button type="button" onClick={post} disabled={cantShare || !!tidy.writing} className={`${pillPrimary} w-full lg:w-auto`}>{busy ? "Sharing…" : tidy.words?.length ? "Share moment" : "Share without captions"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
