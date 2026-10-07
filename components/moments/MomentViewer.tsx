"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/moments-client";
import { timeLeftLabel } from "@/lib/moments-rules";
import type { MomentView } from "@/lib/moments-server";

const STILL_MS = 6000; // how long an image or text moment stays before the next one

// Full-screen viewer for one member's moments. Everything here disappears when its time is up; a reply goes to the
// owner's inbox and stays there, with a note that the moment has expired once it has.
export default function MomentViewer({ moments, onClose, onChanged }: { moments: MomentView[]; onClose: () => void; onChanged?: () => void }) {
  const [i, setI] = useState(0);
  const [items, setItems] = useState(moments);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const m = items[i];

  const next = () => (i + 1 < items.length ? setI(i + 1) : onClose());
  // Stills advance by themselves; a video advances when it ends.
  useEffect(() => {
    if (!m) return;
    api(`/api/moments/${m.id}`, { body: { action: "view" } }).catch(() => {});
    if (m.kind !== "video") {
      timer.current = setTimeout(next, STILL_MS);
      return () => clearTimeout(timer.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, m?.id]);

  if (!m) return null;
  const pause = () => timer.current && clearTimeout(timer.current);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setNote(null); pause();
    try { await fn(); } catch (e) { setNote(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90" role="dialog" aria-modal="true" aria-label={`Moments from @${m.ownerUsername}`}>
      <div className="relative flex h-full w-full max-w-md flex-col bg-ink text-white sm:h-[90vh] sm:rounded-xl">
        <div className="flex gap-1 p-2" aria-hidden>
          {items.map((x, k) => <span key={x.id} className={`h-1 flex-1 rounded ${k < i ? "bg-white" : k === i ? "bg-white/90" : "bg-white/30"}`} />)}
        </div>
        <div className="flex items-center justify-between px-3 pb-2 text-sm">
          <Link href={`/u/${m.ownerUsername}`} className="font-bold hover:underline">@{m.ownerUsername}</Link>
          <span className="text-white/70">
            {m.resharedFrom ? `reshared from @${m.resharedFrom.ownerUsername} · ` : ""}{timeLeftLabel(m.expiresAt)}
          </span>
          <button onClick={onClose} aria-label="Close" className="px-2 text-2xl leading-none">×</button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black" onClick={next}>
          {m.kind === "image" && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.imageUrl} alt="" className="max-h-full max-w-full object-contain" />}
          {m.kind === "video" && <video src={m.videoUrl} autoPlay playsInline controls={false} onEnded={next} className="max-h-full max-w-full" />}
          {m.kind === "text" && <p className="px-8 text-center font-display text-3xl leading-snug">{m.text}</p>}
          {m.kind !== "text" && m.text && <p className="absolute inset-x-0 bottom-0 bg-black/60 p-3 text-center text-sm">{m.text}</p>}
        </div>

        <div className="space-y-2 p-3">
          {note && <p className="text-xs text-amber-300" role="status">{note}</p>}
          {m.mine ? (
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>♥ {m.likeCount} · ↻ {m.reshareCount}</span>
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
    </div>
  );
}
