import Link from "next/link";

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
          { n: "2", t: "Book", d: "They pick a slot on your native calendar, right there." },
          { n: "3", t: "Pay & remind", d: "Paystack/Flutterwave collects payment; WhatsApp sends the reminder." },
        ].map((s) => (
          <div key={s.n} className="card p-6">
            <span className="font-mono text-xs text-crimson-bright">Step {s.n}</span>
            <h3 className="mt-2 font-ui text-lg font-bold text-ink">{s.t}</h3>
            <p className="mt-2 text-sm text-slate">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link href="/u/chimdinma" className="btn-primary">
          Try the live demo calendar
        </Link>
      </div>
    </div>
  );
}
