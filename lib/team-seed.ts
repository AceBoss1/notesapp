import type { Firestore } from "firebase-admin/firestore";
import type { Status } from "./team";
import { MCP_HOST } from "@/lib/host";

// Work items the founder asked to be put on the team hub board, assigned to Engineering and Product & tech. Added once: each has a
// seedKey, and a seed never adds an item whose key is already on the board (teamSeeds/{name} records that a seed has run).
// Optional: the departments it goes to (default Engineering and Product & tech), a due date (YYYY-MM-DD, Lagos), the question when it
// needs a decision, and owner "founder" = the super admin whose visit runs the seed.
type Seed = { key: string; title: string; detail: string; status: Status; horizon: "today" | "week" | "later"; depts?: string[]; due?: string; decisionQuestion?: string; owner?: "founder" };
const ENG = ["engineering", "product"];
export const ENGINEERING_BACKLOG: Seed[] = [
  { key: "eng-trim-reads", title: "Trim whole-collection Firestore reads (notes, users, etc.)", detail: "Replace full-collection reads with indexed queries, counts and cached summaries to cut Firestore costs.", status: "todo", horizon: "week" },
  { key: "eng-legal-drafts", title: "Legal draft set: counsel pack, fixed docs 1.2–3.2, equity plan, five-director consent", detail: "Word and PDF, logo on the first page. Drafts stay with the founder until counsel has reviewed them.", status: "todo", horizon: "week" },
  { key: "eng-follow-lists", title: "Follow lists, @na-notesapp control, online/last seen", detail: "Shipped.", status: "done", horizon: "later" },
  { key: "eng-library-hub", title: "Staff library + message hub, payment assignee/deadline, Payroll", detail: "Shipped.", status: "done", horizon: "later" },
  { key: "eng-msg-header", title: "Message header with avatar/menu; group avatar, send lock, bans, mute", detail: "Shipped.", status: "done", horizon: "later" },
  { key: "eng-calls", title: "Free 1:1 voice/video calls in Messages (WebRTC) + Notes Life plan scaffold", detail: "Shipped. Cloudflare TURN key still to be fixed (see /status).", status: "done", horizon: "later" },
  { key: "eng-wallet", title: "NotesApp Credit wallet: top-up, bonus, pay with wallet, activity, refunds", detail: "Shipped. Still to do: one real ₦1,000 top-up test.", status: "done", horizon: "later" },
  { key: "eng-life-playable", title: "Notes Life first playable: rules/catalogue, server economy, 3D scenes, UI, saves, docs", detail: "Shipped, with invites, NEPA, itel Energy, generators and residents.", status: "done", horizon: "later" },
  { key: "eng-life-sound", title: "Notes Life sound not heard on phone: fix audibility + test button", detail: "Sounds now use frequencies phone speakers can play, a compressor lifts them, and Settings has Test sound. Check on a real phone.", status: "doing", horizon: "today" },
  { key: "eng-pins-typing", title: "Messages: pin messages (max 3/chat), pin chats (max 3), typing indicator", detail: "Shipped.", status: "done", horizon: "later" },
  { key: "eng-edit-consent", title: "Edit/delete messages: free while unread, consent of reader once read; requests expire 30 days", detail: "Shipped. Requests are wiped by the daily cron after 30 days.", status: "done", horizon: "later" },
  { key: "eng-12h", title: "12-hour clock across the app", detail: "Shipped.", status: "done", horizon: "later" },
  { key: "eng-call-ringing", title: "Video call: drag/swap self view, front/back camera; ringing on installed app when closed", detail: "Shipped. Check on a phone with the app installed and notifications on.", status: "doing", horizon: "today" },
  { key: "eng-team-legal-library", title: "Team access: Legal & compliance; Staff library upload while adding + 👁 who opened it", detail: "Shipped.", status: "done", horizon: "later" },
];

