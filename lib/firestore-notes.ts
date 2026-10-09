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
import { db, auth } from "./firebase";
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
  // Organisation posts: authorUid is the organisation; this is the team member
  // who wrote it (shown as "by @person for #Org").
  writerUid?: string;
  writerUsername?: string;
  // Additional authors beyond the primary `author` — display names,
  // same convention as `author` itself (not uids; co-authors are
  // resolved to profiles the same way the primary author is,
  // via getUserByDisplayName). A note with co-authors appears on
  // every listed co-author's profile, not just the primary author's.
  coAuthors?: string[];
  // Accepted co-authors' uids (server-written via /api/coauthors; the agreed
  // earnings split lives in the private coAuthorInvites collection).
  coAuthorUids?: string[];
  status: "draft" | "published";
  viewCount?: number;
  likeCount?: number;
  shareCount?: number;
  // #NotesApp-only, additive field — Precheks' own NoteForm never sets
  // or reads this, and its updateDoc calls only touch the fields it
  // knows about, so this survives edits made from either app. Gates
  // the entry behind a subscription to its author's journal.
  premium?: boolean;
  // One optional video per post, uploaded through /api/video and verified there; firestore.rules only let a post
  // point at a video the same member uploaded. Not available on premium posts.
  videoId?: string;
  videoKey?: string;
  videoPoster?: string;
  videoDuration?: number;
  videoSize?: number;
};

export type NoteWithComputed = Note & {
  excerpt: string;
  reading_time: number;
};

import { sortNewestFirst } from "./dates";
import { plainText } from "./social-text";
import { ttlCache } from "./ttl-cache";

const COLLECTION = "notes";

function withComputed(note: Note): NoteWithComputed {
  // The opening of the post as plain words (no Markdown marks or image links): it is what cards, search and share previews show.
  const plain = plainText(note.content);
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

// Whose note is it? Prefer stable ids (authorUid / authorUsername) so a
// member changing their display name doesn't orphan their posts; fall back
// to the display-name match older notes rely on (founder / channel posts).
export function isNoteBy(note: Note, who: { uid?: string; username?: string; displayName: string }): boolean {
  if (who.uid && (note.authorUid === who.uid || !!note.coAuthorUids?.includes(who.uid))) return true;
  if (who.username && note.authorUsername === who.username) return true;
  return isAuthorOf(note, who.displayName);
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
  // status filter is required: rules only allow public queries for
  // published notes (drafts are private to their author and admins).
  const q = query(collection(db, COLLECTION), where("slug", "==", slug), where("status", "==", "published"));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return withComputed({ id: d.id, ...d.data() } as Note);
}

// A member's own entries, drafts included (used by /write). Single-field
// query — no composite index — and only their own documents are read.
export async function getNotesByAuthorUid(uid: string): Promise<NoteWithComputed[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where("authorUid", "==", uid)));
  return sortNewestFirst(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Note))).map(withComputed);
}

// Posts a team member wrote for organisations (authorUid is the organisation).
export async function getNotesByWriterUid(uid: string): Promise<NoteWithComputed[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where("writerUid", "==", uid)));
  return sortNewestFirst(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Note))).map(withComputed);
}

// True if another note already uses this slug (note URLs must be unique —
// getNoteBySlug returns the first match).
export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  // Rules hide other people's drafts, so check published notes plus the
  // caller's own notes (two queries the rules accept).
  const queries = [query(collection(db, COLLECTION), where("slug", "==", slug), where("status", "==", "published"))];
  const uid = auth.currentUser?.uid;
  if (uid) queries.push(query(collection(db, COLLECTION), where("slug", "==", slug), where("authorUid", "==", uid)));
  const snaps = await Promise.all(queries.map((q) => getDocs(q)));
  return snaps.some((snap) => snap.docs.some((d) => d.id !== exceptId));
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