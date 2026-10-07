"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/moments-client";
import { timeLeftLabel } from "@/lib/moments-rules";
import type { MomentView } from "@/lib/moments-server";
import ReportDialog from "./ReportDialog";

const STILL_MS = 6000; // how long an image or text moment stays before the next one

// Full-screen viewer for one member's moments. Everything here disappears when its time is up; a reply goes to the
// owner's inbox and stays there, with a note that the moment has expired once it has.
export default function MomentViewer({ moments, onClose, onChanged }: { moments: MomentView[]; onClose: () => void; onChanged?: () => void }) {
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
  const advanced = useRef<string | null>(null); // the video moment already moved on from (timeupdate fires several times near the end)
  const m = items[i];

  useEffect(() => { setShowViewers(false); setPaused(false); setFrac(0); }, [i]);
  const next = () => (i + 1 < items.length ? setI(i + 1) : onClose());
  // Stills advance by themselves; a video advances when it ends.
  useEffect(() => {
    if (!m) return;
    api(`/api/moments/${m.id}`, { body: { action: "view" } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, m?.id]);
  // Pictures and text move on by themselves, long enough for the voice-over to finish if there is one; the bar fills as time passes.
  const stillMs = m ? Math.max(STILL_MS, ((m.audioDurationSec ?? 0) + 1) * 1000) : STILL_MS;
  useEffect(() => {
    if (!m || m.kind === "video" || paused) return;
    const started = Date.now(); // each moment starts its bar from empty (a pause is never resumed, so there is nothing to carry over)
    const t = setInterval(() => {
      const f = Math.min(1, (Date.now() - started) / stillMs);
      setFrac(f);
      if (f >= 1) { clearInterval(t); next(); }
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, m?.id, paused]);

  if (!m) return null;
  const pause = () => setPaused(true);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setNote(null); pause();
    try { await fn(); } catch (e) { setNote(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90" role="dialog" aria-modal="true" aria-label={`Moments from @${m.ownerUsername}`}>
      <div className="relative flex h-full w-full max-w-md flex-col bg-ink text-white sm:h-[90vh] sm:rounded-xl">
        <div className="flex gap-1 p-2" aria-hidden>
          {/* One bar per moment: the maroon part is what has played, the rest is still to come. */}
          {items.map((x, k) => (
            <span key={x.id} className="h-1.5 flex-1 overflow-hidden rounded bg-white/70">
              <span className="block h-full bg-crimson transition-[width] duration-150 ease-linear" style={{ width: `${k < i ? 100 : k === i ? Math.round(frac * 100) : 0}%` }} />
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between px-3 pb-2 text-sm">
          <Link href={`/u/${m.ownerUsername}`} className="font-bold hover:underline">@{m.ownerUsername}</Link>
          <span className="text-white/70">
            {m.resharedFrom ? `reshared from @${m.resharedFrom.ownerUsername} · ` : ""}{timeLeftLabel(m.expiresAt)}
          </span>
          <button onClick={onClose} aria-label="Close" className="px-2 text-2xl leading-none">×</button>
        </div>

        {/* The picture or video is told its size (the whole stage) and letterboxed inside it, so a wide or very large file, such as a
            side-by-side TikTok duet, can never spill past the edges of the window. */}
        <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-black" onClick={next}>
          {m.kind === "image" && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.imageUrl} alt="" className="h-full w-full object-contain" />}
          {m.kind === "video" && (
            // A part of a longer video plays only its own stretch of the file: it starts at clipStart and moves on at clipEnd.
            <video
              key={m.id} src={m.videoUrl} autoPlay playsInline controls={false} className="h-full w-full object-contain"
              onLoadedMetadata={(e) => { if (m.clipStart) e.currentTarget.currentTime = m.clipStart; }}
              onTimeUpdate={(e) => {
                const v = e.currentTarget, from = m.clipStart ?? 0, to = m.clipEnd ?? v.duration;
                if (to > from) setFrac(Math.min(1, Math.max(0, (v.currentTime - from) / (to - from))));
                if (m.clipEnd && e.currentTarget.currentTime >= m.clipEnd - 0.05 && advanced.current !== m.id) { advanced.current = m.id; next(); }
              }}
              onEnded={() => { if (advanced.current !== m.id) { advanced.current = m.id; next(); } }}
            />
          )}
          {m.kind === "text" && <p className="px-8 text-center font-display text-3xl leading-snug">{m.text}</p>}
          {m.audioUrl && <audio key={m.id} src={m.audioUrl} autoPlay />}
          {m.kind !== "text" && m.text && <p className="absolute inset-x-0 bottom-0 bg-black/60 p-3 text-center text-sm">{m.text}</p>}
        </div>

        <div className="space-y-2 p-3">
          {note && <p className="text-xs text-amber-300" role="status">{note}</p>}
          {m.mine && showViewers && (
            <div className="max-h-28 overflow-y-auto rounded border border-white/20 p-2 text-xs">
              {viewers === null ? "Loading…" : viewers.length === 0 ? "No one has seen it yet." : viewers.map((v) => <p key={v.uid}>{v.displayName} <span className="text-white/60">@{v.username}</span></p>)}
            </div>
          )}
          {m.mine ? (
            <div className="flex items-center justify-between text-sm text-white/80">
              <button
                type="button"
                onClick={() => { pause(); setShowViewers((s) => !s); setViewers(null); api<{ viewers: { uid: string; username: string; displayName: string }[] }>(`/api/moments/${m.id}`).then((r) => setViewers(r.viewers)).catch(() => setViewers([])); }}
                className="underline"
              >👁 {m.viewCount ?? 0} · ♥ {m.likeCount} · ↻ {m.reshareCount}</button>
              <button
                disabled={busy}
                onClick={() => act(async () => {
                  await api(`/api/moments/${m.id}`, { method: "DELETE" });
                  const rest = items.filter((x) => x.id !== m.id);
                  onChanged?.();
                  if (!rest.length) return onClose();
                  setItems(rest); setI(Math.min(i, rest.length - 1));
                })}
                className="rounded border border-white/40 px-3 py-1 hover:bg-white/10"
              >Delete</button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => act(async () => {
                    const r = await api<{ liked: boolean; likeCount: number }>(`/api/moments/${m.id}`, { body: { action: "like" } });
                    setItems(items.map((x) => (x.id === m.id ? { ...x, liked: r.liked, likeCount: r.likeCount } : x)));
                  })}
                  className="rounded border border-white/40 px-3 py-1 text-sm hover:bg-white/10"
                  aria-pressed={m.liked}
                >{m.liked ? "♥ Liked" : "♡ Like"}</button>
                <button
                  disabled={busy}
                  onClick={() => act(async () => { await api(`/api/moments/${m.id}`, { body: { action: "reshare" } }); setNote("Reshared to your moments."); onChanged?.(); })}
                  className="rounded border border-white/40 px-3 py-1 text-sm hover:bg-white/10"
                >↻ Reshare</button>
                <button disabled={busy} onClick={() => { pause(); setReporting(true); }} className="ml-auto rounded border border-white/40 px-3 py-1 text-sm hover:bg-white/10">Report</button>
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => { e.preventDefault(); act(async () => { await api(`/api/moments/${m.id}`, { body: { action: "reply", text: reply } }); setReply(""); setNote("Sent to their inbox."); }); }}
              >
                <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to @${m.ownerUsername}`} maxLength={2000} className="min-w-0 flex-1 rounded border border-white/30 bg-transparent px-3 py-2 text-sm placeholder:text-white/50" />
                <button disabled={busy || !reply.trim()} className="rounded bg-crimson px-3 py-2 text-sm font-bold disabled:opacity-50">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
      {reporting && <ReportDialog kind="moment" targetId={m.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
