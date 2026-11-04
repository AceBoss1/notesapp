import { addDoc, collection } from "firebase/firestore";
import { db } from "./firebase";

const LEADS = "leads";

// Generalized past Precheks' contact-form-only version, per the brief:
// "it could be used in notesapp for anything to reach admins faster."
// `category` is what makes that generalization real — a partnership
// inquiry and a bug report land in the same inbox but are visibly
// different at a glance.
export const LEAD_CATEGORIES = [
  { value: "support", label: "General support" },
  { value: "bookings", label: "Bookings & sessions" },
  { value: "payments", label: "Payments, payouts & refunds" },
  { value: "boost", label: "Boosts & gifts" },
  { value: "advertising", label: "Advertising campaigns" },
  { value: "store", label: "Store orders, parcels & selling" },
  { value: "organisation", label: "Organisation accounts & team" },
  { value: "api", label: "API access, Console & Enterprise" },
  { value: "publishing", label: "Publishing, co-authoring & my journal" },
  { value: "account", label: "Account & login" },
  { value: "report", label: "Report a post or account" },
  { value: "verification", label: "Gold badge / identity verification" },
  { value: "bug", label: "Bug report" },
  { value: "courses", label: "Teaching on Notes Academy" },
  { value: "partnership", label: "Partnership" },
  { value: "press", label: "Press" },
  { value: "investment", label: "Investment" },
  { value: "feedback", label: "Feedback: how's #NotesApp so far?" },
  { value: "anya", label: "Anya smart glasses: be among the first to try" },
  { value: "other", label: "Other" },
] as const;

// Leads that come from their own forms through the server (rate-limited, never the browser's addDoc; firestore.rules refuses
// them from a browser): the one-month feedback form (/contact?topic=feedback, lib/feedback.ts) and the Naija Exam Prep reviewer
// sign-up (/exam-prep/reviewers, lib/prep-reviewers.ts), and the Business books waitlist (/books, lib/books-waitlist.ts). "feedback" is also in the contact form's list, where it opens the
// feedback form instead of the message box.
export const SERVER_LEAD_CATEGORIES = ["feedback", "volunteer", "books-waitlist"] as const;
export type LeadCategory = (typeof LEAD_CATEGORIES)[number]["value"] | "volunteer" | "books-waitlist";
export const LEAD_LABEL: Record<string, string> = { ...Object.fromEntries(LEAD_CATEGORIES.map((c) => [c.value, c.label])), feedback: "Feedback", volunteer: "Exam Prep reviewer", "books-waitlist": "Business books waitlist" };

export type Lead = {
  id: string;
  name: string;
  email: string;
  category: LeadCategory;
  message: string;
  createdAt: string;
  status: "new" | "read" | "archived";
  uid?: string; // the member who sent it, when signed in
  feedback?: import("./feedback").FeedbackAnswers; // category "feedback"
  volunteer?: import("./prep-reviewers").VolunteerAnswers; // category "volunteer"
  booksWaitlist?: import("./books-waitlist").WaitlistAnswers; // category "books-waitlist"
  approval?: { status: "approved" | "declined"; at: string; byUid: string; byName: string; how: "granted" | "invited" | "declined"; subjects: string[]; note?: string };
};

export async function submitLead(data: {
  name: string;
  email: string;
  category: Exclude<LeadCategory, "feedback" | "volunteer" | "books-waitlist">;
  message: string;
}): Promise<void> {
  await addDoc(collection(db, LEADS), {
    ...data,
    createdAt: new Date().toISOString(),
    status: "new",
  });
}

// Staff read and manage leads through /api/admin/leads (masked emails; leads are server-only to staff browsers since v0.91.0).
