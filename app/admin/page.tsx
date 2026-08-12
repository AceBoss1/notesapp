"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { collection, getCountFromServer, collectionGroup } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";

type Stats = {
  publishedCount: number;
  draftCount: number;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalComments: number;
  totalUsers: number;
};

export default function AdminDashboard() {
  const { user, loading } = useAdminAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [topByViews, setTopByViews] = useState<NoteWithComputed[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [allNotes, commentsCount, usersCount] = await Promise.all([
          getAllNotes({ publishedOnly: false }),
          getCountFromServer(collectionGroup(db, "comments")),
          getCountFromServer(collection(db, "users")),
        ]);

        const publishedCount = allNotes.filter((n) => n.status === "published").length;
        const draftCount = allNotes.filter((n) => n.status === "draft").length;
        const totalViews = allNotes.reduce((s, n) => s + (n.viewCount || 0), 0);
        const totalLikes = allNotes.reduce((s, n) => s + (n.likeCount || 0), 0);
        const totalShares = allNotes.reduce((s, n) => s + (n.shareCount || 0), 0);

        setStats({
          publishedCount,
          draftCount,
          totalViews,
          totalLikes,
          totalShares,
          totalComments: commentsCount.data().count,
          totalUsers: usersCount.data().count,
        });

        setTopByViews(
          [...allNotes]
            .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
            .slice(0, 5)
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load analytics — check Firestore rules are up to date."
        );
      }
    })();
  }, [user]);

  if (loading || !user) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  }

  const cards = stats
    ? [
        { label: "Published Notes", value: stats.publishedCount },
        { label: "Drafts", value: stats.draftCount },
        { label: "Total Views", value: stats.totalViews },
        { label: "Total Likes", value: stats.totalLikes },
        { label: "Total Shares", value: stats.totalShares },
        { label: "Total Comments", value: stats.totalComments },
        { label: "Registered Users", value: stats.totalUsers },
      ]
    : [];

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-14">
      <div className="flex items-center justify-between border-b-2 border-ink pb-4 flex-wrap gap-4">
        <div>
          <p className="eyebrow">Precheks Admin</p>
          <h1 className="font-display text-4xl mt-2">Dashboard</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/notes"
            className="border border-rule px-5 py-2.5 font-ui text-sm font-semibold hover:border-gold"
          >
            Manage Notes
          </Link>
          <Link
            href="/admin/notes/new"
            className="bg-gold text-ink font-ui font-semibold px-5 py-2.5 hover:bg-gold-deep hover:text-paper transition-colors"
          >
            + New Note
          </Link>
          <button
            onClick={() => signOut(auth)}
            className="border border-rule px-5 py-2.5 font-ui text-sm hover:border-gold"
          >
            Sign Out
          </button>
        </div>
      </div>

      {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

      {!stats ? (
        <p className="mt-8 text-slate">Loading analytics…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            {cards.map((c) => (
              <div key={c.label} className="border border-rule bg-card p-5">
                <p className="font-display text-3xl text-ink">{c.value}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-eyebrow text-slate">
                  {c.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <p className="eyebrow">Top Notes by Views</p>
            {topByViews.length === 0 ? (
              <p className="mt-4 text-sm text-slate">
                No notes yet.{" "}
                <Link href="/admin/seed" className="text-gold-deep underline">
                  Import your existing posts →
                </Link>
              </p>
            ) : (
              <div className="mt-5 divide-y divide-rule">
                {topByViews.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between py-4"
                  >
                    <div>
                      <p className="font-ui font-semibold text-ink">{n.title}</p>
                      <p className="text-xs text-slate mt-0.5 font-mono">
                        /{n.slug} ·{" "}
                        <span
                          className={
                            n.status === "published"
                              ? "text-gold-deep"
                              : "text-slate"
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
        </>
      )}
    </section>
  );
}
