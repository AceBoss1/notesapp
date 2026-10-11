"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSite } from "./SiteContext";

const LINKS = [
  { key: "home", label: "Home", path: "" },
  { key: "notes", label: "Notes", path: "/notes" },
  { key: "shop", label: "Shop", path: "/shop" },
] as const;

// Which of the three pages we're on, from the URL as the visitor sees it (works with or without the /s/<username> prefix).
function current(pathname: string): "home" | "notes" | "shop" {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.includes("notes") || seg.includes("journals")) return "notes";
  if (seg.includes("shop") || seg.includes("store")) return "shop";
  return "home";
}

export default function SiteNav({ footer = false }: { footer?: boolean }) {
  const { base, theme } = useSite();
  const dark = theme === "aurora" && !footer;
  const active = current(usePathname() || "/");
  return (
    <nav className={`flex items-center font-ui text-sm font-semibold ${footer ? "gap-5 text-paper/75" : dark ? "gap-5 text-paper sm:gap-7" : "gap-5 text-ink sm:gap-7"}`}>
      {LINKS.map((l) => (
        <Link
          key={l.key}
          href={`${base}${l.path}` || "/"}
          aria-current={!footer && active === l.key ? "page" : undefined}
          className={footer ? "hover:text-paper" : `border-b-2 pb-0.5 transition-colors ${dark ? `hover:text-white ${active === l.key ? "border-paper text-white" : "border-transparent"}` : `hover:text-crimson ${active === l.key ? "border-crimson text-crimson" : "border-transparent"}`}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
