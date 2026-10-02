import Link from "next/link";
import type { Metadata } from "next";
import { ORG_TRIAL_DAYS, ORG_SEATS } from "@/lib/org";
import { GOLD_PRICING } from "@/lib/gold";
import { formatNaira } from "@/lib/booking-time";

export const metadata: Metadata = {
  title: "Organisations",
  description: "Companies, NGOs, churches, schools and other bodies can run a verified #channel on #NotesApp: a free 30-day Business trial, CAC verification, and a team that writes under one name.",
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

export default function OrganisationsPage() {
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
          it&apos;s ₦15,000/month, or the account moves to Free Basic and keeps everything it published. We email you before it ends. Larger bodies can ask about Enterprise.
        </p>
        <Link href="/signup" className="btn-primary mt-4 inline-block">Create an organisation account</Link>
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

      <h2 className="mt-12 font-display text-2xl text-ink">Plans and seats</h2>
      <p className="mt-3 text-sm text-slate">
        Organisations start on Business ({ORG_SEATS.business} seats: the owner plus three team members, counting pending invitations) or Enterprise (seats and commission agreed with us). Team publishing needs one of these plans; if the plan ends, the team can&apos;t publish until it returns, and everything already published stays.{" "}
        <Link href="/pricing" className="text-crimson underline">See pricing</Link> · <Link href="/contact" className="text-crimson underline">Talk to us about Enterprise</Link>
      </p>
    </div>
  );
}
