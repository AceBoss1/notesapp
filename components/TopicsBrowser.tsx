"use client";

import { NoteWithComputed } from "@/lib/firestore-notes";
import JournalRow from "@/components/JournalRow";
import { TOPIC_GROUPS, hashtag, topicOf, topicsOf } from "@/lib/topics";

// The Topics tab: every topic that has journals, grouped as in lib/topics.ts, the reader's interests first. `selectedTopic` is a slug.
export default function TopicsBrowser({
  notes,
  interests = [],
  selectedTopic,
  onSelectTopic,
}: {
  notes: NoteWithComputed[];
  interests?: string[];
  selectedTopic: string | null;
  onSelectTopic: (topic: string | null) => void;
}) {
  const counts = new Map<string, number>();
  notes.forEach((n) => topicsOf(n).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  const filtered = selectedTopic ? notes.filter((n) => topicsOf(n).includes(selectedTopic)) : notes;

  if (counts.size === 0) {
    return <p className="text-sm text-slate">No topics yet: they show up here once journals are published.</p>;
  }
  const chip = (slug: string | null, label: string, count?: number) => (
    <button
      key={slug ?? "all"}
      onClick={() => onSelectTopic(slug)}
      aria-pressed={selectedTopic === slug}
      className={`rounded-full px-4 py-1.5 font-ui text-sm font-semibold transition-colors ${
        selectedTopic === slug ? "bg-crimson text-paper" : "border border-rule text-ink hover:border-crimson"
      }`}
    >
      {label} {count !== undefined && <span className="opacity-60">· {count}</span>}
    </button>
  );
  const mine = interests.filter((t) => counts.has(t));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {chip(null, "All topics")}
        {mine.map((t) => chip(t, `★ ${hashtag(t)}`, counts.get(t)))}
      </div>
      {TOPIC_GROUPS.map((g) => {
        const rows = Array.from(counts.entries()).filter(([t]) => topicOf(t)?.group === g && !mine.includes(t)).sort((a, b) => b[1] - a[1]);
        if (!rows.length) return null;
        return (
          <div key={g} className="mt-4">
            <p className="eyebrow">{g}</p>
            <div className="mt-2 flex flex-wrap gap-2">{rows.map(([t, c]) => chip(t, hashtag(t), c))}</div>
          </div>
        );
      })}

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((n) => (
          <JournalRow key={n.id} note={n} showAuthor />
        ))}
      </div>
    </div>
  );
}
