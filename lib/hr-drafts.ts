import { COMPANY_INFO } from "./site";
import { isArrangement, isContractArrangement, type Arrangement } from "./careers";

// Nana-HR's onboarding drafts (owner, 3 Nov 2026: "using the documents I sent for Nora Bawa, Nana-HR could be drafting such for new
// hires"). Three templates taken from those documents with every personal detail removed: the offer of employment (NOTESAPP
// TECHNOLOGIES LTD), the executive option grant (NotesApp Inc., under the 2026 Equity Incentive Plan) and the internal announcement.
// Contract roles (lib/careers.ts isContractArrangement) get an agreement instead of the offer of employment (owner, 15 Nov 2026: "draft
// documents should draft from templates"): the Campus Ambassador Agreement (affiliate rewards and stock options) and the Contractor
// (Consulting) Agreement (stock options only), both independent contractors, not employees.
// Filled from what the Chief of Staff enters; nothing is invented. Anything not given stays as an open point in [brackets], and every
// draft says it is for counsel review: Legal reviews, the CEO (and, for options, the Board) approves and signs. Nana-HR never sends one.

export type DraftTerms = {
  name: string; firstName: string; title: string; reportsTo: string; worksWith: string;
  offerDate: string; startDate: string; hoursPerWeek: string; days: string; arrangement: Arrangement;
  monthlySalary: string; bonusPerMonth: string; salaryAfterMilestone: string; milestoneName: string;
  probationMonths: string; noticeAfterProbation: string; restrictionMonths: string;
  duties: string[]; whatTheyDo: string[]; howToWork: string[];
  optionShares: string; optionPercent: string; exercisePrice: string; grantDate: string;
  timePercent: string; timeMonths: string; cliffDays: string; milestonePercent: string;
};

