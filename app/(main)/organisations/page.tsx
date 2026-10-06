import Link from "next/link";
import type { Metadata } from "next";
import { ORG_TRIAL_DAYS, ORG_SEATS } from "@/lib/org";
import { GOLD_PRICING } from "@/lib/gold";
import { formatNaira } from "@/lib/booking-time";
import { getTierConfig } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "Organisations",
  description: "Companies, NGOs, churches, schools and other bodies can run a verified #channel on #NotesApp: a free 30-day Business trial, CAC verification, a team that writes under one name, and Enterprise: your own branded site on your own domain, an API, and rates agreed with us.",
};

const STEPS = [
  ["Sign up as an Organisation", "Choose “Organisation”, enter the name and your CAC registration number (RC, BN or IT), and use a work email."],
  ["Verify your email", "Click the link we send you. The free trial starts once your email is verified."],
  ["Start your free Business trial", `${ORG_TRIAL_DAYS} days of the Business plan, no card needed. One trial per registration number.`],
  ["Set up your channel", "Add your logo, description and website under Edit profile. Your channel lives at /u/yourname like any journal."],
  ["We confirm your registration", "An admin checks your number against the CAC register. Once confirmed, the “unverified” notice goes and the maroon ✔ shows (Business and Enterprise include it)."],
  ["Optional: the gold badge", "Apply for the Corporate gold badge — endorsement or an identity check against the CAC register."],
  ["Invite your team", "Invite writers and admins by @username or email. They publish under your channel's name, shown as “by @person for #YourOrg”. Everything those posts earn goes to your organisation's single payout account, set by the owner."],
];

const ENTERPRISE = [
  ["Your own branded site", "Your name and logo, on your own domain (notes.yourbrand.com or yourbrand.com): a Home page with your profile and booking, a Notes page and a Shop. A small “powered by #NotesApp” footer, and your logo as the tab icon. Visitors sign in, comment, book sessions and buy without leaving your site."],
  ["Rates agreed with us", "Enterprise isn't a fixed price list. We agree your commission on sessions, store sales and downloads, and your share of the ad revenue on your pages, for your account."],
  ["API, webhooks and a Console", "Publish posts from your own systems, read bookings, orders and earnings, and get signed webhooks when a booking is made or an order is paid. Keys and webhooks are managed in the Console; the docs are public."],
  ["Seats and onboarding", "A team size that fits you, with the maroon ✔ included, and onboarding help from us to set up your channel, domain and payouts."],
];

