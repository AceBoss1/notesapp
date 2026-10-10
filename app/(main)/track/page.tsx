"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeParcelId } from "@/lib/orders";
import PageHero from "@/components/PageHero";

export default function TrackLookupPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  return (
    <div>
      <PageHero eyebrow="Track a parcel" title="Where is my order?" max="max-w-4xl">
        <p>Enter the parcel ID from your order email (it looks like NA-7K2M9QXD).</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = normalizeParcelId(id);
            if (!n) return setError("That doesn't look like a parcel ID.");
            router.push(`/track/${n}`);
          }}
          className="mt-6 flex max-w-lg gap-2"
        >
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="NA-XXXXXXXX" aria-label="Parcel ID" className="w-full border border-paper/30 bg-paper px-4 py-3 font-mono text-sm text-ink outline-none focus:border-crimson" />
          <button className="rounded-full bg-paper px-6 py-3 font-ui text-sm font-bold text-crimson-deep hover:opacity-90">Track</button>
        </form>
        {error && <p className="mt-3 text-sm text-[#FFB3C6]" role="alert">{error}</p>}
      </PageHero>
      <section className="mx-auto grid max-w-4xl gap-4 px-4 py-12 sm:grid-cols-3 sm:px-6">
        {[["Your money is held", "The seller is paid only after you confirm the parcel arrived."], ["Every order has an ID", "It is in your confirmation email and under Orders & parcels."], ["Something wrong?", "Report a problem on the order page, or contact the team."]].map(([h, t]) => (
          <div key={h} className="card p-5"><p className="font-ui text-sm font-bold text-ink">{h}</p><p className="mt-1 text-xs text-slate">{t}</p></div>
        ))}
      </section>
    </div>
  );
}
