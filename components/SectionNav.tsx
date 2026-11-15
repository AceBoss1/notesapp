"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { currentLink, groupLinks, type MenuLink } from "@/lib/menu-groups";
import { useOpenGroups } from "@/lib/use-open-groups";
import { ChevronIcon } from "./shell/icons";

export type SectionLink = MenuLink;

// Sub-header for a section of the app (admin, account): a Back button, then the section's pages, with the current one highlighted.
// Links with a `group` sit behind a drop-down button per group (owner, 15 Nov 2026), all closed except the group of the page you're
// on; the buttons stay in one wrapping row and an open group's links show underneath, so nothing scrolls sideways on a phone.
// What you open or close is remembered in this browser (lib/use-open-groups.ts).
export default function SectionNav({ title, links, fallbackHref }: { title: string; links: SectionLink[]; fallbackHref: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const best = currentLink(links, pathname);
  const { loose, groups } = groupLinks(links);
  const { isOpen, toggle } = useOpenGroups(title, best?.group);

  function goBack() {
    // history.length > 1 is a good-enough "there's somewhere to go back to"
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  const idFor = (g: string) => `nav-${title}-${g}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const pill = (l: SectionLink) => (
    <Link
      key={l.href}
      href={l.href}
      aria-current={l === best ? "page" : undefined}
      className={`rounded-full px-3 py-1 font-ui text-xs font-semibold ${l === best ? "bg-crimson text-paper" : "text-ink hover:text-crimson"}`}
    >
      {l.label}
    </Link>
  );

  return (
    <nav aria-label={title} className="border-b border-rule bg-paper">
      <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <button
            type="button"
            onClick={goBack}
            className="mr-2 rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold text-ink hover:border-crimson hover:text-crimson"
          >
            ← Back
          </button>
          <span className="mr-2 font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">{title}</span>
          {loose.map(pill)}
          {groups.map((g) => {
            const open = isOpen(g.name);
            const here = best?.group === g.name;
            return (
              <button
                key={g.name}
                type="button"
                onClick={() => toggle(g.name)}
                aria-expanded={open}
                aria-controls={idFor(g.name)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-eyebrow ${
                  open ? "border-ink bg-ink text-paper" : here ? "border-crimson text-crimson" : "border-rule text-slate hover:border-crimson hover:text-crimson"
                }`}
              >
                {g.name}
                {here && !open && <span className="sr-only"> (the page you&apos;re on)</span>}
                <ChevronIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
            );
          })}
        </div>
        {groups.map((g) => (
          <div key={g.name} id={idFor(g.name)} className={`${isOpen(g.name) ? "flex" : "hidden"} mt-2 flex-wrap items-center gap-x-1 gap-y-1 rounded-lg border border-rule px-2 py-1`}>
            <span className="mr-1 font-mono text-[10px] uppercase tracking-eyebrow text-slate">{g.name}</span>
            {g.links.map(pill)}
          </div>
        ))}
      </div>
    </nav>
  );
}