// Seeded once more after the Notes Life partner batch (v0.32.0).
export const LIFE_PARTNER_BACKLOG: Seed[] = [
  { key: "eng-life-outlets", title: "Notes Life: Become a Partner (Chef Adams kiosk and dine-in, itel Home and Mall Store)", detail: "Shipped in v0.32.0. Resident staff, takings held 30 game days, backup power, quality, value on the Billionaires List, owner's name on the sign.", status: "done", horizon: "later" },
  { key: "eng-life-partner-jobs", title: "Notes Life: itel Energy and Candellux jobs, staff perks, brand Jobs/Partner tabs", detail: "Shipped in v0.32.0, with real partner links (Chef Adams franchise, itel Home).", status: "done", horizon: "later" },
  { key: "eng-life-kitchen", title: "Notes Life: fridge, microwave, food spoilage, itel Power Tank 1000 and 650W panels", detail: "Shipped in v0.32.0. Food spoils after 8 game hours without a cold fridge; the Power Tank runs the fridge ~5 game hours.", status: "done", horizon: "later" },
  { key: "eng-life-billboards", title: "Notes Life: roadside billboards (itel, Chef Adams, 1M challenge)", detail: "Shipped in v0.32.0. Add new partner posters to public/images/life/billboards/.", status: "done", horizon: "later" },
  { key: "eng-life-mixed-staff", title: "Notes Life: real players working shifts at outlets other players own", detail: "Next. Today player-owned outlets are staffed by residents only; real players work at the brands' own outlets. Needs wages paid owner → player, hiring and quitting.", status: "todo", horizon: "later" },
  { key: "prod-life-partner-signoff", title: "Partners: confirm the 8% Chef Adams brand fee and itel stock pricing, and new billboard art", detail: "Agreed in the game on 14 Oct 2026; confirm with Chef Adams and itel (@clickam) and collect new poster artwork.", status: "todo", horizon: "week" },
];

