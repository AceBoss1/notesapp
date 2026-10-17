import Link from "next/link";
import type { Metadata } from "next";
import { POLICY_TEXT } from "@/lib/cancellation";
import { LIMITS, formatNaira } from "@/lib/booking-time";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Booking",
  description:
    "A native booking calendar on every publishing profile — the publisher's own rate and availability, paid through Paystack, with email reminders and a clear cancellation policy.",
};

export default function BookingPage() {
  return (
    <>
      <PageHero compact max="max-w-4xl" eyebrow="Product" title={<>Booking that lives where the content does</>}>
        <p>On most platforms, a reader who wants to book you has to leave
        your article, open Calendly, and log in again. On #NotesApp the
        calendar sits on the same profile page as your writing — so the
        moment someone finishes reading is the moment they can book.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          { n: "1", t: "Read", d: "A visitor finishes your public note, or opens your profile." },
          { n: "2", t: "Book", d: "They tap Book a session and pick a date and one of your open times — your own weekly availability, shown in Lagos time." },
          { n: "3", t: "Pay & remind", d: "They pay in Naira through Paystack or from their NotesApp Credit wallet. Both of you get a confirmation email and reminders 24 hours and 1 hour before." },
        ].map((s) => (
          <div key={s.n} className="card p-6">
            <span className="font-mono text-xs text-crimson-bright">Step {s.n}</span>
            <h3 className="mt-2 font-ui text-lg font-bold text-ink">{s.t}</h3>
            <p className="mt-2 text-sm text-slate">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="card p-6">
          <p className="font-ui text-sm font-bold text-ink">For publishers</p>
          <p className="mt-2 text-sm text-slate">
            Set your session price ({formatNaira(LIMITS.sessionMinKobo)}–{formatNaira(LIMITS.sessionMaxKobo)}), length and weekly
            availability, and add your bank account. Your earnings are
            released after each session, minus NotesApp's commission for
            your tier — see{" "}
            <Link href="/pricing" className="text-crimson underline underline-offset-2">pricing</Link>.
          </p>
        </div>
        <div className="card p-6">
          <p className="font-ui text-sm font-bold text-ink">Cancellations &amp; refunds</p>
          <p className="mt-2 text-sm text-slate">{POLICY_TEXT}</p>
          <p className="mt-2 text-sm text-slate">
            Clients can reschedule or cancel themselves under this policy, and report a problem after a session. Manage your sessions any time on{" "}
            <Link href="/bookings" className="text-crimson underline underline-offset-2">your bookings page</Link>.
          </p>
        </div>
      </div>

      <div className="mt-12 text-center">
        <Link href="/journals" className="btn-primary">
          Find a publisher to book
        </Link>
        <p className="mt-3 text-xs text-slate">
          Coming next: WhatsApp reminders alongside email and the bell.
        </p>
      </div>
    </div>
    </>
  );
}
