import PageHero from "@/components/PageHero";
import type { Metadata } from "next";
import Link from "next/link";
import { TIERS, formatPercent, badgeIncluded, canSellViewOnly, BADGE_PRICE_KOBO, getTierConfig } from "@/lib/tiers";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_WEEKLY_LIMIT } from "@/lib/video-rules";
import { GOLD_PRICING } from "@/lib/gold";
import { BOOST_PACKAGES, GIFT_MAX_KOBO, GIFT_MIN_KOBO } from "@/lib/boost-config";
import { GOLD_KIND_LIVE } from "@/lib/badges";
import UpgradeButton from "@/components/UpgradeButton";
import { LIMITS, formatNaira } from "@/lib/booking-time";
import { limitTable, type LimitTable } from "@/lib/limits";
import { getAdminDb } from "@/lib/firebase-admin";
import { getLimitTable } from "@/lib/limits-server";
import { CALLS_LIVE, MESSAGES_LIVE, MOMENTS_LIVE } from "@/lib/moments-rules";
import { WALLET_LIVE } from "@/lib/wallet";
import { academyApiFrom, certificateMin, enterpriseCoursesPrice, enterpriseFrom, planPrice, planRate, pct, breakEven } from "@/lib/pricing";
import { ROOT_DOMAIN } from "@/lib/host";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "#NotesApp's tier ladder — Free Standard for readers, Free Basic through Enterprise for publishers, with transparent ad revenue share and commission at every level, course pricing for Notes Academy, and the Enterprise course packages.",
};

// These numbers are set by the admin team and can change; the page re-reads them every minute.
export const revalidate = 60;

