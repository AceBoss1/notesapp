"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { collection, getCountFromServer, collectionGroup } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";

// Same shape as Precheks' own /admin dashboard, on purpose — same
// notes collection, same stats, same numbers. "Journal" is this app's
// label for the same data Precheks calls "Note."

type NoteStats = {
  publishedCount: number;
  draftCount: number;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
};

export default function AdminDashboard() {
  const { user, loading } = useAdminAuth();
  const [noteStats, setNoteStats] = useState<NoteStats | null>(null);
  const [topByViews, setTopByViews] = useState<NoteWithComputed[]>([]);
  const [notesError, setNotesError] = useState("");

  const [totalComments, setTotalComments] = useState<number | null>(null);
  const [commentsError, setCommentsError] = useState("");

  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [usersError, setUsersError] = useState("");

  // Each stat loads independently — one permission/rules issue on a
  // single query no longer blanks the whole dashboard.
  useEffect(() => {
    if (!user) return;

    getAllNotes({ publishedOnly: false })
      .then((allNotes) => {
        setNoteStats({
          publishedCount: allNotes.filter((n) => n.status === "published").length,
          draftCount: allNotes.filter((n) => n.status === "draft").length,
          totalViews: allNotes.reduce((s, n) => s + (n.viewCount || 0), 0),
          totalLikes: allNotes.reduce((s, n) => s + (n.likeCount || 0), 0),
          totalShares: allNotes.reduce((s, n) => s + (n.shareCount || 0), 0),
        });
        setTopByViews(
          [...allNotes].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 5)
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
  ];

  const anyError = [notesError, commentsError, usersError].filter(Boolean);

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
    </section>
  );
}
