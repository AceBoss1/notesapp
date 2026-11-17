"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import PageHero from "@/components/PageHero";
import SiteSetup from "@/components/site-setup/SiteSetup";

// Nana sets up your site (docs/SITE_NANA.md).
export default function SiteNanaPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => onAuthStateChanged(auth, (u) => { if (!u) router.replace("/login?next=/profile/site/nana"); else setUser(u); }), [router]);
  return (
    <>
      <PageHero compact max="max-w-2xl" eyebrow="Your site" title={<>Let Nana set it up</>}>
        <p>A few questions about what you do. Nana picks a kit and look and drafts your words; you keep, change or skip each part, and nothing goes on your site until you say so.</p>
      </PageHero>
      <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6">{user ? <SiteSetup user={user} /> : <p className="py-16 text-center text-slate">Loading…</p>}</section>
    </>
  );
}
