"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid, UserProfile } from "@/lib/users";
import {
  getComments,
  addComment,
  deleteComment,
  hasLikedComment,
  toggleCommentLike,
  Comment,
} from "@/lib/engagement";
import { isAdminEmail } from "@/lib/admin";
import { NA_NOTESAPP_PROFILE } from "@/lib/journals-directory";
import { getSuspendedUids } from "@/lib/moderation";

function CommentRow({
  comment,
  noteId,
  user,
  canModerate,
  onReply,
  onDelete,
  replyOpen,
  replyBox,
  isReply,
  suspended,
}: {
  comment: Comment;
  noteId: string;
  user: User | null | undefined;
  canModerate: boolean;
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  replyOpen: boolean;
  replyBox: React.ReactNode;
  isReply: boolean;
  suspended: boolean;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likeCount || 0);

  useEffect(() => {
    if (user) {
      hasLikedComment(noteId, comment.id, user.uid).then(setLiked);
    } else {
      setLiked(false);
    }
  }, [user, noteId, comment.id]);

  async function handleLike() {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    const nowLiked = await toggleCommentLike(noteId, comment.id, user.uid);
    setLiked(nowLiked);
    setLikeCount((c) => c + (nowLiked ? 1 : -1));
  }

  return (
    <div className={isReply ? "flex gap-3 py-4" : "flex gap-3 py-5 first:pt-0"}>
      <Link href={`/u/${comment.authorUsername}`} className="flex-shrink-0">
        <Image
          src={suspended ? "/images/brand/suspended-avatar.png" : comment.authorAvatar}
          alt={comment.authorDisplayName}
          width={isReply ? 32 : 40}
          height={isReply ? 32 : 40}
          className={`rounded-full object-cover ${isReply ? "w-8 h-8" : "w-10 h-10"}`}
        />
      </Link>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/u/${comment.authorUsername}`}
            className="font-ui text-sm font-semibold text-ink hover:text-crimson-bright"
          >
            {comment.authorDisplayName}
          </Link>
          <Link
            href={`/u/${comment.authorUsername}`}
            className="font-mono text-xs text-crimson-bright"
          >
            @{comment.authorUsername}
          </Link>
          {comment.authorUsername === NA_NOTESAPP_PROFILE.username && (
            <span className="rounded-full bg-crimson/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wideish text-crimson-bright">
              Official
            </span>
          )}
          {suspended && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wideish text-red-800">
              Suspended
            </span>
          )}
        </div>
        {suspended ? (
          <p className="mt-1 text-sm italic text-slate">
            This comment is hidden — the account is temporarily suspended.
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink font-body">{comment.content}</p>
        )}

        <div className="mt-2 flex items-center gap-4 text-xs font-ui">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 transition-colors ${
              liked ? "text-crimson-bright font-semibold" : "text-slate hover:text-crimson-bright"
            }`}
          >
            <span>{liked ? "♥" : "♡"}</span>
            <span>{likeCount > 0 ? likeCount : ""}</span>
          </button>
          {!isReply && (
            <button
              onClick={() => onReply(comment.id)}
              className="text-slate hover:text-crimson-bright transition-colors"
            >
              Reply
            </button>
          )}
          {(user?.uid === comment.authorUid || canModerate) && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-red-700 hover:text-red-900 transition-colors"
            >
              Delete
            </button>
          )}
        </div>

        {replyOpen && <div className="mt-3">{replyBox}</div>}
      </div>
    </div>
  );
}

