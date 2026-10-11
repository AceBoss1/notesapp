"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/moments-client";
import { timeLeftLabel } from "@/lib/moments-rules";
import type { MomentGroup, MomentView } from "@/lib/moments-server";
import Avatar from "@/components/Avatar";
import { getUserByUsername } from "@/lib/users";
import FollowButton from "@/components/FollowButton";
import MessageButton from "@/components/messages/MessageButton";
import ReportDialog from "./ReportDialog";

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
  const videoEl = useRef<HTMLVideoElement>(null);
  const viewed = useRef(new Set<string>()); // a moment is counted as seen once per time the viewer is open, however often this re-renders
  const advances = useRef<number[]>([]); // when we last moved on: a runaway loop closes the viewer instead of hammering the device
  const advanced = useRef<string | null>(null); // the video moment already moved on from (timeupdate fires several times near the end)
  const m = items[i];
  const gi = groups && m ? groups.findIndex((g) => g.ownerUid === m.ownerUid) : -1;
  const nextGroup = groups && gi >= 0 ? groups[gi + 1] : undefined;
  const prevGroup = groups && gi > 0 ? groups[gi - 1] : undefined;

  useEffect(() => { setShowViewers(false); setPaused(false); setFrac(0); }, [i]);
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
  const stillMs = m ? Math.max(STILL_MS, ((m.audioDurationSec ?? 0) + 1) * 1000) : STILL_MS;
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
  const react = (emoji: string) => act(async () => {
    if (!m.liked) {
      const r = await api<{ liked: boolean; likeCount: number }>(`/api/moments/${m.id}`, { body: { action: "like" } });
      setItems(items.map((x) => (x.id === m.id ? { ...x, liked: r.liked, likeCount: r.likeCount } : x)));
    }
    await api(`/api/moments/${m.id}`, { body: { action: "reply", text: emoji } });
    setNote(`Sent ${emoji} to @${m.ownerUsername}.`);
  });
  const card = "rounded-2xl border border-white/10 bg-white/5 p-5";
  const length = m.kind === "video" ? (m.clipEnd != null ? m.clipEnd - (m.clipStart ?? 0) : m.durationSec) : undefined;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#12060a]" role="dialog" aria-modal="true" aria-label={`Moments from @${m.ownerUsername}`}>
      {/* Left (wide screens): who else has moments up, and a short note on how they work. */}
      {groups && groups.length > 0 && (
        <aside className="mr-6 hidden h-[88vh] w-72 shrink-0 flex-col gap-4 text-white xl:flex">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-pink-300">Moments · from people you follow</p>
          <ul className="flex-1 space-y-2 overflow-y-auto">
            {groups.map((g) => (
              <li key={g.ownerUid}>
                <button type="button" onClick={() => (g.ownerUid === m.ownerUid ? undefined : onSelectGroup?.(g))} aria-current={g.ownerUid === m.ownerUid}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left ${g.ownerUid === m.ownerUid ? "border-pink-400/50 bg-white/10" : "border-transparent hover:bg-white/5"}`}>
                  <span className={`block bg-gradient-to-tr from-crimson via-crimson-bright to-amber-400 p-[2px] ${g.isOrg ? "rounded-2xl" : "rounded-full"}`}><span className={`block bg-[#12060a] p-[2px] ${g.isOrg ? "rounded-2xl" : "rounded-full"}`}><Avatar src={g.avatar} alt="" size={40} square={!!g.isOrg} /></span></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-bold">{g.displayName}</span><span className="block text-xs text-white/60">{g.moments.length} moment{g.moments.length === 1 ? "" : "s"} · {timeLeftLabel(g.moments[g.moments.length - 1].expiresAt)}</span></span>
                </button>
              </li>
            ))}
          </ul>
          {m.mine && items.length > 1 && (
            <div className={card}>
              <p className="font-mono text-[11px] uppercase tracking-eyebrow text-pink-300">Your moments</p>
              <ul className="mt-3 space-y-1.5">
                {items.map((x, k) => (
                  <li key={x.id}><button type="button" onClick={() => setI(k)} aria-current={k === i} className={`flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm ${k === i ? "bg-white/15" : "hover:bg-white/5"}`}><span>{k + 1}. {x.kind === "video" ? "Video" : x.kind === "image" ? "Picture" : "Text"}</span><span className="text-xs text-white/60">{timeLeftLabel(x.expiresAt)}</span></button></li>
                ))}
              </ul>
            </div>
          )}
          <div className={card}>
            <p className="font-mono text-[11px] uppercase tracking-eyebrow text-pink-300">How moments work</p>
            <p className="mt-2 text-xs text-white/70">A picture, a short video or text that stays on a profile for 24, 48 or 72 hours. Only the publisher sees who watched.</p>
          </div>
        </aside>
      )}
      {prevGroup && onSelectGroup && <button type="button" onClick={() => onSelectGroup(prevGroup)} aria-label={`Previous: ${prevGroup.displayName}`} className="mr-3 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl text-white/70 hover:bg-white/10 lg:flex">‹</button>}
      <div className="relative flex h-full w-full max-w-md flex-col bg-ink text-white sm:h-[90vh] sm:rounded-xl lg:h-[88vh] lg:max-w-[24rem] overflow-hidden">
        <div className="relative z-10 bg-gradient-to-b from-black/75 via-black/30 to-transparent pb-6">
        <div className="flex gap-1 p-2 pt-3" aria-hidden>
          {/* One bar per moment: the maroon part is what has played, the rest is still to come. */}
          {items.map((x, k) => (
            <span key={x.id} className="h-1.5 flex-1 overflow-hidden rounded bg-white/70">
              <span className="block h-full bg-crimson transition-[width] duration-300 ease-linear" style={{ width: `${k < i ? 100 : k === i ? Math.round(frac * 100) : 0}%` }} />
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between px-3 pb-2 text-sm">
          <Link href={`/u/${m.ownerUsername}`} className="flex items-center gap-2 font-bold hover:underline">{owner?.avatar ? <Avatar src={owner.avatar} alt="" size={32} square={!!owner.isOrg} /> : null}@{m.ownerUsername}</Link>
          <span className="text-white/70">
            {m.resharedFrom ? `reshared from @${m.resharedFrom.ownerUsername} · ` : ""}{timeLeftLabel(m.expiresAt)}
          </span>
          <button onClick={onClose} aria-label="Close" className="px-2 text-2xl leading-none">×</button>
        </div>
        </div>

        {/* The picture or video is told its size (the whole stage) and letterboxed inside it, so a wide or very large file, such as a
            side-by-side TikTok duet, can never spill past the edges of the window. */}
        <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden bg-black" onClick={tap}>
          {m.kind === "image" && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.imageUrl} alt="" className="h-full w-full object-contain" />}
          {m.kind === "video" && (
            // A part of a longer video plays only its own stretch of the file: it starts at clipStart and moves on at clipEnd.
            <video
              key={m.videoUrl} ref={videoEl} src={m.videoUrl} autoPlay playsInline controls={false} className="h-full w-full object-contain"
              onLoadedMetadata={(e) => { if (m.clipStart) e.currentTarget.currentTime = m.clipStart; }}
              onTimeUpdate={(e) => {
                const v = e.currentTarget, from = m.clipStart ?? 0, to = m.clipEnd ?? v.duration;
                if (to > from && Number.isFinite(to)) { const f = Math.round(Math.min(1, Math.max(0, (v.currentTime - from) / (to - from))) * 100) / 100; setFrac((p) => (p === f ? p : f)); }
                if (m.clipEnd && e.currentTarget.currentTime >= m.clipEnd - 0.05 && advanced.current !== m.id) { advanced.current = m.id; next(); }
              }}
              onError={() => setNote("This video couldn't be loaded. Check your connection and try again.")}
              onEnded={() => { if (advanced.current !== m.id) { advanced.current = m.id; next(); } }}
            />
          )}
          {m.kind === "text" && <p className="px-8 text-center font-display text-3xl leading-snug">{m.text}</p>}
          {m.audioUrl && <audio key={m.id} src={m.audioUrl} autoPlay />}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-3 pt-20">
          {m.kind !== "text" && m.text && <p className="text-center text-sm drop-shadow">{m.text}</p>}
          {note && <p className="text-xs text-amber-300" role="status">{note}</p>}
          {m.mine && showViewers && (
            <div className="max-h-44 overflow-y-auto rounded-2xl border border-white/20 bg-black/60 p-3 text-sm backdrop-blur lg:hidden" role="region" aria-label="Who watched">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-eyebrow text-pink-300">Who watched</p>
              {viewers === null ? "Loading…" : viewers.length === 0 ? "No one has seen it yet." : viewers.map((v) => <p key={v.uid} className="py-0.5">{v.displayName} <span className="text-white/60">@{v.username}</span></p>)}
            </div>
          )}
          {m.mine ? (
            <div className="flex items-center justify-between gap-3 text-sm text-white/90 lg:hidden">
              <button type="button" onClick={() => { pause(); setShowViewers((v) => !v); }} aria-expanded={showViewers} className="rounded-full bg-white/15 px-4 py-2 font-semibold backdrop-blur">👁 {m.viewCount ?? 0} · ♥ {m.likeCount} · 🔁 {m.reshareCount} {showViewers ? "▾" : "▴"}</button>
              <button disabled={busy} onClick={removeMoment} className="rounded-full border border-white/40 px-4 py-2 hover:bg-white/10">Delete</button>
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Quick reactions">
                {REACTIONS.map((e) => <button key={e} type="button" disabled={busy} onClick={() => react(e)} aria-label={`React with ${e}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg backdrop-blur">{e}</button>)}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => act(async () => {
                    const r = await api<{ liked: boolean; likeCount: number }>(`/api/moments/${m.id}`, { body: { action: "like" } });
                    setItems(items.map((x) => (x.id === m.id ? { ...x, liked: r.liked, likeCount: r.likeCount } : x)));
                  })}
                  className="rounded-full border border-white/40 px-4 py-1.5 text-sm backdrop-blur hover:bg-white/10"
                  aria-pressed={m.liked}
                >{m.liked ? "♥ Liked" : "♡ Like"}</button>
                <button
                  disabled={busy}
                  onClick={() => act(async () => { await api(`/api/moments/${m.id}`, { body: { action: "reshare" } }); setNote("Reshared to your moments."); onChanged?.(); })}
                  className="rounded-full border border-white/40 px-4 py-1.5 text-sm backdrop-blur hover:bg-white/10"
                >🔁 Reshare</button>
                <button disabled={busy} onClick={() => { pause(); setReporting(true); }} className="ml-auto rounded-full border border-white/40 px-4 py-1.5 text-sm backdrop-blur hover:bg-white/10">Report</button>
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => { e.preventDefault(); act(async () => { await api(`/api/moments/${m.id}`, { body: { action: "reply", text: reply } }); setReply(""); setNote("Sent to their inbox."); }); }}
              >
                <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`💬 Reply to @${m.ownerUsername}`} maxLength={2000} className="min-w-0 flex-1 rounded-full border border-white/40 bg-black/30 px-4 py-2 text-sm placeholder:text-white/50" />
                <button disabled={busy || !reply.trim()} className="rounded-full bg-crimson px-5 py-2 text-sm font-bold disabled:opacity-50">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
      {nextGroup && onSelectGroup && <button type="button" onClick={() => onSelectGroup(nextGroup)} aria-label={`Next: ${nextGroup.displayName}`} className="ml-3 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl text-white/70 hover:bg-white/10 lg:flex">›</button>}
      {/* Right (wide screens): who this is, quick reactions and details about this moment. */}
      <aside className="ml-6 hidden h-[88vh] w-72 shrink-0 flex-col gap-4 overflow-y-auto text-white lg:flex">
        <div className={card}>
          <div className="flex items-center gap-3">
            <Avatar src={owner?.avatar ?? ""} alt="" size={48} square={!!owner?.isOrg} />
            <div className="min-w-0"><p className="truncate font-bold">{owner?.displayName ?? `@${m.ownerUsername}`}</p><p className="truncate text-xs text-white/60">@{m.ownerUsername}</p></div>
          </div>
          {!m.mine && (
            <>
              <div className="mt-4 flex flex-wrap gap-2 [&_.btn-ghost]:!border-white/40 [&_.btn-ghost]:!bg-transparent [&_.btn-ghost]:!text-white [&_.btn-ghost:hover]:!bg-white/10"><FollowButton username={m.ownerUsername} /><MessageButton username={m.ownerUsername} profileUid={m.ownerUid} /></div>
              <p className="mt-3 text-xs text-white/60">Your reply goes straight to @{m.ownerUsername}&apos;s inbox as a private message. Only they can see it.</p>
            </>
          )}
        </div>
        {!m.mine && (
          <div className={card}>
            <p className="font-mono text-[11px] uppercase tracking-eyebrow text-pink-300">Quick reactions</p>
            <div className="mt-3 flex gap-2">
              {REACTIONS.map((e) => <button key={e} type="button" disabled={busy} onClick={() => react(e)} aria-label={`React with ${e}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg hover:bg-white/20 disabled:opacity-50">{e}</button>)}
            </div>
            <p className="mt-3 text-xs text-white/60">Sends a like with the emoji. One tap, no typing.</p>
          </div>
        )}
        {m.mine && (
          <>
            <div className={card}>
              <p className="font-mono text-[11px] uppercase tracking-eyebrow text-pink-300">Your moment</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[["👁", m.viewCount ?? 0, "Views"], ["♥", m.likeCount, "Likes"], ["🔁", m.reshareCount, "Reshares"]].map(([ic, n, l]) => (
                  <div key={String(l)} className="rounded-xl bg-white/10 py-3"><p className="font-display text-2xl">{n}</p><p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/60">{ic} {l}</p></div>
                ))}
              </div>
              <button disabled={busy} onClick={removeMoment} className="mt-4 w-full rounded-full border border-white/40 py-2 text-sm hover:bg-white/10">Delete this moment</button>
            </div>
            <div className={`${card} min-h-0 flex-1 overflow-y-auto`}>
              <p className="font-mono text-[11px] uppercase tracking-eyebrow text-pink-300">Who watched</p>
              <ul className="mt-3 space-y-2 text-sm">
                {viewers === null ? <li className="text-white/60">Loading…</li> : viewers.length === 0 ? <li className="text-white/60">No one has seen it yet.</li> : viewers.map((v) => <li key={v.uid}>{v.displayName} <span className="text-white/60">@{v.username}</span></li>)}
              </ul>
              <p className="mt-3 text-xs text-white/50">Only you can see this list.</p>
            </div>
          </>
        )}
        <div className={card}>
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-pink-300">This moment</p>
          <p className="mt-2 font-display text-2xl">{m.kind === "video" ? "Video" : m.kind === "image" ? "Picture" : "Text"}{length ? ` · ${Math.floor(length / 60)}:${String(Math.round(length % 60)).padStart(2, "0")}` : ""}</p>
          <p className="mt-2 text-xs text-white/60">Posted {ago(m.createdAt)} ago · lasts {m.hours} hours · {timeLeftLabel(m.expiresAt)}</p>
        </div>
        {nextGroup && onSelectGroup && <p className="text-center text-xs text-white/50">Moves on to {nextGroup.displayName} next</p>}
      </aside>
      {reporting && <ReportDialog kind="moment" targetId={m.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