// The agent layer (October 2026 scope: the NotesApp MCP server and Nana as an operator). Dates follow the plan in the scope doc: start
// 19 October, pilot with 20 creators from 7 December, launch to all plans on 11 January 2027.
const FOUNDER = { owner: "founder" as const };
export const AGENT_LAYER_BACKLOG: Seed[] = [
  { key: "agent-foundations", title: "Agent layer foundations: new scopes, action log, proposals store", detail: "Scopes read:profile, write:store, write:bookings, read:messages, write:orders beside today's five; agentActions (12 months) and agentProposals (48-hour expiry). Both the MCP server and Nana use them.", status: "todo", horizon: "week", depts: ["engineering"], due: "2026-10-25" },
  { key: "agent-subdomain", title: `Point ${MCP_HOST} at the app`, detail: "Stable address for agents and directory listings.", status: "todo", horizon: "week", depts: ["engineering", "product"], due: "2026-10-31", ...FOUNDER },
  { key: "agent-plans-decision", title: "Decide which plans get the Nana operator", detail: "Proposed: the full operator on Business and Enterprise; weekly summary and booking replies on all publishing plans.", status: "decision", horizon: "week", depts: ["product", "finance"], due: "2026-11-07", decisionQuestion: "Which plans get the full operator, and which jobs are on every publishing plan?", ...FOUNDER },
  { key: "agent-design", title: "Design pass: Nana's inbox, the Connect NotesApp screen, Connected agents in Console", detail: "Phone and desktop mockups first, then build.", status: "todo", horizon: "later", depts: ["product"], due: "2026-11-14" },
  { key: "agent-mcp-phase1", title: "NotesApp MCP server, phase 1", detail: "Remote MCP endpoint; reader tools (search creators, profile, open slots, booking link, store search); creator tools on the v1 API (profile, posts, create_draft, publish_post, bookings, orders, earnings); OAuth 2.1 with consent and revoke; rate limits; untrusted-content labels; tests and docs.", status: "todo", horizon: "later", depts: ["engineering"], due: "2026-11-15" },
  { key: "agent-pilot-recruit", title: "Recruit 20 pilot creators for the agent layer", detail: "A mix of coaches, therapists, sellers and writers who take bookings or sell weekly. Pilot runs 7 December to 10 January.", status: "todo", horizon: "later", depts: ["growth"], due: "2026-11-30" },
  { key: "agent-legal", title: "Legal review: agents acting for members", detail: "Terms and Privacy for agent access, the NDPC data-protection position, consent wording for the Connect screen. Counsel review before the pilot.", status: "todo", horizon: "later", depts: ["legal"], due: "2026-11-30" },
  { key: "agent-hosting", title: "Move Vercel and Firebase to paid plans before the pilot", detail: "Function CPU hit 3h 37m of the 4h free limit in October; the MCP endpoint and Nana's jobs add function time, reads and writes.", status: "todo", horizon: "later", depts: ["finance", "engineering"], due: "2026-11-30", ...FOUNDER },
  { key: "agent-ai-budget", title: "Set the monthly AI budget for Nana per plan", detail: "Cap on our account per plan; creators with their own connected AI account are not limited. Measured in the pilot.", status: "decision", horizon: "later", depts: ["finance", "product"], due: "2026-11-30", decisionQuestion: "What monthly AI budget does each plan get on our account?", ...FOUNDER },
  { key: "agent-referral-fee", title: "Decide whether bookings made through agents carry a referral fee", detail: "Reader-side agents can find and book creators through the MCP server.", status: "decision", horizon: "later", depts: ["finance", "growth"], due: "2026-11-30", decisionQuestion: "Do bookings that come through an outside agent carry a referral fee, and how much?", ...FOUNDER },
  { key: "agent-security-review", title: "Security review of OAuth, scopes, tokens and the action log", detail: "Before outside agents get write tools. Outside reviewer if the budget allows.", status: "todo", horizon: "later", depts: ["engineering"], due: "2026-12-04" },
  { key: "agent-nana-phase1", title: "Nana operator, phase 1", detail: "Job runner (schedules and webhooks), proposals and Nana's inbox (approve, edit, dismiss, undo), weekly summary, booking replies, message drafts, journal drafts, shipping nudges, voice profile, notifications. Money-moving actions always ask.", status: "todo", horizon: "later", depts: ["engineering"], due: "2026-12-20" },
  { key: "agent-pilot", title: "Run the agent-layer pilot with 20 creators", detail: "Exit: at least 15 of 20 approve Nana's proposals weekly, no money-moving action runs unapproved, AI cost per creator inside the plan cap.", status: "todo", horizon: "later", depts: ["product", "growth"], due: "2027-01-10" },
  { key: "agent-launch", title: "Launch the agent layer to all plans and list NotesApp in agent directories", detail: "MCP registry and the main agent directories, help article, changelog, announcement on @notesapp.", status: "todo", horizon: "later", depts: ["growth", "product"], due: "2027-01-11", ...FOUNDER },
  { key: "agent-phase2", title: "Agent layer phase 2: store, availability, message drafts, shipping tools; restock, pricing and standing permissions in Nana", detail: "After launch.", status: "todo", horizon: "later", depts: ["engineering"], due: "2027-02-14" },
];

