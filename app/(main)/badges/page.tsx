import Link from "next/link";
import type { Metadata } from "next";
import VerifiedBadge from "@/components/VerifiedBadge";
import TeamBadge from "@/components/TeamBadge";
import BadgeCard from "@/components/BadgeCard";
import GoldBadgeApplication from "@/components/GoldBadgeApplication";
import { GOLD_PRICING } from "@/lib/gold";
import { GOLD_KIND_LIVE } from "@/lib/badges";
import { BADGE_PRICE_KOBO, TIERS, badgeIncluded } from "@/lib/tiers";
import { formatNaira } from "@/lib/booking-time";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Verification badges",
  description:
    "What the #NotesApp team badge, the verified ✔ and the gold badge (endorsed or identity-checked) mean, who gets them, and how to add the verified badge to your profile.",
};

const FAQ = [
  {
    q: "Does the maroon ✔ mean #NotesApp checked my identity?",
    a: "No. It shows an account in good standing that is on an eligible plan or has the badge subscription. Identity checks and endorsements are what the gold badge is for — endorsements are open now, identity checks are " + (GOLD_KIND_LIVE.identity ? "open too." : "coming soon."),
  },
  {
    q: "How does the maroon ✔ work for organisations?",
    a: "An organisation's maroon ✔ means two things together: its CAC registration has been confirmed by #NotesApp, and it is on an eligible plan (Business and Enterprise include it). Until we confirm the registration, the channel shows an \"unverified organisation\" notice instead of the ✔, and so does each of its posts — including during the free trial. It still isn't an identity check: for that, apply for the gold badge (Corporate track).",
  },
  {
    q: "What is the gold badge?",
    a: "A gold ✔ for accounts #NotesApp has vouched for. It comes in two kinds: endorsed (we reviewed your public work and back you) and identity-checked (you passed an ID check — NIN plus a live face check for people, CAC registration for organisations). It shows beside your name on your profile, the directory and your posts, and replaces the maroon ✔ while active.",
  },
  {
    q: "How much does gold cost?",
    a: "The same on every plan: ₦1,999/month for individuals, ₦2,999/month for organisations. Applying and being reviewed for an endorsement is free. An identity check adds a one-off deposit (₦999 personal, ₦1,999 organisation) paid before review.",
  },
  {
    q: "Is the identity deposit refundable?",
    a: "No. It covers the third-party check whether or not it passes. Endorsement has no deposit.",
  },
  {
    q: "What happens to my ID documents?",
    a: "We don't collect or store them. Identity checks run with our verification partner, Dojah, and an admin only sees the outcome.",
  },
  {
    q: "How long does review take, and what if I'm declined?",
    a: "Admins review applications by hand and the status shows on this page. If you're declined you can apply again with more detail (a new identity check needs a new deposit).",
  },
  {
    q: "Can I cancel gold?",
    a: "Yes, any time from this page. You keep the gold ✔ until the period you've paid for ends.",
  },
  {
    q: "Can I buy the #NotesApp team badge?",
    a: "No. It is reserved for #NotesApp staff, guest writers and the official accounts, and is set by admins.",
  },
  {
    q: "What happens to my badge if I cancel or downgrade?",
    a: "You keep the verified badge until the end of the period you've paid for. If you were on Business and move to a lower plan, the free badge goes with the plan unless you add the ₦999 badge subscription.",
  },
  {
    q: "Where do badges show?",
    a: "Next to your name on your profile, in the people directory and on the byline of your posts.",
  },
  {
    q: "Can a badge be removed?",
    a: "Yes — without refund — if an account is suspended, or impersonates or misleads others. See our Terms.",
  },
  {
    q: "I think someone is impersonating me or a brand.",
    a: "Tell us through the contact form using “Report a post or account”. We review every report.",
  },
];

