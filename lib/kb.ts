// The #NotesApp knowledge base: help articles that the public Help centre shows and Nana AI answers from. Pure and client-safe.
// Built-in articles live in lib/kb-articles.ts (they read the real prices and limits from code, so they cannot drift); staff add or
// override articles at Admin → Help & Nana, stored in Firestore (lib/kb-server.ts).
export type KbCategory = (typeof KB_CATEGORIES)[number];
export const KB_CATEGORIES = [
  "Getting started",
  "Plans and pricing",
  "Publishing and earning",
  "Selling",
  "Badges and trust",
  "Teams and organisations",
  "Safety and your data",
  "Company",
] as const;
export const isKbCategory = (v: unknown): v is KbCategory => typeof v === "string" && (KB_CATEGORIES as readonly string[]).includes(v);

export type KbArticle = {
  slug: string;
  title: string;
  category: KbCategory;
  body: string; // paragraphs split by a blank line; "- " bullets; **bold**; [text](/path) links
  updatedAt?: string;
  source: "built-in" | "staff";
};

export const KB_TITLE_MAX = 120;
export const KB_BODY_MAX = 6000;
export const articlePath = (slug: string) => `/help/${slug}`;

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
export const isSlug = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 60;

export class KbError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

// A staff-written article, checked and tidied. Throws KbError with a plain-words message.
export function cleanArticle(input: { slug?: unknown; title?: unknown; category?: unknown; body?: unknown }): Omit<KbArticle, "source" | "updatedAt"> {
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim();
  if (!title) throw new KbError("Give the article a title.");
  if (title.length > KB_TITLE_MAX) throw new KbError(`Keep the title under ${KB_TITLE_MAX} characters.`);
  const slug = input.slug ? String(input.slug) : slugify(title);
  if (!isSlug(slug)) throw new KbError("The web address (slug) can only use lowercase letters, numbers and dashes.");
  if (!isKbCategory(input.category)) throw new KbError("Choose a category.");
  const body = String(input.body ?? "").replace(/\r\n/g, "\n").trim();
  if (body.length < 20) throw new KbError("Write at least a couple of sentences.");
  if (body.length > KB_BODY_MAX) throw new KbError(`Keep the article under ${KB_BODY_MAX} characters, or split it in two.`);
  return { slug, title, category: input.category, body };
}

// ---- links
// Where a link may point: our own pages (a path starting with a single slash), or an https address on one of our hosts.
const OWN_HOSTS = ["notesapp.name.ng", "www.notesapp.name.ng", "notesapp.ng", "www.notesapp.ng", "app.notesapp.name.ng"];
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^\/(?!\/)[A-Za-z0-9\-._~/%?=&#]*$/.test(h)) return h;
  try {
    const u = new URL(h);
    if (u.protocol === "https:" && OWN_HOSTS.includes(u.hostname)) return `${u.pathname}${u.search}${u.hash}` || "/";
  } catch { /* not a URL */ }
  return null;
}

// What Nana says is checked before it is shown: a link survives only if it points at a page of ours that exists. Anything else keeps its
// words and loses the link, so the assistant can never send someone to an invented or outside address.
export function sanitizeLinks(text: string, knownPaths: ReadonlySet<string>): string {
  return text.replace(/\[([^\]]{1,120})\]\(([^)\s]{1,300})\)/g, (_m, label: string, href: string) => {
    const safe = safeHref(href);
    if (!safe) return label;
    const path = safe.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
    return knownPaths.has(path) ? `[${label}](${safe})` : label;
  });
}

// ---- search
const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "how", "do", "i", "my", "me", "can", "what", "does", "it", "with", "at", "be", "you", "your"]);
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9₦\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));

// A simple ranking: words in the title count most, then the category, then the body.
export function searchArticles(all: KbArticle[], q: string, limit = 20): KbArticle[] {
  const ws = words(q);
  if (!ws.length) return [];
  const scored = all.map((a) => {
    const t = a.title.toLowerCase(), c = a.category.toLowerCase(), b = a.body.toLowerCase();
    let score = 0;
    for (const w of ws) score += (t.includes(w) ? 5 : 0) + (c.includes(w) ? 2 : 0) + (b.includes(w) ? 1 : 0);
    return { a, score };
  });
  return scored.filter((x) => x.score > 0).sort((x, y) => y.score - x.score).slice(0, limit).map((x) => x.a);
}

export const byCategory = (all: KbArticle[]) => KB_CATEGORIES.map((category) => ({ category, articles: all.filter((a) => a.category === category) })).filter((g) => g.articles.length);

// The first sentence or two, for meta descriptions and list previews.
export function summaryOf(body: string, max = 170): string {
  const plain = body.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "").replace(/^- /gm, "").replace(/\s+/g, " ").trim();
  return plain.length <= max ? plain : `${plain.slice(0, max).replace(/\s+\S*$/, "")}…`;
}
