import Link from "next/link";
import type { ReactNode } from "react";

// One shelf on Journals, the marketplace, courses, profiles and Trending (lib/discovery.ts): a heading, a line on why these,
// an optional "See all", then the cards.
export default function Shelf({ title, why, seeAll, children, empty }: { title: string; why?: ReactNode; seeAll?: { href: string; label?: string }; children: ReactNode; empty?: ReactNode }) {
  return (
    <section className="mb-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-2">
        <h2 className="font-display text-2xl text-ink">{title}</h2>
        {seeAll && <Link href={seeAll.href} className="font-ui text-xs font-semibold text-crimson">{seeAll.label ?? "See all"} →</Link>}
      </div>
      {why && <p className="mt-2 text-xs text-slate">{why}</p>}
      <div className="mt-4">{children ?? empty}</div>
    </section>
  );
}
