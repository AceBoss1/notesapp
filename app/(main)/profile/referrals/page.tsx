"use client";

import Link from "next/link";
import PageHero from "@/components/PageHero";
import ReferralsPanel from "@/components/ReferralsPanel";
import { useMember } from "@/lib/member-client";

// A member's referral link, earnings and payouts, and the affiliate share on their own products (lib/referrals.ts).
export default function ReferralsPage() {
  const { user } = useMember();
  return (
    <>
      <PageHero eyebrow="My account" title="Referrals" compact>
        Invite friends with your link, promote products from the affiliate marketplace, and get paid for what you bring.
      </PageHero>
      <section className="mx-auto max-w-3xl px-6 py-10">
        {user === null ? (
          <p className="text-sm text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to see your referral link.</p>
        ) : user ? <ReferralsPanel /> : <p className="text-sm text-slate">Loading…</p>}
        <p className="mt-10 text-xs text-slate">How it works: <Link href="/help/referrals" className="text-crimson underline">Referrals and affiliates</Link>.</p>
      </section>
    </>
  );
}
