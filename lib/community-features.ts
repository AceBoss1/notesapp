import { COMMENT_MAX, COMMUNITY_FREE_MEMBERS, POST_MAX, SLOW_MODES, SPACES_MAX } from "./community";
import { GROUP_MEMBERS_MAX } from "./messages-rules";
import { GROUP_CALL_MAX } from "./group-calls";
import { DEFAULT_ROOM_FIGURES, ROOM_CHAT_MAX, ROOM_SPEAKERS_MAX, type RoomFigures } from "./rooms";
import { REPEATS } from "./events";
import { TICKETS_PER_ORDER_MAX } from "./tickets";
import { bandsText } from "./giving";
import { formatNaira } from "./booking-time";

// The four parts of a community, each with its own page at /community/<slug> (owner, 22 Oct 2026: "they would all have more details or
// own page, don't cluster them inside the community page as sections alone, though they all need to be linked"). The numbers come from
// the code that enforces them, so a page can't promise more than the product does. Each page links the help article of the same name,
// which is what Nana reads. Audio room sizes are admin settings (Admin → Limits → Audio rooms), so the page passes the live figures in
// (communityFeature(slug, figures)); without them the defaults apply.
export type CommunityFeature = {
  slug: "general" | "spaces" | "circles" | "audio-rooms" | "events";
  name: string;
  eyebrow: string;
  title: string;
  intro: string;
  shots: { desktop: string; phone: string; alt: string };
  facts: { label: string; value: string }[];
  sections: { h: string; items: string[] }[];
  help: string; // /help/<slug>
};

const slow = SLOW_MODES.filter((s) => s > 0).map((s) => (s < 60 ? `${s} seconds` : s < 3600 ? `${s / 60} min` : "1 hour")).join(", ");

