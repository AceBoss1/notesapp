import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "My Calendar",
  description:
    "My Calendar on #NotesApp: your sessions, calls, hotel stays, tickets, events, interviews and money due in one calendar, synced to your phone's own calendar (iPhone, Google, Outlook) through a private link.",
};

// The public explainer for My Calendar (docs/MY_CALENDAR.md). The member's own calendar is /calendar.
const WHAT = [
  { e: "🛎", t: "Sessions and calls", d: "1:1 sessions and pay-per-minute calls, whether you booked them or someone booked you." },
  { e: "🏨", t: "Hotel stays", d: "Check-in and check-out, with your nights shaded. Hotel staff who handle bookings see their hotel's arrivals and departures." },
  { e: "🎟", t: "Events and paid lives", d: "Event tickets, paid live tickets, events you said you're going to, and the ones you host." },
  { e: "💼", t: "Interviews", d: "Interviews booked from Notes Jobs, as the applicant or on the hiring team, with the room to join." },
  { e: "📒", t: "Money due", d: "From Business books: when customers said they'd pay you, and when you pay your suppliers. Yours only, and never sent to your phone unless you choose." },
];

const HOW = [
  { t: "Add to my calendar", d: "On any entry, and on booking, hotel and ticket confirmations: a standard invite (.ics) that your phone opens in its own calendar. Good for one thing at a time." },
  { t: "A private calendar link", d: "Your phone's calendar (iPhone Calendar, Google Calendar on Android, Outlook) subscribes to it and keeps itself up to date: new bookings appear on their own, and cancellations go. iPhone checks about every hour; Google can take a few hours." },
  { t: "The #NotesApp app", d: "In the app for Android and iPhone, with your permission, an entry goes straight into your phone's default calendar. This comes with the next app update." },
];

const FAQ = [
  { q: "Is anything copied?", a: "No. Each entry is read from where it lives (the booking, the ticket, the stay, the job) every time you open your calendar, so a change or a cancellation shows everywhere at once." },
  { q: "Who can see my calendar link?", a: "Anyone who has it, so keep it to yourself. It carries titles and times only: never amounts, private notes or who paid what. Make a new link at any time and the old one stops at once." },
  { q: "Can I choose what goes to my phone?", a: "Yes: sessions and calls, hotel stays, events and lives, interviews, and money due, each on or off. Money due starts off." },
  { q: "What about My Cycle?", a: "Not yet. My Cycle keeps your dates locked with your passkey and encrypted, so the calendar can't read them. If it comes, it will be off unless you turn it on, and only ever say \"Private\"." },
  { q: "Will I get reminders?", a: "Bookings, interviews, events you're going to and paid lives already remind you a day and an hour before. My Calendar adds a bell shortly before sessions and calls, an hour before events you have a ticket for, the day before a hotel check-in, and, if you want it, a Monday email of the week ahead." },
  { q: "What time zone are the times in?", a: "Lagos time (WAT), the same as bookings, tickets and interviews." },
  { q: "I'm in teen mode, or on a child profile.", a: "Teens see what teen mode already allows (no Business books money). Child profiles don't have a calendar; the parent sees bookings and tickets on their own account." },
  { q: "Can it block my booking times when I'm busy elsewhere?", a: "Not yet. Connecting Google or Outlook both ways, so busy times there block your own booking slots, is planned for later." },
];

export default function MyCalendarExplainer() {
  return (
    <>
      <PageHero eyebrow="Your plans" title={<>My Calendar: everything you&apos;ve booked, in one place.</>}>
        <p>Sessions, calls, hotel stays, tickets, events, interviews and money due, in one calendar in the booking calendar&apos;s look, with a
        coloured dot for each kind. And it syncs with the calendar already on your phone.</p>
        <p className="small">For every signed-in member, in the account menu and in the phone menu.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="eyebrow">What&apos;s in it</p>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {WHAT.map((f) => (
            <div key={f.t} className="card p-6">
              <span className="text-2xl" aria-hidden>{f.e}</span>
              <h2 className="mt-2 font-ui text-lg font-bold text-ink">{f.t}</h2>
              <p className="mt-2 text-sm text-slate">{f.d}</p>
            </div>
          ))}
        </div>
        <p className="eyebrow mt-12">Syncing with your phone, three ways</p>
        <ol className="mt-4 space-y-4">
          {HOW.map((h, i) => (
            <li key={h.t} className="card flex gap-4 p-6">
              <span className="font-display text-3xl text-crimson">{i + 1}</span>
              <span><b className="block font-ui text-base text-ink">{h.t}</b><span className="mt-1 block text-sm text-slate">{h.d}</span></span>
            </li>
          ))}
        </ol>
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
          <Link href="/calendar" className="btn-primary">Open My Calendar</Link>
          <Link href="/help/my-calendar" className="btn-ghost">Read the help article</Link>
          <Link href="/booking" className="btn-ghost">Booking</Link>
        </div>
      </div>
    </>
  );
}
