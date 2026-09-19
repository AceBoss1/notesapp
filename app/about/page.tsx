import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ADMIN_PROFILES } from "@/lib/admin";
import { SITE } from "@/lib/site";
import Avatar from "@/components/Avatar";
import { CHANNEL_JOURNALS } from "@/lib/journals-directory";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why #NotesApp exists — one workspace for African coaches, consultants, and knowledge professionals to publish, get booked, and get paid.",
  openGraph: { images: ["/images/marketing/notesapp-showcase.png"] },
};

const FOUNDERS = [
  { ...ADMIN_PROFILES["ezurukam@gmail.com"], role: "Founder & CEO" },
  { ...ADMIN_PROFILES["precheks.info@gmail.com"], role: "Co-Founder & COO" },
];

export default function AboutPage() {
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
          it, get paid inline, follow up on WhatsApp — then turn the
          private session notes into your next public article. Follow
          a journal to see everything it publishes; subscribe to one
          to unlock what it keeps for paying readers.
        </p>
        <p>
          We're building this alongside the professionals who will run
          their entire practice on it from day one, starting with our
          first reference customer, Precheks.
        </p>
      </div>

      <div className="mt-14">
        <p className="eyebrow">Founders</p>
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
          is the platform's own voice — UI-only, no Firestore behind
          it, and no comments open under it.{" "}
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
          href={SITE.linkedin}
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
