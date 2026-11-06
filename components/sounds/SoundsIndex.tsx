"use client";

import Link from "next/link";
import { useSongs } from "@/lib/sounds-client";
import { soundPath } from "@/lib/songs";
import { Pattern } from "@/components/media/MediaTile";

// /sounds: every NotesApp Sounds song, each opening its own page, and the way in for artists.
export default function SoundsIndex() {
  const songs = useSongs();
  return (
    <div>
      <p className="font-ui text-xs font-bold uppercase tracking-[0.18em] text-crimson">NotesApp Sounds</p>
      <h1 className="mt-1 font-display text-4xl text-ink">Songs for your posts, moments and lives</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">Pick one under Sound when you post to Media or share a moment, or play one in your live. Tap a song to hear it and see what people made with it.</p>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {songs.map((s) => (
          <Link key={s.id} href={soundPath(s.id)} className="group block">
            <span className="relative block aspect-square overflow-hidden rounded-[18px] bg-[#1a0b10] shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.cover ? <img src={s.cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" /> : <Pattern />}
            </span>
            <b className="mt-2 block truncate font-ui text-sm text-ink group-hover:text-crimson">{s.title}</b>
            <span className="block truncate text-xs text-slate">{s.artist}</span>
          </Link>
        ))}
      </div>
      <div className="mt-10 rounded-[22px] border border-rule bg-card p-6">
        <h2 className="font-display text-2xl text-ink">🎤 Are you an artist?</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate">Get verified to add your own songs. Once the team checks a song, creators can use it on their posts, moments and lives, and every play earns you a royalty from #NotesApp&apos;s ad revenue, paid with your ad share. Your analytics show where your songs are played.</p>
        <Link href="/profile/sounds" className="mt-4 inline-block rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-bold text-white">Apply as an artist</Link>
      </div>
    </div>
  );
}
