import { TOPICS, isTopic, normaliseTag, topicLabel } from "./topics";
import { STORE_CATEGORIES, isStoreCategory } from "./store-meta";

// Subtopics and subcategories (Nana's suggestions from a title, docs in docs/BUILD_LOG.md). Pure and client-safe.
//   A subtopic sits under one of our topics (lib/topics.ts): "IT Support" under #Tech. A journal keeps its subtopics as hashtags (tags),
//   so search and its page work as before; a course keeps them in `subtopics`. A subcategory sits under a Market category: "Bags" under
//   "Shoes & bags", kept on the item as `subcategory`.
//   New ones are created the first time someone saves with them (no review first: the owner's decision), in the public lists
//   subtopics/{parent}__{slug} and storeSubcategories/{categoryKey}__{slug}; our team can rename or remove them in Admin → Topics.
export type Subtopic = { parent: string; slug: string; label: string };
export type SubtopicKind = "topic" | "category";
export const MAX_SUBTOPICS = 3;
export const SUBTOPIC_LABEL_MAX = 30;

// "it support!!" → "It support"; letters, digits, spaces and & + - . ' only; 2 to 30 characters and up to four words. "" when unusable.
export function cleanSubtopicLabel(v: unknown): string {
  const s = String(v ?? "").replace(/^#+/, "").replace(/[^\p{L}\p{N} &+.'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, SUBTOPIC_LABEL_MAX).trim();
  if (s.length < 2 || s.split(" ").length > 4 || !/[\p{L}]/u.test(s)) return "";
  // Keep the writer's capitals (IT, CompTIA); only a first lower-case letter is lifted.
  return s[0].toUpperCase() + s.slice(1);
}
export const subtopicSlug = (label: string) => normaliseTag(label);
// "IT Support" → "#ITSupport", "Real estate law" → "#RealEstateLaw".
export const subtopicHashtag = (label: string) => `#${label.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("")}`;
export const categoryKey = (category: string) => normaliseTag(category);
export const docIdOf = (kind: SubtopicKind, parent: string, slug: string) => `${kind === "topic" ? parent : categoryKey(parent)}__${slug}`;
export const validParent = (kind: SubtopicKind, parent: unknown): parent is string => (kind === "topic" ? isTopic(parent) : isStoreCategory(parent));
// The parent's own name isn't a subtopic of itself ("Tech" under #Tech).
export const sameAsParent = (kind: SubtopicKind, parent: string, label: string) =>
  subtopicSlug(label) === (kind === "topic" ? subtopicSlug(topicLabel(parent)) : categoryKey(parent)) || (kind === "topic" && subtopicSlug(label) === parent);

// What Nana suggests for a title (lib/subtopics-server.ts suggestFor). isNew: not in the list yet, created when it's saved.
export type SuggestedSub = Subtopic & { isNew: boolean };
export type TopicSuggestion = { topics: string[]; subtopics: SuggestedSub[] };
export type CategorySuggestion = { options: { category: string; subcategory: (Omit<SuggestedSub, "parent">) | null }[] };

const lc = (s: string) => s.toLowerCase();
const words = (s: string) => lc(s).split(/[^\p{L}\p{N}+]+/u).filter(Boolean);
const has = (title: string, label: string) => {
  const t = ` ${words(title).join(" ")} `;
  return t.includes(` ${words(label).join(" ")} `);
};

// A model's answer (JSON, perhaps inside a code fence) checked against our lists: topics must be ours, subtopics sit under a valid topic,
// existing ones are matched by slug (so "it support" finds "IT Support"), new ones are tidied and marked isNew.
export function parseTopicSuggestion(text: string, existing: Subtopic[], max = MAX_SUBTOPICS): TopicSuggestion {
  const j = jsonIn(text) as { topics?: unknown; subtopics?: unknown } | null;
  const topics = Array.isArray(j?.topics) ? Array.from(new Set(j!.topics.filter(isTopic))).slice(0, 3) : [];
  const subs: SuggestedSub[] = [];
  for (const s of Array.isArray(j?.subtopics) ? (j!.subtopics as { parent?: unknown; label?: unknown }[]) : []) {
    const parent = s?.parent, label = cleanSubtopicLabel(s?.label);
    if (!validParent("topic", parent) || !label || sameAsParent("topic", parent, label)) continue;
    const slug = subtopicSlug(label);
    if (subs.some((x) => x.slug === slug)) continue;
    const found = existing.find((e) => e.parent === parent && e.slug === slug) ?? existing.find((e) => e.slug === slug);
    subs.push(found ? { ...found, isNew: false } : { parent, slug, label, isNew: true });
    if (subs.length >= max) break;
  }
  // Every subtopic's topic is among the topics (up to three).
  for (const s of subs) if (!topics.includes(s.parent) && topics.length < 3) topics.push(s.parent);
  return { topics, subtopics: subs.filter((s) => topics.includes(s.parent)) };
}
export function parseCategorySuggestion(text: string, existing: Subtopic[]): CategorySuggestion {
  const j = jsonIn(text) as { options?: unknown } | null;
  const options: CategorySuggestion["options"] = [];
  for (const o of Array.isArray(j?.options) ? (j!.options as { category?: unknown; subcategory?: unknown }[]) : []) {
    if (!isStoreCategory(o?.category)) continue;
    const label = cleanSubtopicLabel(o.subcategory);
    const sub = label && !sameAsParent("category", o.category, label) ? (() => {
      const slug = subtopicSlug(label);
      const found = existing.find((e) => e.parent === o.category && e.slug === slug);
      return found ? { slug, label: found.label, isNew: false } : { slug, label, isNew: true };
    })() : null;
    if (options.some((x) => x.category === o.category && x.subcategory?.slug === sub?.slug)) continue;
    options.push({ category: o.category as string, subcategory: sub });
    if (options.length >= 3) break;
  }
  return { options };
}
function jsonIn(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// Without AI (no key, or it's down): the topics the title's words mean, and existing subtopics whose words are all in the title.
export function fallbackTopicSuggestion(title: string, existing: Subtopic[]): TopicSuggestion {
  const subs = existing.filter((e) => has(title, e.label)).slice(0, MAX_SUBTOPICS).map((e) => ({ ...e, isNew: false }));
  const topics = new Set(subs.map((s) => s.parent));
  for (const t of TOPICS) if (topics.size < 3 && [t.label, t.slug, ...(t.aliases ?? [])].some((n) => n.length > 2 && has(title, n.replace(/-/g, " ")))) topics.add(t.slug);
  return { topics: Array.from(topics).slice(0, 3), subtopics: subs };
}
export function fallbackCategorySuggestion(title: string, existing: Subtopic[]): CategorySuggestion {
  const options: CategorySuggestion["options"] = existing.filter((e) => has(title, e.label)).slice(0, 3).map((e) => ({ category: e.parent, subcategory: { slug: e.slug, label: e.label, isNew: false } }));
  for (const c of STORE_CATEGORIES) if (options.length < 3 && c !== "Other" && c.split(/ & /).some((w) => has(title, w)) && !options.some((o) => o.category === c)) options.push({ category: c, subcategory: null });
  return { options };
}