// Starting points for a role's onboarding drafts, by the vacancy's seedKey (lib/careers.ts SEED_ROLES). The Chief of Staff still checks
// every line; pay, dates and equity are never preset and stay [open points] until entered.
export type RolePreset = { title: string; reportsTo: string; worksWith: string; duties: string[]; whatTheyDo: string[]; howToWork: string[]; hoursPerWeek?: string };
export const ROLE_PRESETS: Record<string, RolePreset> = {
  // Owner, 8 Nov 2026: the Chief of Staff and Senior Executive Assistant is one role and an open vacancy, reporting to the CEO.
  "chief-of-staff": {
    title: "Chief of Staff and Senior Executive Assistant",
    reportsTo: "the Chief Executive Officer",
    worksWith: "the C-suite, the Board Secretary and the Executive Assistants",
    duties: [
      "Weeks 1 to 2: read the handbook, every department brief and the executive office SOP in the team hub library and tick I have read this; set up your staff login with a passkey; meet each C-suite member and team lead",
      "Weeks 2 to 4: take over the leadership rhythm: the Monday leadership week, agendas in the team hub 24 hours before, and the CEO's Friday week in review",
      "From week 3: put every leadership decision on a team hub task with an owner and a date, and report what slipped and why every Friday",
      "Weeks 4 to 8: bring the 90-day plan up to date with the C-suite, and prepare the next board and investor papers with the CFO and the Board Secretary",
      "Weeks 4 to 12: run hiring and onboarding with Nana-HR (approved roles posted, interviews, offers for Legal and the CEO, departments assigned before day one), and lead the Executive Assistants",
    ],
    whatTheyDo: [
      "Runs the leadership agenda and makes sure every decision has an owner, a date and a follow-up",
      "Keeps the 90-day plan, board and investor papers in order with the CEO, the CFO and the Board Secretary",
      "Looks after our people until we have an HR team: hiring, onboarding and department assignments",
      "Leads the Executive Assistants",
    ],
    howToWork: [
      "Send anything that needs a leadership decision as a team hub task, with what's needed, the options and a due date",
      "Ask for time with the CEO or the C-suite through them",
      "Bring people questions to them after your team lead, until we have an HR team",
    ],
  },
  // Owner, 8 Nov 2026: the Chief of Staff and Senior Executive Assistant is one person; Executive Assistants work under them. Shaped on
  // the executive offer the owner sent (Nora Bawa's), with every personal detail left out.
  "executive-assistant": {
    title: "Executive Assistant",
    reportsTo: "the Chief of Staff and Senior Executive Assistant",
    worksWith: "the Chief Executive Officer and the C-suite",
    duties: [
      "Weeks 1 to 2: read the handbook, the executive office brief and SOP in the team hub library and tick I have read this; set up your staff login with a passkey",
      "Weeks 1 to 4: run the diaries and meeting agendas of the leaders you support in the team hub, with each agenda ready 24 hours before",
      "From week 2: take notes in leadership meetings and turn every decision and action into a team hub task with an owner and a due date within 2 hours",
      "From week 3: chase follow-ups until done, and prepare the CEO's Friday week in review with the Chief of Staff",
      "Weeks 4 to 12: format and file board and investor papers, and support hiring and onboarding (interviews, first-week checklists, logins before day one)",
    ],
    whatTheyDo: [
      "Runs the diaries, agendas and minutes for the leaders they support",
      "Turns meeting decisions into team hub tasks and follows them up until they're done",
      "Helps the Chief of Staff with board papers, hiring and onboarding",
    ],
    howToWork: [
      "Send meeting and diary requests as a team hub task, with what's needed and a due date",
      "Put agenda items in the meeting 24 hours before, each with an owner and the decision wanted",
      "Keep pay, equity and funding figures on the task, with only the people named",
    ],
  },
  // Owner, 15 Nov 2026: the Campus Ambassador (lib/careers.ts, seedKey "campus-ambassador") had no preset, so its drafts came out
  // empty. Taken from the role's own listing: affiliate rewards and stock options, a contract role, about 5 hours a week.
  "campus-ambassador": {
    title: "Campus Ambassador",
    reportsTo: "the User Acquisition Lead",
    worksWith: "the Marketing team and the other Campus Ambassadors",
    hoursPerWeek: "5",
    duties: [
      "Weeks 1 to 2: set up your own referral link, read the brand rules and campaign materials the Marketing team sends you, and agree your campus plan with the User Acquisition Lead",
      "Weeks 2 to 6: introduce NotesApp to departments, clubs, fellowships, student businesses and lecturers on your campus, and help each one set up",
      "From week 3: run your campus's NotesApp community: announcements, study groups, events and lives",
      "Every month: hold at least one short workshop or demo (in person or as a live), and share what students ask for with the team",
      "Every month: report who joined, who started publishing or teaching, and what's working",
    ],
    whatTheyDo: [
      "Brings NotesApp to their campus: departments, clubs, fellowships, student businesses and lecturers",
      "Runs the campus's NotesApp community, with study groups, events and lives",
      "Holds a workshop or demo each month and passes on what students ask for",
    ],
    howToWork: [
      "Send campus events, partnerships and requests to them as a team hub task, with a date",
      "Share campaign codes and materials with them through the Marketing team, never pay or reward figures in group chats",
      "Bring anything about a student's safety or data to Trust & safety the same day",
    ],
  },
};
// A role's preset filled into blank terms (for the library's ready-to-review letter, and the team hub's draft form).
export const presetTerms = (key: string): Partial<Record<keyof DraftTerms, unknown>> => {
  const p = ROLE_PRESETS[key];
  return p ? { title: p.title, reportsTo: p.reportsTo, worksWith: p.worksWith, duties: p.duties, whatTheyDo: p.whatTheyDo, howToWork: p.howToWork, ...(p.hoursPerWeek ? { hoursPerWeek: p.hoursPerWeek } : {}) } : {};
};

const s = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const lines = (v: unknown, n = 8) => (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : []).map((x) => s(String(x).replace(/^[-*•]\s*/, ""), 240)).filter(Boolean).slice(0, n);
// A blank becomes an open point the reviewer can't miss.
const or = (v: string, open: string) => v || `[${open}]`;

