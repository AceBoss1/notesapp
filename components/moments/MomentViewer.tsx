"use client";

import { SongPlayer, SongTag } from "@/components/media/SongPicker";
import { useEffect, useRef, useState } from "react";
import { playClock, playedAt, playhead, playerNews, spanTotal, type Span } from "@/lib/moments-tidy";
import { saveTidyPrefs, tidyPrefs } from "@/lib/moments-tidy-client";
import { CaptionOverlay, VoiceOver, loadStreamSdk } from "./CaptionOverlay";
import Link from "next/link";
import LinkedText from "@/components/LinkedText";
import { api } from "@/lib/moments-client";
import { timeLeftLabel } from "@/lib/moments-rules";
import type { MomentGroup, MomentView } from "@/lib/moments-server";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import { getUserByUsername } from "@/lib/users";
import FollowButton from "@/components/FollowButton";
import MessageButton from "@/components/messages/MessageButton";
import ReportDialog from "./ReportDialog";
import ShareLinkCard from "@/components/share/ShareLinkCard";
import { IconCc, IconChevron, IconClose, IconEye, IconHeart, IconMic, IconRepost, IconSound } from "./icons";
import { Switch } from "./tidy-parts";

const STILL_MS = 6000; // how long an image or text moment stays before the next one

// Full-screen viewer for one member's moments. Everything here disappears when its time is up; a reply goes to the
// owner's inbox and stays there, with a note that the moment has expired once it has.
const REACTIONS = ["❤️", "🔥", "👏", "😂", "😮"];
const ago = (iso: string) => { const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return min < 60 ? `${min} min` : min < 1440 ? `${Math.round(min / 60)}h` : `${Math.round(min / 1440)}d`; };

