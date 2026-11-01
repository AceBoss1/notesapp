"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import CourseCard, { courseCardOf } from "@/components/CourseCard";
import { courseHref, type CourseListing } from "@/lib/courses";

// The product half of Notes Academy (/academy, components/academy/AcademyPageClient.tsx puts the course catalogue between these
// sections). Every claim here is something built (docs/COURSES.md, lib/kb-articles.ts "academy"); every number is counted from the
// same published-course list the catalogue uses (/api/public/academy), and a number that is still 0 is left out rather than shown.
// The pictures are drawn from our own UI (a course card, a quiz result, a certificate with the real seal), never stock photos.

const wrap = "mx-auto max-w-6xl px-4 sm:px-8";
const h2 = "font-display text-3xl leading-tight text-ink sm:text-4xl";
const arrow = <span aria-hidden="true">→</span>;

// ── Little drawings made from the real UI ────────────────────────────────────────────────────────────────────────────────────────

function Tick({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-moss text-[11px] font-bold text-white ${className}`}>✔</span>
  );
}

function QuizChip() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-rule bg-card px-4 py-3 shadow-lg">
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-moss font-ui text-sm font-bold text-white">80%</span>
      <div>
        <p className="font-ui text-sm font-bold text-ink">Quiz passed</p>
        <p className="text-xs text-slate">8 of 10 right · pass mark 70%</p>
      </div>
    </div>
  );
}

function CertificateChip() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-rule bg-card px-4 py-3 shadow-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/academy/notes-academy-verifiable-certificate.webp" alt="" className="h-10 w-10" />
      <div>
        <p className="flex items-center gap-1.5 font-ui text-sm font-bold text-ink">Certificate genuine <Tick className="!h-4 !w-4 !text-[9px]" /></p>
        <p className="font-mono text-[11px] text-slate">NA-C-•••••••• · checked at /certificates</p>
      </div>
    </div>
  );
}

// A course card in the shape of the real one (components/CourseCard.tsx), for when no course is published yet.
function SampleCourseCard() {
  return (
    <div className="card overflow-hidden shadow-xl">
      <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-crimson-deep via-crimson to-crimson-bright p-6 text-center font-display text-2xl leading-snug text-paper">Your course, here</div>
      <div className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-crimson">#Business › #Bookkeeping</p>
        <p className="mt-1 font-ui text-base font-bold text-ink">Your first course on Notes Academy</p>
        <p className="mt-1 text-xs text-slate">12 lessons · 2 modules · a quiz · a certificate</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-rule"><div className="h-full w-2/3 rounded-full bg-crimson" /></div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-eyebrow text-slate">66% done</p>
      </div>
    </div>
  );
}

function HeroVisual({ top }: { top?: CourseListing }) {
  return (
    <div className="relative mx-auto w-full max-w-md pb-12 pt-12 lg:max-w-none">
      <div aria-hidden="true" className="absolute inset-6 -z-0 rounded-[2rem] bg-gradient-to-br from-crimson/20 via-crimson-bright/10 to-transparent blur-2xl" />
      <div className="relative mx-auto w-[86%] rotate-[-1.5deg]">
        {top ? <CourseCard c={courseCardOf(top)} href={courseHref(top.slug)} /> : <SampleCourseCard />}
      </div>
      <div className="absolute -left-1 -top-2 sm:-left-4"><QuizChip /></div>
      <div className="absolute -right-1 bottom-0 sm:-right-4"><CertificateChip /></div>
    </div>
  );
}

function CurriculumVisual() {
  const rows: [string, string, boolean][] = [["▶", "Welcome and how this course works", true], ["▶", "Recording your first sale", true], ["📄", "Worksheet: your cash book (PDF)", true], ["?", "Quiz: the basics", false]];
  return (
    <div className="card overflow-hidden shadow-lg">
      <div className="flex items-center justify-between border-b border-rule px-5 py-3">
        <p className="font-ui text-sm font-bold text-ink">Curriculum</p>
        <span className="rounded-full bg-field px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-slate">2 modules · 9 lessons</span>
      </div>
      <p className="px-5 pt-4 font-mono text-[10px] uppercase tracking-widest text-crimson">Module 1 · Getting started</p>
      <ul className="divide-y divide-rule px-5 pb-2">
        {rows.map(([icon, t, done]) => (
          <li key={t} className="flex items-center gap-3 py-3 text-sm">
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-field text-xs text-ink">{icon}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{t}</span>
            {done ? <Tick /> : <span className="shrink-0 rounded-full bg-crimson px-2.5 py-0.5 font-ui text-[11px] font-bold text-paper">Next</span>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 border-t border-rule bg-field/50 px-5 py-3 text-xs font-semibold">
        <span className="rounded-full bg-card px-3 py-1 text-ink ring-1 ring-rule">Join the live class</span>
        <span className="rounded-full bg-card px-3 py-1 text-ink ring-1 ring-rule">Join the group</span>
      </div>
    </div>
  );
}

function QuizVisual() {
  const answers: [string, "right" | "wrong" | ""][] = [["Assets = Liabilities + Equity", "right"], ["Assets = Income − Expenses", ""], ["Equity = Assets + Liabilities", ""]];
  return (
    <div className="card overflow-hidden shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
        <p className="font-ui text-sm font-bold text-ink">Quiz · question 3 of 10</p>
        <span className="rounded-full bg-moss px-2.5 py-0.5 font-ui text-[11px] font-bold text-white">Passed · 80%</span>
      </div>
      <div className="px-5 py-4">
        <p className="font-ui text-[15px] font-semibold text-ink">Which of these is the accounting equation?</p>
        <ul className="mt-3 space-y-2 text-sm">
          {answers.map(([a, s]) => (
            <li key={a} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${s === "right" ? "border-moss bg-moss/10 text-ink" : "border-rule text-slate"}`}>
              {a}{s === "right" && <Tick />}
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-xl bg-field px-3 py-2 text-xs leading-relaxed text-slate"><span className="font-semibold text-ink">Tutor&apos;s explanation:</span> everything a business owns is paid for by what it owes or by what the owners put in.</p>
      </div>
    </div>
  );
}

