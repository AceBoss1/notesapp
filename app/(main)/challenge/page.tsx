import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "#1MillionNairaNotesAppChallenge",
  description:
    "Coming soon: the #1MillionNairaNotesAppChallenge for influencers. Reach 100k views and 10k followers to unlock LIVE video, then hit 2k registered members watching one live to open a ₦1,000,000 giveaway.",
};

const STEPS = [
  {
    n: "1",
    title: "Reach the bar",
    body: "100,000 views and 10,000 followers. Hit both and the LIVE video button turns on for your account.",
  },
  {
    n: "2",
    title: "Go live",
    body: "Go live on #NotesApp for your audience. Only registered #NotesApp members count towards your live audience.",
  },
  {
    n: "3",
    title: "Reach 2,000 in one live",
    body: "2,000 registered members watching in a single live. It has to happen in one live — viewers from separate lives are not added together.",
  },
  {
    n: "4",
    title: "The giveaway opens",
    body: "The ₦1,000,000 giveaway opens, split three ways below.",
  },
];

const PRIZES = [
  {
    amount: "₦250,000",
    to: "Your followers",
    body: "In Bonus Credits, shared among followers who are watching your live, chosen by you.",
  },
  {
    amount: "₦250,000",
    to: "You",
    body: "In NotesApp Credit, to spend on anything on the platform: shops, services, calls, boosts and more.",
  },
  {
    amount: "₦500,000",
    to: "You, in cash",
    body: "Withdrawable to your bank account straight away.",
  },
];

export default function ChallengePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Coming Soon · For influencers</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        #1MillionNairaNotesAppChallenge
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-slate">
        Bring your audience to #NotesApp, go live, and open a ₦1,000,000 giveaway — for you and for the followers who show up.
      </p>

      {/* Landscape graphics go here once ready. */}

      <section className="mt-12" aria-labelledby="how">
        <h2 id="how" className="font-display text-2xl text-ink">How it works</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">Step {s.n}</span>
              <h3 className="mt-2 font-display text-xl text-ink">{s.title}</h3>
              <p className="mt-2 text-sm text-slate">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12" aria-labelledby="prizes">
        <h2 id="prizes" className="font-display text-2xl text-ink">What the ₦1,000,000 is made of</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PRIZES.map((p) => (
            <div key={p.to} className="card border-crimson p-6">
              <p className="font-display text-3xl text-ink">{p.amount}</p>
              <p className="mt-1 font-ui text-sm font-bold text-ink">{p.to}</p>
              <p className="mt-2 text-sm text-slate">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 card border-dashed p-7">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">Not live yet</span>
        <p className="mt-3 text-sm text-slate">
          The challenge opens when live video does. Until then, nothing here can be claimed. We&apos;ll confirm the full rules before launch, including how views, followers and live audiences are counted and checked, and amounts and conditions may change before then.
        </p>
        <p className="mt-3 text-sm text-slate">
          Want to be first to know? <Link href="/signup" className="text-crimson underline underline-offset-2">Create your #NotesApp account</Link> and keep an eye on the <Link href="/roadmap" className="text-crimson underline underline-offset-2">roadmap</Link> and <Link href="/changelog" className="text-crimson underline underline-offset-2">changelog</Link>.
        </p>
      </section>
    </div>
  );
}