export function cleanTerms(b: Record<string, unknown>): DraftTerms {
  const name = s(b.name, 100);
  const arrangement: Arrangement = isArrangement(b.arrangement) ? b.arrangement : "salary_options";
  return {
    name, firstName: s(b.firstName, 60) || name.split(" ")[0] || "", title: s(b.title, 120), reportsTo: s(b.reportsTo, 100) || "the Chief Executive Officer",
    worksWith: s(b.worksWith, 200), offerDate: s(b.offerDate, 40), startDate: s(b.startDate, 40), hoursPerWeek: s(b.hoursPerWeek, 10) || "20",
    days: s(b.days, 80) || "weekdays (Monday to Friday)", arrangement, monthlySalary: s(b.monthlySalary, 30), bonusPerMonth: s(b.bonusPerMonth, 30),
    salaryAfterMilestone: s(b.salaryAfterMilestone, 30), milestoneName: s(b.milestoneName, 80), probationMonths: s(b.probationMonths, 10) || "three",
    noticeAfterProbation: s(b.noticeAfterProbation, 40) || "one month's", restrictionMonths: s(b.restrictionMonths, 10) || "six",
    duties: lines(b.duties), whatTheyDo: lines(b.whatTheyDo, 5), howToWork: lines(b.howToWork, 5),
    optionShares: s(b.optionShares, 20), optionPercent: s(b.optionPercent, 10), exercisePrice: s(b.exercisePrice, 20), grantDate: s(b.grantDate, 40),
    timePercent: s(b.timePercent, 10) || "50%", timeMonths: s(b.timeMonths, 10) || "36", cliffDays: s(b.cliffDays, 10) || "90", milestonePercent: s(b.milestonePercent, 10) || "50%",
  };
}

const HEAD = (company: string, sub: string) =>
  `**${company}**\n\n${sub}\n\n> DRAFT FOR COUNSEL REVIEW. NOT SIGNED. Square brackets are open points. Not legal advice: to be reviewed by Nigerian counsel (and Delaware counsel for anything from NotesApp Inc.) before anyone signs. Drafted by Nana-HR from the team hub templates.\n`;
const OPCO = `${COMPANY_INFO.legalName}\n\nRC ${COMPANY_INFO.rcNumber} · TIN ${COMPANY_INFO.tin} · Federal Republic of Nigeria · Operating company of the NotesApp group`;

