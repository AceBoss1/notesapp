import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What's next for #NotesApp — social publishing, AI drafting, client-driven booking, and the ad-share program. Decided and documented, not built yet.",
};

const ITEMS = [
  {
    title: "One-click social publishing",
    tag: "Social",
    body: "Publish a finished draft straight to LinkedIn, TikTok, Instagram, Facebook, and WhatsApp at once — pick your platforms, one click, no separate copy-pasting into five apps.",
    detail: "Multi-platform publish from the composer, not a scheduling tool bolted on after the fact.",
  },
  {
    title: "AI content drafting, connected via MCP",
    tag: "AI",
    body: "Two AI jobs, wired together into one loop: an AI notetaker that follows you into a booked session and writes it up, and your own AI assistant — connected straight to your #NotesApp data — that turns raw material into a finished draft in your voice.",
    detail:
      "Part 1 — capture: connect a transcription notetaker (Otter.ai, Fireflies, Read AI) to your bookings. Realistically, this means calendar auto-join (the notetaker joins any meeting on your calendar with a video link — no per-meeting invite needed) plus a real Zoom/Google Meet link #NotesApp generates at booking time. Part 2 — draft: connect Claude, Gemini, or ChatGPT to your #NotesApp account via MCP (Model Context Protocol). Drop a raw idea, or hand it that meeting summary, and it reads your own past notes for context — your topics, structure, phrasing — and finishes the draft as if you'd researched and written it yourself, not in generic AI voice. Build order matters: ship the read-only tools (search_my_notes, get_note) well before the write tool (create_draft) — let people trust an AI reading their notes before handing out write access, with token scoping, rate limits, and revocation as day-one requirements for that write tool specifically. This is steps 7–9 of the Value Loop (Capture → Refine → Publish Again), automated end to end: session → transcript → draft, ready to review and publish. Full breakdown of what #NotesApp can and can't guarantee about the notetaker step is in the README.",
  },
  {
    title: "Client-driven session management",
    tag: "Booking",
    body: "Booking, Paystack payment, per-publisher rates and email reminders are live. What's left is the client's side of the calendar: rescheduling and cancelling themselves.",
    detail:
      "Client-initiated rescheduling and cancellation under a published refund policy, WhatsApp reminders, and automatic payout release once a session is complete.",
  },
  {
    title: "Trust, safety & account basics",
    tag: "Foundations",
    body: "The unglamorous pieces that real money needs: password reset and email verification, a bookings dashboard for both sides, a clear cancellation and refund policy, and terms and privacy consent before payment.",
    detail:
      "Also planned: account deletion and data export, rate-limiting on payment and upload endpoints, moving admin access to Firebase custom claims, automated Firestore rules tests, error monitoring, and a custom media domain. WhatsApp reminders follow the email reminders that are already live.",
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
        today. These are decided and documented, not yet built. Paid sessions, monthly subscriptions, publisher rates and payouts, post boosts and gifts are already live.
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
