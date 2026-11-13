import { createHash } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { Dept } from "./admin-access";
import type { DocCategory, DocScope } from "./staff-ops";
import { STAFF_LIBRARY_TEXT, STAFF_LIBRARY_VERSION } from "./staff-library-content";
import { announcement, cleanTerms, offerLetter, optionGrant, presetTerms } from "./hr-drafts";

// The hiring templates Nana-HR drafts from (lib/hr-drafts.ts), shown blank in the library so the executive office and Legal can review
// the wording. Every [bracket] is filled from the team hub when Nana-HR drafts for a real hire.
const BLANK = cleanTerms({ arrangement: "salary_options", reportsTo: "[who they report to]", hoursPerWeek: "[hours]" });
const TEMPLATES: Record<string, string> = {
  "template-offer": offerLetter(BLANK),
  "template-grant": optionGrant(BLANK),
  "template-announcement": announcement(BLANK),
  // The Executive Assistant's offer, ready for review: the role's duties filled in, pay, dates and equity left as [open points].
  "template-offer-chief-of-staff": offerLetter(cleanTerms({ ...presetTerms("chief-of-staff"), arrangement: "salary_options", hoursPerWeek: "20" })),
  "template-offer-executive-assistant": offerLetter(cleanTerms({ ...presetTerms("executive-assistant"), arrangement: "salary_options", hoursPerWeek: "20" })),
};
const textOf = (key: string) => STAFF_LIBRARY_TEXT[key] ?? TEMPLATES[key];

// The handbook, the SOP manuals and the department briefs, seeded into the staff library where each belongs (owner, 3 Nov 2026):
// the handbook and the shared procedures for everyone, each SOP and brief for its own department(s). Super admins see all of them.
// Seeding is idempotent: documents have fixed ids (seed-<key>); a changed text bumps the version and asks everyone to read it again.

export type SeedDoc = { key: string; title: string; category: DocCategory; description: string; scope: DocScope; depts: Dept[]; requiresAck: boolean };

