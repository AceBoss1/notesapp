"use client";

import type { ReactNode } from "react";

// The header of Journals, Notes Market, Notes Academy and Trending: what the page is, a search box and the shelf tabs.
export default function DiscoveryHero<T extends string>({ eyebrow, title, sub, query, onQuery, placeholder, tabs, tab, onTab, children }: {
  eyebrow: string; title: ReactNode; sub?: ReactNode; query?: string; onQuery?: (v: string) => void; placeholder?: string;
  tabs: { id: T; label: string }[]; tab: T; onTab: (t: T) => void; children?: ReactNode;
}) {
  return (
    <>
      <section className="bg-gradient-to-br from-crimson-deep via-crimson to-crimson-bright text-paper">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-12">
          <p className="font-mono text-xs uppercase tracking-eyebrow text-paper/70">{eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">{title}</h1>
          {sub && <p className="mt-2 max-w-2xl text-paper/85">{sub}</p>}
          {onQuery && (
            <input value={query ?? ""} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder}
              className="mt-5 w-full max-w-xl rounded-full border border-white/30 bg-white px-5 py-3 text-sm text-ink outline-none placeholder:text-slate focus:border-white" />
          )}
          {children}
        </div>
      </section>
      <div className="border-b border-rule bg-paper">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-8" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 font-ui text-sm font-semibold transition-colors ${tab === t.id ? "bg-crimson text-paper" : "border border-rule text-ink hover:border-crimson"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
