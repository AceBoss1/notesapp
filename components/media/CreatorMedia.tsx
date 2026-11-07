"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CreatorMedia as Data } from "@/lib/media-server";
import { SITE_SOURCE_LABEL, compact, mediaDuration, type MediaPostView } from "@/lib/media-rules";
import { timeLeftLabel } from "@/lib/moments-rules";
import type { MomentView } from "@/lib/moments-server";
import MomentViewer from "@/components/moments/MomentViewer";
import MediaTile, { Icon, Pattern } from "./MediaTile";
import MediaViewer, { type ViewerItem } from "./MediaViewer";

// A creator's Media (the Media tab on /u/{username}, and /u/{username}/media): pinned Moments at the top, then All · Videos · Pictures ·
// Profile pictures · Lives & replays over a grid of 9:16 tiles, as in the approved mockups (media-creator-*.png). Pinned posts come first
// in the grid. Site pictures (Gallery, cover, services) are part of it unless the creator hides them in /profile/media.
type Filter = "all" | "videos" | "pictures" | "album" | "replays";

export default function CreatorMedia({ data, isOwn, onChanged }: { data: Data | null | undefined; isOwn: boolean; onChanged?: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<ViewerItem | null>(null);
  const [moments, setMoments] = useState<MomentView[] | null>(null);

  const posts = useMemo(() => (data ? [...data.posts].sort((a, b) => Number(b.pinned) - Number(a.pinned)) : []), [data]);
  if (data === undefined) return <p className="mt-6 text-sm text-slate">Loading Media…</p>;
  if (data === null) return <p className="mt-6 text-sm text-slate">Media couldn&apos;t be loaded. Try again in a moment.</p>;
  const username = data.owner.username;
  if (!data.visible) return <div className="card mt-5 p-6 text-sm text-slate"><p className="font-display text-xl text-ink">Media is for people @{username} follows back</p><p className="mt-1">This member is in teen mode: their videos and pictures are shown only to people who follow each other.</p></div>;

  const c = data.counts;
  const tab = (f: Filter, label: string, n?: number) => (
    <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
      className={`relative shrink-0 whitespace-nowrap py-2.5 font-ui text-sm font-bold ${filter === f ? "text-crimson after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:rounded after:bg-crimson" : "text-slate hover:text-ink"}`}>
      {label}{n !== undefined ? ` ${n}` : ""}
    </button>
  );

  const postTile = (p: MediaPostView) => (
    <MediaTile key={p.id} image={p.cover} alt={p.caption || (p.kind === "video" ? "Video" : "Pictures")} onClick={() => setOpen({ type: "post", post: p })}
      label={p.pinned ? { text: "Pinned", tone: "pin" } : undefined}
      kind={p.kind === "pictures" ? (p.pictures.length > 1 ? "layers" : "image") : null}
      figure={p.kind === "video" ? { icon: "play", text: p.video ? `${compact(p.viewCount)} · ${mediaDuration(p.video.durationSec)}` : compact(p.viewCount) } : { icon: "eye", text: compact(p.viewCount) }} />
  );
  const albumTile = data.album.length > 0 && (
    <MediaTile key="album" alt={`Past profile pictures (${data.album.length})`} label={{ text: "Album", tone: "plain" }} figure={{ icon: "image", text: `Past profile pictures (${data.album.length})` }}
      onClick={() => setOpen({ type: "pictures", title: "Profile pictures", note: `${data.album.length} picture${data.album.length === 1 ? "" : "s"}, newest first`, urls: data.album.map((a) => a.url) })}>
      <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#f3ece7] to-[#8a7d78]">
        {data.album.slice(0, 3).reverse().map((a, k, arr) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a.id || a.url} src={a.url} alt="" className="absolute h-[42%] w-auto rounded-xl border-[3px] border-white object-cover shadow-lg" style={{ aspectRatio: "1", transform: `rotate(${(k - (arr.length - 1)) * 7 + 4}deg) translateX(${(k - (arr.length - 1)) * 6}px)` }} />
        ))}
      </span>
    </MediaTile>
  );
  const siteTiles = data.sitePictures.map((s, k) => (
    <MediaTile key={s.id} image={s.url} alt={s.caption || SITE_SOURCE_LABEL[s.source]} kind="image" figure={{ icon: "image", text: SITE_SOURCE_LABEL[s.source] }}
      onClick={() => setOpen({ type: "pictures", title: "From the site", note: "", urls: data.sitePictures.map((x) => x.url), start: k })} />
  ));
  const replayTiles = data.replays.map((r) => (
    <Link key={r.id} href={r.href} className="block"><MediaTile image={r.poster} alt={r.title} label={{ text: r.live ? "LIVE" : "REPLAY", tone: "live" }} figure={{ icon: r.live ? "head" : "play", text: mediaDuration(r.durationSec) }} /></Link>
  ));

  const videos = posts.filter((p) => p.kind === "video");
  const pictures = posts.filter((p) => p.kind === "pictures");
  const grid = (tiles: React.ReactNode[], square = false) => tiles.length ? (
    <div className={`mt-4 grid gap-1 sm:gap-3 ${square ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3 lg:grid-cols-5"}`}>{tiles}</div>
  ) : null;
  const empty = (text: string) => <p className="mt-6 text-sm text-slate">{text}</p>;

  return (
    <div className="mt-5">
      {(data.pinnedMoments.length > 0) && (
        <section aria-label="Pinned">
          <p className="flex items-center gap-1.5 font-ui text-xs font-bold uppercase tracking-[0.12em] text-slate"><Icon name="pin" className="h-3 w-3" /> Pinned</p>
          <div className="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {data.pinnedMoments.map((m, k) => (
              <button key={m.id} type="button" onClick={() => setMoments([...data.pinnedMoments.slice(k), ...data.pinnedMoments.slice(0, k)])} className="w-[78px] shrink-0 text-center">
                <span className="mx-auto block h-[66px] w-[66px] rounded-full bg-gradient-to-tr from-crimson via-crimson-bright to-amber-400 p-[3px]">
                  <span className="relative block h-full w-full overflow-hidden rounded-full border-2 border-paper bg-[#1a0b10]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {m.imageUrl || m.link?.image ? <img src={m.imageUrl || m.link?.image} alt="" className="h-full w-full object-cover" /> : <Pattern />}
                  </span>
                </span>
                <span className="mt-1.5 block truncate font-ui text-xs font-bold text-ink">{m.text?.slice(0, 18) || m.link?.title?.slice(0, 18) || (m.kind === "video" ? "Video" : "Picture")}</span>
                <span className="block text-[11px] leading-tight text-slate">Moment<br />{timeLeftLabel(m.expiresAt) === "expired" ? "Pinned" : timeLeftLabel(m.expiresAt)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className={`-mx-4 flex gap-5 overflow-x-auto border-b border-rule px-4 sm:mx-0 sm:px-0 ${data.pinnedMoments.length ? "mt-5" : ""}`} role="tablist" aria-label="Media">
        {tab("all", "All")}
        {tab("videos", "Videos", c.videos)}
        {tab("pictures", "Pictures", c.pictures)}
        {tab("album", "Profile pictures", c.album)}
        {tab("replays", "Lives & replays", c.replays)}
      </div>

      {filter === "all" && (c.all === 0
        ? <div className="card mt-5 p-6 text-sm text-slate"><p className="font-display text-xl text-ink">No Media yet</p><p className="mt-1">{isOwn ? <>Post videos and pictures from your <Link href="/profile/media" className="font-semibold text-crimson">Media studio</Link>. Pictures already on your site show here too.</> : "Videos and pictures will show here."}</p></div>
        : grid([...posts.filter((p) => p.pinned).map(postTile), ...(albumTile ? [albumTile] : []), ...replayTiles, ...posts.filter((p) => !p.pinned).map(postTile), ...siteTiles]))}
      {filter === "videos" && (videos.length ? grid(videos.map(postTile)) : empty("No videos yet."))}
      {filter === "pictures" && (pictures.length + data.sitePictures.length ? grid([...pictures.map(postTile), ...siteTiles]) : empty("No pictures yet."))}
      {filter === "album" && (data.album.length ? grid(data.album.map((a, k) => (
        <MediaTile key={a.id || a.url} square image={a.url} alt="Profile picture" label={a.current ? { text: "Now", tone: "plain" } : undefined}
          onClick={() => setOpen({ type: "pictures", title: "Profile pictures", note: "", urls: data.album.map((x) => x.url), start: k })} />
      )), true) : empty("No past profile pictures yet."))}
      {filter === "replays" && (replayTiles.length ? grid(replayTiles) : empty("No lives or replays yet. When @" + username + " goes live and publishes a replay, it shows here."))}

      {isOwn && <p className="mt-5 flex flex-wrap items-center justify-end gap-4"><Link href="/lives/start" className="rounded-full bg-crimson px-4 py-1.5 font-ui text-sm font-bold text-white hover:bg-crimson-bright">🔴 Go live</Link><Link href="/profile/media" className="font-ui text-sm font-semibold text-crimson">Open your Media studio →</Link></p>}
      {open && <MediaViewer item={open} username={username} ownerUid={data.owner.uid} ownerName={data.owner.displayName} onClose={() => { setOpen(null); onChanged?.(); }} />}
      {moments && <MomentViewer moments={moments} onClose={() => setMoments(null)} onChanged={onChanged} />}
    </div>
  );
}
