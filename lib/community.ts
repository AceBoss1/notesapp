// Community for organisations, churches, NGOs and clubs: coming soon (docs/COMMUNITY.md has the owner's decisions of 19 Oct 2026).
// Nothing here is live yet; these are the agreed names and limits the coming-soon pages describe, so they read the same everywhere.

export const COMMUNITY_LIVE = false;
// Free communities hold this many members; Business has no limit and adds private Circles.
export const COMMUNITY_FREE_MEMBERS = 200;
// Shown on a community until its organisation is verified (any account can start one).
export const UNVERIFIED_COMMUNITY_NOTICE = "This community hasn't been verified yet — #NotesApp has not confirmed who runs it.";

export const COMMUNITY_PARTS = [
  { id: "spaces", name: "Spaces", blurb: "Public: posts anyone can read, on your profile and in Explore. Members only: posts only your members can see, never in Explore, search, share previews or the Weekly Digest." },
  { id: "general", name: "General", blurb: "Every member is in it. An announcement channel: your admins post, members react and comment." },
  { id: "circles", name: "Circles", blurb: "Private rooms your admins set up inside the community — the choir, the youth, ushers, the board — each with its own chat. On Business." },
  { id: "events", name: "Events", blurb: "Services, meetings, outreaches and programmes, with Going and Interested, reminders, repeating events and a Join live link." },
  { id: "members", name: "Members", blurb: "Open to anyone, by approval or by invite link, with join questions (\"Which branch?\"). Owner, admins, moderators and members; the member list is for members only and never shows phone numbers." },
] as const;

export const COMMUNITY_PHASES = [
  { n: "1", title: "Community, Spaces and Events", body: "Members and roles, public and members-only Spaces, the General announcement channel, private Circles of up to 50 people on Business, Events for every account, and Join live links to YouTube Live, Facebook Live, Zoom or Google Meet." },
  { n: "2", title: "Bigger rooms, giving and tickets", body: "Circles with no member limit, giving (offerings, tithes and campaigns with a goal), and paid event tickets with check-in at the door." },
  { n: "3", title: "Our own live streaming, then group meetings", body: "Go live from your phone or studio and stream to your members on #NotesApp, with the replay kept in your members-only Space (a paid add-on). Then group video meetings." },
] as const;