export const SEED_DOCS: SeedDoc[] = [
  { key: "handbook", title: "#NotesApp Employee Handbook", category: "handbook", description: "How we work: hiring, hours and Time Track, pay and stock options, leave, remote work, conduct, data and young members, growth, concerns, leaving.", scope: "all", depts: [], requiresAck: true },
  { key: "sop-overview", title: "SOP manuals: how to use them and shared procedures", category: "sop", description: "The SOP format, and the procedures every department follows: work and approvals, incidents, data requests, releases, handovers.", scope: "all", depts: [], requiresAck: true },
  { key: "briefs-overview", title: "Department briefs: how they fit together", category: "brief", description: "Which brief and SOP each department reads, and what every brief shares.", scope: "all", depts: [], requiresAck: false },
  { key: "sop-executive", title: "SOP: Chief of Staff and executive assistants", category: "sop", description: "The leadership rhythm, decisions, meetings, board papers, onboarding, department assignments and leavers.", scope: "dept", depts: ["executive"], requiresAck: true },
  { key: "brief-executive", title: "Executive office brief", category: "brief", description: "What the executive office owns, the people side until there is an HR team, priorities and measures.", scope: "dept", depts: ["executive"], requiresAck: true },
  { key: "sop-legal", title: "SOP: Legal and compliance", category: "sop", description: "Data and legal requests, breaches, takedowns, contracts, offers and policies, young members.", scope: "dept", depts: ["legal"], requiresAck: true },
  { key: "brief-legal", title: "Legal and compliance brief", category: "brief", description: "The group, the rules that shape us, principles, priorities and measures.", scope: "dept", depts: ["legal"], requiresAck: true },
  { key: "sop-engineering", title: "SOP: Engineering", category: "sop", description: "From task to merged change, what ships with every change, data changes and deploys, incidents, security.", scope: "dept", depts: ["engineering"], requiresAck: true },
  { key: "brief-engineering", title: "The NotesApp Engineering Guide", category: "brief", description: "The founder's guide: principles, the Na- names, the stages and their triggers, recovery, Nana and the platform at scale.", scope: "dept", depts: ["engineering"], requiresAck: true },
  { key: "sop-product", title: "SOP: Product & tech", category: "sop", description: "From idea to approved spec, prices, limits and settings, launch, feedback.", scope: "dept", depts: ["product"], requiresAck: true },
  { key: "brief-product", title: "Product & tech brief", category: "brief", description: "The product family, principles, how decisions are made, priorities and measures.", scope: "dept", depts: ["product"], requiresAck: true },
  { key: "sop-marketing", title: "SOP: Marketing and user acquisition", category: "sop", description: "Launching a release, campaigns, creators, onboarding communities, Black Fridays, reporting.", scope: "dept", depts: ["marketing"], requiresAck: true },
  { key: "brief-marketing", title: "#NotesApp Marketing Brief", category: "brief", description: "Brand, the product family, audiences, positioning, the challenge, communities, acquisition, pricing, measurement, funding goals.", scope: "dept", depts: ["marketing"], requiresAck: true },
  { key: "sop-sales", title: "SOP: Sales and partnerships", category: "sop", description: "From lead to live, Enterprise and API partners.", scope: "dept", depts: ["growth"], requiresAck: true },
  { key: "brief-sales", title: "Sales and partnerships brief", category: "brief", description: "Who we sell to and what we offer each, principles, priorities and measures.", scope: "dept", depts: ["growth"], requiresAck: true },
  { key: "brief-editorial", title: "Editorial brief", category: "brief", description: "What Editorial owns (our own journals, the Academy, Naija Exam Prep, topics), principles, priorities and measures.", scope: "dept", depts: ["content"], requiresAck: true },
  { key: "sop-editorial", title: "SOP: Editorial", category: "sop", description: "Publishing on our own journals, Exam Prep questions, Academy courses, members' posts and topics.", scope: "dept", depts: ["content"], requiresAck: true },
  { key: "sop-customer-care", title: "SOP: Customer care and trust & safety", category: "sop", description: "Answering members, refunds, reports and appeals, young members, data requests.", scope: "dept", depts: ["support", "moderation"], requiresAck: true },
  { key: "brief-customer-care", title: "Customer care and trust & safety brief", category: "brief", description: "Who we serve, how we sound, the help centre and Nana, safety principles, priorities and measures.", scope: "dept", depts: ["support", "moderation"], requiresAck: true },
  { key: "sop-finance", title: "SOP: Finance and payouts", category: "sop", description: "Member payouts, refunds, referral withdrawals, payroll, spending and expenses.", scope: "dept", depts: ["finance"], requiresAck: true },
  { key: "policy-equity-plan", title: "NotesApp Inc. 2026 Equity Incentive Plan (draft for counsel review)", category: "policy", description: "The stock option plan: shares reserved, who may receive awards, vesting, when service ends, sale or listing, taxes.", scope: "dept", depts: ["executive", "legal", "finance"], requiresAck: false },
  { key: "template-offer", title: "Template: offer of employment", category: "template", description: "The offer letter Nana-HR drafts for a new employee, from the Chief of Staff's terms. For Legal's review before signing.", scope: "dept", depts: ["executive", "legal"], requiresAck: false },
  { key: "template-grant", title: "Template: executive option grant", category: "template", description: "The NotesApp Inc. option grant Nana-HR drafts under the 2026 Equity Incentive Plan. For counsel and the Board.", scope: "dept", depts: ["executive", "legal"], requiresAck: false },
  { key: "template-announcement", title: "Template: internal announcement of a new hire", category: "template", description: "The welcome announcement Nana-HR drafts; never with pay, equity or financial figures.", scope: "dept", depts: ["executive", "legal"], requiresAck: false },
  { key: "template-offer-chief-of-staff", title: "Template: offer of employment, Chief of Staff and Senior Executive Assistant", category: "template", description: "The Chief of Staff and Senior Executive Assistant's offer, from the executive offer template: duties for the first 90 days filled in; pay, dates and stock options left for Legal and the CEO (options for the Board).", scope: "dept", depts: ["executive", "legal"], requiresAck: false },
  { key: "template-offer-executive-assistant", title: "Template: offer of employment, Executive Assistant", category: "template", description: "The Executive Assistant's offer, from the executive offer template: duties for the first 90 days filled in; pay, dates and stock options left for the Chief of Staff, Legal and the CEO.", scope: "dept", depts: ["executive", "legal"], requiresAck: false },
  { key: "brief-community", title: "Community Strategist brief", category: "brief", description: "Why communities matter to NotesApp, who the Community Strategist serves, what they own, principles, the first 90 days and measures.", scope: "dept", depts: ["support"], requiresAck: true },
  { key: "sop-community", title: "SOP: Community Strategist", category: "sop", description: "Onboarding a new community, giving and tithes, events and lives, quiet communities, requests and conflicts, the monthly report.", scope: "dept", depts: ["support", "moderation"], requiresAck: true },
  { key: "playbook-government", title: "Government partnerships playbook", category: "brief", description: "Deals like SMEDAN and Zoho's: 20 Nigerian agencies and programmes, the offer for each (credits, not cash), deal terms, the pitch, the MoU outline, a 90-day plan and the risks.", scope: "dept", depts: ["growth", "executive", "legal"], requiresAck: false },
  { key: "brief-finance", title: "Finance brief", category: "brief", description: "How money flows, our revenue lines, principles, payroll, funding, priorities and measures.", scope: "dept", depts: ["finance"], requiresAck: true },
];

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const MARKER = "staffMeta/librarySeed";

