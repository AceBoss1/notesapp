"use client";

import Link from "next/link";
import { useIsAppHost } from "@/lib/use-app-host";

type L = { href: string; label: string };

// The masthead links: the full set on the main site, the app set on the app domain.
export default function NavLinks({ links, appLinks }: { links: L[]; appLinks: L[] }) {
  const app = useIsAppHost();
  return (
    <>
      {(app ? appLinks : links).map((item) => (
        <Link key={item.href} href={item.href} className="hover:text-crimson transition-colors">{item.label}</Link>
      ))}
    </>
  );
}
