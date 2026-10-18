import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { TOPICS } from "./topics";
import { STORE_CATEGORIES } from "./store-meta";
import { aiCandidates, gemModel, realDeps, type NanaDeps } from "./nana-server";
import {
  MAX_SUBTOPICS, cleanSubtopicLabel, docIdOf, fallbackCategorySuggestion, fallbackTopicSuggestion, parseCategorySuggestion, parseTopicSuggestion,
  sameAsParent, subtopicSlug, validParent, type CategorySuggestion, type Subtopic, type SubtopicKind, type TopicSuggestion,
} from "./subtopics";

// Server side of subtopics and subcategories (lib/subtopics.ts). Collections, readable by everyone and written only here:
//   subtopics/{parent}__{slug}           { kind: "topic", parent, slug, label, uses, createdByUid, createdAt }
//   storeSubcategories/{catKey}__{slug}  { kind: "category", parent (the category's name), slug, label, uses, … }
// Nana's suggestions run on Pearl with #NotesApp's own key and are never charged to the writer's Nana allowance.
export class SubtopicError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const COL: Record<SubtopicKind, string> = { topic: "subtopics", category: "storeSubcategories" };
const MAX_LISTED = 400;

const lists = new Map<SubtopicKind, { at: number; data: Subtopic[] }>();
export async function listSubtopics(db: Firestore, kind: SubtopicKind, fresh = false): Promise<Subtopic[]> {
  const hit = lists.get(kind);
  if (!fresh && hit && Date.now() - hit.at < 60_000) return hit.data;
  const s = await db.collection(COL[kind]).orderBy("uses", "desc").limit(MAX_LISTED).get();
  const data = s.docs.map((d) => ({ parent: String(d.data().parent), slug: String(d.data().slug), label: String(d.data().label) }));
  lists.set(kind, { at: Date.now(), data });
  return data;
}

// One in use: created the first time (the label as first written), counted each time after. Returns what's saved.
export async function ensureSubtopic(db: Firestore, uid: string, kind: SubtopicKind, parent: unknown, rawLabel: unknown, now = new Date()): Promise<Subtopic & { created: boolean }> {
  if (!validParent(kind, parent)) throw new SubtopicError(kind === "topic" ? "Choose one of the topics first." : "Choose one of the categories first.");
  const label = cleanSubtopicLabel(rawLabel);
  if (!label) throw new SubtopicError("Use 2 to 30 letters or numbers, up to four words.");
  if (sameAsParent(kind, parent, label)) throw new SubtopicError("That's the same as the one it sits under.");
  const slug = subtopicSlug(label);
  const ref = db.doc(`${COL[kind]}/${docIdOf(kind, parent, slug)}`);
  const out = await db.runTransaction(async (t) => {
    const d = await t.get(ref);
    if (d.exists) { t.update(ref, { uses: FieldValue.increment(1) }); return { parent, slug, label: String(d.data()!.label), created: false }; }
    t.set(ref, { kind, parent, slug, label, uses: 1, createdByUid: uid, createdAt: now.toISOString() });
    return { parent, slug, label, created: true };
  });
  if (out.created) lists.delete(kind);
  return out;
}
export async function ensureMany(db: Firestore, uid: string, kind: SubtopicKind, items: unknown, now = new Date()): Promise<Subtopic[]> {
  if (!Array.isArray(items)) return [];
  if (items.length > MAX_SUBTOPICS) throw new SubtopicError(`Up to ${MAX_SUBTOPICS} at a time.`);
  const out: Subtopic[] = [];
  for (const i of items as { parent?: unknown; label?: unknown }[]) {
    const s = await ensureSubtopic(db, uid, kind, i?.parent, i?.label, now);
    if (!out.some((x) => x.slug === s.slug && x.parent === s.parent)) out.push({ parent: s.parent, slug: s.slug, label: s.label });
  }
  return out;
}

// ---- Nana's suggestions ----
export type SuggestInput = { kind?: unknown; title?: unknown; summary?: unknown };
export const SUGGEST_TITLE_MIN = 6;
const cache = new Map<string, { at: number; v: TopicSuggestion | CategorySuggestion }>();

