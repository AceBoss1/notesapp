"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { uploadToR2 } from "@/lib/upload";
import { can, type Role } from "@/lib/community";
import { DEFAULT_AVATAR } from "@/lib/admin";
import { useMember } from "@/lib/member-client";
import { capi, field, ago } from "./api";
import { communityUrl, mainHref } from "./place";

// A channel of a community (General or a Space), laid out like a Facebook group: a "Write something…" box that opens into the composer
// (words and a photo), then posts newest first (pinned on top), each with the author, the words, the photo edge to edge, the counts, and
// Like · Comment · Share; comments as bubbles with their writers' pictures. Moderators and admins pin and remove from a post's ⋯ menu.
// General is an announcement channel: admins post, members react and comment.
type Post = { id: string; authorUid: string; authorName: string; authorUsername: string; authorAvatar: string; text: string; image: string; pinned: boolean; likes: number; comments: number; createdAt: string; liked: boolean };
type Comment = { id: string; authorUid: string; authorName: string; authorUsername: string; authorAvatar?: string; text: string; createdAt: string };

const Face = ({ src, size = 40 }: { src?: string; size?: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src || DEFAULT_AVATAR} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
);

export default function Feed({ cid, channel, canPost, role, me, as, slowModeSec }: { cid: string; channel: string; canPost: boolean; role: Role | null; me: string | null; as: string; slowModeSec: number }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try { setPosts((await capi<{ posts: Post[] }>(`/api/community?id=${cid}&posts=${channel}${as ? `&as=${as}` : ""}`)).posts); setErr(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't load posts."); setPosts([]); }
  }, [cid, channel, as]);
  useEffect(() => { setPosts(null); load(); }, [load]);
  return (
    <div className="space-y-4">
      {canPost && <Composer cid={cid} channel={channel} onDone={load} />}
      {slowModeSec > 0 && !!role && <p className="text-xs text-slate">Slow mode is on: members can post or comment once every {slowModeSec < 60 ? `${slowModeSec} seconds` : `${slowModeSec / 60} minutes`}.</p>}
      {err && <p className="text-sm text-crimson" role="alert">{err}</p>}
      {posts === null ? <PostSkeleton /> : !posts.length ? (
        <div className="rounded-2xl border border-rule bg-card p-8 text-center">
          <p className="font-display text-xl text-ink">Nothing here yet</p>
          <p className="mt-1 text-sm text-slate">{canPost ? "Start the conversation: say hello, share news or ask a question." : "Posts will show here."}</p>
        </div>
      ) : (
        <ul className="space-y-4">{posts.map((p) => <PostCard key={p.id} p={p} cid={cid} role={role} me={me} as={as} onChange={load} />)}</ul>
      )}
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading">
      {[0, 1].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-rule bg-card p-4">
          <div className="flex items-center gap-3"><span className="h-10 w-10 rounded-full bg-rule/60" /><span className="h-3 w-40 rounded bg-rule/60" /></div>
          <div className="mt-4 h-3 w-full rounded bg-rule/50" /><div className="mt-2 h-3 w-2/3 rounded bg-rule/50" />
        </div>
      ))}
    </div>
  );
}

