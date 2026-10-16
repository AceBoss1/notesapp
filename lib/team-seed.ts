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
