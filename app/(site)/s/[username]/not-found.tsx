"use client";

import Link from "next/link";
import { useSite } from "@/components/site/SiteContext";

// A page that isn't on this member's site (a section they switched off, an About or Contact page not written yet, …),
// inside their own header and footer.
export default function SiteNotFound() {
  const { base } = useSite();
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-display text-2xl text-ink">This page isn&apos;t on this site.</p>
      <Link href={base || "/"} className="mt-4 inline-block text-sm text-crimson underline">Go to the home page</Link>
    </div>
  );
}
