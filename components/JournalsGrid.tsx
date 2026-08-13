"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";
import JournalRow from "./JournalRow";

// Renders Precheks' own published notes — same Firestore collection,
// same documents. "Journal" is a #NotesApp UI label, not a different
// dataset.
export default function JournalsGrid() {
  const [notes, setNotes] = useState<NoteWithComputed[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllNotes({ publishedOnly: true })
      .then(setNotes)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="card p-8 text-sm text-slate">
        Couldn't load journals yet — connect Firebase in{" "}
        <code className="font-mono text-crimson-bright">.env.local</code>{" "}
        (same project as precheks-site) to see live data here. ({error})
      </div>
    );
  }

  if (!notes) {
    return <div className="py-16 text-center text-sm text-slate">Loading journals…</div>;
  }

  if (notes.length === 0) {
    return (
      <div className="card p-8 text-sm text-slate">
        No published entries yet. Sign in as an admin and publish the
        first one from{" "}
        <Link href="/admin/journals/new" className="text-crimson underline underline-offset-2">
          the composer
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {notes.map((n) => (
        <JournalRow key={n.id} note={n} showAuthor />
      ))}
    </div>
  );
}
