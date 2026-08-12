"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { getNoteById, Note } from "@/lib/firestore-notes";
import NoteForm from "@/components/NoteForm";

export default function EditJournalPage({
  params,
}: {
  params: { id: string };
}) {
  const { user, loading } = useAdminAuth();
  const [note, setNote] = useState<Note | null | undefined>(undefined);

  useEffect(() => {
    if (user) {
      getNoteById(params.id).then(setNote);
    }
  }, [user, params.id]);

  if (loading || !user || note === undefined) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  }

  if (note === null) {
    return (
      <div className="px-6 py-24 text-center text-slate">
        Note not found.{" "}
        <Link href="/admin/journals" className="text-crimson-bright underline">
          Back to Journals
        </Link>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
      <Link
        href="/admin/journals"
        className="font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright"
      >
        ← All Journals
      </Link>
      <h1 className="font-display text-4xl mt-4">Edit Journal Entry</h1>
      <div className="mt-8">
        <NoteForm noteId={note.id} initial={note} />
      </div>
    </section>
  );
}
