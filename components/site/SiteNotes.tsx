"use client";

import { useSite } from "./SiteContext";
import { useOwnNotes } from "./useOwnNotes";
import NoteCard from "./NoteCard";
import AuroraBand from "./AuroraBand";

export default function SiteNotes() {
  const { base, theme } = useSite();
  const notes = useOwnNotes();
  const aurora = theme === "aurora";
  return (
    <div>
      {aurora && <AuroraBand eyebrow="Notes"><h1 className="mt-3 font-display text-4xl sm:text-5xl">Notes</h1></AuroraBand>}
    <div className={`mx-auto max-w-5xl px-4 sm:px-6 ${aurora ? "pb-14 pt-8" : "py-14"}`}>
      {!aurora && <><p className="eyebrow">Notes</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Notes</h1></>}
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
    </div>
  );
}
