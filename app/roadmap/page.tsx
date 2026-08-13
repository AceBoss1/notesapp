import Link from "next/link";

const ITEMS = [
  {
    title: "One-click social publishing",
    tag: "Social",
    body: "Publish a finished draft straight to LinkedIn, TikTok, Instagram, Facebook, and WhatsApp at once — pick your platforms, one click, no separate copy-pasting into five apps.",
    detail: "Multi-platform publish from the composer, not a scheduling tool bolted on after the fact.",
  },
  {
    title: "AI content drafting",
    tag: "AI",
    body: "Two different jobs, both AI-assisted: capturing a session as it happens, and polishing raw notes into something publishable.",
    detail:
      "Session capture connects to Firefly and Read AI so a coaching call transcribes itself. Polishing connects to Claude, Gemini, or ChatGPT — your choice of model — to turn a rough private note into a publish-ready public one.",
  },
  {
    title: "Client-driven session management",
    tag: "Booking",
    body: "The booking calendar on a profile page today is a static demo. The real version lets a client reschedule themselves, gets both sides a reminder, and ties a session to actual payment.",
    detail:
      "Client-initiated rescheduling (not just booking), automatic reminders, and a real Paystack/Flutterwave charge behind the \"Confirm & pay\" button.",
  },
];

export default function RoadmapPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Coming Soon</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        What's next for #NotesApp
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-slate">
        The core loop — publish, book, get paid — is what's demoed
        today. These three are decided and documented, not yet built.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6">
        {ITEMS.map((item) => (
          <div key={item.title} className="card p-7">
            <span className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">
              {item.tag}
            </span>
            <h2 className="mt-2 font-display text-2xl text-ink">{item.title}</h2>
            <p className="mt-3 text-slate">{item.body}</p>
            <p className="mt-3 text-sm text-slate/80">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-7">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">
          Ads
        </span>
        <h2 className="mt-2 font-display text-2xl text-ink">Ad-share program</h2>
        <p className="mt-3 text-slate">
          Free journals carry ads with no revenue share; Pro and
          Business tiers get 25% and 45% respectively, from day one of
          opting in — no follower or view threshold to clear first.
        </p>
        <Link
          href="/advertise"
          className="mt-4 inline-block text-sm text-crimson underline underline-offset-2"
        >
          Full details on the Advertise page →
        </Link>
      </div>

      <p className="mt-10 text-sm text-slate">
        Something here you'd want early access to?{" "}
        <Link href="/contact" className="text-crimson underline underline-offset-2">
          Get in touch
        </Link>
        .
      </p>
    </div>
  );
}
