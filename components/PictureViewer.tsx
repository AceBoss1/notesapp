"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ProfilePicture } from "@/lib/profile-pictures";
import { picturesOf, removeOldPicture } from "@/lib/profile-pictures-client";
import Avatar from "@/components/Avatar";

const when = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : "");

// A member's profile pictures, newest first, like Facebook's: full screen, swipe on a phone, ‹ › (or the arrow keys) on a
// computer, the date and "2 of 5". The owner can take an old picture out of their history.
export default function PictureViewer({ uid, name, current, isOwn = false, onClose }: { uid: string; name: string; current: string; isOwn?: boolean; onClose: () => void }) {
  const [pics, setPics] = useState<ProfilePicture[] | null>(null);
  const [i, setI] = useState(0);
  const [dx, setDx] = useState(0); // how far a finger has dragged the picture
  const [error, setError] = useState("");
  const start = useRef<number | null>(null);
  const moved = useRef(0); // the drag so far, read when the finger lifts (state may not have re-rendered yet)
  useEffect(() => { picturesOf(uid, current).then(setPics); }, [uid, current]);
  const n = pics?.length ?? 0;
  const go = (d: number) => setI((x) => Math.min(Math.max(x + d, 0), Math.max(n - 1, 0)));
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(p: ProfilePicture) {
    setError("");
    try { await removeOldPicture(p.id); setPics((l) => (l ?? []).filter((x) => x.id !== p.id)); setI((x) => Math.max(0, Math.min(x, n - 2))); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't remove it."); }
  }
  const p = pics?.[i];
  const arrow = "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl leading-none text-white backdrop-blur hover:bg-white/25 disabled:opacity-0";

  // On document.body, so it sits above the masthead and banners whatever card it was opened from.
  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col bg-[#0b0b0b] text-white" role="dialog" aria-modal="true" aria-label={`${name}'s profile pictures`}>
      <div className="flex items-center gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <p className="truncate font-ui text-sm font-bold">{name}</p>
          <p className="text-xs text-white/70">{p ? `Profile picture${p.createdAt ? ` · ${when(p.createdAt)}` : ""}` : "Profile pictures"}{n > 1 ? ` · ${i + 1} of ${n}` : ""}</p>
        </div>
        {isOwn && p?.id && p.url !== current && <button type="button" onClick={() => remove(p)} className="rounded-full border border-white/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Remove from history</button>}
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none hover:bg-white/10">×</button>
      </div>
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onTouchStart={(e) => { start.current = e.touches[0].clientX; moved.current = 0; }}
        onTouchMove={(e) => { if (start.current !== null) { moved.current = e.touches[0].clientX - start.current; setDx(moved.current); } }}
        onTouchEnd={() => { if (moved.current < -50) go(1); if (moved.current > 50) go(-1); moved.current = 0; setDx(0); start.current = null; }}
      >
        {pics === null ? <p className="text-sm text-white/70">Loading…</p> : n === 0 ? (
          <Avatar src={current} alt={name} size={240} />
        ) : (
          <div className="flex h-full w-full transition-transform duration-300 ease-out" style={{ transform: `translateX(calc(${-i * 100}% + ${dx}px))`, transitionDuration: dx ? "0ms" : undefined }}>
            {pics.map((q) => (
              <div key={q.id || q.url} className="flex h-full w-full shrink-0 items-center justify-center px-4 pb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.url} alt={`${name}'s profile picture`} className="max-h-full max-w-full select-none rounded-lg object-contain" draggable={false} />
              </div>
            ))}
          </div>
        )}
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Newer picture" className={`${arrow} left-3`}>‹</button>
            <button type="button" onClick={() => go(1)} disabled={i === n - 1} aria-label="Older picture" className={`${arrow} right-3`}>›</button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="flex justify-center gap-1.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {pics!.map((q, k) => <button key={q.id || q.url} type="button" onClick={() => setI(k)} aria-label={`Picture ${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-1.5 bg-white/40"}`} />)}
        </div>
      )}
      {error && <p role="alert" className="pb-4 text-center text-sm text-red-300">{error}</p>}
    </div>,
    document.body,
  );
}
