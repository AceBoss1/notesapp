"use client";

import LinkedText from "@/components/LinkedText";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import { REVIEW_MAX, REPLY_MAX, stars, type RatingSummary, type Review } from "@/lib/reviews";

type Data = { reviews: Review[]; summary: RatingSummary; canReview: boolean; mine: Review | null };
const field = "mt-1 w-full rounded-lg border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

export function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  return <span className={`${size} tracking-tight text-amber-500`} aria-label={`${value} out of 5 stars`}>{stars(value)}</span>;
}

// Reviews of one store item (`itemId`) or across a seller's items (`ownerUid`, read only). Only people who bought and received an item can
// review it (checked on the server); the seller can reply once to each review.
export default function ReviewsPanel({ itemId, ownerUid, user, sellerUid, title = "Reviews" }: { itemId?: string; ownerUid?: string; user: User | null | undefined; sellerUid?: string; title?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const qs = itemId ? `itemId=${encodeURIComponent(itemId)}` : `ownerUid=${encodeURIComponent(ownerUid ?? "")}`;

  const call = useCallback(async (body?: Record<string, unknown>) => {
    const headers: Record<string, string> = user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {};
    const r = body ? await fetch("/api/store/reviews", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) }) : await fetch(`/api/store/reviews?${qs}`, { headers });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user, qs]);
  const load = useCallback(() => call().then(setData).catch(() => setData({ reviews: [], summary: { count: 0, average: 0 }, canReview: false, mine: null })), [call]);
  useEffect(() => { if (user !== undefined) load(); }, [user, load]);

  const run = async (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try { await call(body); await load(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  };

  if (!data) return null;
  const { reviews, summary, canReview, mine } = data;
  if (!reviews.length && !canReview) {
    return ownerUid ? null : (
      <div className="card mt-10 p-6"><h2 className="font-display text-xl text-ink">{title}</h2><p className="mt-2 text-sm text-slate">No reviews yet. Only people who bought and received the item can review it.</p></div>
    );
  }
  const form = canReview && (!mine || editing);
  return (
    <div className="card mt-10 p-6" id="reviews">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl text-ink">{title}</h2>
        {summary.count > 0 && <p className="text-sm text-slate"><Stars value={summary.average} size="text-lg" /> <strong className="text-ink">{summary.average.toFixed(1)}</strong> · {summary.count} review{summary.count === 1 ? "" : "s"}</p>}
      </div>

      {canReview && mine && !editing && <p className="mt-3 text-sm text-slate">You reviewed this. <button type="button" className="font-semibold text-crimson underline" onClick={() => { setEditing(true); setRating(mine.rating); setText(mine.text); }}>Edit</button> · <button type="button" className="font-semibold text-crimson underline" disabled={busy} onClick={() => run({ action: "delete", id: mine.id })}>Remove</button></p>}
      {form && (
        <form className="mt-4 rounded-xl bg-paper p-4" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "review", itemId, rating, text })) { setEditing(false); setRating(0); setText(""); } }}>
          <p className="font-ui text-sm font-semibold text-ink">{mine ? "Edit your review" : "You bought this. How was it?"}</p>
          <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(n)} className={`text-3xl leading-none ${n <= rating ? "text-amber-500" : "text-rule"}`}>★</button>)}
          </div>
          <label className="mt-3 block text-xs text-slate">Your review (optional)<textarea className={field} rows={3} maxLength={REVIEW_MAX} value={text} onChange={(e) => setText(e.target.value)} /></label>
          {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button disabled={busy || !rating} className="rounded-full bg-crimson px-5 py-2 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50">{mine ? "Save" : "Post review"}</button>
            {editing && <button type="button" className="rounded-full border border-rule px-4 py-2 font-ui text-xs font-semibold" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </form>
      )}

      <ul className="mt-5 divide-y divide-rule">
        {reviews.map((r) => (
          <li key={r.id} className="py-4">
            <div className="flex items-center gap-3">
              <Avatar src={r.avatar} alt={r.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-ui text-sm font-bold text-ink">{r.username ? <Link href={`/u/${r.username}`} className="hover:underline">{r.name}</Link> : r.name}<NameBadgeIcons username={r.username} size={13} /></p>
                <p className="text-xs text-slate"><Stars value={r.rating} size="text-sm" /> · {dayLabel(r.createdAt)}{r.updatedAt ? " (edited)" : ""} · <span className="text-emerald-700">Verified buyer</span>{ownerUid && r.itemId && <> · <Link href={`/shop/${r.itemId}`} className="underline">{r.itemTitle}</Link></>}</p>
              </div>
            </div>
            {r.text && <p className="mt-2 whitespace-pre-line break-words text-sm text-ink"><LinkedText text={r.text} /></p>}
            {r.reply && <div className="mt-3 rounded-lg border-l-2 border-crimson bg-paper p-3 text-sm"><p className="text-xs font-semibold text-crimson">Reply from the seller · {dayLabel(r.reply.at)}</p><p className="mt-1 whitespace-pre-line break-words text-slate"><LinkedText text={r.reply.text} /></p></div>}
            {!r.reply && user && user.uid === (sellerUid ?? r.ownerUid) && (
              replyFor === r.id ? (
                <form className="mt-3" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "reply", id: r.id, text: reply })) { setReplyFor(null); setReply(""); } }}>
                  <textarea className={field} rows={2} maxLength={REPLY_MAX} value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Your reply" />
                  <div className="mt-2 flex gap-2"><button disabled={busy} className="rounded-full bg-crimson px-4 py-1.5 font-ui text-xs font-semibold text-paper disabled:opacity-50">Reply</button><button type="button" className="rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold" onClick={() => setReplyFor(null)}>Cancel</button></div>
                </form>
              ) : <button type="button" className="mt-2 text-xs font-semibold text-crimson underline" onClick={() => { setReplyFor(r.id); setReply(""); }}>Reply as the seller</button>
            )}
          </li>
        ))}
      </ul>
      {error && !form && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
