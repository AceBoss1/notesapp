"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { formatBytes, type AttachmentInfo } from "@/lib/messages-rules";

type Opened = { url: string };

// The files in one message. Pictures and videos load in the bubble (their link is fetched when the bubble appears, because the files are
// private and links are short-lived); documents show a card and download on tap.
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
  const media = f.kind === "image" || f.kind === "video";
  useEffect(() => {
    if (!media) return;
    let live = true;
    api<Opened>(q).then((r) => { if (live) setUrl(r.url); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [q, media]);

  async function download() {
    try { window.open((await api<Opened>(`${q}&download=1`)).url, "_blank", "noopener"); } catch { setFailed(true); }
  }

  if (f.kind === "image") {
    return url
      // eslint-disable-next-line @next/next/no-img-element
      ? <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={f.name} className="max-h-64 max-w-full rounded" /></a>
      : <p className="text-xs opacity-80">{failed ? `Couldn't load ${f.name}` : "Loading picture…"}</p>;
  }
  if (f.kind === "video") {
    return url
      ? <video src={url} controls preload="metadata" playsInline className="max-h-64 max-w-full rounded bg-black" />
      : <p className="text-xs opacity-80">{failed ? `Couldn't load ${f.name}` : "Loading video…"}</p>;
  }
  return (
    <button type="button" onClick={download} className={`flex w-full items-center gap-2 rounded border px-3 py-2 text-left ${mine ? "border-white/40" : "border-rule"}`}>
      <span aria-hidden>📄</span>
      <span className="min-w-0 flex-1"><span className="block truncate font-bold">{f.name}</span><span className="text-xs opacity-80">{formatBytes(f.size)}{failed ? " · couldn't open it" : " · tap to download"}</span></span>
    </button>
  );
}
