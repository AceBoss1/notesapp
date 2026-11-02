import Link from "next/link";
import { Suspense } from "react";
import Directory from "@/components/community/Directory";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { planPrice } from "@/lib/pricing";
import { bandsText } from "@/lib/giving";
import { formatNaira } from "@/lib/booking-time";
import { COMMUNITY_FREE_MEMBERS, COMMUNITY_PARTS, COMMUNITY_PHASES, UNVERIFIED_COMMUNITY_NOTICE } from "@/lib/community";

export const metadata: Metadata = {
  title: "Community for organisations",
  description: `Churches, NGOs, schools, clubs and associations bring their members together on #NotesApp: public and members-only Spaces, a General announcement channel, private Circles, Events with reminders, paid tickets and Join live links, and giving with receipts. Free up to ${COMMUNITY_FREE_MEMBERS} members.`,
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
            <li key={p.id} id={p.id} className="card p-4">
              <strong className="text-ink">{p.name}</strong><p className="mt-1 text-slate">{p.blurb}</p>
              {p.page ? <Link href={`/community/${p.page}`} className="mt-2 inline-block font-semibold text-crimson">See how {p.name} works →</Link> : null}
            </li>
          ))}
          <li id="live" className="card p-4"><strong className="text-ink">Live</strong><p className="mt-1 text-slate">Talk live with your members in an <Link href="/community/audio-rooms" className="text-crimson underline underline-offset-2">audio room</Link> on #NotesApp. For video or a bigger audience, an event carries a Join live link (YouTube Live, Zoom, Google Meet or any https link), shown only to that event&apos;s audience, until our own live streaming comes as a paid add-on.</p></li>
          <li id="giving" className="card p-4"><strong className="text-ink">Giving</strong><p className="mt-1 text-slate">Switch it on under Admin and name your funds (Tithe, Offering, Building fund). Members give with a Give button and get a receipt; you see the gifts and totals per fund. Charges like a bank transfer (₦10 up to ₦5,000, ₦25 up to ₦50,000, ₦50 above, plus the card charge at cost by card; cheaper from the NotesApp wallet), no commission, and givers can cover them. Paid out to your verified bank account a day later, in one run. Each gift is capped at ₦20,000 until your community is verified. <Link href="/help/giving" className="text-crimson underline">How giving works</Link>.</p></li>
          <li id="tickets" className="card p-4"><strong className="text-ink">Paid tickets</strong><p className="mt-1 text-slate">Add ticket types (Regular, VIP …) to any of your events, with a price and how many. Buyers pay by card and get a QR code per ticket under My tickets and by email; you check them in at the door by scanning or typing the code. You&apos;re paid after the event, with no commission: like giving, each ticket has a small charge ({bandsText(formatNaira)}) plus the card charge at cost. <Link href="/help/event-tickets" className="text-crimson underline">How tickets work</Link>.</p></li>
        </ul>

        <h2 className="mt-12 font-display text-2xl text-ink">On your own site</h2>
        <p className="mt-3 text-sm text-slate">Have a site on #NotesApp? Link your community on <Link href="/profile/site" className="text-crimson underline">Your site</Link> and it opens inside it, at /community, on your own domain too: your members join, post, chat and go live without leaving your site.</p>

        <h2 className="mt-12 font-display text-2xl text-ink">Who can start one</h2>
        <p className="mt-3 text-sm text-slate">Any account can start a community. Until we&apos;ve verified the organisation behind it, the community shows this notice: <em>&ldquo;{UNVERIFIED_COMMUNITY_NOTICE}&rdquo;</em> <Link href="/organisations" className="text-crimson underline">Verification</Link> removes it.</p>

        <h2 className="mt-12 font-display text-2xl text-ink">What it costs</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate">
          <li className="card p-4"><strong className="text-ink">Free</strong> up to {COMMUNITY_FREE_MEMBERS} members: the General channel, Spaces, Audio rooms and Events.</li>
          <li className="card p-4"><strong className="text-ink">Business ({planPrice("business")}/month)</strong>: as many members as you have, and private Circles.</li>
          <li className="card p-4"><strong className="text-ink">Giving</strong>: no commission, on every plan. Each gift has a charge like a bank transfer ({bandsText(formatNaira)}), plus the card charge at cost when paid by card; givers can choose to cover it.</li>
          <li className="card p-4"><strong className="text-ink">Paid event tickets</strong>: no commission, on every plan, the same as giving: each ticket has the same small charge ({bandsText(formatNaira)}), plus the card charge at cost. Events bring members, so we keep them cheap. Free events stay free.</li>
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
