"use client";

import { useCallback, useEffect, useState } from "react";
import { uploadToR2 } from "@/lib/upload";
import { can, type Role } from "@/lib/community";
import { DEFAULT_AVATAR } from "@/lib/admin";
import { capi, field, small, ago } from "./api";

// A channel of a community (General or a Space): posts newest first (pinned on top), likes and comments, the composer for those who may
// post, and pin and remove for moderators and admins. General is an announcement channel: admins post, members react and comment.
type Post = { id: string; authorUid: string; authorName: string; authorUsername: string; authorAvatar: string; text: string; image: string; pinned: boolean; likes: number; comments: number; createdAt: string; liked: boolean };
type Comment = { id: string; authorUid: string; authorName: string; authorUsername: string; text: string; createdAt: string };

export default function Feed({ cid, channel, canPost, role, me, as, slowModeSec }: { cid: string; channel: string; canPost: boolean; role: Role | null; me: string | null; as: string; slowModeSec: number }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try { setPosts((await capi<{ posts: Post[] }>(`/api/community?id=${cid}&posts=${channel}${as ? `&as=${as}` : ""}`)).posts); setErr(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't load posts."); setPosts([]); }
  }, [cid, channel, as]);
  useEffect(() => { setPosts(null); load(); }, [load]);
  return (
    <div>
      {canPost && <Composer cid={cid} channel={channel} onDone={load} />}
      {slowModeSec > 0 && !!role && <p className="mt-2 text-xs text-slate">Slow mode is on: members can post or comment once every {slowModeSec < 60 ? `${slowModeSec} seconds` : `${slowModeSec / 60} minutes`}.</p>}
      {err && <p className="mt-4 text-sm text-crimson" role="alert">{err}</p>}
      {posts === null ? <p className="mt-6 text-sm text-slate">Loading…</p> : !posts.length ? <p className="card mt-6 p-6 text-sm text-slate">Nothing here yet.</p> : (
        <ul className="mt-6 space-y-4">{posts.map((p) => <PostCard key={p.id} p={p} role={role} me={me} as={as} onChange={load} />)}</ul>
      )}
    </div>
  );
}

function Composer({ cid, channel, onDone }: { cid: string; channel: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(f?: File) { if (!f) return; setBusy(true); try { setImage(await uploadToR2(f, "journal")); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't upload."); } finally { setBusy(false); } }
  async function send() {
    setBusy(true); setErr("");
    try { await capi("/api/community", { action: "post", id: cid, channel, text, image }); setText(""); setImage(""); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't post."); }
    finally { setBusy(false); }
  }
  return (
    <div className="card p-4">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={5000} placeholder={channel === "general" ? "An announcement for every member…" : "Write something…"} className={field} aria-label="Post" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt="" className="mt-2 max-h-60 rounded-xl object-cover" />}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className={`${small} cursor-pointer`}>{image ? "Change picture" : "Add a picture"}<input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} /></label>
        {image && <button className="text-xs text-slate underline" onClick={() => setImage("")}>Remove</button>}
        <span className="flex-1" />
        <button className="btn-primary !px-4 !py-1.5 text-xs" disabled={busy || (!text.trim() && !image)} onClick={send}>{busy ? "Posting…" : "Post"}</button>
      </div>
      {err && <p className="mt-2 text-sm text-crimson" role="alert">{err}</p>}
    </div>
  );
}

function PostCard({ p, role, me, as, onChange }: { p: Post; role: Role | null; me: string | null; as: string; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [liked, setLiked] = useState(p.liked);
  const [likes, setLikes] = useState(p.likes);
  const [err, setErr] = useState("");
  const member = !!role;
  const loadComments = useCallback(async () => { try { setComments((await capi<{ comments: Comment[] }>(`/api/community?comments=${p.id}${as ? `&as=${as}` : ""}`)).comments); } catch { setComments([]); } }, [p.id, as]);
  useEffect(() => { if (open) loadComments(); }, [open, loadComments]);
  const act = async (body: Record<string, unknown>, then = onChange) => { setErr(""); try { await capi("/api/community", body); then(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't do that."); } };
  return (
    <li className={`card p-4 ${p.pinned ? "border-crimson/40" : ""}`}>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.authorAvatar || DEFAULT_AVATAR} alt="" className="h-9 w-9 rounded-full object-cover" />
        <div className="min-w-0 flex-1"><p className="truncate font-ui text-sm font-bold text-ink">{p.authorName}</p><p className="text-xs text-slate">@{p.authorUsername} · {ago(p.createdAt)}{p.pinned ? " · 📌 Pinned" : ""}</p></div>
        {member && (can(role, "pin") || p.authorUid === me) && (
          <span className="flex gap-2 text-xs">
            {can(role, "pin") && <button className="text-slate underline" onClick={() => act({ action: "pin", postId: p.id, pinned: !p.pinned })}>{p.pinned ? "Unpin" : "Pin"}</button>}
            <button className="text-slate underline" onClick={() => confirm("Remove this post?") && act({ action: "remove_post", postId: p.id })}>Remove</button>
          </span>
        )}
      </div>
      {p.text && <p className="mt-3 whitespace-pre-line text-sm text-ink">{p.text}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p.image && <img src={p.image} alt="" className="mt-3 max-h-[28rem] w-full rounded-xl object-cover" loading="lazy" />}
      <div className="mt-3 flex items-center gap-4 text-xs text-slate">
        <button disabled={!member} onClick={() => { const on = !liked; setLiked(on); setLikes((n) => n + (on ? 1 : -1)); act({ action: "like", postId: p.id, on }, () => {}); }} className={liked ? "font-semibold text-crimson" : ""} aria-pressed={liked}>♥ {likes}</button>
        <button onClick={() => setOpen(!open)}>💬 {p.comments} {p.comments === 1 ? "comment" : "comments"}</button>
      </div>
      {open && (
        <div className="mt-3 border-t border-rule pt-3">
          {comments === null ? <p className="text-xs text-slate">Loading…</p> : (
            <ul className="space-y-2">{comments.map((c) => (
              <li key={c.id} className="text-sm"><span className="font-semibold text-ink">{c.authorName}</span> <span className="text-ink">{c.text}</span> <span className="text-xs text-slate">· {ago(c.createdAt)}</span>
                {(c.authorUid === me || can(role, "remove_post")) && <button className="ml-2 text-xs text-slate underline" onClick={() => act({ action: "remove_comment", commentId: c.id }, () => { loadComments(); onChange(); })}>Remove</button>}
              </li>
            ))}</ul>
          )}
          {member ? (
            <div className="mt-2 flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Write a comment" className={field} aria-label="Comment" />
              <button className={small} disabled={!text.trim()} onClick={() => act({ action: "comment", postId: p.id, text }, () => { setText(""); loadComments(); onChange(); })}>Send</button>
            </div>
          ) : <p className="mt-2 text-xs text-slate">Join the community to comment.</p>}
        </div>
      )}
      {err && <p className="mt-2 text-sm text-crimson" role="alert">{err}</p>}
    </li>
  );
}
