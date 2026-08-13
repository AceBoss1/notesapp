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
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type Note = {
  id: string;
  slug: string;
  title: string;
  date: string; // ISO string
  categories: string[];
  tags: string[];
  featured_image: string;
  content: string; // markdown
  author: string;
  author_role: string;
  author_avatar: string;
  status: "draft" | "published";
  viewCount?: number;
  likeCount?: number;
  shareCount?: number;
  // #NotesApp-only, additive field — Precheks' own NoteForm never sets
  // or reads this, and its updateDoc calls only touch the fields it
  // knows about, so this survives edits made from either app. Gates
  // the entry behind a subscription to its author's journal.
  premium?: boolean;
};

export type NoteWithComputed = Note & {
  excerpt: string;
  reading_time: number;
};

const COLLECTION = "notes";

function withComputed(note: Note): NoteWithComputed {
  const plain = note.content.replace(/\s+/g, " ").trim();
  const wordCount = plain.split(" ").filter(Boolean).length;
  return {
    ...note,
    excerpt: plain.slice(0, 180) + (plain.length > 180 ? "…" : ""),
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

export async function getAllNotes(
  opts: { publishedOnly?: boolean } = { publishedOnly: true }
): Promise<NoteWithComputed[]> {
  const q = query(collection(db, COLLECTION), orderBy("date", "desc"));
  const snap = await getDocs(q);
  const notes = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as Note)
  );
  const filtered = opts.publishedOnly
    ? notes.filter((n) => n.status === "published")
    : notes;
  return filtered.map(withComputed);
}

export async function getNoteBySlug(
  slug: string
): Promise<NoteWithComputed | null> {
  const q = query(collection(db, COLLECTION), where("slug", "==", slug));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return withComputed({ id: d.id, ...d.data() } as Note);
}

export async function getNoteById(id: string): Promise<Note | null> {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Note;
}

export async function createNote(
  data: Omit<Note, "id">
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    viewCount: 0,
    likeCount: 0,
    shareCount: 0,
    ...data,
  });
  return ref.id;
}

export async function updateNote(
  id: string,
  data: Partial<Omit<Note, "id">>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), data);
}

export async function deleteNote(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function getMoreNotes(
  excludeSlug: string,
  limit = 4
): Promise<NoteWithComputed[]> {
  const all = await getAllNotes();
  const current = all.find((n) => n.slug === excludeSlug);
  const rest = all.filter((n) => n.slug !== excludeSlug);
  if (!current) return rest.slice(0, limit);
  const sameCategory = rest.filter((n) =>
    n.categories.some((c) => current.categories.includes(c))
  );
  const others = rest.filter((n) => !sameCategory.includes(n));
  return [...sameCategory, ...others].slice(0, limit);
}

export function timestampToISO(ts: unknown): string {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  return String(ts);
}
