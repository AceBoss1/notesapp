"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import PageHero from "@/components/PageHero";
import SiteReview from "@/components/site-setup/SiteReview";

// Review my site (docs/SITE_NANA.md).
export default function SiteReviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => onAuthStateChanged(auth, (u) => { if (!u) router.replace("/login?next=/profile/site/review"); else setUser(u); }), [router]);
  return (
    <>
      <PageHero compact max="max-w-2xl" eyebrow="Your site" title={<>Review my site</>}>
        <p>What is stopping visitors from booking, buying or getting in touch, most important first, each with a button to the fix.</p>
      </PageHero>
      <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6">{user ? <SiteReview user={user} /> : <p className="py-16 text-center text-slate">Loading…</p>}</section>
    </>
  );
}
