import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

// Kept in its own collection, "journals" — separate from Precheks' "notes"
// collection — so the two apps can safely share one Firebase project
// today without their content mixing.
const COLLECTION = "journals";

export type Journal = {
  id: string;
  slug: string;
  title: string;
  date: string; // ISO string
  visibility: "public" | "private"; // the one-toggle, same-canvas feature
  featured_image: string;
  content: string; // markdown
  author: string;
  authorUsername: string;
  status: "draft" | "published";
  bookable: boolean; // does this entry carry a "Book a session" CTA
  viewCount?: number;
  likeCount?: number;
  shareCount?: number;
  commentCount?: number; // denormalized count, set by the seed script
};

export type JournalWithComputed = Journal & {
  excerpt: string;
  reading_time: number;
};

function withComputed(j: Journal): JournalWithComputed {
  const plain = j.content.replace(/\s+/g, " ").trim();
  const wordCount = plain.split(" ").filter(Boolean).length;
  return {
    ...j,
    excerpt: plain.slice(0, 160) + (plain.length > 160 ? "…" : ""),
    reading_time: Math.max(1, Math.round(wordCount / 200)),
  };
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function getPublicJournals(): Promise<JournalWithComputed[]> {
  const q = query(collection(db, COLLECTION), orderBy("date", "desc"));
  const snap = await getDocs(q);
  const journals = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Journal));
  return journals
    .filter((j) => j.status === "published" && j.visibility === "public")
    .map(withComputed);
}

export async function getJournalBySlug(
  slug: string
): Promise<JournalWithComputed | null> {
  const q = query(collection(db, COLLECTION), where("slug", "==", slug));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return withComputed({ id: d.id, ...d.data() } as Journal);
}

export async function getAllJournalsForAdmin(): Promise<JournalWithComputed[]> {
  const q = query(collection(db, COLLECTION), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Journal))
    .map(withComputed);
}

export async function createJournal(data: Omit<Journal, "id">) {
  return addDoc(collection(db, COLLECTION), data);
}

export async function updateJournal(id: string, data: Partial<Journal>) {
  return updateDoc(doc(db, COLLECTION, id), data);
}

export async function deleteJournal(id: string) {
  return deleteDoc(doc(db, COLLECTION, id));
}

export async function getJournalById(id: string): Promise<Journal | null> {
  const d = await getDoc(doc(db, COLLECTION, id));
  if (!d.exists()) return null;
  return { id: d.id, ...d.data() } as Journal;
}
