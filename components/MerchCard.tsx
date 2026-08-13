"use client";

import { useState } from "react";
import { MerchItem, LOGO_OPTIONS } from "@/lib/merch";

export default function MerchCard({ item }: { item: MerchItem }) {
  const [logoId, setLogoId] = useState(LOGO_OPTIONS[0].id);
  const logo = LOGO_OPTIONS.find((l) => l.id === logoId) || LOGO_OPTIONS[0];

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="relative flex aspect-square items-center justify-center bg-paper text-6xl">
        {item.emoji}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo.image}
          alt={logo.label}
          className="absolute bottom-3 right-3 h-9 w-9 rounded-md border border-rule bg-card object-contain p-0.5 shadow"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-ui text-base font-bold text-ink">{item.name}</h3>
        <p className="mt-1 font-mono text-sm text-crimson-bright">{item.price}</p>

        <label className="mt-4 block">
          <span className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">
            Logo
          </span>
          <select
            value={logoId}
            onChange={(e) => setLogoId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-rule bg-card px-3 py-2 font-body text-sm focus:border-crimson outline-none"
          >
            {LOGO_OPTIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <button className="btn-primary mt-4 !py-2 text-xs" disabled>
          Add to Cart (demo — coming soon)
        </button>
      </div>
    </div>
  );
}
