"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type SectionLink = { href: string; label: string; exact?: boolean; group?: string };

// Sub-header for a section of the app (admin, account): a Back button
// plus links to the section's pages, with the current one highlighted.
export default function SectionNav({ title, links, fallbackHref }: { title: string; links: SectionLink[]; fallbackHref: string }) {
  const pathname = usePathname();
  const router = useRouter();

  function goBack() {
    // history.length > 1 is a good-enough "there's somewhere to go back to"
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  const matches = (l: SectionLink) => (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/"));
  // Only the most specific match is highlighted (Money ledger, not also Team hub).
  const best = links.filter(matches).sort((a, b) => b.href.length - a.href.length)[0];
  const active = (l: SectionLink) => l === best;
  // Links with a `group` are shown in labelled clusters, so related pages sit together.
  const groups: { name?: string; links: SectionLink[] }[] = [];
  for (const l of links) {
    const last = groups[groups.length - 1];
    if (last && last.name === l.group) last.links.push(l);
    else groups.push({ name: l.group, links: [l] });
  }

  return (
    <nav aria-label={title} className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={goBack}
          className="mr-2 rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold text-ink hover:border-crimson hover:text-crimson"
        >
          ← Back
        </button>
        <span className="mr-2 font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">{title}</span>
        {groups.map((g, gi) => (
          <div key={g.name ?? gi} className={`flex flex-wrap items-center gap-x-1 gap-y-1 ${g.name ? "rounded-lg border border-rule px-2 py-1" : ""}`}>
            {g.name && <span className="mr-1 font-mono text-[10px] uppercase tracking-eyebrow text-slate">{g.name}</span>}
            {g.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active(l) ? "page" : undefined}
                className={`rounded-full px-3 py-1 font-ui text-xs font-semibold ${
                  active(l) ? "bg-crimson text-paper" : "text-ink hover:text-crimson"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
