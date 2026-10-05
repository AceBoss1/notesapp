"use client";

import { useSite } from "./SiteContext";
import { useOwnNotes } from "./useOwnNotes";
import NoteCard from "./NoteCard";

export default function SiteNotes() {
  const { base } = useSite();
  const notes = useOwnNotes();
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Notes</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Notes</h1>
      {notes === undefined ? (
        <p className="mt-8 text-sm text-slate">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="mt-8 text-sm text-slate">Nothing published yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => <NoteCard key={n.id} note={n} base={base} />)}
        </div>
      )}
    </div>
  );
}
