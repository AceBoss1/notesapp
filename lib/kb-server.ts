import type { Firestore } from "firebase-admin/firestore";
import { KbError, cleanArticle, type KbArticle } from "./kb";
import { builtInArticles } from "./kb-articles";

// The knowledge base the Help centre and Nana AI read: the built-in articles plus whatever staff have written at Admin → Help & Nana.
// A staff article with the same slug as a built-in one replaces it (that is how staff correct or extend a built-in answer); unpublish or
// delete it to bring the built-in text back. Staff articles live in the server-only collection `kbArticles`.
const COL = "kbArticles";

type StaffDoc = { slug: string; title: string; category: KbArticle["category"]; body: string; published: boolean; updatedAt: string; updatedByEmail?: string };

let cache: { at: number; list: KbArticle[] } | null = null;
export const clearKbCache = () => { cache = null; };

export async function staffArticles(db: Firestore): Promise<(StaffDoc & { id: string })[]> {
  const snap = await db.collection(COL).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as StaffDoc) })).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

// Everything readers and Nana can see, cached for a minute.
export async function getArticles(db: Firestore, now = Date.now()): Promise<KbArticle[]> {
  if (cache && now - cache.at < 60_000) return cache.list;
  const staff = (await staffArticles(db).catch(() => [])).filter((a) => a.published);
  const bySlug = new Map<string, KbArticle>(builtInArticles().map((a) => [a.slug, a]));
  for (const s of staff) bySlug.set(s.slug, { slug: s.slug, title: s.title, category: s.category, body: s.body, updatedAt: s.updatedAt, source: "staff" });
  const list = [...bySlug.values()];
  cache = { at: now, list };
  return list;
}

export async function getArticle(db: Firestore, slug: string): Promise<KbArticle | null> {
  return (await getArticles(db)).find((a) => a.slug === slug) ?? null;
}

// Staff: create or update (the slug is the document id). Replacing a built-in article just means saving one with its slug.
export async function saveArticle(db: Firestore, byEmail: string, input: { slug?: unknown; title?: unknown; category?: unknown; body?: unknown; published?: unknown }, now = new Date()) {
  const a = cleanArticle(input);
  await db.collection(COL).doc(a.slug).set({ ...a, published: input.published !== false, updatedAt: now.toISOString(), updatedByEmail: byEmail });
  clearKbCache();
  return a.slug;
}

export async function setPublished(db: Firestore, slug: string, published: boolean, byEmail: string, now = new Date()) {
  const ref = db.collection(COL).doc(slug);
  if (!(await ref.get()).exists) throw new KbError("That article wasn't found.", 404);
  await ref.update({ published, updatedAt: now.toISOString(), updatedByEmail: byEmail });
  clearKbCache();
}

export async function deleteArticle(db: Firestore, slug: string) {
  const ref = db.collection(COL).doc(slug);
  if (!(await ref.get()).exists) throw new KbError("That article wasn't found.", 404);
  await ref.delete();
  clearKbCache();
}
