import { isDept, type Dept } from "./admin-access";

// Careers and hiring (owner, 3 Nov 2026: "Nana-HR Spec is OK, build into team hub"). Roles are written in the team hub, opened by a
// super admin, and listed on the public careers page (/careers); people apply with their NotesApp account; Nana-HR summarises each
// application against the role's stated requirements. People make every decision: Nana-HR never ranks, scores or rejects anyone.

export type RoleStatus = "draft" | "open" | "closed";
export type Arrangement = "salary" | "salary_options" | "options_only";
export const ARRANGEMENT_LABEL: Record<Arrangement, string> = {
  salary: "Salary",
  salary_options: "Salary and stock options",
  options_only: "Stock options only (contract role)",
};
export type CareerRole = {
  id: string; title: string; dept: Dept; reportsTo: string; summary: string; about: string;
  responsibilities: string[]; requirements: string[]; hours: string; location: string; arrangement: Arrangement;
  status: RoleStatus; openedAt?: string; closedAt?: string; createdAt: string; updatedAt: string; createdByUid: string; seedKey?: string;
};
export type AppStatus = "new" | "reviewing" | "interview" | "offer" | "hired" | "declined" | "withdrawn";
export const APP_STATUS_LABEL: Record<AppStatus, string> = {
  new: "New", reviewing: "Reviewing", interview: "Interview", offer: "Offer", hired: "Hired", declined: "Not taken forward", withdrawn: "Withdrawn",
};
export const isAppStatus = (s: unknown): s is AppStatus => typeof s === "string" && s in APP_STATUS_LABEL;
export type Application = {
  id: string; roleId: string; roleTitle: string; uid: string; name: string; email: string; phone: string; city: string;
  coverNote: string; links: string[]; consentAt: string; futureRoles: boolean; status: AppStatus; createdAt: string; updatedAt: string;
  summary?: { text: string; at: string }; notes?: string; decidedBy?: string; purgeAt?: unknown;
};

export class CareersError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// Applications are kept 6 months after their role closes, then deleted (TTL on purgeAt), unless the applicant agreed to be kept.
export const KEEP_DAYS = 183;
export const CONSENT_TEXT = "I agree that #NotesApp keeps my application, my answers and my public NotesApp profile to consider me for this role, that a person reads it with a summary from Nana-HR, our AI helper, and that it's deleted 6 months after the role closes unless I tick the box below.";
export const FUTURE_TEXT = "Keep my application for future roles at #NotesApp.";

const line = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");
const list = (v: unknown, max: number, n: number) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : []).map((x) => line(String(x).replace(/^[-*•]\s*/, ""), max)).filter(Boolean).slice(0, n);

export function cleanRole(b: Record<string, unknown>): Omit<CareerRole, "id" | "status" | "createdAt" | "updatedAt" | "createdByUid" | "openedAt" | "closedAt" | "seedKey"> {
  const title = line(b.title, 100);
  if (!title) throw new CareersError("Give the role a title.");
  if (!isDept(b.dept)) throw new CareersError("Choose the role's department.");
  const arrangement = b.arrangement === "salary" || b.arrangement === "options_only" ? b.arrangement : "salary_options";
  const requirements = list(b.requirements, 200, 12);
  if (!requirements.length) throw new CareersError("List the requirements: Nana-HR summarises applications against them.");
  return {
    title, dept: b.dept, reportsTo: line(b.reportsTo, 100), summary: line(b.summary, 300), about: text(b.about, 3000),
    responsibilities: list(b.responsibilities, 240, 12), requirements, hours: line(b.hours, 100) || "20 hours a week, Monday to Friday",
    location: line(b.location, 100) || "Remote, anywhere in Nigeria", arrangement,
  };
}

export function cleanApplication(b: Record<string, unknown>): Pick<Application, "phone" | "city" | "coverNote" | "links" | "futureRoles"> {
  const coverNote = text(b.coverNote, 4000);
  if (coverNote.length < 40) throw new CareersError("Tell us in a few sentences why this role, and what you'd bring to it.");
  if (b.consent !== true) throw new CareersError("Please read and agree to how we handle your application.");
  const links = list(b.links, 300, 5).filter((l) => /^https:\/\/[^\s]+\.[^\s]+/i.test(l));
  return { phone: line(b.phone, 30), city: line(b.city, 80), coverNote, links, futureRoles: b.futureRoles === true };
}

// Who decides a role's status: a super admin opens (approves) and closes it; the Chief of Staff drafts and edits it.
export const nextStatusAllowed = (from: RoleStatus, to: RoleStatus) => from !== to && (to === "open" || to === "closed" || (to === "draft" && from === "closed"));

