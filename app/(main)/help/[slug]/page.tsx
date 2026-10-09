import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Markdownish from "@/components/Markdownish";
import { getAdminDb } from "@/lib/firebase-admin";
import { articlePath, summaryOf, type KbArticle } from "@/lib/kb";
import { builtInArticles } from "@/lib/kb-articles";
import { getArticles } from "@/lib/kb-server";

export const revalidate = 60;

const load = async (): Promise<KbArticle[]> => getArticles(getAdminDb()).catch(() => builtInArticles());

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = (await load()).find((x) => x.slug === params.slug);
  return a ? { title: a.title, description: summaryOf(a.body, 155) } : { title: "Help centre" };
}

export default async function HelpArticlePage({ params }: { params: { slug: string } }) {
  const all = await load();
  const a = all.find((x) => x.slug === params.slug);
  if (!a) notFound();
  const related = all.filter((x) => x.category === a.category && x.slug !== a.slug).slice(0, 4);
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="font-ui text-sm"><Link href="/help" className="text-crimson underline">Help centre</Link> <span className="text-slate">/ {a.category}</span></p>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">{a.title}</h1>
      <Markdownish text={a.body} className="mt-6 space-y-1 text-base leading-relaxed text-ink" />
      {a.updatedAt && <p className="mt-6 font-mono text-xs text-slate">Updated {new Date(a.updatedAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</p>}

      <div className="card mt-10 p-6">
        <p className="font-ui text-sm font-bold text-ink">Still stuck?</p>
        <p className="mt-1 text-sm text-slate">Ask Nana, our AI helper, with the chat button at the bottom of the page, or <Link href="/contact" className="text-crimson underline">contact the team</Link> and a person will help.</p>
      </div>

      {related.length > 0 && (
        <section className="mt-10" aria-labelledby="related">
          <h2 id="related" className="font-display text-xl text-ink">More in {a.category}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {related.map((r) => <li key={r.slug}><Link href={articlePath(r.slug)} className="text-crimson underline underline-offset-2">{r.title}</Link></li>)}
          </ul>
        </section>
      )}
    </article>
  );
}
