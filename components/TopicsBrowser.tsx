"use client";

import { NoteWithComputed } from "@/lib/firestore-notes";
import JournalRow from "@/components/JournalRow";

export default function TopicsBrowser({
  notes,
  selectedTopic,
  onSelectTopic,
}: {
  notes: NoteWithComputed[];
  selectedTopic: string | null;
  onSelectTopic: (topic: string | null) => void;
}) {
  const counts = new Map<string, number>();
  notes.forEach((n) => {
    (n.categories || []).forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));
  });
  const topics = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const filtered = selectedTopic
    ? notes.filter((n) => n.categories.includes(selectedTopic))
    : notes;

  if (topics.length === 0) {
    return <p className="text-sm text-slate">No topics yet — categories show up here once entries are published.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelectTopic(null)}
          className={`rounded-full px-4 py-1.5 font-ui text-sm font-semibold transition-colors ${
            selectedTopic === null
              ? "bg-crimson text-paper"
              : "border border-rule text-ink hover:border-crimson"
          }`}
        >
          All topics
        </button>
        {topics.map(([topic, count]) => (
          <button
            key={topic}
            onClick={() => onSelectTopic(topic)}
            className={`rounded-full px-4 py-1.5 font-ui text-sm font-semibold transition-colors ${
              selectedTopic === topic
                ? "bg-crimson text-paper"
                : "border border-rule text-ink hover:border-crimson"
            }`}
          >
            {topic} <span className="opacity-60">· {count}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((n) => (
          <JournalRow key={n.id} note={n} showAuthor />
        ))}
      </div>
    </div>
  );
}