// The open vacancies seeded on the first run (owner, 3 Nov 2026).
const LEADER = { hours: "20 hours a week, Monday to Friday, at times agreed with your manager", location: "Remote, anywhere in Nigeria", arrangement: "salary_options" as Arrangement };
const SHARED_REQS = [
  "Lives and works in Nigeria, aged 18 or over, with a NIN and a Nigerian bank account",
  "Writes short, plain, specific English, and works from a phone or laptop on Nigerian data",
];
export const SEED_ROLES: (Omit<CareerRole, "id" | "status" | "createdAt" | "updatedAt" | "createdByUid"> & { seedKey: string })[] = [
  {
    seedKey: "cmo", title: "Chief Marketing Officer (CMO)", dept: "growth", reportsTo: "The CEO", ...LEADER,
    summary: "Own #NotesApp's marketing: the brand, the north star (naira earned by members each month), the #1MillionNaira challenge, communities and every door of the product.",
    about: "You'll lead marketing across NotesApp, Notes Academy, Naija Exam Prep, Notes Life and our communities, with the Marketing Brief as your starting point and the team hub as your desk. You set the targets, the budget and the plan, build the team, and report the numbers every week.",
    responsibilities: [
      "Own the Marketing Brief, the brand and the guardrails, and keep them current",
      "Set quarterly targets for the north star, daily active members and activation by door",
      "Run the #1MillionNaira challenge and the communities flagship with the leads",
      "Hire and lead the user-acquisition, content and partnerships people",
      "Report weekly in the team hub, and help the CEO and CFO with funding numbers",
    ],
    requirements: [
      "5+ years in marketing, with at least 2 leading a team or a brand",
      "A track record of growing a consumer or creator product in Nigeria, with numbers to show it",
      "Has run influencer or creator campaigns and community marketing",
      "Comfortable owning a budget, targets and a weekly report",
      ...SHARED_REQS,
    ],
  },
  {
    seedKey: "ua-lead", title: "User Acquisition Lead", dept: "growth", reportsTo: "The CMO", ...LEADER,
    summary: "Own the funnel from first visit to first payment: channels, campaign codes, referral links and the weekly numbers.",
    about: "You'll grow sign-ups and, more importantly, activated members for each NotesApp door, using the growth engines we've already built (referral links, affiliates, discount codes, free trials, sites, share cards) before paid media.",
    responsibilities: [
      "Own sign-ups and activation by door, and the weekly report",
      "Give every campaign its own discount code or referral link, and read the results",
      "Run and test paid media in Nigeria, mobile and Android first",
      "Work with creators, communities and partners on sign-ups",
      "Keep every campaign inside the guardrails: no promised earnings, no ads to teens",
    ],
    requirements: [
      "3+ years in user acquisition or performance marketing",
      "Has run paid social or search with a budget and reported cost per activated user",
      "Confident with funnels, cohorts and spreadsheets",
      ...SHARED_REQS,
    ],
  },
  {
    seedKey: "partnerships-lead", title: "Growth & partnerships team lead (Sales and partnerships)", dept: "growth", reportsTo: "The CMO", ...LEADER,
    summary: "Sign the churches, mosques, NGOs, schools, businesses and Enterprise partners that bring whole audiences to NotesApp, and get them live in a week.",
    about: "You'll lead sales and partnerships: communities with live services and giving, Naija Exam Prep for schools, businesses on Business plans, Enterprise and API partners, and partner brands in Notes Life.",
    responsibilities: [
      "Build and run the pipeline in the team hub, from lead to live",
      "Demo NotesApp on a phone to leaders and decision makers",
      "Get every signed organisation live within 7 days, with Customer care",
      "Agree proposals and contracts through the CEO or CFO and Legal",
      "Report organisations live and members brought in each month",
    ],
    requirements: [
      "3+ years in sales, partnerships or business development, ideally with churches, NGOs, schools or SMEs",
      "Has closed deals and kept accounts growing after the sale",
      "Confident presenting to leaders in person and on calls",
      ...SHARED_REQS,
    ],
  },
  {
    seedKey: "care-lead", title: "Customer care team lead", dept: "support", reportsTo: "The Chief of Staff", ...LEADER,
    summary: "Make every member feel looked after: answer quickly and kindly, keep the help centre right, and run the care rota.",
    about: "You'll lead customer care for members, sellers, organisations and partners: contact messages, leads, refunds with Finance, and the questions Nana couldn't answer, all in the team hub.",
    responsibilities: [
      "Run the care rota and first replies within one working day",
      "Keep saved replies and help articles right, in our voice",
      "Pass refunds, data requests and safety concerns to the right team the same day",
      "Send Product the top reasons members wrote in, every week",
    ],
    requirements: [
      "3+ years in customer support, with at least 1 leading or training others",
      "Writes warm, clear answers and stays calm with upset customers",
      "Organised: rotas, queues, follow-ups",
      ...SHARED_REQS,
    ],
  },
  {
    seedKey: "safety-lead", title: "Trust & safety team lead", dept: "moderation", reportsTo: "The Chief of Staff", ...LEADER,
    summary: "Keep NotesApp safe: reports, suspensions and appeals, scams, and above all young members' safety.",
    about: "You'll lead trust and safety across journals, Media, lives, communities and Notes Life, working with Legal & compliance on takedowns and with Customer care on members' reports.",
    responsibilities: [
      "Review reports fairly and consistently against our terms, and decide appeals with someone new",
      "Act within the hour on any risk to a child or young member",
      "Find and remove scams, look-alike accounts and fake giving appeals",
      "Keep the safety playbooks current and train the team",
    ],
    requirements: [
      "2+ years in trust and safety, content moderation, safeguarding or a related field",
      "Sound judgement, written down: can explain every decision",
      "Understands safeguarding for children and teens, and data protection basics",
      ...SHARED_REQS,
    ],
  },
];
