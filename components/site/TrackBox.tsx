"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeParcelId } from "@/lib/orders";
import { useSite } from "./SiteContext";

// On a logistics business's site (the Track section, lib/site-settings.ts): type the tracking number, go to its page on this site.
export default function TrackBox({ title = "Track your parcel", className = "card mt-10 p-6" }: { title?: string; className?: string }) {
  const site = useSite();
  const router = useRouter();
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  return (
    <section className={className} aria-labelledby="track-h">
      <h2 id="track-h" className="font-display text-2xl text-ink">{title}</h2>
      <p className="mt-1 text-sm text-slate">Enter the tracking number {site.displayName} gave you. It looks like NA-7K2M9QXD.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = normalizeParcelId(id);
          if (!n) return setError("That doesn't look like a tracking number.");
          router.push(`${site.base}/track/${n}`);
        }}
        className="mt-4 flex max-w-lg gap-2"
      >
        <input value={id} onChange={(e) => { setId(e.target.value); setError(""); }} placeholder="NA-XXXXXXXX" aria-label="Tracking number" className="w-full border border-rule bg-card px-4 py-3 font-mono text-sm text-ink outline-none focus:border-crimson" />
        <button className="btn-primary shrink-0 !px-6 !py-3 text-sm">Track</button>
      </form>
      {error && <p className="mt-2 text-sm text-crimson" role="alert">{error}</p>}
      {site.services.length > 0 && (
        <div className="mt-5 border-t border-rule pt-4">
          <p className="eyebrow">Our services</p>
          <ul className="mt-2 flex flex-wrap gap-2">{site.services.map((n) => <li key={n} className="rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold text-ink">{n}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
