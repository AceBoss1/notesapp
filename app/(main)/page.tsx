import Link from "next/link";
import Image from "next/image";
import BoostedStrip from "@/components/BoostedStrip";
import GoldBadgeExplainer from "@/components/GoldBadgeExplainer";
import IndependenceDoodle from "@/components/IndependenceDoodle";
import AdSlot from "@/components/AdSlot";
import { activeHostForUsername } from "@/lib/domains";

// The reference customer's link points at their own site once they have one; refreshed every few minutes.
export const revalidate = 300;
const REFERENCE_USERNAME = "precheks";

const LOOP = [
  { step: "Publish", copy: "Write a note. Toggle it public or keep it as a private client journal — same canvas." },
  { step: "Book", copy: "Readers book a session straight from what they just read. No Calendly redirect, no third‑party login." },
  { step: "Get Paid", copy: "Readers pay through Paystack in Naira. Your earnings are released to your bank after the session takes place." },
  { step: "Follow Up", copy: "Confirmation and reminder emails go to you and your client — 24 hours and 1 hour before. WhatsApp is next." },
];

const FEATURES = [
  { title: "Public & private journals", copy: "One toggle, same canvas. Publish an article, or keep a private session log for a client — your call, entry by entry." },
  { title: "Native booking calendar", copy: "Built into your profile page, running on your own weekly availability. No redirect, no second login — and clients can cancel or reschedule under a clear refund policy." },
  { title: "Your rates, your payouts", copy: "Set your own session price and monthly subscription price. Paystack collects in Naira; earnings are paid to your verified bank account after each session." },
  { title: "Booking confirmations & reminders", copy: "Email confirmations and 24-hour and 1-hour reminders are live today. WhatsApp reminders are coming next." },
  { title: "Boost a post or a store item", copy: "Put a post or a product in front of more readers. You pay only for validated impressions, delivered over several days — undelivered ones are refunded." },
  { title: "Gifts", copy: "Readers can send you a gift on your profile or on any single post — from ₦200 up to ₦500,000, with a note if they like. Add your payout account and the 🎁 button switches on." },
  { title: "A real writing desk", copy: "Format with a toolbar, preview as you go, drop in images, add a short video, and never lose a draft — everything is saved as clean Markdown. Videos play in our own light player that only loads when you press play." },
  { title: "Ad share, from day one", copy: "Pro publishers earn 25% and Business publishers 45% of the ad revenue on their pages — no follower or view thresholds to clear first. Ads are opt-in for paid plans, every one is labelled “Sponsored”, and your share is paid monthly after review. Brands can buy a banner campaign online." },
  { title: "Co-authoring", copy: "Pro and Business publishers can write a post with other members, agree each person's share of what it earns — gifts on it are split now — and share the byline. Everyone accepts before it's listed." },
  { title: "Gold badge", copy: "Get endorsed by #NotesApp, or identity-checked, and wear the gold ✔ beside your name on your profile, the directory and every post." },
  { title: "A brand store for every journal", copy: "Every professional gets their own storefront on their profile — sell physical goods with buyer payments held until delivery, a managed stock count and a tracking ID for every parcel — or digital downloads delivered instantly after payment, or — on Pro and above — view-only files and video courses that buyers watch on up to 2 devices with no download. Items can have up to 5 photos and Size and Colour options. Boost any item to put it in front of more readers. Organisations can run theirs with their team." },
  { title: "Parcel tracking for riders & drivers", copy: "Every parcel gets a chain-of-custody log: record each holder — bike rider, bus driver, park agent — and they update the location or hand on to the next person from a short link, with no login. Buyers see it on the parcel's tracking page." },
  { title: "Enterprise: your own branded site, API & the lowest rates", copy: "Your name and logo on your own domain with Home, Notes and Shop, visitors who sign in, book and pay without leaving it, a server-to-server API with signed webhooks, unlimited team seats, a 75% ad share and store commissions from 1% on physical items and 1.5% on downloads. Business includes 4 seats (the owner plus three team members)." },
  { title: "Trust you can check", copy: "Buyer payments held until delivery, private files behind short-lived links, view-only courses on two devices, tested access rules, and your own data to download or delete. Read how it works on Trust & security." },
  { title: "Open about what's live", copy: "A public status page with response times and incident updates, and a changelog of every release, so you always know what changed." },
  { title: "Bring your own transcription (coming)", copy: "Connect Otter.ai or Whisper for session notes. We integrate; we don't lock you into one AI vendor." },
];

export default async function Home() {
  const referenceHost = await activeHostForUsername(REFERENCE_USERNAME);
  return (
    <>
      <IndependenceDoodle />
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr,0.9fr] lg:items-center lg:px-8 lg:py-28">
          <div>
            <span className="eyebrow">Built for African knowledge professionals</span>
            <h1 className="mt-6 font-display text-[2.75rem] leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Publish a note.
              <br />
              Get <span className="italic text-crimson">booked</span> for it.
              <br />
              Get paid, in Naira.
            </h1>
            <p className="mt-6 max-w-xl font-body text-lg text-slate">
              #NotesApp fuses a publishing journal, a native booking
              calendar, a shop and inline Naira payments into one workspace —
              so coaches, consultants, therapists and growing brands stop stitching
              together WhatsApp, a booking link, a blog and a store just to run
              their practice.
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

      <BoostedStrip />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8"><AdSlot placement="home" /></div>

      <section className="border-b border-rule py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <GoldBadgeExplainer />
        </div>
      </section>

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
          Substack assumes a Western reader. Calendly assumes Stripe.
          Neither assumes WhatsApp and Naira.
        </h2>
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-7">
              <h3 className="font-ui text-base font-bold text-ink">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-slate">{f.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Partner strip */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="card flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">First reference customer</p>
            <p className="mt-3 max-w-xl font-body text-slate">
              Precheks — a data, career, and business consulting
              practice — runs its notes, calendar, and client sessions
              on #NotesApp from day one, and is the first practice we're
              building a partner API for, to show that content on{" "}
              <a
                href="https://precheks.com.ng"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-crimson/40 underline-offset-2 hover:text-crimson"
              >
                precheks.com.ng
              </a>
              .
            </p>
          </div>
          {referenceHost ? (
            <a href={`https://${referenceHost}`} className="btn-ghost shrink-0">
              View their journal
            </a>
          ) : (
            <Link href={`/u/${REFERENCE_USERNAME}`} className="btn-ghost shrink-0">
              View their journal
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
