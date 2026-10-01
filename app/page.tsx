import Link from "next/link";
import Image from "next/image";
import BoostedStrip from "@/components/BoostedStrip";
import GoldBadgeExplainer from "@/components/GoldBadgeExplainer";
import IndependenceDoodle from "@/components/IndependenceDoodle";
import AdSlot from "@/components/AdSlot";
import { GOLD_KIND_LIVE } from "@/lib/badges";

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
  { title: "Boost a post", copy: "Put a post in front of more readers. You pay only for validated impressions, delivered over several days — undelivered ones are refunded." },
  { title: "Gifts", copy: "Readers can send you a gift on your profile or on any single post — from ₦200 up to ₦500,000, with a note if they like." },
  { title: "A real writing desk", copy: "Format with a toolbar, preview as you go, drop in images, and never lose a draft — everything is saved as clean Markdown." },
  { title: "Co-authoring", copy: "Write a post with other members, agree each person's share of what it earns, and share the byline — everyone accepts before it's listed." },
  { title: "Gold badge", copy: "Get endorsed by #NotesApp, or identity-checked, and wear the gold ✔ beside your name on your profile, the directory and every post." },
  { title: "A brand store for every journal", copy: "Every professional gets their own storefront on their profile — sell guides, templates, or sessions, no separate shop to manage." },
  { title: "Bring your own transcription (coming)", copy: "Connect Otter.ai or Whisper for session notes. We integrate; we don't lock you into one AI vendor." },
];

export default function Home() {
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
              calendar, and inline Naira payments into one workspace —
              so coaches, consultants, and therapists stop stitching
              together WhatsApp, a booking link, and a blog just to run
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

      {/* Honest status strip — the hero above is the vision; this is
          what's actually true right now. Added directly in response
          to third-party review feedback: don't let "get paid, in
          Naira" imply a working payment flow when it's still a demo. */}
      <section className="border-y border-rule bg-paper py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <p className="eyebrow text-center">What's actually true right now</p>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <p className="font-ui text-sm font-bold text-ink">✓ Live today</p>
              <ul className="mt-3 space-y-2 text-sm text-slate">
                <li>Journals — real published notes, with a rich-text composer</li>
                <li>Paid 1:1 sessions on each publisher's own rate and availability, paid through Paystack, with a bookings dashboard and a clear cancellation policy</li>
                <li>Paid monthly journal subscriptions that unlock premium entries</li>
                <li>Post boosts (pay for validated impressions) and gifts on every profile and post — see <Link href="/boost" className="text-crimson underline">Boost</Link> and <Link href="/gifts" className="text-crimson underline">Gifts</Link></li>
                <li>Paid Pro and Business plans through Paystack, and official #NotesApp merch pre-orders in Naira — see <Link href="/pricing" className="text-crimson underline">Pricing</Link> and the <Link href="/merchstore" className="text-crimson underline">Merch store</Link></li>
                <li>Trending feed and a live status page</li>
                <li>Verification badges: the maroon ✔ for accounts in good standing and the <strong className="text-ink">gold ✔ for endorsed accounts</strong>{GOLD_KIND_LIVE.identity ? " and identity-checked accounts" : ""} — see <Link href="/badges" className="text-crimson underline">Verification badges</Link></li>
                <li>Publisher payouts to a verified bank account, released after the session</li>
                <li>Email confirmations and reminders · password reset and email verification</li>
                <li>Comments, likes, shares, follow — all real, all working</li>
              </ul>
            </div>
            <div>
              <p className="font-ui text-sm font-bold text-ink">○ On the roadmap, not live</p>
              <ul className="mt-3 space-y-2 text-sm text-slate">
                <li>WhatsApp reminders and clients rescheduling themselves</li>
{GOLD_KIND_LIVE.identity ? null : <li>Identity-checked gold badge (NIN + face check for people, CAC for organisations)</li>}
                <li>Enterprise plans (custom commission, contact us) and in-platform checkout for members' own merch</li>
                <li>iOS and Android apps, AI drafting, social publishing, video uploads, ad-share</li>
              </ul>
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-slate">
            Full detail on what's built vs. planned:{" "}
            <Link href="/roadmap" className="text-crimson underline underline-offset-2">
              the roadmap
            </Link>
            .
          </p>
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
          <Link href="/u/chimdinma" className="btn-ghost shrink-0">
            View their journal
          </Link>
        </div>
      </section>
    </>
  );
}