export function offerLetter(t: DraftTerms): string {
  const pay: string[] = [];
  if (t.arrangement === "affiliate_options") {
    pay.push("This role is a contract engagement rewarded with affiliate rewards (the NotesApp affiliate and referral programme, paid as members it brings in pay) and employee stock options, so this offer of employment does not apply. Nana-HR drafts the Campus Ambassador Agreement and the option grant instead.");
  } else if (t.arrangement === "options_only") {
    pay.push("This role is a contract engagement rewarded with stock options only, so this offer of employment does not apply. Nana-HR drafts the Contractor (Consulting) Agreement and the option grant instead.");
  } else {
    pay.push("| Item | Amount | When |", "| --- | --- | --- |", `| Monthly salary | ₦${or(t.monthlySalary, "amount")} | Paid monthly in arrears, from your start date |`);
    if (t.bonusPerMonth) pay.push(`| Deferred performance bonus | ₦${t.bonusPerMonth} for each month you serve | Accrues monthly; paid after the ${or(t.milestoneName, "milestone")}, and only if you are still employed on that date |`);
    if (t.salaryAfterMilestone) pay.push(`| Salary after the ${or(t.milestoneName, "milestone")} | ₦${t.salaryAfterMilestone} a month | From the month after the ${or(t.milestoneName, "milestone")} is reached |`);
    pay.push("");
    if (t.bonusPerMonth || t.salaryAfterMilestone) pay.push(`- The ${or(t.milestoneName, "milestone")}: [define it, the date it lapses, and what happens to the deferred bonus if you leave before it or it isn't reached].`);
    pay.push("- Early leaver. If you leave part way through a period, you are paid only for the part you have worked or earned before leaving.", "- Pay is subject to PAYE, pension and other deductions that apply by law. All amounts are in naira.");
  }
  const options = t.arrangement === "salary_options"
    ? `## 4. Stock options\n\nThe Company's parent, NotesApp Inc., will offer you an option to buy shares under a separate Executive Option Grant Agreement. The option is a benefit from the parent, is not part of your salary, and is not a term of your employment contract. It is governed by that agreement and the parent's 2026 Equity Incentive Plan. Your option is [${or(t.optionPercent, "%")} of the parent's fully diluted capital (${or(t.optionShares, "number")} shares)]. Part of your option vests over time and part as the platform reaches user gates (1, 10, 50 and 200 million Verified Registered Users) and a revenue milestone. If your employment ends, you keep only the options already vested on that date, and have 14 days to exercise them; unvested options end.\n\n`
    : "";
  const n = (k: number) => (t.arrangement === "salary_options" ? k : k - 1);
  return `${HEAD(OPCO, "Offer of Employment")}
${or(t.title, "role")}. Employer: ${COMPANY_INFO.legalName}.

Date: ${or(t.offerDate, "date")}

Dear ${or(t.firstName, "name")},

${COMPANY_INFO.legalName}, RC ${COMPANY_INFO.rcNumber} ("the Company"), offers you employment on the terms below. This letter is a written statement of terms of employment under Nigerian law.

## 1. Role

You will join as ${or(t.title, "role")}. You report to ${t.reportsTo}${t.worksWith ? `, and work with ${t.worksWith}` : ""}. Your duties are set out in the appendix (the first 90 days) and may be adjusted in writing as the Company grows.

## 2. Start date, hours and place of work

You start on ${or(t.startDate, "start date")}. The role is ${Number(t.hoursPerWeek) >= 40 ? "full time" : "part time"}, on ${t.days}, for ${t.hoursPerWeek} hours a week, at times agreed with ${t.reportsTo}. You will work remotely and from time to time at a location the Company names. Your first [${t.probationMonths}] months are a probation period. You record your hours in NotesApp Time Track in the team hub.

## 3. Pay

${pay.join("\n")}

${options}## ${n(5)}. Leave, expenses and notice

You are entitled to annual leave, public holidays and sick leave as the law provides, pro rata to your hours. The Company reimburses reasonable expenses that it approved in advance and that you have documented. After probation, either of us may end the employment on [${t.noticeAfterProbation}] written notice, or pay in place of notice. The Company may end it without notice for serious misconduct.

## ${n(6)}. Confidentiality and intellectual property

You must keep the Company's and its group's information confidential, during and after employment. Everything you create in the course of your work (writing, designs, code, documents and know-how) belongs to the Company, and you will sign what is needed to confirm that. The Company may pass this on to NotesApp Inc., the group's IP holder. You will not take or use customer or member personal data except as your work requires, and you follow the Company's data protection rules (Nigeria Data Protection Act 2023). Customer and personal data stays with the Company.

## ${n(7)}. Restrictions

For [${t.restrictionMonths}] months after you leave you will not solicit the Company's staff or approach its customers or partners using confidential information. Nothing stops you working in the industry generally. [Counsel to confirm enforceability and scope.]

## ${n(8)}. Law and general

This letter is governed by the laws of the Federal Republic of Nigeria. It replaces earlier discussions about your role. Changes must be in writing and signed. Please sign and return a copy.

Yours sincerely,

________________________ (Chief Executive Officer) · ________________________ (Secretary), ${COMPANY_INFO.legalName}

## Acceptance

I accept this offer on the terms above.

________________________ ${or(t.name, "name")} · Date: __________

## Appendix: the first 90 days

${t.duties.length ? t.duties.map((d) => `- ${d}`).join("\n") : "- [duties for the first 90 days]"}
`;
}

