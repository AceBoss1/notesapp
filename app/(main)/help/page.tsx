import Link from "next/link";
import type { Metadata } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { byCategory, searchArticles, summaryOf, articlePath, type KbArticle } from "@/lib/kb";
import { builtInArticles } from "@/lib/kb-articles";
import { getArticles } from "@/lib/kb-server";

export const metadata: Metadata = {
  title: "Help centre",
  description: "Answers about #NotesApp: getting started, plans and prices, publishing and earning, selling, badges, organisations, safety and your data.",
};
export const revalidate = 60;

export default async function HelpPage({ searchParams }: { searchParams: { q?: string } }) {
  // The built-in articles if the staff ones can't be read, so the page never goes blank.
  const all: KbArticle[] = await getArticles(getAdminDb()).catch(() => builtInArticles());
  const q = (searchParams.q ?? "").slice(0, 100).trim();
  const found = q ? searchArticles(all, q) : [];
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Help centre</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">How can we help?</h1>
      <p className="mt-4 max-w-2xl text-lg text-slate">Straight answers about #NotesApp, with the links to do it. Can&apos;t find yours? Ask Nana, our AI helper, in the chat button at the bottom of the page, or <Link href="/contact" className="text-crimson underline">contact the team</Link>.</p>

      <form action="/help" method="get" role="search" className="mt-8 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search, for example “refund” or “payout”" aria-label="Search the help centre" className="min-w-0 flex-1 border border-rule bg-card px-4 py-3 text-sm outline-none focus:border-crimson" />
        <button type="submit" className="btn-primary !px-5">Search</button>
      </form>

      {q ? (
        <section className="mt-10" aria-label="Search results">
          <h2 className="font-display text-2xl text-ink">{found.length ? `${found.length} result${found.length === 1 ? "" : "s"} for “${q}”` : `Nothing found for “${q}”`}</h2>
          {found.length === 0 && <p className="mt-2 text-sm text-slate">Try a different word, <Link href="/help" className="text-crimson underline">browse everything</Link>, or <Link href="/contact" className="text-crimson underline">ask the team</Link>.</p>}
          <ul className="mt-4 space-y-3">
            {found.map((a) => (
              <li key={a.slug} className="card p-5">
                <Link href={articlePath(a.slug)} className="font-ui text-base font-bold text-ink hover:text-crimson">{a.title}</Link>
                <p className="mt-1 text-sm text-slate">{summaryOf(a.body)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        byCategory(all).map((g) => (
          <section key={g.category} className="mt-12" aria-labelledby={`c-${g.category}`}>
            <h2 id={`c-${g.category}`} className="font-display text-2xl text-ink">{g.category}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {g.articles.map((a) => (
                <li key={a.slug} className="card p-5">
                  <Link href={articlePath(a.slug)} className="font-ui text-base font-bold text-ink hover:text-crimson">{a.title}</Link>
                  <p className="mt-1 text-sm text-slate">{summaryOf(a.body, 120)}</p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
