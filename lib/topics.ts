// Topics: the one list of hashtags journals are filed under and members choose as their interests. Pure and client-safe.
//
// A journal has `topics` (1 to MAX_NOTE_TOPICS of these slugs, picked by the writer) and `tags` (its own free hashtags, tidied
// by normaliseTag). Older journals only have the free-typed `categories` and `tags`: topicsOf() reads those through the
// aliases below, so every journal lands somewhere. A member's interests are users/{uid}.interests (slugs, saved through
// /api/account/interests); the feed, the weekly digest and the Topics tab put those first.
// To add a topic: add a row (a new slug never changes), with any spellings people use as aliases.
export type Topic = { slug: string; label: string; group: TopicGroup; aliases?: string[] };
export const TOPIC_GROUPS = ["Business and money", "Work and careers", "Tech", "Health and wellbeing", "Learning", "Life and culture", "Society", "Places"] as const;
export type TopicGroup = (typeof TOPIC_GROUPS)[number];

export const MAX_NOTE_TOPICS = 3;
export const MAX_NOTE_TAGS = 10;
export const MAX_INTERESTS = 12;
export const MIN_INTERESTS = 3; // a suggestion on the picker, not enforced

const T = (group: TopicGroup, rows: [slug: string, label: string, aliases?: string[]][]): Topic[] => rows.map(([slug, label, aliases]) => ({ slug, label, group, aliases }));
export const TOPICS: Topic[] = [
  ...T("Business and money", [
    ["business", "Business", ["smallbusiness", "sme", "smes", "msme"]],
    ["entrepreneurship", "Entrepreneurship", ["entrepreneur", "entrepreneurs", "founders", "founder"]],
    ["startups", "Startups", ["startup", "venturecapital", "vc", "fundraising"]],
    ["fintech", "Fintech", ["payments", "banking", "digitalpayments"]],
    ["personal-finance", "Personal finance", ["money", "savings", "budgeting", "personalfinance", "finance"]],
    ["investing", "Investing", ["investment", "investments", "stocks", "crypto", "cryptocurrency"]],
    ["marketing", "Marketing", ["digitalmarketing", "branding", "socialmedia", "socialmediamarketing", "advertising", "growth"]],
    ["sales", "Sales", ["selling", "customers", "customerservice"]],
    ["ecommerce", "E-commerce", ["onlinestore", "onlinebusiness", "shop", "retail"]],
    ["real-estate", "Real estate", ["property", "realestate", "housing"]],
  ]),
  ...T("Work and careers", [
    ["careers", "Careers", ["career", "careerdevelopment", "careerplanning", "jobs", "jobsearch", "cv", "resume"]],
    ["leadership", "Leadership", ["management", "leaders"]],
    ["productivity", "Productivity", ["timemanagement", "habits"]],
    ["freelancing", "Freelancing", ["freelance", "freelancer", "gigs", "sidehustle", "remotework", "remote"]],
    ["hr", "People and HR", ["humanresources", "hiring", "recruitment", "workplace"]],
  ]),
  ...T("Tech", [
    ["tech", "Tech", ["technology", "itniches", "it"]],
    ["ai", "AI", ["artificialintelligence", "machinelearning", "ml", "chatgpt", "claude"]],
    ["software", "Software and coding", ["coding", "programming", "developer", "developers", "webdevelopment", "softwareengineering"]],
    ["design", "Design", ["uiux", "ux", "ui", "productdesign", "graphicdesign"]],
    ["data", "Data", ["dataanalysis", "dataanalytics", "datascience", "analytics"]],
    ["cybersecurity", "Cybersecurity", ["security", "infosec"]],
    ["product", "Product management", ["productmanagement", "projectmanagement"]],
  ]),
  ...T("Health and wellbeing", [
    ["health", "Health", ["healthcare", "medicine", "wellness"]],
    ["mental-health", "Mental health", ["mentalhealth", "therapy", "selfcare", "anxiety", "depression"]],
    ["fitness", "Fitness", ["gym", "exercise", "workout"]],
    ["nutrition", "Nutrition", ["diet", "healthyeating"]],
    ["relationships", "Relationships", ["marriage", "dating", "love"]],
    ["parenting", "Parenting", ["family", "motherhood", "fatherhood", "kids", "children"]],
  ]),
  ...T("Learning", [
    ["education", "Education", ["learning", "teaching", "school", "students", "edtech"]],
    ["scholarships", "Scholarships and study abroad", ["studyabroad", "scholarship", "masters", "phd"]],
    ["books", "Books", ["reading", "bookreview", "bookreviews"]],
    ["writing", "Writing", ["writer", "writers", "poetry", "blogging", "storytelling"]],
  ]),
  ...T("Life and culture", [
    ["faith", "Faith", ["christianity", "church", "islam", "religion", "spirituality", "devotional"]],
    ["lifestyle", "Lifestyle", ["life", "living"]],
    ["fashion", "Fashion", ["style", "clothing"]],
    ["beauty", "Beauty", ["skincare", "makeup", "hair"]],
    ["food", "Food", ["cooking", "recipes", "restaurants"]],
    ["travel", "Travel", ["tourism", "hotels"]],
    ["music", "Music", ["afrobeats", "musicians"]],
    ["film", "Film and TV", ["movies", "nollywood", "tv"]],
    ["art", "Art", ["artists", "painting"]],
    ["photography", "Photography", ["photos", "photographer"]],
    ["sports", "Sports", ["football", "soccer", "basketball"]],
    ["gaming", "Gaming", ["games", "notes-life", "noteslife"]],
  ]),
  ...T("Society", [
    ["news", "News", ["currentaffairs"]],
    ["politics", "Politics", ["governance", "policy", "elections"]],
    ["law", "Law", ["legal", "lawyers"]],
    ["agriculture", "Agriculture", ["farming", "agribusiness", "agritech"]],
    ["climate", "Climate and energy", ["energy", "solar", "environment", "sustainability"]],
    ["community", "Community and non-profits", ["ngo", "nonprofit", "charity", "volunteering"]],
  ]),
  ...T("Places", [
    ["africa", "Africa", ["african", "pan-african"]],
    ["nigeria", "Nigeria", ["naija", "nigerian"]],
    ["lagos", "Lagos"],
    ["abuja", "Abuja"],
  ]),
];

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const BY_SLUG = new Map(TOPICS.map((t) => [t.slug, t]));
const BY_NAME = new Map<string, string>();
for (const t of TOPICS) for (const n of [t.slug, t.label, ...(t.aliases ?? [])]) if (!BY_NAME.has(compact(n))) BY_NAME.set(compact(n), t.slug);

