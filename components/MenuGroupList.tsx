"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { currentLink, groupLinks, type MenuLink } from "@/lib/menu-groups";
import { useOpenGroups } from "@/lib/use-open-groups";
import { ChevronIcon } from "./shell/icons";

// A vertical menu with a drop-down per group (the desktop account menu and the phone account sheet): the loose links first, then
// one header row per group with a chevron, closed unless it holds the page you're on. Remembered in this browser, under `storageKey`
// (lib/use-open-groups.ts). `extra` adds a badge or a note after a link's label.
export default function MenuGroupList({ links, storageKey, itemClass, headerClass, extra, role }: {
  links: MenuLink[]; storageKey: string; itemClass: string; headerClass: string; extra?: (l: MenuLink) => ReactNode; role?: "menuitem";
}) {
  const pathname = usePathname();
  const best = currentLink(links, pathname);
  const { loose, groups } = groupLinks(links);
  const { isOpen, toggle } = useOpenGroups(storageKey, best?.group);
  const id = (g: string) => `menu-${storageKey}-${g}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const item = (l: MenuLink) => (
    <li key={l.href} role="none">
      <Link href={l.href} role={role} aria-current={l === best ? "page" : undefined} className={`${itemClass} flex items-center justify-between gap-2 ${l === best ? "border-l-2 border-crimson bg-paper font-bold" : ""}`}>
        <span>{l.label}</span>{extra?.(l)}
      </Link>
    </li>
  );
  return (
    <>
      {loose.length > 0 && <ul role="none">{loose.map(item)}</ul>}
      {groups.map((g) => {
        const open = isOpen(g.name);
        return (
          <div key={g.name} role="none">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={id(g.name)}
              onClick={(e) => { e.stopPropagation(); toggle(g.name); }}
              className={`${headerClass} flex w-full items-center justify-between gap-2 text-left`}
            >
              <span>{g.name}{best?.group === g.name && <span aria-hidden="true" className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-crimson align-middle" />}</span>
              <ChevronIcon className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            <ul id={id(g.name)} role="none" className={open ? "" : "hidden"}>{g.links.map(item)}</ul>
          </div>
        );
      })}
    </>
  );
}
