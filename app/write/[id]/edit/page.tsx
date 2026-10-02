"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { canPublish, getUserByUid, UserProfile } from "@/lib/users";
import { getNoteById, Note } from "@/lib/firestore-notes";
import { useSelfPublisher } from "@/lib/useSelfPublisher";
import { useMemberships } from "@/lib/useMemberships";
import NoteForm from "@/components/NoteForm";

export default function EditEntryPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useSelfPublisher();
  const { orgs } = useMemberships(user);
  const [note, setNote] = useState<Note | null | undefined>(undefined);
  const [orgProfile, setOrgProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (user) getNoteById(id).then(setNote).catch(() => setNote(null));
  }, [user, id]);

  // Editing for an organisation: its writer, or an org admin.
  const membership = note && user ? (orgs || []).find((o) => o.uid === note.authorUid && o.canPublish) : undefined;
  const asTeam = !!note && !!user && note.authorUid !== user.uid && !!membership && (membership.role === "admin" || note.writerUid === user.uid);
  useEffect(() => {
    if (asTeam && note?.authorUid) getUserByUid(note.authorUid).then(setOrgProfile).catch(() => setOrgProfile(null));
  }, [asTeam, note?.authorUid]);

  if (profile === undefined || note === undefined || orgs === undefined) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!profile || !user || !note || !(asTeam || (canPublish(profile) && note.authorUid === user.uid))) {
    return (
      <div className="px-6 py-24 text-center text-slate">
        That entry isn't yours to edit. <Link href="/write" className="text-crimson underline">Back to My journal</Link>
      </div>
    );
  }
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Link href="/write" className="block font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright">← My journal</Link>
      <h1 className="mt-4 font-display text-4xl">Edit entry</h1>
      <div className="mt-8">
        {asTeam ? (
          orgProfile ? <NoteForm noteId={id} initial={note} self={profile} org={{ profile: orgProfile }} /> : <p className="text-sm text-slate">Loading…</p>
        ) : (
          <NoteForm noteId={id} initial={note} self={profile} />
        )}
      </div>
    </section>
  );
}
