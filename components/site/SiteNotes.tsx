"use client";

import { isCrimsonTheme } from "@/lib/site-themes";
import { useSite } from "./SiteContext";
import { useOwnNotes } from "./useOwnNotes";
import NoteCard from "./NoteCard";
import SiteFeed from "./SiteFeed";
import AuroraBand from "./AuroraBand";

export default function SiteNotes() {
  const { base, theme } = useSite();
  const notes = useOwnNotes();
  const crimson = isCrimsonTheme(theme);
  return (
    <div>
      {crimson && <AuroraBand eyebrow="Notes"><h1 className="mt-3 font-display text-4xl sm:text-5xl">Notes</h1></AuroraBand>}
    <div className={`mx-auto px-4 sm:px-6 ${theme === "maroon" ? "max-w-3xl" : "max-w-5xl"} ${crimson ? "pb-14 pt-8" : "py-14"}`}>
      {!crimson && <><p className="eyebrow">Notes</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Notes</h1></>}
      {notes === undefined ? (
        <p className="mt-8 text-sm text-slate">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="mt-8 text-sm text-slate">Nothing published yet.</p>
      ) : theme === "maroon" ? (
        <SiteFeed notes={notes} />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => <NoteCard key={n.id} note={n} base={base} />)}
        </div>
      )}
    </div>
    </div>
  );
}
