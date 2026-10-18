"use client";

import { useEffect, useRef, useState } from "react";
import { useMember } from "@/lib/member-client";
import { hashtag } from "@/lib/topics";
import { MAX_SUBTOPICS, subtopicHashtag, type CategorySuggestion, type Subtopic, type SuggestedSub, type TopicSuggestion } from "@/lib/subtopics";

// Nana's suggestions from a title (POST /api/nana/suggest), a moment after the writer stops typing it. Nothing is added by itself: the
// writer taps what they want. Ones marked NEW don't exist yet; they're created when the journal, course or item is saved.
//   topics: journals and courses (topics and subtopics)   category: Market items (category and subcategory)
const WAIT_MS = 1200;
const MIN_TITLE = 6;
const Nnew = () => <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-ui text-[9px] font-bold tracking-wider text-amber-800">NEW</span>;
const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-ui text-[13px] font-semibold transition-colors ${on ? "bg-crimson text-paper" : "border border-rule bg-card text-ink hover:border-crimson"}`;

function useSuggestion<T>(kind: "journal" | "course" | "item", title: string, summary = "") {
  const { user } = useMember();
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [hiddenFor, setHiddenFor] = useState("");
  const asked = useRef("");
  const key = `${title.trim()}|${summary.trim().slice(0, 300)}`;
  const run = async (force = false) => {
    if (!user || title.trim().length < MIN_TITLE || (!force && asked.current === key)) return;
    asked.current = key;
    setBusy(true);
    try {
      const r = await fetch("/api/nana/suggest", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ kind, title, summary }) });
      if (r.ok) setData(await r.json());
    } catch {} finally { setBusy(false); }
  };
  useEffect(() => {
    if (title.trim().length < MIN_TITLE) return;
    const t = setTimeout(() => void run(), WAIT_MS);
    return () => clearTimeout(t);
  }, [key, user]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, busy, refresh: () => void run(true), hidden: hiddenFor === title.trim(), hide: () => setHiddenFor(title.trim()) };
}

const Panel = ({ title, busy, onRefresh, children }: { title: string; busy: boolean; onRefresh: () => void; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-crimson/25 bg-gradient-to-br from-card to-[#fdf2f5] p-4" aria-live="polite">
    <div className="flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 font-ui text-sm font-extrabold text-crimson"><span aria-hidden className="text-lg">✨</span>{title}</p>
      <button type="button" onClick={onRefresh} disabled={busy} className="text-xs text-slate underline disabled:opacity-50">{busy ? "Thinking…" : "Refresh"}</button>
    </div>
    {children}
  </div>
);

export function TopicSuggestions({ kind, title, summary, topics, subtopics, maxTopics, onChange }: {
  kind: "journal" | "course"; title: string; summary?: string; topics: string[]; subtopics: Subtopic[]; maxTopics: number;
  onChange: (next: { topics: string[]; subtopics: Subtopic[] }) => void;
}) {
  const { data, busy, refresh, hidden, hide } = useSuggestion<TopicSuggestion>(kind, title, summary);
  if (hidden || !data || (!data.topics.length && !data.subtopics.length)) return null;
  const hasSub = (s: Subtopic) => subtopics.some((x) => x.slug === s.slug && x.parent === s.parent);
  const addTopic = (t: string, cur = { topics, subtopics }) => (cur.topics.includes(t) || cur.topics.length >= maxTopics ? cur : { ...cur, topics: [...cur.topics, t] });
  const addSub = (s: SuggestedSub, cur = { topics, subtopics }) => {
    if (cur.subtopics.some((x) => x.slug === s.slug && x.parent === s.parent) || cur.subtopics.length >= MAX_SUBTOPICS) return cur;
    const withTopic = addTopic(s.parent, cur);
    if (!withTopic.topics.includes(s.parent)) return cur; // its topic doesn't fit
    return { ...withTopic, subtopics: [...withTopic.subtopics, { parent: s.parent, slug: s.slug, label: s.label }] };
  };
  const addAll = () => { let cur = { topics, subtopics }; for (const s of data.subtopics) cur = addSub(s, cur); for (const t of data.topics) cur = addTopic(t, cur); onChange(cur); };
  return (
    <Panel title={kind === "course" ? "Nana suggests topics for this course" : "Nana suggests, from your title"} busy={busy} onRefresh={refresh}>
      <p className="mt-1 text-xs text-slate">Tap to add. Ones marked NEW don&apos;t exist yet: they&apos;re created when you save.</p>
      {data.topics.length > 0 && <>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-slate">Topics</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {data.topics.map((t) => { const on = topics.includes(t); return <button key={t} type="button" aria-pressed={on} onClick={() => onChange(on ? { topics: topics.filter((x) => x !== t), subtopics: subtopics.filter((s) => s.parent !== t) } : addTopic(t))} className={chip(on)}>{on ? "✓" : "＋"} {hashtag(t)}</button>; })}
        </div>
      </>}
      {data.subtopics.length > 0 && <>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-slate">Subtopics</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {data.subtopics.map((s) => { const on = hasSub(s); return (
            <button key={`${s.parent}/${s.slug}`} type="button" aria-pressed={on} onClick={() => onChange(on ? { topics, subtopics: subtopics.filter((x) => !(x.slug === s.slug && x.parent === s.parent)) } : addSub(s))} className={chip(on)}>
              {on ? "✓" : "＋"} {hashtag(s.parent)} › {subtopicHashtag(s.label)} {s.isNew && <Nnew />}
            </button>
          ); })}
        </div>
      </>}
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={addAll} className="rounded-full bg-crimson px-4 py-2 font-ui text-sm font-bold text-paper hover:bg-crimson-bright">Add all</button>
        <button type="button" onClick={hide} className="text-sm font-semibold text-slate underline">Not now</button>
      </div>
    </Panel>
  );
}

// The chosen subtopics, under the topic picker: "#Tech › #ITSupport ×".
export function SubtopicChips({ subtopics, onRemove }: { subtopics: Subtopic[]; onRemove: (s: Subtopic) => void }) {
  if (!subtopics.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2" aria-label="Subtopics">
      {subtopics.map((s) => <button key={`${s.parent}/${s.slug}`} type="button" onClick={() => onRemove(s)} className={chip(true)}>{hashtag(s.parent)} › {subtopicHashtag(s.label)} <span aria-hidden>×</span></button>)}
    </div>
  );
}

export function CategorySuggestions({ title, category, subcategory, onPick }: { title: string; category: string; subcategory: string; onPick: (category: string, subcategory: string) => void }) {
  const { data, busy, refresh, hidden } = useSuggestion<CategorySuggestion>("item", title);
  if (hidden || !data?.options.length) return null;
  return (
    <Panel title="Nana suggests" busy={busy} onRefresh={refresh}>
      <div className="mt-2 space-y-2" role="radiogroup" aria-label="Suggested categories">
        {data.options.map((o) => {
          const on = o.category === category && (o.subcategory?.label ?? "") === subcategory;
          return (
            <button key={`${o.category}/${o.subcategory?.slug ?? ""}`} type="button" role="radio" aria-checked={on} onClick={() => onPick(o.category, o.subcategory?.label ?? "")}
              className={`flex w-full items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-left text-sm ${on ? "border-2 border-crimson font-semibold" : "border border-rule"}`}>
              <span className={`h-4 w-4 shrink-0 rounded-full ${on ? "border-4 border-crimson" : "border border-slate"}`} aria-hidden />
              <span>{o.category}{o.subcategory && <> › {o.subcategory.label}</>}</span>{o.subcategory?.isNew && <Nnew />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate">Or choose from all categories below.</p>
    </Panel>
  );
}
