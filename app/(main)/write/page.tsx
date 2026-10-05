"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { canPublish } from "@/lib/users";
import { deleteNote, getNotesByAuthorUid, getNotesByWriterUid, NoteWithComputed } from "@/lib/firestore-notes";
import { useSelfPublisher } from "@/lib/useSelfPublisher";
import { useMemberships } from "@/lib/useMemberships";
import BecomePublisher from "@/components/BecomePublisher";
import { toMillis } from "@/lib/dates";

// A publishing member's own journal: their entries (drafts + published),
// with write / edit / boost / delete.
export default function MyJournalPage() {
  const { user, profile, setProfile } = useSelfPublisher();
  const { orgs } = useMemberships(user);
  const teamOrgs = (orgs || []).filter((o) => o.canPublish);
  const [notes, setNotes] = useState<NoteWithComputed[] | null>(null);
  const [error, setError] = useState("");
  const mayWrite = !!profile && (canPublish(profile) || teamOrgs.length > 0);

  useEffect(() => {
    if (user && profile && orgs !== undefined && mayWrite) {
      // Own entries plus anything written for an organisation as a team member.
      Promise.all([canPublish(profile) ? getNotesByAuthorUid(user.uid) : Promise.resolve([]), teamOrgs.length ? getNotesByWriterUid(user.uid) : Promise.resolve([])])
        .then(([mine, team]) => {
          const seen = new Set<string>();
          setNotes([...mine, ...team].filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true))));
        })
        .catch((e) => setError(e.message));
    }
  }, [user, profile, orgs]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(n: NoteWithComputed) {
    if (!confirm(`Delete “${n.title}”? This can't be undone.`)) return;
    await deleteNote(n.id);
    setNotes((all) => (all || []).filter((x) => x.id !== n.id));
  }

  if (profile === undefined || orgs === undefined) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!profile || !mayWrite) {
    return <BecomePublisher user={user} profile={profile ?? null} onApplied={() => setProfile((p) => (p ? { ...p, tierRequest: { status: "pending", message: "", requestedAt: new Date().toISOString() } } : p))} />;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">@{profile.username}</p>
          <h1 className="mt-3 font-display text-4xl text-ink">My journal</h1>
        </div>
        <Link href="/write/new" className="btn-primary !px-5 !py-2.5 text-sm">+ New entry</Link>
      </div>
      <p className="mt-3 text-sm text-slate">
        Your published entries appear on your public profile, <Link href={`/u/${profile.username}`} className="text-crimson underline">/u/{profile.username}</Link>.
        List pages refresh within a few minutes.
      </p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {notes === null ? (
        <p className="mt-8 text-sm text-slate">Loading your entries…</p>
      ) : notes.length === 0 ? (
        <p className="mt-8 border border-rule px-4 py-6 text-sm text-slate">You haven't written anything yet — start with your first entry.</p>
      ) : (
        <ul className="mt-8 divide-y divide-rule border-y border-rule">
          {notes.map((n) => (
            <li key={n.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-ui text-sm font-bold text-ink">{n.title}</p>
                <p className="font-mono text-xs text-slate">
                  {n.writerUid && n.authorUid !== user?.uid ? `For ${n.author} · ` : ""}{n.status === "published" ? "Published" : "Draft"} · {toMillis(n.date) ? new Date(toMillis(n.date)).toLocaleDateString() : "—"} · 👁 {n.viewCount || 0}
                </p>
              </div>
              <div className="flex shrink-0 gap-4 text-sm font-semibold">
                {n.status === "published" && <Link href={`/journals/${n.slug}`} className="text-slate hover:text-ink">View</Link>}
                <Link href={`/write/${n.id}/edit`} className="text-crimson hover:text-ink">Edit</Link>
                {n.status === "published" && n.authorUid === user?.uid && <Link href={`/boost/${n.id}`} className="text-crimson hover:text-ink">Boost</Link>}
                <button onClick={() => remove(n)} className="text-red-700 hover:text-red-900">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
