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
import { notifyNewPost } from "./notifications";

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
  // Resolves the isWriter()/authorUid gap flagged in an earlier
  // session: firestore.rules could reference authorUid, but nothing
  // ever wrote it, so that permission branch was always unreachable.
  // Now genuinely wired — set on create for anyone publishing under
  // canPublish() (self, not admin picking an author identity), used
  // by firestore.rules' isPublisher() branch to let a paid-tier/
  // staff/volunteer account manage only their own notes. Admin-picked
  // identities (Chimdinma/Emmanuel/@na-notesapp via NoteForm's author
  // toggle) don't set this — those stay isAdmin()-gated, unchanged.
  authorUid?: string;
  authorUsername?: string;
  // Additional authors beyond the primary `author` — display names,
  // same convention as `author` itself (not uids; co-authors are
  // resolved to profiles the same way the primary author is,
  // via getUserByDisplayName). A note with co-authors appears on
  // every listed co-author's profile, not just the primary author's.
  coAuthors?: string[];
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

import { sortNewestFirst } from "./dates";
import { ttlCache } from "./ttl-cache";

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

// True if displayName wrote this note, as primary author OR co-author.
// The one function everywhere that filters "this person's notes"
// should call, so primary-author and co-author cases never drift
// apart the way author-matching logic tends to when copy-pasted.
export function isAuthorOf(note: Note, displayName: string): boolean {
  return note.author === displayName || !!note.coAuthors?.includes(displayName);
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Direct Firestore read of every note. No orderBy("date") on purpose:
// `date` is a string in mixed formats, so Firestore's string ordering is
// wrong (and silently drops docs without a date) — sort by parsed time.
async function readNotesFromFirestore(publishedOnly: boolean): Promise<NoteWithComputed[]> {
  const snap = await getDocs(
    publishedOnly ? query(collection(db, COLLECTION), where("status", "==", "published")) : collection(db, COLLECTION)
  );
  const notes = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Note));
  return sortNewestFirst(notes).map(withComputed);
}

// Public list reads are the biggest Firestore-quota consumer (every
// visitor re-reading every note). They're cached, and in the browser they
// go through /api/public/notes (CDN-cached, no note bodies) so ALL
// visitors share one read set. Admin views (publishedOnly:false) still
// read Firestore directly.
const serverPublicNotes = ttlCache(5 * 60_000, () => readNotesFromFirestore(true));
const browserPublicNotes = ttlCache(2 * 60_000, async () => {
  const res = await fetch("/api/public/notes");
  if (!res.ok) throw new Error("Couldn't load journals right now.");
  return ((await res.json()).notes as NoteWithComputed[]) || [];
});

export function invalidateNotesCache() {
  serverPublicNotes.invalidate();
  browserPublicNotes.invalidate();
}

export async function getAllNotes(
  opts: { publishedOnly?: boolean } = { publishedOnly: true }
): Promise<NoteWithComputed[]> {
  if (opts.publishedOnly === false) return readNotesFromFirestore(false);
  return typeof window === "undefined" ? serverPublicNotes() : browserPublicNotes();
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
  invalidateNotesCache();
  const ref = await addDoc(collection(db, COLLECTION), {
    viewCount: 0,
    likeCount: 0,
    shareCount: 0,
    ...data,
  });
  if (data.status === "published") {
    // Fire-and-forget — a slow/failed notification fan-out shouldn't
    // block the composer from returning. Only fires on create, not on
    // publishing a draft later via updateNote — a known gap, not
    // worth the added complexity of diffing old/new status there for
    // how rarely that path is used today.
    notifyNewPost({ slug: data.slug, title: data.title, author: data.author }).catch((err) =>
      console.warn("notifyNewPost failed:", err)
    );
  }
  return ref.id;
}

export async function updateNote(
  id: string,
  data: Partial<Omit<Note, "id">>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), data);
  invalidateNotesCache();
}

export async function deleteNote(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
  invalidateNotesCache();
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