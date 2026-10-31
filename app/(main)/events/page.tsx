import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import EventsHub from "@/components/events/EventsHub";

export const metadata: Metadata = {
  title: "Events",
  description: "Publish events on #NotesApp — services, meetings, launches, classes and outreaches — with Going and Interested, reminders, repeating events and a Join live link, on your profile and in Explore.",
};

const PARTS = [
  ["For every account", "People, businesses and organisations publish events. Public ones show here under Upcoming, by state and city."],
  ["Who can see it", "Public, or members only for a community's events."],
  ["Going and Interested", "People tap Going or Interested, get a bell, a phone notification and an email 24 hours and 1 hour before, and can add it to their calendar."],
  ["Repeating events", "Weekly services, monthly meetings: set it once and it repeats."],
  ["Join live", "Add a link to YouTube Live, Facebook Live, Zoom or Google Meet. Our own live streaming comes later."],
  ["Paid tickets", "Add ticket types (Regular, VIP …) with a price and how many. Buyers pay by card through #NotesApp checkout and get a QR code per ticket under My tickets; you check them in at the door by scanning or typing the code. You're paid after the event, less your plan's commission."],
];

// Events (lib/events.ts, docs/COMMUNITY.md): for every account, and the events part of Community.
export default function EventsPage() {
  return (
    <>
      <PageHero eyebrow="Events" title={<>Your events, where your people already are</>}>
        <p>Services, meetings, launches, classes and outreaches: publish them on #NotesApp, see who&apos;s coming, and remind them before it starts.</p>
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <EventsHub />
        <h2 className="mt-14 font-display text-2xl text-ink">How events work</h2>
        <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {PARTS.map(([h, t]) => <li key={h} className="card p-4"><strong className="text-ink">{h}</strong><p className="mt-1 text-slate">{t}</p></li>)}
        </ul>
        <p className="mt-10 text-sm text-slate">Running a church, NGO, school or club? Start a <Link href="/community" className="text-crimson underline">Community</Link> and add its events there, for everyone or for members only.</p>
      </div>
    </>
  );
}