// Seeds or refreshes every seeded document whose text changed. Returns how many were written. `force` skips the version marker.
export async function seedStaffLibrary(db: Firestore, now = new Date(), force = false): Promise<number> {
  const marker = db.doc(MARKER);
  // The departments are part of the version too, so moving a document to another department (Marketing split from Sales &
  // partnerships) reaches libraries that were already seeded.
  const version = `${STAFF_LIBRARY_VERSION}-${hash(Object.values(TEMPLATES).join("\n"))}-${hash(JSON.stringify(SEED_DOCS.map((s) => [s.key, s.depts])))}`;
  if (!force && (await marker.get()).data()?.version === version) return 0;
  let written = 0;
  for (const s of SEED_DOCS) {
    const body = textOf(s.key);
    if (!body) continue;
    const h = hash(body);
    const ref = db.doc(`staffDocs/seed-${s.key}`);
    const cur = (await ref.get()).data();
    const shared = { title: s.title, category: s.category, description: s.description, scope: s.scope, ...(s.depts.length ? { dept: s.depts[0], depts: s.depts } : {}), receivers: [], requiresAck: s.requiresAck, body, seedKey: s.key, seedHash: h, updatedAt: now.toISOString() };
    if (!cur) {
      await ref.set({ ...shared, version: 1, files: [], ackedBy: {}, archived: false, createdAt: now.toISOString(), createdByUid: "seed", createdByName: "#NotesApp" });
      written++;
    } else if (cur.seedHash === h && JSON.stringify(cur.depts ?? []) !== JSON.stringify(s.depts)) {
      // Same text, new department: move it without asking anyone to read it again.
      await ref.set({ dept: s.depts[0] ?? null, depts: s.depts }, { merge: true });
      written++;
    } else if (cur.seedHash !== h) {
      // A new version: everyone who must read it is asked again.
      await ref.set({ ...shared, version: (Number(cur.version) || 1) + 1, ackedBy: {} }, { merge: true });
      written++;
    }
  }
  await marker.set({ version, at: now.toISOString() });
  return written;
}

// The text documents a staff member may read, for Nana-HR: their titles and bodies.
export const seedKeyOf = (id: string) => (id.startsWith("seed-") ? id.slice(5) : null);
