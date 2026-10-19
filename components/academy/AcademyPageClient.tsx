"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DiscoveryHero from "@/components/DiscoveryHero";
import Shelf from "@/components/Shelf";
import AdSlot from "@/components/AdSlot";
import CourseCard, { courseCardOf } from "@/components/CourseCard";
import { hashtag } from "@/lib/topics";
import { subtopicHashtag } from "@/lib/subtopics";
import { useInterests } from "@/lib/interests-client";
import { useMember } from "@/lib/member-client";
import { byForYou, byMostViewed, byRecent, shelves, type Shelfable } from "@/lib/discovery";
import { courseHref, lessonHref, progressOf, type CourseListing, type Enrolment } from "@/lib/courses";
import { myEnrolments, useAcademy } from "@/lib/courses-client";

// Notes Academy (/academy): every published course, free and paid, arranged like Journals and Notes Market (lib/discovery.ts): the
// learner's own courses to continue, then their interests, what most people opened this week, and what's new. On a computer a
// Topics list (with how many courses each topic and subtopic has) and Level and Price filters sit beside them; on a phone, chips.
type Tab = "all" | "foryou" | "viewed" | "new";
const TABS: { id: Tab; label: string }[] = [{ id: "all", label: "All" }, { id: "foryou", label: "For you" }, { id: "viewed", label: "Most viewed" }, { id: "new", label: "New" }];
type Shelved = Omit<CourseListing, "viewsWeek"> & Shelfable;
const grid = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

// What comes next (docs/COURSES.md). Amounts are set by the owner in Admin → Pricing.
const ACADEMY_NEXT = [
  { t: "Quizzes", d: "Short quizzes in a lesson or at the end, with a pass mark the tutor sets." },
  { t: "For organisations", d: "Enterprise courses for your team or customers, under your brand, with cohorts and bulk invites. Talk to us." },
];
type Level = "" | "beginner" | "intermediate" | "advanced";
type Price = "" | "free" | "paid";

