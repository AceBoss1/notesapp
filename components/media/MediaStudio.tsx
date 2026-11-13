"use client";

import ReplaysList from "@/components/replays/ReplaysList";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Studio } from "@/lib/media-server";
import {
  AUDIENCE_LABEL, MEDIA_AUDIENCES, MEDIA_CAPTION_MAX, MEDIA_PICTURES_MAX, MEDIA_PINNED_MAX, SITE_SOURCE_LABEL, compact, mediaDuration, secondsText,
  type MediaAudience, type MediaPostView,
} from "@/lib/media-rules";
import { LIMIT_TIER_LABEL } from "@/lib/limits";
import { DOWNLOADS_NOTE, MARK_NOTE } from "@/lib/media-mark";
import { loadStudio, mediaApi, sendToStream, videoInfo } from "@/lib/media-client";
import { uploadToR2WithKey } from "@/lib/upload";
import { Icon, Pattern } from "./MediaTile";
import SongPicker from "./SongPicker";
import { useGoLive } from "@/components/lives/useGoLive";

// /profile/media, the Media studio (approved mockup media-studio-*.png): a new post (video to Cloudflare Stream, or up to 10 pictures as
// WebP to our bucket), your posts with their figures and switches, and the pictures from your site with a Hide switch each. Lives & replays
// holds your recordings and replays (components/replays/ReplaysList.tsx); the Challenge tab comes with phase 5 (docs/MEDIA.md).
type Tab = "posts" | "live" | "settings";
type Sort = "newest" | "viewed";

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? "bg-crimson" : "bg-rule"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}
function Row({ title, sub, children }: { title: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t border-rule py-3">
      <div className="min-w-0 flex-1"><p className="font-ui text-[13.5px] font-bold text-ink">{title}</p>{sub && <p className="text-xs text-slate">{sub}</p>}</div>
      {children}
    </div>
  );
}
const card = "rounded-[22px] border border-rule bg-card p-5 sm:p-6";
const fmtGB = (b: number) => (b >= 1024 ** 3 ? `${+(b / 1024 ** 3).toFixed(1)} GB` : `${Math.max(0, Math.round(b / 1024 ** 2))} MB`);

export default function MediaStudio() {
  const goLive = useGoLive(); // 🔴 Go live: team accounts while the staff test pass is on (Admin → Limits)
  const [s, setS] = useState<Studio | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("posts");
  const reload = () => loadStudio().then(setS, (e) => { setError(e instanceof Error ? e.message : "Couldn't load your Media."); setS(null); });
  useEffect(() => { reload(); }, []);
  const formRef = useRef<HTMLDivElement>(null);

  if (s === undefined) return <p className="py-10 text-sm text-slate">Loading your Media…</p>;
  if (s === null) return <p className="py-10 text-sm text-red-700">{error}</p>;

  const tabBtn = (t: Tab, label: string) => (
    <button type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
      className={`relative shrink-0 py-2.5 font-ui text-sm font-bold ${tab === t ? "text-crimson after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:rounded after:bg-crimson" : "text-slate hover:text-ink"}`}>{label}</button>
  );
  const storage = s.quota.storage;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-crimson">/profile/media</p>
          <h1 className="mt-1 font-display text-4xl text-ink sm:text-[2.6rem]">Media studio</h1>
        </div>
        <button type="button" onClick={() => { setTab("posts"); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50); }}
          className="inline-flex items-center gap-2 rounded-full border border-rule bg-card px-4 py-2.5 font-ui text-sm font-bold text-ink hover:border-crimson">⤒ Upload</button>
      </div>
      <div className="mt-5 flex gap-6 overflow-x-auto border-b border-rule" role="tablist">{tabBtn("posts", "Posts")}{tabBtn("live", "Live & replays")}{tabBtn("settings", "Settings")}</div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        {[
          ["Views · all posts", compact(s.totals.views), `${s.totals.posts} post${s.totals.posts === 1 ? "" : "s"}`],
          ["Videos this week", `${s.quota.videos.used} of ${s.quota.videos.limit}`, "resets Monday"],
          ["Picture posts today", `${s.quota.picturePosts.used} of ${s.quota.picturePosts.limit}`, "up to 10 pictures each"],
          ["Storage", fmtGB(storage.usedBytes), storage.limitBytes === null ? "no limit" : `of ${fmtGB(storage.limitBytes)}`],
        ].map(([l, v, e]) => (
          <div key={l} className="rounded-2xl border border-rule bg-card px-3.5 py-3"><span className="font-ui text-xs font-semibold text-slate">{l}</span><b className="block font-display text-[26px] font-medium leading-tight text-ink">{v}</b><em className="font-ui text-[11.5px] font-bold not-italic text-moss">{e}</em></div>
        ))}
      </div>

      {tab === "posts" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)]">
          <div ref={formRef} className="scroll-mt-28"><NewPost s={s} onPosted={reload} /></div>
          <div className="space-y-4"><YourPosts s={s} onChanged={reload} /><FromYourSite s={s} onChanged={setS} /></div>
        </div>
      )}
      {tab === "live" && (
        // The recordings and replays from lives (PR #256): publish, share, Share to Journal; published ones show on the creator's Lives &
        // replays tab (lib/media-replays.ts replaysFor).
        <div className="mt-4">
          {goLive && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rule bg-card p-4">
            <p className="text-sm text-slate">Start a paid live, or a room in a community you run. Recordings and replays show below.</p>
            <Link href="/lives/start" className="btn-primary !px-4 !py-2 text-sm">🔴 Go live</Link>
          </div>}
          <ReplaysList />
        </div>
      )}
      {tab === "settings" && <div className="mt-4 max-w-2xl"><FromYourSite s={s} onChanged={setS} settingsOnly /></div>}
    </div>
  );
}

