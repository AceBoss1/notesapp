"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeParcelId } from "@/lib/orders";

export default function TrackLookupPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="mx-auto max-w-md px-4 py-20">
      <span className="eyebrow">Track a parcel</span>
      <h1 className="mt-3 font-display text-3xl text-ink">Where is my order?</h1>
      <p className="mt-2 text-sm text-slate">Enter the parcel ID from your order email (it looks like NA-7K2M9QXD).</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = normalizeParcelId(id);
          if (!n) return setError("That doesn't look like a parcel ID.");
          router.push(`/track/${n}`);
        }}
        className="mt-6 flex gap-2"
      >
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="NA-XXXXXXXX" className="w-full border border-rule bg-card px-3 py-2 font-mono text-sm outline-none focus:border-crimson" />
        <button className="btn-primary !px-5 !py-2 text-sm">Track</button>
      </form>
      {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
    </section>
  );
}