type Row = { label: string; href?: string; render: (t: (typeof TIERS)[number], L: LimitTable) => string; show?: boolean };
// No setting holds the certificate minimum yet (docs/COURSES.md, decision 3), so it is written here once.
const TEAM_HUB_NOTE = "The Team hub and team messages are coming as a paid add-on for Business and Enterprise after our internal testing";
const YOUR_SITE = "Your site: the Legacy, Aurora or Maroon theme, Journals, Shop and Courses on or off, and About and Contact pages.";
const mins = (s: number) => (s % 60 === 0 ? `${s / 60} minute${s === 60 ? "" : "s"}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

const ROWS: Row[] = [
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
    render: (t) => (t.canPublish ? `Receive gifts of ${formatNaira(GIFT_MIN_KOBO)} – ${formatNaira(GIFT_MAX_KOBO)} with Gift me on your profile and on every post` : "Send gifts"),
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
    label: "View-only files & video courses",
    href: "/store-selling#view-only",
    render: (t) => (t.canPublish ? (canSellViewOnly(t.tier) ? "Yes — sell PDFs and video lessons that buyers watch or read here, with no download, on up to 2 devices" : "Upgrade to Pro — downloads only") : "—"),
  },
  {
    label: "Courses in Notes Academy",
    href: "/academy",
    render: (t) =>
      !t.canPublish
        ? `Take free courses; a certificate at the end costs from ${certificateMin()}`
        : t.tier === "basic"
          ? `Free courses, free to publish, with lessons from your own YouTube. Learners pay from ${certificateMin()} plus your margin for the certificate`
          : t.tier === "enterprise"
            ? `Free and paid courses, and two packages on top of Enterprise: Enterprise Courses (${enterpriseCoursesPrice()}/month) and the Enterprise Academy API (from ${academyApiFrom()}/month plus usage)`
            : t.tier === "pro"
              ? `Free courses, and paid courses with text lessons, PDFs and YouTube, for the same fee as your digital items (${formatPercent(t.digitalCommission, t.digitalCommissionFloor)})`
              : `Free and paid courses, including your own uploaded videos, for the same fee as your digital items (${formatPercent(t.digitalCommission, t.digitalCommissionFloor)}); teach as your organisation, with co-tutors`,
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
    label: "Team seats",
    href: "/organisations",
    render: (t) => (!t.canPublish ? "—" : t.tier === "business" ? `4 — the owner plus 3 team members (clerk, rider, supervisor). ${TEAM_HUB_NOTE}` : t.tier === "enterprise" ? `As many as you need, agreed with us. ${TEAM_HUB_NOTE}` : "1 — the owner"),
  },
  {
    label: "Parcel tracking & escrow",
    href: "/store-selling",
    render: (t) => (t.canPublish ? "Buyer's money held until delivery · parcel ID · no-login hand-over links for riders and drivers" : "—"),
  },
  {
    label: "Your own domain",
    render: (t) =>
      !t.canPublish
        ? "—"
        : t.customDomain
          ? t.tier === "business"
            ? `Serve your page, journals and store on notes.yourbrand.com or yourbrand.com — your /u/username page stays the default home, and you can switch back any time. ${YOUR_SITE} Semi white-label: the footer reads “Your name is powered by #NotesApp” and emails go out under #NotesApp's name on your behalf`
            : `Serve your page, journals and store on notes.yourbrand.com or yourbrand.com — your /u/username page stays the default home, and you can switch back any time. ${YOUR_SITE} Full white label: visitors sign in and sign up in a window in your name and logo (still clearly a NotesApp account), and their password and confirmation emails come in your name. Checkout and bookings still open on #NotesApp for now`
          : `Your page lives at ${ROOT_DOMAIN}/u/username`,
  },
  {
    label: "Files in messages",
    show: MESSAGES_LIVE,
    render: (t, L) => `Send pictures, videos and documents: ${L.messageAttachmentsPerMessage[t.tier]} file${L.messageAttachmentsPerMessage[t.tier] === 1 ? "" : "s"} per message, up to ${L.messageAttachmentMB[t.tier]} MB each`,
  },
  {
    label: "Voice notes",
    show: MESSAGES_LIVE,
    render: (t, L) => `Record and send voice notes of up to ${mins(L.messageVoiceNoteSeconds[t.tier])}`,
  },
  {
    label: "Voice and video calls",
    show: CALLS_LIVE,
    render: () => "Free, with no minute limit, to anyone you follow who follows you back",
  },
  {
    label: "Moments",
    show: MOMENTS_LIVE,
    render: (t, L) =>
      `Pictures and text, up to ${L.momentsPerDay[t.tier]} a day, for 24, 48 or 72 hours · ` +
      (L.momentVideosPerWeek[t.tier] > 0 ? `${L.momentVideosPerWeek[t.tier]} video moments a week (each 90-second part of a longer video counts as one)` : "video moments come with a paid plan"),
  },
  {
    label: "Email for new messages",
    render: (t) => (t.messageEmails ? "Yes: off until you switch it on, at most one email an hour" : "Bell, plus notifications on your device if you turn them on"),
  },
  {
    label: "API & Console",
    href: "/docs",
    render: (t) => (t.canPublish ? (t.apiAccess ? "Server-to-server API, keys and webhooks — enabled per account by our team" : t.customDomain ? "Console for connecting your own domain only — no API" : "—") : "—"),
  },
  ];

