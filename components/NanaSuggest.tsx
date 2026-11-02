"use client";

import { useEffect, useRef, useState } from "react";
import { useMember } from "@/lib/member-client";
import { hashtag } from "@/lib/topics";
import { MAX_SUBTOPICS, subtopicHashtag, type CategorySuggestion, type Subtopic, type SuggestedSub, type TopicSuggestion } from "@/lib/subtopics";
import type { CourseLineSuggestion } from "@/lib/courses";
import { SwipeChip, SwipeHint, UndoBar, useDismissed } from "@/components/SwipeChip";

// Nana's suggestions from a title (POST /api/nana/suggest), a moment after the writer stops typing it. Nothing is added by itself: the
// writer adopts what they want, by swiping a suggestion right (or tapping it), and swipes left (or taps ✕) to remove one they don't
// (components/SwipeChip.tsx). Removed ones stay removed for that title, in this browser, until Refresh. Ones marked NEW don't exist yet;
// they're created when the journal, course or item is saved.
//   topics: journals and courses (topics and subtopics)   category: Market items (category and subcategory)
//   course-lines: a course's "What learners will learn" and "Requirements" (asked for with a tap, not as you type)
const WAIT_MS = 1200;
const MIN_TITLE = 6;
const Nnew = () => <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-ui text-[9px] font-bold tracking-wider text-amber-800">NEW</span>;
const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-ui text-[13px] font-semibold transition-colors ${on ? "bg-crimson text-paper" : "border border-rule bg-card text-ink hover:border-crimson"}`;
type Kind = "journal" | "course" | "item" | "course-lines";

function useSuggestion<T>(kind: Kind, title: string, summary = "", auto = true) {
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
    if (!auto || title.trim().length < MIN_TITLE) return;
    const t = setTimeout(() => void run(), WAIT_MS);
    return () => clearTimeout(t);
  }, [key, user, auto]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, busy, refresh: () => void run(true), hidden: hiddenFor === title.trim(), hide: () => setHiddenFor(title.trim()), canAsk: !!user && title.trim().length >= MIN_TITLE };
}
// Removed suggestions are remembered per list and title.
const scopeOf = (kind: Kind, title: string) => `${kind}:${title.trim().toLowerCase().slice(0, 120)}`;

const Panel = ({ title, busy, onRefresh, children }: { title: string; busy: boolean; onRefresh: () => void; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-crimson/25 bg-gradient-to-br from-card to-[#fdf2f5] p-4" aria-live="polite">
    <div className="flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 font-ui text-sm font-extrabold text-crimson"><span aria-hidden className="text-lg">✨</span>{title}</p>
      <button type="button" onClick={onRefresh} disabled={busy} className="text-xs text-slate underline disabled:opacity-50">{busy ? "Thinking…" : "Refresh"}</button>
    </div>
    {children}
  </div>
);
const AllRemoved = () => <p className="mt-3 text-xs text-slate">You removed them all. Tap Refresh for fresh ideas.</p>;

export function TopicSuggestions({ kind, title, summary, topics, subtopics, maxTopics, onChange }: {
  kind: "journal" | "course"; title: string; summary?: string; topics: string[]; subtopics: Subtopic[]; maxTopics: number;
  onChange: (next: { topics: string[]; subtopics: Subtopic[] }) => void;
}) {
  const { data, busy, refresh, hidden, hide } = useSuggestion<TopicSuggestion>(kind, title, summary);
  const gone = useDismissed(scopeOf(kind, title));
  if (hidden || !data || (!data.topics.length && !data.subtopics.length)) return null;
  const tId = (t: string) => `t:${t}`, sId = (s: SuggestedSub) => `s:${s.parent}/${s.slug}`;
  const shownTopics = data.topics.filter((t) => !gone.isRemoved(tId(t)));
  const shownSubs = data.subtopics.filter((s) => !gone.isRemoved(sId(s)));
  const hasSub = (s: Subtopic) => subtopics.some((x) => x.slug === s.slug && x.parent === s.parent);
  const addTopic = (t: string, cur = { topics, subtopics }) => (cur.topics.includes(t) || cur.topics.length >= maxTopics ? cur : { ...cur, topics: [...cur.topics, t] });
  const addSub = (s: SuggestedSub, cur = { topics, subtopics }) => {
    if (cur.subtopics.some((x) => x.slug === s.slug && x.parent === s.parent) || cur.subtopics.length >= MAX_SUBTOPICS) return cur;
    const withTopic = addTopic(s.parent, cur);
    if (!withTopic.topics.includes(s.parent)) return cur; // its topic doesn't fit
    return { ...withTopic, subtopics: [...withTopic.subtopics, { parent: s.parent, slug: s.slug, label: s.label }] };
  };
  const addAll = () => { let cur = { topics, subtopics }; for (const s of shownSubs) cur = addSub(s, cur); for (const t of shownTopics) cur = addTopic(t, cur); onChange(cur); };
  const again = () => { gone.clear(); refresh(); };
  return (
    <Panel title={kind === "course" ? "Nana suggests topics for this course" : "Nana suggests, from your title"} busy={busy} onRefresh={again}>
      <p className="mt-1 text-xs text-slate">Swipe right or tap to add; swipe left or ✕ to remove. Ones marked NEW don&apos;t exist yet: they&apos;re created when you save.</p>
      <SwipeHint />
      {shownTopics.length > 0 && <>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-slate">Topics</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {shownTopics.map((t) => {
            const on = topics.includes(t);
            return <SwipeChip key={t} on={on} label={hashtag(t)} disabled={!on && topics.length >= maxTopics}
              onAdopt={() => onChange(addTopic(t))} onToggleOff={() => onChange({ topics: topics.filter((x) => x !== t), subtopics: subtopics.filter((s) => s.parent !== t) })}
              onRemove={() => { if (on) onChange({ topics: topics.filter((x) => x !== t), subtopics: subtopics.filter((s) => s.parent !== t) }); gone.remove(tId(t), hashtag(t)); }}>
              <span aria-hidden>{on ? "✓" : "＋"}</span> {hashtag(t)}
            </SwipeChip>;
          })}
        </div>
      </>}
      {shownSubs.length > 0 && <>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-slate">Subtopics</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {shownSubs.map((s) => {
            const on = hasSub(s), name = `${hashtag(s.parent)} › ${subtopicHashtag(s.label)}`;
            const off = () => onChange({ topics, subtopics: subtopics.filter((x) => !(x.slug === s.slug && x.parent === s.parent)) });
            return (
              <SwipeChip key={sId(s)} on={on} label={name} disabled={!on && subtopics.length >= MAX_SUBTOPICS}
                onAdopt={() => onChange(addSub(s))} onToggleOff={off} onRemove={() => { if (on) off(); gone.remove(sId(s), name); }}>
                <span aria-hidden>{on ? "✓" : "＋"}</span> {name} {s.isNew && <Nnew />}
              </SwipeChip>
            );
          })}
        </div>
      </>}
      {!shownTopics.length && !shownSubs.length && <AllRemoved />}
      <UndoBar last={gone.last} onUndo={gone.undo} />
      <div className="mt-3 flex items-center gap-3">
        {(shownTopics.length > 0 || shownSubs.length > 0) && <button type="button" onClick={addAll} className="rounded-full bg-crimson px-4 py-2 font-ui text-sm font-bold text-paper hover:bg-crimson-bright">Add all</button>}
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
  const gone = useDismissed(scopeOf("item", title));
  if (hidden || !data?.options.length) return null;
  const idOf = (o: CategorySuggestion["options"][number]) => `${o.category}/${o.subcategory?.slug ?? ""}`;
  const shown = data.options.filter((o) => !gone.isRemoved(idOf(o)));
  return (
    <Panel title="Nana suggests" busy={busy} onRefresh={() => { gone.clear(); refresh(); }}>
      <SwipeHint />
      <div className="mt-2 space-y-2" role="group" aria-label="Suggested categories">
        {shown.map((o) => {
          const on = o.category === category && (o.subcategory?.label ?? "") === subcategory;
          const name = `${o.category}${o.subcategory ? ` › ${o.subcategory.label}` : ""}`;
          return (
            <SwipeChip key={idOf(o)} wide on={on} label={name} onAdopt={() => onPick(o.category, o.subcategory?.label ?? "")} onRemove={() => gone.remove(idOf(o), name)}>
              <span className={`h-4 w-4 shrink-0 rounded-full ${on ? "border-4 border-paper" : "border border-slate"}`} aria-hidden />
              <span>{o.category}{o.subcategory && <> › {o.subcategory.label}</>}</span>{o.subcategory?.isNew && <Nnew />}
            </SwipeChip>
          );
        })}
      </div>
      {!shown.length && <AllRemoved />}
      <UndoBar last={gone.last} onUndo={gone.undo} />
      <p className="mt-2 text-xs text-slate">Or choose from all categories below.</p>
    </Panel>
  );
}

// Lines for "What learners will learn" and "Requirements", written by Nana from the course's title and summary. Asked for with a tap
// (one small AI call, kept an hour), then each line is swiped in (added to the box) or out.
export function CourseLineSuggestions({ title, summary, outcomes, requirements, maxOutcomes, maxRequirements, onAdd }: {
  title: string; summary: string; outcomes: string; requirements: string; maxOutcomes: number; maxRequirements: number;
  onAdd: (field: "outcomes" | "requirements", line: string) => void;
}) {
  const { data, busy, refresh, hidden, hide, canAsk } = useSuggestion<CourseLineSuggestion & { via?: string }>("course-lines", title, summary, false);
  const gone = useDismissed(scopeOf("course-lines", title));
  if (hidden) return null;
  if (!data) {
    return canAsk ? (
      <button type="button" onClick={refresh} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-crimson/30 bg-[#fdf2f5] px-3 py-1.5 font-ui text-xs font-bold text-crimson disabled:opacity-60">
        <span aria-hidden>✨</span>{busy ? "Nana is thinking…" : "Nana: suggest lines from the title and summary"}
      </button>
    ) : null;
  }
  const have = (box: string) => new Set(box.split("\n").map((x) => x.trim().toLowerCase()).filter(Boolean));
  const groups = [
    { field: "outcomes" as const, name: "What learners will learn", lines: data.outcomes, box: have(outcomes), max: maxOutcomes },
    { field: "requirements" as const, name: "Requirements", lines: data.requirements, box: have(requirements), max: maxRequirements },
  ].map((g) => ({ ...g, lines: g.lines.filter((l) => !gone.isRemoved(`${g.field}:${l}`)) }));
  const none = !data.outcomes.length && !data.requirements.length;
  return (
    <Panel title="Nana suggests lines for this course" busy={busy} onRefresh={() => { gone.clear(); refresh(); }}>
      {none ? <p className="mt-2 text-xs text-slate">Nana has no ideas for this one yet. Add a summary, then tap Refresh.</p> : <SwipeHint />}
      {groups.map((g) => g.lines.length > 0 && (
        <div key={g.field}>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-slate">{g.name}</p>
          <div className="mt-1.5 space-y-1.5">
            {g.lines.map((l) => {
              const on = g.box.has(l.toLowerCase());
              return (
                <SwipeChip key={l} wide on={on} label={l} disabled={!on && g.box.size >= g.max} onAdopt={() => onAdd(g.field, l)} onRemove={() => gone.remove(`${g.field}:${l}`, l)}>
                  <span aria-hidden>{on ? "✓" : "＋"}</span> <span className="min-w-0">{l}</span>
                </SwipeChip>
              );
            })}
          </div>
        </div>
      ))}
      {!none && groups.every((g) => !g.lines.length) && <AllRemoved />}
      <UndoBar last={gone.last} onUndo={gone.undo} />
      <div className="mt-3"><button type="button" onClick={hide} className="text-sm font-semibold text-slate underline">Not now</button></div>
    </Panel>
  );
}
