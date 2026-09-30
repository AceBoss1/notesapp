import Link from "next/link";
import type { Metadata } from "next";
import VerifiedBadge from "@/components/VerifiedBadge";
import TeamBadge from "@/components/TeamBadge";
import BadgeCard from "@/components/BadgeCard";
import EndorsementRequest from "@/components/EndorsementRequest";
import { BADGE_PRICE_KOBO, TIERS, badgeIncluded } from "@/lib/tiers";
import { formatNaira } from "@/lib/booking-time";

export const metadata: Metadata = {
  title: "Verification badges",
  description:
    "What the #NotesApp team badge, the verified ✔ and the upcoming gold badge mean, who gets them, and how to add the verified badge to your profile.",
};

const FAQ = [
  {
    q: "Does the maroon ✔ mean #NotesApp checked my identity?",
    a: "No. It shows an account in good standing that is on an eligible plan or has the badge subscription. Identity checks and endorsements are what the gold badge is for — endorsements are open now, identity checks are coming soon.",
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
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Product</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">Verification badges</h1>
      <p className="mt-5 max-w-2xl text-lg text-slate">
        Three marks, three different meanings. Here's who has which, what each one does and doesn't tell you, and how to
        get the one you can add today.
      </p>

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
            Identity-checked gold (ID, business registration or professional credential) is coming soon.
          </p>
          <p className="mt-3 font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">Endorsement: apply now · Identity: coming soon</p>
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
                <td className="px-4 py-3 text-slate">Endorsement: by application · Identity: coming soon</td>
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

      <EndorsementRequest />

      <div className="card mt-6 p-6">
        <p className="flex items-center gap-2 font-ui text-sm font-bold text-ink">
          <VerifiedBadge size={16} level="gold" /> About the gold badge
        </p>
        <p className="mt-2 text-sm text-slate">
          <strong className="text-ink">Endorsement is open.</strong> Apply below with a short description and links to your
          public work; an admin reviews it by hand. We don&apos;t collect ID documents for endorsement. Identity-checked gold
          (ID, business registration or professional credential) will follow once we add a verification partner — any fee
          will be published here first. Want to be told?{" "}
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
  );
}