function Composer({ cid, channel, onDone }: { cid: string; channel: string; onDone: () => void }) {
  const { profile } = useMember();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (open) box.current?.focus(); }, [open]);
  async function pick(f?: File) { if (!f) return; setOpen(true); setBusy(true); try { setImage(await uploadToR2(f, "journal")); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't upload."); } finally { setBusy(false); } }
  async function send() {
    setBusy(true); setErr("");
    try { await capi("/api/community", { action: "post", id: cid, channel, text, image }); setText(""); setImage(""); setOpen(false); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't post."); }
    finally { setBusy(false); }
  }
  const prompt = channel === "general" ? "Share an announcement with every member…" : "Write something…";
  return (
    <div className="rounded-2xl border border-rule bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Face src={profile?.avatar} />
        {open ? (
          <textarea ref={box} value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={5000} placeholder={prompt} aria-label="Post" className={`${field} !rounded-2xl`} />
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="flex-1 rounded-full bg-paper px-4 py-2.5 text-left text-sm text-slate ring-1 ring-rule hover:bg-rule/30">{prompt}</button>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <div className="relative mt-3"><img src={image} alt="" className="max-h-80 w-full rounded-xl object-cover" /><button type="button" onClick={() => setImage("")} aria-label="Remove the photo" className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-paper">×</button></div>}
      <div className="mt-3 flex items-center gap-2 border-t border-rule pt-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 font-ui text-sm font-semibold text-slate hover:bg-paper">
          <span aria-hidden className="text-lg">🖼️</span>Photo<input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <span className="flex-1" />
        {open && <button type="button" className="text-sm text-slate underline" onClick={() => { setOpen(false); setText(""); setImage(""); }}>Cancel</button>}
        <button className="btn-primary !px-5 !py-2 text-sm" disabled={busy || (!text.trim() && !image)} onClick={send}>{busy ? "Posting…" : "Post"}</button>
      </div>
      {err && <p className="mt-2 text-sm text-crimson" role="alert">{err}</p>}
    </div>
  );
}

const Action = ({ on, label, icon, onClick, disabled }: { on?: boolean; label: string; icon: string; onClick: () => void; disabled?: boolean }) => (
  <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 font-ui text-sm font-semibold hover:bg-paper disabled:opacity-50 ${on ? "text-crimson" : "text-slate"}`}>
    <span aria-hidden>{icon}</span>{label}
  </button>
);

function PostCard({ p, cid, role, me, as, onChange }: { p: Post; cid: string; role: Role | null; me: string | null; as: string; onChange: () => void }) {
  const { profile } = useMember();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [liked, setLiked] = useState(p.liked);
  const [likes, setLikes] = useState(p.likes);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const member = !!role;
  const input = useRef<HTMLInputElement>(null);
  const loadComments = useCallback(async () => { try { setComments((await capi<{ comments: Comment[] }>(`/api/community?comments=${p.id}${as ? `&as=${as}` : ""}`)).comments); } catch { setComments([]); } }, [p.id, as]);
  useEffect(() => { if (open) loadComments(); }, [open, loadComments]);
  const act = async (body: Record<string, unknown>, then = onChange) => { setErr(""); try { await capi("/api/community", body); then(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't do that."); } };
  const canManage = member && (can(role, "pin") || p.authorUid === me);
  const share = async () => {
    const url = communityUrl(cid, `#post-${p.id}`);
    try { if (navigator.share) await navigator.share({ url }); else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } } catch { /* closed the sheet */ }
  };
  return (
    <li id={`post-${p.id}`} className={`scroll-mt-24 overflow-hidden rounded-2xl border bg-card shadow-sm ${p.pinned ? "border-crimson/40" : "border-rule"}`}>
      {p.pinned && <p className="bg-crimson/5 px-4 py-1.5 font-ui text-[11px] font-semibold uppercase tracking-wide text-crimson">📌 Pinned by the admins</p>}
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href={mainHref(`/u/${p.authorUsername}`)} className="shrink-0"><Face src={p.authorAvatar} /></Link>
        <div className="min-w-0 flex-1">
          <Link href={mainHref(`/u/${p.authorUsername}`)} className="block truncate font-ui text-sm font-bold text-ink hover:underline">{p.authorName}</Link>
          <p className="text-xs text-slate">{ago(p.createdAt)} · 🌍</p>
        </div>
        {canManage && (
          <div className="relative">
            <button type="button" onClick={() => setMenu(!menu)} aria-label="Post options" className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-slate hover:bg-paper">⋯</button>
            {menu && (
              <div className="absolute right-0 top-10 z-10 w-40 overflow-hidden rounded-xl border border-rule bg-card py-1 shadow-lg">
                {can(role, "pin") && <button type="button" className="block w-full px-4 py-2 text-left text-sm hover:bg-paper" onClick={() => { setMenu(false); act({ action: "pin", postId: p.id, pinned: !p.pinned }); }}>{p.pinned ? "Unpin" : "Pin to the top"}</button>}
                <button type="button" className="block w-full px-4 py-2 text-left text-sm text-crimson hover:bg-paper" onClick={() => { setMenu(false); if (confirm("Remove this post?")) act({ action: "remove_post", postId: p.id }); }}>Remove</button>
              </div>
            )}
          </div>
        )}
      </div>
      {p.text && <p className={`whitespace-pre-line px-4 pt-3 text-ink ${p.text.length < 90 && !p.image ? "text-xl leading-snug" : "text-[15px] leading-relaxed"}`}>{p.text}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p.image && <img src={p.image} alt="" className="mt-3 max-h-[34rem] w-full object-cover" loading="lazy" />}
      {(likes > 0 || p.comments > 0) && (
        <div className="flex items-center justify-between px-4 pt-3 text-xs text-slate">
          <span>{likes > 0 && <><span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-crimson text-[9px] text-paper">♥</span> {likes}</>}</span>
          {p.comments > 0 && <button type="button" onClick={() => setOpen(true)} className="hover:underline">{p.comments} {p.comments === 1 ? "comment" : "comments"}</button>}
        </div>
      )}
      <div className="mx-4 mt-2 flex border-t border-rule py-1">
        <Action icon={liked ? "♥" : "♡"} label="Like" on={liked} disabled={!member} onClick={() => { const on = !liked; setLiked(on); setLikes((n) => n + (on ? 1 : -1)); act({ action: "like", postId: p.id, on }, () => {}); }} />
        <Action icon="💬" label="Comment" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 50); }} />
        <Action icon="↗" label={copied ? "Link copied" : "Share"} onClick={share} />
      </div>
      {open && (
        <div className="border-t border-rule bg-paper/40 px-4 py-3">
          {comments === null ? <p className="text-xs text-slate">Loading…</p> : (
            <ul className="space-y-3">{comments.map((c) => (
              <li key={c.id} className="flex gap-2">
                <Face src={c.authorAvatar} size={32} />
                <div className="min-w-0">
                  <div className="rounded-2xl bg-card px-3 py-2 ring-1 ring-rule"><Link href={mainHref(`/u/${c.authorUsername}`)} className="block font-ui text-xs font-bold text-ink hover:underline">{c.authorName}</Link><p className="whitespace-pre-line text-sm text-ink">{c.text}</p></div>
                  <p className="mt-0.5 px-3 text-[11px] text-slate">{ago(c.createdAt)}{(c.authorUid === me || can(role, "remove_post")) && <> · <button type="button" className="underline" onClick={() => act({ action: "remove_comment", commentId: c.id }, () => { loadComments(); onChange(); })}>Remove</button></>}</p>
                </div>
              </li>
            ))}</ul>
          )}
          {member ? (
            <form className="mt-3 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) act({ action: "comment", postId: p.id, text }, () => { setText(""); loadComments(); onChange(); }); }}>
              <Face src={profile?.avatar} size={32} />
              <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Write a comment…" aria-label="Comment" className="min-w-0 flex-1 rounded-full border border-rule bg-card px-4 py-2 text-sm text-ink placeholder:text-slate focus:border-crimson focus:outline-none" />
              <button className="font-ui text-sm font-bold text-crimson disabled:opacity-40" disabled={!text.trim()}>Send</button>
            </form>
          ) : <p className="mt-2 text-xs text-slate">Join the community to comment.</p>}
        </div>
      )}
      {err && <p className="px-4 pb-3 text-sm text-crimson" role="alert">{err}</p>}
    </li>
  );
}
