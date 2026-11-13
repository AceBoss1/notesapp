"use client";

import { useEffect, useState } from "react";
import LinkedText from "@/components/LinkedText";
import { MEDIA_REACTIONS, compact, mediaDuration, type MediaPostView } from "@/lib/media-rules";
import { VIDEO_DL_PREPARING } from "@/lib/media-mark";
import { downloadMediaPicture, downloadMediaVideo, mediaApi } from "@/lib/media-client";
import { Icon, Pattern } from "./MediaTile";
import { SongPlayer, SongTag } from "./SongPicker";
import GiftButton from "@/components/GiftButton";
import Link from "next/link";
import ShareIcon from "@/components/share/ShareIcon";
import { ShareMenu } from "@/components/share/ShareToNotesApp";
import PersonActions from "@/components/gifts/PersonActions";

// One item on a creator's Media, full screen: a post (pictures you swipe through with ‹ ›, or a video on Cloudflare Stream's player), a
// site picture, or the profile picture album. The vertical feed with comments, reactions and gifts is phase M2 (docs/MEDIA.md).
export type ViewerItem =
  | { type: "post"; post: MediaPostView }
  | { type: "pictures"; title: string; note: string; urls: string[]; start?: number };

export default function MediaViewer({ item, username, ownerUid, ownerName, onClose }: { item: ViewerItem; username: string; ownerUid?: string; ownerName?: string; onClose: () => void }) {
  const urls = item.type === "post" ? item.post.pictures : item.urls;
  const [i, setI] = useState(item.type === "pictures" ? item.start ?? 0 : 0);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const post = item.type === "post" ? item.post : null;
  // Reactions: mine and the counts, from the view call; one per member (the same one again takes it back).
  const [mine, setMine] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const react = async (emoji: string) => {
    if (!post) return;
    try { const r = await mediaApi<{ reaction: string | null; reactions: Record<string, number> }>(`/api/media/posts/${post.id}`, { body: { action: "react", emoji }, signedIn: true }); setMine(r.reaction); setReactions(r.reactions); }
    catch (e) { setNote(e instanceof Error ? e.message : "Couldn't react."); }
  };

  useEffect(() => {
    if (post) mediaApi<{ reaction?: string | null; reactions?: Record<string, number> }>(`/api/media/posts/${post.id}`, { body: { action: "view" } })
      .then((r) => { setMine(r.reaction ?? null); setReactions(r.reactions ?? {}); }).catch(() => {});
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(urls.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = async () => {
    if (!post) return;
    setBusy(true); setNote(null);
    try {
      if (post.kind === "video") { await downloadMediaVideo(post.id); setNote("Downloading, with a see-through @" + username + " and NotesApp mark on it."); }
      else { await downloadMediaPicture(post.id, i); setNote("Saved, with @" + username + " and the NotesApp mark on it."); }
    }
    catch (e) { setNote(e instanceof Error ? e.message : "Couldn't download it."); }
    finally { setBusy(false); }
  };

  const video = post?.kind === "video" ? post.video : undefined;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#12060a]/95 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={post ? "Media post" : item.type === "pictures" ? item.title : "Media"}>
      <button type="button" onClick={onClose} className="absolute right-3 top-3 z-20 rounded-full bg-white/15 px-3 py-1.5 font-ui text-sm font-bold text-white backdrop-blur hover:bg-white/25" aria-label="Close">✕</button>
      <div className="relative flex h-full w-full max-w-[460px] flex-col overflow-hidden bg-black sm:h-[88vh] sm:rounded-[22px]">
        <div className="relative flex-1">
          {/* A NotesApp Sounds song on the post: plays while it's open (softly under a video's own sound). */}
          {post?.songId && post.status === "ready" && <SongPlayer songId={post.songId} under={!!video} />}
          {video ? (
            post?.status === "ready" ? (
              <iframe src={`${video.player}?autoplay=true&loop=true`} title="Video" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
            ) : (
              <div className="absolute inset-0"><Pattern /><p className="absolute inset-x-0 top-1/2 text-center font-ui text-sm font-bold text-crimson">{post?.status === "rejected" ? post.rejectedReason || "This video was rejected." : "Processing… it shows here when Cloudflare has it ready."}</p></div>
            )
          ) : urls.length ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[i]} alt="" className="absolute inset-0 h-full w-full object-contain" />
          ) : <Pattern />}
          {urls.length > 1 && (
            <>
              <div className="absolute inset-x-3 top-3 z-10 flex gap-1">{urls.map((_, k) => <span key={k} className={`h-[3px] flex-1 rounded-full ${k === i ? "bg-white" : "bg-white/35"}`} />)}</div>
              {i > 0 && <button type="button" onClick={() => setI(i - 1)} aria-label="Previous picture" className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 px-3 py-2 text-xl text-white">‹</button>}
              {i < urls.length - 1 && <button type="button" onClick={() => setI(i + 1)} aria-label="Next picture" className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 px-3 py-2 text-xl text-white">›</button>}
              <span className="absolute right-3 top-7 z-10 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 font-mono text-[11px] text-white">{i + 1}/{urls.length}</span>
            </>
          )}
        </div>
        <div className="space-y-2 bg-gradient-to-t from-black via-black/90 to-black/70 p-4 text-white">
          <p className="flex items-center gap-2 font-ui text-sm font-bold">@{username}
            {/* Gift the creator for this post (when they allow gifts on it), and Gift · Block · Report beside their name. */}
            {post && !post.mine && ownerUid && <PersonActions uid={ownerUid} username={username} name={ownerName || username} toKind="creator" context="media" mediaId={post.id} where="a Media post" text={post.caption} dark compact />}
          </p>
          {post && !post.mine && post.allowGifts && ownerUid && <GiftButton publisherUid={ownerUid} username={username} toName={ownerName || username} toKind="creator" context="media" mediaId={post.id} label="🎁 Gift this post" />}
          {post ? (
            <>
              {post.remixOf && <p className="text-xs text-white/70">🔁 Remix of <Link href={`/u/${post.remixOf.username}/media?post=${post.remixOf.id}`} className="font-semibold text-white underline underline-offset-2">@{post.remixOf.username}</Link></p>}
              {post.caption && <p className="text-sm text-white/90"><LinkedText text={post.caption} linkClass="font-semibold text-white underline underline-offset-2" /></p>}
              <p className="flex flex-wrap items-center gap-3 font-ui text-xs font-semibold text-white/70">
                <span className="inline-flex items-center gap-1"><Icon name="eye" className="h-3 w-3" />{compact(post.viewCount)}</span>
                {video && <span className="inline-flex items-center gap-1"><Icon name="play" className="h-3 w-3" />{mediaDuration(video.durationSec)}</span>}
                {post.songId ? <SongTag songId={post.songId} fallback={post.sound} /> : <span>♫ {post.sound}</span>}
                <span>{new Date(post.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
              </p>
              {post.status === "ready" && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="React">
                  {MEDIA_REACTIONS.map((e) => (
                    <button key={e} type="button" onClick={() => void react(e)} aria-pressed={mine === e} aria-label={`React ${e}`}
                      className={`rounded-full px-2.5 py-1 text-sm ${mine === e ? "bg-white text-ink" : "bg-white/10 hover:bg-white/20"}`}>{e}{reactions[e] ? <span className="ml-1 font-ui text-xs font-bold">{compact(reactions[e])}</span> : null}</button>
                  ))}
                </div>
              )}
              {/* Share (Moments and Journals first, then other apps) and Remix (owner, 12 Nov 2026), when the creator allows shares. */}
              {post.status === "ready" && (post.allowShares || post.mine) && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSharing(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 font-ui text-sm font-bold text-white hover:bg-white/25"><ShareIcon className="h-4 w-4" />Share</button>
                  {post.remixable && !post.mine && <Link href={`/profile/media?remix=${post.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 font-ui text-sm font-bold text-white hover:bg-white/25"><RemixIcon />Remix{post.remixCount ? <span className="font-normal text-white/70"> · {compact(post.remixCount)}</span> : null}</Link>}
                  {post.mine && post.remixCount > 0 && <span className="inline-flex items-center gap-1.5 px-2 py-2 text-xs text-white/70"><RemixIcon /> {compact(post.remixCount)} remix{post.remixCount === 1 ? "" : "es"}</span>}
                </div>
              )}
              {sharing && <ShareMenu shareRef={post.audience === "everyone" ? { kind: "media", id: post.id } : null} url={typeof window === "undefined" ? `/u/${username}/media?post=${post.id}` : `${window.location.origin}/u/${username}/media?post=${post.id}`} title={post.caption.split("\n")[0] || `@${username} on #NotesApp`} onClose={() => setSharing(false)} />}
              {/* Every picture and video carries the NotesApp mark, so a download is the same file. A video: once Stream has made its MP4. */}
              {post.allowDownloads && (post.kind === "pictures" || post.videoDownload === "ready" ? (
                <button type="button" disabled={busy} onClick={download} className="rounded-full bg-white px-4 py-2 font-ui text-sm font-bold text-crimson disabled:opacity-60">{busy ? "Preparing…" : "⤓ Download"}</button>
              ) : post.mine && post.videoDownload === "preparing" ? <p className="text-xs text-white/60">{VIDEO_DL_PREPARING}</p>
                : post.mine && post.videoDownload === "failed" ? <p className="text-xs text-amber-300">{post.videoDownloadWhy || "The download file couldn't be made."}</p> : null)}
            </>
          ) : item.type === "pictures" ? (
            <p className="text-sm text-white/80">{item.title}{item.note ? <span className="text-white/60"> · {item.note}</span> : null}</p>
          ) : null}
          {note && <p className="text-xs text-amber-300" role="status">{note}</p>}
        </div>
      </div>
    </div>
  );
}

// Remix: two arrows chasing each other around a spark, like the screenshot the owner shared (12 Nov 2026).
function RemixIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20v-4h-4" />
      <path d="M12 9.5v5M9.5 12h5" />
    </svg>
  );
}
