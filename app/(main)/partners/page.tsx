import type { Metadata } from "next";
import Link from "next/link";
import PartnersHero from "@/components/partners/PartnersHero";
import PartnerApplyForm from "@/components/partners/PartnerApplyForm";
import {
  CERTIFY_PAYING, DEFAULT_TERMS, DIRECTORY_PATH, NETWORK_NAME, PARTNER_TERMS, PORTAL_PATH, TIERS, TIER_LABEL, TIER_NEED, TRACK, TRACKS,
  type Tier, type TierTerms,
} from "@/lib/partner-network";
import { getAdminDb } from "@/lib/firebase-admin";
import { directory, tierTerms } from "@/lib/partner-network-server";

// The tier terms come from Admin → Limits (settings/partners); the page is rebuilt at most once a minute.
export const revalidate = 60;

export const metadata: Metadata = {
  title: `${NETWORK_NAME}: partner with #NotesApp`,
  description: "Agencies and experts, associations, workplaces, technology, banks and hubs, media and music, and campus and community chapters: bring #NotesApp to the people you serve and earn a share of the plans they pay for.",
  openGraph: { title: `${NETWORK_NAME}: grow with #NotesApp`, description: "Seven partner tracks, three tiers, a share of members' plans, and a portal to run it all." },
};

// /partners: the NotesApp Partner Network (lib/partner-network.ts). The cover, the seven tracks, the tiers and their shares, how it works,
// the terms, the application form and the member's own applications. The directory is /partners/directory; the portal /partners/portal.
const STEPS = [
  { n: "1", title: "Apply", body: "Choose your track and tell us who you serve and your plan. Ten minutes, with your NotesApp account." },
  { n: "2", title: "We review it", body: "A person on the partnerships team reads every application and may call you. You hear back in your notifications." },
  { n: "3", title: "Set up your portal", body: "Approved partners get a portal: your listing, your link and code, requests, members and earnings." },
  { n: "4", title: "Grow together", body: "Bring members, serve them well, finish the training, and move up to Certified and Premier for a bigger share." },
];
const FAQ = (t: Record<Tier, TierTerms>) => [
  ["How is this different from referrals and affiliates?", "Any member can share a referral link or promote a product as an affiliate. Partners are organisations, or people who commit to more: they serve members, verify them, build on #NotesApp or bring whole communities, and in return get a listing, a badge, a portal and a bigger share as their tier rises."],
  ["How do partners earn?", `Your code is your NotesApp username, so your link is the usual referral link, /r/your-username. Members who join through it are yours. While you're an active partner you earn a share of their plan payments: ${t.registered.percent}% for ${t.registered.months} months as Registered, ${t.certified.percent}% for ${t.certified.months} months as Certified, and ${t.premier.percent}% for ${t.premier.months} months as Premier. Earnings are paid like referral earnings, after the usual hold, as cash or NotesApp Credit.`],
  ["What does it cost?", "Nothing. There's no fee to apply or to be a partner. Solutions partners charge members their own fees for their work, agreed between them."],
  ["How do I become Certified?", TIER_NEED.certified],
  ["Can my association verify its members?", "Yes. Once your association is approved, members ask to be verified from your page on #NotesApp with their membership number. You confirm them in your portal, and a \"Verified member\" badge naming your association appears on their profile. You can remove anyone who leaves."],
  ["What does a workplace see about its staff?", "Only how many staff have joined with your workplace code. Never who they are, and never what anyone booked, bought or wrote: that stays private between them and their practitioner."],
  ["Who can apply?", "Anyone aged 18 or over with a NotesApp account and a verified email, for themselves or for an organisation they're allowed to represent. You can apply to up to three tracks at a time."],
];

