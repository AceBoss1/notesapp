import PageHero from "@/components/PageHero";
import { SITE, WHAT_IS_INTRO, WHAT_IS_NOTESAPP, WHAT_YOU_CAN_DO, WHAT_IS_FREE, WHAT_IS_TIERS } from "@/lib/site";
import FeatureMosaic from "@/components/FeatureMosaic";
import { WALLET_LIVE } from "@/lib/wallet";
import NotesLifeCard from "@/components/NotesLifeCard";
import ProgramThanks from "@/components/ProgramThanks";
import Image from "next/image";
import { PartnersStrip, TrustedByStrip } from "@/components/PartnerMarquees";
import Link from "next/link";
import type { Metadata } from "next";
import { ADMIN_PROFILES } from "@/lib/admin";
import { getSiteSettingsCached } from "@/lib/settings";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import { officialBadges } from "@/lib/name-badges";
import { CHANNEL_JOURNALS } from "@/lib/journals-directory";
import { GOLD_KIND_LIVE } from "@/lib/badges";
import GoldBadgeExplainer from "@/components/GoldBadgeExplainer";
import { CALLS_LIVE, MESSAGES_LIVE, MOMENTS_LIVE } from "@/lib/moments-rules";
import { planRate, pct } from "@/lib/pricing";
import { getTierConfig } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "About",
  description:
    WHAT_IS_NOTESAPP,
  openGraph: { images: ["/images/marketing/notesapp-showcase.png"] },
};