function CertificateVisual() {
  // data-theme-off keeps the certificate on ivory paper at Night too, as the printed one is.
  return (
    <div data-theme-off className="relative overflow-hidden rounded-xl2 border-4 border-double border-[#C9A24B] bg-[#FFFDF9] p-5 text-[#1A1210] shadow-xl sm:p-7">
      <div className="flex items-start justify-between gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/academy/notesapp-certified-course.webp" alt="" className="h-12 w-12 sm:h-14 sm:w-14" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#5C534E]">Certificate of completion</p>
      </div>
      <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-[#5C534E]">This certifies that</p>
      <p className="mt-1 text-center font-display text-2xl sm:text-3xl">Your learner&apos;s name</p>
      <p className="mt-2 text-center text-xs text-[#5C534E] sm:text-sm">has completed <span className="font-semibold text-[#1A1210]">Your course</span> on Notes Academy</p>
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-[#E7DAD3] pt-4">
        <div className="text-[11px] leading-snug text-[#5C534E]">
          <p className="font-display text-base italic text-[#1A1210]">Your signature</p>
          <p>Your academy</p>
        </div>
        <div className="flex items-center gap-2">
          {/* A QR-like block: the real certificate carries a QR code to its check page. */}
          <span aria-hidden="true" className="grid h-12 w-12 grid-cols-5 grid-rows-5 gap-px rounded bg-white p-1 ring-1 ring-[#E7DAD3]">
            {Array.from({ length: 25 }, (_, i) => <span key={i} className={[0, 1, 3, 4, 5, 7, 9, 12, 14, 15, 17, 19, 20, 21, 23, 24].includes(i) ? "bg-[#1A1210]" : ""} />)}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/academy/notes-academy-verifiable-certificate.webp" alt="" className="h-12 w-12" />
        </div>
      </div>
      <p className="mt-3 text-right font-mono text-[10px] text-[#5C534E]">ID NA-C-•••••••• · notesapp.name.ng/certificates</p>
    </div>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function AcademyHero({ courses }: { courses?: CourseListing[] }) {
  // The real course most learners joined, when there is one; otherwise a sample in the same shape.
  const top = useMemo(() => [...(courses ?? [])].sort((a, b) => b.enrolCount - a.enrolCount || b.views - a.views)[0], [courses]);
  return (
    <section className="relative overflow-hidden border-b border-rule bg-paper">
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-crimson/10 blur-3xl" />
      <div className={`${wrap} relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:py-20`}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <p className="eyebrow"><img src="/images/academy/notes-academy-logo.webp" alt="" className="h-5 w-5" />Notes Academy</p>
          <h1 className="mt-4 font-display text-[2.6rem] leading-[1.05] text-ink [text-wrap:balance] sm:text-6xl lg:text-[3.5rem]">Teach what you know. Learn from people who&apos;ve done it.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate">Free and paid courses from African tutors, professionals and organisations, with quizzes, live classes and a certificate anyone can check.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#courses" className="btn-primary !px-7 !py-3.5 !text-[15px]">Browse courses</a>
            <Link href="/academy/teach" className="btn-ghost !px-7 !py-3.5 !text-[15px]">Start teaching</Link>
          </div>
          <ul className="mt-7 grid gap-2 text-sm text-slate sm:grid-cols-2">
            {["Free courses on every publishing plan", "Quizzes marked the moment learners submit", "Certificates with an ID and a QR code", "Paid courses paid out in naira"].map((t) => <li key={t} className="flex items-center gap-2"><Tick />{t}</li>)}
          </ul>
          <p className="mt-6 text-sm"><Link href="/certificates" className="font-semibold text-crimson hover:underline">Check a certificate {arrow}</Link><span className="mx-3 text-rule">|</span><a href="/exam-prep" className="font-semibold text-crimson hover:underline">Naija Exam Prep {arrow}</a></p>
        </div>
        <HeroVisual top={top} />
      </div>
    </section>
  );
}

// "Courses from…": the real teachers and organisations with published courses, most learners first. Nothing when there are none.
export function AcademyPublishers({ courses }: { courses?: CourseListing[] }) {
  const people = useMemo(() => {
    const m = new Map<string, { name: string; username: string; isOrg: boolean; n: number }>();
    for (const c of courses ?? []) {
      const p = m.get(c.ownerUid) ?? { name: c.ownerName, username: c.ownerUsername, isOrg: c.isOrg, n: 0 };
      p.n += c.enrolCount + 1;
      m.set(c.ownerUid, p);
    }
    return Array.from(m.values()).filter((p) => p.name).sort((a, b) => b.n - a.n).slice(0, 10);
  }, [courses]);
  if (!people.length) return null;
  return (
    <section className="border-b border-rule bg-card">
      <div className={`${wrap} flex flex-col items-center gap-3 py-6 sm:flex-row sm:gap-6`}>
        <p className="shrink-0 font-mono text-[11px] uppercase tracking-eyebrow text-slate">Courses from</p>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 sm:justify-start">
          {people.map((p) => <li key={p.username}><Link href={`/u/${p.username}`} className="font-display text-lg text-ink/80 hover:text-crimson">{p.name}</Link></li>)}
        </ul>
      </div>
    </section>
  );
}

const FEATURES: { eyebrow: string; problem: string; answer: string; points: string[]; link: { href: string; label: string }; visual: ReactNode }[] = [
  {
    eyebrow: "Build a course",
    problem: "Your lessons are scattered across YouTube links, PDFs and a WhatsApp group.",
    answer: "Put them in one course. Paste your own YouTube videos, write text lessons, add PDFs and group it all in modules. Learners' progress is saved as they go, and only those who enrolled see your live-class and group links.",
    points: ["Free preview lessons on paid courses", "Live classes on Zoom, Meet or Teams, with recordings", "Up to 4 co-tutors, each paid their share"],
    link: { href: "/help/academy", label: "How teaching works" },
    visual: <CurriculumVisual />,
  },
  {
    eyebrow: "Quizzes",
    problem: "Finishing the videos doesn't prove anyone learnt anything.",
    answer: "Add a quiz to any course, free or paid. Multiple-choice questions, the right answer and your explanation, and a pass mark you choose. It's marked on our server the moment a learner submits, and the lesson only counts once they pass.",
    points: ["2 to 6 answers a question, up to 50 questions", "Learners see their score and your explanations", "Retakes as often as they need"],
    link: { href: "/help/academy", label: "Add a quiz to your course" },
    visual: <QuizVisual />,
  },
  {
    eyebrow: "Verifiable certificates",
    problem: "A certificate anyone can edit in a design app is worth very little to an employer.",
    answer: "Every Notes Academy certificate has its own ID, a QR code and a public page that says whether it's genuine. Put your academy's name, logo and signature on it, and learners can add it to LinkedIn in a tap.",
    points: ["Checked by anyone at /certificates", "Your accrediting body's logo once we've checked it", "Download as PDF or picture"],
    link: { href: "/certificates", label: "Check a certificate" },
    visual: <CertificateVisual />,
  },
];

export function AcademyFeatures() {
  return (
    <section className="bg-paper py-16 sm:py-20">
      <div className={`${wrap} space-y-16 sm:space-y-24`}>
        {FEATURES.map((f, i) => (
          <div key={f.eyebrow} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
            <div className={i % 2 ? "lg:order-2" : ""}>
              <p className="eyebrow">{f.eyebrow}</p>
              <h2 className={`mt-3 ${h2}`}>{f.problem}</h2>
              <p className="mt-4 leading-relaxed text-slate">{f.answer}</p>
              <ul className="mt-5 space-y-2 text-sm text-ink">{f.points.map((p) => <li key={p} className="flex items-start gap-2"><Tick className="mt-0.5" />{p}</li>)}</ul>
              <Link href={f.link.href} className="mt-6 inline-flex items-center gap-1.5 font-ui text-sm font-bold text-crimson hover:underline">{f.link.label} {arrow}</Link>
            </div>
            <div className={i % 2 ? "lg:order-1" : ""}>{f.visual}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const ADVANTAGES: { id: string; tab: string; title: string; body: string; points: string[]; link: { href: string; label: string } }[] = [
  {
    id: "teach", tab: "Teach", title: "Start free, on any publishing plan",
    body: "Every publishing account, including the free Basic plan, can teach free courses with lessons from its own YouTube or written right here. Organisations on Business and Enterprise can teach as themselves, and their admins can edit too.",
    points: ["Up to 30 courses, 100 lessons each", "Nana suggests topics from your title", "Preview a draft before you publish"],
    link: { href: "/academy/teach", label: "Teach a course" },
  },
  {
    id: "sell", tab: "Sell", title: "Paid courses, paid out in naira",
    body: "On Pro, sell courses with text lessons, PDFs and YouTube; on Business and Enterprise, upload your own videos too. Learners pay by card, bank transfer or wallet, and you're paid to your bank 7 days after each sale, less your plan's fee for digital items.",
    points: ["Uploaded videos stream with the learner's @username across them", "Two devices per learner", "Refunds only within 7 days and before starting"],
    link: { href: "/help/payouts", label: "How payouts work" },
  },
  {
    id: "grow", tab: "Grow", title: "Get your course in front of learners",
    body: "Courses are filed under topics, so they reach people interested in them on Notes Academy, Trending, Explore and the weekly digest. Run discount codes, and let affiliates on the marketplace promote your course for a share you set.",
    points: ["Discount codes for a naira amount or a percentage", "Affiliate shares up to 50%", "Your courses on your own site too"],
    link: { href: "/affiliates", label: "The affiliate marketplace" },
  },
  {
    id: "learn", tab: "Learn", title: "A course that remembers where you stopped",
    body: "Lessons play right on #NotesApp, ticked off as you finish them, with Continue learning waiting on Notes Academy. Rate a course once you're halfway, ask Nana when you're stuck, and claim your certificate when every lesson is done.",
    points: ["Free courses: enrol in one tap", "Bought courses stay yours for good", "Reviews and ratings from real learners"],
    link: { href: "/help/notes-academy-faq", label: "Questions learners ask" },
  },
];

export function AcademyAdvantages() {
  const [on, setOn] = useState(ADVANTAGES[0].id);
  const a = ADVANTAGES.find((x) => x.id === on) ?? ADVANTAGES[0];
  return (
    <section className="border-y border-rule bg-card py-16 sm:py-20">
      <div className={wrap}>
        <p className="eyebrow">The Notes Academy advantage</p>
        <h2 className={`mt-3 max-w-3xl ${h2}`}>One place to teach, sell and certify, built for how Africa learns.</h2>
        <div role="tablist" aria-label="The Notes Academy advantage" className="mt-8 flex gap-2 overflow-x-auto border-b border-rule">
          {ADVANTAGES.map((x) => (
            <button key={x.id} id={`adv-${x.id}`} role="tab" aria-selected={on === x.id} aria-controls="adv-panel" onClick={() => setOn(x.id)}
              className={`-mb-px shrink-0 border-b-2 px-4 py-3 font-ui text-sm font-bold transition-colors ${on === x.id ? "border-crimson text-crimson" : "border-transparent text-slate hover:text-ink"}`}>
              {x.tab}
            </button>
          ))}
        </div>
        <div id="adv-panel" role="tabpanel" aria-labelledby={`adv-${a.id}`} className="grid gap-8 pt-8 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
          <div>
            <h3 className="font-display text-2xl text-ink sm:text-3xl">{a.title}</h3>
            <p className="mt-3 leading-relaxed text-slate">{a.body}</p>
            <Link href={a.link.href} className="mt-6 inline-flex items-center gap-1.5 font-ui text-sm font-bold text-crimson hover:underline">{a.link.label} {arrow}</Link>
          </div>
          <ul className="space-y-3">
            {a.points.map((p) => <li key={p} className="flex items-start gap-3 rounded-2xl bg-paper px-4 py-3.5 text-sm text-ink ring-1 ring-rule"><Tick className="mt-0.5" />{p}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

const icon = (d: string) => <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const WHY: { t: string; d: string; i: ReactNode }[] = [
  { t: "Lessons stay on #NotesApp", d: "YouTube lessons play in a privacy-enhanced player on the course page, so learners don't wander off.", i: icon("M5 4.5v15l14-7.5-14-7.5Z") },
  { t: "Made for phones", d: "Progress is saved lesson by lesson, so a learner can pick up on any device where they stopped.", i: icon("M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5ZM11 18.5h2") },
  { t: "Paid work kept safe", d: "Uploaded videos stream with signed playback and a drifting watermark, never as a file to save.", i: icon("M12 3 4.5 6v5.5c0 4.5 3.2 8.3 7.5 9.5 4.3-1.2 7.5-5 7.5-9.5V6L12 3Zm-3 9 2 2 4-4") },
  { t: "Teach together", d: "Invite co-tutors by @username with their share of each sale; each is paid at their own plan's fee.", i: icon("M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6m1-9a3 3 0 1 0 0-6m2 15c0-2.8-1.4-5-3.5-5.6") },
  { t: "Nana helps learners", d: "Our AI helper knows Notes Academy inside out and answers most questions straight away.", i: icon("M4 5.5h16v10H9l-5 4v-14ZM8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01") },
  { t: "Real reviews", d: "Only learners who've done half the lessons can rate a course, and you can reply to each review.", i: icon("m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z") },
];

export function AcademyWhy() {
  return (
    <section className="bg-paper py-16 sm:py-20">
      <div className={wrap}>
        <p className="eyebrow">Why Notes Academy</p>
        <h2 className={`mt-3 max-w-2xl ${h2}`}>Everything a course needs, nothing to stitch together.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map((w) => (
            <div key={w.t} className="card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-crimson/10 text-crimson">{w.i}</span>
              <p className="mt-4 font-ui text-base font-bold text-ink">{w.t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate">{w.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Live numbers from the published-course list. Certificates issued aren't counted here (no public count yet), so they aren't shown.
export function AcademyStats({ courses }: { courses?: CourseListing[] }) {
  const stats = useMemo(() => {
    const list = courses ?? [];
    const fmt = (n: number) => n.toLocaleString("en-NG");
    return [
      { n: list.length, label: list.length === 1 ? "course published" : "courses published" },
      { n: list.reduce((s, c) => s + (c.enrolCount || 0), 0), label: "course enrolments" },
      { n: new Set(list.map((c) => c.ownerUid)).size, label: "teachers and organisations" },
      { n: list.reduce((s, c) => s + (c.lessonCount || 0), 0), label: "lessons to learn from" },
    ].filter((s) => s.n > 0).map((s) => ({ ...s, v: fmt(s.n) }));
  }, [courses]);
  if (!stats.length) return null;
  return (
    <section className="bg-gradient-to-br from-crimson-deep via-crimson to-crimson-bright py-14 text-paper sm:py-16">
      <div className={wrap}>
        <p className="font-mono text-[11px] uppercase tracking-eyebrow text-paper/70">Notes Academy today</p>
        <div className={`mt-6 grid grid-cols-2 gap-x-6 gap-y-8 ${stats.length > 2 ? "lg:grid-cols-4" : ""}`}>
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-display text-5xl leading-none sm:text-6xl">{s.v}</p>
              <p className="mt-2 text-sm text-paper/80">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const AUDIENCES: { t: string; d: string; href: string; cta: string }[] = [
  { t: "Tutors and coaches", d: "Turn the lessons you already give into a course with quizzes, live classes and a certificate.", href: "/academy/teach", cta: "Teach a course" },
  { t: "Schools and exam prep", d: "Courses for your students, and Naija Exam Prep for JAMB, WAEC and NECO practice.", href: "/exam-prep", cta: "Naija Exam Prep" },
  { t: "Churches and NGOs", d: "Free courses for members and volunteers, beside your community, its events and giving.", href: "/community", cta: "Community for organisations" },
  { t: "Organisations training staff", d: "Teach as your organisation on Business or Enterprise. Enterprise courses with cohorts and bulk invites are next: talk to us.", href: "/organisations", cta: "For organisations" },
  { t: "Professionals and consultants", d: "Certificates with your academy's name, logo and signature, and your accrediting body's logo once checked.", href: "/academy/teach/setup", cta: "Set up your academy" },
  { t: "Creators", d: "Teach free from your own YouTube, or earn by promoting other people's courses as an affiliate.", href: "/affiliates", cta: "Affiliate marketplace" },
];

export function AcademyAudiences() {
  return (
    <section className="bg-paper py-16 sm:py-20">
      <div className={wrap}>
        <p className="eyebrow">Who it&apos;s for</p>
        <h2 className={`mt-3 ${h2}`}>Notes Academy for…</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AUDIENCES.map((a) => (
            <Link key={a.t} href={a.href} className="card group flex flex-col p-6 transition-shadow hover:shadow-md">
              <p className="font-display text-xl text-ink group-hover:text-crimson">{a.t}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate">{a.d}</p>
              <span className="mt-4 font-ui text-sm font-bold text-crimson">{a.cta} {arrow}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const RESOURCES: { kind: string; t: string; href: string }[] = [
  { kind: "Guide", t: "Teaching and learning on Notes Academy", href: "/help/academy" },
  { kind: "FAQ", t: "Notes Academy: questions learners ask", href: "/help/notes-academy-faq" },
  { kind: "Guide", t: "Getting paid: payouts and when money is released", href: "/help/payouts" },
  { kind: "Guide", t: "Discount codes and coupons", href: "/help/discount-codes" },
  { kind: "Guide", t: "Referrals and affiliates", href: "/help/referrals" },
  { kind: "Guide", t: "Your courses on your own site", href: "/help/courses-on-your-site" },
];

export function AcademyResources() {
  return (
    <section className="border-t border-rule bg-card py-16 sm:py-20">
      <div className={wrap}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Resources</p>
            <h2 className={`mt-3 ${h2}`}>Learn the ropes</h2>
          </div>
          <Link href="/help" className="font-ui text-sm font-bold text-crimson hover:underline">All help articles {arrow}</Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((r) => (
            <Link key={r.href} href={r.href} className="group flex flex-col rounded-xl2 border border-rule bg-paper p-5 transition-colors hover:border-crimson">
              <span className="w-fit rounded-full bg-crimson/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-crimson">{r.kind}</span>
              <p className="mt-3 flex-1 font-ui text-base font-bold leading-snug text-ink group-hover:text-crimson">{r.t}</p>
              <span className="mt-4 text-sm font-semibold text-slate">Read in the help centre {arrow}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AcademyHelp() {
  return (
    <div className="mt-6 rounded-2xl border border-rule bg-card p-5">
      <div>
        <p className="font-ui font-bold text-ink">Still have a question?</p>
        <p className="mt-0.5 text-sm text-slate">The help centre covers every part of teaching and learning, and Nana answers straight away.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/help/academy" className="btn-primary !px-5 !py-2 text-sm">Visit the help centre</Link>
        <Link href="/contact?topic=courses" className="btn-ghost !px-5 !py-2 text-sm">Contact us</Link>
      </div>
    </div>
  );
}

export function AcademyCta() {
  return (
    <section className="bg-paper pb-16 sm:pb-20">
      <div className={wrap}>
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-crimson-deep via-crimson to-crimson-bright px-6 py-12 text-center text-paper sm:px-12 sm:py-16">
          <div aria-hidden="true" className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <h2 className="relative font-display text-3xl leading-tight sm:text-5xl">Your first course can be live today.</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-paper/85">A title, a summary and one lesson is all it takes to publish. Learners enrol free, or buy on Pro and above.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/academy/teach" className="inline-flex items-center rounded-full bg-paper px-7 py-3.5 font-ui text-[15px] font-bold text-crimson-deep hover:bg-white" data-theme-off>Start teaching</Link>
            <a href="#courses" className="inline-flex items-center rounded-full border border-paper/50 px-7 py-3.5 font-ui text-[15px] font-bold text-paper hover:bg-white/10">Browse courses</a>
          </div>
        </div>
      </div>
    </section>
  );
}
