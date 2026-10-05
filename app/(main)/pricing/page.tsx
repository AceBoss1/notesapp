import type { Metadata } from "next";
import Link from "next/link";
import { TIERS, formatPercent, badgeIncluded, BADGE_PRICE_KOBO } from "@/lib/tiers";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_WEEKLY_LIMIT } from "@/lib/video-rules";
import { GOLD_PRICING } from "@/lib/gold";
import { BOOST_PACKAGES } from "@/lib/boost-config";
import { GOLD_KIND_LIVE } from "@/lib/badges";
import UpgradeButton from "@/components/UpgradeButton";
import { LIMITS, formatNaira } from "@/lib/booking-time";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "#NotesApp's tier ladder — Free Standard for readers, Free Basic through Enterprise for publishers, with transparent ad revenue share and booking/unlock/merch commission at every level.",
};

const ROWS: { label: string; href?: string; render: (t: (typeof TIERS)[number]) => string }[] = [
  { label: "Can publish?", render: (t) => (t.canPublish ? "Yes" : "No — read & engage only") },
  {
    label: "Can co-author?",
    href: "/coauthoring",
    render: (t) =>
      !t.canPublish
        ? "Accept an invite once you have Free Basic"
        : t.tier === "pro" || t.tier === "business" || t.tier === "enterprise"
          ? "Yes — lead posts with up to 4 co-authors, or join one"
          : "Join as a co-author when invited",
  },
  {
    label: "Ad revenue share",
    href: "/advertise",
    render: (t) =>
      t.adRevenueShare === null ? "—" : t.adRevenueShare === 0 ? "0% (ads run, no share)" : `${(t.adRevenueShare * 100).toFixed(0)}% of the ad revenue on your pages if you opt in — paid monthly after review`,
  },
  {
    label: "Commission on sessions, subscriptions & gifts",
    render: (t) =>
      t.canPublish
        ? `NotesApp takes ${formatPercent(t.sessionAndUnlockCommission, t.sessionAndUnlockCommissionFloor)}`
        : "—",
  },
  {
    label: "Verified badge ✔",
    href: "/badges",
    render: (t) => (badgeIncluded(t.tier) ? "Included free" : `Add-on: ${formatNaira(BADGE_PRICE_KOBO)}/month`),
  },
  {
    label: "Gold badge (identity checked / endorsed)",
    href: "/badges",
    render: () => `${formatNaira(GOLD_PRICING.personal.monthlyKobo)}/mo personal · ${formatNaira(GOLD_PRICING.corporate.monthlyKobo)}/mo corporate (by application; identity check ${GOLD_KIND_LIVE.identity ? "available" : "coming soon"})`,
  },
  {
    label: "Paid 1:1 sessions",
    href: "/booking",
    render: (t) => (t.canPublish ? `You set the price: ${formatNaira(LIMITS.sessionMinKobo)} – ${formatNaira(LIMITS.sessionMaxKobo)}` : "Book & pay only"),
  },
  {
    label: "Monthly journal subscriptions",
    render: (t) => (t.canPublish ? `You set the price: ${formatNaira(LIMITS.subscriptionMinKobo)} – ${formatNaira(LIMITS.subscriptionMaxKobo)}/month` : "Subscribe & unlock only"),
  },
  {
    label: "Gifts from readers",
    href: "/gifts",
    render: (t) => (t.canPublish ? "Receive gifts of ₦200 – ₦500,000 on your profile and every post" : "Send gifts"),
  },
  {
    label: "Post boosts",
    href: "/boost",
    render: (t) => (t.canPublish ? `From ${formatNaira(BOOST_PACKAGES[0].priceKobo)} · no commission · undelivered impressions refunded` : "—"),
  },
  {
    label: "Payouts to your bank",
    render: (t) => (t.canPublish ? "Sessions after they happen · subscriptions & gifts after 7 days" : "—"),
  },
  {
    label: "Physical goods sold in your store",
    href: "/store-selling",
    render: (t) => (t.canPublish ? `NotesApp takes ${formatPercent(t.physicalCommission, t.physicalCommissionFloor)} of the item price (delivery fee is yours) — buyer's money is held until delivery is confirmed` : "—"),
  },
  {
    label: "Digital downloads sold in your store",
    href: "/store-selling",
    render: (t) => (t.canPublish ? `NotesApp takes ${formatPercent(t.digitalCommission, t.digitalCommissionFloor)} of the price — instant download after payment, final once downloaded (no refunds)` : "—"),
  },
  {
    label: "Links out to other shops",
    render: (t) => (t.canPublish ? "Only your one profile link and links inside your posts — stores sell through #NotesApp checkout" : "—"),
  },
  {
    label: "Video on posts",
    render: (t) =>
      t.canPublish
        ? `One video per post (MP4 or WebM, up to ${VIDEO_MAX_SECONDS / 60} minutes and ${Math.round(VIDEO_MAX_BYTES / 1048576)} MB), played in our own player · ${VIDEO_WEEKLY_LIMIT[t.tier]} uploads a week`
        : "Watch videos on any post",
  },
  {
    label: "Your own domain",
    render: (t) =>
      !t.canPublish
        ? "—"
        : t.customDomain
          ? "Serve your page, journals and store on notes.yourbrand.com or yourbrand.com — your /u/username page stays the default home, and you can switch back any time"
          : "Your page lives at notesapp.name.ng/u/username",
  },
  {
    label: "API & Console",
    href: "/changelog",
    render: (t) => (t.canPublish ? (t.apiAccess ? "Server-to-server API, keys and webhooks — enabled per account by our team" : "—") : "—"),
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
                <td className="py-4 pr-4 font-ui text-sm font-semibold text-ink">
                  {row.href ? (
                    <Link href={row.href} className="underline decoration-rule underline-offset-4 hover:text-crimson">{row.label}</Link>
                  ) : (
                    row.label
                  )}
                </td>
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
            Why stores don&apos;t link out
          </p>
          <p className="mt-2 text-sm text-slate">
            A store item is a physical good sold through #NotesApp checkout: the buyer&apos;s money is held until delivery is confirmed, every parcel
            gets a tracking ID, and disputes go through us. A link to someone else&apos;s checkout can&apos;t offer any of that, so the only links out
            are your profile link and the links you put in your posts. <Link href="/store-selling" className="text-crimson underline">How selling works</Link>.
          </p>
        </div>
      </div>

      <div className="card mt-6 p-6">
        <p className="font-ui text-sm font-bold text-ink">Learn more about each product</p>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {[
            ["/booking", "Paid sessions & bookings"],
            ["/gifts", "Gifts"],
            ["/boost", "Boost a post (packages and prices)"],
            ["/coauthoring", "Co-authoring and earnings splits"],
            ["/badges", "Verification badges — verified and gold, with prices"],
            ["/merchstore", "Merch store"],
            ["/advertise", "Advertise — banner campaigns and ad share"],
            ["/store-selling", "Sell physical goods & digital downloads — checkout, delivery hold, parcel tracking, instant downloads"],
            ["/organisations", "Organisations — free 30-day Business trial, CAC verification"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="text-crimson underline underline-offset-2">{label} →</Link>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
