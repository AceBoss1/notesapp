import Link from "next/link";
import { Suspense } from "react";
import Directory from "@/components/community/Directory";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { planPrice } from "@/lib/pricing";
import { COMMUNITY_FREE_MEMBERS, COMMUNITY_PARTS, COMMUNITY_PHASES, UNVERIFIED_COMMUNITY_NOTICE } from "@/lib/community";

export const metadata: Metadata = {
  title: "Community for organisations",
  description: `Churches, NGOs, schools, clubs and associations bring their members together on #NotesApp: public and members-only Spaces, a General announcement channel, private Circles, Events with reminders, and Join live links. Free up to ${COMMUNITY_FREE_MEMBERS} members.`,
};

// Communities (lib/community.ts, docs/COMMUNITY.md): the directory and Start a community, then what a community has and costs. Like a
// Facebook group with a channel, run by an organisation's own admins.
export default function CommunityPage() {
  return (
    <>
      <PageHero eyebrow="Community" title={<>Bring your members together</>}>
        <p>For churches, NGOs, schools, clubs and associations with many members: post to everyone or to members only, announce to the whole community, run private rooms for your teams, and publish your events, all under your organisation&apos;s name.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Suspense><Directory /></Suspense>

        <h2 className="mt-14 font-display text-2xl text-ink">What a community has</h2>
        <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {COMMUNITY_PARTS.map((p) => (
            <li key={p.id} id={p.id} className="card p-4"><strong className="text-ink">{p.name}</strong><p className="mt-1 text-slate">{p.blurb}</p></li>
          ))}
          <li id="live" className="card p-4"><strong className="text-ink">Live</strong><p className="mt-1 text-slate">An event carries a Join live link to YouTube Live, Facebook Live, Zoom or Google Meet, shown only to that event&apos;s audience. Our own live streaming comes later, as a paid add-on.</p></li>
          <li id="giving" className="card p-4"><strong className="text-ink">Giving (later)</strong><p className="mt-1 text-slate">Offerings, tithes and campaigns with a goal, paid out to your organisation&apos;s verified bank account. Charges like a bank transfer, and cheaper from the NotesApp wallet.</p></li>
        </ul>

        <h2 className="mt-12 font-display text-2xl text-ink">Who can start one</h2>
        <p className="mt-3 text-sm text-slate">Any account can start a community. Until we&apos;ve verified the organisation behind it, the community shows this notice: <em>&ldquo;{UNVERIFIED_COMMUNITY_NOTICE}&rdquo;</em> <Link href="/organisations" className="text-crimson underline">Verification</Link> removes it.</p>

        <h2 className="mt-12 font-display text-2xl text-ink">What it costs</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate">
          <li className="card p-4"><strong className="text-ink">Free</strong> up to {COMMUNITY_FREE_MEMBERS} members: Spaces, the General channel and Events.</li>
          <li className="card p-4"><strong className="text-ink">Business ({planPrice("business")}/month)</strong>: as many members as you have, and private Circles.</li>
          <li className="card p-4"><strong className="text-ink">Live streaming</strong>: a paid add-on, once our own streaming is ready. Join live links to other services are free.</li>
        </ul>

        <h2 className="mt-12 font-display text-2xl text-ink">What&apos;s here and what&apos;s next</h2>
        <ol className="mt-4 space-y-3 text-sm text-slate">
          {COMMUNITY_PHASES.map((p) => <li key={p.n} className="card p-4"><strong className="text-ink">{p.n}. {p.title}{p.n === "1" ? " (live)" : ""}.</strong> {p.body}</li>)}
        </ol>

        <p className="mt-10 text-sm text-slate">
          Need help setting it up for your church or organisation? <Link href={`/contact?topic=organisation&message=${encodeURIComponent("Hello #NotesApp team,\n\nWe'd like Community for our organisation.\n\nName:\nWhat we are (church, NGO, school, club):\nRoughly how many members:\nPhone or WhatsApp:\n")}`} className="text-crimson underline">Tell us about it</Link>, see <Link href="/events" className="text-crimson underline">Events</Link>, or follow the <Link href="/roadmap" className="text-crimson underline">roadmap</Link>.
        </p>
      </div>
    </>
  );
}