export default function BadgesPage() {
  return (
    <>
      <PageHero eyebrow="Product" title={<>Verification badges</>}>
        <p>Three marks, three different meanings. Here's who has which, what each one does and doesn't tell you, and how to
        get the one you can add today.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="card p-6">
          <p className="flex items-center gap-2 font-ui text-base font-bold text-ink">
            <TeamBadge size={22} /> #NotesApp team
          </p>
          <p className="mt-3 text-sm text-slate">
            Staff, guest writers and the official accounts. It sits beside the ✔ so you can tell the people who run and write for
            #NotesApp from everyone else.
          </p>
          <p className="mt-3 font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">Not for sale · set by admins</p>
        </div>
        <div className="card p-6">
          <p className="flex items-center gap-2 font-ui text-base font-bold text-ink">
            <VerifiedBadge size={22} /> Verified
          </p>
          <p className="mt-3 text-sm text-slate">
            An account in good standing with an eligible plan or badge subscription. <strong className="text-ink">It is not an
            identity check or an endorsement.</strong>
          </p>
          <p className="mt-3 font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
            Free on Business &amp; Enterprise · {formatNaira(BADGE_PRICE_KOBO)}/month otherwise
          </p>
        </div>
        <div className="card p-6">
          <p className="flex items-center gap-2 font-ui text-base font-bold text-ink">
            <VerifiedBadge size={22} level="gold" /> Gold
          </p>
          <p className="mt-3 text-sm text-slate">
            An account that #NotesApp has reviewed and endorses — a real person or organisation with a public track record.
            Identity-checked gold (ID, business registration or professional credential) is {GOLD_KIND_LIVE.identity ? "now open" : "coming soon"}.
          </p>
          <p className="mt-3 font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">Personal {formatNaira(GOLD_PRICING.personal.monthlyKobo)}/mo · Corporate {formatNaira(GOLD_PRICING.corporate.monthlyKobo)}/mo</p>
        </div>
      </div>

      <div className="mt-12 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b-2 border-ink py-3 pr-4 font-ui text-slate">Plan</th>
              <th className="border-b-2 border-ink px-4 py-3 font-ui text-ink">Verified ✔</th>
              <th className="border-b-2 border-ink px-4 py-3 font-ui text-ink">Gold</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t) => (
              <tr key={t.tier} className="border-b border-rule">
                <td className="py-3 pr-4 font-ui font-semibold text-ink">{t.label}</td>
                <td className="px-4 py-3 text-slate">
                  {badgeIncluded(t.tier) ? "Included free" : `Add-on: ${formatNaira(BADGE_PRICE_KOBO)}/month`}
                </td>
                <td className="px-4 py-3 text-slate">{formatNaira(GOLD_PRICING.personal.monthlyKobo)}/mo personal · {formatNaira(GOLD_PRICING.corporate.monthlyKobo)}/mo corporate — same on every plan</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate">
          The verified badge is also included for #NotesApp staff, guest writers and admins. Compare plans on the{" "}
          <Link href="/pricing" className="text-crimson underline">pricing page</Link>.
        </p>
      </div>

      <div className="mt-12">
        <BadgeCard pitch />
      </div>

      <GoldBadgeApplication />

      <div className="card mt-6 p-6">
        <p className="flex items-center gap-2 font-ui text-sm font-bold text-ink">
          <VerifiedBadge size={16} level="gold" /> About the gold badge
        </p>
        <p className="mt-2 text-sm text-slate">
          <strong className="text-ink">Endorsement is open.</strong> Apply below with a short description and links to your
          public work; an admin reviews it by hand at no charge. If approved, gold is {formatNaira(GOLD_PRICING.personal.monthlyKobo)}/month
          for individuals or {formatNaira(GOLD_PRICING.corporate.monthlyKobo)}/month for organisations, on every plan. We don&apos;t
          collect ID documents. <strong className="text-ink">Identity-checked gold is {GOLD_KIND_LIVE.identity ? "now open" : "coming soon"}</strong>: a one-off,
          non-refundable verification deposit ({formatNaira(GOLD_PRICING.personal.identityDepositKobo)} personal /{" "}
          {formatNaira(GOLD_PRICING.corporate.identityDepositKobo)} corporate) covers the third-party check, then the same monthly price applies. Want to be told?{" "}
          <Link href="/contact" className="text-crimson underline underline-offset-2">Register your interest</Link>.
        </p>
      </div>

      <div className="mt-12">
        <p className="eyebrow">Questions</p>
        <dl className="mt-4 divide-y divide-rule border-y border-rule">
          {FAQ.map((f) => (
            <div key={f.q} className="py-4">
              <dt className="font-ui text-sm font-bold text-ink">{f.q}</dt>
              <dd className="mt-1 text-sm text-slate">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
    </>
  );
}
