// Public release notes for /changelog. Newest first. To ship a note, add one object at the top:
// bump `version` (major = something existing changed incompatibly, minor = new features, patch = fixes),
// set the date, and tag every line Added / Changed / Fixed.
export type ChangeKind = "added" | "changed" | "fixed";
export type Release = {
  version: string;
  bump: "major" | "minor" | "patch";
  date: string; // YYYY-MM-DD
  changes: { kind: ChangeKind; text: string }[];
};

export const CHANGELOG: Release[] = [
  {
    version: "v0.6.3",
    bump: "patch",
    date: "2026-10-06",
    changes: [
      { kind: "changed", text: "Our first reference customers are now shown across the site: Precheks (a journal, at notes.precheks.com.ng) and ApexGlitz (a shop, at apexglitz.com.ng) on the landing page, About, Organisations and the footer." },
    ],
  },
  {
    version: "v0.6.2",
    bump: "patch",
    date: "2026-10-06",
    changes: [
      { kind: "added", text: "Sites on your own domain (Business and Enterprise) now have their own Terms of Service and Privacy Policy at /terms and /privacy, written in the site owner's name, linked from the footer, and carrying a “powered by #NotesApp” note." },
      { kind: "changed", text: "Pricing now reads “free forever” under Free Standard and Free Basic, and “Starting from ₦55,000+/month, or ₦550,000+/year (2 months free)” for Enterprise." },
    ],
  },
  {
    version: "v0.6.1",
    bump: "minor",
    date: "2026-10-06",
    changes: [
      { kind: "added", text: "Your own domain is now on Business as well as Enterprise: serve your page, journals and store on notes.yourbrand.com or yourbrand.com. On Business it is semi white-label — the footer reads “Your name is powered by #NotesApp” and emails go out under #NotesApp's name on your behalf. The Console is for connecting your domain; the API, keys and webhooks stay Enterprise-only." },
      { kind: "changed", text: "Enterprise now starts at ₦55,000/month, and its site footer reads “Your name, powered by” with the #NotesApp icon (Business keeps “Your name is powered by #NotesApp”)." },
      { kind: "added", text: "The status page now monitors video courses (Cloudflare Stream)." },
    ],
  },
  {
    version: "v0.6.0",
    bump: "minor",
    date: "2026-10-06",
    changes: [
      { kind: "changed", text: "New store commissions: physical items 6% on Free Basic, 4% on Pro, 2.5% on Business and from 1% on Enterprise; digital downloads 9%, 6%, 4% and from 1.5%. Enterprise starts at ₦35,000/month. Sessions, subscriptions and gifts are unchanged." },
      { kind: "added", text: "View-only files and video courses (Pro and above): add a digital item as “View only”, then add video and PDF lessons. Buyers watch and read them on #NotesApp with no download, on up to 2 devices per purchase with unlimited sessions; a third device is refused and each blocked attempt is counted. Videos are hosted on Cloudflare Stream and play only with short-lived links." },
      { kind: "added", text: "The pricing table now shows team seats and parcel tracking for each plan; About and Organisations describe the shop, the no-login parcel log and Enterprise." },
    ],
  },
  {
    version: "v0.5.8",
    bump: "minor",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "The Merch Store page now lists every publisher's shop that has something to buy right now, under Individual Shops: boosted shops first, then the most recently stocked, with search and “Show more”. A shop on its own domain opens there. Switch yours off under Rates & payouts." },
    ],
  },
  {
    version: "v0.5.7",
    bump: "patch",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "Direct links to a profile's booking card and subscribe button: add #book or #subscribe to the profile address (for example /u/yourname#book) and the page opens scrolled to it." },
    ],
  },
  {
    version: "v0.5.6",
    bump: "patch",
    date: "2026-10-05",
    changes: [
      { kind: "fixed", text: "On a custom domain whose front page is set to the shop, the Home page again shows your profile (logo, name with badges, bio, social icons, followers, Follow and Gift) above the shop instead of opening a bare shop page." },
      { kind: "changed", text: "The Boost page now lists your store items alongside your posts, so a seller with no posts can boost products from there." },
      { kind: "changed", text: "Custom domains: besides the DNS records, we now suggest pointing the domain's nameservers at Vercel, the easiest route when a domain isn't hosted anywhere yet or the provider won't take the record." },
    ],
  },
  {
    version: "v0.5.5",
    bump: "minor",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "Store items can have up to 5 photos, shown as a gallery on the item page." },
      { kind: "added", text: "Physical items can have up to two options such as Size and Colour, each with up to five choices. Stock is kept per combination, sold-out choices are crossed out, and the seller sees which option was ordered." },
      { kind: "changed", text: "Storefront cards now show the price, a short piece of the description with “Learn more »” to the full item page, and the Buy button. Items on a profile open the item itself (they used to open the #NotesApp home page), and if a seller publishes no journal, their store is the main content of their page and of their own domain's home page." },
      { kind: "fixed", text: "Custom domains: the DNS records shown now come from our host's current recommendation, with help for providers that won't accept an A record on the root domain." },
    ],
  },
  {
    version: "v0.5.4",
    bump: "patch",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "Profiles now show your social links as icons (LinkedIn, Instagram, Facebook, X, WhatsApp, website), and you can add a TikTok link under Edit profile. They also appear on your own domain's Home page." },
      { kind: "changed", text: "Enterprise commission and ad-share rates can now be agreed per account." },
    ],
  },
  {
    version: "v0.5.3",
    bump: "patch",
    date: "2026-10-05",
    changes: [
      { kind: "changed", text: "On a custom domain, the member's logo is now the browser tab icon and sits beside their name in the footer, with the #NotesApp icon next to “powered by #NotesApp”." },
    ],
  },
  {
    version: "v0.5.2",
    bump: "patch",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "Sign-in on custom domains: visitors sign in once (via www.notesapp.name.ng) and come back to your site already signed in, so they can comment, book a session and buy without leaving it. Payments return to your domain too." },
      { kind: "changed", text: "Custom domains are now a branded site of their own: your name in the header, three pages (Home with your profile and booking, Notes, Shop) and a small “powered by #NotesApp” footer, instead of the full #NotesApp navigation." },
      { kind: "fixed", text: "A custom domain now works the moment it is activated; it no longer shows “isn't connected” for a minute or two." },
      { kind: "fixed", text: "On a member's own site, a note's “More notes” shows only that member's notes, commenters' names stay plain text, and signing in, signing up or paying returns you to the page you came from." },
    ],
  },
  {
    version: "v0.5.1",
    bump: "patch",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "Cover image for video posts: choose any frame from the video or upload your own. It shows before the video plays and becomes the post's featured image unless you set a different one." },
      { kind: "fixed", text: "Shared links now preview with the post's or store item's own image, title and price instead of the site-wide image. Posts without a featured image use their video cover or first picture." },
    ],
  },
  {
    version: "v0.5.0",
    bump: "minor",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "Video on posts: add one MP4 (H.264) or WebM video, up to 3 minutes and 100 MB, from the post editor, with an automatic preview image." },
      { kind: "added", text: "Our own video player: nothing downloads until you press play, with the length and data size shown up front, speed control, full screen, keyboard shortcuts and resume where you stopped." },
      { kind: "added", text: "Weekly video allowance by plan: 2 on Free Basic, 7 on Pro, 14 on Business and 30 on Enterprise." },
      { kind: "changed", text: "The Terms now include video rules (section 2a). You'll be asked to accept them before your next payment." },
    ],
  },
  {
    version: "v0.4.1",
    bump: "patch",
    date: "2026-10-04",
    changes: [
      { kind: "added", text: "The status page now also tracks digital downloads storage, the developer API and custom-domain connections." },
      { kind: "changed", text: "The digital downloads check tests storage the way a real download reads it." },
    ],
  },
  {
    version: "v0.4.0",
    bump: "minor",
    date: "2026-10-04",
    changes: [
      { kind: "added", text: "API for Enterprise partners: publish and edit posts, and read your own bookings, orders, download sales and earnings, with scoped, revocable keys." },
      { kind: "added", text: "Console: create and revoke API keys, manage webhooks with signed deliveries, a delivery log and one-click resend, and connect your domain." },
      { kind: "added", text: "Webhooks for new bookings, paid orders, download sales, released payouts and published posts." },
      { kind: "added", text: "API Docs: quickstart, authentication, every endpoint, webhook signature verification and errors." },
      { kind: "added", text: "Your own domain for Enterprise: serve your page, journals and store on notes.yourbrand.com or yourbrand.com. Signing in and paying stay on www.notesapp.name.ng, then buyers return to your store." },
      { kind: "changed", text: "API access is switched on per account by our team." },
    ],
  },
  {
    version: "v0.3.0",
    bump: "minor",
    date: "2026-10-04",
    changes: [
      { kind: "added", text: "Boost prompt for authors: open your own unboosted post or store item and a sheet previews how a boost can look, with a Boost now shortcut." },
      { kind: "added", text: "Account data tools: download a copy of your data or delete your account yourself, under Account → Your data." },
      { kind: "added", text: "Public Trust & security page explaining how payments, files, access rules and your data are protected." },
      { kind: "added", text: "Status page upgrades: recent response times, incident history, and email updates when an incident starts or ends." },
      { kind: "added", text: "Built-in error monitoring that records faults with personal data removed and alerts our team on new kinds of error." },
      { kind: "changed", text: "The 🎁 gift button now always shows on publishers' profiles and posts; it is greyed out with a note until they have set up payouts." },
    ],
  },
  {
    version: "v0.2.0",
    bump: "minor",
    date: "2026-10-03",
    changes: [
      { kind: "added", text: "Digital downloads: sell files from your store, delivered instantly through short-lived private links and final once downloaded." },
      { kind: "added", text: "Store boosts, plus separate Digital and Physical sections in every store with a toggle on the add-item form." },
      { kind: "added", text: "Digital commission by plan: 20% Free Basic, 15% Pro, 10% Business, negotiated on Enterprise." },
      { kind: "added", text: "Merch tracking with parcel IDs, no-login rider links and delivery emails; bell notifications for every purchase and order." },
      { kind: "added", text: "Clients can reschedule or cancel a booking under a published refund policy, report a problem, and sessions pay out automatically once complete." },
      { kind: "added", text: "Joined date on profiles and a maroon/gold verified-badge prompt for visitors." },
    ],
  },
];
