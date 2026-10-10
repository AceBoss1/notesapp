import Link from "next/link";
import type { Metadata } from "next";
import { GOLD_KIND_LIVE } from "@/lib/badges";
import { MESSAGES_LIVE, MOMENTS_LIVE } from "@/lib/moments-rules";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What's live and what's next for #NotesApp — moments, messages, Nana AI and publishing to LinkedIn and X are live; the team hub, AI notetaker, full white label, Paylony payments, calls and meetings, and more are next. Decided and documented, or under discussion.",
};

const ITEMS: { title: string; tag: string; body: string; detail: string; link?: { href: string; label: string } }[] = [
  {
    title: "More networks for social publishing",
    tag: "Social",
    body: "Live now: connect LinkedIn and X once and publish an excerpt from your own post, with a link back to the full journal on #NotesApp. You see and can change the words first (Nana can write them for you), and nothing goes out until you press Post. Facebook, Instagram and TikTok follow, each on its own rules.",
    detail:
      "The sharing menu on every post (WhatsApp, X, Facebook, LinkedIn, copy link) works without connecting anything. Connected posting: LinkedIn (a link card with the post's picture) and X (the text and link). Facebook only lets apps post to Pages and reviews every app, Instagram needs a professional account linked to a Page, TikTok is mostly video and keeps posts private until it has audited the app, and WhatsApp has no posting service. LinkedIn connections last about 60 days before you reconnect.",
  },
  {
    title: "Team hub and team messaging for Business and Enterprise",
    tag: "Teams",
    body: "A shared workspace for your team: a work board with what is moving, stuck or waiting on a decision, milestones, a morning summary and weekly review, and a team room for meetings and chat. Our own team is using it first (work board, money ledger, staff roles, and an Ask Nana panel that knows your open items); it opens to Business and Enterprise accounts once our internal testing is done.",
    detail:
      "We are running it ourselves before anyone else relies on it, so we can fix what gets in the way. Business and Enterprise accounts will get it for their team seats (four on Business, as many as you need on Enterprise), with the people on your team seeing only what their role needs. It builds on group chats, which are already live. No date yet; we will announce it on this page, the changelog and by email when it opens.",
    link: { href: "/teams", label: "See the team hub page →" },
  },
  {
    title: "AI notetaker and your own AI assistant (MCP)",
    tag: "AI",
    body: "Already here: Nana AI answers questions about #NotesApp and helps with your drafts, posts for LinkedIn and X, and messages (connect your own AI account on the Nana page). Still to come, two AI jobs wired together into one loop: an AI notetaker that follows you into a booked session and writes it up, and your own AI assistant — connected straight to your #NotesApp data — that turns raw material into a finished draft in your voice.",
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
    body: "Live today: Enterprise sites run on the member's own domain with the footer “Your name, powered by” and the #NotesApp icon, with sign-in and sign-up in a window in the member's name and logo (it still says plainly that it is a NotesApp account) and password-reset and confirmation emails sent in the member's name. Next, so that nothing visitors touch says #NotesApp: checkout and bookings that open as a popup on their site, and a sending address on their own domain.",
    detail:
      "Today: Google sign-in isn't offered in the window (someone who signed up with Google chooses “Forgot your password” to set one), and the sender address on those emails is still ours, with the member's name on it. Checkout: Paystack's inline popup instead of a redirect — the popup still shows #NotesApp's name, which we'll confirm with Paystack before promising otherwise. Email: each Enterprise domain becomes a verified sending domain (SPF and DKIM records the member adds), so emails come from, for example, bookings@theirbrand.com. A sweep of error pages and leftover #NotesApp wording follows. The rest of the Enterprise plan is also still to come: unlimited team seats provisioned per account, a dedicated support channel with a service-level agreement, field-team Tap-to-Pay, and syncing sales into accounting tools such as QuickBooks and Xero.",
  },
  {
    title: "Advertise on LinkedIn from #NotesApp",
    tag: "Ads",
    body: "Under review: boost one of your posts on LinkedIn from inside #NotesApp, using your own LinkedIn ad account, and see what it earned next to your #NotesApp numbers. LinkedIn has approved our first access requests, and we are building and testing it before it opens, so there is no date yet.",
    detail:
      "How it would work: you connect your LinkedIn ad account, pick a post, set a budget and audience, and LinkedIn bills you directly; #NotesApp never holds your ad money. Reporting comes back to your dashboard. Later steps, each its own approval and its own privacy review: sending sign-ups back to LinkedIn so campaigns can be measured, and bringing in LinkedIn leads. We would only list audiences you create from your own followers with your consent. LinkedIn ads cost more per click than most platforms, so this suits Business and Enterprise members selling to companies and professionals; our own boosts remain the lower-cost way to be seen on #NotesApp.",
  },
  {
    title: "Domain sales and DNS management",
    tag: "Enterprise",
    body: "Search, register and manage domains, including .ng and .com.ng, and edit DNS records without leaving #NotesApp, through our domain partner Whogohost (now go54), a gold partnership. For Business and Enterprise, with you as the registrant.",
    detail:
      "Registration asks for four sets of contact details (registrant, admin, technical and billing). We suggest what we already have, ask before using it, request anything missing, and offer to copy a finished form into the next. Then renew, lock, nameservers, transfer codes and a DNS records editor, and a one-step connection to your #NotesApp site. It starts once Whogohost confirms the search, pricing and DNS calls.",
    link: { href: "/domains", label: "See the domains page →" },
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
    body: "Reach 100k views and 10k new followers (people who join #NotesApp through you) to unlock LIVE video, then bring 2,000 registered members into a single live to open a ₦1,000,000 giveaway for that live automatically: ₦250,000 in Bonus Credits for your followers (₦5,000 to ₦25,000 each), ₦250,000 in NotesApp Credit for you, and ₦500,000 you can withdraw straight away, plus a free month of the identity-checked gold ✔ badge for you, and a free month of the maroon ✔ for each follower you pick. Prizes have a 30-day claim window.",
    detail:
      "Coming soon, together with live video. The first 10 influencers to qualify each month are paid, and each influencer can win once. Full rules, including how views, followers and live audiences are counted and checked, are confirmed before launch.",
    link: { href: "/challenge", label: "See the challenge page for the details →" },
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
      "Already in place: reports on moments and conversations reviewed by our team (anything marked nudity or violence within 24 hours), suspensions for a set time that lift on their own, with appeals, rate-limiting on payment and upload endpoints, admin access through Firebase custom claims, automated Firestore security-rules tests, a public status page, a custom media domain, and private storage for paid downloads. Also live: downloading your data or deleting your account yourself, and built-in error monitoring.",
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
        today. The ones marked on the right are decided and documented, not yet built. Nana AI and the help centre, publishing to LinkedIn and X, direct and group messages, paid sessions (with rescheduling and automatic payouts), monthly subscriptions, publisher rates and payouts, post and item boosts, gifts, Pro / Business plans, organisation accounts, stores for physical goods and digital downloads, parcel tracking, and official merch are already live. Last updated 10 October 2026.
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
              {MOMENTS_LIVE && <li>Moments: a picture, a video or text, with an optional voice-over, on your profile picture for 24, 48 or 72 hours. A video over 90 seconds is split into parts (as many as your plan&apos;s weekly video allowance covers); a bar at the top fills in maroon as each moment plays; followers can like, 🔁 re-share or 💬 reply from the Moments row on the Journals page, you can see who watched, you choose whether only your followers or everyone can see yours, and anyone can block or report</li>}
              {MESSAGES_LIVE && <li>Direct messages with a live inbox: bold, italic and underline, a ✔ when sent and a ✔✔ with the time when read, pictures, videos and documents attached (how big and how many depends on your plan), voice notes of up to 5 minutes and stickers. Notifications on your device (offered when you first use Messages, and on until you turn them off), email on Business and Enterprise (off until you switch it on, at most one an hour), and block and report tools</li>}
              <li><Link href="/nana" className="text-crimson underline">Nana AI</Link> and the <Link href="/help" className="text-crimson underline">help centre</Link>: ask anything about #NotesApp, from every page and from a conversation pinned in Messages, and get writing help in drafts, shares and messages (with your own AI account connected, or ours when switched on)</li>
              <li>Publishing a post to your connected LinkedIn and X from the post itself</li>
              <li>Download your data or delete your account yourself, under Account → Your data</li>
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
              <li>Full white label for Enterprise (sign-in, sign-up and emails in the member&apos;s name are live; checkout and bookings on their own site, and their own sending address, are next)</li>
              <li><Link href="/domains" className="text-crimson underline">Domain sales and DNS management</Link> through Whogohost (now go54), for Business and Enterprise</li>
              <li>NotesApp Credit and Bonus Credits</li>
              <li>Paylony payments and Tap-to-Pay</li>
              <li><Link href="/challenge" className="text-crimson underline">#1MillionNairaNotesAppChallenge</Link> for influencers (coming soon)</li>
              <li>iOS and Android apps</li>
              <li>The team hub and team messaging for Business and Enterprise (our own team is using it now)</li>
              <li>AI notetaker and your own AI assistant through MCP</li>
              <li>Publishing to Facebook, Instagram and TikTok; LinkedIn advertising from #NotesApp (under review)</li>
              <li>Google ads on the web and AdMob in the apps</li>
              <li>Audio and video meetings, meeting chat (under team discussion)</li>
              {!MOMENTS_LIVE && <li>Moments: pictures, video and text on profile pictures for 24, 48 or 72 hours</li>}
              {!MESSAGES_LIVE && <li>Direct messages</li>}
              <li>Audio and video calls inside messages (under team discussion)</li>
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
            {item.link && <p className="mt-3 text-sm"><Link href={item.link.href} className="font-semibold text-crimson underline">{item.link.label}</Link></p>}
          </div>
        ))}
      </div>

      <div className="card mt-6 border-dashed p-7">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">
          Under discussion
        </span>
        <h2 className="mt-2 font-display text-2xl text-ink">Audio and video meetings and calls</h2>
        <p className="mt-3 text-slate">
          Nothing here is built or decided yet — this is what we&apos;re weighing. The idea is that a booked session can happen inside #NotesApp, and that publishers
          and organisations can be reached directly from their profiles (direct messages are already live; calls inside them are what&apos;s still being weighed).
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate">
          <li><strong className="text-ink">Meetings.</strong> Audio and video sessions powered by Daily, started from a booking: one link, no separate meeting app. Daily&apos;s ready-made call screen already covers the basics below, which we&apos;d confirm before building.</li>
          <li><strong className="text-ink">Transcripts and AI notes.</strong> Optional transcription, with an AI note-taker that joins, writes up the session and reports back to the publisher (and, if they choose, the client). This would work alongside the notetaker connections already described above, not replace them.</li>
          <li><strong className="text-ink">Screen sharing and files.</strong> Screen sharing for presentations, and sharing files in the meeting.</li>
          <li><strong className="text-ink">Meeting chat.</strong> Chat during a meeting, in a group or one-to-one.</li>
          <li><strong className="text-ink">Calls in messages.</strong> Audio and video calls inside direct message conversations.</li>
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
