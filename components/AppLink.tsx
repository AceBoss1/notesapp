"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSiteOptional } from "@/components/site/SiteContext";

// On a member's own domain, pages like sign-in, sign-up and My orders live on www.notesapp.name.ng (middleware redirects
// them there). A Next <Link> to them would try to fetch the page's data across origins, which the browser blocks (CORS),
// so on a member's domain these are plain links and a normal page load; everywhere else they stay <Link>s.
export function useOnOwnDomain(): boolean {
  const site = useSiteOptional();
  return !!site && site.base === "";
}

export default function AppLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const own = useOnOwnDomain();
  return own ? <a href={href} className={className}>{children}</a> : <Link href={href} className={className}>{children}</Link>;
}

// router.push for the same cases: a full page load on a member's domain.
export function useAppPush(): (href: string) => void {
  const router = useRouter();
  const own = useOnOwnDomain();
  return (href) => (own ? window.location.assign(href) : router.push(href));
}
