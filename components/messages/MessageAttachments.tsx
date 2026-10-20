"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { formatBytes, type AttachmentInfo } from "@/lib/messages-rules";
import { fileBadge } from "@/lib/chat-tools";
import MediaViewer, { fileQuery, mediaKey, saveFile, type MediaItem } from "./MediaViewer";

type Opened = { url: string };

// The files in one message. Pictures and videos load in the bubble (their link is fetched when the bubble appears, because the files are
// private and links are short-lived) with no name or link on show: tap one to open it full screen in MediaViewer, which has Save and
// swipes through `gallery`, the chat's photos and videos in order.
// Documents show a card (type, name, size) with Open for a PDF and Save for everything.
export default function MessageAttachments({ cid, mid, files, mine, gallery }: { cid: string; mid: string; files: AttachmentInfo[]; mine: boolean; gallery?: MediaItem[] }) {
  return (
    <div className="mb-1 space-y-2">
      {files.map((f, i) => <One key={i} cid={cid} mid={mid} i={i} f={f} mine={mine} gallery={gallery} />)}
    </div>
  );
}

function One({ cid, mid, i, f, mine, gallery }: { cid: string; mid: string; i: number; f: AttachmentInfo; mine: boolean; gallery?: MediaItem[] }) {
  const q = fileQuery(cid, { mid, i });
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [viewing, setViewing] = useState(false);
  const media = f.kind === "image" || f.kind === "video" || f.kind === "audio";
  useEffect(() => {
    if (!media) return;
    let live = true;
    api<Opened>(q).then((r) => { if (live) setUrl(r.url); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [q, media]);

  async function download() {
    try { await saveFile(q); } catch { setFailed(true); }
  }
  async function openIt() {
    try { window.open((await api<Opened>(q)).url, "_blank", "noopener"); } catch { setFailed(true); }
  }
  const sub = `text-[11px] ${mine ? "text-white/80" : "text-slate"}`;
  // This file within the chat's photos and videos (or on its own, if the chat didn't pass the list or it isn't in it yet).
  const items: MediaItem[] = (() => {
    const self: MediaItem = { mid, i, kind: f.kind === "video" ? "video" : "image" };
    return gallery?.some((g) => mediaKey(g) === mediaKey(self)) ? gallery : [self];
  })();
  const viewer = viewing && url && (f.kind === "image" || f.kind === "video") && (
    <MediaViewer cid={cid} items={items} start={items.findIndex((g) => mediaKey(g) === mediaKey({ mid, i }))} firstUrl={url} onClose={() => setViewing(false)} />
  );

  if (f.kind === "image") {
    return url
      ? (
        <div>
          <button type="button" onClick={() => setViewing(true)} aria-label="Open photo" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Photo" className="max-h-64 max-w-full rounded" />
          </button>
          {viewer}
        </div>
      )
      : <p className="text-xs opacity-80">{failed ? "Couldn't load the photo" : "Loading photo…"}</p>;
  }
  if (f.kind === "audio") {
    return url
      ? <div><audio src={url} controls preload="metadata" className="h-10 w-60 max-w-full" />{f.durationSec ? <span className="ml-1 text-[11px] opacity-80">{Math.floor(f.durationSec / 60)}:{String(Math.floor(f.durationSec % 60)).padStart(2, "0")}</span> : null}</div>
      : <p className="text-xs opacity-80">{failed ? "Couldn't load the voice note" : "Loading voice note…"}</p>;
  }
  if (f.kind === "video") {
    return url
      ? (
        <div className="relative inline-block max-w-full">
          <video src={url} controls preload="metadata" playsInline controlsList="nodownload" className="max-h-64 max-w-full rounded bg-black" />
          <button type="button" onClick={() => setViewing(true)} aria-label="Open video full screen" className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          </button>
          {viewer}
        </div>
      )
      : <p className="text-xs opacity-80">{failed ? "Couldn't load the video" : "Loading video…"}</p>;
  }
  const pdf = f.type === "application/pdf";
  const btn = `flex-1 py-2 text-center font-ui text-sm font-semibold ${mine ? "text-white hover:bg-white/10" : "text-crimson hover:bg-crimson/5"}`;
  return (
    <div className={`w-64 max-w-full overflow-hidden rounded-xl border ${mine ? "border-white/30 bg-white/10" : "border-rule bg-card"}`}>
      <div className="flex items-center gap-3 px-3 py-3">
        <span aria-hidden="true" className={`flex h-11 w-9 shrink-0 items-end justify-center rounded-md pb-1 font-mono text-[9px] font-bold ${mine ? "bg-white text-crimson" : "bg-crimson/10 text-crimson"}`}>{fileBadge(f.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-all text-sm font-semibold leading-snug">{f.name}</span>
          <span className={sub}>{fileBadge(f.name)} · {formatBytes(f.size)}{failed ? " · couldn't open it" : ""}</span>
        </span>
      </div>
      <div className={`flex border-t ${mine ? "divide-x divide-white/30 border-white/30" : "divide-x divide-rule border-rule"}`}>
        {pdf && <button type="button" onClick={openIt} className={btn}>Open</button>}
        <button type="button" onClick={download} className={btn} aria-label={`Save ${f.name}`}>Save</button>
      </div>
    </div>
  );
}
