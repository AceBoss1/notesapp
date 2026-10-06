import { COMPANY_INFO } from "./site";

// The licences and registrations register: what each regulated activity needs, who said so, and where it stands. Shown on
// /admin/traction and included in the "Copy summary for a deck" text so an investor can see how the company is controlled.
// To record a change, edit an entry (or add one) and set `reviewed`; the git history is the audit trail.
export type ComplianceStatus = "not-required" | "in-place" | "in-progress" | "to-do";

export type ComplianceItem = {
  id: string;
  area: string;
  question: string;
  position: string; // the conclusion
  status: ComplianceStatus;
  basis: string; // who or what it rests on
  controls?: string[]; // what we do so the conclusion stays true
  next?: string;
  reviewed: string; // YYYY-MM-DD
};

export const STATUS_LABEL: Record<ComplianceStatus, string> = {
  "not-required": "Not required",
  "in-place": "In place",
  "in-progress": "In progress",
  "to-do": "To do",
};

const COUNSEL = "Nigerian legal counsel, October 2026";

export const COMPLIANCE: ComplianceItem[] = [
  {
    id: "wallet",
    area: "Payments",
    question: "Does a prepaid balance usable only on #NotesApp (including paying other members' shops and sessions) need a licence?",
    position: "No licence is needed.",
    status: "not-required",
    basis: COUNSEL,
    controls: [
      "No transfers between members; a member's balance can never increase because another member's decreases.",
      "No cash-out of wallet balances.",
      "Seller and publisher earnings are paid to their bank accounts and are never credited to a wallet.",
      "Promotional bonus credit can't be transferred or cashed out and can't pay for shop items or sessions.",
    ],
    reviewed: "2026-10-06",
  },
  {
    id: "escrow",
    area: "Payments",
    question: "Does the existing “held until delivery, then paid to the seller” flow need anything beyond what the payment provider already holds?",
    position: "Nothing further is needed.",
    status: "not-required",
    basis: COUNSEL,
    controls: ["Card and bank payments are collected by the payment provider (Paystack today; Paylony planned).", "Every payout goes to a verified bank account, after the session or delivery."],
    reviewed: "2026-10-06",
  },
  {
    id: "partner-funds",
    area: "Payments",
    question: "If a licensed partner holds the money, does the platform need its own approval?",
    position: "No approval of our own is needed.",
    status: "not-required",
    basis: COUNSEL,
    reviewed: "2026-10-06",
  },
  {
    id: "data-protection",
    area: "Data protection",
    question: "Registration under the Nigeria Data Protection Act (the data protection regulator, NDPC).",
    position: "Prepare for data-protection registration.",
    status: "to-do",
    basis: `${COUNSEL} — advised to prepare`,
    controls: [
      "Privacy Policy and consent before payment are live; members can download or delete their own data.",
      "Error records are stripped of personal data and deleted after 30 days.",
    ],
    next: "Confirm with counsel whether we are a data controller of major importance and which category applies; appoint a data protection officer; register with NDPC (through a licensed compliance organisation); keep a record of processing; prepare the annual compliance audit; write a breach-response procedure.",
    reviewed: "2026-10-06",
  },
  {
    id: "company",
    area: "Corporate",
    question: "Company registration and tax.",
    position: `${COMPANY_INFO.legalName}, CAC RC ${COMPANY_INFO.rcNumber}, TIN ${COMPANY_INFO.tin}.`,
    status: "in-place",
    basis: "CAC and tax registration",
    reviewed: "2026-10-06",
  },
  {
    id: "smedan",
    area: "Corporate",
    question: "SMEDAN registration.",
    position: COMPANY_INFO.smedanId ? `Registered: ${COMPANY_INFO.smedanId}.` : "Not yet recorded.",
    status: COMPANY_INFO.smedanId ? "in-place" : "to-do",
    basis: "SMEDAN",
    next: COMPANY_INFO.smedanId ? undefined : "Add the number to lib/site.ts (smedanId) once issued.",
    reviewed: "2026-10-06",
  },
];

// Plain text for pasting into a deck or data room.
export function complianceSummary(): string {
  const lines = ["Licences and registrations (register kept in the admin Traction page)"];
  for (const c of COMPLIANCE) {
    lines.push(`- ${c.area} — ${c.question} ${c.position} [${STATUS_LABEL[c.status]}; basis: ${c.basis}; reviewed ${c.reviewed}]${c.next ? ` Next: ${c.next}` : ""}`);
  }
  return lines.join("\n");
}
