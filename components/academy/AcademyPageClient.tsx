"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DiscoveryHero from "@/components/DiscoveryHero";
import Shelf from "@/components/Shelf";
import CourseCard, { courseCardOf } from "@/components/CourseCard";
import { hashtag } from "@/lib/topics";
import { useInterests } from "@/lib/interests-client";
import { useMember } from "@/lib/member-client";
import { byForYou, byMostViewed, byRecent, shelves, type Shelfable } from "@/lib/discovery";
import { courseHref, lessonHref, progressOf, type CourseListing, type Enrolment } from "@/lib/courses";
import { myEnrolments, useAcademy } from "@/lib/courses-client";

// Notes Academy (/academy): every published free course, arranged like Journals and Notes Market (lib/discovery.ts): the
// learner's own courses to continue, then their interests, what most people opened this week, and what's new.
type Tab = "all" | "foryou" | "viewed" | "new";
const TABS: { id: Tab; label: string }[] = [{ id: "all", label: "All" }, { id: "foryou", label: "For you" }, { id: "viewed", label: "Most viewed" }, { id: "new", label: "New" }];
type Shelved = Omit<CourseListing, "viewsWeek"> & Shelfable;
const grid = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

// What comes after free courses and certificates (docs/COURSES.md). Amounts are set by the owner in Admin → Pricing.
const ACADEMY_NEXT = [
  { t: "Paid courses", d: "On Pro and Business: upload your lessons; they're kept private and only learners who paid can open them." },
  { t: "For organisations", d: "Enterprise courses for your team or customers, under your brand. Talk to us." },
];

export default function AcademyPageClient() {
  const courses = useAcademy();
  const { user, profile } = useMember();
  const { interests, signedIn } = useInterests();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
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
    .filter((c) => (!topic || c.topics.includes(topic)) && (!q || c.title.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q) || c.ownerName.toLowerCase().includes(q) || c.ownerUsername.includes(q)))
    .map((c) => ({ ...c, viewsWeek: anyWeekly ? c.viewsWeek : undefined })), [courses, topic, q, anyWeekly]);
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

  return (
    <div>
      <DiscoveryHero eyebrow="Notes Academy" title="Learn from people who've done it" sub="Free courses from #NotesApp teachers. Lessons play right here, and your progress is saved as you go."
        query={query} onQuery={setQuery} placeholder="Search courses and teachers" tabs={TABS} tab={tab} onTab={setTab}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href="/academy/teach" className="mr-2 rounded-full bg-white px-4 py-1.5 font-ui text-sm font-bold text-crimson hover:bg-paper">Teach a course</Link>
          {(chips.starred.length > 0 || chips.rest.length > 0) && (
            <>
              <button onClick={() => setTopic(null)} aria-pressed={!topic} className={chip(!topic)}>All topics</button>
              {chips.starred.map((t) => <button key={t} onClick={() => setTopic(t)} aria-pressed={topic === t} className={chip(topic === t)}>★ {hashtag(t)}</button>)}
              {chips.rest.map((t) => <button key={t} onClick={() => setTopic(t)} aria-pressed={topic === t} className={chip(topic === t)}>{hashtag(t)}</button>)}
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
          <>
            {tab === "all" && (
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
                {s.mostViewed.length > 0 && <Shelf title={`Most viewed ${anyWeekly ? "this week" : ""}`.trim()} seeAll={{ href: "/academy?tab=viewed" }}>{cards(s.mostViewed)}</Shelf>}
                <Shelf title="New" seeAll={{ href: "/academy?tab=new" }}>{s.recent.length ? cards(s.recent) : nothing}</Shelf>
              </>
            )}
            {tab === "foryou" && <Shelf title="For you" why={why}>{(interests ?? []).length ? (byForYou(shelved, reader).length ? cards(byForYou(shelved, reader)) : nothing) : pick}</Shelf>}
            {tab === "viewed" && <Shelf title="Most viewed">{byMostViewed(shelved).some((c) => (c.viewsWeek ?? c.views) > 0) ? cards(byMostViewed(shelved).filter((c) => (c.viewsWeek ?? c.views) > 0)) : nothing}</Shelf>}
            {tab === "new" && <Shelf title="New">{shelved.length ? cards(byRecent(shelved)) : nothing}</Shelf>}
          </>
        )}

        <Shelf title="What's coming" why="Free courses are open now. Next:">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {ACADEMY_NEXT.map((p) => <div key={p.t} className="card p-5"><p className="font-ui font-bold text-ink">{p.t}</p><p className="mt-1 text-sm text-slate">{p.d}</p></div>)}
          </div>
        </Shelf>
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-display text-xl text-ink">Want to teach?</p>
            <p className="mt-1 text-sm text-slate">Any publishing account can teach a free course: lessons from your own YouTube, or written right here.</p>
          </div>
          <Link href="/academy/teach" className="btn-primary !px-5 !py-2 text-sm">Teach a course</Link>
        </div>
      </div>
    </div>
  );
}
