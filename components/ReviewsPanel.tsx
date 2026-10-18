"use client";

import LinkedText from "@/components/LinkedText";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import { AcademyIcon } from "@/components/shell/icons";
import { REVIEW_MAX, REPLY_MAX, stars, type RatingSummary, type Review } from "@/lib/reviews";

type Progress = { done: number; total: number; needed: number; ok: boolean } | null;
type Data = { reviews: Review[]; summary: RatingSummary; breakdown?: number[]; canReview: boolean; mine: Review | null; progress?: Progress };
const field = "mt-1 w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

export function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  return <span className={`${size} tracking-tight text-amber-500`} aria-label={`${value} out of 5 stars`}>{stars(value)}</span>;
}

// The stars, the average and how the ratings split (5 down to 1).
export function RatingBreakdown({ summary, breakdown, label }: { summary: RatingSummary; breakdown: number[]; label: string }) {
  const max = Math.max(1, ...breakdown);
  return (
    <div>
      <p className="font-display text-6xl leading-none text-ink">{summary.average.toFixed(1)}</p>
      <p className="mt-1"><Stars value={summary.average} size="text-xl" /></p>
      <p className="text-sm text-slate">{summary.count} {label}</p>
      <ul className="mt-4 space-y-1.5" aria-label="How the ratings split">
        {[5, 4, 3, 2, 1].map((n) => (
          <li key={n} className="flex items-center gap-2 text-xs text-slate">
            <span className="w-3 text-right">{n}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-rule"><span className="block h-full rounded-full bg-amber-500" style={{ width: `${((breakdown[n - 1] ?? 0) / max) * 100}%` }} /></span>
            <span className="w-6 text-right">{breakdown[n - 1] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Reviews, one panel for store items and courses:
//   itemId: one item's reviews (only people who bought and received it can review; the seller replies once to each)
//   ownerUid: across a seller's items (read only)
//   courseId: a course's reviews (learners who've done half the lessons can review; the teacher replies once to each).
// The average and the split show from `minShown` reviews (courses: lib/courses.ts RATING_SHOWN_FROM).
export default function ReviewsPanel({ itemId, ownerUid, courseId, user, sellerUid, title = "Reviews", minShown = 1 }: {
  itemId?: string; ownerUid?: string; courseId?: string; user: User | null | undefined; sellerUid?: string; title?: string; minShown?: number;
}) {
  const course = !!courseId;
  const owner = course ? "teacher" : "seller";
  const badge = course ? "Finished the course" : "Bought it";
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const endpoint = course ? "/api/academy/reviews" : "/api/store/reviews";
  const qs = course ? `courseId=${encodeURIComponent(courseId!)}` : itemId ? `itemId=${encodeURIComponent(itemId)}` : `ownerUid=${encodeURIComponent(ownerUid ?? "")}`;

  const call = useCallback(async (body?: Record<string, unknown>) => {
    const headers: Record<string, string> = user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {};
    const r = body ? await fetch(endpoint, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) }) : await fetch(`${endpoint}?${qs}`, { headers });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user, qs, endpoint]);
  const load = useCallback(() => call().then(setData).catch(() => setData({ reviews: [], summary: { count: 0, average: 0 }, canReview: false, mine: null })), [call]);
  useEffect(() => { if (user !== undefined) load(); }, [user, load]);

  const run = async (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try { await call(body); await load(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  };

  if (!data) return null;
  const { reviews, summary, canReview, mine, progress } = data;
  if (!reviews.length && !canReview) {
    if (ownerUid) return null;
    const why = course
      ? progress ? `You've done ${progress.done} of ${progress.total} lessons: you can review once you've done ${progress.needed}.` : "Learners can review once they've done half the lessons."
      : "Only people who bought and received the item can review it.";
    return <section className="card mt-10 p-6" id="reviews"><h2 className="font-display text-2xl text-ink">{title}</h2><p className="mt-2 text-sm text-slate">No reviews yet. {why}</p></section>;
  }
  const form = canReview && (!mine || editing);
  const shown = summary.count >= minShown;
  const hint = course && progress
    ? progress.ok ? `You've done ${progress.done} of ${progress.total} lessons, so you can review it. One review each; you can edit it later.` : `You've done ${progress.done} of ${progress.total} lessons: you can review once you've done ${progress.needed}.`
    : "One review each; you can edit it later.";
  return (
    <section className="card mt-10 p-5 sm:p-7" id="reviews">
      <h2 className="font-display text-3xl text-ink">{title}</h2>
      <div className={`mt-5 grid gap-8 ${shown ? "lg:grid-cols-[240px_1fr]" : ""}`}>
        {shown && <RatingBreakdown summary={summary} breakdown={data.breakdown ?? [0, 0, 0, 0, 0]} label={course ? `review${summary.count === 1 ? "" : "s"} from learners` : `review${summary.count === 1 ? "" : "s"}`} />}
        <div className="min-w-0 space-y-4">
          {canReview && mine && !editing && (
            <p className="text-sm text-slate">You reviewed this. <button type="button" className="font-semibold text-crimson underline" onClick={() => { setEditing(true); setRating(mine.rating); setText(mine.text); }}>Edit</button> · <button type="button" className="font-semibold text-crimson underline" disabled={busy} onClick={() => run({ action: "delete", id: mine.id })}>Remove</button></p>
          )}
          {form && (
            <form className="rounded-2xl border-2 border-crimson/25 bg-card p-4" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "review", ...(course ? { courseId } : { itemId }), rating, text })) { setEditing(false); setRating(0); setText(""); } }}>
              <p className="font-ui text-sm font-bold text-ink">{mine ? "Edit your review" : course ? "Your review" : "You bought this. How was it?"}</p>
              <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(n)} className={`text-3xl leading-none ${n <= rating ? "text-amber-500" : "text-rule"}`}>★</button>)}
              </div>
              <textarea className={field} rows={3} maxLength={REVIEW_MAX} value={text} onChange={(e) => setText(e.target.value)} placeholder={course ? "What did you learn? What could be better?" : "How was it? (optional)"} aria-label="Your review (optional)" />
              {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate">{hint}</span>
                <span className="flex gap-2">
                  {editing && <button type="button" className="rounded-full border border-rule px-4 py-2 font-ui text-xs font-semibold" onClick={() => setEditing(false)}>Cancel</button>}
                  <button disabled={busy || !rating} className="rounded-full bg-crimson px-5 py-2 font-ui text-sm font-bold text-paper hover:bg-crimson-bright disabled:opacity-50">{mine ? "Save" : "Post review"}</button>
                </span>
              </div>
            </form>
          )}
          {course && progress && !progress.ok && !mine && <p className="rounded-xl bg-paper p-3 text-sm text-slate">{hint}</p>}

          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-rule bg-card p-4">
                <div className="flex items-start gap-3">
                  <Avatar src={r.avatar} alt={r.name} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-ui text-sm font-bold text-ink">
                      <span className="flex min-w-0 items-center">{r.username ? <Link href={`/u/${r.username}`} className="truncate hover:underline">{r.name}</Link> : r.name}<NameBadgeIcons username={r.username} size={13} /></span>
                      {r.verified !== false && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-emerald-700">
                          {course ? <AcademyIcon className="h-3.5 w-3.5" /> : <span aria-hidden>🛍</span>}{badge}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate"><Stars value={r.rating} size="text-sm" /> · {dayLabel(r.createdAt)}{r.updatedAt ? " (edited)" : ""}{ownerUid && r.itemId && <> · <Link href={`/shop/${r.itemId}`} className="underline">{r.itemTitle}</Link></>}</p>
                  </div>
                </div>
                {r.text && <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-ink"><LinkedText text={r.text} /></p>}
                {r.reply && (
                  <div className="ml-4 mt-3 rounded-xl bg-paper p-3 text-sm sm:ml-6">
                    <p className="text-xs font-semibold text-crimson">Reply from the {owner} · {dayLabel(r.reply.at)}</p>
                    <p className="mt-1 whitespace-pre-line break-words text-ink"><LinkedText text={r.reply.text} /></p>
                  </div>
                )}
                {!r.reply && user && user.uid === (course ? r.ownerUid : sellerUid ?? r.ownerUid) && (
                  replyFor === r.id ? (
                    <form className="mt-3" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "reply", id: r.id, text: reply })) { setReplyFor(null); setReply(""); } }}>
                      <textarea className={field} rows={2} maxLength={REPLY_MAX} value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Your reply" />
                      <div className="mt-2 flex gap-2"><button disabled={busy} className="rounded-full bg-crimson px-4 py-1.5 font-ui text-xs font-semibold text-paper disabled:opacity-50">Reply</button><button type="button" className="rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold" onClick={() => setReplyFor(null)}>Cancel</button></div>
                    </form>
                  ) : <button type="button" className="mt-2 text-xs font-semibold text-crimson underline" onClick={() => { setReplyFor(r.id); setReply(""); }}>Reply as the {owner}</button>
                )}
              </li>
            ))}
          </ul>
          {error && !form && <p className="text-sm text-red-700" role="alert">{error}</p>}
        </div>
      </div>
    </section>
  );
}
