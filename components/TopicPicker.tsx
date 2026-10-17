"use client";

import { useMemo, useState } from "react";
import { TOPICS, TOPIC_GROUPS, hashtag, matchTopic } from "@/lib/topics";

// Hashtag chips, grouped (lib/topics.ts), with a search box. Used by readers choosing their interests (/interests) and by writers
// choosing a journal's topics (NoteForm). Tapping a chip adds or removes it; at `max` the rest wait until one is removed.
export default function TopicPicker({ value, onChange, max, compact = false }: { value: string[]; onChange: (v: string[]) => void; max: number; compact?: boolean }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase().replace(/^#/, "");
  const shown = useMemo(() => {
    if (!query) return TOPICS;
    const hit = matchTopic(query);
    return TOPICS.filter((t) => t.slug === hit || t.label.toLowerCase().includes(query) || t.slug.includes(query) || (t.aliases ?? []).some((a) => a.includes(query.replace(/[^a-z0-9]/g, ""))));
  }, [query]);
  const full = value.length >= max;
  const toggle = (slug: string) => onChange(value.includes(slug) ? value.filter((s) => s !== slug) : full ? value : [...value, slug]);
  const chip = (slug: string, on: boolean) =>
    `rounded-full px-3 py-1.5 font-ui text-sm font-semibold transition-colors ${on ? "bg-crimson text-paper" : full ? "border border-rule text-slate/60" : "border border-rule text-ink hover:border-crimson"}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search topics, e.g. fintech or #MentalHealth" aria-label="Search topics" className="w-full max-w-sm rounded border border-rule bg-white px-3 py-2 text-sm" />
        <span className={`text-xs ${full ? "font-semibold text-crimson" : "text-slate"}`}>{value.length} of {max} chosen</span>
      </div>
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Chosen">
          {value.map((s) => <button type="button" key={s} onClick={() => toggle(s)} className={chip(s, true)} aria-pressed="true">{hashtag(s)} <span aria-hidden>×</span></button>)}
        </div>
      )}
      <div className={compact ? "mt-3 max-h-64 overflow-y-auto pr-1" : "mt-5"}>
        {TOPIC_GROUPS.map((g) => {
          const rows = shown.filter((t) => t.group === g);
          if (!rows.length) return null;
          return (
            <div key={g} className="mb-4">
              <p className="eyebrow">{g}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rows.map((t) => {
                  const on = value.includes(t.slug);
                  return <button type="button" key={t.slug} onClick={() => toggle(t.slug)} disabled={!on && full} aria-pressed={on} className={chip(t.slug, on)}>{hashtag(t.slug)}</button>;
                })}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <p className="text-sm text-slate">No topic matches “{q}”. Writers can still add it as their own hashtag.</p>}
      </div>
    </div>
  );
}
