"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mediaApi } from "@/lib/media-client";
import { compact } from "@/lib/media-rules";
import type { MySounds } from "@/lib/sounds-server";
import { SOUND_SOURCES, SOUND_SOURCE_LABEL, emptyPlays } from "@/lib/songs";

// The Sounds part of /profile/analytics: for an artist, this month's plays of their songs and where; the rest is on /profile/sounds.
export default function SoundsSummary() {
  const [d, setD] = useState<MySounds | null>(null);
  useEffect(() => { mediaApi<MySounds>("/api/sounds/mine", { signedIn: true }).then(setD, () => setD(null)); }, []);
  if (!d || !d.songs.length) return null;
  const p = emptyPlays();
  for (const s of d.songs) { for (const k of SOUND_SOURCES) p[k] += s.thisMonth[k]; p.total += s.thisMonth.total; }
  const top = [...d.songs].sort((a, b) => b.thisMonth.total - a.thisMonth.total)[0];
  return (
    <div className="mt-6 rounded-[22px] border border-rule bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl text-ink">🎵 Your sounds this month</h2>
        <Link href="/profile/sounds" className="font-ui text-sm font-semibold text-crimson">Plays, royalties and songs →</Link>
      </div>
      <p className="mt-1 text-sm text-slate"><b className="text-ink">{compact(p.total)}</b> plays of your {d.songs.length} song{d.songs.length === 1 ? "" : "s"}{top && top.thisMonth.total ? `; most played: ${top.title} (${compact(top.thisMonth.total)})` : ""}.</p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SOUND_SOURCES.map((s) => <li key={s} className="rounded-2xl bg-field px-3 py-2"><b className="block font-ui text-ink">{compact(p[s])}</b><span className="text-xs text-slate">{SOUND_SOURCE_LABEL[s]}</span></li>)}
      </ul>
    </div>
  );
}
