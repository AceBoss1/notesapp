import Link from "next/link";
import type { Metadata } from "next";
import { GOLD_KIND_LIVE } from "@/lib/badges";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What's next for #NotesApp — social publishing, AI drafting, full white label, Paylony payments, meetings and messaging, and the ad-share program. Decided and documented, or under discussion; not built yet.",
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
      "Part 1 — capture: connect a transcription notetaker (Otter.ai, Fireflies, Read AI) to your bookings. Realistically, this means calendar auto-join (the notetaker joins any meeting on your calendar with a video link — no per-meeting invite needed) plus a real Zoom/Google Meet link #NotesApp generates at booking time. Part 2 — draft: connect Claude, Gemini, or ChatGPT to your #NotesApp account via MCP (Model Context Protocol). Drop a raw idea, or hand it that meeting summary, and it reads your own past notes for context — your topics, structure, phrasing — and finishes the draft as if you'd researched and written it yourself, not in generic AI voice. Build order matters: ship the read-only tools (search_my_notes, get_note) well before the write tool (create_draft) — let people trust an AI reading their notes before handing out write access, with token scoping, rate limits, and revocation as day-one requirements for that write tool specifically. This is steps 7–9 of the Value Loop (Capture → Refine → Publish Again), automated end to end: session → transcript → draft, ready to review and publish.",
  },
  {
    title: "Client-driven session management",
    tag: "Booking",
    body: "Booking, Paystack payment, per-publisher rates, email reminders, client rescheduling (free, up to twice, 24 hours or more ahead), cancellation under a published refund policy, \"report a problem\" after a session, and automatic payouts 24 hours after a session ends are all live. What's left is WhatsApp reminders.",
    detail:
      "WhatsApp reminders alongside email and the bell. Everything else in this item is built: see the booking policy on the booking pages and in the Terms.",
  },
  {
    title: "Gold badge — endorsements and identity checks",
    tag: "Trust",
    body: "The gold ✔ is live: apply on the verification badges page, an admin reviews it, and approved accounts subscribe (₦1,999/month personal, ₦2,999/month organisation, the same on every plan). Identity-checked gold — NIN and live face check for people, CAC for organisations, through Dojah, with a one-off non-refundable deposit — is built too, and its results now reach us automatically.",
    detail:
      "Identity-check results arrive from Dojah by signed webhook and show next to the application (we store only pass/fail, never ID data); an admin still approves, and applicants get a bell notification and an email when their application is decided. An organisation whose corporate identity check passes is marked registration-confirmed when its gold subscription starts. Coming: approving fully passed checks automatically (built, switched off until we've watched real results).",
  },
  {
    title: "Full white label for Enterprise",
    tag: "Enterprise",
    body: "Live today: Enterprise sites run on the member's own domain with the footer “Your name, powered by” and the #NotesApp icon. Next, so that nothing visitors touch says #NotesApp: sign-in and sign-up on the member's own domain, checkout that opens as a popup on their site, and email that goes out under their own name.",
    detail:
      "Sign-in: an email-and-password form on the member's domain, next to “Continue with your #NotesApp account” (which keeps Google and any future method working on every domain). Checkout: Paystack's inline popup instead of a redirect — the popup still shows #NotesApp's name, which we'll confirm with Paystack before promising otherwise. Email: each Enterprise domain becomes a verified sending domain (SPF and DKIM records the member adds), so booking and order emails come from, for example, bookings@theirbrand.com. A sweep of error pages and leftover #NotesApp wording follows. The rest of the Enterprise plan is also still to come: unlimited team seats provisioned per account, a dedicated support channel with a service-level agreement, field-team Tap-to-Pay, and syncing sales into accounting tools such as QuickBooks and Xero.",
  },
  {
    title: "NotesApp Credit and Bonus Credits",
    tag: "Payments",
    body: "A prepaid balance you top up once and spend across #NotesApp, so you don't have to enter card details every time. Planned uses: audio and video calls, boosts, verification badges, ad campaigns, and items and sessions in other members' shops.",
    detail:
      "Top up from ₦1,000 on the web. Larger top-ups will earn Bonus Credits, extra credit that is spent first, and only on calls, advert banner payments, boosts and badges. NotesApp Credit can't be sent to other members and can't be cashed out; sellers and publishers are still paid to their bank accounts, never into a balance. Paying for a shop item or session with NotesApp Credit works like paying by card: your money is held until the item is delivered or the session has happened, then the seller is paid. Premium calls will be billed from NotesApp Credit, with the rate shown before you start. Rates and bonus amounts can change, and are always shown before you pay.",
  },
  {
    title: "Paylony payments and Tap-to-Pay",
    tag: "Payments",
    body: "Paylony as the main payment provider for one-off payments and payouts, with an admin switch to fall back to Paystack. Then Tap-to-Pay: team members' Android phones taking contactless card payments at a pop-up or a customer's door.",
    detail:
      "Build order: a provider layer that handles every payment and payout through one interface, the admin switch with an automatic fallback, a Paylony webhook, Paylony payouts, then Tap-to-Pay for the team seats on Business and Enterprise, which needs an NFC-capable mobile app.",
  },
  {
    title: "#1MillionNairaNotesAppChallenge for influencers",
    tag: "Growth",
    body: "Reach 100k views and 10k followers to unlock LIVE video, then bring 2,000 registered members into a single live to open a ₦1,000,000 giveaway for that live automatically: ₦250,000 in Bonus Credits for your followers (₦5,000 to ₦25,000 each), ₦250,000 in NotesApp Credit for you, and ₦500,000 you can withdraw straight away, plus a free month of the identity-checked gold ✔ badge for you, and a free month of the maroon ✔ for each follower you pick. Prizes have a 30-day claim window.",
    detail:
      "Coming soon, together with live video. The first 10 influencers to qualify each month are paid, and each influencer can win once. Full rules, including how views, followers and live audiences are counted and checked, are confirmed before launch. See the challenge page for the details.",
  },
  {
    title: "Mobile apps — iOS and Android",
    tag: "Apps",
    body: "#NotesApp isn't complete until it runs as a real app on the devices people use: native-feeling iOS and Android apps for reading, publishing, booking sessions, getting paid, and managing your journal from your phone.",
    detail:
      "Planned with the apps: push notifications (bookings, reminders, gifts, new posts), in-app payments through Paystack, offline drafts, and — for ads — Google AdMob and other app ad networks, which only run inside mobile apps and sit alongside the NotesApp banners labelled \"Sponsored\". Tablet and desktop-installable (PWA) versions follow the phone apps.",
  },
  {
    title: "Trust, safety & account basics",
    tag: "Foundations",
    body: "The unglamorous pieces that real money needs: password reset and email verification, a bookings dashboard for both sides, a clear cancellation and refund policy, and terms and privacy consent before payment.",
    detail:
      "Already in place: rate-limiting on payment and upload endpoints, admin access through Firebase custom claims, automated Firestore security-rules tests, a public status page, a custom media domain, and private storage for paid downloads. Still planned: account deletion and data export, and error monitoring.",
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
        today. These are decided and documented, not yet built. Paid sessions (with rescheduling and automatic payouts), monthly subscriptions, publisher rates and payouts, post and item boosts, gifts, Pro / Business plans, organisation accounts, stores for physical goods and digital downloads, parcel tracking, and official merch are already live.
      </p>

      {/* The honest status strip: what's built and working versus what's still planned. */}
      <section className="mt-12 border-y border-rule py-10" aria-labelledby="true-now">
        <p id="true-now" className="eyebrow text-center">What&apos;s actually true right now</p>
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="font-ui text-sm font-bold text-ink">✓ Live today</p>
            <ul className="mt-3 space-y-2 text-sm text-slate">
              <li>Journals — real published notes, with a rich-text composer</li>
              <li>Paid 1:1 sessions on each publisher&apos;s own rate and availability, paid through Paystack, with a bookings dashboard, rescheduling and a clear cancellation policy</li>
              <li>Paid monthly journal subscriptions that unlock premium entries</li>
              <li>Post and store-item boosts (pay for validated impressions) and gifts on every profile and post — see <Link href="/boost" className="text-crimson underline">Boost</Link> and <Link href="/gifts" className="text-crimson underline">Gifts</Link></li>
              <li>Your own store with physical goods and instant digital downloads and (Pro and above) view-only files and video courses, sold through #NotesApp checkout with parcel tracking — see <Link href="/store-selling" className="text-crimson underline">Store selling</Link></li>
              <li>Paid Pro and Business plans through Paystack, and official #NotesApp merch pre-orders in Naira — see <Link href="/pricing" className="text-crimson underline">Pricing</Link> and the <Link href="/merchstore" className="text-crimson underline">Merch store</Link></li>
              <li>Your own domain (Business and Enterprise) and, on Enterprise, the server-to-server API, Console keys and webhooks — see the <Link href="/docs" className="text-crimson underline">API Docs</Link></li>
              <li>Video on posts — one MP4 or WebM per post (up to 3 minutes and 100 MB), played in our own data-friendly player, with a weekly allowance by plan</li>
              <li>Trending feed, a live <Link href="/status" className="text-crimson underline">status page</Link> and a public <Link href="/changelog" className="text-crimson underline">changelog</Link></li>
              <li>Verification badges: the maroon ✔ for accounts in good standing and the <strong className="text-ink">gold ✔ for endorsed accounts</strong>{GOLD_KIND_LIVE.identity ? " and identity-checked accounts" : ""} — see <Link href="/badges" className="text-crimson underline">Verification badges</Link></li>
              <li>Publisher payouts to a verified bank account, released automatically after the session</li>
              <li>Email confirmations and reminders · password reset and email verification</li>
              <li>Comments, likes, shares, follow — all real, all working</li>
            </ul>
          </div>
          <div>
            <p className="font-ui text-sm font-bold text-ink">○ On the roadmap, not live</p>
            <ul className="mt-3 space-y-2 text-sm text-slate">
              <li>WhatsApp reminders alongside email and the bell</li>
              {GOLD_KIND_LIVE.identity ? null : <li>Automatic identity-checked gold badge (all built; NIN + face check for people, CAC for organisations awaiting final tests)</li>}
              <li>Full white label for Enterprise</li>
              <li>NotesApp Credit and Bonus Credits</li>
              <li>Paylony payments and Tap-to-Pay</li>
              <li><Link href="/challenge" className="text-crimson underline">#1MillionNairaNotesAppChallenge</Link> for influencers (coming soon)</li>
              <li>iOS and Android apps</li>
              <li>AI drafting, social publishing, ad-share</li>
              <li>Audio and video meetings, meeting chat (under team discussion)</li>
              <li>Direct messages + audio and video calls (under team discussion)</li>
            </ul>
          </div>
        </div>
      </section>

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

      <div className="card mt-6 border-dashed p-7">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">
          Under discussion
        </span>
        <h2 className="mt-2 font-display text-2xl text-ink">Audio and video meetings, and messaging</h2>
        <p className="mt-3 text-slate">
          Nothing here is built or decided yet — this is what we&apos;re weighing. The idea is that a booked session can happen inside #NotesApp, and that publishers
          and organisations can be reached directly from their profiles.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate">
          <li><strong className="text-ink">Meetings.</strong> Audio and video sessions powered by Daily, started from a booking: one link, no separate meeting app. Daily&apos;s ready-made call screen already covers the basics below, which we&apos;d confirm before building.</li>
          <li><strong className="text-ink">Transcripts and AI notes.</strong> Optional transcription, with an AI note-taker that joins, writes up the session and reports back to the publisher (and, if they choose, the client). This would work alongside the notetaker connections already described above, not replace them.</li>
          <li><strong className="text-ink">Screen sharing and files.</strong> Screen sharing for presentations, and sharing files in the meeting.</li>
          <li><strong className="text-ink">Meeting chat.</strong> Chat during a meeting, in a group or one-to-one.</li>
          <li><strong className="text-ink">Direct messages.</strong> A message button on publisher and organisation profiles so they can be reached directly, with audio and video calls inside those conversations.</li>
        </ul>
      </div>

      <div className="card mt-6 p-7">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">
          Stores
        </span>
        <h2 className="mt-2 font-display text-2xl text-ink">Selling physical goods</h2>
        <p className="mt-3 text-slate">
          Live: stores sell through #NotesApp checkout only — buyers pay here, the money is held until they confirm delivery (or 7 days after it&apos;s marked delivered),
          stock is managed (reserved while a buyer pays, sold-out items can&apos;t be ordered, &ldquo;Notify me&rdquo; alerts land in the bell), every parcel gets a tracking ID with courier
          details or a bike/bus/park hand-off log, and an organisation&apos;s owner can give team members store access. Next: courier tracking pulled in automatically.
        </p>
        <Link href="/store-selling" className="mt-4 inline-block text-sm text-crimson underline underline-offset-2">
          How selling works →
        </Link>
      </div>

      <div className="card mt-6 p-7">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">
          Organisations
        </span>
        <h2 className="mt-2 font-display text-2xl text-ink">Organisation accounts</h2>
        <p className="mt-3 text-slate">
          Live: organisation sign-up with a CAC registration number, a free 30-day Business trial, an &ldquo;unverified organisation&rdquo; notice until we
          confirm the registration, and the maroon ✔ once confirmed. Team members too: the owner, admins and writers publish under the channel&apos;s name (four seats on Business), and
          everything their posts earn goes to the organisation&apos;s single payout account.
        </p>
        <Link href="/organisations" className="mt-4 inline-block text-sm text-crimson underline underline-offset-2">
          How organisation accounts work →
        </Link>
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
          NotesApp banners, ad tracking (unique views and clicks per publisher), monthly
          ad-share statements with fraud review and a 30-day payout hold, and co-author
          gift splits are built. Advertisers can already buy banner campaigns online (pay with Paystack, reviewed before they run, refunded if we can&apos;t run them or can&apos;t deliver every impression); Google ads on the web and AdMob in the mobile apps come next.
        </p>
        <Link
          href="/advertise"
          className="mt-4 inline-block text-sm text-crimson underline underline-offset-2"
        >
          Full details, and buy a campaign, on the Advertise page →
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
