import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Events",
  description: "Coming soon: publish events on #NotesApp — services, meetings, launches, classes and outreaches — with Going and Interested, reminders, repeating events and a Join live link, on your profile and in Explore.",
};

const PARTS = [
  ["For every account", "People, businesses and organisations publish events. They show in an Events tab on your profile, and public ones in Explore under Upcoming events, by state and city."],
  ["Who can see it", "Public, members only (for a community), or one private Circle."],
  ["Going and Interested", "People tap Going or Interested, get a bell, a phone notification and an email 24 hours and 1 hour before, and can add it to their calendar."],
  ["Repeating events", "Weekly services, monthly meetings: set it once and it repeats."],
  ["Join live", "Add a link to YouTube Live, Facebook Live, Zoom or Google Meet. Only the event's audience sees it. Our own live streaming comes later."],
  ["Tickets (later)", "Paid tickets through #NotesApp checkout, with check-in at the door."],
];

// Coming soon (docs/COMMUNITY.md): events for every account, and the events part of Community.
export default function EventsPage() {
  return (
    <>
      <PageHero eyebrow="Coming Soon · Events" title={<>Your events, where your people already are</>}>
        <p>Services, meetings, launches, classes and outreaches: publish them on #NotesApp, see who&apos;s coming, and remind them before it starts.</p>
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          {PARTS.map(([h, t]) => <li key={h} className="card p-4"><strong className="text-ink">{h}</strong><p className="mt-1 text-slate">{t}</p></li>)}
        </ul>
        <p className="mt-10 text-sm text-slate">Events arrive with <Link href="/community" className="text-crimson underline">Community</Link> for churches, NGOs, schools and clubs. Follow the <Link href="/roadmap" className="text-crimson underline">roadmap</Link>.</p>
      </div>
    </>
  );
}
