import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Nana Jobs: your own AI, a daily shortlist",
  description: "Connect your own AI. Nana reads openings from Notes Jobs and public job boards, cuts the ones that don't fit, and gives you a short ranked list every morning, with why each fits and the strongest reason you might not get it. It never applies for you.",
};

// The public explainer for Nana Jobs (the feature itself is /jobs/nana; docs/NANA_JOBS.md). No figures that Admin can change.
const FUNNEL = [
  ["Collect", "Openings from Notes Jobs, RemoteOK, Remotive, Himalayas and Arbeitnow, and the public Greenhouse, Lever and Ashby boards of companies you watch. Fetched once a day for everyone, so each board is asked once."],
  ["Remove repeats", "The same role on a company board and a feed becomes one."],
  ["Your rules, free", "Too old, not a role you want, a deal-breaker, or somewhere you can't work (\"remote, but only from the US\" is dropped for someone in Lagos)."],
  ["Keyword ranking, free", "Your skills, roles and what you've shipped, matched against each posting, so your AI reads the most likely ones first."],
  ["Your AI reads the best", "Each gets a score out of 100: domain 25, stack 25, seniority 15, location 20 and the quality of the posting 15, with one reason it fits and the strongest risk."],
  ["Links checked", "Each page is opened to make sure the job is still there. A slow site never hides a job; only a page that's really gone does."],
  ["Your shortlist", "Five to fifteen roles, best first. Mark them Interested, Applied or Not for me; what you set is never changed by the next run."],
];

export default function NanaJobsExplainer() {
  return (
    <>
      <PageHero eyebrow="Notes Jobs / Nana Jobs" title={<>Your shortlist, every morning</>}>
        <p>Connect your own AI. Nana reads hundreds of openings so you read ten, each with why it fits and the strongest reason you might not get it. <strong>It finds and ranks. It never applies for you.</strong></p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/jobs/nana" className="rounded-full bg-paper px-6 py-3 font-ui text-sm font-semibold text-crimson">Set up Nana Jobs</Link>
          <Link href="/explore?tab=jobs" className="rounded-full border border-paper/40 px-6 py-3 font-ui text-sm font-semibold text-paper">Browse Notes Jobs</Link>
        </div>
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <section className="grid gap-6 sm:grid-cols-3">
          <div><h2 className="font-display text-xl text-ink">Bring your own AI</h2><p className="mt-2 text-sm text-slate">Gemini or Groq (both have free tiers), Claude, or any OpenAI-compatible API such as OpenRouter. Your key is checked with a free call and kept encrypted; only its last four characters are ever shown. A paid AI is never used unless you choose it, and free ones are paced to stay inside their limits.</p></div>
          <div><h2 className="font-display text-xl text-ink">Start from your CV</h2><p className="mt-2 text-sm text-slate">Upload your CV (PDF or Word) or paste it. Your AI gives you an honest review (strengths, gaps and quick fixes), the roles that fit, and a profile to start from, with a &quot;shipped&quot; list taken only from your CV. You edit it and confirm. Delete your CV any time.</p></div>
          <div><h2 className="font-display text-xl text-ink">Free on every plan</h2><p className="mt-2 text-sm text-slate">Your own AI pays for the scoring. With no AI connected you still get a free keyword ranking, marked <b>~ rough</b>. For members 18 and up with a personal account; teens keep the normal job board.</p></div>
        </section>
        <h2 className="mt-14 font-display text-3xl text-ink">How hundreds of openings become ten</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2">
          {FUNNEL.map(([t, d], i) => (
            <li key={t} className="card p-5"><p className="font-ui text-xs font-semibold uppercase tracking-wide text-crimson">{i + 1}</p><p className="mt-1 font-display text-xl text-ink">{t}</p><p className="mt-1 text-sm text-slate">{d}</p></li>
          ))}
        </ol>
        <section className="mt-14 grid gap-6 sm:grid-cols-2">
          <div className="card p-6"><h2 className="font-display text-2xl text-ink">Private</h2><p className="mt-2 text-sm text-slate">Your scoring profile, your CV and your shortlist stay on our servers, never shown to firms and never your public profile. Firms still see only what you choose to share in &quot;I need a job&quot;.</p></div>
          <div className="card p-6"><h2 className="font-display text-2xl text-ink">No auto-apply</h2><p className="mt-2 text-sm text-slate">A bot that applies everywhere gets you blocked and wastes good chances. Nana finds the jobs and helps you write a cover note from what you&apos;ve actually shipped, never claiming experience you don&apos;t have. You press Apply. Notes Jobs roles keep the Apply on #NotesApp button.</p></div>
          <div className="card p-6"><h2 className="font-display text-2xl text-ink">When it arrives</h2><p className="mt-2 text-sm text-slate">Every day at the time you choose, and whenever you press Run now. A bell when it&apos;s ready (on to start with), and the list by email if you want it (off to start with).</p></div>
          <div className="card p-6"><h2 className="font-display text-2xl text-ink">No LinkedIn or Indeed scraping</h2><p className="mt-2 text-sm text-slate">Both forbid it. Coming next: forward your LinkedIn job-alert emails to your own Nana Jobs address and they&apos;ll be read too.</p></div>
        </section>
        <p className="mt-10 text-sm text-slate">More in the help article <Link href="/help/nana-jobs" className="text-crimson underline">Nana Jobs</Link>. Nana Jobs builds on Shortlist, an open-source job-search engine by Victor Dickson (MIT licence).</p>
      </div>
    </>
  );
}
