"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PageHero from "@/components/PageHero";
import { api } from "@/lib/moments-client";
import { useMember } from "@/lib/member-client";
import { TARGET_LABEL, couponPath, naira } from "@/lib/discounts";
import type { SavedCoupon } from "@/lib/discounts-server";

// A buyer's coupon wallet (lib/discounts-server.ts myCoupons): coupons saved from cards, shops and links. At checkout Nana applies
// the one that takes the most off (bestCoupon); the buyer can remove it.
export default function MyCouponsPage() {
  const { user } = useMember();
  const [coupons, setCoupons] = useState<SavedCoupon[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => api<{ coupons: SavedCoupon[] }>("/api/coupons?mine=1").then((r) => setCoupons(r.coupons)).catch((e) => { setError(e.message); setCoupons([]); }), []);
  useEffect(() => { if (user) void load(); }, [user, load]);

  async function remove(id: string) {
    try { await api("/api/coupons", { body: { action: "remove", id } }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't remove it."); }
  }

  return (
    <>
      <PageHero eyebrow="My account" title="My coupons" compact>
        Coupons you&apos;ve saved from shops and shared cards. At checkout, Nana applies the one that saves you the most, from these and the store&apos;s own.
      </PageHero>
      <section className="mx-auto max-w-3xl px-6 py-10">
        {user === null ? <p className="text-sm text-slate"><Link href="/login?next=/profile/coupons" className="text-crimson underline">Sign in</Link> to see your coupons.</p>
          : coupons === null ? <p className="text-sm text-slate">Loading…</p>
          : coupons.length === 0 ? <p className="text-sm text-slate">No coupons yet. Tap <b>Save</b> on a coupon in a shop, or on a coupon someone shares with you.</p>
          : (
            <ul className="space-y-3">
              {coupons.map((c) => (
                <li key={c.id} className={`card flex flex-wrap items-center justify-between gap-3 border-2 border-dashed p-4 ${c.open ? "border-crimson/40" : "border-rule opacity-60"}`}>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2"><b className="font-mono text-lg text-ink">{c.code}</b>{!c.open && <span className="rounded-full bg-field px-2 py-0.5 font-ui text-[11px] font-bold text-slate">ENDED</span>}</p>
                    <p className="mt-1 text-sm text-ink"><b className="text-crimson">{c.label}</b> at <Link href={`/u/${c.ownerUsername}/store`} className="underline">@{c.ownerUsername}</Link> · {c.targets.map((t) => TARGET_LABEL[t]).join(", ")}</p>
                    <p className="mt-0.5 text-xs text-slate">
                      {c.minOrderKobo ? `On ${naira(c.minOrderKobo)} or more · ` : ""}{c.firstOrderOnly ? "First order only · " : ""}
                      {c.endsAt ? `Ends ${new Date(c.endsAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}` : "No end date"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {c.open && <Link href={`/u/${c.ownerUsername}/store`} className="btn-primary !px-4 !py-2 text-xs">Shop</Link>}
                    <Link href={couponPath(c.ownerUsername, c.code)} className="rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold text-ink hover:border-crimson">Card</Link>
                    <button type="button" onClick={() => remove(c.id)} className="rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold text-slate hover:border-crimson">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        {error && <p className="mt-4 text-sm text-crimson" role="alert">{error}</p>}
        <p className="mt-10 text-xs text-slate">How coupons work: <Link href="/help/discount-codes" className="text-crimson underline">Discount codes and coupons</Link>.</p>
      </section>
    </>
  );
}
