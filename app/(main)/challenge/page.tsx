import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "#1MillionNairaNotesAppChallenge",
  description:
    "Coming soon: the #1MillionNairaNotesAppChallenge for influencers. Reach 100k views and 10k followers to unlock LIVE video, then hit 2k registered members watching one live to open a ₦1,000,000 giveaway.",
};

const STEPS = [
  {
    n: "1",
    title: "Reach the bar",
    body: "100,000 views and 10,000 followers, and the 10,000 must be new: people who joined #NotesApp through you after you enrolled, not members who were already here. Hit both and the LIVE video button turns on for your account.",
  },
  {
    n: "2",
    title: "Go live",
    body: "Start a live on #NotesApp for your audience. Only registered #NotesApp members count towards your live audience.",
  },
  {
    n: "3",
    title: "Reach 2,000 in one live",
    body: "2,000 registered members watching in a single live, each for at least 5 minutes. It has to happen in one live — viewers from separate lives are not added together.",
  },
  {
    n: "4",
    title: "The giveaway opens",
    body: "Once a live you started reaches 2,000 counted viewers, the giveaway opens for that live automatically. It is split three ways below.",
  },
];

const PRIZES = [
  {
    amount: "₦250,000",
    to: "Your followers",
    body: "In Bonus Credits, between ₦5,000 and ₦25,000 each, for followers who watched your live for at least 5 minutes, chosen by you from a list of the most active. Any follower can be picked, as long as they aren&apos;t a bot and didn&apos;t get on the list by fraud. Each follower also gets 1 month of the personal maroon ✔, and both arrive automatically once they are identity-checked (NIN and face match, through Dojah). They can upgrade to the gold ✔ with their Bonus Credits. Bonus Credits can be spent on calls, advert banner payments, boosts and badges only.",
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
    <>
      <PageHero eyebrow="Coming Soon · For influencers" title={<>#1MillionNairaNotesAppChallenge</>}>
        <p>Bring your audience to #NotesApp, go live, and open a ₦1,000,000 giveaway — for you and for the followers who show up.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

      <Image
        src="/images/challenge/challenge-banner.webp"
        alt="#1MillionNairaNotesAppChallenge for influencers: ₦10m up for grabs each month. Reach 100k views and 10k new followers, go live, reach 2,000 viewers in one live, and the ₦1,000,000 giveaway opens."
        width={2000}
        height={1125}
        priority
        sizes="(min-width: 896px) 896px, 100vw"
        className="mt-8 h-auto w-full rounded-lg border border-rule"
      />

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
        <h2 id="prizes" className="font-display text-2xl text-ink">What each ₦1,000,000 is made of</h2>
        <p className="mt-2 text-sm text-slate">Up to ₦10,000,000 a month: ₦1,000,000 each for the first 10 influencers who qualify.</p>
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

      <section className="mt-12" aria-labelledby="rules">
        <h2 id="rules" className="font-display text-2xl text-ink">The ground rules</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate">
          <li>Every view, follower and live viewer is counted and checked. Fake accounts, bots and self-viewing don&apos;t count, and an account that tries them is disqualified.</li>
          <li>Enrolled influencers get a private challenge dashboard showing their qualified followers, views and live audience against each bar, and the status of any prize.</li>
          <li>Each influencer can win once, and the first 10 influencers to qualify each month are paid.</li>
          <li>A viewer counts after 5 minutes of watching. Your follower picks come from a list of the viewers who were most active in the last 5 minutes of your live, ranked by shares, then likes, then comments. You can&apos;t pick yourself, your own other accounts, or accounts linked to you.</li>
          <li>Before the ₦500,000 cash payout we confirm your identity (NIN and a face match, through Dojah) and handle any tax that applies.</li>
          <li>The influencer also gets 1 month of the identity-checked gold ✔ badge, free. Every prize has a 30-day claim window, and an unclaimed prize expires.</li>
          <li>Bonus Credits can&apos;t be transferred or cashed out.</li>
        </ul>
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
    </>
  );
}
