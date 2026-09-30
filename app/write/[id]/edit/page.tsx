"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { canPublish } from "@/lib/users";
import { getNoteById, Note } from "@/lib/firestore-notes";
import { useSelfPublisher } from "@/lib/useSelfPublisher";
import NoteForm from "@/components/NoteForm";

export default function EditEntryPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useSelfPublisher();
  const [note, setNote] = useState<Note | null | undefined>(undefined);

  useEffect(() => {
    if (user) getNoteById(id).then(setNote).catch(() => setNote(null));
  }, [user, id]);

  if (profile === undefined || note === undefined) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!profile || !user || !canPublish(profile) || !note || note.authorUid !== user.uid) {
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
        <NoteForm noteId={id} initial={note} self={profile} />
      </div>
    </section>
  );
}
