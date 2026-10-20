"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/moments-client";

// One photo or video in a chat: which message and which of its files.
export type MediaItem = { mid: string; i: number; kind: "image" | "video" };
export const mediaKey = (it: Pick<MediaItem, "mid" | "i">) => `${it.mid}/${it.i}`;
export const fileQuery = (cid: string, it: Pick<MediaItem, "mid" | "i">) => `/api/messages/file?cid=${encodeURIComponent(cid)}&mid=${encodeURIComponent(it.mid)}&i=${it.i}`;

// Saves a chat file where you are: the download link is short-lived and sent as an attachment, so following it downloads the
// file and the page stays put, with no new tab showing the link.
export async function saveFile(q: string) {
  const a = document.createElement("a");
  a.href = (await api<{ url: string }>(`${q}&download=1`)).url;
  a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
}

// The chat's photos and videos, full screen inside #NotesApp, like WhatsApp: swipe on a phone, ‹ › or the arrow keys on a
// computer, "2 of 7". Each file's private link is fetched only when it is on screen or next to it, and never shows.
export default function MediaViewer({ cid, items, start, firstUrl, onClose }: { cid: string; items: MediaItem[]; start: number; firstUrl: string; onClose: () => void }) {
  const [idx, setIdx] = useState(start);
  const [urls, setUrls] = useState<Record<string, string>>(() => ({ [mediaKey(items[start])]: firstUrl }));
  const [failed, setFailed] = useState(false);
  const [dx, setDx] = useState(0); // how far a finger has dragged the strip
  const touchX = useRef<number | null>(null);
  const moved = useRef(0); // the drag so far, read when the finger lifts (state may not have re-rendered yet)
  const n = items.length;
  const go = (d: number) => setIdx((x) => Math.min(Math.max(x + d, 0), n - 1));
  const cur = items[idx];

  // Load this one and its neighbours, once each.
  useEffect(() => {
    let live = true;
    for (const k of [idx, idx + 1, idx - 1]) {
      const it = items[k];
      if (!it || urls[mediaKey(it)]) continue;
      api<{ url: string }>(fileQuery(cid, it)).then((r) => { if (live) setUrls((u) => ({ ...u, [mediaKey(it)]: r.url })); }).catch(() => {});
    }
    return () => { live = false; };
  }, [idx, items, cid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setFailed(false);
    try { await saveFile(fileQuery(cid, cur)); } catch { setFailed(true); }
  }
  const label = cur.kind === "image" ? "Photo" : "Video";
  const btn = "flex h-10 items-center justify-center rounded-full px-3 text-sm font-semibold hover:bg-white/10";
  const arrow = "absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl leading-none text-white backdrop-blur hover:bg-white/25 disabled:opacity-0 sm:flex";

  // On document.body, so it sits above the masthead and the chat's own header.
  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col bg-[#0b0b0b] text-white" role="dialog" aria-modal="true" aria-label={n > 1 ? `${label}, ${idx + 1} of ${n}` : label}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="min-w-0 flex-1 font-ui text-sm font-bold">{label}{n > 1 && <span className="ml-2 font-normal text-white/70">{idx + 1} of {n}</span>}</p>
        <button type="button" onClick={save} className={btn}>Save</button>
        <button type="button" onClick={onClose} aria-label="Close" className={`${btn} w-10 px-0 text-2xl leading-none`}>×</button>
      </div>
      <div
        className="relative flex-1 overflow-hidden"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; moved.current = 0; }}
        onTouchMove={(e) => { if (touchX.current !== null) { moved.current = e.touches[0].clientX - touchX.current; setDx(moved.current); } }}
        onTouchEnd={() => { if (moved.current < -50) go(1); if (moved.current > 50) go(-1); moved.current = 0; setDx(0); touchX.current = null; }}
      >
        <div className="flex h-full w-full transition-transform duration-300 ease-out" style={{ transform: `translateX(calc(${-idx * 100}% + ${dx}px))`, transitionDuration: dx ? "0ms" : undefined }}>
          {items.map((it, k) => {
            const url = urls[mediaKey(it)];
            const near = Math.abs(k - idx) <= 1;
            return (
              <div key={mediaKey(it)} className="flex h-full w-full shrink-0 items-center justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {!near ? null : !url ? <p className="text-sm text-white/70">Loading…</p> : it.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="Photo" className="max-h-full max-w-full select-none rounded-lg object-contain" draggable={false} />
                ) : k === idx ? (
                  // Only the video on screen is mounted, so one beside it never plays in the background.
                  <video src={url} controls autoPlay playsInline controlsList="nodownload" className="max-h-full max-w-full rounded-lg bg-black" />
                ) : <p className="text-sm text-white/70">Video</p>}
              </div>
            );
          })}
        </div>
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous" className={`${arrow} left-3`}>‹</button>
            <button type="button" onClick={() => go(1)} disabled={idx === n - 1} aria-label="Next" className={`${arrow} right-3`}>›</button>
          </>
        )}
      </div>
      {failed && <p role="alert" className="pb-4 text-center text-sm text-red-300">Couldn&apos;t save it. Try again.</p>}
    </div>,
    document.body,
  );
}
