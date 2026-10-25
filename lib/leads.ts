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
  { value: "other", label: "Other" },
] as const;

export type LeadCategory = (typeof LEAD_CATEGORIES)[number]["value"];

export type Lead = {
  id: string;
  name: string;
  email: string;
  category: LeadCategory;
  message: string;
  createdAt: string;
  status: "new" | "read" | "archived";
};

export async function submitLead(data: {
  name: string;
  email: string;
  category: LeadCategory;
  message: string;
}): Promise<void> {
  await addDoc(collection(db, LEADS), {
    ...data,
    createdAt: new Date().toISOString(),
    status: "new",
  });
}

// Staff read and manage leads through /api/admin/leads (masked emails; leads are server-only to staff browsers since v0.91.0).
