import type { Metadata } from "next";
import Link from "next/link";
import { TIERS, formatPercent, badgeIncluded, BADGE_PRICE_KOBO } from "@/lib/tiers";
import { GOLD_PRICING } from "@/lib/gold";
import { BOOST_PACKAGES } from "@/lib/boost-config";
import UpgradeButton from "@/components/UpgradeButton";
import BadgeCard from "@/components/BadgeCard";
import VerifiedBadge from "@/components/VerifiedBadge";
import { LIMITS, formatNaira } from "@/lib/booking-time";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "#NotesApp's tier ladder — Free Standard for readers, Free Basic through Enterprise for publishers, with transparent ad revenue share and booking/unlock/merch commission at every level.",
};

const ROWS: { label: string; render: (t: (typeof TIERS)[number]) => string }[] = [
  { label: "Can publish?", render: (t) => (t.canPublish ? "Yes" : "No — read & engage only") },
  {
    label: "Ad revenue share",
    render: (t) =>
      t.adRevenueShare === null ? "—" : t.adRevenueShare === 0 ? "0% (ads run, no share)" : `${(t.adRevenueShare * 100).toFixed(0)}%`,
  },
  {
    label: "Commission on sessions, subscriptions & gifts",
    render: (t) =>
      t.canPublish
        ? `NotesApp takes ${formatPercent(t.sessionAndUnlockCommission, t.sessionAndUnlockCommissionFloor)}`
        : "—",
  },
  {
    label: "Verified badge ✔ (see /badges)",
    render: (t) => (badgeIncluded(t.tier) ? "Included free" : `Add-on: ${formatNaira(BADGE_PRICE_KOBO)}/month`),
  },
  {
    label: "Gold badge (identity checked / endorsed)",
    render: () => `${formatNaira(GOLD_PRICING.personal.monthlyKobo)}/mo personal · ${formatNaira(GOLD_PRICING.corporate.monthlyKobo)}/mo corporate (endorsement, by application; identity check coming soon)`,
  },
  {
    label: "Paid 1:1 sessions",
    render: (t) => (t.canPublish ? `You set the price: ${formatNaira(LIMITS.sessionMinKobo)} – ${formatNaira(LIMITS.sessionMaxKobo)}` : "Book & pay only"),
  },
  {
    label: "Monthly journal subscriptions",
    render: (t) => (t.canPublish ? `You set the price: ${formatNaira(LIMITS.subscriptionMinKobo)} – ${formatNaira(LIMITS.subscriptionMaxKobo)}/month` : "Subscribe & unlock only"),
  },
  {
    label: "Gifts from readers",
    render: (t) => (t.canPublish ? "Receive gifts of ₦200 – ₦500,000 on your profile and every post" : "Send gifts"),
  },
  {
    label: "Post boosts",
    render: (t) => (t.canPublish ? `From ${formatNaira(BOOST_PACKAGES[0].priceKobo)} · no commission · undelivered impressions refunded` : "—"),
  },
  {
    label: "Payouts to your bank",
    render: (t) => (t.canPublish ? "Sessions after they happen · subscriptions & gifts after 7 days" : "—"),
  },
  {
    label: "Internal merch store commission",
    render: (t) => (t.canPublish ? `NotesApp takes ${formatPercent(t.merchCommission, t.merchCommissionFloor)}` : "—"),
  },
  {
    label: "External store (Selar, Amazon, etc.)",
    render: (t) => (t.canPublish ? (t.externalStoreAllowed ? "Available" : "Not available") : "—"),
  },
  { label: "AI draft assistance", render: (t) => (t.canPublish ? "Planned — included on every publisher tier" : "—") },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Pricing</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        One ladder, transparent at every rung
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-slate">
        Reading, commenting, booking a session, unlocking a locked
        journal, and buying merch are always free to do. Publishing
        your own journal opens the ladder below — the more you commit
        to the platform, the less commission NotesApp takes on what
        you earn through it.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-slate">
        Publishers set their own prices — sessions from ₦5,000 to
        ₦500,000, monthly journal subscriptions from ₦1,000 to
        ₦100,000. The commission below comes out of each paid session
        or subscription; you're paid to your verified bank account
        after the session (subscriptions after a 7-day dispute window).
        AI drafting from your past notes is planned for every publisher
        tier — it won't be a paid-tier perk.
      </p>

      <div className="mt-12 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr>
              <th className="border-b-2 border-ink py-4 pr-4 font-ui text-sm text-slate">
                &nbsp;
              </th>
              {TIERS.map((t) => (
                <th key={t.tier} className="border-b-2 border-ink px-4 py-4">
                  <p className="font-display text-xl text-ink">{t.label}</p>
                  <p className="mt-1 font-mono text-sm text-crimson-bright">{t.price}</p>
                  {t.priceNote && <p className="mt-1 max-w-[11rem] text-xs font-normal text-slate">{t.priceNote}</p>}
                  {(t.tier === "pro" || t.tier === "business") && <UpgradeButton tier={t.tier} label={t.label} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-rule">
                <td className="py-4 pr-4 font-ui text-sm font-semibold text-ink">{row.label}</td>
                {TIERS.map((t) => (
                  <td key={t.tier} className="px-4 py-4 text-sm text-slate">
                    {row.render(t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="card p-6">
          <p className="font-ui text-sm font-bold text-ink">How to move up the ladder</p>
          <p className="mt-2 text-sm text-slate">
            Free Standard → Free Basic is a self-serve application from
            your own profile (Rates &amp; payouts), reviewed by an admin — no payment
            involved. Pro (₦5,000/month) and Business (₦15,000/month) are
            paid plans you can start right from this table — monthly or
            yearly (two months free), renewing automatically through
            Paystack. Cancel any time under Rates &amp; payouts: you keep the
            plan until the period you paid for ends, with no partial
            refunds. Enterprise is custom —{" "}
            <Link href="/contact" className="text-crimson underline underline-offset-2">
              contact us
            </Link>
            . As a rule of thumb, Pro pays for itself once
            you earn about ₦50,000 a month through sessions, subscriptions
            and gifts (its commission is 10 points lower than Free Basic's);
            Business does at about ₦75,000 a month.
          </p>
        </div>
        <div className="card p-6">
          <p className="font-ui text-sm font-bold text-ink">
            Why external stores are restricted
          </p>
          <p className="mt-2 text-sm text-slate">
            An external link-out (Selar, Amazon, etc.) is revenue
            NotesApp never takes a commission on. That option stays
            available to the founder's and guest writer's existing stores and to
            Enterprise — everyone else sells through NotesApp's own
            internal fulfillment, where the commission table on the
            left actually applies.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <BadgeCard pitch />
      </div>

      <div className="card mt-6 p-6">
        <p className="font-ui text-sm font-bold text-ink">
          <span className="mr-1.5"><VerifiedBadge size={14} level="gold" /></span>Gold badge — endorsement open, identity check coming soon
        </p>
        <p className="mt-2 text-sm text-slate">
          The maroon ✔ shows an account in good standing. The <strong className="text-ink">gold badge</strong> is different: it marks an
          account that #NotesApp endorses after a manual review (no charge to apply), then {formatNaira(GOLD_PRICING.personal.monthlyKobo)}/month personal or {formatNaira(GOLD_PRICING.corporate.monthlyKobo)}/month corporate — the same on every plan — <Link href="/badges" className="text-crimson underline underline-offset-2">apply on the badges page</Link>.
          Identity-checked gold (ID, business registration or professional credential) is coming soon with a one-off non-refundable verification deposit.
        </p>
      </div>

      <div className="card mt-6 p-6">
        <p className="font-ui text-sm font-bold text-ink">Ways to earn, and how you're paid</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate">
          <li>
            <strong className="text-ink">Paid 1:1 sessions</strong> — you set the price and hours. Cancellations follow one
            published policy (full refund 48h+ before, 50% at 24–48h, none inside 24h; always full if you cancel).
          </li>
          <li>
            <strong className="text-ink">Monthly journal subscriptions</strong> — readers unlock your premium entries;
            renews automatically until they cancel.
          </li>
          <li>
            <strong className="text-ink">Payouts</strong> — to your verified Nigerian bank account: sessions after they
            take place, subscriptions after a 7-day dispute window. Commission comes off the top, per your tier above.
          </li>
          <li>
            <Link href="/gifts" className="font-bold text-crimson underline underline-offset-2">Gifts</Link> — readers can send a publisher, or a single post, a gift of ₦200,
            ₦500, ₦1,000, ₦2,000, ₦5,000 or any amount up to ₦500,000. Same commission and payout timing as
            subscriptions (7-day window).
          </li>

        </ul>
      </div>

      <div className="card mt-6 p-6">
        <p className="font-ui text-sm font-bold text-ink">Boost a post</p>
        <p className="mt-2 text-sm text-slate">
          <Link href="/boost" className="text-crimson underline underline-offset-2">Boost</Link> puts a post in the Boosted slots on the home and Journals pages. You pay for{" "}
          <strong className="text-ink">validated impressions</strong> — a real visitor seeing your post for about a
          second, counted once per visitor per day — delivered over several days. Undelivered impressions are refunded
          pro-rata. Boosts are not commissionable: what you pay is the price.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {BOOST_PACKAGES.map((p) => (
            <div key={p.id} className="border border-rule p-4">
              <p className="font-ui text-sm font-bold text-ink">{p.name}</p>
              <p className="mt-1 font-display text-xl text-ink">{formatNaira(p.priceKobo)}</p>
              <p className="mt-1 text-xs text-slate">
                {p.impressions.toLocaleString()} impressions · up to {p.maxPerDay.toLocaleString()}/day · up to {p.windowDays} days
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-10 text-sm text-slate">
        Full ad-share policy detail (why no gated conditions, who can
        advertise):{" "}
        <Link href="/advertise" className="text-crimson underline underline-offset-2">
          Advertise page
        </Link>
        .
      </p>
    </div>
  );
}
