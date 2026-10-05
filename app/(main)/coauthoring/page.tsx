import Link from "next/link";
import type { Metadata } from "next";
import { MAX_CO_AUTHORS, MIN_CO_PERCENT, MIN_LEAD_PERCENT } from "@/lib/coauthors";

export const metadata: Metadata = {
  title: "Co-authoring",
  description:
    "Write a post with other #NotesApp members, agree each person's share of what it earns, and share the byline. Everyone accepts before it's listed, and the split is locked at publishing.",
};

const STEPS = [
  { t: "Start a draft", d: "Write your post as usual and save it as a draft. Co-authors can only be added while it's a draft." },
  { t: "Invite & set shares", d: `Pro and Business publishers can invite up to ${MAX_CO_AUTHORS} members by username and set each one's % of the post's earnings. You keep at least ${MIN_LEAD_PERCENT}%; each co-author gets at least ${MIN_CO_PERCENT}%.` },
  { t: "They accept", d: "Each invitee sees their share on their Co-author invites page (and in the bell) and accepts or declines. Anyone can be invited, but accepting needs a publishing account — a Free Standard member applies for Free Basic first. Nobody is listed without saying yes." },
  { t: "Publish — split locks", d: "The byline reads “with …”, the post shows on every co-author's profile, and the agreed split can no longer change. Invites still waiting at publish time expire." },
];

const FAQ = [
  { q: "What do co-authors actually get?", a: "Credit on the byline and on their own profile, and a share of what the post earns: gifts sent on the post are split between its authors in the agreed percentages today (each portion paid like any gift, minus that author's own plan commission), and the ad share on the post is split the same way once ad-share payouts launch. Sessions stay personal — see below." },
  { q: "Who can lead a co-authored post?", a: "Pro, Business and Enterprise publishers. Co-authoring is how a bigger publisher brings in contributors and pays them fairly." },
  { q: "Who can I invite? Do they need a paid plan?", a: "Anyone with an account. They don't need a paid plan — but to accept, they need a publishing account (Free Basic or above), because their share is paid out to a publisher. A Free Standard member applies for Free Basic first, which is free." },
  { q: "What about booking sessions?", a: "Sessions are personal services, not post earnings. Each author keeps their own calendar, price and payout, and a co-authored post shows a “book a session” link for every author. Nothing about a session is split." },
  { q: "Who can edit the post?", a: "The lead author. Co-authors are credited and share earnings but don't edit the draft." },
  { q: "Can the split change after publishing?", a: "No. It's fixed when the post goes live, so nobody can be surprised later." },
  { q: "What if someone declines or I change my mind?", a: "A declined invite just frees the slot. You can withdraw a pending or accepted invite any time before you publish." },
];

export default function CoauthoringPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Product</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">Write together. Share the credit — and the earnings.</h1>
      <p className="mt-5 max-w-2xl text-lg text-slate">
        Pro and Business publishers can co-author a post with other members, agree up front who gets what share of what it earns, and
        share the byline. Consent is built in: everyone accepts before they&apos;re listed, and the split locks when you publish.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <div key={s.t} className="card p-6">
            <span className="font-mono text-xs text-crimson-bright">Step {i + 1}</span>
            <h3 className="mt-2 font-ui text-lg font-bold text-ink">{s.t}</h3>
            <p className="mt-2 text-sm text-slate">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="card mt-10 p-7">
        <p className="font-ui text-base font-bold text-ink">Example</p>
        <p className="mt-2 text-sm text-slate">
          Ada writes a draft and invites Tunde at 30% and Ngozi at 20%. Ada keeps 50%. Both accept, Ada publishes, and the post is
          credited “Ada with Tunde, Ngozi”. When the post earns something that can be shared, it&apos;s split 50 / 30 / 20.
        </p>
      </div>

      <div className="mt-12">
        <p className="eyebrow">Questions</p>
        <dl className="mt-4 divide-y divide-rule border-y border-rule">
          {FAQ.map((f) => (
            <div key={f.q} className="py-4">
              <dt className="font-ui text-sm font-bold text-ink">{f.q}</dt>
              <dd className="mt-1 text-sm text-slate">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/write" className="btn-primary">Start a draft</Link>
        <Link href="/invites" className="btn-ghost">My co-author invites</Link>
      </div>
    </div>
  );
}
