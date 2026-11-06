"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MEDIA_SOUND } from "@/lib/media-rules";
import { soundPath, songLabel } from "@/lib/songs";
import { useSong, useSongs } from "@/lib/sounds-client";

// The sound on a Media post or a moment: Original sound, or a NotesApp Sounds song (lib/songs.ts: house songs and approved artist songs).
// ▶ plays 15 seconds from the hook. With many songs, a search box and a scrolling list.
export default function SongPicker({ value, onChange, dark }: { value: string; onChange: (id: string) => void; dark?: boolean }) {
  const songs = useSongs();
  const [playing, setPlaying] = useState("");
  const [q, setQ] = useState("");
  const el = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const stop = () => { el.current?.pause(); clearTimeout(timer.current); setPlaying(""); };
  useEffect(() => () => { el.current?.pause(); clearTimeout(timer.current); }, []);

  const preview = (id: string) => {
    if (playing === id) { stop(); return; }
    const s = songs.find((x) => x.id === id); if (!s) return;
    stop();
    const a = el.current ?? new Audio(); el.current = a;
    a.src = s.src; a.currentTime = 0;
    a.onloadedmetadata = () => { a.currentTime = Math.min(s.hook, Math.max(0, (a.duration || s.durationSec) - 15)); };
    void a.play().then(() => { setPlaying(id); timer.current = setTimeout(stop, 15_000); }).catch(() => setPlaying(""));
  };

  const needle = q.trim().toLowerCase();
  const shown = needle ? songs.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(needle)) : songs;
  const sub = dark ? "text-white/60" : "text-slate";
  const row = (on: boolean) => `flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm ${on ? "border-crimson bg-crimson/5" : dark ? "border-white/15" : "border-rule"} ${dark ? "text-white" : "text-ink"}`;
  return (
    <div className="mt-1.5 grid gap-1.5" role="radiogroup" aria-label="Sound">
      <button type="button" role="radio" aria-checked={!value} onClick={() => { stop(); onChange(""); }} className={row(!value)}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${dark ? "bg-white/10" : "bg-field"}`} aria-hidden="true">♫</span>
        <span className="min-w-0 flex-1"><b className="block font-ui">{MEDIA_SOUND}</b><span className={`text-xs ${sub}`}>The sound you recorded, or none</span></span>
      </button>
      {songs.length > 6 && (
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${songs.length} songs in NotesApp Sounds`} aria-label="Search songs"
          className={`rounded-2xl border px-3.5 py-2 text-sm outline-none focus:border-crimson ${dark ? "border-white/15 bg-transparent text-white placeholder:text-white/40" : "border-rule bg-card text-ink"}`} />
      )}
      <div className="grid max-h-72 gap-1.5 overflow-y-auto pr-0.5">
        {shown.map((s) => (
          <div key={s.id} className={row(value === s.id)}>
            <button type="button" role="radio" aria-checked={value === s.id} onClick={() => onChange(s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.cover ? <img src={s.cover} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-field">♫</span>}
              <span className="min-w-0 flex-1"><b className="block truncate font-ui">{s.title}</b><span className={`block truncate text-xs ${sub}`}>{s.artist} · NotesApp Sounds</span></span>
            </button>
            <button type="button" onClick={() => preview(s.id)} aria-label={playing === s.id ? `Stop ${s.title}` : `Listen to ${s.title}`}
              className={`shrink-0 rounded-full px-3 py-1.5 font-ui text-xs font-bold ${playing === s.id ? "bg-crimson text-white" : dark ? "bg-white/15" : "bg-field"}`}>{playing === s.id ? "■ Stop" : "▶ Listen"}</button>
          </div>
        ))}
        {!shown.length && <p className={`px-1 text-xs ${sub}`}>No song matches “{q}”.</p>}
      </div>
    </div>
  );
}

// Plays a post's or a moment's song while it's on screen, from its hook, round and round. Quieter under a video or a voice-over.
export function SongPlayer({ songId, under, paused }: { songId?: string; under?: boolean; paused?: boolean }) {
  const s = useSong(songId);
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const a = ref.current; if (!a || !s) return;
    a.volume = under ? 0.35 : 0.9;
    if (paused) a.pause(); else void a.play().catch(() => {});
  }, [s, under, paused]);
  if (!s) return null;
  return <audio ref={ref} key={s.id} src={s.src} loop preload="auto" onLoadedMetadata={(e) => { e.currentTarget.currentTime = s.hook; if (!paused) void e.currentTarget.play().catch(() => {}); }} />;
}

// The song on a post or a moment, as a chip with its cover: opens the song's page (everything made with it).
export function SongTag({ songId, fallback, className = "", newTab }: { songId?: string; fallback?: string; className?: string; newTab?: boolean }) {
  const s = useSong(songId);
  if (!s) return fallback ? <span className={className}>♫ {fallback}</span> : null;
  return (
    <Link href={soundPath(s.id)} {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-white/15 py-0.5 pl-0.5 pr-2.5 hover:bg-white/25 ${className}`} title="See everything made with this sound">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {s.cover ? <img src={s.cover} alt="" className="h-5 w-5 shrink-0 animate-[spin_6s_linear_infinite] rounded-full object-cover" /> : <span aria-hidden>♫</span>}
      <span className="truncate">{songLabel(s)}</span>
    </Link>
  );
}
