"use client";

import Link from "next/link";
import PageHero from "@/components/PageHero";
import DiscountCodesManager from "@/components/DiscountCodesManager";
import { useMember } from "@/lib/member-client";

// A member's discount codes for their own shop, downloads, courses and booked sessions (lib/discounts.ts). On every plan.
export default function DiscountCodesPage() {
  const { user } = useMember();
  return (
    <>
      <PageHero eyebrow="My account" title="Discount codes" compact>
        Make codes for your shop, downloads, courses and sessions, and share them with your audience. You choose how much they take off, what they work on and for how long.
      </PageHero>
      <section className="mx-auto max-w-3xl px-6 py-10">
        {user === null ? (
          <p className="text-sm text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to make discount codes.</p>
        ) : user ? <DiscountCodesManager owner="me" /> : <p className="text-sm text-slate">Loading…</p>}
        <p className="mt-10 text-xs text-slate">How codes work: <Link href="/help/discount-codes" className="text-crimson underline">Discount codes</Link>.</p>
      </section>
    </>
  );
}
