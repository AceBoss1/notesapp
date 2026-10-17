"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { formatBytes, type AttachmentInfo } from "@/lib/messages-rules";
import { fileBadge } from "@/lib/chat-tools";

type Opened = { url: string };

// The files in one message. Pictures and videos load in the bubble (their link is fetched when the bubble appears, because the files are
// private and links are short-lived), with the name, size and Save under them; documents show a card (type, name, size) with Open for a
// PDF and Save for everything.
export default function MessageAttachments({ cid, mid, files, mine }: { cid: string; mid: string; files: AttachmentInfo[]; mine: boolean }) {
  return (
    <div className="mb-1 space-y-2">
      {files.map((f, i) => <One key={i} cid={cid} mid={mid} i={i} f={f} mine={mine} />)}
    </div>
  );
}

function One({ cid, mid, i, f, mine }: { cid: string; mid: string; i: number; f: AttachmentInfo; mine: boolean }) {
  const q = `/api/messages/file?cid=${encodeURIComponent(cid)}&mid=${encodeURIComponent(mid)}&i=${i}`;
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const media = f.kind === "image" || f.kind === "video" || f.kind === "audio";
  useEffect(() => {
    if (!media) return;
    let live = true;
    api<Opened>(q).then((r) => { if (live) setUrl(r.url); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [q, media]);

  async function download() {
    try { window.open((await api<Opened>(`${q}&download=1`)).url, "_blank", "noopener"); } catch { setFailed(true); }
  }
  async function openIt() {
    try { window.open((await api<Opened>(q)).url, "_blank", "noopener"); } catch { setFailed(true); }
  }
  const sub = `text-[11px] ${mine ? "text-white/80" : "text-slate"}`;
  const saveRow = <p className={`mt-1 flex items-center gap-2 ${sub}`}><span className="min-w-0 truncate">{f.name} · {formatBytes(f.size)}</span><button type="button" onClick={download} className="shrink-0 font-semibold underline">Save</button></p>;

  if (f.kind === "image") {
    return url
      // eslint-disable-next-line @next/next/no-img-element
      ? <div><a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={f.name} className="max-h-64 max-w-full rounded" /></a>{saveRow}</div>
      : <p className="text-xs opacity-80">{failed ? `Couldn't load ${f.name}` : "Loading picture…"}</p>;
  }
  if (f.kind === "audio") {
    return url
      ? <div><audio src={url} controls preload="metadata" className="h-10 w-60 max-w-full" />{f.durationSec ? <span className="ml-1 text-[11px] opacity-80">{Math.floor(f.durationSec / 60)}:{String(Math.floor(f.durationSec % 60)).padStart(2, "0")}</span> : null}</div>
      : <p className="text-xs opacity-80">{failed ? `Couldn't load ${f.name}` : "Loading voice note…"}</p>;
  }
  if (f.kind === "video") {
    return url
      ? <div><video src={url} controls preload="metadata" playsInline className="max-h-64 max-w-full rounded bg-black" />{saveRow}</div>
      : <p className="text-xs opacity-80">{failed ? `Couldn't load ${f.name}` : "Loading video…"}</p>;
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