function NewPost({ s, onPosted }: { s: Studio; onPosted: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [songId, setSongId] = useState("");
  // "Use this sound" on a song's page opens the studio with ?song=<id> (lib/songs.ts).
  useEffect(() => { try { const q = new URLSearchParams(window.location.search).get("song"); if (q) setSongId(q); } catch { /* no query */ } }, []);
  // Remix (owner, 12 Nov 2026): "Remix" on someone's post opens the studio with ?remix=<post>: its sound is chosen, the caption credits
  // them, and the new post links back to theirs (lib/media-server.ts remixSource).
  const [remix, setRemix] = useState<{ id: string; username: string; kind: string; songId?: string; sound: string; caption: string; cover: string } | null>(null);
  useEffect(() => {
    let id = ""; try { id = new URLSearchParams(window.location.search).get("remix") ?? ""; } catch { /* no query */ }
    if (!id) return;
    fetch(`/api/media/remix?id=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j?.source) { setNote({ ok: false, text: "That post can't be remixed any more." }); return; }
      setRemix(j.source);
      if (j.source.songId) setSongId(j.source.songId);
      setCaption((c) => c || `Remix of @${j.source.username} `);
    }).catch(() => {});
  }, []);
  const [audience, setAudience] = useState<MediaAudience>("everyone");
  const [sw, setSw] = useState({ allowComments: true, allowShares: true, allowGifts: true, allowDownloads: false, pinned: false });
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const isVideo = files[0]?.type.startsWith("video/");
  const pinnedNow = s.posts.filter((p) => p.pinned).length;

  const choose = (list: FileList | null) => {
    if (!list?.length) return;
    const all = Array.from(list);
    const video = all.find((f) => f.type.startsWith("video/"));
    const next = video ? [video] : all.filter((f) => f.type.startsWith("image/")).slice(0, MEDIA_PICTURES_MAX);
    previews.forEach((u) => URL.revokeObjectURL(u));
    setFiles(next); setPreviews(next.map((f) => URL.createObjectURL(f))); setNote(null);
    if (video && all.length > 1) setNote({ ok: false, text: "A post is one video or up to 10 pictures, so only the video was kept." });
  };

  const post = async () => {
    if (!files.length) return setNote({ ok: false, text: "Choose a video or pictures first." });
    setBusy(true); setNote(null);
    try {
      const common = { caption, audience, ...sw, ...(songId ? { songId } : {}), ...(remix ? { remixOf: remix.id } : {}) };
      if (isVideo) {
        const f = files[0];
        const { durationSec, width, height } = await videoInfo(f);
        const up = await mediaApi<{ uploadId: string; uploadURL: string }>("/api/media/video", { body: { durationSec, width, height, size: f.size, name: f.name }, signedIn: true });
        setProgress(0);
        await sendToStream(up.uploadURL, f, setProgress);
        await mediaApi("/api/media/posts", { body: { kind: "video", videoUploadId: up.uploadId, ...common }, signedIn: true });
      } else {
        const keys: string[] = [];
        for (let k = 0; k < files.length; k++) {
          setProgress(k / files.length);
          keys.push((await uploadToR2WithKey(files[k], "media")).key);
        }
        setProgress(1);
        const r = await mediaApi<{ post: MediaPostView }>("/api/media/posts", { body: { kind: "pictures", pictureKeys: keys, ...common }, signedIn: true });
        if (r.post.status === "processing") { setFiles([]); setPreviews([]); setCaption(""); setSongId(""); setProgress(null); setNote({ ok: true, text: "Posted. We're still adding the NotesApp mark; your pictures show on your Media in a few minutes." }); onPosted(); return; }
      }
      setFiles([]); setPreviews([]); setCaption(""); setSongId(""); setProgress(null);
      setNote({ ok: true, text: isVideo ? "Posted. Your video shows on your Media once Cloudflare has finished it with the NotesApp mark, usually within a minute." : "Posted to your Media, with the NotesApp mark." });
      onPosted();
    } catch (e) {
      setProgress(null);
      setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't post that." });
    } finally { setBusy(false); }
  };

  const q = s.quota;
  return (
    <section className={card} aria-label="New post">
      <h2 className="flex items-center gap-2 font-ui text-base font-extrabold text-ink">⤒ New post</h2>
      <p className="mt-1 text-[13px] text-slate">{q.videos.limit > 0 ? `A video (up to ${secondsText(q.maxVideoSeconds)})` : "Pictures"} or up to {MEDIA_PICTURES_MAX} pictures. Stays on your Media until you delete it.</p>
      <p className="mt-2 flex gap-2 rounded-2xl bg-field px-3.5 py-2.5 text-[12.5px] text-ink"><span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-crimson font-ui text-[9px] font-extrabold text-white">na</span><span>{MARK_NOTE}</span></p>

      <input ref={input} type="file" multiple accept={`image/jpeg,image/png,image/webp,image/gif,image/avif${s.streamReady && q.videos.limit > 0 ? ",video/mp4,video/webm,video/quicktime" : ""}`} className="hidden" onChange={(e) => { choose(e.target.files); e.target.value = ""; }} />
      <button type="button" onClick={() => input.current?.click()} className="mt-4 flex w-full items-center gap-3.5 rounded-[18px] border-2 border-dashed border-[#D9C6BD] bg-paper p-3.5 text-left">
        <span className="relative h-[100px] w-16 shrink-0 overflow-hidden rounded-xl bg-[#1a0b10]">
          {previews[0] ? (isVideo
            ? <video src={previews[0]} muted className="h-full w-full object-cover" />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={previews[0]} alt="" className="h-full w-full object-cover" />) : <Pattern />}
          {files.length > 1 && <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 font-mono text-[10px] text-white">+{files.length - 1}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate font-ui text-sm text-ink">{files.length ? (isVideo ? files[0].name : `${files.length} picture${files.length === 1 ? "" : "s"}`) : "Choose a video or pictures"}</b>
          <span className="block text-xs text-slate">{files.length ? `${(files.reduce((n, f) => n + f.size, 0) / 1048576).toFixed(1)} MB${progress !== null ? ` · uploading ${Math.round(progress * 100)}%` : ""}` : s.streamReady ? "MP4 or WebM video, or JPEG, PNG and WebP pictures (made WebP before upload)" : "Pictures for now: videos are switched on soon"}</span>
          {progress !== null && <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-rule"><span className="block h-full bg-crimson" style={{ width: `${Math.round(progress * 100)}%` }} /></span>}
        </span>
      </button>

      {remix && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-crimson/30 bg-crimson/[0.05] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {remix.cover ? <img src={remix.cover} alt="" className="h-14 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-lg bg-field" aria-hidden>🎞</span>}
          <span className="min-w-0 flex-1 text-sm">
            <b className="block font-ui text-ink">Remixing @{remix.username}&apos;s {remix.kind === "video" ? "video" : "post"}</b>
            <span className="block truncate text-xs text-slate">{remix.songId ? `With its sound: ${remix.sound}` : "Make your own take; it links back to theirs"}{remix.caption ? ` · “${remix.caption}”` : ""}</span>
          </span>
          <button type="button" onClick={() => setRemix(null)} className="shrink-0 text-xs text-crimson underline">Not a remix</button>
        </div>
      )}
      <label className="mt-4 block font-ui text-[12.5px] font-bold text-ink" htmlFor="media-caption">Caption</label>
      <textarea id="media-caption" rows={3} maxLength={MEDIA_CAPTION_MAX} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Say what it is. #hashtags and @mentions work."
        className="mt-1.5 w-full rounded-2xl border border-rule bg-card px-3.5 py-3 text-sm text-ink outline-none focus:border-crimson" />

      <p className="mt-3 font-ui text-[12.5px] font-bold text-ink">Sound</p>
      <SongPicker value={songId} onChange={setSongId} />
      <p className="mt-1 text-xs text-slate">{isVideo && songId ? "The song plays softly under your video's own sound." : "NotesApp Sounds: songs you can use free on #NotesApp."}</p>

      <p className="mt-3 font-ui text-[12.5px] font-bold text-ink">Who can see it</p>
      <div className="mt-1.5 inline-flex gap-0.5 rounded-full bg-field p-[3px]" role="radiogroup" aria-label="Who can see it">
        {MEDIA_AUDIENCES.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={audience === a} onClick={() => setAudience(a)}
            className={`rounded-full px-3 py-1.5 font-ui text-[12.5px] font-bold ${audience === a ? "bg-card text-crimson shadow-sm" : "text-slate"}`}>{AUDIENCE_LABEL[a]}</button>
        ))}
      </div>
      {s.teen && <p className="mt-2 text-xs text-slate">Teen mode: your Media is shown only to people who follow each other with you, whatever you choose here. Shares, gifts and downloads stay off.</p>}

      <div className="mt-4">
        <Row title="Comments" sub="Turn off any time. Comments arrive with the Media feed."><Switch label="Comments" on={sw.allowComments} onChange={(v) => setSw({ ...sw, allowComments: v })} /></Row>
        <Row title="Allow shares" sub="Moments, journals, chats, other apps and remixes"><Switch label="Allow shares" disabled={s.teen} on={sw.allowShares && !s.teen} onChange={(v) => setSw({ ...sw, allowShares: v })} /></Row>
        <Row title="Gifts" sub="Paid to you after a 7-day hold"><Switch label="Gifts" disabled={s.teen} on={sw.allowGifts && !s.teen} onChange={(v) => setSw({ ...sw, allowGifts: v })} /></Row>
        <Row title="Allow downloads" sub={`Off unless you turn it on. ${DOWNLOADS_NOTE}`}><Switch label="Allow downloads" disabled={s.teen} on={sw.allowDownloads && !s.teen} onChange={(v) => setSw({ ...sw, allowDownloads: v })} /></Row>
        <Row title="Pin to the top of my Media" sub={`Up to ${MEDIA_PINNED_MAX} pinned · ${pinnedNow} now`}><Switch label="Pin to the top of my Media" disabled={!sw.pinned && pinnedNow >= MEDIA_PINNED_MAX} on={sw.pinned} onChange={(v) => setSw({ ...sw, pinned: v })} /></Row>
      </div>

      <p className="mt-3 flex gap-2 rounded-2xl bg-field px-3.5 py-3 text-[12.5px] text-ink">
        <span aria-hidden="true">◷</span>
        <span><b>{LIMIT_TIER_LABEL[s.tier]} plan:</b> {q.videos.limit > 0 ? `${q.videos.used} of ${q.videos.limit} videos used this week (resets Monday), up to ${q.maxVideoSeconds} seconds each. ` : "Media videos come with a paid plan. "}{q.picturePosts.used} of {q.picturePosts.limit} picture posts today. <Link href="/pricing" className="font-semibold text-crimson">See plans</Link></span>
      </p>
      {note && <p className={`mt-3 text-sm ${note.ok ? "text-moss" : "text-red-700"}`} role="status">{note.text}</p>}
      <button type="button" disabled={busy || !files.length} onClick={post} className="mt-4 w-full rounded-full bg-crimson py-3.5 font-ui text-[15px] font-bold text-paper disabled:opacity-60">{busy ? "Posting…" : "Post to Media"}</button>
    </section>
  );
}

function YourPosts({ s, onChanged }: { s: Studio; onChanged: () => void }) {
  const [sort, setSort] = useState<Sort>("newest");
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const list = [...s.posts].sort((a, b) => (sort === "viewed" ? b.viewCount - a.viewCount : b.createdAt.localeCompare(a.createdAt)));
  const patch = async (p: MediaPostView, body: Record<string, unknown>) => {
    setErr(null);
    try { await mediaApi(`/api/media/posts/${p.id}`, { method: "PATCH", body, signedIn: true }); onChanged(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save that."); }
  };
  const remove = async (p: MediaPostView) => {
    if (!confirm("Delete this post from your Media? This can't be undone.")) return;
    try { await mediaApi(`/api/media/posts/${p.id}`, { method: "DELETE", signedIn: true }); onChanged(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't delete it."); }
  };
  const pill = (text: string, tone: "pin" | "green" | "grey" | "amber" | "red") => {
    const c = { pin: "bg-[#fde8ee] text-crimson", green: "bg-[#e3f4e8] text-[#1f6b3a]", grey: "bg-field text-slate", amber: "bg-[#fdf1d8] text-[#8a5a00]", red: "bg-red-50 text-red-700" }[tone];
    return <span className={`rounded-full px-2 py-0.5 font-ui text-[11px] font-bold ${c}`}>{text}</span>;
  };
  return (
    <section className={card} aria-label="Your posts">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-ui text-base font-extrabold text-ink">Your posts</h2>
        <div className="inline-flex gap-0.5 rounded-full bg-field p-[3px]">
          {(["newest", "viewed"] as Sort[]).map((k) => <button key={k} type="button" onClick={() => setSort(k)} className={`rounded-full px-3 py-1.5 font-ui text-[12.5px] font-bold ${sort === k ? "bg-card text-crimson shadow-sm" : "text-slate"}`}>{k === "newest" ? "Newest" : "Most viewed"}</button>)}
        </div>
      </div>
      {list.length === 0 && <p className="mt-4 border-t border-rule pt-4 text-sm text-slate">Nothing posted yet. Your first video or pictures show here with their views and downloads.</p>}
      {list.map((p) => (
        <div key={p.id} className="border-t border-rule py-3 first-of-type:mt-3">
          <div className="grid grid-cols-[46px_1fr_auto] items-center gap-3">
            <span className="relative h-[70px] w-[46px] overflow-hidden rounded-[9px] bg-[#1a0b10]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.cover ? <img src={p.cover} alt="" className="h-full w-full object-cover" /> : <Pattern />}
            </span>
            <div className="min-w-0">
              <p className="truncate font-ui text-[13.5px] font-bold text-ink">{p.caption.split("\n")[0] || (p.kind === "video" ? "Video" : "Pictures")}</p>
              <p className="text-xs text-slate">{p.kind === "video" ? `Video${p.video ? ` · ${mediaDuration(p.video.durationSec)}` : ""}` : `${p.pictures.length} picture${p.pictures.length === 1 ? "" : "s"}`} · {new Date(p.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</p>
              <p className="mt-1 flex flex-wrap gap-3 font-ui text-xs font-bold text-slate">
                <span className="inline-flex items-center gap-1"><Icon name="eye" className="h-3 w-3" />{p.status === "ready" ? compact(p.viewCount) : "–"}</span>
                <span>⤓ {p.allowDownloads ? compact(p.downloadCount) : "off"}</span>
                <span>💬 {p.allowComments ? compact(p.commentsCount) : "off"}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {p.pinned && pill("Pinned", "pin")}
              {p.status === "processing" ? pill("Processing", "amber") : p.status === "rejected" ? pill("Rejected", "red") : pill(AUDIENCE_LABEL[p.audience], p.audience === "everyone" ? "green" : "grey")}
              <button type="button" aria-label="Post settings" aria-expanded={openId === p.id} onClick={() => setOpenId(openId === p.id ? null : p.id)} className="px-1 font-bold tracking-widest text-slate">•••</button>
            </div>
          </div>
          {p.status === "rejected" && p.rejectedReason && <p className="mt-2 text-xs text-red-700">{p.rejectedReason}</p>}
          {/* A video's download (Stream's MP4 of the marked video): being made, ready, or why it couldn't be. */}
          {p.kind === "video" && p.allowDownloads && p.status === "ready" && (
            <p className={`mt-2 text-xs ${p.videoDownload === "failed" ? "text-red-700" : "text-slate"}`}>
              {p.videoDownload === "ready" ? "⤓ Download ready." : p.videoDownload === "failed" ? (p.videoDownloadWhy || "The download file couldn't be made.") : "⤓ Making the download file… usually a few minutes."}
            </p>
          )}
          {openId === p.id && (
            <div className="mt-2 rounded-2xl bg-paper px-3">
              <Row title="Who can see it">
                <select aria-label="Who can see it" value={p.audience} onChange={(e) => patch(p, { audience: e.target.value })} className="rounded-full border border-rule bg-card px-3 py-1.5 text-sm">
                  {MEDIA_AUDIENCES.map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
                </select>
              </Row>
              <Row title="Pinned"><Switch label="Pinned" on={p.pinned} onChange={(v) => patch(p, { pinned: v })} /></Row>
              <Row title="Comments"><Switch label="Comments" on={p.allowComments} onChange={(v) => patch(p, { allowComments: v })} /></Row>
              <Row title="Allow downloads" sub={DOWNLOADS_NOTE}><Switch label="Allow downloads" disabled={s.teen} on={p.allowDownloads} onChange={(v) => patch(p, { allowDownloads: v })} /></Row>
              <Row title="Delete this post"><button type="button" onClick={() => remove(p)} className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700">Delete</button></Row>
            </div>
          )}
        </div>
      ))}
      {err && <p className="mt-2 text-sm text-red-700" role="status">{err}</p>}
      {s.posts.some((p) => p.status === "processing") && <p className="mt-3 text-xs text-slate">&quot;Processing&quot; means the NotesApp mark is still being added (and, for a video, Cloudflare is still preparing it); it usually takes under a minute.</p>}
    </section>
  );
}

function FromYourSite({ s, onChanged, settingsOnly }: { s: Studio; onChanged: (s: Studio) => void; settingsOnly?: boolean }) {
  const [err, setErr] = useState<string | null>(null);
  const save = async (body: Record<string, unknown>) => {
    setErr(null);
    try {
      const r = await mediaApi<{ settings: Studio["settings"] }>("/api/media/settings", { body, signedIn: true });
      const hidden = new Set(r.settings.hiddenSite);
      onChanged({ ...s, settings: r.settings, sitePictures: s.sitePictures.map((p) => ({ ...p, hidden: hidden.has(p.id) })) });
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save that."); }
  };
  const shown = s.sitePictures.filter((p) => !p.hidden).length;
  const sources = Array.from(new Set(s.sitePictures.map((p) => SITE_SOURCE_LABEL[p.source].replace("Site cover", "cover").replace("Top banner", "top banner").toLowerCase()))).join(", ");
  return (
    <section className={card} aria-label="From your site">
      <h2 className="flex items-center gap-2 font-ui text-base font-extrabold text-ink"><Icon name="image" /> From your site</h2>
      <p className="mt-1 text-[13px] text-slate">Pictures already on your site show in your Media as pictures. Hide any you&apos;d rather keep on the site only.</p>
      {!settingsOnly && (s.sitePictures.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {s.sitePictures.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-[14px] bg-[#1a0b10]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption || SITE_SOURCE_LABEL[p.source]} className={`h-full w-full object-cover ${p.hidden || s.settings.hideAllSite ? "opacity-40 grayscale" : ""}`} />
              <button type="button" onClick={() => save({ hide: { id: p.id, hidden: !p.hidden } })} aria-pressed={p.hidden} aria-label={p.hidden ? "Show in my Media" : "Hide from my Media"}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink shadow">{p.hidden ? "⊘" : <Icon name="eye" className="h-3.5 w-3.5" />}</button>
              <span className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 font-ui text-[11px] font-bold ${p.hidden ? "bg-white/80 text-slate" : "bg-black/60 text-white"}`}>{p.hidden ? "Hidden" : SITE_SOURCE_LABEL[p.source]}</span>
            </div>
          ))}
        </div>
      ) : <p className="mt-3 rounded-2xl bg-paper p-4 text-sm text-slate">No pictures on your site yet. Add a gallery, cover or service pictures in <Link href="/profile/site" className="font-semibold text-crimson">Your site</Link> and they show here.</p>)}
      <div className="mt-3">
        <Row title="Site pictures in my Media" sub={`${s.sitePictures.length} from ${sources || "your site"} · ${s.sitePictures.length - shown} hidden`}><Switch label="Site pictures in my Media" on={!s.settings.hideAllSite} onChange={(v) => save({ hideAllSite: !v })} /></Row>
        <Row title="Past profile pictures as an album" sub={`${s.albumCount} picture${s.albumCount === 1 ? "" : "s"} · newest first`}><Switch label="Past profile pictures as an album" on={s.settings.showAlbum} onChange={(v) => save({ showAlbum: v })} /></Row>
      </div>
      {err && <p className="mt-2 text-sm text-red-700" role="status">{err}</p>}
    </section>
  );
}
