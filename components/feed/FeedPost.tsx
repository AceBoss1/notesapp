"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { collection, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { hasLiked, incrementShareCount, toggleLike } from "@/lib/engagement";
import { notifyLiked } from "@/lib/notifications";
import type { NoteWithComputed } from "@/lib/firestore-notes";
import { hashtag, topicsOf } from "@/lib/topics";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import type { FeedAuthor } from "@/lib/feed-author";

export const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (!Number.isFinite(m)) return "";
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : m < 43_200 ? `${Math.round(m / 1440)}d` : new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
};
export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n));

// Comment counts for the cards on screen; one count query per journal, kept for the visit.
const comments = new Map<string, Promise<number>>();
function useCommentCount(noteId: string) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let p = comments.get(noteId);
    if (!p) { p = getCountFromServer(collection(db, "notes", noteId, "comments")).then((s) => s.data().count).catch(() => 0); comments.set(noteId, p); }
    let alive = true;
    p.then((c) => alive && setN(c));
    return () => { alive = false; };
  }, [noteId]);
  return n;
}

const Icon = ({ d, className = "h-[18px] w-[18px]", fill = "none" }: { d: string; className?: string; fill?: string }) => (
  <svg viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={d} /></svg>
);
const HEART = "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z";
const BUBBLE = "M4 5.5h16v10H9l-5 4v-14Z";
const RESHARE = "M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4";
const BARS = "M5 20V9M10 20V4M15 20v-8M20 20V7";
const BOOKMARK = "M6.5 3.5h11v17l-5.5-4-5.5 4v-17Z";
const OPEN = "M8 16 16 8M9 8h7v7";

export type { FeedAuthor } from "@/lib/feed-author";
type Props = {
  note: NoteWithComputed;
  author: FeedAuthor;
  user: User | null | undefined;
  views: number;
  saved: boolean;
  onSave: (noteId: string) => void;
  follow?: React.ReactNode; // the Follow / Following control at the top right (computers)
  label?: React.ReactNode; // e.g. "Promoted"
};

// One journal in the feed (Moda redesign): who wrote it, the title in the serif, the opening, the picture (wide under the words on a
// phone, beside them on a computer), the topic and reading time, then likes, comments, shares, views, save and open.
export default function FeedPost({ note, author, user, views, saved, onSave, follow, label }: Props) {
  const href = `/journals/${note.slug}`;
  const topic = topicsOf(note)[0];
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(note.likeCount || 0);
  const [shares, setShares] = useState(note.shareCount || 0);
  const [note2, setNote2] = useState<string | null>(null);
  const commentCount = useCommentCount(note.id);
  useEffect(() => { if (user) hasLiked(note.id, user.uid).then(setLiked).catch(() => {}); }, [user, note.id]);

  async function like() {
    if (!user) return setNote2("Sign in to like journals.");
    const now = await toggleLike(note.id, user.uid).catch(() => null);
    if (now === null) return;
    setLiked(now);
    setLikes((c) => c + (now ? 1 : -1));
    if (now) notifyLiked(note.id).catch(() => {});
  }
  async function share() {
    const url = `${window.location.origin}${href}`;
    try {
      if (navigator.share) await navigator.share({ title: note.title, url });
      else { await navigator.clipboard.writeText(url); setNote2("Link copied."); }
      incrementShareCount(note.id).then(() => setShares((c) => c + 1)).catch(() => {});
    } catch {}
  }
  const save = () => (user ? onSave(note.id) : setNote2("Sign in to save journals."));
  const btn = "flex items-center gap-1.5 text-[15px] text-slate hover:text-crimson";

  return (
    <article className="border-b-[10px] border-[#F3ECE7] bg-card px-4 py-5 lg:border-b lg:border-rule lg:px-6 lg:py-6">
      <header className="flex items-start gap-3">
        {author.username
          ? <Link href={`/u/${author.username}`} className="shrink-0"><Avatar src={author.avatar} alt={note.author} size={44} square={author.isOrg} /></Link>
          : <span className="shrink-0"><Avatar src={author.avatar} alt={note.author} size={44} square={author.isOrg} /></span>}
        <div className="min-w-0 flex-1">
          <p className="flex items-center font-ui text-[15px] font-bold leading-tight text-ink">
            {author.username ? <Link href={`/u/${author.username}`} className="truncate hover:text-crimson">{note.author}</Link> : <span className="truncate">{note.author}</span>}
            {author.username && <NameBadgeIcons username={author.username} />}
          </p>
          <p className="mt-0.5 truncate text-sm text-slate">{[author.username && `@${author.username}`, author.role, ago(note.date)].filter(Boolean).join(" · ")}</p>
        </div>
        {label && <span className="shrink-0 rounded-full bg-crimson/[0.07] px-2.5 py-1 font-mono text-[10px] uppercase tracking-eyebrow text-crimson">{label}</span>}
        {follow && <div className="hidden shrink-0 lg:block">{follow}</div>}
        <button type="button" onClick={share} aria-label="Share" className="-mr-1 shrink-0 px-1 text-xl leading-none text-slate hover:text-crimson lg:hidden">⋯</button>
      </header>

      <div className="mt-3 lg:flex lg:gap-6">
        <div className="min-w-0 flex-1">
          <Link href={href}><h2 className="font-display text-[1.6rem] font-semibold leading-[1.15] text-ink hover:text-crimson lg:text-[1.75rem]">{note.title}</h2></Link>
          {note.excerpt && <p className="mt-3 text-[15px] leading-relaxed text-slate lg:text-base">{note.excerpt}</p>}
        </div>
        {note.featured_image && (
          <Link href={href} className="mt-4 block shrink-0 lg:mt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={note.featured_image} alt="" loading="lazy" className="aspect-[16/9] w-full rounded-2xl object-cover lg:aspect-auto lg:h-[180px] lg:w-[220px]" />
          </Link>
        )}
      </div>

      <p className="mt-4 flex items-center gap-6 text-sm">
        {topic && <Link href={`/journals?topic=${topic}`} className="font-mono uppercase tracking-wideish text-crimson hover:underline">{hashtag(topic)}</Link>}
        <span className="text-slate">{note.reading_time} min read{note.premium ? " · Members only" : ""}</span>
      </p>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-8 sm:gap-12">
          <button type="button" onClick={like} aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"} className={`${btn} ${liked ? "text-crimson" : ""}`}><Icon d={HEART} fill={liked ? "currentColor" : "none"} />{compact(likes)}</button>
          <Link href={`${href}#comments`} aria-label="Comments" className={btn}><Icon d={BUBBLE} />{commentCount === null ? "" : compact(commentCount)}</Link>
          <button type="button" onClick={share} aria-label="Share" className={btn}><Icon d={RESHARE} />{compact(shares)}</button>
          <span className={`${btn} hover:text-slate`} title="Views"><Icon d={BARS} />{compact(views)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save"} className={`${btn} ${saved ? "text-crimson" : ""}`}><Icon d={BOOKMARK} fill={saved ? "currentColor" : "none"} /></button>
          <Link href={href} aria-label="Open" className={`${btn} hidden lg:flex`}><Icon d={OPEN} /></Link>
        </div>
      </div>
      {note2 && <p role="status" className="mt-2 text-xs text-crimson">{note2} {!user && <Link href="/login" className="underline">Sign in</Link>}</p>}
    </article>
  );
}
