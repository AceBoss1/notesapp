"use client";

import { useState } from "react";
import { isCrimsonTheme } from "@/lib/site-themes";
import { topicLabel, topicsOf } from "@/lib/topics";
import { useSite } from "./SiteContext";
import { useOwnNotes } from "./useOwnNotes";
import NoteCard from "./NoteCard";
import SiteFeed from "./SiteFeed";
import AuroraBand from "./AuroraBand";

export default function SiteNotes() {
  const { base, theme } = useSite();
  const notes = useOwnNotes();
  const crimson = isCrimsonTheme(theme);
  // Links to the topics they write about most (owner, 22 Oct 2026: from what the publisher actually posts), most used first.
  const [topic, setTopic] = useState("");
  const counts = new Map<string, number>();
  for (const n of notes ?? []) for (const t of topicsOf(n)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1] || topicLabel(a[0]).localeCompare(topicLabel(b[0]))).slice(0, 6);
  const shown = topic ? (notes ?? []).filter((n) => topicsOf(n).includes(topic)) : notes ?? [];
  return (
    <div>
      {crimson && <AuroraBand eyebrow="Notes"><h1 className="mt-3 font-display text-4xl sm:text-5xl">Notes</h1></AuroraBand>}
    <div className={`mx-auto px-4 sm:px-6 ${theme === "maroon" ? "max-w-3xl" : "max-w-5xl"} ${crimson ? "pb-14 pt-8" : "py-14"}`}>
      {!crimson && <><p className="eyebrow">Notes</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Notes</h1></>}
      {top.length > 1 && (
        <nav className="-mx-4 mt-6 flex gap-6 overflow-x-auto px-4 font-ui text-xs font-semibold uppercase tracking-[0.2em] text-ink sm:mx-0 sm:gap-10 sm:px-0" aria-label="Topics">
          {[["", "All"] as const, ...top.map(([t]) => [t, topicLabel(t)] as const)].map(([t, label]) => (
            <button key={t || "all"} type="button" onClick={() => setTopic(t)} aria-pressed={topic === t} className={`shrink-0 border-b-2 pb-1 ${topic === t ? "border-crimson" : "border-transparent hover:border-rule"}`}>{label}</button>
          ))}
        </nav>
      )}
      {notes === undefined ? (
        <p className="mt-8 text-sm text-slate">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="mt-8 text-sm text-slate">Nothing published yet.</p>
      ) : theme === "maroon" ? (
        <SiteFeed notes={shown} />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((n) => <NoteCard key={n.id} note={n} base={base} />)}
        </div>
      )}
    </div>
    </div>
  );
}