export default async function PricingPage() {
  // The admin-set limits; the built-in defaults if they can't be read.
  const L = await (async () => getLimitTable(getAdminDb()))().catch(() => limitTable());
  return (
    <div>
      <PageHero eyebrow="Pricing" title="One ladder, transparent at every rung">
        <p>
        Reading, commenting, booking a session, unlocking a locked
        journal, and buying merch are always free to do. Publishing
        your own journal opens the ladder below — the more you commit
        to the platform, the less commission NotesApp takes on what
        you earn through it.
      </p>
        {WALLET_LIVE && (
        <p className="mt-4 text-sm text-slate">
          Pay without entering your card each time: top up your <Link href="/profile/wallet" className="text-crimson underline">NotesApp Credit wallet</Link> from ₦1,000 (₦5,000 and more adds Bonus Credits) and use it for boosts, the verification badge, adverts, gifts, shop items and sessions. Credit can&apos;t be cashed out.
        </p>
      )}
      <p className="small">
        Publishers set their own prices — sessions from {formatNaira(LIMITS.sessionMinKobo)} to{" "}
        {formatNaira(LIMITS.sessionMaxKobo)}, monthly journal subscriptions from {formatNaira(LIMITS.subscriptionMinKobo)} to{" "}
        {formatNaira(LIMITS.subscriptionMaxKobo)}. The commission below comes out of each paid session
        or subscription; you're paid to your verified bank account
        after the session (subscriptions after a 7-day dispute window).
        Nana AI helps with drafts, posts for LinkedIn and X, and messages on every plan, never as a paid-tier perk: connect your own AI account today, and once our own AI is switched on for everyone each member gets a small daily allowance (<Link href="/nana" className="text-crimson underline">about Nana</Link>).
      </p>
      </PageHero>
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <ul className="relative z-10 -mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="The plans">
        {TIERS.map((t) => (
          <li key={t.tier} className={`flex flex-col rounded-2xl border p-5 shadow-md ${t.tier === "pro" ? "border-crimson bg-white ring-2 ring-crimson/30" : "border-rule bg-white"}`}>
            <p className="font-ui text-sm font-bold text-ink">{t.label}</p>
            <p className="mt-2 font-display text-2xl leading-tight text-crimson">{t.price}</p>
            {t.priceNote && <p className="mt-1 text-xs text-slate">{t.priceNote}</p>}
            <p className="mt-3 flex-1 text-xs text-slate">
              {!t.canPublish ? "Read, comment, book sessions and buy." : `Sessions and subscriptions: ${formatPercent(t.sessionAndUnlockCommission, t.sessionAndUnlockCommissionFloor)} commission${t.adRevenueShare ? ` · ${Math.round(t.adRevenueShare * 100)}% ad share` : ""}.`}
            </p>
            <a href="#compare" className="mt-4 inline-block rounded-full border border-crimson px-4 py-2 text-center font-ui text-xs font-bold text-crimson hover:bg-crimson hover:text-white">Compare this plan</a>
          </li>
        ))}
      </ul>
      <div id="compare" className="mt-12 overflow-x-auto rounded-2xl border border-rule shadow-sm scroll-mt-24">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="bg-crimson text-white">
              <th scope="col" className="sticky left-0 z-10 w-40 bg-crimson px-4 py-4 font-ui text-sm font-bold text-white sm:w-56">
                Feature
              </th>
              {TIERS.map((t) => (
                <th key={t.tier} scope="col" className="px-4 py-4 align-top [&_.btn-primary]:!bg-paper [&_.btn-primary]:!text-crimson-deep [&_.text-crimson]:!text-white">
                  <p className="font-ui text-sm font-bold text-white">{t.label}</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-pink-200">{t.price}</p>
                  {t.priceNote && <p className="mt-1 max-w-[11rem] text-xs font-normal text-white/75">{t.priceNote}</p>}
                  {(t.tier === "pro" || t.tier === "business") && <UpgradeButton tier={t.tier} label={t.label} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.filter((row) => row.show !== false).map((row) => (
              <tr key={row.label} className="border-t border-rule bg-white even:bg-paper">
                <td className="sticky left-0 z-10 bg-inherit px-4 py-3.5 font-ui text-[13px] font-semibold text-[#372f2b] shadow-[1px_0_0_#E7DAD3]">
                  {row.href ? (
                    <Link href={row.href} className="underline decoration-rule underline-offset-4 hover:text-crimson">{row.label}</Link>
                  ) : (
                    row.label
                  )}
                </td>
                {TIERS.map((t) => (
                  <td key={t.tier} className="px-4 py-3.5 align-top text-[13px] text-[#372f2b]">
                    {row.render(t, L)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-14 overflow-hidden rounded-2xl text-paper" style={{ backgroundImage: "linear-gradient(160deg, #1A1210 0%, #2a0a14 100%)" }} aria-label="What #NotesApp takes">
        <div className="px-6 py-10 sm:px-10">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-pink-300">What #NotesApp takes</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl sm:text-4xl">Each rung takes a smaller cut of what you earn.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.filter((t) => t.canPublish).map((t) => (
              <div key={t.tier} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="font-ui text-sm font-bold text-paper/80">{t.label}</p>
                <p className="mt-2 font-display text-4xl text-white">{formatPercent(t.sessionAndUnlockCommission, t.sessionAndUnlockCommissionFloor)}</p>
                <p className="text-xs text-paper/60">on sessions and subscriptions</p>
                <p className="mt-3 text-xs text-paper/75">Physical goods {formatPercent(t.physicalCommission, t.physicalCommissionFloor)} · Digital {formatPercent(t.digitalCommission, t.digitalCommissionFloor)}{t.adRevenueShare ? ` · ${Math.round(t.adRevenueShare * 100)}% ad share` : ""}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="card p-6">
          <p className="font-ui text-sm font-bold text-ink">How to move up the ladder</p>
          <p className="mt-2 text-sm text-slate">
            Free Standard → Free Basic is a self-serve application from
            your own profile (Rates &amp; payouts), reviewed by an admin — no payment
            involved. Pro ({planPrice("pro")}/month) and Business ({planPrice("business")}/month) are
            paid plans you can start right from this table — monthly or
            yearly (two months free), renewing automatically through
            Paystack. Cancel any time under Rates &amp; payouts: you keep the
            plan until the period you paid for ends, with no partial
            refunds. Enterprise starts at {enterpriseFrom()}/month with rates agreed with us —{" "}
            <Link href="/contact" className="text-crimson underline underline-offset-2">
              contact us
            </Link>
            . As a rule of thumb, Pro pays for itself once
            you earn about {breakEven("pro")} a month through sessions, subscriptions
            and gifts (its commission is {+((getTierConfig("basic").sessionAndUnlockCommission as number) * 100 - (getTierConfig("pro").sessionAndUnlockCommission as number) * 100).toFixed(1)} points lower than Free Basic&apos;s);
            Business does at about {breakEven("business")} a month. On store sales the gap is wider still: Free Basic takes {planRate("basic", "physical")} of physical items and {planRate("basic", "digital")} of downloads, Pro {planRate("pro", "physical")} and {planRate("pro", "digital")}, Business {planRate("business", "physical")} and {planRate("business", "digital")}, Enterprise from {pct(getTierConfig("enterprise").physicalCommissionFloor ?? 0.01)} and {pct(getTierConfig("enterprise").digitalCommissionFloor ?? 0.015)}.
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
          <p className="mt-5 font-ui text-sm font-bold text-ink">Gold badge: the same on every plan</p>
          <p className="mt-2 text-sm text-slate">
            The gold ✔ is not part of the ladder: it costs the same whether you are on Free Basic or Enterprise, and you apply for it from your profile.
            Endorsed gold means we reviewed your public work and back you. Identity-checked gold means you passed an ID check
            (identity checks are {GOLD_KIND_LIVE.identity ? "open now" : "coming soon"}). Either way it is {formatNaira(GOLD_PRICING.personal.monthlyKobo)} a month for a person
            or {formatNaira(GOLD_PRICING.corporate.monthlyKobo)} a month for an organisation, and you can cancel any time and keep it until the period you paid for ends.{" "}
            <Link href="/badges" className="text-crimson underline">See the gold badge</Link>.
          </p>
        </div>
      </div>

      <section className="card mt-6 p-6" aria-labelledby="courses-pricing">
        <p id="courses-pricing" className="font-ui text-sm font-bold text-ink">Courses in Notes Academy</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate">
          <li><strong className="text-ink">Free courses are free to publish</strong> on every publishing plan, with lessons from your own YouTube that play inside #NotesApp, and free for learners to take.</li>
          <li><strong className="text-ink">Certificates on free courses are paid:</strong> the learner pays from {certificateMin()}, plus the margin you set. We keep {certificateMin()} and our usual commission on your margin; the rest of the margin is yours.</li>
          <li><strong className="text-ink">Paid courses</strong>, with the same fee as your digital items: on Pro ({planRate("pro", "digital")}) with text lessons, PDFs and YouTube; on Business ({planRate("business", "digital")}) and Enterprise with your own uploaded videos too. Lessons stay private and play only for learners who paid, on up to two devices, with each viewer&apos;s details drifting across the video. Learners can get a refund within 7 days if they haven&apos;t started.</li>
          <li><strong className="text-ink">Co-tutors and organisations:</strong> teach alone, invite co-tutors with their share of each sale (each paid at their own plan&apos;s fee), or teach as your organisation with your team.</li>
        </ul>
        <p className="mt-3 text-sm"><Link href="/academy" className="text-crimson underline underline-offset-2">Visit Notes Academy →</Link></p>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2" aria-label="Enterprise course packages">
        <div className="card p-6">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">On top of Enterprise</p>
          <p className="mt-2 font-ui text-sm font-bold text-ink">Enterprise Courses</p>
          <p className="mt-1 font-display text-2xl text-crimson">{enterpriseCoursesPrice()}/month</p>
          <p className="mt-2 text-sm text-slate">Courses hosted on #NotesApp under your brand: your logo on certificates, cohorts and bulk invites, set amounts of learners, storage and video hours, and your own tutors added as team members. No API needed.</p>
        </div>
        <div className="card p-6">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">On top of Enterprise</p>
          <p className="mt-2 font-ui text-sm font-bold text-ink">Enterprise Academy API</p>
          <p className="mt-1 font-display text-2xl text-crimson">From {academyApiFrom()}/month <span className="font-ui text-sm text-slate">+ usage</span></p>
          <p className="mt-2 text-sm text-slate">Your own white-label academy built on our API and webhooks: your tutors, enrolment, and progress and certificate webhooks, billed partly by learners and video hours.</p>
        </div>
        <p className="text-xs text-slate sm:col-span-2">
          The regular Enterprise plan stays at {enterpriseFrom()}/month for anyone who takes neither package.{" "}
          <Link href="/contact?topic=courses" className="text-crimson underline underline-offset-2">Talk to us about courses for your team or customers</Link>.
        </p>
      </section>

      <section className="card mt-6 border-dashed p-6" aria-labelledby="add-ons">
        <p id="add-ons" className="font-ui text-sm font-bold text-ink">Coming as paid add-ons for Business and Enterprise after internal testing</p>
        <p className="mt-2 text-sm text-slate">Our own team is using these now. Once our internal testing is done, Business and Enterprise accounts can add them for a fee. No prices yet.</p>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate sm:grid-cols-2">
          <li><Link href="/teams" className="font-semibold text-ink underline decoration-rule underline-offset-4 hover:text-crimson">Team hub</Link>: a work board, meetings, a money ledger, payroll, a staff library and team messages.</li>
          <li><strong className="text-ink">Company finance tools</strong>: a runway calculator, acquisition cost, burn and revenue analytics, and a cap table with vesting.</li>
          <li><strong className="text-ink">Investor and partner data room</strong>: private, watermarked documents and live figures for the people you let in.</li>
          <li><strong className="text-ink">Advertise on LinkedIn from #NotesApp</strong>: boost a post on LinkedIn from your own ad account, with the campaign stats here.</li>
        </ul>
        <p className="mt-3 text-sm"><Link href="/roadmap" className="text-crimson underline underline-offset-2">See them on the roadmap →</Link></p>
      </section>

      <div className="card mt-6 p-6">
        <p className="font-ui text-sm font-bold text-ink">Learn more about each product</p>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {[
            ["/booking", "Paid sessions & bookings"],
            ["/gifts", "Gifts"],
            ["/boost", "Boost a post (packages and prices)"],
            ["/coauthoring", "Co-authoring and earnings splits"],
            ["/badges", "Verification badges — verified and gold, with prices"],
            ["/shop", "Notes Market — every #NotesApp store in one place"],
            ["/academy", "Notes Academy — free courses, and certificates anyone can verify"],
            ["/merchstore", "Official #NotesApp merch"],
            ["/advertise", "Advertise — banner campaigns and ad share"],
            ["/store-selling", "Sell physical goods & digital downloads — checkout, delivery hold, parcel tracking, instant downloads"],
            ["/domains", "Domains — search, register and manage, with DNS (coming soon, Business and Enterprise)"],
            ["/teams", "Team hub (a paid add-on for Business and Enterprise after internal testing)"],
            ["/help", "Help centre — answers about everything above, and Nana AI"],
            ["/organisations", "Organisations — free 30-day Business trial, CAC verification"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="text-crimson underline underline-offset-2">{label} →</Link>
            </li>
          ))}
        </ul>
      </div>

      </div>
    </div>
  );
}
