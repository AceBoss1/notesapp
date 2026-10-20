"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

// A picture or video from a chat, full screen inside #NotesApp, like WhatsApp: the file's private link never shows, and Save
// downloads it in place (the link it uses is short-lived and sent as an attachment, so the page doesn't change).
export default function MediaViewer({ kind, url, onSave, onClose }: { kind: "image" | "video"; url: string; onSave: () => void; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }, [onClose]);
  const btn = "flex h-10 items-center justify-center rounded-full px-3 text-sm font-semibold hover:bg-white/10";

  // On document.body, so it sits above the masthead and the chat's own header.
  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col bg-[#0b0b0b] text-white" role="dialog" aria-modal="true" aria-label={kind === "image" ? "Photo" : "Video"} onClick={onClose}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 flex-1 font-ui text-sm font-bold">{kind === "image" ? "Photo" : "Video"}</p>
        <button type="button" onClick={onSave} className={btn}>Save</button>
        <button type="button" onClick={onClose} aria-label="Close" className={`${btn} w-10 px-0 text-2xl leading-none`}>×</button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Photo" className="max-h-full max-w-full select-none rounded-lg object-contain" draggable={false} onClick={(e) => e.stopPropagation()} />
        ) : (
          <video src={url} controls autoPlay playsInline controlsList="nodownload" className="max-h-full max-w-full rounded-lg bg-black" onClick={(e) => e.stopPropagation()} />
        )}
      </div>
    </div>,
    document.body,
  );
}