// The .tech $1 Million No Excuses Fund application (terms: noexcuses.get.tech/terms; applications close 15 Dec 2026, 23:59 US
// Pacific). Dates leave a week's margin. The address work is in docs/DOMAIN_SWITCH.md.
export const FUND_BACKLOG: Seed[] = [
  { key: "fund-eligibility", title: "No Excuses Fund: confirm we're eligible", detail: "Every founder named on the application is 18+ and legally resident in Nigeria (not an excluded country); the company is earlier than Series A (terms 2.1, 2.2, 2.5). Note it in the staff library.", status: "todo", horizon: "week", depts: ["legal"], due: "2026-11-06", ...FOUNDER },
  { key: "fund-register-domain", title: "Register notesapp.tech in the company's name", detail: "Registered to NOTESAPP TECHNOLOGIES LTD (or a named founder), auto-renew on (terms 2.6). Then add notesapp.tech, www., app., life. and mcp. to Vercel → Domains.", status: "todo", horizon: "week", depts: ["engineering", "product"], due: "2026-10-24", ...FOUNDER },
  { key: "fund-switch-address", title: "Make notesapp.tech the primary address", detail: "Follow docs/DOMAIN_SWITCH.md: Firebase authorised domains, Resend domain, then NEXT_PUBLIC_ROOT_DOMAIN=notesapp.tech and redeploy; move the Paystack, Paylony and Dojah webhooks, the LinkedIn and X callbacks and cron-job.org.", status: "todo", horizon: "later", depts: ["engineering", "product"], due: "2026-11-14" },
  { key: "fund-site-live", title: "notesapp.tech live as the primary site before we apply", detail: "The product is used on notesapp.tech and every link we publish points there: social profiles, email signatures, the deck, partner materials, Google Search Console change of address (terms 2.6: a redirect or a landing page doesn't count). Keep it there 24 months after any award (9.3).", status: "todo", horizon: "later", depts: ["growth", "product"], due: "2026-11-30" },
  { key: "fund-funding-history", title: "Write down our funding history for the application", detail: "Every amount raised, from whom, on what terms (shares, SAFEs, notes, grants), with dates; they judge the substance, a large 'seed' can count as Series A (terms 2.5). Any change before an award must be disclosed.", status: "todo", horizon: "later", depts: ["finance"], due: "2026-11-21", ...FOUNDER },
  { key: "fund-code-ownership", title: "Confirm no employer, client or university can claim the code", detail: "Each founder and contributor: was any of it built on an employer's, client's or university's time, equipment or code? If anyone could claim it, get a written release or licence before an award (terms 4.1, 4.3).", status: "todo", horizon: "later", depts: ["legal"], due: "2026-11-21" },
  { key: "fund-third-party", title: "List the templates and third-party work we use", detail: "The application must disclose material use of existing products, templates or third-party work (terms 4.2): open-source libraries, Firebase, Paystack, Cloudflare, Anthropic, three.js and anything copied in.", status: "todo", horizon: "later", depts: ["engineering", "legal"], due: "2026-11-28" },
  { key: "fund-clean-repo", title: "Prepare a clean repository for the fund's code review", detail: "They may ask for read-only access (terms 4.5). Make a fresh repository from a cleaned copy of today's files (git history keeps everything we delete): leave out company numbers, counsel's advice, partner details and anything else reviewers shouldn't see. No live customer data, no admin credentials. Claude can prepare the clean copy; the founder decides what stays out.", status: "todo", horizon: "later", depts: ["engineering", "legal"], due: "2026-12-05", ...FOUNDER },
  { key: "fund-links-tech", title: "Marketing: publish only notesapp.tech links after the switch", detail: "The fund counts as primary the address our own marketing and links point to (terms 2.6). From the switch on: posts, bios, ads, email signatures, QR codes, the deck and partner materials use notesapp.tech; update the old links on LinkedIn, X, Facebook and Instagram. The old address keeps working quietly for people who already use it.", status: "todo", horizon: "later", depts: ["growth", "content"], due: "2026-11-21" },
  { key: "fund-submit", title: "Submit the No Excuses Fund application", detail: "Working build on notesapp.tech, the problem, what we built, traction, where it's going. Applications close 15 Dec 2026, 23:59 US Pacific; decisions by 15 Jan 2027. Answer their questions within 3 business days (terms 4.4).", status: "todo", horizon: "later", depts: ["growth", "product"], due: "2026-12-08", ...FOUNDER },
];

