import Link from "next/link";
import FeatureMosaic from "@/components/FeatureMosaic";
import { WALLET_LIVE } from "@/lib/wallet";
import NotesLifeCard from "@/components/NotesLifeCard";
import { PartnersStrip, TrustedByStrip } from "@/components/PartnerMarquees";
import Image from "next/image";
import BoostedStrip from "@/components/BoostedStrip";
import GoldBadgeExplainer from "@/components/GoldBadgeExplainer";
import IndependenceDoodle from "@/components/IndependenceDoodle";
import ChallengeHero from "@/components/ChallengeHero";
import AdSlot from "@/components/AdSlot";
import { activeHostForUsername } from "@/lib/domains";
import PartnerIcon from "@/components/PartnerIcon";
import ProgramThanks from "@/components/ProgramThanks";
import { CALLS_LIVE, MESSAGES_LIVE, MOMENTS_LIVE } from "@/lib/moments-rules";
import { planRate, pct } from "@/lib/pricing";
import { getTierConfig } from "@/lib/tiers";

// The reference customers' links point at their own sites once they have them; refreshed every few minutes.
export const revalidate = 300;
const REFERENCE_USERNAME = "precheks";
const SHOP_REFERENCE_USERNAME = "apexglitz";

const LOOP = [
  { step: "Publish", copy: "Write a note. Toggle it public or keep it as a private client journal — same canvas." },
  { step: "Book", copy: "Readers book a session straight from what they just read. No Calendly redirect, no third‑party login." },
  { step: "Get Paid", copy: "Readers pay through Paystack in Naira. Your earnings are released to your bank after the session takes place." },
  { step: "Follow Up", copy: "Confirmation and reminder emails go to you and your client — 24 hours and 1 hour before. WhatsApp is next." },
];

