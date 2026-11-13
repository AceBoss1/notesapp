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
      {/* Each main category is a dropdown of its topics (owner, 12 Nov 2026), so the list stays short on a phone: closed until opened,
          except the one holding the topic being read. */}
      <div className="mt-4 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">
        {TOPIC_GROUPS.map((g) => {
          const rows = Array.from(counts.entries()).filter(([t]) => topicOf(t)?.group === g && !mine.includes(t)).sort((a, b) => b[1] - a[1]);
          if (!rows.length) return null;
          const holds = rows.some(([t]) => t === selectedTopic);
          const total = rows.reduce((n, [, c]) => n + c, 0);
          return (
            <details key={`${g}-${holds}`} open={holds} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-field/60">
                <span className="flex-1">
                  <span className="eyebrow block !text-[11px]">{g}</span>
                  <span className="text-xs text-slate">{rows.length} {rows.length === 1 ? "topic" : "topics"} · {total} {total === 1 ? "journal" : "journals"}{holds ? ` · ${hashtag(selectedTopic!)}` : ""}</span>
                </span>
                <span className="text-slate transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
              </summary>
              <div className="flex flex-wrap gap-2 px-4 pb-4">{rows.map(([t, c]) => chip(t, hashtag(t), c))}</div>
            </details>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((n) => (
          <JournalRow key={n.id} note={n} showAuthor />
        ))}
      </div>
    </div>
  );
}