// Going live with v0.37.0 (the weekly digest, mention bells) and the server-owned writes that follow it.
export const LAUNCH_BACKLOG: Seed[] = [
  { key: "ops-digest-live", title: "Turn the weekly digest on", detail: "Admin → Weekly digest: Preview, Send me a test, then Turn on. Unsubscribe links are signed with CRON_SECRET unless EMAIL_LINK_SECRET is set. Check the Resend plan first: the free plan is 100 emails a day for everything.", status: "todo", horizon: "week", depts: ["engineering", "product"], due: "2026-10-30" },
  { key: "ops-resend-plan", title: "Choose the Resend plan for the digest", detail: "Free = 100 emails a day across bookings, receipts and the digest. Pro (50,000 a month) once the digest goes to everyone.", status: "decision", horizon: "week", depts: ["finance"], due: "2026-10-28", decisionQuestion: "Move Resend to a paid plan before the digest goes to everyone?" },
  { key: "ops-rules-deploy", title: "Deploy the Firestore rules (server-owned notifications and comments)", detail: "firebase deploy --only firestore after the merge: browsers can no longer write notifications or comments directly. Also publishes the Digital Witch hub presence rules still waiting.", status: "todo", horizon: "today", depts: ["engineering"], due: "2026-10-20" },
  { key: "ops-upstash", title: "Create the Upstash Redis database for shared rate limits", detail: "Free tier is enough. Put UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel; until then each server instance counts on its own.", status: "todo", horizon: "week", depts: ["engineering"], due: "2026-10-27" },
  { key: "ops-staging", title: "Set up staging (docs/STAGING.md)", detail: "A second Firebase project, the staging branch on Vercel Preview with its own variables, and the smoke test in CI.", status: "todo", horizon: "later", depts: ["engineering"], due: "2026-11-13" },
  { key: "ops-author-uids", title: "Run the journal author backfill", detail: "npx -y tsx scripts/backfill-author-uids.ts (a dry run: it lists what it would change), check the list, then again with --apply: gives every journal the account id of its author and co-authors, so a rename never loses a post.", status: "todo", horizon: "week", depts: ["engineering"], due: "2026-10-27" },
];

// #NotesApp Courses (docs/COURSES.md): free courses with the publisher's YouTube for every publishing plan; paid courses on Pro
// and Business with files in the private bucket; Enterprise from ₦100,000 a month; certificates anyone can verify and share.
export const COURSES_BACKLOG: Seed[] = [
  { key: "course-decisions", title: "Courses: decide paid video playback, the course fee, certificates on free courses and the Enterprise package", detail: "docs/COURSES.md \"Open questions\". Recommended: originals in private R2, playback through Cloudflare Stream signed tokens; certificates on free courses too; define what ₦100,000 a month covers for Enterprise.", status: "decision", horizon: "week", depts: ["product", "finance"], due: "2026-10-31", decisionQuestion: "Stream or straight-from-R2 for paid video, and what does the Enterprise course package include?", ...FOUNDER },
  { key: "course-design", title: "Courses: phone and desktop mockups (builder, course page, lesson player, certificate, verification page)", detail: "Mockups first, then build (HANDOVER.md).", status: "todo", horizon: "week", depts: ["product"], due: "2026-11-07" },
  { key: "course-step1", title: "Courses step 1: free courses with YouTube lessons, enrol and progress", detail: "Any publishing account. YouTube (privacy-enhanced player) and text lessons, the course page, enrol, progress, filed under topics.", status: "todo", horizon: "later", depts: ["engineering", "product"], due: "2026-11-28" },
  { key: "course-step2", title: "Courses step 2: certificates with verification and sharing", detail: "Issued on completion (server-only certificates/{id}), /certificates/<id> verification page with QR code, LinkedIn Add to profile, X, WhatsApp, PDF and image, Open Graph card.", status: "todo", horizon: "later", depts: ["engineering", "product"], due: "2026-12-12" },
  { key: "course-step3", title: "Courses step 3: paid courses for Pro and Business", detail: "Uploads to the private R2 bucket, signed playback, checkout and payouts like store items, two-device limit, plan flags and limits in Admin → Limits.", status: "todo", horizon: "later", depts: ["engineering", "finance"], due: "2027-01-16" },
  { key: "course-enterprise", title: "Courses for Enterprise: package and sales page (from ₦100,000 a month)", detail: "Branded certificates, cohorts, bulk learner invites, organisation reports. 'Talk to us' on the Enterprise page and Console, requests in Admin → Enterprise.", status: "todo", horizon: "later", depts: ["growth", "finance"], due: "2027-01-30" },
];