export const isTopic = (slug: unknown): slug is string => typeof slug === "string" && BY_SLUG.has(slug);
export const topicOf = (slug: string) => BY_SLUG.get(slug);
export const topicLabel = (slug: string) => BY_SLUG.get(slug)?.label ?? slug;
export const hashtag = (slug: string) => `#${(BY_SLUG.get(slug)?.label ?? slug).replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ""))}`;

// The topic a word or hashtag means ("#FinTech", "fin tech", "UI/UX" → fintech, fintech, design), or null.
export function matchTopic(word: string): string | null {
  return BY_NAME.get(compact(word)) ?? null;
}
// A free hashtag tidied: "#Side Hustle!" → "side-hustle". Empty when nothing is left.
export function normaliseTag(word: string): string {
  return word.toLowerCase().replace(/^#+/, "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
// A list of hashtags as typed (commas, spaces or #s between them), tidied, each once.
export function parseTags(input: string | string[], max = MAX_NOTE_TAGS): string[] {
  const words = Array.isArray(input) ? input : input.split(/[,\n]|(?=#)/);
  return Array.from(new Set(words.map(normaliseTag).filter(Boolean))).slice(0, max);
}
export function cleanTopics(list: unknown, max: number): string[] {
  return Array.isArray(list) ? Array.from(new Set(list.filter(isTopic))).slice(0, max) : [];
}

// A journal's topics: the ones its writer picked, or (older journals) the ones its categories and tags mean.
export function topicsOf(n: { topics?: unknown; categories?: string[]; tags?: string[] }): string[] {
  const picked = cleanTopics(n.topics, MAX_NOTE_TOPICS);
  if (picked.length) return picked;
  const found = [...(n.categories ?? []), ...(n.tags ?? [])].map(matchTopic).filter((s): s is string => !!s);
  return Array.from(new Set(found)).slice(0, MAX_NOTE_TOPICS);
}
// The heading shown on a card (eyebrow): its first topic, else its first category, else "Journal".
export const noteHeading = (n: { topics?: unknown; categories?: string[]; tags?: string[] }) => {
  const t = topicsOf(n)[0];
  return t ? topicLabel(t) : n.categories?.[0] || "Journal";
};

// Journals the reader is interested in first (keeping the order within each part), the rest after.
export function interestsFirst<N extends { topics?: unknown; categories?: string[]; tags?: string[] }>(notes: N[], interests: string[]): { picked: N[]; rest: N[] } {
  const want = new Set(interests);
  if (!want.size) return { picked: [], rest: notes };
  const picked: N[] = [], rest: N[] = [];
  for (const n of notes) (topicsOf(n).some((t) => want.has(t)) ? picked : rest).push(n);
  return { picked, rest };
}
