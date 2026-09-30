import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ADMIN_PROFILES } from "@/lib/admin";
import { getSiteSettingsCached } from "@/lib/settings";
import Avatar from "@/components/Avatar";
import { CHANNEL_JOURNALS } from "@/lib/journals-directory";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why #NotesApp exists — one workspace for African coaches, consultants, and knowledge professionals to publish, get booked, and get paid — and what you can do on it today.",
  openGraph: { images: ["/images/marketing/notesapp-showcase.png"] },
};

const LIVE = [
  { href: "/journals", title: "Journals", copy: "Publish with a rich-text composer; readers follow, comment, like and share." },
  { href: "/booking", title: "Paid 1:1 sessions", copy: "Your own price and weekly availability, Paystack checkout, reminders and a clear cancellation policy." },
  { href: "/journals", title: "Monthly subscriptions", copy: "Readers subscribe to unlock your premium entries; renewals are automatic." },
  { href: "/gifts", title: "Gifts", copy: "Readers can send you a gift on your profile or on any post." },
  { href: "/boost", title: "Boost", copy: "Promote a post and pay only for validated impressions." },
  { href: "/trending", title: "Trending", copy: "The most visited publishers and posts on #NotesApp." },
];

const FOUNDERS = [
  { ...ADMIN_PROFILES["ezurukam@gmail.com"], role: "Founder & CEO" },
  { ...ADMIN_PROFILES["precheks.info@gmail.com"], role: "Guest Writer" },
];

export default async function AboutPage() {
  const site = await getSiteSettingsCached();
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">About</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        Why #NotesApp exists
      </h1>

      <div className="mt-10 overflow-hidden rounded-xl2 border border-rule">
        <Image
          src="/images/marketing/notesapp-showcase.png"
          alt="#NotesApp shown across laptop and phone — For You feed, Following, Trending, Bookmarks, and a profile with notes, followers, and following counts"
          width={1983}
          height={793}
          className="h-auto w-full"
        />
      </div>

      <div className="prose prose-lg mt-10 max-w-none font-body text-ink">
        <p>
          No platform today is purpose-built for African coaches,
          consultants, therapists, and knowledge professionals who
          publish content, take bookings, collect payment in Naira, and
          manage client relationships — all in one place. Substack
          assumes a Western reader. Calendly assumes Stripe. Notion is
          built for tech teams.
        </p>
        <p>
          #NotesApp closes that loop: publish a note, get booked from
          it, get paid in Naira through Paystack, and follow up by email
          (WhatsApp is next). Follow a journal to see everything it
          publishes; subscribe to one to unlock what it keeps for paying
          readers; send a gift to say thanks; boost a post to reach more
          people.
        </p>
        <p>
          We're building this alongside the professionals who run their
          practice on it from day one, starting with our first reference
          customer, Precheks.
        </p>
      </div>

      <div className="mt-14">
        <p className="eyebrow">What you can do today</p>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LIVE.map((f) => (
            <Link key={f.title} href={f.href} className="card p-6 hover:shadow-md">
              <p className="font-ui text-base font-bold text-ink">{f.title}</p>
              <p className="mt-2 text-sm text-slate">{f.copy}</p>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate">
          Still to come: WhatsApp reminders, AI drafting and social
          publishing, video, ad-share, and self-serve plan changes for
          every tier — see the{" "}
          <Link href="/roadmap" className="text-crimson underline underline-offset-2">roadmap</Link>.
        </p>
      </div>

      <div className="mt-14">
        <p className="eyebrow">How we make money — in the open</p>
        <div className="prose mt-4 max-w-none text-sm text-slate">
          <p>
            Reading, commenting, booking, subscribing and buying merch are
            free to do. Publishers set their own prices; #NotesApp takes a
            commission on paid sessions, subscriptions and gifts that
            falls as you move up the tier ladder (from 35% on Free Basic
            to 15% on Business, negotiable on Enterprise). Boosts are
            priced by validated impressions with no commission. Pro and
            Business are paid plans. Every number is on the{" "}
            <Link href="/pricing" className="text-crimson underline">pricing page</Link>.
          </p>
        </div>
      </div>

      <div className="mt-14">
        <p className="eyebrow">Trust &amp; safety</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate">
          <li>Payments are handled by Paystack — we never store card details.</li>
          <li>Publisher earnings are held until the session has happened (or a 7-day window for subscriptions and gifts) and paid to a verified bank account.</li>
          <li>One published cancellation and refund policy for every session.</li>
          <li>Verified emails are required to pay; accounts can be suspended and appealed.</li>
          <li>Badges: the #NotesApp team mark for staff and guest writers, the maroon ✔ for accounts in good standing, and a gold badge for identity-checked and endorsed accounts (coming soon) — see <Link href="/badges" className="text-crimson underline">Verification badges</Link>.</li>
          <li>Live service health is public on the <Link href="/status" className="text-crimson underline">status page</Link>; see our <Link href="/terms" className="text-crimson underline">Terms</Link> and <Link href="/privacy" className="text-crimson underline">Privacy Policy</Link>.</li>
        </ul>
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
                <p className="font-ui text-base font-bold text-ink">{f.displayName}</p>
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
              <Avatar src={c.avatar} alt={c.displayName} size={64} />
              <div>
                <p className="font-ui text-base font-bold text-ink">{c.displayName}</p>
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
            Company updates and build-in-public notes, on LinkedIn.
          </p>
        </div>
        <a
          href={site.social.linkedin || "https://www.linkedin.com/company/na-notesapp"}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary shrink-0"
        >
          linkedin.com/company/na-notesapp
        </a>
      </div>
    </div>
  );
}