export function communityFeatures(rooms: RoomFigures = DEFAULT_ROOM_FIGURES): CommunityFeature[] {
  const listening = rooms.listeners.toLocaleString("en-GB");
  return [
  {
    slug: "general", name: "General", eyebrow: "Community · General", title: "One channel every member hears",
    intro: "General is your community's announcement channel. Every member is in it from the day they join. Your admins post; members like, comment and share. It's where Sunday's service times, the outreach report and the harvest notice go.",
    shots: { desktop: "/images/community/general-desktop.webp", phone: "/images/community/general-phone.webp", alt: "The General channel of Grace Chapel Lekki: the pastor's welcome post with a photo, likes and comments" },
    facts: [
      { label: "Who's in it", value: "Every member, automatically" },
      { label: "Who posts", value: "The owner and admins" },
      { label: "Who reacts", value: "Every member: Like, Comment, Share" },
      { label: "A post", value: `Up to ${POST_MAX.toLocaleString()} characters and a photo` },
      { label: "A comment", value: `Up to ${COMMENT_MAX.toLocaleString()} characters` },
    ],
    sections: [
      { h: "How it works", items: [
        "Admins tap Create a note for every member… at the top of General, add a photo if they like, and post. Members get it in General and on the community's Home.",
        "Members like, comment (with their picture beside it) and share a post. Moderators and admins can pin a post to the top, or remove a post or a comment, from its ⋯ menu.",
        `Slow mode keeps a busy channel calm: admins can make members wait ${slow} between comments. Moderators and admins are never slowed.`,
      ] },
      { h: "Who can read it", items: [
        "Members always can.",
        "People who aren't members can read General only if your admins switch it on (Admin → What non-members see). They read it; they can't comment.",
        "When General is open to everyone, its posts can show on your profile and in Explore. When it isn't, they never leave the community.",
      ] },
      { h: "Good to know", items: [
        "General is for news from the leadership. For conversations among members, use Spaces; for small teams, use Circles; to talk live, use Audio rooms.",
      ] },
    ],
    help: "community-general",
  },
  {
    slug: "spaces", name: "Spaces", eyebrow: "Community · Spaces", title: "Rooms for the conversations your members have",
    intro: "Spaces are the topics inside your community where members post too: Prayer requests, Youth fellowship, Announcements, Alumni 2015, Volunteers. Each Space is either public or for members only, and you choose who can post in it.",
    shots: { desktop: "/images/community/spaces-desktop.webp", phone: "/images/community/spaces-phone.webp", alt: "Spaces in Grace Chapel Lekki: Prayer requests, Youth fellowship and Announcements, with members' posts" },
    facts: [
      { label: "Spaces per community", value: `Up to ${SPACES_MAX}` },
      { label: "Who's in a Space", value: "Every member: there's no separate headcount" },
      { label: "How many members", value: `Up to ${COMMUNITY_FREE_MEMBERS} free; no limit on Business` },
      { label: "Who posts", value: "Members, or admins only (you choose per Space)" },
      { label: "Who reads", value: "Public: anyone. Members only: members" },
    ],
    sections: [
      { h: "Public or members only", items: [
        "Public Space: anyone can read it, even without joining, and its posts can appear on your profile and in Explore. Good for youth events, outreach news and anything you'd put on a notice board.",
        "Members-only Space: only your members see it. Its posts never appear in Explore, search, link previews, the Weekly Digest or Nana's answers. Good for prayer requests, welfare and anything personal.",
        "The Space shows which it is under its name, so members know who can read what they write.",
      ] },
      { h: "Who posts", items: [
        "Members post: everyone in the community can write in it, like and comment.",
        "Admins only: admins post, members like and comment. Use it for a second announcement stream, like Choir notices.",
        "Slow mode, pinning and removing work the same as in General.",
      ] },
      { h: "Setting them up", items: [
        `In Admin → Spaces, add a Space with its name, public or members only, and who posts. You can have up to ${SPACES_MAX}; rename or remove them any time.`,
        "There's no joining a Space: every member of the community can open every Space they're allowed to read. If you need a small private group, that's a Circle.",
      ] },
    ],
    help: "community-spaces",
  },
  {
    slug: "circles", name: "Circles", eyebrow: "Community · Circles", title: "Private group chats for your teams",
    intro: "A Circle is a private group chat inside your community for the few people who work together: the choir, the ushers, the youth leaders, the board. Your admins set it up and choose who's in it. Nobody else sees what's said.",
    shots: { desktop: "/images/community/circles-desktop.webp", phone: "/images/community/circles-phone.webp", alt: "Circles in Grace Chapel Lekki: Choir & music team and Ushers, and the choir's group chat on a phone" },
    facts: [
      { label: "People in a Circle", value: `Up to ${GROUP_MEMBERS_MAX}, including whoever sets it up` },
      { label: "Who sets them up", value: "The owner and admins" },
      { label: "Who can be added", value: "Members of the community only" },
      { label: "Calls in a Circle", value: `Up to ${GROUP_CALL_MAX.audio} on voice, ${GROUP_CALL_MAX.video} on video` },
      { label: "Plan", value: "Business (the community owner's plan)" },
    ],
    sections: [
      { h: "What's in a Circle", items: [
        "It's a full group chat in Messages: text, photos, videos, voice notes, documents, stickers, replies and reactions, with Media, links and docs in its ⋮ menu.",
        `Group calls work in a Circle too: tap the phone or camera at the top to ring everyone (up to ${GROUP_CALL_MAX.audio} talking, or ${GROUP_CALL_MAX.video} on video), end-to-end encrypted.`,
        "Members see the Circles they're in on the community's Circles tab, with Open chat. Admins see every Circle in the community.",
      ] },
      { h: "Setting one up", items: [
        "On the Circles tab, admins type a name (Choir, Ushers, Youth leaders), tick the members to add and tap Create the Circle.",
        "Admins add or remove people later. Someone who leaves or is removed from the community also leaves its Circles.",
      ] },
      { h: "Circles, Spaces or Audio rooms?", items: [
        "A Space is a topic every member can open. A Circle is a private chat for a few named people. An Audio room is a live talk that ends when it ends.",
      ] },
    ],
    help: "community-circles",
  },
  {
    slug: "audio-rooms", name: "Audio rooms", eyebrow: "Community · Audio rooms", title: "Live talks, like Clubhouse, with a chat beside them",
    intro: `Go live with your members: a Bible study, a Q&A with the principal, a town hall. The host brings up to ${ROOM_SPEAKERS_MAX} people on stage to speak; everyone else listens, raises a hand to ask a question, and types in the room's chat.`,
    shots: { desktop: "/images/community/audio-rooms-desktop.webp", phone: "/images/community/audio-rooms-phone.webp", alt: "A live audio room, Midweek Bible study: the host and a speaker on stage, a listener, and the room chat" },
    facts: [
      { label: "Who hosts", value: "The owner, admins and moderators" },
      { label: "On stage", value: `The host and up to ${ROOM_SPEAKERS_MAX} speakers at a time` },
      { label: "Listening", value: rooms.relay ? `Up to ${listening} a room, through our relay` : `Up to ${listening} for now; hundreds with our relay, later` },
      { label: "Room chat", value: `Everyone in the room, up to ${ROOM_CHAT_MAX} characters a message` },
      { label: "Who can join", value: "Members of the community" },
      { label: "Video", value: rooms.live.video ? (rooms.relay ? `The host can turn video on and off (${rooms.live.budgetMinutes} video minutes a live); a poster shows while it's off` : "With our relay, later: the host's poster shows meanwhile") : "Sound only, with the host's poster" },
      { label: "Data saver", value: "Audio only: never downloads the video (on by itself on slow connections)" },
      { label: "Recording", value: "None: nothing is recorded or kept" },
    ],
    sections: [
      { h: "Hosting a room", items: [
        "On the community's Home, tap + Start a room, give it a name (Sunday Q&A, Midweek Bible study) and Go live. Members see it at the top of Home with Join.",
        `The stage shows empty chairs with a + on each. The host picks a stage mode and can change it during the live: Solo (only the host), Approve (people ask with +, and the host or a moderator approves) or Open (+ takes the seat at once). Up to ${ROOM_SPEAKERS_MAX} speakers at a time besides the host.`,
        "The host can invite anyone listening on stage (they accept or decline), and name moderators for the live, ticking what each may do (Basic, Full, or one by one): approve requests, invite, bring speakers down, turn mics off, remove chat messages, and more. Moderators never act on the host.",
        "A green ring shows who's talking. The host's mic button mutes and unmutes. End room ends it for everyone; the host leaving ends it too.",
        "A member with a publishing account can also host a paid live of their own, with tickets (Paid lives): the same room, outside the community, where only ticket holders come in and only the moderators the host names moderate.",
      ] },
      { h: "Listening and speaking", items: [
        "Tap Join and you're listening: no camera, no mic until you're brought up.",
        "On stage, your mic is on; tap Back to listening to step down. Leave quietly to go whenever you like.",
      ] },
      { h: "The room chat", items: [
        "While a room is on, everyone in it can type: questions for the speakers, prayer points, amens, links.",
        "On a computer the chat sits beside the room. On a phone, tap 💬 Chat; a red number shows what you missed while it was closed.",
        "The host and speakers are marked in the chat. The host or a moderator can remove a message. The chat goes when the room ends.",
      ] },
      { h: "Live: video, the poster and Audio only", items: [
        "The host picks a poster when they start the room (a picture they upload, their profile picture or the challenge art) and can change it any time. While no camera is on, everyone sees it. A poster is only a picture: it's never sent as video.",
        ...(rooms.live.video ? [
          `In a room through our relay, the host taps 🎥 Video to turn the camera on and 🎥 Video off to go back to sound, without anyone reconnecting. The host can let speakers turn video on too. Video is kept light: ${rooms.live.height}p at ${rooms.live.fps} frames a second.`,
          `Each live has ${rooms.live.budgetMinutes} video minutes, and the host sees how many are left. When they're used up, video turns off by itself ${rooms.live.graceSeconds} seconds after the host is told; the room carries on with sound.`,
          `The host gets gentle tips: when listeners fall by ${rooms.live.dropPercent}% within ${rooms.live.dropWindowMinutes} minutes, "Try ${rooms.live.tryMinutes} minutes of video?"; after ${rooms.live.burstMinutes} minutes of video in a row, "Back to audio to keep your video minutes."`,
        ] : ["Video is switched off for now: rooms are sound only, with the poster."]),
        "Listeners can tap Audio only to save data: the video isn't downloaded at all. On a slow connection it starts that way, and the choice is remembered on the device.",
        "If the host offers paid sessions, Book a session stays at the top of the room for everyone listening.",
      ] },
      { h: "How the sound travels", items: rooms.relay ? [
        "Through our relay, run by Cloudflare: the host and each speaker send their microphone once, and everyone in the room hears the stage from the relay. The sound passes through Cloudflare on its way and is never recorded or kept.",
        `So a room holds up to ${listening} listeners, and the host's phone carries no more than a speaker's.`,
      ] : [
        "For now, rooms run phone to phone: the people on stage connect straight to each other, and each listener connects to the host, whose phone sends everyone the mix. Nothing passes through #NotesApp's servers.",
        `That keeps it private but puts the host's phone in the middle, so a room holds ${listening} listeners. A host on Wi-Fi or a strong 4G connection works best. Bigger rooms come with our relay.`,
      ] },
    ],
    help: "community-audio-rooms",
  },
  {
    slug: "events", name: "Events", eyebrow: "Community · Events", title: "Your services, meetings and outreaches, with reminders",
    intro: "Put your community's programme on its Events tab: Sunday service, the workers' meeting, the harvest, an outreach. Members tap Going or Interested, get reminded before it starts, and can add it to their calendar or join it live.",
    shots: { desktop: "/images/community/events-desktop.webp", phone: "/images/community/events-phone.webp", alt: "Grace Chapel Lekki's Events tab: Sunday service every week, a members-only Workers' meeting on Google Meet, and the harvest" },
    facts: [
      { label: "Who adds them", value: "The owner and admins (any account can add its own on Events)" },
      { label: "Who sees them", value: "Everyone, or members only (you choose per event)" },
      { label: "Repeats", value: REPEATS.map((r) => r.label).join(", ") },
      { label: "Reminders", value: "24 hours and 1 hour before: bell, phone and email" },
      { label: "Live", value: "Talks in an audio room on #NotesApp; for video or a big audience, a Join live link (YouTube Live, Zoom, Meet or any https link)" },
      { label: "How far ahead", value: "Up to a year; an event can last up to 14 days" },
      { label: "Tickets", value: "Free RSVP, or paid ticket types with a QR code each" },
    ],
    sections: [
      { h: "Adding an event", items: [
        "On the community's Events tab, admins tap Add an event: a name, when it starts and ends (Lagos time), where it is (with the city and state), and a Join live link if it's streamed or online.",
        "Choose who sees it: Anyone (it's listed on #NotesApp's Events page, by state and city) or Members only (only your members see it, and only they get the Join live link).",
        "Make it repeat every week or every month, until a date if you like: set Sunday service once.",
      ] },
      { h: "Going and Interested", items: [
        "Members tap Going or Interested; the event shows how many of each.",
        "Everyone going or interested gets a reminder 24 hours and 1 hour before: a notification, a phone notification and an email.",
        "Public events have Add to calendar. If you change or cancel an event, everyone going or interested is told.",
      ] },
      { h: "Live", items: [
        `To talk live with your members, start an Audio room on #NotesApp: the host, up to ${ROOM_SPEAKERS_MAX} speakers and ${listening} listening, with a chat.`,
        "For video, or an audience bigger than a room holds, an event's Join live link opens YouTube Live, Facebook Live, Zoom, Google Meet or any https link, shown only to that event's audience. Our own live streaming comes later, as a paid add-on.",
      ] },
      { h: "Paid tickets", items: [
        "On the event's page, under Tickets, add ticket types (Regular, VIP …), each with a price and how many. With none, the event stays a free RSVP. Paid tickets need a bank account under Rates & payouts.",
        `Buyers pay by card, up to ${TICKETS_PER_ORDER_MAX} tickets at a time, and get a QR code for each under My tickets and in their email. Each lets one person in, once.`,
        "At the door, tap Check-in on the event and scan or type the code: it says whether the ticket is valid, already used or refunded, and counts who is in.",
        `You're paid after the event, with no commission: like giving, each ticket has a small charge (${bandsText(formatNaira)}) plus the card charge at cost. A refunded ticket stops working and goes back on sale.`,
      ] },
      { h: "Giving", items: [
        "Take offerings, tithes and donations on the same community: switch on Giving under Admin, name your funds, and members give with a Give button and get a receipt. See Community for the charges.",
      ] },
      { h: "Paid tickets", items: [
        "On the event's page, under Tickets, add ticket types (Regular, VIP …), each with a price and how many. With none, the event stays a free RSVP. Paid tickets need a bank account under Rates & payouts.",
        `Buyers pay by card, up to ${TICKETS_PER_ORDER_MAX} tickets at a time, and get a QR code for each under My tickets and in their email. Each lets one person in, once.`,
        "At the door, tap Check-in on the event and scan or type the code: it says whether the ticket is valid, already used or refunded, and counts who is in.",
        `You're paid after the event, with no commission: like giving, each ticket has a small charge (${bandsText(formatNaira)}) plus the card charge at cost. A refunded ticket stops working and goes back on sale.`,
      ] },
      { h: "Giving", items: [
        "Take offerings, tithes and donations on the same community: switch on Giving under Admin, name your funds, and members give with a Give button and get a receipt. See Community for the charges.",
      ] },
    ],
    help: "events",
  },
  ];
}
// The parts' names, slugs and pictures (the same whatever the figures).
export const COMMUNITY_FEATURES: CommunityFeature[] = communityFeatures();
export const communityFeature = (slug: string, rooms?: RoomFigures) => communityFeatures(rooms).find((f) => f.slug === slug);
