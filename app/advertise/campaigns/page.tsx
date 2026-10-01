"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { AdCampaign } from "@/lib/ad-packages";
import { formatNaira } from "@/lib/booking-time";

type Row = AdCampaign & { stats: { impressions: number; clicks: number } };
const LABEL: Record<AdCampaign["status"], string> = {
  awaiting_payment: "Awaiting payment", in_review: "In review", live: "Live", completed: "Completed", rejected: "Not approved (refunded)",
};

export default function MyCampaignsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        if (!u) return router.replace("/login");
        try {
          const res = await fetch("/api/ads/my-campaigns", { headers: { Authorization: `Bearer ${await u.getIdToken()}` } });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || "Couldn't load campaigns.");
          setRows(j.campaigns);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Couldn't load campaigns.");
        }
      }),
    [router]
  );

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-ink">My ad campaigns</h1>
        <Link href="/advertise/new" className="btn-primary !px-4 !py-2 text-xs">New campaign</Link>
      </div>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {rows === null && !error && <p className="mt-6 text-sm text-slate">Loading…</p>}
      {rows?.length === 0 && <p className="mt-6 text-sm text-slate">No campaigns yet.</p>}
      <div className="mt-6 space-y-3">
        {rows?.map((c) => (
          <div key={c.id} className="card p-4 text-sm">
            <p className="font-semibold text-ink">{c.creative.title} <span className="font-mono text-[11px] text-slate">{LABEL[c.status]}</span></p>
            <p className="text-xs text-slate">
              {c.packageName} · {formatNaira(c.amountKobo)} · {c.impressionsBudget.toLocaleString()} impressions
              {c.endsAt ? ` · ends ${c.endsAt.slice(0, 10)}` : ""}
            </p>
            {(c.status === "live" || c.status === "completed") && (
              <p className="mt-1 text-xs text-ink">
                {c.stats.impressions.toLocaleString()} / {c.impressionsBudget.toLocaleString()} views · {c.stats.clicks.toLocaleString()} clicks
                {c.stats.impressions ? ` · ${((c.stats.clicks / c.stats.impressions) * 100).toFixed(1)}% click rate` : ""}
              </p>
            )}
            {c.rejectedReason && <p className="mt-1 text-xs text-crimson">Reason: {c.rejectedReason}</p>}
            {c.status === "completed" && !!c.refundedKobo && <p className="mt-1 text-xs text-slate">{formatNaira(c.refundedKobo)} refunded for undelivered impressions.</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
