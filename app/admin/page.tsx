"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { collection, getCountFromServer, collectionGroup } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";

// Ported from Precheks' own expanded /admin dashboard — same notes
// collection, same stats, same charts. "Journal" is this app's label
// for the same data Precheks calls "Note."

type NoteStats = {
  publishedCount: number;
  draftCount: number;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
};

type MonthBucket = { key: string; label: string; count: number };
type TaxonomyRow = { label: string; views: number; count: number };

const MONTHS_TO_SHOW = 6;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastNMonths(n: number): MonthBucket[] {
  const now = new Date();
  const out: MonthBucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: monthKey(d),
      label: d.toLocaleString("en-US", { month: "short" }) + " " + String(d.getFullYear()).slice(2),
      count: 0,
    });
  }
  return out;
}

function aggregateTaxonomy(
  notes: NoteWithComputed[],
  field: "categories" | "tags",
  limit = 6
): TaxonomyRow[] {
  const map = new Map<string, TaxonomyRow>();
  notes.forEach((n) => {
    const values = field === "categories" ? n.categories : n.tags;
    (values || []).forEach((label) => {
      const entry = map.get(label) || { label, views: 0, count: 0 };
      entry.views += n.viewCount || 0;
      entry.count += 1;
      map.set(label, entry);
    });
  });
  return Array.from(map.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

// Per-note comment counts. One getCountFromServer per note — fine at
// today's note volume (tens of notes). If the note count grows into the
// hundreds, denormalize a `commentCount` field onto each note doc on
// comment create/delete instead, and read that directly.
async function getCommentCounts(notes: NoteWithComputed[]): Promise<Record<string, number>> {
  const entries = await Promise.all(
    notes.map(async (n) => {
      try {
        const snap = await getCountFromServer(collection(db, "notes", n.id, "comments"));
        return [n.id, snap.data().count] as const;
      } catch {
        return [n.id, 0] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}

export default function AdminDashboard() {
  const { user, loading } = useAdminAuth();
  const [noteStats, setNoteStats] = useState<NoteStats | null>(null);
  const [allNotes, setAllNotes] = useState<NoteWithComputed[]>([]);
  const [topByViews, setTopByViews] = useState<NoteWithComputed[]>([]);
  const [notesError, setNotesError] = useState("");

  const [totalComments, setTotalComments] = useState<number | null>(null);
  const [commentsError, setCommentsError] = useState("");

  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [usersError, setUsersError] = useState("");

  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [commentCountsError, setCommentCountsError] = useState("");

  // Each stat loads independently — one permission/rules issue on a
  // single query no longer blanks the whole dashboard.
  useEffect(() => {
    if (!user) return;

    getAllNotes({ publishedOnly: false })
      .then((notes) => {
        setAllNotes(notes);
        setNoteStats({
          publishedCount: notes.filter((n) => n.status === "published").length,
          draftCount: notes.filter((n) => n.status === "draft").length,
          totalViews: notes.reduce((s, n) => s + (n.viewCount || 0), 0),
          totalLikes: notes.reduce((s, n) => s + (n.likeCount || 0), 0),
          totalShares: notes.reduce((s, n) => s + (n.shareCount || 0), 0),
        });
        setTopByViews(
          [...notes].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 5)
        );
      })
      .catch((err) => {
        console.error("Dashboard: getAllNotes failed:", err);
        setNotesError("Couldn't load journals — check firestore.rules covers /notes.");
      });

    getCountFromServer(collectionGroup(db, "comments"))
      .then((snap) => setTotalComments(snap.data().count))
      .catch((err) => {
        console.error("Dashboard: comments count failed:", err);
        setCommentsError("Couldn't load comment count — Firestore rules likely out of date.");
      });

    getCountFromServer(collection(db, "users"))
      .then((snap) => setTotalUsers(snap.data().count))
      .catch((err) => {
        console.error("Dashboard: users count failed:", err);
        setUsersError("Couldn't load user count — Firestore rules likely out of date.");
      });
  }, [user]);

  // Per-note comment counts, fetched once notes are in — powers "Most
  // Commented" and feeds into the engagement rate calculation.
  useEffect(() => {
    if (allNotes.length === 0) return;
    const published = allNotes.filter((n) => n.status === "published");
    getCommentCounts(published)
      .then(setCommentCounts)
      .catch((err) => {
        console.error("Dashboard: per-note comment counts failed:", err);
        setCommentCountsError("Couldn't load per-journal comment counts.");
      });
  }, [allNotes]);

  const publishedNotes = useMemo(
    () => allNotes.filter((n) => n.status === "published"),
    [allNotes]
  );

  const bestEngagement = useMemo(() => {
    return publishedNotes
      .map((n) => {
        const comments = commentCounts[n.id] || 0;
        const views = n.viewCount || 0;
        const rate = (n.likeCount || 0) + (n.shareCount || 0) + comments;
        return { note: n, comments, views, rate: views > 0 ? rate / views : 0 };
      })
      .filter((x) => x.views > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);
  }, [publishedNotes, commentCounts]);

  const mostCommented = useMemo(() => {
    return publishedNotes
      .map((n) => ({ note: n, comments: commentCounts[n.id] || 0 }))
      .filter((x) => x.comments > 0)
      .sort((a, b) => b.comments - a.comments)
      .slice(0, 5);
  }, [publishedNotes, commentCounts]);

  const topCategories = useMemo(() => aggregateTaxonomy(publishedNotes, "categories"), [publishedNotes]);
  const topTags = useMemo(() => aggregateTaxonomy(publishedNotes, "tags"), [publishedNotes]);

  const monthlyPublished = useMemo(() => {
    const buckets = lastNMonths(MONTHS_TO_SHOW);
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    publishedNotes.forEach((n) => {
      const d = new Date(n.date);
      if (isNaN(d.getTime())) return;
      const bucket = byKey.get(monthKey(d));
      if (bucket) bucket.count += 1;
    });
    return buckets;
  }, [publishedNotes]);

  const avgReadingTime = useMemo(() => {
    if (publishedNotes.length === 0) return null;
    const sum = publishedNotes.reduce((s, n) => s + (n.reading_time || 0), 0);
    return Math.round((sum / publishedNotes.length) * 10) / 10;
  }, [publishedNotes]);

  if (loading || !user) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  }

  const cards = [
    { label: "Published Journals", value: noteStats?.publishedCount, error: notesError },
    { label: "Drafts", value: noteStats?.draftCount, error: notesError },
    { label: "Total Views", value: noteStats?.totalViews, error: notesError },
    { label: "Total Likes", value: noteStats?.totalLikes, error: notesError },
    { label: "Total Shares", value: noteStats?.totalShares, error: notesError },
    { label: "Total Comments", value: totalComments ?? undefined, error: commentsError },
    { label: "Registered Users", value: totalUsers ?? undefined, error: usersError },
    {
      label: "Avg Read Time (min)",
      value: avgReadingTime ?? undefined,
      error: notesError,
    },
  ];

  const anyError = [notesError, commentsError, usersError].filter(Boolean);
  const maxMonthCount = Math.max(1, ...monthlyPublished.map((m) => m.count));
  const maxCategoryViews = Math.max(1, ...topCategories.map((c) => c.views));
  const maxTagViews = Math.max(1, ...topTags.map((t) => t.views));

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-14">
      <div className="flex items-center justify-between border-b-2 border-ink pb-4 flex-wrap gap-4">
        <div>
          <p className="eyebrow">#NotesApp Admin</p>
          <h1 className="font-display text-4xl mt-2">Dashboard</h1>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/admin/journals"
            className="border border-rule px-5 py-2.5 font-ui text-sm font-semibold hover:border-crimson"
          >
            Manage Journals
          </Link>
          <Link
            href="/admin/users"
            className="border border-rule px-5 py-2.5 font-ui text-sm font-semibold hover:border-crimson"
          >
            Users
          </Link>
          <Link
            href="/admin/settings"
            className="border border-rule px-5 py-2.5 font-ui text-sm font-semibold hover:border-crimson"
          >
            Settings
          </Link>
          <Link
            href="/admin/journals/new"
            className="bg-crimson text-paper font-ui font-semibold px-5 py-2.5 hover:bg-crimson-bright transition-colors"
          >
            + New Journal Entry
          </Link>
          <button
            onClick={() => signOut(auth)}
            className="border border-rule px-5 py-2.5 font-ui text-sm hover:border-crimson"
          >
            Sign Out
          </button>
        </div>
      </div>

      {anyError.length > 0 && (
        <div className="mt-6 border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            Some stats failed to load:
          </p>
          <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
            {[...new Set(anyError)].map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-700">
            Most likely cause: firestore.rules in Firebase Console doesn't
            match the current version yet — redeploy it, then refresh.
          </p>
        </div>
      )}

      {/* ── Top-line stats ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
        {cards.map((c) => (
          <div key={c.label} className="border border-rule bg-card p-5">
            <p className="font-display text-3xl text-ink">
              {c.error ? "—" : c.value ?? "…"}
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-eyebrow text-slate">
              {c.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Top Journals by Views ─────────────────────────────── */}
      <div className="mt-12">
        <p className="eyebrow">Top Journals by Views</p>
        {notesError ? (
          <p className="mt-4 text-sm text-red-700">{notesError}</p>
        ) : topByViews.length === 0 ? (
          <p className="mt-4 text-sm text-slate">
            {noteStats ? (
              <>
                No journal entries yet.{" "}
                <Link href="/admin/journals/new" className="text-crimson-bright underline">
                  Write the first one →
                </Link>
              </>
            ) : (
              "Loading…"
            )}
          </p>
        ) : (
          <div className="mt-5 divide-y divide-rule">
            {topByViews.map((n) => (
              <div key={n.id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-ui font-semibold text-ink">{n.title}</p>
                  <p className="text-xs text-slate mt-0.5 font-mono">
                    /{n.slug} ·{" "}
                    <span
                      className={
                        n.status === "published" ? "text-crimson-bright" : "text-slate"
                      }
                    >
                      {n.status}
                    </span>
                  </p>
                </div>
                <div className="flex gap-5 text-xs font-mono text-slate flex-shrink-0">
                  <span>👁 {n.viewCount || 0}</span>
                  <span>♥ {n.likeCount || 0}</span>
                  <span>↗ {n.shareCount || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Best Engagement ───────────────────────────────────── */}
      <div className="mt-12">
        <p className="eyebrow">Best Engagement</p>
        <p className="mt-1 text-xs text-slate">
          (likes + shares + comments) ÷ views — what resonates, not just what gets clicks.
        </p>
        {bestEngagement.length === 0 ? (
          <p className="mt-4 text-sm text-slate">
            {publishedNotes.length ? "No journals with views yet." : "Loading…"}
          </p>
        ) : (
          <div className="mt-5 divide-y divide-rule">
            {bestEngagement.map(({ note, comments, rate }) => (
              <div key={note.id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-ui font-semibold text-ink">{note.title}</p>
                  <p className="text-xs text-slate mt-0.5 font-mono">/{note.slug}</p>
                </div>
                <div className="flex items-center gap-5 flex-shrink-0">
                  <div className="flex gap-4 text-xs font-mono text-slate">
                    <span>👁 {note.viewCount || 0}</span>
                    <span>♥ {note.likeCount || 0}</span>
                    <span>↗ {note.shareCount || 0}</span>
                    <span>💬 {comments}</span>
                  </div>
                  <span className="font-display text-xl text-crimson-bright w-16 text-right">
                    {Math.round(rate * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Most Commented ────────────────────────────────────── */}
      <div className="mt-12">
        <p className="eyebrow">Most Commented</p>
        {commentCountsError ? (
          <p className="mt-4 text-sm text-red-700">{commentCountsError}</p>
        ) : mostCommented.length === 0 ? (
          <p className="mt-4 text-sm text-slate">
            {publishedNotes.length ? "No comments yet." : "Loading…"}
          </p>
        ) : (
          <div className="mt-5 divide-y divide-rule">
            {mostCommented.map(({ note, comments }) => (
              <div key={note.id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-ui font-semibold text-ink">{note.title}</p>
                  <p className="text-xs text-slate mt-0.5 font-mono">/{note.slug}</p>
                </div>
                <span className="font-display text-xl text-ink flex-shrink-0">
                  💬 {comments}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Top Categories / Top Tags ─────────────────────────── */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-10">
        <div>
          <p className="eyebrow">Top Categories</p>
          <p className="mt-1 text-xs text-slate">By total views across published journals.</p>
          {topCategories.length === 0 ? (
            <p className="mt-4 text-sm text-slate">{publishedNotes.length ? "No categories yet." : "Loading…"}</p>
          ) : (
            <div className="mt-5 space-y-3">
              {topCategories.map((c) => (
                <div key={c.label}>
                  <div className="flex items-center justify-between text-xs font-mono text-slate mb-1">
                    <span className="text-ink font-ui font-semibold text-sm normal-case">{c.label}</span>
                    <span>{c.views} views · {c.count} journals</span>
                  </div>
                  <div className="h-1.5 bg-rule w-full">
                    <div
                      className="h-1.5 bg-crimson"
                      style={{ width: `${Math.max(4, (c.views / maxCategoryViews) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="eyebrow">Top Tags</p>
          <p className="mt-1 text-xs text-slate">By total views across published journals.</p>
          {topTags.length === 0 ? (
            <p className="mt-4 text-sm text-slate">{publishedNotes.length ? "No tags yet." : "Loading…"}</p>
          ) : (
            <div className="mt-5 space-y-3">
              {topTags.map((t) => (
                <div key={t.label}>
                  <div className="flex items-center justify-between text-xs font-mono text-slate mb-1">
                    <span className="text-ink font-ui font-semibold text-sm normal-case">{t.label}</span>
                    <span>{t.views} views · {t.count} journals</span>
                  </div>
                  <div className="h-1.5 bg-rule w-full">
                    <div
                      className="h-1.5 bg-crimson-bright"
                      style={{ width: `${Math.max(4, (t.views / maxTagViews) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Journals Published Over Time ──────────────────────── */}
      <div className="mt-12 mb-4">
        <p className="eyebrow">Journals Published — Last {MONTHS_TO_SHOW} Months</p>
        <div className="mt-6 flex items-end gap-4 h-32 border-b border-rule pb-0">
          {monthlyPublished.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-xs font-mono text-slate mb-1">{m.count || ""}</span>
              <div
                title={`${m.label}: ${m.count} journal${m.count === 1 ? "" : "s"}`}
                className="w-full bg-crimson hover:bg-crimson-bright transition-colors"
                style={{ height: `${Math.max(4, (m.count / maxMonthCount) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          {monthlyPublished.map((m) => (
            <span key={m.key} className="flex-1 text-center text-[11px] font-mono uppercase tracking-eyebrow text-slate">
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
