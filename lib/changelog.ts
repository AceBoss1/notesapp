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