export function optionGrant(t: DraftTerms): string {
  return `${HEAD("NotesApp Inc.", "A Delaware corporation, United States · Parent and intellectual property holding company of the NotesApp group")}
# Executive Option Grant Agreement

NotesApp Inc. and ${or(t.name, "name")}, under the 2026 Equity Incentive Plan.

This agreement is made on ${or(t.grantDate, "grant date")} between NotesApp Inc., a Delaware corporation (the "Company"), and ${or(t.name, "name")} ("you"). It is governed by the Company's 2026 Equity Incentive Plan (the "Plan"). If this agreement and the Plan conflict, the Plan controls.

## 1. The option

| Item | Term |
| --- | --- |
| Option | A non-qualified stock option to buy Common Stock |
| Shares | ${or(t.optionShares, "number")} shares, being ${or(t.optionPercent, "%")} of the Company's fully diluted shares on the Grant Date |
| Grant Date | ${or(t.grantDate, "date the Board approves the grant")} |
| Exercise price | US$${or(t.exercisePrice, "price")} per share, not less than fair market value on the Grant Date, [method] |
| Expiry | Ten years from the Grant Date, or earlier as this agreement says |
| Service | ${isContractArrangement(t.arrangement) ? `Your services under your ${t.arrangement === "affiliate_options" ? "Campus Ambassador Agreement" : "Contractor (Consulting) Agreement"} with ${COMPANY_INFO.legalName} (a subsidiary) count as service to the Company` : `Your employment with ${COMPANY_INFO.legalName} (a subsidiary) counts as service to the Company`} |

## 2. Vesting

The option vests in two parts, each only while you remain in continuous service:

1. Time vesting: [${t.timePercent}] of the shares, monthly over [${t.timeMonths}] months from the Vesting Start Date, with a ${t.cliffDays}-day cliff.
2. Milestone vesting: [${t.milestonePercent}] of the shares, in tranches, as the Board confirms each milestone has been met, and only if you are still in service on that date.

| Tranche | Milestone | Share of milestone part |
| --- | --- | --- |
| M1 Seed Gate | 1,000,000 Verified Registered Users | [●]% |
| M2 Series A Gate | 10,000,000 Verified Registered Users | [●]% |
| M3 Series B Gate | 50,000,000 Verified Registered Users, cross-country | [●]% |
| M4 Series C Gate | 200,000,000 Verified Registered Users, cross-continent | [●]% |
| M5 Revenue | Cumulative Platform Revenue of ₦[●] | [●]% |

Definitions of Verified Registered Users, cross-country, cross-continent and Cumulative Platform Revenue, and their independent verification by the CFO and the CPO, are as in the Plan and the standard grant. Any milestone not met by the fifth anniversary of the Grant Date lapses.

## 3. When you stop providing service

- Unvested options end at once for any reason and return to the Plan pool. You keep only options already vested.
- You may exercise vested options only in the 14 days after your service ends, and in the 14 days before a Series A financing (with at least 14 days' notice by email and a team hub bell). Options not exercised in the window end.

## 4. Sale or listing; how to exercise; transfer and voting; tax and law

As in the standard Executive Option Grant Agreement: unvested options end on a sale or listing; exercise by written notice with payment (in US dollars or another way the Board allows); no sale or pledge of the option; shares subject to the bylaws, a right of first refusal, a market stand-off and the Voting Agreement; you are responsible for your own taxes; Delaware law, except where Nigerian law applies mandatorily. [Counsel: §212(e) and enforceability; Nigerian tax, exchange control and securities.]

________________________ President and CEO, NotesApp Inc. · ________________________ ${or(t.name, "name")}, Optionee · Date: __________
`;
}

export function announcement(t: DraftTerms): string {
  const what = t.whatTheyDo.length ? t.whatTheyDo : ["[what they do, in two or three lines]"];
  const how = t.howToWork.length ? t.howToWork : [`Send requests for ${or(t.firstName, "them")} through the team hub, with a due date.`, "Keep company information inside the team hub and our approved tools."];
  return `${HEAD(OPCO, "Internal Announcement")}
Welcome to our new ${or(t.title, "role")}.

To: The NotesApp team · From: Emmanuel Adams, CEO · Date: [●]

We are glad to tell you that ${or(t.name, "name")} joins NotesApp as ${or(t.title, "role")}, starting on ${or(t.startDate, "start date")}. ${or(t.firstName, "They")} reports to ${t.reportsTo}.

**What ${or(t.firstName, "they")} does**

${what.map((w) => `- ${w}`).join("\n")}

**How to work with ${or(t.firstName, "them")}**

${how.map((w) => `- ${w}`).join("\n")}

Please make ${or(t.firstName, "them")} welcome. If you have a question about the role, ask me.

Emmanuel Adams, Chief Executive Officer, ${COMPANY_INFO.legalName}

> Edit note. This announcement leaves out pay, equity, funding and financial figures on purpose. Those are confidential to the people involved, and stating them in a staff-wide message creates data-protection, tax and expectation risks.
`;
}


