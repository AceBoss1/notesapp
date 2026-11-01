import Link from "next/link";
import type { Metadata } from "next";
import { MAX_CO_AUTHORS, MIN_CO_PERCENT, MIN_LEAD_PERCENT, MIN_VIEW_PERCENT } from "@/lib/coauthors";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Co-authoring",
  description:
    "Write a post with other #NotesApp members: choose who can view or edit the draft, agree each person's share of what it earns, and share the byline. Everyone agrees to the terms before they're listed, and the split is locked at publishing.",
};

const STEPS = [
  { t: "Start a draft", d: "Write your post as usual and save it as a draft. Co-authors can only be added while it's a draft." },
  { t: "Invite, choose access & shares", d: `Pro and Business publishers can invite up to ${MAX_CO_AUTHORS} members by username. For each: Can view (read the draft to review it) or Can view and edit (also edit its title and text), and their % of the post's earnings. You keep at least ${MIN_LEAD_PERCENT}%; a co-author who edits gets at least ${MIN_CO_PERCENT}%, a view-only reviewer can have ${MIN_VIEW_PERCENT}%.` },
  { t: "They read the terms and agree", d: "The bell and an email open the invitation: who invited them, the post, their access in plain words, their share and how it's paid, the credit, and that you keep publishing control. Accept and agree records exactly what they agreed to, and your panel shows the date. Accepting needs a publishing account (Free Basic or above). Nobody is listed without saying yes." },
  { t: "Publish — split locks", d: "The byline reads “with …”, the post shows on every co-author's profile, and the agreed split can no longer change. Invites still waiting at publish time expire." },
];

const FAQ = [
  { q: "What do co-authors actually get?", a: "Credit on the byline and on their own profile, and a share of what the post earns: gifts sent on the post are split between its authors in the agreed percentages today (each portion paid like any gift, minus that author's own plan commission), and the ad share on the post is split the same way once ad-share payouts launch. Sessions stay personal — see below." },
  { q: "Who can lead a co-authored post?", a: "Pro, Business and Enterprise publishers. Co-authoring is how a bigger publisher brings in contributors and pays them fairly." },
  { q: "Who can I invite? Do they need a paid plan?", a: "Anyone with an account. They don't need a paid plan — but to accept, they need a publishing account (Free Basic or above), because their share is paid out to a publisher. A Free Standard member applies for Free Basic first, which is free." },
  { q: "What about booking sessions?", a: "Sessions are personal services, not post earnings. Each author keeps their own calendar, price and payout, and a co-authored post shows a “book a session” link for every author. Nothing about a session is split." },
  { q: "Who can see or edit the draft?", a: "You choose per co-author. Can view: they read the draft (read-only) to review it. Can view and edit: they also edit its title and text, and their saves go straight into the draft (your editor warns you before you save over them). Either way, publishing, the address, topics and pictures, the split and the invitations stay with you." },
  { q: "Can I change someone's access or share?", a: "Yes, while it's a draft. Less access applies at once and they're told. More access or a different share is sent for them to agree; until they do, the terms they agreed to stay." },
  { q: "Can the split change after publishing?", a: "No. It's fixed when the post goes live, so nobody can be surprised later." },
  { q: "What if someone declines, wants to leave, or I change my mind?", a: "A declined invite just frees the slot. A co-author can leave any time before you publish, and you can withdraw a pending invite or remove a co-author too. Everyone involved is told." },
  { q: "What about invites sent before access levels?", a: "They keep what they had: credit and a share, without seeing the draft, until you offer access and they agree." },
];

export default function CoauthoringPage() {
  return (
    <>
      <PageHero eyebrow="Product" title={<>Write together. Share the credit — and the earnings.</>}>
        <p>Pro and Business publishers can co-author a post with other members, choose who can view or edit the draft, agree up front who
        gets what share of what it earns, and share the byline. Consent is built in: everyone reads the terms and agrees before
        they&apos;re listed, and the split locks when you publish. <Link href="/help/co-authoring">Read the help article</Link>.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

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
          Ada writes a draft and invites Tunde to view and edit at 30%, and Ngozi to view (to review it) at 20%. Ada keeps 50%. Both
          accept and agree, Tunde polishes the text, Ada publishes, and the post is credited “Ada with Tunde, Ngozi”. When the post
          earns something that can be shared, it&apos;s split 50 / 30 / 20.
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
    </>
  );
}
