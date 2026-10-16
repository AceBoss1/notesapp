"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { LinkPreviewData } from "@/app/api/link-preview/route";

// The card under a chat message that has a web address in it: the page's picture, title, description and site, from
// /api/link-preview. Nothing shows when the page has nothing to show (or can't be reached).
const seen = new Map<string, LinkPreviewData | null>();

export default function LinkPreview({ url, user, mine = false }: { url: string; user: User | null; mine?: boolean }) {
  const [p, setP] = useState<LinkPreviewData | null | undefined>(seen.get(url));
  useEffect(() => {
    if (seen.has(url) || !user) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        const j = r.ok ? ((await r.json()) as { preview: LinkPreviewData | null }) : { preview: null };
        seen.set(url, j.preview); if (alive) setP(j.preview);
      } catch { if (alive) setP(null); }
    })();
    return () => { alive = false; };
  }, [url, user]);
  if (!p) return null;
  return (
    <a href={p.url} target="_blank" rel="noopener noreferrer nofollow ugc" className={`mt-2 block overflow-hidden rounded-lg border text-left no-underline ${mine ? "border-white/30 bg-white/10 text-white" : "border-rule bg-paper text-ink"}`}>
      {p.image && <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-32 w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
      <span className="block px-3 py-2">
        <span className={`block text-[11px] uppercase tracking-wide ${mine ? "text-white/75" : "text-slate"}`}>{p.site}</span>
        <span className="block font-bold leading-snug line-clamp-2">{p.title}</span>
        {p.description && <span className={`mt-0.5 block text-xs line-clamp-2 ${mine ? "text-white/85" : "text-slate"}`}>{p.description}</span>}
      </span>
    </a>
  );
}