// Going live with v0.39.0: topics and interests.
export const TOPICS_BACKLOG: Seed[] = [
  { key: "topics-backfill", title: "File existing journals under topics", detail: "npx -y tsx scripts/backfill-topics.ts (a dry run lists what it would change and the journals that match no topic), then --apply. Editors file the unmatched ones from the journal form.", status: "todo", horizon: "week", depts: ["engineering", "content"], due: "2026-10-24" },
  { key: "topics-announce", title: "Tell members about Choose your interests", detail: "A post on @notesapp and @na-notesapp, the changelog, and a line in the next weekly digest: /interests puts their topics first in the feed and the digest.", status: "todo", horizon: "week", depts: ["growth", "content"], due: "2026-10-28" },
  { key: "topics-review", title: "Review the topic list after a month", detail: "Which hashtags writers type that match no topic (the backfill's list, writers' own hashtags): add topics or aliases in lib/topics.ts.", status: "todo", horizon: "later", depts: ["content", "product"], due: "2026-11-27" },
];

// A staff library entry added once (teamSeeds/{name} records it), shown to everyone on staff. The file itself is attached from the
// library page: the library keeps files in the private bucket, which a seed can't write to.
export const AGENT_SCOPE_DOC = {
  title: "Agent layer scope: NotesApp MCP server and Nana as an operator",
  category: "other",
  description: "What we're building and why: a NotesApp MCP server so any AI agent can run a creator's business with permission (and reader agents can find and book creators), and Nana as an operator who prepares the routine work and asks before anything that matters. Money never moves through an agent. Plan: start 19 Oct 2026; MCP server phase 1 by 15 Nov; Nana operator phase 1 by 20 Dec; pilot with 20 creators 7 Dec to 10 Jan; launch to all plans 11 Jan 2027; phase 2 by 14 Feb. Needs: paid Vercel and Firebase plans, an AI budget per plan, 20 pilot creators, a legal review and a security review. The tasks are on the board with owners and due dates. The full scope (tools, permissions, costs, risks) is with the founder; the PDF is attached here.",
};
export async function seedDocOnce(db: Firestore, name: string, doc: typeof AGENT_SCOPE_DOC, byUid: string, now = new Date()): Promise<boolean> {
  const mark = db.doc(`teamSeeds/${name}`);
  if ((await mark.get()).exists) return false;
  const by = { uid: byUid, name: String((await db.doc(`users/${byUid}`).get()).data()?.displayName ?? "Founder") };
  const at = now.toISOString();
  const batch = db.batch();
  batch.set(db.collection("staffDocs").doc(), { ...doc, version: 1, scope: "all", receivers: [], files: [], requiresAck: false, ackedBy: {}, archived: false, createdAt: at, createdByUid: by.uid, createdByName: by.name, updatedAt: at });
  batch.set(mark, { at, byUid: by.uid, count: 1 });
  await batch.commit();
  return true;
}

export async function seedOnce(db: Firestore, name: string, items: Seed[], byUid: string, now = new Date()): Promise<number> {
  const mark = db.doc(`teamSeeds/${name}`);
  if ((await mark.get()).exists) return 0;
  const have = new Set((await db.collection("teamItems").where("seedKey", "in", items.map((i) => i.key).slice(0, 30)).get()).docs.map((d) => String(d.data().seedKey)));
  const at = now.toISOString();
  const batch = db.batch();
  let n = 0;
  for (const i of items) {
    if (have.has(i.key)) continue;
    batch.set(db.collection("teamItems").doc(), { title: i.title, detail: i.detail, ownerUid: i.owner === "founder" ? byUid : "", depts: i.depts ?? ENG, status: i.status, horizon: i.horizon, due: i.due ?? "", blockedReason: "", decisionQuestion: i.decisionQuestion ?? "", decidedNote: "", createdByUid: byUid, createdAt: at, updatedAt: at, doneAt: i.status === "done" ? at : "", seedKey: i.key });
    n++;
  }
  batch.set(mark, { at, byUid, count: n });
  await batch.commit();
  return n;
}
