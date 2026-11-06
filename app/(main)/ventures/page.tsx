import type { Metadata } from "next";
import Link from "next/link";
import VenturesHero from "@/components/ventures/VenturesHero";
import PitchForm from "@/components/ventures/PitchForm";
import { CALL_NAME, CONFIDENTIAL_TERMS, PERKS, REGIONS, REGION_LABEL, VENTURES_NAME } from "@/lib/ventures";

export const metadata: Metadata = {
  title: `${CALL_NAME} · ${VENTURES_NAME}`,
  description: "Pitch the feature, product or business you're sure the crowd would jump into. If it's picked, #NotesApp builds it with you, for equity and a board seat. For ideas and ventures in emerging markets. Every pitch is kept confidential.",
  openGraph: { title: `${CALL_NAME}: pitch your idea to ${VENTURES_NAME}`, description: "We build the picked ideas with you. Emerging markets only. Kept confidential. Perks for every participant." },
};

// /ventures: NotesApp Ventures and its open call, Rewrite the Playbook (lib/ventures.ts). The cover, the old and new playbook, how it
// works, who it's for (emerging markets only), the perks, the terms (kept confidential), the pitch form and the member's own pitches.
const STEPS = [
  { n: "1", title: "Pitch it", body: "Ten minutes: the problem, your idea, who it's for and why you. Signed in with your NotesApp account." },
  { n: "2", title: "We read every pitch", body: "A person on the Ventures team reads each one. Nothing is scored by a machine, and every pitch is kept confidential." },
  { n: "3", title: "Shortlist and talk", body: "If it's shortlisted, we talk it through with you: the market, the plan, what you'd need from us." },
  { n: "4", title: "Build it together", body: "Picked ideas are built with #NotesApp's engineers, platform and guidance, for equity and a board seat, on terms that fit the project." },
];
const LOOK_FOR = [
  ["People already do it", "The best ideas make something people already do easier, cheaper or safer. Not the box. The habit."],
  ["The crowd would jump in", "Something you're sure many people would use or pay for, starting in your own market."],
  ["Built for emerging markets", "For people and businesses in Africa, Latin America, the Middle East, South and Southeast Asia and other emerging markets."],
  ["You know the problem", "You've lived it, worked in it or studied it. Tell us what you know that others don't."],
];
const FAQ = [
  ["Who can pitch?", "Anyone aged 18 or over with a NotesApp account and a verified email, from anywhere, as long as the idea is for people or businesses in emerging markets. You can pitch on your own or as a team."],
  ["What can I pitch?", "A feature for #NotesApp, a new product, or a whole business or venture. It can be an idea on a napkin or something already making money."],
  ["What does #NotesApp ask for in return?", "If we pick your idea and build it with you, we agree terms with you before any work starts: usually equity and a board seat for #NotesApp, in exchange for our engineers, platform, audience and guidance. Terms differ from project to project, and nothing is binding until both sides sign."],
  ["Is my idea safe?", "Your pitch is kept confidential: only the Ventures review team reads it, and we never share it outside #NotesApp without your permission, picked or not. Read the terms on this page before you pitch."],
  ["How many ideas can I pitch?", "Up to three in each round. You can withdraw a pitch while it's being reviewed and send another."],
  ["How will I hear back?", "In your NotesApp notifications: when your pitch is received, read, shortlisted, and picked or not."],
];

export default function VenturesPage() {
  return (
    <>
      <VenturesHero />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[22px] border border-rule bg-card p-6">
            <p className="font-mono text-[11px] uppercase tracking-eyebrow text-slate">The old playbook</p>
            <ul className="mt-4 space-y-2.5 font-display text-xl text-slate">
              {["Spot the idea alone", "Fund it with whatever is left", "Hope to survive long enough to be noticed", "Leave to raise money abroad"].map((x) => (
                <li key={x} className="line-through decoration-[#C8102E] decoration-2">{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[22px] border border-crimson/30 bg-crimson/[0.05] p-6">
            <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">Rewritten</p>
            <ul className="mt-4 space-y-2.5 font-display text-xl text-ink">
              {["Pitch it to #NotesApp", "Build it with our engineers and platform", "Launch it to an audience that's already here", "Grow it from home, in your own market"].map((x) => (
                <li key={x} className="flex gap-2"><span className="text-crimson" aria-hidden="true">✓</span>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-24 bg-field/60">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl text-ink sm:text-4xl">How it works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-[22px] bg-card p-6 shadow-sm ring-1 ring-rule">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-crimson font-display text-lg text-paper">{s.n}</span>
                <p className="mt-4 font-display text-xl text-ink">{s.title}</p>
                <p className="mt-2 text-sm text-slate">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr]">
          <div>
            <h2 className="font-display text-3xl text-ink sm:text-4xl">What we look for</h2>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {LOOK_FOR.map(([t, b]) => <div key={t}><dt className="font-ui font-bold text-ink">{t}</dt><dd className="mt-1 text-sm text-slate">{b}</dd></div>)}
            </dl>
            <p className="mt-8 font-ui text-sm font-bold text-ink">Emerging markets only</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {REGIONS.map((r) => <li key={r} className="rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink">{REGION_LABEL[r]}</li>)}
            </ul>
          </div>
          <div className="rounded-[22px] bg-crimson-deep p-6 text-paper sm:p-8" style={{ backgroundImage: "radial-gradient(30rem 18rem at 100% 0%, rgba(244,184,96,0.25), transparent 70%)" }}>
            <p className="font-mono text-[11px] uppercase tracking-eyebrow text-[#F4B860]">For every participant</p>
            <h2 className="mt-2 font-display text-3xl">Perks, picked or not</h2>
            <ul className="mt-5 space-y-3 text-sm text-paper/90">
              {PERKS.map((p) => <li key={p} className="flex gap-3"><span className="text-[#F4B860]" aria-hidden="true">★</span>{p}</li>)}
            </ul>
            <p className="mt-5 text-xs text-paper/60">The team sends perks once your pitch is received and read.</p>
          </div>
        </div>
      </section>

      <section id="apply" className="scroll-mt-24 border-t border-rule bg-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr,0.8fr] lg:px-8">
          <div>
            <h2 className="font-display text-3xl text-ink sm:text-4xl">Pitch your idea</h2>
            <p className="mt-2 text-slate">Tell us the feature, product or business you&apos;re sure the crowd would jump into.</p>
            <div className="mt-6"><PitchForm /></div>
          </div>
          <aside id="terms" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[22px] border border-rule bg-card p-6">
              <p className="font-display text-xl text-ink">The terms</p>
              <ul className="mt-3 space-y-3 text-sm text-ink">
                {CONFIDENTIAL_TERMS.map((t) => <li key={t} className="flex gap-2"><span className="mt-0.5 text-crimson" aria-hidden="true">●</span><span>{t}</span></li>)}
              </ul>
              <p className="mt-4 text-xs text-slate">Questions? <Link href="/contact" className="text-crimson underline">Contact us</Link>. See also our <Link href="/privacy" className="text-crimson underline">privacy policy</Link>.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-field/60">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-3xl text-ink">Questions</h2>
          <div className="mt-6 divide-y divide-rule rounded-[22px] border border-rule bg-card">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-ui font-bold text-ink">{q}<span className="text-crimson transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
                <p className="mt-3 text-sm text-slate">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center"><a href="#apply" className="inline-block rounded-full bg-crimson px-7 py-3 font-ui text-sm font-bold text-paper">Pitch your idea</a></p>
        </div>
      </section>
    </>
  );
}
