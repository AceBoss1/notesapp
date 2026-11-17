import type { Firestore } from "firebase-admin/firestore";
import { SITE_URL } from "./host";
import { getArticles } from "./kb-server";
import { buildCopy, copyGaps, copyHashes, type ClaudeCopy, type CopyArticle, type CopyGaps, type CopyHashes } from "./nana-claude";
import { buildSystem } from "./nana-prompt";

// Server side of the Nana on Claude copy (lib/nana-claude.ts). serverConfig/nanaClaudeCopy (server-only in firestore.rules) remembers
// the last copy taken: its fingerprints, when, and who. The articles are the ones the help centre shows now, with the prices and limits
// saved in Admin, so a copy never quotes a built-in figure. Team-only articles (hub-…) are never copied.
const DOC = "serverConfig/nanaClaudeCopy";
type Last = { hashes: CopyHashes; at: string; byEmail: string; total: number };

async function current(db: Firestore): Promise<{ articles: CopyArticle[]; system: string }> {
  const all = (await getArticles(db)).filter((a) => !a.slug.startsWith("hub-"));
  return { articles: all.map(({ slug, title, category, body }) => ({ slug, title, category, body })), system: buildSystem(all) };
}
const last = async (db: Firestore): Promise<Last | null> => {
  const d = (await db.doc(DOC).get()).data() as Partial<Last> | undefined;
  return d?.hashes && typeof d.at === "string" ? { hashes: d.hashes, at: d.at, byEmail: String(d.byEmail ?? ""), total: Number(d.total) || 0 } : null;
};

export type CopyCheck = { last: { at: string; byEmail: string; total: number } | null; total: number; gaps: CopyGaps };
// The dry run: what a fresh copy would change. Writes nothing.
export async function claudeCopyCheck(db: Firestore): Promise<CopyCheck> {
  const [cur, was] = await Promise.all([current(db), last(db)]);
  return { last: was ? { at: was.at, byEmail: was.byEmail, total: was.total } : null, total: cur.articles.length, gaps: copyGaps(was?.hashes, cur.articles, cur.system) };
}
// A fresh copy to download, remembered as the last one taken.
export async function claudeCopyExport(db: Firestore, byEmail: string, now = new Date()): Promise<ClaudeCopy> {
  const cur = await current(db);
  const copy = buildCopy(cur.articles, cur.system, SITE_URL, now);
  await db.doc(DOC).set({ hashes: copyHashes(cur.articles, cur.system), at: copy.copiedAt, byEmail, total: cur.articles.length } satisfies Last);
  return copy;
}