// The parts the two contract agreements share: not an employee, confidentiality, data protection, IP, no authority, law, signatures.
const optionClause = (t: DraftTerms, n: number) => `## ${n}. Stock options

NotesApp Inc., the group's parent, will offer you an option to buy shares under a separate Option Grant Agreement and its 2026 Equity Incentive Plan, subject to the approval of its Board. Your option is ${or(t.optionPercent, "%")} of the parent's fully diluted capital (${or(t.optionShares, "number")} shares). Your services under this agreement count as service for that option. The option is governed only by that agreement and the Plan: it is not a fee under this agreement and creates no employment. If this agreement ends, you keep only the options already vested on that date, as that agreement says.`;

const contractorStatus = (n: number, who: string) => `## ${n}. Independent contractor

You provide the services as an independent contractor, not as an employee, worker, partner or agent of the Company. Nothing in this agreement creates employment. You are not entitled to a salary, pension contributions, paid leave or other employee benefits, and the Company does not deduct PAYE from what it pays you. You are responsible for your own taxes and for registering with the tax authority where the law requires it. [Counsel: withholding tax on payments to individuals, and the TIN requirement.] You decide how, when and where you do the work, within what this agreement says. You may work for others at the same time, except for a direct competitor of the NotesApp group without our written agreement. You provide your own phone, computer and data.${who ? ` ${who}` : ""}`;

const sharedTerms = (t: DraftTerms, first: number, extra: { ip: string; restrict?: string }) => {
  let n = first;
  const parts = [
    `## ${n++}. Confidentiality

You must keep confidential everything you learn about the NotesApp group that isn't public: plans, figures, members' and customers' information, the team hub and anything marked confidential. You use it only to provide the services, and you return or delete it when this agreement ends. This continues after the agreement ends. It doesn't cover information that is already public (other than through you), or that the law or a court requires you to disclose (tell us first where the law allows).`,
    `## ${n++}. Data protection

You will handle personal data only as the services need and as the Company instructs, in line with the Nigeria Data Protection Act 2023 and the Company's privacy policy. In particular: you never collect people's personal details for NotesApp outside NotesApp itself (no private lists or spreadsheets of names, phone numbers or emails); you never share anyone's details with a third party; you never contact or target anyone under 18 to sign up or pay; and you tell the Company within 24 hours if you think personal data has been lost, shared or misused. [Counsel: whether a data processing clause or agreement is needed.]`,
    `## ${n++}. Intellectual property

${extra.ip} Your own work from before this agreement, and your own personal accounts, stay yours. The NotesApp names, logos and trade marks belong to the NotesApp group; you get no right in them except the limited use this agreement allows.`,
    ...(extra.restrict ? [extra.restrict.replace("{n}", String(n++))] : []),
    `## ${n++}. No authority to bind the Company

You may not sign anything, make any promise, offer any price, discount or reward, open any account or collect any money on behalf of the Company or anyone in the NotesApp group, or say that you can. Only the Company's officers can bind it, in writing.`,
    `## ${n++}. Law and general

This agreement is governed by the laws of the Federal Republic of Nigeria. [Counsel: disputes first to good-faith discussion for 30 days, then mediation or arbitration in Lagos, or the courts.] It is the whole agreement about the services and replaces earlier discussions. Changes must be in writing and signed by both of us. You may not pass this agreement to anyone else. If a part of it can't be enforced, the rest still applies. Notices go by email to the addresses each of us gives.`,
  ];
  return parts.join("\n\n");
};

const signatures = (t: DraftTerms, role: string) => `Signed for and on behalf of ${COMPANY_INFO.legalName}

________________________ (Chief Executive Officer) · ________________________ (Director or Secretary) · Date: __________

Signed by the ${role}

________________________ ${or(t.name, "name")} · Date: __________`;

