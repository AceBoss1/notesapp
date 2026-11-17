// Nana on Claude (docs/NANA_ON_CLAUDE.md): a page on claude.ai where Nana answers from a copy of the help centre, on each visitor's own
// Claude plan. The page can't read our site, so its copy goes stale. Admin → Help & Nana → "Nana on Claude" compares the last copy
// taken with the help centre as it is now and downloads a fresh copy; the page's owner then picks that file on the Claude page and it
// republishes itself. This file is the copy's shape and the comparison; pure, and also built into the Claude page.
export const COPY_KIND = "nana-on-claude";
export type CopyArticle = { slug: string; title: string; category: string; body: string };
export type ClaudeCopy = { kind: typeof COPY_KIND; v: 1; siteUrl: string; copiedAt: string; copied: string; system: string; articles: CopyArticle[] };
export type CopyHashes = Record<string, string>; // slug → a short fingerprint of the article; "#system" is Nana's instructions
export type CopyGaps = { never: boolean; upToDate: boolean; added: string[]; changed: string[]; removed: string[]; instructions: boolean };

export const COPY_ARTICLES_MAX = 600;
export const COPY_BYTES_MAX = 4_000_000;
const SYSTEM_KEY = "#system";

// FNV-1a over the text, as 8 hex digits: enough to tell that an article changed, and it runs the same in a browser.
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export function copyHashes(articles: CopyArticle[], system: string): CopyHashes {
  const out: CopyHashes = { [SYSTEM_KEY]: fingerprint(system) };
  for (const a of articles) out[a.slug] = fingerprint(`${a.title}\n${a.category}\n${a.body}`);
  return out;
}
// What a fresh copy would change, against the fingerprints of the last one (null: none was ever taken from here).
export function copyGaps(last: CopyHashes | null | undefined, articles: CopyArticle[], system: string): CopyGaps {
  const now = copyHashes(articles, system);
  if (!last) return { never: true, upToDate: false, added: articles.map((a) => a.title), changed: [], removed: [], instructions: false };
  const added = articles.filter((a) => !(a.slug in last)).map((a) => a.title);
  const changed = articles.filter((a) => a.slug in last && last[a.slug] !== now[a.slug]).map((a) => a.title);
  const removed = Object.keys(last).filter((k) => k !== SYSTEM_KEY && !(k in now));
  const instructions = last[SYSTEM_KEY] !== now[SYSTEM_KEY];
  return { never: false, upToDate: !added.length && !changed.length && !removed.length && !instructions, added, changed, removed, instructions };
}
export const copiedText = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
export function buildCopy(articles: CopyArticle[], system: string, siteUrl: string, now: Date): ClaudeCopy {
  return { kind: COPY_KIND, v: 1, siteUrl, copiedAt: now.toISOString(), copied: copiedText(now.toISOString()), system, articles: articles.map(({ slug, title, category, body }) => ({ slug, title, category, body })) };
}

// A copy file someone picked on the Claude page: the shape is checked before it replaces anything. Returns the copy or throws a plain message.
export function readCopy(input: unknown): ClaudeCopy {
  const c = input as Partial<ClaudeCopy> | null;
  if (!c || typeof c !== "object" || c.kind !== COPY_KIND || c.v !== 1) throw new Error("That isn't a Nana on Claude copy file. Download a fresh one from Admin → Help & Nana.");
  if (typeof c.siteUrl !== "string" || !/^https:\/\/[a-z0-9.-]+$/.test(c.siteUrl)) throw new Error("The copy file's site address isn't valid.");
  if (typeof c.system !== "string" || c.system.length < 500 || typeof c.copiedAt !== "string" || Number.isNaN(Date.parse(c.copiedAt))) throw new Error("The copy file is incomplete.");
  if (!Array.isArray(c.articles) || c.articles.length < 10 || c.articles.length > COPY_ARTICLES_MAX) throw new Error("The copy file doesn't hold the help articles.");
  const seen = new Set<string>();
  const articles = c.articles.map((a) => {
    if (!a || typeof a.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug) || seen.has(a.slug) || typeof a.title !== "string" || !a.title.trim() || typeof a.category !== "string" || typeof a.body !== "string" || !a.body.trim()) throw new Error("One of the articles in the copy file isn't valid.");
    seen.add(a.slug);
    return { slug: a.slug, title: a.title, category: a.category, body: a.body };
  });
  return { kind: COPY_KIND, v: 1, siteUrl: c.siteUrl, copiedAt: c.copiedAt, copied: copiedText(c.copiedAt), system: c.system, articles };
}
