"use client";

import Link from "next/link";
import DiscountCodesManager from "@/components/DiscountCodesManager";
import { useAdminAuth } from "@/lib/useAdminAuth";

// #NotesApp's own discount codes (lib/discounts.ts): plans (first payment), boosts, Nana credit, merch and the logistics and inventory add-ons. Growth and Finance.
export default function AdminDiscountsPage() {
  const { user, loading } = useAdminAuth();
  if (loading || !user) return <section className="mx-auto max-w-3xl px-6 py-10 text-sm text-slate">Loading…</section>;
  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="font-ui text-sm text-crimson">← Admin</Link>
      <h1 className="mt-2 font-display text-4xl text-ink">#NotesApp discount codes</h1>
      <p className="mt-2 text-sm text-slate">Codes for our own products: Pro and Business plans (the first payment; the plan then renews at its usual price), boosts, Nana credit, merch, and the logistics and inventory add-ons.</p>
      <div className="mt-6"><DiscountCodesManager owner="notesapp" /></div>
    </section>
  );
}