function topicPrompt(existing: Subtopic[]) {
  const byParent = new Map<string, string[]>();
  for (const e of existing) byParent.set(e.parent, [...(byParent.get(e.parent) ?? []), e.label]);
  return [
    "You file content on #NotesApp, a Nigerian platform for journals and courses. From a title (and summary), choose where it belongs.",
    "Answer with JSON only: {\"topics\": [\"slug\", ...], \"subtopics\": [{\"parent\": \"slug\", \"label\": \"Name\"}, ...]}",
    "Rules: 1 to 3 topics, using only the slugs below. 0 to 3 subtopics, each under one of your topics: narrower than the topic, 1 to 3 words,",
    "in Title Case, no # sign. Reuse an existing subtopic's exact name when one fits; make a new one only when none does. Never invent topics.",
    "",
    "Topics (slug: name):",
    ...TOPICS.map((t) => `${t.slug}: ${t.label}${byParent.get(t.slug)?.length ? ` (existing subtopics: ${byParent.get(t.slug)!.slice(0, 25).join(", ")})` : ""}`),
  ].join("\n");
}
function categoryPrompt(existing: Subtopic[]) {
  const byParent = new Map<string, string[]>();
  for (const e of existing) byParent.set(e.parent, [...(byParent.get(e.parent) ?? []), e.label]);
  return [
    "You file products in Notes Market, a Nigerian marketplace. From an item's name, suggest where it belongs.",
    "Answer with JSON only: {\"options\": [{\"category\": \"exact category name\", \"subcategory\": \"Name or null\"}, ...]}",
    "Rules: up to 3 options, best first, using only the categories below, exactly as written. A subcategory is narrower than its category,",
    "1 to 3 words, Title Case; reuse an existing one's exact name when it fits, otherwise suggest a new one, or null when the category is enough.",
    "",
    "Categories:",
    ...STORE_CATEGORIES.map((c) => `${c}${byParent.get(c)?.length ? ` (existing: ${byParent.get(c)!.slice(0, 25).join(", ")})` : ""}`),
  ].join("\n");
}

export async function suggestFor(db: Firestore, input: SuggestInput, deps: NanaDeps = realDeps()): Promise<(TopicSuggestion | CategorySuggestion) & { via: "ai" | "words" }> {
  const kind = input.kind === "item" ? "category" : input.kind === "journal" || input.kind === "course" ? "topic" : null;
  if (!kind) throw new SubtopicError("What is it for?");
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const summary = String(input.summary ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  if (title.length < SUGGEST_TITLE_MIN) throw new SubtopicError("Type a few more words of the title first.");
  const key = `${kind}|${title.toLowerCase()}|${summary.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3_600_000) return { ...(hit.v as TopicSuggestion & CategorySuggestion), via: "ai" };
  const existing = await listSubtopics(db, kind);
  const fallback = () => ({ ...(kind === "topic" ? fallbackTopicSuggestion(`${title} ${summary}`, existing) : fallbackCategorySuggestion(title, existing)), via: "words" as const });
  // #NotesApp's own key only (never the writer's own AI account, never their allowance).
  const platform = (await aiCandidates(db)).find((c) => c.source === "platform");
  if (!platform) return fallback();
  try {
    const c = await deps.complete({
      apiKey: platform.apiKey, model: gemModel("pearl"), maxTokens: 300,
      system: [{ type: "text", text: kind === "topic" ? topicPrompt(existing) : categoryPrompt(existing) }],
      messages: [{ role: "user", content: kind === "topic" ? `Title: ${title}${summary ? `\nSummary: ${summary}` : ""}` : `Item: ${title}` }],
    });
    const v = kind === "topic" ? parseTopicSuggestion(c.text, existing) : parseCategorySuggestion(c.text, existing);
    const empty = "topics" in v ? !v.topics.length : !v.options.length;
    if (empty) return fallback();
    cache.set(key, { at: Date.now(), v });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return { ...v, via: "ai" };
  } catch (e) {
    console.error("[suggest] Nana failed, using words", e instanceof Error ? e.message : e);
    return fallback();
  }
}

// ---- Admin → Topics ----
export type SubtopicRow = Subtopic & { kind: SubtopicKind; uses: number; createdAt: string; createdByUid: string };
export async function adminList(db: Firestore): Promise<SubtopicRow[]> {
  const [a, b] = await Promise.all([db.collection(COL.topic).orderBy("createdAt", "desc").limit(500).get(), db.collection(COL.category).orderBy("createdAt", "desc").limit(500).get()]);
  return [...a.docs, ...b.docs].map((d) => {
    const x = d.data();
    return { kind: x.kind === "category" ? "category" : "topic", parent: String(x.parent), slug: String(x.slug), label: String(x.label), uses: Number(x.uses) || 0, createdAt: String(x.createdAt ?? ""), createdByUid: String(x.createdByUid ?? "") };
  });
}
// Renaming changes how it reads from now on (journals keep the hashtag they were saved with); removing takes it off the lists.
export async function adminRename(db: Firestore, kind: SubtopicKind, parent: string, slug: string, rawLabel: unknown): Promise<void> {
  const label = cleanSubtopicLabel(rawLabel);
  if (!label) throw new SubtopicError("Use 2 to 30 letters or numbers, up to four words.");
  const ref = db.doc(`${COL[kind]}/${docIdOf(kind, parent, slug)}`);
  if (!(await ref.get()).exists) throw new SubtopicError("That one wasn't found.", 404);
  await ref.update({ label });
  lists.delete(kind);
}
export async function adminRemove(db: Firestore, kind: SubtopicKind, parent: string, slug: string): Promise<void> {
  await db.doc(`${COL[kind]}/${docIdOf(kind, parent, slug)}`).delete();
  lists.delete(kind);
}
export const isKind = (k: unknown): k is SubtopicKind => k === "topic" || k === "category";
