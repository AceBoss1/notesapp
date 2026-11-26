import Link from "next/link";
import type { Metadata } from "next";
import { POLICY_TEXT } from "@/lib/cancellation";
import { LIMITS, formatNaira } from "@/lib/booking-time";
import PageHero from "@/components/PageHero";
import MyCommission from "@/components/MyCommission";
import { getTierConfig, formatPercent } from "@/lib/tiers";
import { bandsText } from "@/lib/giving";
import { planRate } from "@/lib/pricing";
import { loadLivePricing } from "@/lib/pricing-server";
import { SEATS_MAX, SEATS_MIN } from "@/lib/meetings";

export const metadata: Metadata = {
  title: "Events, meetings and sessions",
  description: "Three ways for people to book you on #NotesApp, in person, online or both: events with tickets, small paid meetings with seats, and 1:1 sessions from your open times, paid in naira.",
};

// Events, meetings and sessions (docs/EVENTS_DISCOVER.md; owner approved 26 Nov 2026): what each is for and what each costs, from Admin →
// Pricing (redrawn each minute).
export const revalidate = 60;

export default async function BookingPage() {
  await loadLivePricing();
  const ent = getTierConfig("enterprise");
  const rates = `Free Basic ${planRate("basic", "session")}, Pro ${planRate("pro", "session")}, Business ${planRate("business", "session")}, Enterprise ${formatPercent(ent.sessionAndUnlockCommission, ent.sessionAndUnlockCommissionFloor)}`;
  const kinds = [
    {
      icon: "🎟️", title: "Events", href: "/events/new", cta: "Create an event", primary: true,
      body: "One-to-many at a set time: launches, services, classes, meetups, concerts. In person, online or both.",
      points: ["Free, paid tickets (Regular, VIP…) or approval to join", "Unlimited guests, or a limit you set; QR tickets and check-in", "A cover or a theme, a category, and your calendar people follow"],
      price: <>Free events cost nothing. Tickets: <b>{bandsText(formatNaira)}</b> each, plus the card charge at cost. <b>No commission</b>, on every plan.</>,
    },
    {
      icon: "👥", title: "Meetings", href: "/meetings/new", cta: "Set up a meeting",
      body: "A small group at a set time: office hours, workshops, cohort calls, group coaching.",
      points: [`${SEATS_MIN} to ${SEATS_MAX} seats, free or a price per seat`, "In person, online (your Zoom, Meet or Teams link) or both", "The session cancellation policy; full refunds if you cancel"],
      price: <>Free meetings cost nothing. Paid seats: <b>your plan&apos;s commission</b>, the same as sessions: {rates}.</>,
    },
    {
      icon: "🗓️", title: "Sessions", href: "/profile/publishing", cta: "Open your sessions",
      body: "One-to-one, booked from your open times: coaching, consulting, therapy, tutoring, legal advice.",
      points: [`Your price (${formatNaira(LIMITS.sessionMinKobo)}–${formatNaira(LIMITS.sessionMaxKobo)}) and length`, "In person, a #NotesApp call, your own link, or the client's choice", "Reschedule and cancel under a clear policy; paid out after"],
      price: <>Your plan&apos;s commission: <b>{rates}</b>. Try Pro or Business free for 15 days and see what you&apos;d keep.</>,
    },
  ];
  const rows: [string, string, string, string][] = [
    ["How many people", "Unlimited, or a limit you set", `${SEATS_MIN} to ${SEATS_MAX} seats`, "One"],
    ["When", "A set time (can repeat)", "A set time", "From your open times"],
    ["What we take", "₦10–₦50 a ticket, no commission", "Your plan's commission on paid seats", "Your plan's commission"],
    ["Where", "A place, online, or both", "A place, your link, or both", "In person, a #NotesApp call, your link, or the client's choice"],
    ["Refunds", "Your ticket policy", "The session policy", "The session policy"],
  ];
  return (
    <>
      <PageHero compact max="max-w-5xl" eyebrow="Booking" title={<>Events, meetings and sessions</>}>
        <p>Three ways for people to book you, all on your profile, your calendar and Discover, paid in naira through Paystack or NotesApp Credit, with reminders 24 hours and 1 hour before. Each can be in person, online or both.</p>
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {kinds.map((k) => (
            <div key={k.title} className="card flex flex-col gap-3 p-5">
              <span className="text-3xl" aria-hidden>{k.icon}</span>
              <h2 className="font-ui text-lg font-bold text-ink">{k.title}</h2>
              <p className="text-sm text-slate">{k.body}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink">{k.points.map((p) => <li key={p}>{p}</li>)}</ul>
              <p className="rounded-xl bg-field p-3 text-xs leading-relaxed text-ink [&_b]:text-crimson">{k.price}</p>
              <Link href={k.href} className={`${k.primary ? "btn-primary" : "btn-ghost"} mt-auto justify-center !py-2 text-xs`}>{k.cta}</Link>
            </div>
          ))}
        </div>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-rule">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="bg-crimson text-white"><th className="px-4 py-3" /><th className="px-4 py-3">Events</th><th className="px-4 py-3">Meetings</th><th className="px-4 py-3">Sessions</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r[0]} className="border-t border-rule bg-white even:bg-paper"><td className="px-4 py-3 font-semibold">{r[0]}</td><td className="px-4 py-3">{r[1]}</td><td className="px-4 py-3">{r[2]}</td><td className="px-4 py-3">{r[3]}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <p className="font-ui text-sm font-bold text-ink">For hosts</p>
            <p className="mt-2 text-sm text-slate">Add your bank account under <Link href="/profile/publishing" className="text-crimson underline">Rates &amp; payouts</Link>; earnings are released after each session, meeting or event. Invite your followers and people by email: your plan includes invitations each week, with more on <Link href="/pricing#events" className="text-crimson underline">higher plans and packs</Link>.</p>
            <MyCommission kind="session" className="mt-3 text-sm font-semibold text-ink" />
          </div>
          <div className="card p-5">
            <p className="font-ui text-sm font-bold text-ink">Cancellations and refunds (sessions and meetings)</p>
            <p className="mt-2 text-sm text-slate">{POLICY_TEXT}</p>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/events" className="btn-primary">Discover events</Link>
          <Link href="/journals" className="btn-ghost">Find someone to book</Link>
        </div>
      </div>
    </>
  );
}