export default function OrganisationsPage() {
  const e = getTierConfig("enterprise");
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Organisations</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">A #channel for your organisation</h1>
      <p className="mt-5 text-lg text-slate">
        Companies, NGOs, churches, schools and clubs publish on #NotesApp the same way people do — with a registered-organisation
        label, CAC verification and, soon, a team.
      </p>

      <div className="card mt-10 border-crimson p-7">
        <p className="font-ui text-base font-bold text-ink">{ORG_TRIAL_DAYS} days of Business, free</p>
        <p className="mt-2 text-sm text-slate">
          New organisations get the Business plan free for {ORG_TRIAL_DAYS} days — 45% ad share, the lower 15% commission and the included ✔ once verified. Afterwards
          it&apos;s ₦15,000/month, or the account moves to Free Basic and keeps everything it published. We email you before it ends. Larger bodies can ask about <a href="#enterprise" className="text-crimson underline">Enterprise</a>.
        </p>
        <Link href="/signup" className="btn-primary mt-4 inline-block">Create an organisation account</Link>
      </div>

      <div id="enterprise" className="card mt-10 p-7">
        <p className="eyebrow">Enterprise</p>
        <h2 className="mt-2 font-display text-2xl text-ink">For larger organisations and businesses</h2>
        <p className="mt-3 text-sm text-slate">
          When a channel isn&apos;t enough, Enterprise gives you your own site, your own domain and your own terms, running on the same publishing,
          booking and payments platform. Precheks, our first reference customer, runs this way at{" "}
          <a href="https://notes.precheks.com.ng" className="text-crimson underline">notes.precheks.com.ng</a>.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {ENTERPRISE.map(([t, d]) => (
            <li key={t} className="rounded-xl2 border border-rule p-4">
              <p className="font-ui text-sm font-bold text-ink">{t}</p>
              <p className="mt-1 text-sm text-slate">{d}</p>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-slate">
          Enterprise starts at ₦35,000/month. Rates start at {((e.sessionAndUnlockCommissionFloor ?? 0.05) * 100).toFixed(0)}% commission on sessions, {+((e.physicalCommissionFloor ?? 0.01) * 100).toFixed(1)}% on store items and {+((e.digitalCommissionFloor ?? 0.015) * 100).toFixed(1)}% on downloads, with a {((e.adRevenueShare ?? 0.75) * 100).toFixed(0)}% ad share, and are confirmed with you before you start. API access and your domain are switched on for your account by us.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/contact?topic=api" className="btn-primary !px-5 !py-2 text-sm">Talk to us about Enterprise</Link>
          <Link href="/pricing" className="btn-ghost !px-5 !py-2 text-sm">Compare plans</Link>
          <Link href="/docs" className="btn-ghost !px-5 !py-2 text-sm">API docs</Link>
        </div>
      </div>

      <h2 className="mt-12 font-display text-2xl text-ink">How onboarding works</h2>
      <ol className="mt-4 space-y-3">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="card p-4">
            <p className="font-ui text-sm font-bold text-ink">{i + 1}. {t}</p>
            <p className="mt-1 text-sm text-slate">{d}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 font-display text-2xl text-ink">What the badges mean for organisations</h2>
      <div className="card mt-4 p-6 text-sm text-slate">
        <p><strong className="text-ink">Unverified organisation.</strong> You can publish straight away (including during the trial), but your channel and every post carry a notice that we haven&apos;t confirmed your registration yet.</p>
        <p className="mt-3"><strong className="text-ink">Maroon ✔.</strong> Registration confirmed by #NotesApp, on a plan that includes the badge. It isn&apos;t an identity check.</p>
        <p className="mt-3"><strong className="text-ink">Gold ✔.</strong> Endorsed or identity-checked by #NotesApp. Corporate track: {formatNaira(GOLD_PRICING.corporate.monthlyKobo)}/month, plus a {formatNaira(GOLD_PRICING.corporate.identityDepositKobo)} non-refundable deposit for an identity check. <Link href="/badges" className="text-crimson underline">Details</Link></p>
      </div>

      <h2 className="mt-12 font-display text-2xl text-ink">Selling from your organisation&apos;s store</h2>
      <div className="card mt-4 p-6 text-sm text-slate">
        <p>
          Your organisation has its own store at <code>/u/yourname/store</code>. The owner lists physical items (price, delivery fee and a stock count) and digital downloads; buyers pay through #NotesApp,
          and the money is held until they confirm delivery (downloads: after a short dispute window), then paid to the <strong className="text-ink">organisation&apos;s</strong> payout account. Every physical order gets a parcel ID to track.
        </p>
        <p className="mt-3">
          <strong className="text-ink">Who runs it.</strong> The owner can run the store alone, or tick &ldquo;runs the store&rdquo; for chosen team members on the team page. Those members can add and
          edit items and handle orders and tracking — but the funds, the payouts and the liability always stay with the organisation, never with the individual. Store access
          needs the Business or Enterprise plan.
        </p>
        <p className="mt-3"><Link href="/store-selling" className="text-crimson underline">How selling, stock and parcel tracking work →</Link></p>
      </div>

      <h2 className="mt-12 font-display text-2xl text-ink">Moving existing posts into the organisation</h2>
      <p className="mt-3 text-sm text-slate">
        Already publishing under a personal journal? Ask us (<Link href="/contact" className="text-crimson underline">contact</Link>) to move selected posts to the organisation&apos;s channel. They keep their web addresses, now appear under the
        organisation&apos;s name, and credit the person who wrote them as &ldquo;Written by @person for #Org&rdquo;. Gifts and ad share from them go to the organisation from then on.
      </p>

      <h2 className="mt-12 font-display text-2xl text-ink">Plans and seats</h2>
      <p className="mt-3 text-sm text-slate">
        Organisations start on Business ({ORG_SEATS.business} seats: the owner plus three team members, counting pending invitations) or Enterprise (seats and commission agreed with us). Team publishing needs one of these plans; if the plan ends, the team can&apos;t publish until it returns, and everything already published stays.{" "}
        <Link href="/pricing" className="text-crimson underline">See pricing</Link> · <Link href="/contact" className="text-crimson underline">Talk to us about Enterprise</Link>
      </p>
    </div>
  );
}