export default async function PartnersPage() {
  let terms = DEFAULT_TERMS, listed = 0;
  try { const db = getAdminDb(); [terms, listed] = await Promise.all([tierTerms(db), directory(db).then((d) => d.length)]); } catch { /* defaults until the database answers */ }
  return (
    <>
      <PartnersHero registered={listed} />

      <section id="tracks" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl text-ink sm:text-4xl">Seven ways to partner</h2>
        <p className="mt-2 max-w-2xl text-slate">Choose the track that fits how you work. You can be in more than one.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((k) => {
            const t = TRACK[k];
            return (
              <article key={k} id={`track-${k}`} className="flex flex-col rounded-[22px] border border-rule bg-card p-6">
                <p className="text-3xl" aria-hidden="true">{t.emoji}</p>
                <h3 className="mt-3 font-display text-xl text-ink">{t.label}</h3>
                <p className="mt-2 text-sm text-slate">{t.who}</p>
                <p className="mt-4 font-ui text-xs font-bold uppercase tracking-wide text-slate">You get</p>
                <ul className="mt-2 space-y-1.5 text-sm text-ink">{t.get.map((g) => <li key={g} className="flex gap-2"><span className="text-crimson" aria-hidden="true">✓</span>{g}</li>)}</ul>
                <p className="mt-4 font-ui text-xs font-bold uppercase tracking-wide text-slate">You</p>
                <ul className="mt-2 space-y-1.5 text-sm text-slate">{t.you.map((g) => <li key={g} className="flex gap-2"><span aria-hidden="true">•</span>{g}</li>)}</ul>
                <a href={`#apply-${k}`} className="mt-auto pt-5 font-ui text-sm font-bold text-crimson">Apply for this track →</a>
              </article>
            );
          })}
        </div>
      </section>

      <section id="tiers" className="scroll-mt-24 bg-field/60">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl text-ink sm:text-4xl">Three tiers</h2>
          <p className="mt-2 max-w-2xl text-slate">The share is of the plan payments of members who join through your link or code, for the months shown from each member&apos;s first payment.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {TIERS.map((k, i) => (
              <div key={k} className={`rounded-[22px] p-6 ${i === 2 ? "bg-crimson-deep text-paper" : "bg-card ring-1 ring-rule"}`}>
                <p className={`font-mono text-[11px] uppercase tracking-eyebrow ${i === 2 ? "text-[#F4B860]" : "text-crimson"}`}>{TIER_LABEL[k]}</p>
                <p className={`mt-3 font-display text-5xl ${i === 2 ? "text-paper" : "text-ink"}`}>{terms[k].percent}%</p>
                <p className={`mt-1 text-sm ${i === 2 ? "text-paper/80" : "text-slate"}`}>of members&apos; plans, for {terms[k].months} months</p>
                <p className={`mt-4 text-sm ${i === 2 ? "text-paper/85" : "text-ink"}`}>{TIER_NEED[k]}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-slate">Certified needs {CERTIFY_PAYING} paying members brought, or verified members for associations and chapters; your portal shows your progress. Shares can change; members you&apos;ve already brought keep earning you the share of the day they paid.</p>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8">
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
        <p className="mt-8 text-sm text-slate">Looking for help with your NotesApp, your association or your workplace&apos;s page? <Link href={DIRECTORY_PATH} className="font-semibold text-crimson underline">Browse the partner directory</Link>. Already a partner? <Link href={PORTAL_PATH} className="font-semibold text-crimson underline">Open your portal</Link>.</p>
      </section>

      <section id="apply" className="scroll-mt-24 border-t border-rule bg-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr,0.8fr] lg:px-8">
          <div>
            <h2 className="font-display text-3xl text-ink sm:text-4xl">Become a partner</h2>
            <p className="mt-2 text-slate">Free to apply. A person on the partnerships team reviews every application.</p>
            <div className="mt-6"><PartnerApplyForm /></div>
          </div>
          <aside id="terms" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[22px] border border-rule bg-card p-6">
              <p className="font-display text-xl text-ink">The partner terms</p>
              <ul className="mt-3 space-y-3 text-sm text-ink">
                {PARTNER_TERMS.map((t) => <li key={t} className="flex gap-2"><span className="mt-0.5 text-crimson" aria-hidden="true">●</span><span>{t}</span></li>)}
              </ul>
              <p className="mt-4 text-xs text-slate">Read more in <Link href="/help/notesapp-partner-network" className="text-crimson underline">the help centre</Link>, the <Link href="/brand" className="text-crimson underline">brand guide</Link> and our <Link href="/privacy" className="text-crimson underline">privacy policy</Link>.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-field/60">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-3xl text-ink">Questions</h2>
          <div className="mt-6 divide-y divide-rule rounded-[22px] border border-rule bg-card">
            {FAQ(terms).map(([q, a]) => (
              <details key={q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-ui font-bold text-ink">{q}<span className="text-crimson transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
                <p className="mt-3 text-sm text-slate">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center"><a href="#apply" className="inline-block rounded-full bg-crimson px-7 py-3 font-ui text-sm font-bold text-paper">Become a partner</a></p>
        </div>
      </section>
    </>
  );
}
