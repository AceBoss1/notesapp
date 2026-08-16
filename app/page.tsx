import Link from "next/link";
import Image from "next/image";

const LOOP = [
  { step: "Publish", copy: "Write a note. Toggle it public or keep it as a private client journal — same canvas." },
  { step: "Book", copy: "Readers book a session straight from what they just read. No Calendly redirect, no third‑party login." },
  { step: "Get Paid", copy: "Payment collects inline via Paystack or Flutterwave. Naira‑native, from day one." },
  { step: "Follow Up", copy: "A booking reminder lands on WhatsApp — where your clients already are." },
];

const FEATURES = [
  { title: "Public & private journals", copy: "One toggle, same canvas. Publish an article, or keep a private session log for a client — your call, entry by entry." },
  { title: "Native booking calendar", copy: "Built into your profile page. No redirect, no second login, no lost momentum between reading and booking." },
  { title: "Inline payments", copy: "Paystack and Flutterwave, wired in from the start — because Naira is not an afterthought here." },
  { title: "WhatsApp & email reminders", copy: "Bookings and nudges land where your clients actually check — WhatsApp first, with email as the reliable fallback that always lands somewhere." },
  { title: "A brand store for every journal", copy: "Every professional gets their own storefront on their profile — sell guides, templates, or sessions, no separate shop to manage." },
  { title: "Bring your own transcription", copy: "Connect Otter.ai or Whisper for session notes. We integrate; we don't lock you into one AI vendor." },
];

export default function Home() {
  return (
    <>
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
                      45 min · ₦15,000
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
                <li>Journals — real published notes, shared live with precheks.com.ng</li>
                <li>Comments, likes, shares, follow, subscribe — all real, all working</li>
                <li>Admin composer, dashboard, and analytics</li>
              </ul>
            </div>
            <div>
              <p className="font-ui text-sm font-bold text-ink">○ On the roadmap, not live</p>
              <ul className="mt-3 space-y-2 text-sm text-slate">
                <li>Paystack / Flutterwave payments — booking and subscribe buttons are demos, no real charge</li>
                <li>The booking calendar — static UI, no real availability yet</li>
                <li>WhatsApp reminders, AI drafting, social publishing, ad-share</li>
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
              on #NotesApp from day one, and pulls that same content
              live onto{" "}
              <a
                href="https://precheks.com.ng"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-crimson/40 underline-offset-2 hover:text-crimson"
              >
                precheks.com.ng
              </a>{" "}
              through our API.
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
