"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMember } from "@/lib/member-client";
import { mediaApi } from "@/lib/media-client";
import { compact } from "@/lib/media-rules";
import type { SongPost } from "@/lib/media-server";
import type { MomentGroup, MomentView } from "@/lib/moments-server";
import type { SoundPageHead } from "@/lib/sounds-server";
import { SOUND_SOURCES, SOUND_SOURCE_LABEL } from "@/lib/songs";
import MediaTile, { Pattern } from "@/components/media/MediaTile";
import MediaViewer from "@/components/media/MediaViewer";
import MomentViewer from "@/components/moments/MomentViewer";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";

type Data = SoundPageHead & { media: SongPost[]; momentGroups: MomentGroup[]; signedIn: boolean };
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// /sounds/<id>: a NotesApp Sounds song (lib/songs.ts). The cover and a player, the artist (their @username, to their profile), how often
// it's been played and where, "Use this sound", then everything made with it that you may see: Moments (a ring per person) and Media
// posts (tap one for the full-screen viewer with reactions, gifts and Report).
export default function SoundPage({ id }: { id: string }) {
  const { user } = useMember();
  const [data, setData] = useState<Data | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<SongPost | null>(null);
  const [moments, setMoments] = useState<MomentView[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);

  const load = () => mediaApi<Data>(`/api/sounds/${encodeURIComponent(id)}`).then(setData, (e) => { setError(e instanceof Error ? e.message : "Couldn't load the sound."); setData(null); });
  // Loaded once sign-in is known (so followers-only posts and moments show to the right people); if that takes long, the public view first.
  useEffect(() => {
    if (user !== undefined) { void load(); return; }
    const t = setTimeout(() => void load(), 2000);
    return () => clearTimeout(t);
  }, [user?.uid, user === undefined, id]); // eslint-disable-line react-hooks/exhaustive-deps
  // The page's own player stops while a post or a moment plays its own sound.
  useEffect(() => { if ((open || moments) && audio.current && !audio.current.paused) audio.current.pause(); }, [open, moments]);

  if (data === undefined) return <p className="py-16 text-center text-sm text-slate">Loading the sound…</p>;
  if (data === null) return <div className="py-16 text-center"><p className="font-display text-2xl text-ink">Sound not found</p><p className="mt-1 text-sm text-slate">{error}</p><Link href="/sounds" className="mt-4 inline-block font-semibold text-crimson">All NotesApp Sounds →</Link></div>;

  const { song, artist, plays } = data;
  const toggle = () => { const a = audio.current; if (!a) return; if (a.paused) void a.play().catch(() => {}); else a.pause(); };
  const people = data.momentGroups;
  const momentCount = people.reduce((n, g) => n + g.moments.length, 0);
  return (
    <div>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <button type="button" onClick={toggle} aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`} className="group relative h-44 w-44 shrink-0 overflow-hidden rounded-[22px] bg-[#1a0b10] shadow-lg sm:h-52 sm:w-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {song.cover ? <img src={song.cover} alt={`${song.title} cover`} className="h-full w-full object-cover" /> : <Pattern />}
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-90 group-hover:bg-black/35">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-2xl text-crimson shadow">{playing ? "❚❚" : "▶"}</span>
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-ui text-xs font-bold uppercase tracking-[0.18em] text-crimson">NotesApp Sounds</p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink sm:text-4xl">{song.title}</h1>
          {artist ? (
            <Link href={`/u/${artist.username}`} className="mt-2 inline-flex items-center gap-2 text-sm text-ink hover:text-crimson">
              <Avatar src={artist.avatar} alt="" size={28} className="!h-7 !w-7 rounded-full" />
              <b>{song.artist}</b><span className="text-slate">@{artist.username}</span><NameBadgeIcons username={artist.username} size={14} />
            </Link>
          ) : <p className="mt-2 text-sm font-bold text-ink">{song.artist}</p>}
          <p className="mt-2 text-sm text-slate">{clock(song.durationSec)} · {compact(plays.total)} play{plays.total === 1 ? "" : "s"} · {compact(data.posts)} post{data.posts === 1 ? "" : "s"} · {compact(data.moments)} moment{data.moments === 1 ? "" : "s"}</p>
          <div className="mt-3 h-1.5 max-w-md overflow-hidden rounded-full bg-rule" aria-hidden="true"><span className="block h-full bg-crimson" style={{ width: `${Math.min(100, (at / Math.max(1, song.durationSec)) * 100)}%` }} /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={toggle} className="rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-bold text-white">{playing ? "❚❚ Pause" : "▶ Play"}</button>
            <Link href={`/profile/media?song=${encodeURIComponent(song.id)}`} className="rounded-full border border-rule px-5 py-2.5 font-ui text-sm font-bold text-ink hover:border-crimson hover:text-crimson">♫ Use this sound</Link>
          </div>
          <audio ref={audio} src={song.src} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)} />
        </div>
      </header>

      <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SOUND_SOURCES.map((s) => <li key={s} className="rounded-2xl border border-rule bg-card px-3 py-2.5"><b className="block font-ui text-lg text-ink">{compact(plays[s])}</b><span className="text-xs text-slate">plays in {SOUND_SOURCE_LABEL[s]}</span></li>)}
      </ul>

      <section className="mt-8" aria-label="Moments with this sound">
        <h2 className="font-display text-2xl text-ink">Moments <span className="text-base text-slate">{momentCount}</span></h2>
        {!data.signedIn ? <p className="mt-2 text-sm text-slate"><Link href={`/login?next=/sounds/${encodeURIComponent(id)}`} className="font-semibold text-crimson">Sign in</Link> to see the moments people made with it.</p>
          : people.length ? (
            <div className="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {people.map((g) => (
                <button key={g.ownerUid} type="button" onClick={() => setMoments(g.moments)} className="w-[78px] shrink-0 text-center">
                  <span className="mx-auto block h-[66px] w-[66px] rounded-full bg-gradient-to-tr from-crimson via-crimson-bright to-amber-400 p-[3px]">
                    <span className="relative block h-full w-full overflow-hidden rounded-full border-2 border-paper bg-[#1a0b10]"><Avatar src={g.avatar} alt="" size={60} className="!h-full !w-full rounded-full" /></span>
                  </span>
                  <span className="mt-1.5 block truncate font-ui text-xs font-bold text-ink">{g.displayName}</span>
                  <span className="block text-[11px] text-slate">{g.moments.length} moment{g.moments.length === 1 ? "" : "s"}</span>
                </button>
              ))}
            </div>
          ) : <p className="mt-2 text-sm text-slate">No moments with it right now. Moments last 24 to 72 hours.</p>}
      </section>

      <section className="mt-8" aria-label="Media posts with this sound">
        <h2 className="font-display text-2xl text-ink">Media <span className="text-base text-slate">{data.media.length}</span></h2>
        {data.media.length ? (
          <div className="mt-4 grid grid-cols-3 gap-1 sm:gap-3 lg:grid-cols-5">
            {data.media.map((x) => (
              <MediaTile key={x.post.id} image={x.post.cover} alt={`${x.post.caption || (x.post.kind === "video" ? "Video" : "Pictures")} by @${x.owner.username}`} onClick={() => setOpen(x)}
                kind={x.post.kind === "pictures" ? (x.post.pictures.length > 1 ? "layers" : "image") : null}
                figure={{ icon: x.post.kind === "video" ? "play" : "eye", text: compact(x.post.viewCount) }}>
                <span className="absolute left-2 top-2 z-[2] max-w-[85%] truncate font-ui text-[11px] font-bold [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">@{x.owner.username}</span>
                {x.post.reactionsCount > 0 && <span className="absolute bottom-[7px] right-2 z-[2] font-ui text-xs font-bold [text-shadow:0_1px_3px_rgba(0,0,0,.5)]">❤️ {compact(x.post.reactionsCount)}</span>}
              </MediaTile>
            ))}
          </div>
        ) : <p className="mt-2 text-sm text-slate">Nobody has posted with it yet. <Link href={`/profile/media?song=${encodeURIComponent(song.id)}`} className="font-semibold text-crimson">Be the first →</Link></p>}
      </section>

      <p className="mt-10 rounded-2xl bg-field p-4 text-sm text-ink">🎤 <b>Are you an artist?</b> Get verified to add your songs to NotesApp Sounds. Creators use them on their posts, moments and lives, and you earn a royalty from #NotesApp&apos;s ad revenue for every play. <Link href="/profile/sounds" className="font-semibold text-crimson">Apply as an artist →</Link></p>

      {open && <MediaViewer item={{ type: "post", post: open.post }} username={open.owner.username} ownerUid={open.owner.uid} ownerName={open.owner.displayName} onClose={() => { setOpen(null); void load(); }} />}
      {moments && <MomentViewer moments={moments} onClose={() => setMoments(null)} onChanged={() => void load()} />}
    </div>
  );
}