const appendix = (t: DraftTerms, open: string) => `## Appendix: the services

${t.duties.length ? t.duties.map((d) => `- ${d}`).join("\n") : `- [${open}]`}`;

// The Campus Ambassador Agreement (affiliate rewards and stock options): an independent contractor who brings NotesApp to their campus.
export function ambassadorAgreement(t: DraftTerms): string {
  return `${HEAD(OPCO, "Campus Ambassador Agreement")}
${or(t.title, "Campus Ambassador")}. ${COMPANY_INFO.legalName} and ${or(t.name, "name")}.

Date: ${or(t.offerDate, "date")}

This agreement is made between ${COMPANY_INFO.legalName}, RC ${COMPANY_INFO.rcNumber}, a company registered in Nigeria ("the Company", "NotesApp"), and ${or(t.name, "name")} of [address] ("you", the Ambassador).

## 1. The engagement

The Company engages you as ${or(t.title, "Campus Ambassador")} at [campus], to bring NotesApp to your campus. You start on ${or(t.startDate, "start date")}. You report to ${t.reportsTo}${t.worksWith ? `, and work with ${t.worksWith}` : ""}. You confirm that you are 18 or over and a current student of [campus].

${contractorStatus(2, "Your studies come first: you choose your hours around them, which we expect to be about " + t.hoursPerWeek + " hours a week.")}

## 3. What you do

You provide the services in the appendix, honestly and with reasonable care. In short: you introduce NotesApp to departments, clubs, fellowships, student businesses and lecturers on your campus and help them set up; you run your campus's NotesApp community; you hold a workshop or demo at least once a month; and you report each month on who joined and what's working. You follow your campus's own rules on events, posters and use of its name, and you get the permission the campus needs before an event.

## 4. Affiliate rewards (no fixed pay)

You are rewarded only through the NotesApp affiliate and referral programme, with your own referral and affiliate links and codes. You earn what the programme pays, at its rates and on its terms as published in the app when the referred payment is made, on payments made by people you genuinely referred. There is no salary, fee, retainer or minimum, and no reward just for sign-ups. Rewards show on your Referrals page, become available and are withdrawn as the programme's rules say. You earn nothing on your own purchases, on accounts you control, or on referrals made in breach of this agreement, and the Company may hold back or reverse rewards on those. The Company may change the programme's rates and terms for the future by updating them in the app and telling you; what you have already earned is not reduced. The Company reimburses expenses only if it approved them in writing beforehand. [Counsel: whether a minimum withdrawal or a cap applies to ambassadors.]

${optionClause(t, 5)}

## 6. Term and ending this agreement

This agreement runs from your start date for [term, for example one academic session], and then continues until either of us ends it. Either of us may end it at any time with [${t.noticeAfterProbation}] written notice. The Company may end it at once if you break the conduct rules below, mislead anyone about NotesApp, misuse personal data or the brand, or stop being a student. When it ends, you stop presenting yourself as a NotesApp ambassador, stop using the brand materials, and return or delete the Company's information. Rewards already earned under the programme's rules are paid as those rules say. [Counsel: whether rewards on referrals made before the end keep accruing for the programme's usual period.]

## 7. Conduct and use of the brand

- You are honest about what NotesApp does. You never promise anyone earnings, results or jobs, and never push anyone to pay.
- When you share your link or talk about NotesApp, you say that you are a NotesApp Campus Ambassador and may earn a reward.
- No spam, fake accounts, fake reviews, buying sign-ups, or paid adverts in NotesApp's name without written approval.
- You follow the NotesApp Terms of Service and Community Guidelines, and the brand rules in the materials we give you. You use the NotesApp names and logos only as those rules allow, only for this engagement, and never change them. That permission ends when this agreement ends.
- You never speak to the press or post as NotesApp's official voice; send those requests to ${t.reportsTo}.
- You report any safety concern about a member, especially a young member, to Trust & safety the same day.

${sharedTerms(t, 8, { ip: "Material you make for the Company in the services (posts, flyers, slides, workshop material, videos) belongs to the Company from creation, and you assign it to the Company; the Company may pass it on to NotesApp Inc., the group's IP holder. You may show it in your own portfolio once it is public." })}

${signatures(t, "Ambassador")}

${appendix(t, "the services, from the role's listing")}
`;
}