const LIVE = [
  ...(MOMENTS_LIVE ? [{ href: "/journals", title: "Moments", copy: "Share a picture, a video of up to 90 seconds or text, with an optional voice-over, on your profile picture for 24, 48 or 72 hours. See them in the Moments row on Journals, like WhatsApp Status; you choose whether only your followers or everyone can see yours." }] : []),
  ...(MESSAGES_LIVE ? [{ href: "/messages", title: CALLS_LIVE ? "Messages, calls & group chats" : "Messages & group chats", copy: `One-to-one messages, and groups of up to 50 people you follow or who follow you, with bold, italic and underline, sent and read ticks with times, pictures, videos and documents, voice notes of up to 5 minutes, and stickers. Pin your important messages and chats, see when someone is typing, and edit or delete what you sent.${CALLS_LIVE ? " Free voice and video calls with anyone you follow who follows you back, straight between your two devices, end-to-end encrypted with a safety code to compare, and never recorded, with screen sharing on computers and group calls of up to 6 (4 on video), ringing on the installed app even when it isn't open." : ""} Replies to your moments land here too, and notifications on your device are on by default.` }] : []),
  { href: "/journals", title: "Journals", copy: "Publish with a rich-text composer and up to 3 topics; readers follow, comment, like, share and save." },
  { href: "/journals", title: "The journal feed & Explore", copy: "For you (your interests first), Following, Latest and Top this week, with Most read and Who to follow. Explore topics, people and channels, and the week's most looked-at products and courses in its Market and Academy tabs. Keep journals, store items, courses and chat messages in Saved. On a phone, a tab bar along the bottom: Feed, Explore, Market, Academy, Messages, Profile." },
  { href: "/shop", title: "Notes Market", copy: "Every #NotesApp store in one place: items for you, the most viewed this week, new arrivals, categories and a list of stores." },
  { href: "/academy", title: "Notes Academy", copy: "Free courses from any publisher, with lessons from their own YouTube that play inside #NotesApp, and paid courses on Pro and above: text lessons, PDFs and, on Business and Enterprise, uploaded videos that never download and carry each viewer's name. Teach alone, with up to 4 co-tutors, or as your organisation. Learners like, save and review courses." },
  { href: "/certificates", title: "Certificates anyone can check", copy: "Finish a course and claim a certificate with its own ID and QR code, in the teacher's academy name and logo. Anyone can check it at notesapp.name.ng/certificates; add it to LinkedIn or save it as a PDF or picture. On paid courses it can be included in the price." },
  { href: "/help/weekly-digest", title: "The Weekly Digest", copy: "A Sunday-evening email with up to ten journals from the week, chosen for your interests, plus four items from Notes Market and four courses from Notes Academy." },
  { href: "/booking", title: "Paid 1:1 sessions", copy: "Your own price and weekly availability, Paystack checkout, reminders and a clear cancellation policy." },
  { href: "/journals", title: "Monthly subscriptions", copy: "Readers subscribe to unlock your premium entries; renewals are automatic." },
  { href: "/gifts", title: "Gifts", copy: "Readers can send you a gift on your profile or on any post." },
  ...(WALLET_LIVE ? [{ href: "/profile/wallet", title: "NotesApp Credit wallet", copy: "Top up once and pay for boosts, badges, adverts, gifts, shop items and sessions without entering your card each time. Top-ups of ₦5,000 and more add Bonus Credits. Credit can't be cashed out; sellers are still paid to their banks." }] : []),
  { href: "/coauthoring", title: "Co-authoring", copy: "Write a post with other members, agree each person's share of its earnings, and share the byline." },
  { href: "/boost", title: "Boost", copy: "Promote a post or a store item and pay only for validated impressions." },
  { href: "/badges", title: "Verification badges", copy: "A verified ✔ for accounts in good standing, and a gold ✔ for accounts we endorse or identity-check." },
  { href: "/advertise", title: "Ads & ad share", copy: "Buy a banner campaign online and reach readers across the site; Pro and Business publishers can opt in and earn a share, paid monthly after review." },
  { href: "/store-selling", title: "Sell physical goods & digital downloads", copy: "Sell in your store (or your organisation's): physical items with photos, Size and Colour options and managed stock, the buyer's money held until delivery is confirmed and a parcel ID anyone can track — or digital downloads that buyers get instantly after paying. Boost any item to reach more readers." },
  { href: "/store-selling#view-only", title: "View-only files & video courses", copy: "On Pro and above, sell PDFs and video lessons that buyers watch or read on #NotesApp with no download, on up to 2 devices per purchase. Videos are hosted on Cloudflare Stream and play only with short-lived links." },
  { href: "/store-selling", title: "Parcel tracking for riders & drivers", copy: "A chain-of-custody log for every parcel: record each holder — bike rider, bus driver, park agent — and they update the location or hand on to the next person from a short link, with no login." },
  { href: "/logistics", title: "Shipments & the logistics network", copy: "Logistics businesses book shipments, hand them rider to rider and give customers a Track page on their own site. Stores pick a delivery partner from the logistics network, and buyers pay its price at checkout. Business and Enterprise, or the logistics add-on for Free Basic and Pro." },
  { href: "/help/inventory", title: "Inventory", copy: "Stock per item and option, SKUs, cost prices, low-stock alerts, the history of every change and spreadsheet import and export. Included on Business and Enterprise; an add-on on Free Basic and Pro." },
  { href: "/community", title: "Community & Events", copy: "For churches, NGOs, schools and clubs: a General announcement channel, public and members-only Spaces, private Circles on Business, admin tools with View as, and you choose what non-members see. Events for every account, with reminders and Join live links." },
  { href: "/organisations", title: "Team seats & your own site", copy: "Business includes 4 seats (owner plus three team members) and your own domain with a semi white-label site; Enterprise has as many as you need, an API and the lowest commissions." },
  { href: "/merchstore", title: "Merch store", copy: "Official #NotesApp merch with your choice of logo — pre-order in batches, delivered in Nigeria." },
  { href: "/trending", title: "Trending", copy: "The most visited notes, store items, courses and publishers on #NotesApp." },
  { href: "/help/your-site", title: "Your own site, API & Console", copy: "From Free Basic, your own website at /s/your-name: kits by type of business, the Clean, Luxe, Scholar, Legacy, Aurora and Maroon looks with colour sets, and sections for buttons, hours, prices, a gallery, testimonials, team and answers, or publications, awards, talks on a globe and news, a storefront for the shop with a basket, and courses that open inside the site. Business and Enterprise put it on their own domain. Enterprise adds a server-to-server API, signed webhooks and Console keys." },
  { href: "/security", title: "Trust & security", copy: "How payments, files, access rules and your data are protected — including downloading or deleting your own data." },
  { href: "/nana", title: "Nana AI & help centre", copy: "Ask Nana, our helper, about anything on #NotesApp from the chat button on every page, in Messages, or browse the help centre. She links you to the right page and passes you to a person when she can't help. Choose her gem (Pearl, Emerald or Ruby, by plan), use the free allowance that refreshes weekly or top it up with Nana credit; questions asked before are answered free. She also suggests topics from your title, and summarises and translates chats. She is powered by Claude, from our partner Anthropic." },
  { href: "/docs", title: "#NotesApp in your AI assistant (MCP)", copy: "AI assistants that support MCP can find creators, journals, Notes Market items and Notes Academy courses, show open session times and share booking links. With your API key, they can read your own profile, bookings, orders and earnings. It only reads; booking, buying and paying happen on #NotesApp." },
  { href: "/profile/analytics", title: "Analytics", copy: "Earnings, orders, customers, best sellers, stock running low, visits and where they came from, by plan: 7 days for everyone, 90 days with customers and a download on Pro, visits by page and source on Business." },
  { href: "/status", title: "Status & changelog", copy: "Live service health with response times and incident updates, plus a changelog of every release." },
  { href: "/pricing", title: "Video on posts", copy: "Add a short video to a post — one MP4 or WebM up to 3 minutes — played in our own player that only loads when you press play." },
];

