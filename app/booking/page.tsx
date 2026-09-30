import Link from "next/link";
import type { Metadata } from "next";
import { POLICY_TEXT } from "@/lib/cancellation";

export const metadata: Metadata = {
  title: "Booking",
  description:
    "A native booking calendar on every publishing profile — the publisher's own rate and availability, paid through Paystack, with email reminders and a clear cancellation policy.",
};

export default function BookingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Product</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        Booking that lives where the content does
      </h1>
      <p className="mt-5 max-w-2xl text-slate">
        On most platforms, a reader who wants to book you has to leave
        your article, open Calendly, and log in again. On #NotesApp the
        calendar sits on the same profile page as your writing — so the
        moment someone finishes reading is the moment they can book.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          { n: "1", t: "Read", d: "A visitor finishes your public note." },
          { n: "2", t: "Book", d: "They pick a date and one of your open times — your own weekly availability, shown in Lagos time." },
          { n: "3", t: "Pay & remind", d: "Paystack collects payment in Naira. Both of you get a confirmation email and reminders 24 hours and 1 hour before." },
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
            Set your session price (₦5,000–₦500,000), length and weekly
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
            Manage your sessions any time on{" "}
            <Link href="/bookings" className="text-crimson underline underline-offset-2">your bookings page</Link>.
          </p>
        </div>
      </div>

      <div className="mt-12 text-center">
        <Link href="/journals" className="btn-primary">
          Find a publisher to book
        </Link>
        <p className="mt-3 text-xs text-slate">
          Coming next: clients rescheduling themselves and WhatsApp reminders.
        </p>
      </div>
    </div>
  );
}