export default function Comments({
  noteId,
  slug,
  title,
}: {
  noteId: string;
  slug: string;
  title: string;
}) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  // Admin-only: post/reply as @na-notesapp instead of as themselves.
  // authorUid still ends up as the real admin's uid either way — the
  // brand has no login of its own, and firestore.rules' comment
  // create rule requires authorUid == request.auth.uid, so it can't
  // be spoofed to anything else. Only the display identity changes.
  const [postAsBrand, setPostAsBrand] = useState(false);
  const [replyAsBrand, setReplyAsBrand] = useState(false);
  const [suspendedUids, setSuspendedUids] = useState<Set<string>>(new Set());

  const canModerate = !!(user?.email && isAdminEmail(user.email));
  const currentUserSuspended = !!(user && suspendedUids.has(user.uid));

  function authorFor(asBrand: boolean) {
    if (!user) return null;
    if (asBrand && canModerate) {
      return {
        uid: user.uid,
        username: NA_NOTESAPP_PROFILE.username,
        displayName: NA_NOTESAPP_PROFILE.displayName,
        avatar: NA_NOTESAPP_PROFILE.avatar,
      };
    }
    return profile
      ? {
          uid: user.uid,
          username: profile.username,
          displayName: profile.displayName,
          avatar: profile.avatar,
        }
      : null;
  }

  async function load() {
    setComments(await getComments(noteId));
  }

  useEffect(() => {
    load();
    getSuspendedUids()
      .then(setSuspendedUids)
      .catch((err) => console.warn("getSuspendedUids failed:", err));
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setProfile(u ? await getUserByUid(u.uid) : null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const author = authorFor(postAsBrand);
    if (!author || !text.trim()) return;
    setPosting(true);
    await addComment(noteId, slug, title, author, text.trim());
    setText("");
    await load();
    setPosting(false);
  }

  async function handleReplySubmit(parentId: string) {
    const author = authorFor(replyAsBrand);
    if (!author || !replyText.trim()) return;
    setPostingReply(true);
    await addComment(noteId, slug, title, author, replyText.trim(), parentId);
    setReplyText("");
    setReplyingTo(null);
    setReplyAsBrand(false);
    await load();
    setPostingReply(false);
  }

  async function handleDelete(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    await deleteComment(noteId, commentId);
    load();
  }

  const topLevel = comments.filter((c) => !c.parentCommentId);
  const repliesFor = (id: string) =>
    comments.filter((c) => c.parentCommentId === id);

  return (
    <div id="comments" className="mt-16 pt-10 border-t-2 border-ink scroll-mt-6">
      <p className="eyebrow">
        Comments {comments.length > 0 && `(${comments.length})`}
      </p>

      {user && profile && !currentUserSuspended ? (
        <form onSubmit={handleSubmit} className="mt-6 flex gap-3">
          <Image
            src={postAsBrand ? NA_NOTESAPP_PROFILE.avatar : profile.avatar}
            alt={postAsBrand ? NA_NOTESAPP_PROFILE.displayName : profile.displayName}
            width={40}
            height={40}
            className="rounded-full object-cover w-10 h-10 flex-shrink-0"
          />
          <div className="flex-1">
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                postAsBrand
                  ? `Reply as @${NA_NOTESAPP_PROFILE.username}…`
                  : "Share your thoughts…"
              }
              className="w-full border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
            />
            <div className="mt-2 flex items-center justify-between flex-wrap gap-3">
              <button
                type="submit"
                disabled={posting || !text.trim()}
                className="bg-crimson text-paper font-ui text-sm font-semibold px-5 py-2 hover:bg-crimson-bright transition-colors disabled:opacity-50"
              >
                {posting ? "Posting…" : postAsBrand ? "Post as @na-notesapp" : "Post Comment"}
              </button>
              {canModerate && (
                <label className="flex items-center gap-2 font-ui text-xs text-slate">
                  <input
                    type="checkbox"
                    checked={postAsBrand}
                    onChange={(e) => setPostAsBrand(e.target.checked)}
                    className="h-3.5 w-3.5 accent-crimson"
                  />
                  Reply as @na-notesapp
                </label>
              )}
            </div>
          </div>
        </form>
      ) : user === null ? (
        <p className="mt-6 text-sm text-slate">
          <Link href="/login" className="text-crimson-bright font-semibold">
            Sign in
          </Link>{" "}
          to join the conversation.
        </p>
      ) : currentUserSuspended ? (
        <p className="mt-6 text-sm text-slate">
          Your account is temporarily suspended and can't post comments
          right now.{" "}
          <Link href={`/u/${profile?.username}`} className="text-crimson-bright font-semibold">
            View your profile
          </Link>{" "}
          to file an appeal.
        </p>
      ) : null}

      <div className="mt-8 divide-y divide-rule">
        {topLevel.map((c) => {
          const replies = repliesFor(c.id);
          const replyBox = (
            <div>
              <div className="flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={
                    replyAsBrand
                      ? `Reply as @${NA_NOTESAPP_PROFILE.username}…`
                      : `Reply to ${c.authorDisplayName}…`
                  }
                  className="flex-1 border border-rule bg-card px-3 py-2 text-sm focus:border-crimson outline-none"
                />
                <button
                  onClick={() => handleReplySubmit(c.id)}
                  disabled={postingReply || !replyText.trim()}
                  className="bg-crimson text-paper font-ui text-xs font-semibold px-4 py-2 hover:bg-crimson-bright transition-colors disabled:opacity-50"
                >
                  Reply
                </button>
              </div>
              {canModerate && (
                <label className="mt-1.5 flex items-center gap-2 font-ui text-xs text-slate">
                  <input
                    type="checkbox"
                    checked={replyAsBrand}
                    onChange={(e) => setReplyAsBrand(e.target.checked)}
                    className="h-3.5 w-3.5 accent-crimson"
                  />
                  Reply as @na-notesapp
                </label>
              )}
            </div>
          );

          return (
            <div key={c.id}>
              <CommentRow
                comment={c}
                noteId={noteId}
                user={user}
                canModerate={canModerate}
                onReply={(id) => {
                  setReplyingTo(replyingTo === id ? null : id);
                  setReplyAsBrand(false);
                  setReplyText("");
                }}
                onDelete={handleDelete}
                replyOpen={replyingTo === c.id && !!user}
                replyBox={replyBox}
                isReply={false}
                suspended={suspendedUids.has(c.authorUid)}
              />
              {replies.length > 0 && (
                <div className="ml-11 pl-3 border-l-2 border-rule divide-y divide-rule">
                  {replies.map((r) => (
                    <CommentRow
                      key={r.id}
                      comment={r}
                      noteId={noteId}
                      user={user}
                      canModerate={canModerate}
                      onReply={() => {}}
                      onDelete={handleDelete}
                      replyOpen={false}
                      replyBox={null}
                      isReply={true}
                      suspended={suspendedUids.has(r.authorUid)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