// On a wide screen the viewer also shows who else has moments up (to jump between people), who this is, quick reactions and details about the
// moment; on a phone it is just the player. `groups` is everyone with moments up, in the order of the Moments row.
export default function MomentViewer({ moments, onClose, onChanged, groups, onSelectGroup }: { moments: MomentView[]; onClose: () => void; onChanged?: () => void; groups?: MomentGroup[]; onSelectGroup?: (g: MomentGroup) => void }) {
  const [i, setI] = useState(0);
  const [items, setItems] = useState(moments);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [viewers, setViewers] = useState<{ uid: string; username: string; displayName: string }[] | null>(null);
  const [showViewers, setShowViewers] = useState(false);
  const [paused, setPaused] = useState(false); // you've started replying, reporting or looking at who saw it: stills stop moving on
  const [frac, setFrac] = useState(0); // how much of the moment now showing has played (0 to 1): fills its bar
  // Captions (lib/moments-tidy.ts): where the sound that carries them has got to, and whether this viewer wants to see them.
  const [heard, setHeard] = useState(0);
  const [cc, setCc] = useState(true);
  const [muted, setMuted] = useState(false);
  useEffect(() => { setCc(tidyPrefs().cc); }, []);
  const videoEl = useRef<HTMLVideoElement>(null);
  const viewed = useRef(new Set<string>()); // a moment is counted as seen once per time the viewer is open, however often this re-renders
  const advances = useRef<number[]>([]); // when we last moved on: a runaway loop closes the viewer instead of hammering the device
  const advanced = useRef<string | null>(null); // the video moment already moved on from (timeupdate fires several times near the end)
  const m = items[i];
  const gi = groups && m ? groups.findIndex((g) => g.ownerUid === m.ownerUid) : -1;
  const nextGroup = groups && gi >= 0 ? groups[gi + 1] : undefined;
  const prevGroup = groups && gi > 0 ? groups[gi - 1] : undefined;

  useEffect(() => { setShowViewers(false); setPaused(false); setFrac(0); setHeard(0); }, [i]);
  const next = () => {
    const now = Date.now();
    advances.current = advances.current.filter((t) => now - t < 3000).concat(now);
    if (advances.current.length > 6) return onClose();
    if (i + 1 < items.length) setI(i + 1); else if (nextGroup && onSelectGroup) onSelectGroup(nextGroup); else onClose();
  };
  // Stills advance by themselves; a video advances when it ends.
  useEffect(() => {
    if (!m) return;
    if (!viewed.current.has(m.id)) { viewed.current.add(m.id); api(`/api/moments/${m.id}`, { body: { action: "view" } }).catch(() => {}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, m?.id]);
  // The parts of one long video share one file, so one video element plays them all: moving to the next part only moves the
  // playhead (usually it is already there), instead of fetching and decoding the same file again for every part.
  useEffect(() => {
    const v = videoEl.current;
    if (!m || m.kind !== "video" || !v || v.readyState < 1) return; // a fresh element seeks itself once it knows its length
    const start = m.clipStart ?? 0;
    if (Math.abs(v.currentTime - start) > 0.5) v.currentTime = start;
    if (v.paused) v.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id]);
  // Pictures and text move on by themselves, long enough for the voice-over to finish if there is one; the bar fills as time passes.
  const stillMs = m ? Math.max(STILL_MS, ((m.audioSpans ? spanTotal(m.audioSpans) : m.audioDurationSec ?? 0) + 1) * 1000) : STILL_MS;
  useEffect(() => {
    if (!m || m.kind === "video" || paused) return;
    const started = Date.now(); // each moment starts its bar from empty (a pause is never resumed, so there is nothing to carry over)
    const t = setInterval(() => {
      const f = Math.min(1, (Date.now() - started) / stillMs);
      setFrac(f);
      if (f >= 1) { clearInterval(t); next(); }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, m?.id, paused]);

  // The owner sees who watched without asking: the list loads as each of their own moments comes up.
  useEffect(() => {
    if (!m?.mine) { setViewers(null); return; }
    let live = true;
    setViewers(null);
    api<{ viewers: { uid: string; username: string; displayName: string }[] }>(`/api/moments/${m.id}`).then((r) => { if (live) setViewers(r.viewers); }).catch(() => { if (live) setViewers([]); });
    return () => { live = false; };
  }, [m?.id, m?.mine]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opened from a profile picture there is no list of people, so the owner's picture and name are fetched (the header and side card show them).
  const [fetchedOwner, setFetchedOwner] = useState<{ avatar: string; displayName: string; isOrg: boolean } | null>(null);
  const listedOwner = groups?.find((g) => g.ownerUid === m?.ownerUid);
  useEffect(() => {
    if (!m || listedOwner?.avatar) return;
    let live = true;
    getUserByUsername(m.ownerUsername).then((u) => { if (live && u) setFetchedOwner({ avatar: u.avatar, displayName: u.displayName, isOrg: u.accountKind === "organisation" }); }).catch(() => {});
    return () => { live = false; };
  }, [m?.ownerUsername, listedOwner?.avatar]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m) return null;
  const prev = () => { if (i > 0) setI(i - 1); else if (prevGroup && onSelectGroup) onSelectGroup(prevGroup); };
  // Tap the left third to go back, anywhere else to go on.
  const tap = (e: React.MouseEvent<HTMLDivElement>) => { const b = e.currentTarget.getBoundingClientRect(); if (e.clientX - b.left < b.width * 0.3) prev(); else next(); };
  const pause = () => setPaused(true);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setNote(null); pause();
    try { await fn(); } catch (e) { setNote(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };

  const owner = listedOwner ?? fetchedOwner;
  const removeMoment = () => act(async () => {
    await api(`/api/moments/${m.id}`, { method: "DELETE" });
    const rest = items.filter((x) => x.id !== m.id);
    onChanged?.();
    if (!rest.length) return onClose();
    setItems(rest); setI(Math.min(i, rest.length - 1));
  });
  // Pinned, a moment stays at the top of your Media past its time; unpinned after its time is up, it goes.
  const togglePin = () => act(async () => {
    const r = await api<{ pinned: boolean; removed: boolean }>(`/api/moments/${m.id}`, { body: { action: m.pinned ? "unpin" : "pin" } });
    onChanged?.();
    if (r.removed) {
      const rest = items.filter((x) => x.id !== m.id);
      if (!rest.length) return onClose();
      setItems(rest); setI(Math.min(i, rest.length - 1));
      return;
    }
    setItems(items.map((x) => (x.id === m.id ? { ...x, pinned: r.pinned } : x)));
    setNote(r.pinned ? "Pinned to your Media. It stays there after its time is up, until you unpin it." : "Unpinned.");
  });
  const react = (emoji: string) => act(async () => {
    if (!m.liked) {
      const r = await api<{ liked: boolean; likeCount: number }>(`/api/moments/${m.id}`, { body: { action: "like" } });
      setItems(items.map((x) => (x.id === m.id ? { ...x, liked: r.liked, likeCount: r.likeCount } : x)));
    }
    await api(`/api/moments/${m.id}`, { body: { action: "reply", text: emoji } });
    setNote(`Sent ${emoji} to @${m.ownerUsername}.`);
  });
  const length = m.kind === "video" ? (m.spans?.length ? spanTotal(m.spans) : m.clipEnd != null ? m.clipEnd - (m.clipStart ?? 0) : m.durationSec) : undefined;
  // The look is the owner's "Moments Redesign" (Moda, 16 Nov 2026): a light page with the moment on a rounded stage. On a phone the
  // owner's numbers and actions, or the viewer's reply, sit under the stage; on a wide screen they are a panel beside it.
  const card = "rounded-3xl border border-rule bg-card";
  const round = "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-rule bg-card text-crimson disabled:opacity-50";
  const timeLeft = `${m.resharedFrom ? `reshared from @${m.resharedFrom.ownerUsername} · ` : ""}${m.pinned && timeLeftLabel(m.expiresAt) === "expired" ? "📌 Pinned" : timeLeftLabel(m.expiresAt)}`;
  const canMute = (m.kind === "video" && !m.streamVideo) || !!m.audioUrl;
  const like = () => act(async () => {
    const r = await api<{ liked: boolean; likeCount: number }>(`/api/moments/${m.id}`, { body: { action: "like" } });
    setItems(items.map((x) => (x.id === m.id ? { ...x, liked: r.liked, likeCount: r.likeCount } : x)));
  });
  const repost = () => act(async () => { await api(`/api/moments/${m.id}`, { body: { action: "reshare" } }); setNote("Reshared to your moments."); onChanged?.(); });
  const uncaption = () => act(async () => { await api(`/api/moments/${m.id}`, { body: { action: "uncaption" } }); setItems(items.map((x) => (x.id === m.id ? { ...x, captions: undefined } : x))); });
  const toggleCc = () => { setCc(!cc); saveTidyPrefs({ cc: !cc }); };
  const bars = (onStage: boolean) => (
    <div className={`flex gap-1.5 ${onStage ? "absolute inset-x-4 top-4 z-10 hidden lg:flex" : "lg:hidden"}`} aria-hidden>
      {/* One bar per moment: the maroon part is what has played, the rest is still to come. */}
      {items.map((x, k) => (
        <span key={x.id} className={`h-1 flex-1 overflow-hidden rounded-full ${onStage ? "bg-white/40" : "bg-rule"}`}>
          <span className={`block h-full transition-[width] duration-300 ease-linear ${onStage ? "bg-white" : "bg-crimson"}`} style={{ width: `${k < i ? 100 : k === i ? Math.round(frac * 100) : 0}%` }} />
        </span>
      ))}
    </div>
  );
  const who = (
    <div className="flex items-center gap-3">
      <Link href={`/u/${m.ownerUsername}`} className="flex min-w-0 items-center gap-3">
        <span className={`block shrink-0 border-2 border-crimson p-[2px] ${owner?.isOrg ? "rounded-2xl" : "rounded-full"}`}><Avatar src={owner?.avatar ?? ""} alt="" size={40} square={!!owner?.isOrg} /></span>
        <span className="min-w-0"><span className="flex min-w-0 items-center font-ui text-[16px] font-bold text-ink"><span className="truncate">@{m.ownerUsername}</span><NameBadgeIcons username={m.ownerUsername} size={14} /></span><span className="block font-ui text-[13px] text-slate">{timeLeft}</span></span>
      </Link>
      {m.audioUrl && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-field px-3 py-1.5 font-ui text-[13px] font-bold text-crimson"><IconMic size={16} />Voice-over</span>}
      <button onClick={onClose} aria-label="Close" className="ml-auto shrink-0 text-ink"><IconClose size={26} /></button>
    </div>
  );
  const watched = m.mine && (
    <div className={card}>
      <button type="button" onClick={() => { pause(); setShowViewers((v) => !v); }} aria-expanded={showViewers} className="flex w-full items-center gap-3 px-4 py-3 text-left lg:pointer-events-none">
        <span className="flex -space-x-2">{(viewers ?? []).slice(0, 2).map((v, k) => <span key={v.uid} className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-card font-ui text-xs font-bold text-white ${k ? "bg-[#5C534E]" : "bg-crimson"}`}>{v.displayName.slice(0, 2).toUpperCase()}</span>)}</span>
        <span className="flex-1 font-ui text-[15px] font-bold text-ink">{viewers === null ? "Who watched" : `${viewers.length} watched`}</span>
        <IconChevron size={18} className={`text-slate transition-transform lg:hidden ${showViewers ? "rotate-90" : ""}`} />
      </button>
      <ul className={`max-h-56 space-y-2 overflow-y-auto border-t border-rule px-4 py-3 font-ui text-sm text-ink ${showViewers ? "" : "hidden lg:block"}`}>
        {viewers === null ? <li className="text-slate">Loading…</li> : viewers.length === 0 ? <li className="text-slate">No one has seen it yet.</li> : viewers.map((v) => <li key={v.uid}>{v.displayName} <span className="text-slate">@{v.username}</span></li>)}
        <li className="pt-1 text-xs text-slate">Only you can see this list. Replies come to your Messages.</li>
      </ul>
    </div>
  );
  const replyForm = !m.mine && (
    <>
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!reply.trim()) return; act(async () => { await api(`/api/moments/${m.id}`, { body: { action: "reply", text: reply } }); setReply(""); setNote("Sent to their inbox."); }); }}>
        <input value={reply} onFocus={pause} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" aria-label={`Reply to @${m.ownerUsername}`} maxLength={2000} className="h-12 min-w-0 flex-1 rounded-full border border-rule bg-card px-5 font-ui text-[15px] text-ink outline-none placeholder:text-slate focus:border-crimson" />
        {reply.trim() ? <button disabled={busy} className="h-12 rounded-full bg-crimson px-5 font-ui text-sm font-bold text-white disabled:opacity-50">Send</button> : (
          <>
            <button type="button" disabled={busy} onClick={like} aria-pressed={m.liked} aria-label={m.liked ? "Liked" : "Like"} className={`${round} lg:w-auto lg:gap-2 lg:px-5 ${m.liked ? "!border-crimson !bg-crimson !text-white" : ""}`}><IconHeart /><span className="hidden font-ui text-sm font-bold text-ink lg:inline">{m.liked ? "Liked" : "React"}</span></button>
            <button type="button" disabled={busy} onClick={repost} aria-label="Repost to my moments" className={`${round} !text-ink lg:w-auto lg:gap-2 lg:px-5`}><IconRepost /><span className="hidden font-ui text-sm font-bold lg:inline">Repost</span></button>
          </>
        )}
      </form>
      <div className="flex items-center gap-2" aria-label="Quick reactions">
        {REACTIONS.map((e) => <button key={e} type="button" disabled={busy} onClick={() => react(e)} aria-label={`React with ${e}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-field text-lg disabled:opacity-50">{e}</button>)}
        <button type="button" disabled={busy} onClick={() => { pause(); setReporting(true); }} className="ml-auto font-ui text-xs text-slate underline">Report</button>
      </div>
    </>
  );
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-paper text-ink lg:top-[4.5rem] lg:z-30" role="dialog" aria-modal="true" aria-label={`Moments from @${m.ownerUsername}`}>
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-3 px-6 pb-6 pt-12 lg:max-w-5xl lg:flex-row lg:gap-8 lg:px-8 lg:pt-8">
        <div className="space-y-3 lg:hidden">{bars(false)}{who}</div>

        {/* The stage. The picture or video is letterboxed inside it, so a wide or very large file can never spill past its edges. */}
        <div className="relative aspect-[3/4.8] w-full shrink-0 overflow-hidden rounded-3xl bg-black text-white lg:aspect-auto lg:h-[calc(100vh-9rem)] lg:w-[26rem]">
          {bars(true)}
          <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden" onClick={tap}>
            {m.kind === "image" && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.imageUrl} alt="" className="h-full w-full object-contain" />}
            {m.kind === "video" && m.streamVideo && (
              // On Cloudflare Stream with the NotesApp mark burned in (signed: a player link only for the moment's audience).
              <StreamMoment key={m.id} id={m.id} clipStart={m.clipStart ?? 0} clipEnd={m.clipEnd} spans={m.spans} onTime={m.captions?.of === "video" ? setHeard : undefined}
                onProgress={(f) => setFrac((p) => (p === f ? p : f))}
                onDone={() => { if (advanced.current !== m.id) { advanced.current = m.id; next(); } }}
                onError={(t) => setNote(t)} />
            )}
            {m.kind === "video" && !m.streamVideo && (
              // A part of a longer video plays only its own stretch of the file: it starts at clipStart and moves on at clipEnd.
              <video
                key={m.videoUrl} ref={videoEl} src={m.videoUrl} autoPlay playsInline controls={false} muted={muted} className="h-full w-full object-contain"
                onLoadedMetadata={(e) => { if (m.clipStart) e.currentTarget.currentTime = m.clipStart; }}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget, from = m.clipStart ?? 0, to = m.clipEnd ?? v.duration;
                  if (m.captions?.of === "video") setHeard(v.currentTime);
                  if (m.spans?.length) {
                    // Trimmed: skip the pauses, and fill the bar by what has played.
                    const h = playhead(m.spans, v.currentTime), all = spanTotal(m.spans);
                    if (all > 0) { const f = Math.round(Math.min(1, playedAt(m.spans, v.currentTime) / all) * 100) / 100; setFrac((p) => (p === f ? p : f)); }
                    if (h.seek !== undefined) v.currentTime = h.seek;
                    else if (h.done && advanced.current !== m.id) { advanced.current = m.id; next(); }
                    return;
                  }
                  if (to > from && Number.isFinite(to)) { const f = Math.round(Math.min(1, Math.max(0, (v.currentTime - from) / (to - from))) * 100) / 100; setFrac((p) => (p === f ? p : f)); }
                  if (m.clipEnd && e.currentTarget.currentTime >= m.clipEnd - 0.05 && advanced.current !== m.id) { advanced.current = m.id; next(); }
                }}
                onError={() => setNote("This video couldn't be loaded. Check your connection and try again.")}
                onEnded={() => { if (advanced.current !== m.id) { advanced.current = m.id; next(); } }}
              />
            )}
            {m.kind === "link" && m.link && <div className="flex w-full justify-center px-6"><ShareLinkCard link={m.link} /></div>}
            {m.kind === "text" && <p className="px-8 text-center font-display text-3xl leading-snug"><LinkedText text={m.text ?? ""} linkClass="text-white underline underline-offset-4" /></p>}
            {/* Its own key: the video beside it is keyed by the moment too, and two children with one key get duplicated or dropped. */}
            {m.audioUrl && <VoiceOver key={`voice-${m.id}`} src={m.audioUrl} spans={m.audioSpans} muted={muted} onTime={m.captions?.of === "voice" ? setHeard : undefined} />}
            {/* A NotesApp Sounds song: softer under a video or a voice-over, paused with the moment. A moment in a run of parts restarts it. */}
            {m.songId && <SongPlayer key={`song-${m.id}`} songId={m.songId} under={m.kind === "video" || !!m.audioUrl} paused={paused || muted} />}
          </div>
          {m.captions && cc && <><div className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] h-2/5 bg-gradient-to-t from-black/70 to-transparent" /><CaptionOverlay captions={m.captions} time={heard} /></>}
          {(m.captions || canMute) && (
            <div className="absolute bottom-24 right-3 z-10 flex flex-col gap-2 lg:bottom-28">
              {m.captions && <button type="button" onClick={toggleCc} aria-pressed={cc} aria-label={cc ? "Hide captions" : "Show captions"} title={cc ? "Hide captions" : "Show captions"} className={`flex h-11 w-11 items-center justify-center rounded-full bg-white shadow ${cc ? "text-crimson outline outline-2 outline-crimson" : "text-slate"}`}><IconCc /></button>}
              {canMute && <button type="button" onClick={() => setMuted(!muted)} aria-pressed={muted} aria-label={muted ? "Turn the sound on" : "Turn the sound off"} className={`flex h-11 w-11 items-center justify-center rounded-full bg-white shadow ${muted ? "text-slate line-through" : "text-ink"}`}><IconSound /></button>}
            </div>
          )}
          {m.songId && <p className="absolute inset-x-0 bottom-3 z-10 flex justify-center font-ui text-xs font-semibold text-white/90 drop-shadow"><SongTag songId={m.songId} /></p>}
        </div>

        {/* Under the stage on a phone. */}
        <div className="space-y-3 lg:hidden">
          {m.kind !== "text" && m.text && <p className="text-center font-ui text-[15px] text-ink"><LinkedText text={m.text} linkClass="font-semibold text-crimson underline underline-offset-2" /></p>}
          {note && <p className="text-center font-ui text-xs text-crimson" role="status">{note}</p>}
          {m.mine ? (
            <>
              <div className="flex items-center gap-2">
                <div className={`${card} flex h-12 flex-1 items-center justify-around px-3 font-ui text-[15px] font-bold text-ink`}>
                  <span className="flex items-center gap-1.5"><IconEye size={18} className="text-slate" />{m.viewCount ?? 0}</span><span className="flex items-center gap-1.5"><IconHeart size={18} className="text-crimson" />{m.likeCount}</span><span className="flex items-center gap-1.5"><IconRepost size={18} className="text-slate" />{m.reshareCount}</span>
                </div>
                <button disabled={busy} onClick={togglePin} aria-pressed={!!m.pinned} aria-label={m.pinned ? "Unpin from my Media" : "Pin to my Media"} className={`${round} ${m.pinned ? "!border-crimson !bg-[#FBF0F3]" : ""}`}>📌</button>
                <button disabled={busy} onClick={removeMoment} className="h-12 rounded-full border border-crimson/60 bg-card px-5 font-ui text-[15px] font-bold text-crimson disabled:opacity-50">Delete</button>
              </div>
              {m.captions && <button type="button" disabled={busy} onClick={uncaption} className="font-ui text-xs text-slate underline">Remove captions from this moment</button>}
              {watched}
            </>
          ) : replyForm}
        </div>

        {/* Beside the stage on a wide screen. */}
        <aside className="hidden min-w-0 flex-1 flex-col gap-4 lg:flex">
          {who}
          {m.kind !== "text" && m.text && <p className="font-display text-[28px] font-semibold leading-tight text-ink"><LinkedText text={m.text} linkClass="text-crimson underline underline-offset-4" /></p>}
          {note && <p className="font-ui text-sm text-crimson" role="status">{note}</p>}
          {m.mine ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {([[<IconEye key="e" size={16} />, "Views", m.viewCount ?? 0], [<IconHeart key="h" size={16} />, "Likes", m.likeCount], [<IconRepost key="r" size={16} />, "Reposts", m.reshareCount]] as const).map(([ic, l, n]) => (
                  <div key={l} className={`${card} px-4 py-3`}><p className="flex items-center gap-1.5 font-ui text-[13px] text-slate">{ic}{l}</p><p className="font-display text-3xl text-ink">{n}</p></div>
                ))}
              </div>
              {m.captions && (
                <>
                  <p className="font-ui text-sm font-semibold text-slate">Captions</p>
                  <div className={`${card} divide-y divide-rule px-4`}>
                    <div className="flex items-center gap-3 py-3"><IconCc className="text-crimson" /><span className="flex-1 font-ui text-[15px] text-ink">Show captions</span><Switch on={cc} onChange={toggleCc} label="Show captions" /></div>
                    <button type="button" disabled={busy} onClick={uncaption} className="flex w-full items-center justify-between py-3.5 text-left font-ui text-[15px] text-ink">Remove captions<IconChevron size={18} className="text-slate" /></button>
                  </div>
                </>
              )}
              <div className="flex gap-3">
                <button disabled={busy} onClick={togglePin} className="h-12 rounded-full border border-rule bg-card px-6 font-ui text-[15px] font-bold text-ink disabled:opacity-50">📌 {m.pinned ? "Unpin" : "Pin"}</button>
                <button disabled={busy} onClick={removeMoment} className="h-12 rounded-full border border-crimson/60 bg-card px-6 font-ui text-[15px] font-bold text-crimson disabled:opacity-50">Delete</button>
              </div>
              {watched}
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2"><FollowButton username={m.ownerUsername} /><MessageButton username={m.ownerUsername} profileUid={m.ownerUid} /></div>
              {replyForm}
              <p className="font-ui text-xs text-slate">Your reply goes straight to @{m.ownerUsername}&apos;s inbox as a private message. Only they can see it.</p>
            </>
          )}
          <p className="font-ui text-xs text-slate">{m.kind === "video" ? "Video" : m.kind === "image" ? "Picture" : m.kind === "link" ? `Shared ${m.link?.label.toLowerCase() ?? "link"}` : "Text"}{length ? ` · ${Math.floor(length / 60)}:${String(Math.round(length % 60)).padStart(2, "0")}` : ""} · posted {ago(m.createdAt)} ago · lasts {m.hours} hours{m.pinned ? " · 📌 pinned to Media, stays until unpinned" : ""}</p>
          {/* Everyone with moments up: jump between people. */}
          {groups && groups.length > 1 && (
            <div className="mt-auto">
              <p className="font-ui text-sm font-semibold text-slate">Moments from people you follow</p>
              <ul className="mt-2 flex gap-3 overflow-x-auto pb-1">
                {groups.map((g) => (
                  <li key={g.ownerUid}>
                    <button type="button" onClick={() => (g.ownerUid === m.ownerUid ? undefined : onSelectGroup?.(g))} aria-current={g.ownerUid === m.ownerUid} title={g.displayName}
                      className={`block border-2 p-[2px] ${g.isOrg ? "rounded-2xl" : "rounded-full"} ${g.ownerUid === m.ownerUid ? "border-crimson" : "border-rule"}`}><Avatar src={g.avatar} alt={g.displayName} size={44} square={!!g.isOrg} /></button>
                  </li>
                ))}
              </ul>
              {nextGroup && onSelectGroup && <p className="mt-1 font-ui text-xs text-slate">Moves on to {nextGroup.displayName} next</p>}
            </div>
          )}
        </aside>
      </div>
      {reporting && <ReportDialog kind="moment" targetId={m.id} onClose={() => setReporting(false)} />}
    </div>
  );
}

// A moment's video on Cloudflare Stream: Stream's player (no controls), started at the part's own start and moved on from at its end,
// from the player's timeupdate messages (as the course player reads them). Taps go to the transparent layer over it, so tapping still
// moves between moments.
function StreamMoment({ id, clipStart, clipEnd, spans, onTime, onProgress, onDone, onError }: { id: string; clipStart: number; clipEnd?: number; spans?: Span[]; onTime?: (t: number) => void; onProgress: (f: number) => void; onDone: () => void; onError: (t: string) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [player, setPlayer] = useState<string | null>(null);
  const cb = useRef({ onProgress, onDone, onTime });
  cb.current = { onProgress, onDone, onTime };
  // Where the video has got to. Stream's player is asked three ways, because any one of them can be silent: its messages, read in
  // every shape (lib/moments-tidy.ts playerNews); its SDK, asked five times a second; and failing both, the clock from when it
  // started (playClock). The SDK also moves the player past the pauses of a trimmed video; without it the video plays its pauses.
  const control = useRef<{ currentTime: number } | null>(null);
  const sought = useRef({ to: -1, at: 0 });
  const clock = useRef(playClock(clipStart));
  const needTime = !!spans?.length || !!onTime;
  useEffect(() => {
    if (!player) return;
    let live = true;
    loadStreamSdk().then((Stream) => { if (live && frame.current) control.current = Stream(frame.current); }).catch(() => {});
    return () => { live = false; control.current = null; };
  }, [player]);
  useEffect(() => {
    let live = true;
    api<{ player: string }>(`/api/moments/${id}`, { body: { action: "play" } }).then((r) => { if (live) setPlayer(r.player); }, () => { if (live) onError("This video couldn't be loaded. Check your connection and try again."); });
    return () => { live = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!player) return;
    const c = clock.current = playClock(clipStart);
    let duration = 0, done = false, lastSdk = -1;
    const finish = () => { if (!done) { done = true; cb.current.onDone(); } };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const news = playerNews(e.data);
      if (news.duration) duration = news.duration;
      if (news.ended) return finish();
      if (news.time !== undefined) c.feed(news.time, Date.now());
    };
    window.addEventListener("message", onMsg);
    const tick = setInterval(() => {
      const now = Date.now();
      // The SDK's own reading, when it has one that has moved.
      try { const t = control.current?.currentTime; if (typeof t === "number" && Number.isFinite(t) && t !== lastSdk) { lastSdk = t; if (t > 0) c.feed(t, now); } } catch { /* the player has gone */ }
      const t = c.at(now);
      cb.current.onTime?.(t);
      if (spans?.length) {
        const all = spanTotal(spans), h = playhead(spans, t);
        if (all > 0) cb.current.onProgress(Math.round(Math.min(1, playedAt(spans, t) / all) * 100) / 100);
        if (h.done) return finish();
        // Ask once for each jump (the player reports the time several times before it has moved).
        if (h.seek !== undefined && control.current && (sought.current.to !== h.seek || now - sought.current.at > 1500)) {
          sought.current = { to: h.seek, at: now };
          try { control.current.currentTime = h.seek; c.jump(h.seek, now); } catch { /* the player has gone */ }
        }
        return;
      }
      const to = clipEnd ?? duration;
      if (to > clipStart) cb.current.onProgress(Math.round(Math.min(1, Math.max(0, (t - clipStart) / (to - clipStart))) * 100) / 100);
      if (clipEnd && t >= clipEnd - 0.05) finish();
    }, 200);
    return () => { window.removeEventListener("message", onMsg); clearInterval(tick); };
  }, [player, clipStart, clipEnd, spans, needTime]);
  if (!player) return <p className="text-sm text-white/70">Loading the video…</p>;
  return (
    <div className="relative h-full w-full">
      <iframe ref={frame} src={`${player}?autoplay=true&controls=false&preload=auto${clipStart ? `&startTime=${Math.floor(clipStart)}s` : ""}`} title="Moment video"
        onLoad={() => setTimeout(() => clock.current.begin(Date.now()), 900)}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" className="absolute inset-0 h-full w-full border-0" />
      <div className="absolute inset-0" aria-hidden />
    </div>
  );
}