// Why Nigeria, why now: public figures, each with its source, as the owner supplied them.
const MARKET = [
  { figure: "100M+", label: "internet users in Nigeria", source: "DataReportal, early 2024" },
  { figure: "36.75M", label: "social media user identities", source: "DataReportal, early 2024" },
  { figure: "12.4M", label: "Instagram users", source: "DataReportal, early 2024" },
  { figure: "1.3B+", label: "hours Nigerians spent listening on Spotify", source: "Spotify Wrapped, 2025" },
  { figure: "17M", label: "Verve cards issued by OPay and Moniepoint", source: "TechCabal, 2024" },
  { figure: "150K+", label: "Netflix subscribers", source: "World Population Review, 2024" },
];

const FOUNDERS = [
  { ...ADMIN_PROFILES["ezurukam@gmail.com"], role: "Founder, CEO & CTO" },
  { ...ADMIN_PROFILES["precheks.info@gmail.com"], role: "Guest Writer" },
];

export default async function AboutPage() {
  const site = await getSiteSettingsCached();
  return (
    <div>
      <PageHero eyebrow="About" title="Why #NotesApp exists" max="max-w-4xl">
        <p>{WHAT_IS_INTRO}</p>
        <p>On #NotesApp you can:</p>
        <ul className="list-disc space-y-1 pl-6 text-base">{WHAT_YOU_CAN_DO.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="text-base">{WHAT_IS_FREE} {WHAT_IS_TIERS}</p>
      </PageHero>
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-xl2 border border-rule">
        <Image
          src="/images/marketing/notesapp-showcase.png"
          alt="#NotesApp shown across laptop and phone — For You feed, Following, Trending, Bookmarks, and a profile with notes, followers, and following counts"
          width={1983}
          height={793}
          className="h-auto w-full"
        />
      </div>
      <NotesLifeCard className="mt-10" />

      <div className="mt-12 space-y-12 font-body text-ink">
        <section>
          <p className="eyebrow">The pain we started with</p>
          <h2 className="mt-2 font-display text-3xl leading-tight">Five tools to do one job</h2>
          <p className="mt-4 text-lg text-slate">
            We started #NotesApp to fix our own problem. To publish, take a booking, sell and get paid in Naira, an African
            creator, professional or business stitches together a blog, a booking link, a WhatsApp catalogue, a payment page and
            a spreadsheet. The best of those tools were built for somewhere else: Substack takes paid subscriptions only
            through Stripe and Calendly only through Stripe or PayPal, so neither has a Naira checkout. Every handoff between them loses a reader, a booking or a sale.
          </p>
        </section>

        <section>
          <p className="eyebrow">What we saw</p>
          <h2 className="mt-2 font-display text-3xl leading-tight">Our clients and their customers are one family</h2>
          <p className="mt-4 text-lg text-slate">
            Building for our first clients, we saw what the usual tools miss: the writer and the reader, the shop and its buyer,
            the tutor and the learner are the same people on different days. A reader books a coach, a buyer opens a store, a
            learner starts teaching. So instead of a tool for one side, we built a home where everyone is welcome as family,
            for real social and economic needs: somewhere to be heard, to learn, to buy and sell, to talk, and to get paid.
          </p>
        </section>

        <section>
          <p className="eyebrow">What we built</p>
          <h2 className="mt-2 font-display text-3xl leading-tight">One account, the whole loop</h2>
          <p className="mt-4 text-lg text-slate">
            Publish a journal, get booked from it and get paid in Naira through Paystack{WALLET_LIVE ? " or a NotesApp Credit wallet" : ""}.
            Sell physical goods and downloads in Notes Market, and teach courses in Notes Academy with certificates anyone can
            check. Keep in touch by email{MESSAGES_LIVE ? ", messages and group chats" : ""}{CALLS_LIVE ? ", and free calls that are end-to-end encrypted" : ""}.
            Businesses run it on their own domain; Enterprises plug in with our API. Reading, commenting, booking and buying are
            free; we earn a commission when our members earn, set out in the open below.
          </p>
        </section>

        <section>
          <p className="eyebrow">Why Nigeria, why now</p>
          <h2 className="mt-2 font-display text-3xl leading-tight">Online, paying and ready</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MARKET.map((m) => (
              <div key={m.label} className="card p-4">
                <p className="font-display text-2xl text-crimson sm:text-3xl">{m.figure}</p>
                <p className="mt-1 text-sm text-ink">{m.label}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-eyebrow text-slate">{m.source}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-lg text-slate">
            Nigerians are online, they pay for what they love and they carry cards in their pockets. What they don&apos;t have
            is one home, built here and paying out in Naira, where the people they follow can publish, sell, teach and talk to
            them. That&apos;s the gap #NotesApp fills, starting in Nigeria and growing across Africa.
          </p>
        </section>

        <section>
          <p className="eyebrow">Who&apos;s already here</p>
          <h2 className="mt-2 font-display text-3xl leading-tight">Built with the people who use it</h2>
          <p className="mt-4 text-lg text-slate">
            We build alongside the creators, professionals and businesses who run their work on #NotesApp, starting with our
            first reference customers: Precheks, a journal at notes.precheks.com.ng (its main website, precheks.com.ng, runs on
            our API and webhooks); ApexGlitz, a fashion shop that sells to Africa through #NotesApp at apexglitz.com.ng; and{" "}
            <Link href="/u/lwb" className="text-crimson underline underline-offset-2">LWB</Link>, founded by{" "}
            <Link href="/u/emmanuela" className="text-crimson underline underline-offset-2">@emmanuela</Link>, which teaches free
            courses in Notes Academy.
          </p>
        </section>

        <section className="rounded-2xl border-2 border-crimson/20 bg-crimson/[0.03] p-7 sm:p-9">
          <p className="eyebrow">Where we&apos;re going</p>
          <h2 className="mt-2 font-display text-3xl leading-tight">Help us build it faster</h2>
          <p className="mt-4 text-lg text-slate">
            Next on the <Link href="/roadmap" className="text-crimson underline underline-offset-2">roadmap</Link>: giving, tickets
            and our own live streaming for communities, with bigger meetings; iOS and Android apps; WhatsApp reminders; and the Team hub
            and finance tools for Business and Enterprise. We&apos;ve built lean and in the open, and we&apos;re now looking for
            investors, accelerators and partners who want to build Africa&apos;s home for creators and the people they serve.
          </p>
          <Link href="/contact" className="btn-primary mt-6 inline-flex">Talk to us</Link>
        </section>
      </div>

      <div className="mt-14">
        <p className="eyebrow">What you can do today</p>
        <FeatureMosaic className="mt-5" items={LIVE} />
        <p className="mt-4 text-sm text-slate">
          Still to come: giving, tickets and live streaming for <Link href="/community" className="text-crimson underline underline-offset-2">communities</Link>, quizzes and the Enterprise course packages, WhatsApp reminders, iOS and Android apps, sharing
          to more social networks (LinkedIn and X are live), and Google and Meta ads
          alongside our own. The Team hub, company finance tools, an investor data room and advertising on LinkedIn
          are being tested by our own team and will be paid add-ons for Business and Enterprise once that testing is done — see the{" "}
          <Link href="/roadmap" className="text-crimson underline underline-offset-2">roadmap</Link>.
        </p>
      </div>

      <TrustedByStrip className="mt-14" />
      <PartnersStrip className="mt-10" />
      <ProgramThanks className="mt-14" />

      <div className="mt-14 rounded-2xl p-8 text-paper sm:p-10" style={{ backgroundImage: "linear-gradient(160deg, #1A1210 0%, #2a0a14 100%)" }}>
        <p className="font-mono text-[11px] uppercase tracking-eyebrow text-pink-300">How we make money — in the open</p>
        <div className="prose mt-4 max-w-none text-sm text-paper/85 [&_a]:!text-white [&_p]:text-paper/85">
          <p>
            Reading, commenting, booking, subscribing and buying merch are
            free to do. Publishers set their own prices; #NotesApp takes a
            commission on paid sessions, subscriptions and gifts that
            falls as you move up the tier ladder (from {planRate("basic", "session")} on Free Basic
            to {planRate("business", "session")} on Business, negotiable on Enterprise), and a smaller one on store sales: {planRate("basic", "physical")} of physical items and {planRate("basic", "digital")} of downloads on Free Basic, down to {planRate("business", "physical")} and {planRate("business", "digital")} on Business and from {pct(getTierConfig("enterprise").physicalCommissionFloor ?? 0.01)} and {pct(getTierConfig("enterprise").digitalCommissionFloor ?? 0.015)} on Enterprise. Boosts are
            priced by validated impressions with no commission. Pro and
            Business are paid plans; verification badges, gold and our own
            merch are paid add-ons; free courses cost nothing to publish, and their certificates are paid; paid courses carry the same fee as digital downloads; and advertisers' banner campaigns (paid up front, reviewed before they run, refunded for anything undelivered) fund the ad share we pay opted-in
            publishers. Every number is on the{" "}
            <Link href="/pricing" className="text-crimson underline">pricing page</Link>.
          </p>
        </div>
      </div>

      <div className="mt-14">
        <p className="eyebrow">Trust &amp; safety</p>
        <ul className="card mt-4 list-disc space-y-2 p-6 pl-10 text-sm text-slate">
          <li>Payments are handled by Paystack — we never store card details.</li>
          <li>Publisher earnings are held until the session has happened (or a 7-day window for subscriptions and gifts) and paid to a verified bank account.</li>
          <li>One published cancellation and refund policy for every session.</li>
          <li>You can download a copy of your data or delete your account yourself — see <Link href="/security" className="text-crimson underline">Trust &amp; security</Link>.</li>
          <li>Verified emails are required to pay; accounts can be suspended, for a set time or until lifted, and appealed.</li>
          <li>Messages are private to the two people in them{CALLS_LIVE ? ", and calls go straight between the two devices, end-to-end encrypted (with a safety code to check), and are never recorded" : ""}, and your moments are seen only by the people you allow: your followers, or everyone if you choose (Edit profile, Moments privacy). Anyone can block a member or report a moment or conversation; reports of nudity or violence are reviewed within 24 hours — see <Link href="/privacy" className="text-crimson underline">Privacy</Link>.</li>
          <li>Badges: the #NotesApp team mark for staff and guest writers, the maroon ✔ for accounts in good standing, and a gold badge for accounts we endorse (identity-checked gold {GOLD_KIND_LIVE.identity ? "also available" : "coming soon"}) — see <Link href="/badges" className="text-crimson underline">Verification badges</Link>.</li>
          <li>Live service health is public on the <Link href="/status" className="text-crimson underline">status page</Link>; see our <Link href="/terms" className="text-crimson underline">Terms</Link> and <Link href="/privacy" className="text-crimson underline">Privacy Policy</Link>.</li>
        </ul>
      </div>

      <div className="mt-14">
        <GoldBadgeExplainer />
      </div>

      <div className="mt-14">
        <p className="eyebrow">Founder &amp; Guest Writer</p>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FOUNDERS.map((f) => (
            <Link
              key={f.username}
              href={`/u/${f.username}`}
              className="card flex items-center gap-4 p-6 hover:shadow-md"
            >
              <Avatar src={f.avatar} alt={f.displayName} size={64} />
              <div>
                <p className="font-ui text-base font-bold text-ink">{f.displayName}<NameBadgeIcons username={f.username} size={15} /></p>
                <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
                  {f.role}
                </p>
                <p className="mt-1 font-mono text-xs text-slate">@{f.username}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-14">
        <p className="eyebrow">Company Accounts</p>
        <p className="mt-2 max-w-2xl text-sm text-slate">
          Two, deliberately different. <strong className="text-ink">@notesapp</strong>{" "}
          is the platform's own voice — our explainer posts, with comments
          closed.{" "}
          <strong className="text-ink">@na-notesapp</strong> mirrors
          everything we publish on our official social handles — real
          published entries, real comments, same as any journal on
          here.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {CHANNEL_JOURNALS.map((c) => (
            <Link
              key={c.username}
              href={`/u/${c.username}`}
              className="card flex items-center gap-4 p-6 hover:shadow-md"
            >
              <Avatar src={c.avatar} alt={c.displayName} size={64} square />
              <div>
                <p className="font-ui text-base font-bold text-ink">{c.displayName}<NameBadgeIcons username={c.username} size={15} badges={officialBadges(c.username)} /></p>
                <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
                  {c.username === "notesapp" ? "Official Platform Journal" : "Official Social Channel"}
                </p>
                <p className="mt-1 font-mono text-xs text-slate">@{c.username}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card mt-14 flex flex-col items-start gap-4 p-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-ui text-base font-bold text-ink">Follow along</p>
          <p className="mt-1 text-sm text-slate">
            Company updates and build-in-public notes on LinkedIn and Facebook; talk with the team and other members on Discord.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <a
            href={site.social.linkedin || "https://www.linkedin.com/company/na-notesapp"}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            LinkedIn
          </a>
          <a
            href={site.social.facebook || "https://web.facebook.com/na-notesapp"}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            Facebook
          </a>
          <a href={SITE.discord} target="_blank" rel="noopener noreferrer" className="btn-ghost">
            Discord
          </a>
        </div>
      </div>
      </div>
    </div>
  );
}