const FEATURES = [
  { title: "Public & private journals", copy: "One toggle, same canvas. Publish an article, or keep a private session log for a client — your call, entry by entry." },
  { title: "A journal feed made for you", copy: "Pick your interests and journals on them come first, under For you. Then Following, Latest and Top this week, with Most read and Who to follow between the posts. Like, comment, share and save straight from the feed, and find topics, people and channels in Explore, with the week's most looked-at products and courses in its Market and Academy tabs. On a phone, a tab bar along the bottom takes you to Feed, Explore, Market, Academy, Messages and your Profile." },
  { title: "Notes Market", copy: "Every #NotesApp store in one place: items picked for you first, then the most viewed this week and the newest, with digital items, categories and a list of stores. Buying works just as it does in the seller's own store." },
  { title: "Notes Academy: free and paid courses", copy: "Teach free courses with lessons from your own YouTube, or sell paid ones on Pro and above with text lessons and PDFs, plus your own uploaded videos on Business and Enterprise, which never download and carry each viewer's name. Teach alone, with up to 4 co-tutors who each get their share of a sale, or as your organisation. Learners keep their progress, like, save and review courses, and get certificates anyone can check at notesapp.name.ng/certificates." },
  { title: "The Weekly Digest", copy: "On Sunday evenings, up to ten journals from the week, your interests first with people you follow mixed in, plus four items from Notes Market and four courses from Notes Academy. One click to unsubscribe." },
  { title: "Native booking calendar", copy: "Built into your profile page, running on your own weekly availability. No redirect, no second login — and clients can cancel or reschedule under a clear refund policy." },
  { title: "Your rates, your payouts", copy: "Set your own session price and monthly subscription price. Paystack collects in Naira; earnings are paid to your verified bank account after each session." },
  { title: "Booking confirmations & reminders", copy: "Email confirmations and 24-hour and 1-hour reminders are live today. WhatsApp reminders are coming next." },
  { title: "Boost a post or a store item", copy: "Put a post or a product in front of more readers. You pay only for validated impressions, delivered over several days — undelivered ones are refunded." },
  { title: "Gifts", copy: "Readers can send you a gift with Gift me on your profile, or on any single post — from ₦200 up to ₦500,000, with a note if they like. Add your payout account and the button switches on." },
  { title: "A real writing desk", copy: "Format with a toolbar, preview as you go, drop in images, add a short video, and never lose a draft — everything is saved as clean Markdown. Videos play in our own light player that only loads when you press play." },
  { title: "Ad share, from day one", get copy() { return `Pro publishers earn ${planRate("pro", "adShare")} and Business publishers ${planRate("business", "adShare")} of the ad revenue on their pages — no follower or view thresholds to clear first. Ads are opt-in for paid plans, every one is labelled “Sponsored”, and your share is paid monthly after review. Brands can buy a banner campaign online.`; } },
  { title: "Co-authoring", copy: "Pro and Business publishers can write a post with other members, agree each person's share of what it earns — gifts on it are split now — and share the byline. Everyone accepts before it's listed." },
  ...(MOMENTS_LIVE ? [{ title: "Moments", copy: "Share a picture, a video of up to 90 seconds (longer ones are split into parts) or a line of text, with an optional voice-over, on your profile picture for 24, 48 or 72 hours. Followers watch it play from the Moments row on their Journals page, like it, 🔁 re-share it or 💬 reply, and it disappears when its time is up. You choose who can see yours: your followers only, or everyone." }] : []),
  ...(MESSAGES_LIVE ? [{ title: CALLS_LIVE ? "Messages, calls & group chats" : "Messages & group chats", copy: `Talk one to one, or start a group of up to 50 people you follow or who follow you, with bold, italic and underline, a ✔ when your message is sent and ✔✔ when it is read, with the times, and attach pictures, videos and documents (how big and how many depends on your plan), record voice notes of up to 5 minutes and send stickers.${CALLS_LIVE ? " Call anyone you follow who follows you back, by voice or video, free: it rings on their phone or computer, is end-to-end encrypted with a safety code to compare, and on a computer you can share your screen. Call a whole group too: up to 6 talking or 4 on video." : ""} Replies to your moments land here too. You can block or report anyone.` }] : []),
  ...(WALLET_LIVE ? [{ title: "NotesApp Credit wallet", copy: "Top up once from ₦1,000 and pay for boosts, badges, adverts, gifts, shop items and sessions without entering your card each time. ₦5,000 and more adds Bonus Credits." }] : []),
  { title: "Gold badge", copy: "Get endorsed by #NotesApp, or identity-checked, and wear the gold ✔ beside your name on your profile, the directory and every post." },
  { title: "A store on every profile", copy: "Every professional gets their own store, in the Store tab of their profile and in Notes Market — sell physical goods with buyer payments held until delivery, a managed stock count and a tracking ID for every parcel — or digital downloads delivered instantly after payment, or — on Pro and above — view-only files and video courses that buyers watch on up to 2 devices with no download. Items can have up to 5 photos and Size and Colour options. Boost any item to put it in front of more readers. Organisations can run theirs with their team." },
  { title: "Parcel tracking for riders & drivers", copy: "Every parcel gets a chain-of-custody log: record each holder — bike rider, bus driver, park agent — and they update the location or hand on to the next person from a short link, with no login. Buyers see it on the parcel's tracking page." },
  { title: "Shipments & the logistics network", copy: "Logistics businesses book shipments for their own customers — delivery, waybill, warehousing, home and office errands — with rider hand-off links and a Track page on their own site. Stores choose a delivery partner from the logistics network: buyers pay the partner's price at checkout and track it on the store's own site. On Business and Enterprise, or the logistics add-on on Free Basic and Pro." },
  { title: "Inventory for your store", copy: "Stock for every item and option, SKUs and cost prices, alerts when something runs low, the history of every change, and a spreadsheet in and out. Included on Business; ₦1,500 a month on Free Basic and Pro, after a free 15-day trial." },
  { title: "Your own site, and your own domain", get copy() { const e = getTierConfig("enterprise"); return `From Free Basic you get your own website at /s/your-name: start from a kit made for what you do (Personal, Academics, Fashion, Food & baking, Services, Healthcare, Spa, Salons, Fitness, Events, Electronics, Motor parts, Solar, Real estate, School, Church/NGO), add a cover photo, choose the Clean, Scholar, Legacy, Aurora or Maroon look and a colour set, and add a banner with booking and shop buttons, opening hours, prices, a gallery, testimonials, your team and answers, or your publications, talks on a globe, awards and news. Your shop is a real storefront (search, categories, sorting, product tiles, a basket to pay for several items at once), and your courses open inside your site. Business and Enterprise put it on their own domain with their name and logo. Visitors sign in, book and pay without leaving it (Business is semi white-label, with “powered by #NotesApp” in the footer). Enterprise is fully white-label, with sign-in, sign-up and emails in your name and logo, and adds a server-to-server API with signed webhooks, unlimited team seats, a ${pct(e.adRevenueShare ?? 0)} ad share and store commissions from ${pct(e.physicalCommissionFloor ?? 0.01)} on physical items and ${pct(e.digitalCommissionFloor ?? 0.015)} on downloads. Business includes 4 seats (the owner plus three team members).`; } },
  { title: "Trust you can check", copy: "Buyer payments held until delivery, private files behind short-lived links, view-only courses on two devices, tested access rules, and your own data to download or delete. Read how it works on Trust & security." },
  { title: "Nana AI and a help centre", copy: "Ask Nana, our helper, anything about the platform from the chat button on every page, and get answers with links to the right page, or browse the help centre. Choose her gem (Pearl, Emerald or Ruby, by plan) and how long she thinks; every plan has a free allowance that refreshes weekly, and Nana credit tops it up. Questions asked before are answered free from her answer bank. She suggests topics from your title, summarises and translates chats, and suggests replies that offer your open session times and booking link. If Nana can't help, she passes you to a person." },
  { title: "#NotesApp in your AI assistant", copy: "AI assistants that support MCP, such as Claude and ChatGPT, can find creators, journals, Notes Market items and Notes Academy courses on #NotesApp, show a creator's open session times and share booking links. With your API key, yours can read your own profile, bookings, orders and earnings too. It only reads: booking, buying and paying happen on #NotesApp." },
  { title: "Open about what's live", copy: "A public status page with response times and incident updates, and a changelog of every release, so you always know what changed." },
  { title: "Analytics for your business", copy: "See what you earned, your orders and average order, your best sellers and what's running low, and your visits, with a day-by-day chart. Pro adds 90 days, your customers and a sales download; Business adds visits by page and where visitors came from." },
  { title: "Community & Events (coming)", copy: "For churches, NGOs, schools and clubs: post to everyone or to members only, announce to the whole community, run private Circles, and publish events with reminders and a Join live link. Free up to 200 members." },
  { title: "Bring your own transcription (coming)", copy: "Connect Otter.ai or Whisper for session notes. We integrate; we don't lock you into one AI vendor." },
];

