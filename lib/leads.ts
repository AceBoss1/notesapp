import {
  addDoc,
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

const LEADS = "leads";

// Generalized past Precheks' contact-form-only version, per the brief:
// "it could be used in notesapp for anything to reach admins faster."
// `category` is what makes that generalization real — a partnership
// inquiry and a bug report land in the same inbox but are visibly
// different at a glance.
export type LeadCategory =
  | "partnership"
  | "press"
  | "investment"
  | "support"
  | "bug"
  | "other";

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

export async function getAllLeads(): Promise<Lead[]> {
  const q = query(collection(db, LEADS), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lead);
}

export async function markLeadStatus(id: string, status: Lead["status"]): Promise<void> {
  await updateDoc(doc(db, LEADS, id), { status });
}

export async function deleteLead(id: string): Promise<void> {
  await deleteDoc(doc(db, LEADS, id));
}