export default function AcademyPageClient() {
  const courses = useAcademy();
  const { user, profile } = useMember();
  const { interests, signedIn } = useInterests();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("");
  const [price, setPrice] = useState<Price>("");
  const [mine, setMine] = useState<Enrolment[]>([]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t0 = p.get("tab");
    if (TABS.some((t) => t.id === t0)) setTab(t0 as Tab);
    if (p.get("topic")) setTopic(p.get("topic"));
  }, []);
  useEffect(() => { if (user) myEnrolments(user.uid).then(setMine); else setMine([]); }, [user]);

  const q = query.trim().toLowerCase();
  const anyWeekly = (courses ?? []).some((c) => c.viewsWeek > 0);
  const shelved = useMemo<Shelved[]>(() => (courses ?? [])
    .filter((c) => (!topic || c.topics.includes(topic)) && (!sub || (c.subtopics ?? []).some((x) => x.parent === topic && x.slug === sub))
      && (!level || c.level === level) && (!price || (price === "paid") === (c.priceKobo > 0))
      && (!q || c.title.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q) || c.ownerName.toLowerCase().includes(q) || c.ownerUsername.includes(q)))
    .map((c) => ({ ...c, viewsWeek: anyWeekly ? c.viewsWeek : undefined })), [courses, topic, sub, level, price, q, anyWeekly]);
  // The Topics list: every topic with courses and how many, its subtopics under it once it's chosen.
  const counts = useMemo(() => {
    const t = new Map<string, number>(), s = new Map<string, { label: string; n: number }>();
    for (const c of courses ?? []) {
      c.topics.forEach((x) => t.set(x, (t.get(x) ?? 0) + 1));
      (c.subtopics ?? []).forEach((x) => s.set(`${x.parent}/${x.slug}`, { label: x.label, n: (s.get(`${x.parent}/${x.slug}`)?.n ?? 0) + 1 }));
    }
    return { topics: Array.from(t.entries()).sort((a, b) => b[1] - a[1]), subs: s };
  }, [courses]);
  const filtered = !!(topic || level || price || q);
  const reader = useMemo(() => ({ interests: interests ?? [], self: profile?.username }), [interests, profile]);
  const s = useMemo(() => shelves(shelved, reader, 6), [shelved, reader]);
  // Topic chips: the reader's interests that have courses (★), then the other topics there, most common first.
  const chips = useMemo(() => {
    const c = new Map<string, number>();
    (courses ?? []).forEach((x) => x.topics.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
    const starred = (interests ?? []).filter((t) => c.has(t));
    return { starred, rest: Array.from(c.entries()).filter(([t]) => !starred.includes(t)).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 10) };
  }, [courses, interests]);
  // Courses the learner has started and not finished, the most recently started first.
  const learning = useMemo(() => {
    const byId = new Map((courses ?? []).map((c) => [c.id, c]));
    return mine.map((e) => ({ e, c: byId.get(e.courseId) })).filter((x): x is { e: Enrolment; c: CourseListing } => !!x.c && !x.e.completedAt)
      .sort((a, b) => b.e.enrolledAt.localeCompare(a.e.enrolledAt)).slice(0, 3);
  }, [courses, mine]);

  const cards = (list: Shelved[]) => <div className={grid}>{list.map((c) => <CourseCard key={c.id} c={courseCardOf({ ...c, viewsWeek: c.viewsWeek ?? 0 })} href={courseHref(c.slug)} />)}</div>;
  const why = (interests ?? []).length > 0
    ? <>Because you chose {(interests ?? []).slice(0, 4).map(hashtag).join(" ")} · <Link href="/interests" className="text-crimson">Change your interests</Link></>
    : null;
  const pick = <p className="text-sm text-slate">{signedIn ? <><Link href="/interests" className="font-semibold text-crimson">Choose your interests</Link> to see courses you&apos;re into first.</> : <><Link href="/login?next=/academy" className="font-semibold text-crimson">Sign in</Link> and choose your interests to see courses you&apos;re into first.</>}</p>;
  const chip = (on: boolean) => `flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-white text-crimson" : "bg-white/15 text-paper hover:bg-white/25"}`;
  const nothing = <p className="text-sm text-slate">No courses here yet{topic ? ` on ${hashtag(topic)}` : ""}{q ? ` matching “${query.trim()}”` : ""}.</p>;
  const pill = (on: boolean) => `rounded-full px-2.5 py-1 font-ui text-xs font-bold ${on ? "bg-crimson text-paper" : "bg-card text-ink ring-1 ring-rule hover:ring-crimson"}`;
  const pickTopic = (t: string | null) => { setTopic(t); setSub(null); };
  const filters = (
    <aside className="hidden lg:block">
      <div className="sticky top-24 overflow-hidden rounded-2xl border border-rule bg-card">
        <p className="border-b border-rule px-4 py-3 font-ui font-bold text-ink">Topics</p>
        <ul className="max-h-[50vh] overflow-y-auto py-1 text-sm">
          <li><button onClick={() => pickTopic(null)} className={`flex w-full justify-between px-4 py-2 text-left ${!topic ? "border-l-4 border-crimson bg-paper font-semibold" : "hover:bg-paper"}`}>All courses <span className={`rounded-full px-2 text-xs ${!topic ? "bg-crimson text-paper" : "bg-paper text-slate"}`}>{(courses ?? []).length}</span></button></li>
          {counts.topics.map(([t, n]) => (
            <li key={t}>
              <button onClick={() => pickTopic(t)} className={`flex w-full justify-between px-4 py-2 text-left ${topic === t && !sub ? "border-l-4 border-crimson bg-paper font-semibold" : "hover:bg-paper"}`}>{hashtag(t)} <span className="rounded-full bg-paper px-2 text-xs text-slate">{n}</span></button>
              {topic === t && Array.from(counts.subs.entries()).filter(([k]) => k.startsWith(`${t}/`)).map(([k, v]) => (
                <button key={k} onClick={() => setSub(k.split("/")[1])} className={`flex w-full justify-between py-2 pl-8 pr-4 text-left text-slate ${sub === k.split("/")[1] ? "bg-paper font-semibold text-ink" : "hover:bg-paper"}`}>› {subtopicHashtag(v.label)} <span className="rounded-full bg-paper px-2 text-xs">{v.n}</span></button>
              ))}
            </li>
          ))}
        </ul>
        <p className="border-t border-rule px-4 pb-1 pt-3 font-mono text-[10px] uppercase tracking-widest text-slate">Level</p>
        <div className="flex flex-wrap gap-1.5 px-4 pb-3 pt-1">{(["", "beginner", "intermediate", "advanced"] as Level[]).map((l) => <button key={l || "any"} onClick={() => setLevel(l)} className={pill(level === l)}>{l ? l[0].toUpperCase() + l.slice(1) : "Any"}</button>)}</div>
        <p className="px-4 pb-1 font-mono text-[10px] uppercase tracking-widest text-slate">Price</p>
        <div className="flex flex-wrap gap-1.5 px-4 pb-4 pt-1">{(["", "free", "paid"] as Price[]).map((p) => <button key={p || "all"} onClick={() => setPrice(p)} className={pill(price === p)}>{p ? p[0].toUpperCase() + p.slice(1) : "All"}</button>)}</div>
      </div>
    </aside>
  );

  return (
    <div>
      <DiscoveryHero eyebrow="Notes Academy" title="Learn from people who've done it" sub="Free and paid courses from #NotesApp tutors and organisations. Lessons play right here, your progress is saved as you go, and you finish with a certificate anyone can check."
        query={query} onQuery={setQuery} placeholder="Search courses and teachers" tabs={TABS} tab={tab} onTab={setTab}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href="/academy/teach" className="mr-2 rounded-full bg-white px-4 py-1.5 font-ui text-sm font-bold text-crimson hover:bg-paper">Teach a course</Link>
          {(chips.starred.length > 0 || chips.rest.length > 0) && (
            <>
              <button onClick={() => pickTopic(null)} aria-pressed={!topic} className={chip(!topic)}>All topics</button>
              {chips.starred.map((t) => <button key={t} onClick={() => pickTopic(t)} aria-pressed={topic === t} className={chip(topic === t)}>★ {hashtag(t)}</button>)}
              {chips.rest.map((t) => <button key={t} onClick={() => pickTopic(t)} aria-pressed={topic === t} className={chip(topic === t)}>{hashtag(t)}</button>)}
              <span className="flex gap-2 lg:hidden">
                <select value={price} onChange={(e) => setPrice(e.target.value as Price)} aria-label="Price" className="rounded-full border-0 bg-white/15 px-3 py-1 text-xs font-semibold text-paper"><option value="" className="text-ink">Free and paid</option><option value="free" className="text-ink">Free</option><option value="paid" className="text-ink">Paid</option></select>
                <select value={level} onChange={(e) => setLevel(e.target.value as Level)} aria-label="Level" className="rounded-full border-0 bg-white/15 px-3 py-1 text-xs font-semibold text-paper"><option value="" className="text-ink">Any level</option><option value="beginner" className="text-ink">Beginner</option><option value="intermediate" className="text-ink">Intermediate</option><option value="advanced" className="text-ink">Advanced</option></select>
              </span>
            </>
          )}
        </div>
      </DiscoveryHero>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        {!courses ? <p className="py-16 text-center text-sm text-slate">Loading courses…</p> : courses.length === 0 ? (
          <div className="card mb-12 p-6 text-center sm:p-10">
            <p className="font-display text-2xl text-ink">No courses yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate">Notes Academy has just opened. Teach the first course: paste links to your YouTube videos or write text lessons, and learners enrol free.</p>
            <Link href="/academy/teach" className="btn-primary mt-5 inline-block !px-6 !py-2 text-sm">Teach a course</Link>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[250px_1fr] lg:gap-8">
            {filters}
            <div className="min-w-0">
            {filtered && tab === "all" && (
              <Shelf title={`${shelved.length} ${shelved.length === 1 ? "course" : "courses"}${topic ? ` in ${sub ? subtopicHashtag(counts.subs.get(`${topic}/${sub}`)?.label ?? sub) : hashtag(topic)}` : ""}`} why={<button onClick={() => { pickTopic(null); setLevel(""); setPrice(""); setQuery(""); }} className="text-crimson">Clear filters</button>}>{shelved.length ? cards(byRecent(shelved)) : nothing}</Shelf>
            )}
            {tab === "all" && !filtered && (
              <>
                {learning.length > 0 && (
                  <Shelf title="Continue learning">
                    <div className={grid}>{learning.map(({ e, c }) => {
                      const p = progressOf(c.lessonIds, e);
                      return <CourseCard key={c.id} c={courseCardOf(c, p.pct)} href={p.next ? lessonHref(c.slug, p.next) : courseHref(c.slug)} />;
                    })}</div>
                  </Shelf>
                )}
                <Shelf title="For you" why={why} seeAll={s.forYou.length ? { href: "/academy?tab=foryou" } : undefined}>{s.forYou.length ? cards(s.forYou) : (interests ?? []).length ? nothing : pick}</Shelf>
                <AdSlot placement="academy" />
                {s.mostViewed.length > 0 && <Shelf title={`Most viewed ${anyWeekly ? "this week" : ""}`.trim()} seeAll={{ href: "/academy?tab=viewed" }}>{cards(s.mostViewed)}</Shelf>}
                <Shelf title="New" seeAll={{ href: "/academy?tab=new" }}>{s.recent.length ? cards(s.recent) : nothing}</Shelf>
              </>
            )}
            {tab === "foryou" && <Shelf title="For you" why={why}>{(interests ?? []).length ? (byForYou(shelved, reader).length ? cards(byForYou(shelved, reader)) : nothing) : pick}</Shelf>}
            {tab === "viewed" && <Shelf title="Most viewed">{byMostViewed(shelved).some((c) => (c.viewsWeek ?? c.views) > 0) ? cards(byMostViewed(shelved).filter((c) => (c.viewsWeek ?? c.views) > 0)) : nothing}</Shelf>}
            {tab === "new" && <Shelf title="New">{shelved.length ? cards(byRecent(shelved)) : nothing}</Shelf>}
            </div>
          </div>
        )}

        <Shelf title="What's coming" why="Free and paid courses are open now. Next:">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {ACADEMY_NEXT.map((p) => <div key={p.t} className="card p-5"><p className="font-ui font-bold text-ink">{p.t}</p><p className="mt-1 text-sm text-slate">{p.d}</p></div>)}
          </div>
        </Shelf>
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-display text-xl text-ink">Want to teach?</p>
            <p className="mt-1 text-sm text-slate">Any publishing account can teach a free course: lessons from your own YouTube, or written right here. Sell courses on Pro (text, PDFs, YouTube) and Business (your own uploaded videos too), alone, with co-tutors or for your organisation.</p>
          </div>
          <Link href="/academy/teach" className="btn-primary !px-5 !py-2 text-sm">Teach a course</Link>
        </div>
      </div>
    </div>
  );
}