export default async function Home() {
  const [referenceHost, shopHost] = await Promise.all([activeHostForUsername(REFERENCE_USERNAME), activeHostForUsername(SHOP_REFERENCE_USERNAME)]);
  return (
    <>
      <IndependenceDoodle />
      <ChallengeHero />
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr,0.9fr] lg:items-center lg:px-8 lg:py-28">
          <div>
            <span className="eyebrow">Built for African creators, professionals and businesses</span>
            <h1 className="mt-6 font-display text-[2.75rem] leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Publish a note.
              <br />
              Get <span className="italic text-crimson">booked</span> for it.
              <br />
              Get paid, in Naira.
            </h1>
            <p className="mt-6 max-w-xl font-body text-lg text-slate">
              We started #NotesApp to fix our own pain: publishing, taking
              bookings and getting paid in Naira meant stitching five tools
              together. Along the way we saw that our clients and their
              customers aren&apos;t two markets, they&apos;re one family. So we
              built one home where everyone is welcome: write journals, take
              bookings, sell in Notes Market, teach in Notes Academy, message
              and call each other free, and get paid in Naira, under your own
              name or your own domain.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/journals" className="btn-primary">
                Explore live journals
              </Link>
              <Link href="/booking" className="btn-ghost">
                See booking in action
              </Link>
              <Link href="/boost" className="btn-ghost">
                Boost a post
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="card overflow-hidden shadow-[0_30px_60px_-25px_rgba(122,3,40,0.35)]">
              <div className="border-b border-rule bg-crimson px-6 py-4">
                <span className="font-ui text-sm font-semibold text-paper">
                  chimdinma&nbsp;/&nbsp;career transitions
                </span>
              </div>
              <div className="space-y-4 p-6">
                <p className="font-display text-xl leading-snug text-ink">
                  “Making a career change in your 30s, 40s, or 50s…”
                </p>
                <p className="text-sm text-slate">
                  A career pivot can either be a crisis, or an upgrade.
                  The difference is almost never talent…
                </p>
                <div className="flex items-center justify-between rounded-xl2 border border-rule bg-paper p-4">
                  <div>
                    <p className="font-ui text-sm font-semibold text-ink">
                      Book a 1:1 strategy session
                    </p>
                    <p className="font-mono text-xs text-slate">
                      You set the length and the price
                    </p>
                  </div>
                  <span className="btn-primary !px-4 !py-2 text-xs">
                    Book
                  </span>
                </div>
              </div>
            </div>
            <Image
              src="/images/brand/notesapp-icon.webp"
              alt=""
              width={72}
              height={72}
              className="absolute -right-4 -top-4 h-[72px] w-[72px] rounded-2xl shadow-lg lg:-right-8 lg:-top-8"
            />
          </div>
        </div>
      </section>

      <TrustedByStrip className="border-b border-rule bg-paper px-4 py-8" />

      <BoostedStrip />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8"><AdSlot placement="home" /></div>

      <section className="border-b border-rule py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <GoldBadgeExplainer />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8"><NotesLifeCard /></section>

      {/* The loop */}
      <section className="border-y border-rule bg-ink py-20 text-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="eyebrow">The core loop</span>
          <h2 className="mt-4 max-w-2xl font-display text-3xl text-paper sm:text-4xl">
            Content generates bookings. Bookings generate revenue.
            Revenue funds more content.
          </h2>
          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP.map((item, i) => (
              <div key={item.step} className="border-t border-paper/20 pt-5">
                <span className="font-mono text-xs text-crimson-bright">
                  0{i + 1}
                </span>
                <h3 className="mt-2 font-ui text-lg font-bold text-paper">
                  {item.step}
                </h3>
                <p className="mt-2 text-sm text-paper/65">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <span className="eyebrow">Why we're different</span>
        <h2 className="mt-4 max-w-2xl font-display text-3xl text-ink sm:text-4xl">
          Substack and Calendly get paid through Stripe or PayPal.
          We get you paid in Naira.
        </h2>
        <FeatureMosaic className="mt-14" items={FEATURES.map((f) => ({ title: f.title, copy: f.copy }))} />
      </section>

      {/* Partner strip: the first reference customers, each on their own domain */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <p className="eyebrow">First reference customers</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="card flex flex-col items-start justify-between gap-6 p-8">
            <div>
              <p className="inline-flex items-center gap-2 font-ui text-sm font-bold text-ink"><PartnerIcon partner="precheks" /> Precheks · journal</p>
              <p className="mt-3 max-w-xl font-body text-slate">
                Precheks — a data, career, and business consulting practice — runs its notes, calendar, and client sessions on #NotesApp from day one. Its main website,{" "}
                <a href="https://precheks.com.ng" target="_blank" rel="noopener noreferrer" className="underline decoration-crimson/40 underline-offset-2 hover:text-crimson">precheks.com.ng</a>, is powered by our API and webhooks, and its journal has its own branded site at{" "}
                <a href={`https://${referenceHost ?? "notes.precheks.com.ng"}`} className="underline decoration-crimson/40 underline-offset-2 hover:text-crimson">
                  {referenceHost ?? "notes.precheks.com.ng"}
                </a>
                .
              </p>
            </div>
            {referenceHost ? (
              <a href={`https://${referenceHost}`} className="btn-ghost shrink-0">View their journal</a>
            ) : (
              <Link href={`/u/${REFERENCE_USERNAME}`} className="btn-ghost shrink-0">View their journal</Link>
            )}
          </div>
          <div className="card flex flex-col items-start justify-between gap-6 p-8">
            <div>
              <p className="inline-flex items-center gap-2 font-ui text-sm font-bold text-ink"><PartnerIcon partner="apexglitz" /> ApexGlitz Boutique · shop</p>
              <p className="mt-3 max-w-xl font-body text-slate">
                ApexGlitz Boutique is a fashion brand whose original store, apexglitz.com, runs on Shopify; it sells to Africa through its shop on #NotesApp — several photos and size and colour options per item, checkout in Naira, the buyer&apos;s payment held until delivery — on its own domain at{" "}
                <a href={`https://${shopHost ?? "apexglitz.com.ng"}`} className="underline decoration-crimson/40 underline-offset-2 hover:text-crimson">
                  {shopHost ?? "apexglitz.com.ng"}
                </a>
                .
              </p>
            </div>
            {shopHost ? (
              <a href={`https://${shopHost}`} className="btn-ghost shrink-0">Visit their shop</a>
            ) : (
              <Link href={`/u/${SHOP_REFERENCE_USERNAME}/store`} className="btn-ghost shrink-0">Visit their shop</Link>
            )}
          </div>
        </div>
      </section>

      <PartnersStrip className="border-t border-rule px-4 py-12" />
      <div className="mx-auto max-w-5xl px-4 pb-14 sm:px-6 lg:px-8"><ProgramThanks compact /></div>
    </>
  );
}
