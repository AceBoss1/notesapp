import { SITE_URL, CONTACT_EMAIL } from "@/lib/host";
// Company-level identity — distinct from the two founders' personal
// social links in lib/admin.ts. Central place so the domain/handles
// only need updating in one spot.

// The legal entity behind #NotesApp, from the CAC certified extract (2 Sep 2026) and the
// Nigeria Revenue Service tax ID letter (3 Sep 2026). The registered address is on the CAC
// register but is also the director's residence, so it is deliberately not shown on the site.
// `smedanId` stays null until the SMEDAN registration exists; set it and it appears in the
// footer and on /security.
export const COMPANY_INFO = {
  legalName: "NOTESAPP TECHNOLOGIES LTD",
  rcNumber: "9825642",
  registeredOn: "2026-09-02",
  tin: "2623750527563",
  smedanId: null as string | null,
};

// The first reference customers' logos (their profile pictures), shown as small rounded squares beside their names.
export const PARTNER_ICONS = {
  precheks: "https://media.notesapp.name.ng/avatars/Cmz7aPEa6RdkTF8VTZtm44aiUo92/1791174100104-favicon-icon.png",
  apexglitz: "https://media.notesapp.name.ng/avatars/26Ss0mx0scTK00KdErkqov5dKo72/1791215458894-apexjpeg.jpeg",
};

export const SITE = {
  url: SITE_URL,
  email: CONTACT_EMAIL,
  linkedin: "https://www.linkedin.com/company/na-notesapp",
  facebook: "https://web.facebook.com/na-notesapp",
  // Our community server, na-notesapp: help from the team and other members, the API and MCP, Notes Life, and every release
  // (lib/discord.ts posts new changelog entries to its #announcements channel).
  discord: "https://discord.gg/bbkg47stW",
};
export const DISCORD_LABEL = SITE.discord.replace(/^https?:\/\//, "");

// The standard "what is #NotesApp" description: the site's meta description, the app manifest, the About intro,
// the help centre's "What is #NotesApp?" article and Nana's answer all use these words. Change them here.
export const WHAT_IS_INTRO =
  "#NotesApp is one home for African creators, professionals and businesses and the people they serve, where everyone is welcome as family: publish your work, take bookings, sell, teach, talk and get paid in Naira, all in one place.";
export const WHAT_YOU_CAN_DO = [
  "Write journals and share them with readers who follow you and the topics they care about",
  "Take bookings for private 1:1 sessions",
  "Sell physical goods, digital downloads, PDFs and video courses, in your own store and in Notes Market",
  "Teach free and paid courses in Notes Academy, on your own, with co-tutors or as an organisation, and give learners certificates anyone can check",
  "Prepare for JAMB, WAEC and NECO with Naija Exam Prep: free practice questions with explanations, timed mocks and packs that work offline",
  "Run a community for your church, school, club or business, with announcements, Spaces, private Circles, audio rooms and events",
  "Message people and groups, and make free voice and video calls",
  "Ask Nana, our AI helper, about the platform, and let her suggest topics, summarise and translate chats",
  "Earn from journal subscriptions and gifts",
  "Run it all under your own name, with your own site from Free Basic and your own domain on Business and Enterprise plans",
  "Play Notes Life, our free life game, with your NotesApp account",
];
// Our vision and mission (owner, 29 Oct 2026). The About page, the engineering guide and the investor deck use these words.
export const VISION = "Africa\u2019s knowledge, shared, valued and rewarded.";
export const MISSION =
  "#NotesApp gives Africa\u2019s creators, teachers, professionals and businesses one home to share what they know, teach it, sell it and get paid for it, in their own currency and, in time, their own language.";
export const MISSION_PILLARS = [
  { title: "Share", copy: "Journals, communities, messages and calls take what people know to the people who need it." },
  { title: "Learn", copy: "Notes Academy, Naija Exam Prep and certificates anyone can check turn knowledge into qualifications." },
  { title: "Earn", copy: "Bookings, subscriptions, gifts, Notes Market and course sales pay out in Naira, with our commissions set out in the open." },
  { title: "Belong", copy: "Everyone is welcome as family: readers become buyers, learners become teachers, customers become creators." },
  { title: "Include", copy: "Built for African realities: phone-first, light on data, local payments, and African languages, starting with Kiswahili." },
];
export const VALUES = [
  { title: "Members first", copy: "Every feature has to help someone be heard, learn, sell or get paid." },
  { title: "Knowledge earns", copy: "What people know has value, and the people who share it deserve a fair share of what it makes." },
  { title: "Trust and safety", copy: "We protect young members, check credentials, keep data private and keep a copy nobody can reach." },
  { title: "Built for Africa", copy: "Naira first, mobile first and data-light, growing country by country across the continent." },
  { title: "Open by default", copy: "Our prices, commissions, status and changelog are public, and we build in the open." },
];
export const WHAT_IS_FREE = "Anyone can read, comment, book a session or buy from a shop for free.";
export const WHAT_IS_TIERS = "To publish and earn, you start on the free Basic tier and can move up to Pro, Business or Enterprise as you grow.";
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
// One paragraph, for meta descriptions, the manifest and Nana.
export const WHAT_IS_NOTESAPP = `${WHAT_IS_INTRO} On #NotesApp you can ${WHAT_YOU_CAN_DO.slice(0, -1).map(lower).join("; ")}; and ${lower(WHAT_YOU_CAN_DO[WHAT_YOU_CAN_DO.length - 1])}. ${WHAT_IS_FREE} ${WHAT_IS_TIERS}`;
