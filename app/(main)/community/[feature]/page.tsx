import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { COMMUNITY_FEATURES, communityFeature } from "@/lib/community-features";

// /community/general, /community/spaces, /community/circles and /community/audio-rooms: one page for each part of a community
// (lib/community-features.ts), with real screenshots on a computer and a phone, the limits, how it works, and links to the other parts,
// to Community and to the help article Nana reads.
export const dynamicParams = false;
export function generateStaticParams() {
  return COMMUNITY_FEATURES.map((f) => ({ feature: f.slug }));
}
export function generateMetadata({ params }: { params: { feature: string } }): Metadata {
  const f = communityFeature(params.feature);
  if (!f) return {};
  return { title: `${f.name} in Community`, description: f.intro, alternates: { canonical: `/community/${f.slug}` } };
}

export default function CommunityFeaturePage({ params }: { params: { feature: string } }) {
  const f = communityFeature(params.feature);
  if (!f) notFound();
  const others = COMMUNITY_FEATURES.filter((x) => x.slug !== f.slug);
  return (
    <>
      <PageHero eyebrow={f.eyebrow} title={<>{f.title}</>}>
        <p>{f.intro}</p>
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <nav aria-label="Community" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <Link href="/community" className="shrink-0 rounded-full border border-rule px-4 py-1.5 text-sm text-ink hover:border-crimson">Community</Link>
          {COMMUNITY_FEATURES.map((x) => (
            <Link key={x.slug} href={`/community/${x.slug}`} aria-current={x.slug === f.slug ? "page" : undefined}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${x.slug === f.slug ? "border-crimson bg-crimson text-paper" : "border-rule text-ink hover:border-crimson"}`}>{x.name}</Link>
          ))}
        </nav>

        {/* What it looks like: on a computer, and on a phone beside it (under it on a phone). */}
        <figure className="mt-8 grid items-end gap-5 sm:grid-cols-[1fr_minmax(0,13rem)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.shots.desktop} alt={`${f.shots.alt} (on a computer)`} width={1280} height={900} className="w-full rounded-2xl border border-rule shadow-sm" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.shots.phone} alt={`${f.shots.alt} (on a phone)`} width={585} height={1266} loading="lazy" className="mx-auto w-48 rounded-[1.75rem] border-4 border-ink shadow-md sm:w-full" />
          <figcaption className="text-xs text-slate sm:col-span-2">Grace Chapel Lekki, a sample community, on a computer and on a phone.</figcaption>
        </figure>

        <h2 className="mt-12 font-display text-2xl text-ink">At a glance</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {f.facts.map((x) => (
            <div key={x.label} className="card p-4"><dt className="font-mono text-[11px] uppercase tracking-eyebrow text-slate">{x.label}</dt><dd className="mt-1 font-ui text-sm font-semibold text-ink">{x.value}</dd></div>
          ))}
        </dl>

        {f.sections.map((s) => (
          <section key={s.h} className="mt-10">
            <h2 className="font-display text-2xl text-ink">{s.h}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate">{s.items.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
        ))}

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/community" className="btn-primary">Start a community</Link>
          <Link href={`/help/${f.help}`} className="rounded-full border border-rule px-5 py-2.5 font-ui text-sm font-semibold text-ink hover:border-crimson">{f.name} in the help centre</Link>
        </div>

        <h2 className="mt-14 font-display text-2xl text-ink">The rest of Community</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((x) => (
            <li key={x.slug}><Link href={`/community/${x.slug}`} className="card block h-full p-4 hover:border-crimson">
              <strong className="font-ui text-sm text-ink">{x.name} →</strong><p className="mt-1 line-clamp-3 text-sm text-slate">{x.intro}</p>
            </Link></li>
          ))}
        </ul>
      </div>
    </>
  );
}
