import type { Metadata } from "next";
import Link from "next/link";
import Shelf from "@/components/Shelf";
import AcademyPageClient from "@/components/academy/AcademyPageClient";
import { ACADEMY_LIVE } from "@/lib/courses";

// Notes Academy: courses on #NotesApp (docs/COURSES.md). Free courses are open (components/academy/AcademyPageClient.tsx: the
// same shelves as Journals and Notes Market, the reader's interests first). With NEXT_PUBLIC_ACADEMY_LIVE=false the page says
// what's coming instead, as it did before courses opened.
export const metadata: Metadata = {
  title: "Notes Academy",
  description: "Free courses from African creators and professionals, with lessons that play right on #NotesApp and your progress saved as you go.",
  alternates: { canonical: "/academy" },
};

const POINTS = [
  { t: "Free courses", d: "Any publisher can teach for free, with lessons from their own YouTube that play right here." },
  { t: "Paid courses", d: "On Pro and Business: upload your lessons; they're kept private and only learners who paid can open them." },
  { t: "Certificates", d: "Finish a course and get a certificate with its own page anyone can check, ready for LinkedIn." },
  { t: "For organisations", d: "Enterprise courses for your team or customers, from ₦100,000 a month. Talk to us." },
];

export default function AcademyPage() {
  return ACADEMY_LIVE ? <AcademyPageClient /> : <AcademySoon />;
}

function AcademySoon() {
  return (
    <>
      <section className="bg-gradient-to-br from-crimson-deep via-crimson to-crimson-bright text-paper">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-12">
          <p className="font-mono text-xs uppercase tracking-eyebrow text-paper/70">Notes Academy</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Learn from people who&apos;ve done it</h1>
          <p className="mt-2 max-w-2xl text-paper/85">Free courses on the teacher&apos;s YouTube, paid courses on #NotesApp, and a certificate anyone can verify. Opening soon.</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <Shelf title="What's coming">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {POINTS.map((p) => <div key={p.t} className="card p-5"><p className="font-ui font-bold text-ink">{p.t}</p><p className="mt-1 text-sm text-slate">{p.d}</p></div>)}
          </div>
        </Shelf>
        <Shelf title="For you" why={<>Courses on <Link href="/interests" className="text-crimson">your interests</Link> will show here first, then the most followed and the newest.</>}>
          <p className="text-sm text-slate">No courses yet.</p>
        </Shelf>
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-display text-xl text-ink">Want to teach?</p>
            <p className="mt-1 text-sm text-slate">Tell us what you&apos;d teach and we&apos;ll let you know when Notes Academy opens to teachers.</p>
          </div>
          <Link href="/contact?topic=courses&message=I%27d%20like%20to%20teach%20on%20Notes%20Academy%3A%20" className="btn-primary !px-5 !py-2 text-sm">Tell us</Link>
        </div>
      </div>
    </>
  );
}
