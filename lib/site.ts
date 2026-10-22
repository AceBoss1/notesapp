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
  "Ask Nana, our AI helper, about the platform, and let her suggest topics, summarise and translate chats",
  "Earn from journal subscriptions and gifts",
  "Run it all under your own name, with your own site from Free Basic and your own domain on Business and Enterprise plans",
  "Play Notes Life, our free life game",
];
export const WHAT_IS_FREE = "Anyone can read, comment, book a session or buy from a shop for free.";
export const WHAT_IS_TIERS = "To publish and earn, you start on the free Basic tier and can move up to Pro, Business or Enterprise as you grow.";
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
// One paragraph, for meta descriptions, the manifest and Nana.
export const WHAT_IS_NOTESAPP = `${WHAT_IS_INTRO} On #NotesApp you can ${WHAT_YOU_CAN_DO.slice(0, -1).map(lower).join("; ")}; and ${lower(WHAT_YOU_CAN_DO[WHAT_YOU_CAN_DO.length - 1])}. ${WHAT_IS_FREE} ${WHAT_IS_TIERS}`;