// The Contractor (Consulting) Agreement (stock options only): an independent consultant rewarded with an option grant, no cash fee.
export function contractorAgreement(t: DraftTerms): string {
  const restrict = `## {n}. Non-solicitation

For [${t.restrictionMonths}] months after this agreement ends you will not solicit the Company's staff or approach its customers or partners using confidential information. Nothing stops you working in the industry generally. [Counsel to confirm enforceability and scope.]`;
  return `${HEAD(OPCO, "Contractor (Consulting) Agreement")}
${or(t.title, "role")}. ${COMPANY_INFO.legalName} and ${or(t.name, "name")}.

Date: ${or(t.offerDate, "date")}

This agreement is made between ${COMPANY_INFO.legalName}, RC ${COMPANY_INFO.rcNumber}, a company registered in Nigeria ("the Company"), and ${or(t.name, "name")} of [address] ("you", the Consultant).

## 1. The engagement

The Company engages you as a consultant in the role of ${or(t.title, "role")}, starting on ${or(t.startDate, "start date")}. You report to ${t.reportsTo}${t.worksWith ? `, and work with ${t.worksWith}` : ""}, for about ${t.hoursPerWeek} hours a week on ${t.days}, at times you agree with ${t.reportsTo}. You record your hours in NotesApp Time Track in the team hub. The services are set out in the appendix and may be changed by agreement in writing.

${contractorStatus(2, "")}

## 3. Fee and expenses

You are rewarded for the services with stock options only (section 4): the Company pays no cash fee, salary or retainer. [Counsel: consideration for the services and the IP assignment; whether a nominal fee is needed.] The Company reimburses reasonable expenses that it approved in writing beforehand and that you have documented.

${optionClause(t, 4)}

## 5. Term and ending this agreement

This agreement runs from your start date until either of us ends it. Either of us may end it at any time with [${t.noticeAfterProbation}] written notice. The Company may end it at once for serious breach, dishonesty or conduct that harms the NotesApp group. When it ends, you return or delete the Company's information and hand over work in progress.

${sharedTerms(t, 6, { ip: "Everything you create in providing the services (writing, designs, code, documents and know-how) belongs to the Company from creation, and you assign it to the Company and will sign what is needed to confirm that; the Company may pass it on to NotesApp Inc., the group's IP holder. You waive your moral rights in it to the extent the law allows.", restrict })}

${signatures(t, "Consultant")}

${appendix(t, "the services for the first 90 days")}
`;
}

export type DraftKind = "offer" | "agreement" | "grant" | "announcement";

// Which documents a new hire gets: employees an offer letter; contract roles their agreement instead (the Campus Ambassador
// Agreement for affiliate rewards and options, the Contractor (Consulting) Agreement for options only); everyone with options the
// option grant; and everyone the internal announcement.
export function draftsFor(t: DraftTerms): { kind: DraftKind; title: string; markdown: string }[] {
  const out: { kind: DraftKind; title: string; markdown: string }[] = [];
  const who = t.name || "new hire";
  if (t.arrangement === "affiliate_options") out.push({ kind: "agreement", title: `Campus Ambassador Agreement: ${who}`, markdown: ambassadorAgreement(t) });
  else if (t.arrangement === "options_only") out.push({ kind: "agreement", title: `Contractor (Consulting) Agreement: ${who}`, markdown: contractorAgreement(t) });
  else out.push({ kind: "offer", title: `Offer letter: ${who}`, markdown: offerLetter(t) });
  if (t.arrangement !== "salary") out.push({ kind: "grant", title: `Option grant: ${t.name || "new hire"}`, markdown: optionGrant(t) });
  out.push({ kind: "announcement", title: `Internal announcement: ${t.name || "new hire"}`, markdown: announcement(t) });
  return out;
}
