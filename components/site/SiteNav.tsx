"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCrimsonTheme } from "@/lib/site-themes";
import { COURSES_LIVE } from "@/lib/site-settings";
import { useSite, type SiteInfo } from "./SiteContext";

type Key = "home" | "notes" | "shop" | "courses" | "about" | "contact";
// `extra`: About and Contact, which only fit the header from a tablet up (the footer always has them).
const LINKS: { key: Key; label: string; path: string; extra?: boolean; shown: (s: SiteInfo) => boolean }[] = [
  { key: "home", label: "Home", path: "", shown: () => true },
  { key: "notes", label: "Notes", path: "/notes", shown: (s) => s.sections.journals },
  { key: "shop", label: "Shop", path: "/shop", shown: (s) => s.sections.shop },
  { key: "courses", label: "Courses", path: "/courses", shown: (s) => COURSES_LIVE && s.sections.courses },
  { key: "about", label: "About", path: "/about", extra: true, shown: (s) => s.pages.about },
  { key: "contact", label: "Contact", path: "/contact", extra: true, shown: (s) => s.pages.contact },
];

// Which page we're on, from the URL as the visitor sees it (works with or without the /s/<username> prefix).
function current(pathname: string): Key {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.includes("notes") || seg.includes("journals")) return "notes";
  if (seg.includes("shop") || seg.includes("store")) return "shop";
  for (const k of ["courses", "about", "contact"] as const) if (seg.includes(k)) return k;
  return "home";
}

export default function SiteNav({ footer = false }: { footer?: boolean }) {
  const site = useSite();
  const { base } = site;
  const dark = isCrimsonTheme(site.theme) && !footer;
  const active = current(usePathname() || "/");
  return (
    <nav className={`flex items-center font-ui text-sm font-semibold ${footer ? "flex-wrap gap-x-5 gap-y-2 text-paper/75" : dark ? "gap-5 text-paper sm:gap-7" : "gap-5 text-ink sm:gap-7"}`}>
      {LINKS.filter((l) => l.shown(site)).map((l) => (
        <Link
          key={l.key}
          href={`${base}${l.path}` || "/"}
          aria-current={!footer && active === l.key ? "page" : undefined}
          className={footer ? "hover:text-paper" : `${l.extra ? "hidden md:inline " : ""}border-b-2 pb-0.5 transition-colors ${dark ? `hover:text-white ${active === l.key ? "border-paper text-white" : "border-transparent"}` : `hover:text-crimson ${active === l.key ? "border-crimson text-crimson" : "border-transparent"}`}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
